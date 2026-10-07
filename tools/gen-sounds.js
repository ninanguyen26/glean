/* Glean sound synth — deterministic WAVs, no dependencies.
 * Usage: node tools/gen-sounds.js   (writes assets/audio/*.wav)
 * Wooden "tok"/pop for the PLAY/START buttons: short pitched knock
 * with a fast decay, warm, not clicky.
 */
const fs = require("fs");
const path = require("path");

const SR = 44100;
const OUT = path.join(__dirname, "..", "assets", "audio");

function writeWav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("wrote", name, n, "samples");
}

// deterministic pseudo-random (mulberry32) so builds are reproducible
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Playful bloop (Ngoc's pick, v5): pitch sweeps up 280->640Hz with a
 * quick decay. ~130ms total. */
function tapPop() {
  const dur = 0.13;
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // phase integrates the sweeping freq for a smooth glide
    const phase =
      2 * Math.PI * (280 * t + (360 * Math.pow(t, 3)) / (3 * dur * dur));
    const s = Math.sin(phase) * Math.exp(-t * 30);
    // 5ms fade-out tail to avoid clicks
    const tail = Math.min(1, (dur - t) / 0.005);
    out[i] = s * 0.75 * tail;
  }
  return out;
}

function render(dur, fn) {
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0 ? 0.75 / peak : 1;
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

/* Correct drop: happy two-note chime (G5 -> C6), warm. */
function dropCorrect() {
  const dur = 0.38;
  const notes = [
    { f: 784.0, t0: 0.0 },
    { f: 1046.5, t0: 0.09 },
  ];
  return render(dur, (t) => {
    let s = 0;
    for (const { f, t0 } of notes) {
      if (t >= t0) {
        const dt = t - t0;
        s +=
          (Math.sin(2 * Math.PI * f * dt) * 0.6 +
            Math.sin(2 * Math.PI * f * 2 * dt) * 0.15) *
          Math.exp(-dt * 22);
      }
    }
    return s * Math.min(1, (dur - t) / 0.01);
  });
}

/* Wrong drop: soft descending womp (220->130Hz). Gentle, not punishing. */
function dropWrong() {
  const dur = 0.28;
  return render(dur, (t) => {
    const phase = 2 * Math.PI * (220 * t - (90 * t * t) / (2 * dur));
    const s =
      (Math.sin(phase) * 0.65 + Math.sin(phase * 2) * 0.12) *
      Math.exp(-t * 16);
    return s * Math.min(1, t / 0.006) * Math.min(1, (dur - t) / 0.01);
  });
}

fs.mkdirSync(OUT, { recursive: true });
writeWav("tap-pop.wav", tapPop());
writeWav("drop-correct.wav", dropCorrect());
writeWav("drop-wrong.wav", dropWrong());
console.log("done ->", OUT);
