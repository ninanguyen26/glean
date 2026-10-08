/* Glean main music loop — APPROVED variant (round 2, "music box").
 * 10.0s seamless loop, 96 BPM (4 bars of 4/4 = exactly 10s).
 * Warm detuned pad (C -> G -> Am -> F) + soft sub root +
 * music-box bell lead + faint air bed.
 * Rendered into an extended buffer; the tail is folded back over the head
 * so the loop point has no click or dip. Deterministic (seeded PRNG) —
 * re-running produces the identical file.
 * Usage: node tools/gen-music.js  ->  assets/audio/main-music.wav
 */
const fs = require("fs");
const path = require("path");

const SR = 44100;
const DUR = 10;
const N = SR * DUR;
const BAR = 2.5;
const TAIL = 1.2;
const TAIL_N = Math.floor(SR * TAIL);
const EXT = N + TAIL_N;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEMI = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
function nf(name) {
  const m = name.match(/^([A-G]#?)(\d)$/);
  const midi = SEMI[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Cmaj9 -> Gadd9 -> Am9 -> Fmaj9
const CHORDS = [
  ["C3", "G3", "B3", "D4", "E4"],
  ["G2", "D3", "B3", "A3", "E4"],
  ["A2", "E3", "G3", "B3", "C4"],
  ["F2", "C3", "E3", "G3", "A3"],
];

// [seconds, note] — music-box lead, stays clear of the loop point
const LEAD = [
  [0.6, "E5"], [1.85, "G5"], [3.35, "D5"], [4.6, "B4"],
  [5.85, "C5"], [7.1, "A4"], [8.35, "F5"], [9.35, "E5"],
];

const buf = new Float64Array(EXT);

// pad
{
  const gain = 0.42, bright = 0.8;
  const h2 = 0.22 * bright, h3 = 0.1 * bright;
  CHORDS.forEach((ch, i) => {
    const start = Math.floor(i * BAR * SR);
    const len = Math.floor((BAR + TAIL) * SR);
    const freqs = ch.map(nf);
    for (let s = 0; s < len; s++) {
      const t = s / SR;
      const atk = 1.4;
      let env;
      if (t < atk) env = 0.5 - 0.5 * Math.cos((Math.PI * t) / atk);
      else if (t > BAR) env = 0.5 + 0.5 * Math.cos((Math.PI * (t - BAR)) / TAIL);
      else env = 1;
      let v = 0;
      for (const f of freqs) {
        v += Math.sin(2 * Math.PI * f * t);
        v += h2 * Math.sin(2 * Math.PI * 2 * f * t);
        v += h3 * Math.sin(2 * Math.PI * 3 * f * t);
        v += 0.3 * Math.sin(2 * Math.PI * f * 1.0016 * t);
      }
      buf[start + s] += (v / freqs.length) * env * gain;
    }
  });
}

// sub root
CHORDS.forEach((ch, i) => {
  const f = nf(ch[0]) / 2;
  const start = Math.floor(i * BAR * SR);
  const len = Math.floor((BAR + TAIL) * SR);
  for (let s = 0; s < len; s++) {
    const t = s / SR;
    const atk = 1.4;
    let env;
    if (t < atk) env = 0.5 - 0.5 * Math.cos((Math.PI * t) / atk);
    else if (t > BAR) env = 0.5 + 0.5 * Math.cos((Math.PI * (t - BAR)) / TAIL);
    else env = 1;
    buf[start + s] += Math.sin(2 * Math.PI * f * t) * env * 0.16;
  }
});

// music-box lead (long decay bell)
for (const [tt, name] of LEAD) {
  const f = nf(name);
  const start = Math.floor(tt * SR);
  const len = Math.floor(2.6 * SR);
  for (let s = 0; s < len && start + s < buf.length; s++) {
    const t = s / SR;
    const env = Math.exp(-t * 2.1) * Math.min(1, t / 0.008);
    const v =
      Math.sin(2 * Math.PI * f * t) +
      0.45 * Math.sin(2 * Math.PI * f * 3.98 * t) * Math.exp(-t * 3) +
      0.1 * Math.sin(2 * Math.PI * f * 9.24 * t) * Math.exp(-t * 10);
    buf[start + s] += v * env * 0.42;
  }
}

// air bed
{
  const rand = mulberry32(77);
  let lp = 0;
  for (let i = 0; i < buf.length; i++) {
    const w = rand() * 2 - 1;
    lp += 0.02 * (w - lp);
    buf[i] += lp * 0.012;
  }
}

// fold tail over head -> seamless loop
const out = new Float64Array(N);
for (let i = 0; i < N; i++) out[i] = buf[i];
for (let i = 0; i < TAIL_N; i++) out[i] += buf[N + i];

// write 16-bit mono WAV, peak-normalized
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const g = peak > 0 ? 0.8 / peak : 1;
const data = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, out[i] * g));
  data.writeInt16LE(Math.round(v * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8); header.write("fmt ", 12);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22); header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28); header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34); header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const outDir = path.join(__dirname, "..", "assets", "audio");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "main-music.wav");
fs.writeFileSync(outFile, Buffer.concat([header, data]));
console.log(`wrote ${outFile} (10.0s seamless loop)`);
