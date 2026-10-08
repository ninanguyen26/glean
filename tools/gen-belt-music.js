/* Glean belt music loop — APPROVED variant ("driving").
 * 120 BPM, 5 bars of 4/4 = exactly 10.0s.
 * C -> G -> Am -> F -> G with kick (1&3), busy shaker, chord stabs
 * on 2&4, plucky 8th-note bass, singing pluck lead.
 * Tail folded for a seamless loop. Deterministic — re-running
 * produces the identical file.
 * Usage: node tools/gen-belt-music.js  ->  assets/audio/belt-music.wav
 */
const fs = require("fs");
const path = require("path");

const SR = 44100;
const N = SR * 10;
const BAR = 2.0;
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
  return 440 * Math.pow(2, ((SEMI[m[1]] + (parseInt(m[2], 10) + 1) * 12) - 69) / 12);
}

const ROOTS = ["C2", "G2", "A2", "F2", "G2"].map(nf);
const FIFTHS = ["G2", "D3", "E3", "C3", "D3"].map(nf);
const STABS = [
  ["C4", "E4", "G4"], ["D4", "G4", "B4"], ["C4", "E4", "A4"],
  ["C4", "F4", "A4"], ["D4", "G4", "B4"],
].map((ch) => ch.map(nf));

const buf = new Float64Array(EXT);

function addKick(t, gain) {
  const start = Math.floor(t * SR), len = Math.floor(0.25 * SR);
  for (let s = 0; s < len && start + s < buf.length; s++) {
    const tt = s / SR;
    const phase = 2 * Math.PI * (55 * tt + 65 * (1 - Math.exp(-tt * 40)) / 40);
    const env = Math.exp(-tt * 16) * Math.min(1, tt / 0.004);
    buf[start + s] += Math.sin(phase) * env * gain;
  }
}

function addShaker(t, gain) {
  const rand = mulberry32(Math.floor(t * 1000) + 7);
  const start = Math.floor(t * SR), len = Math.floor(0.07 * SR);
  let lp = 0;
  for (let s = 0; s < len && start + s < buf.length; s++) {
    const tt = s / SR;
    lp += 0.35 * (rand() * 2 - 1 - lp);
    buf[start + s] += lp * Math.exp(-tt * 70) * gain;
  }
}

function addBass(t, f) {
  const start = Math.floor(t * SR), len = Math.floor(0.5 * SR);
  for (let s = 0; s < len && start + s < buf.length; s++) {
    const tt = s / SR;
    const env = Math.exp(-tt * 5.5) * Math.min(1, tt / 0.006);
    buf[start + s] += (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(2 * Math.PI * 2 * f * tt)) * env * 0.38;
  }
}

function addStab(t, freqs) {
  const start = Math.floor(t * SR), len = Math.floor(0.4 * SR);
  for (let s = 0; s < len && start + s < buf.length; s++) {
    const tt = s / SR;
    const env = Math.exp(-tt * 9) * Math.min(1, tt / 0.008);
    let v = 0;
    for (const f of freqs) v += Math.sin(2 * Math.PI * f * tt) + 0.25 * Math.sin(2 * Math.PI * 2 * f * tt);
    buf[start + s] += (v / freqs.length) * env * 0.16;
  }
}

function addPluck(t, f) {
  const start = Math.floor(t * SR), len = Math.floor(1.4 * SR);
  for (let s = 0; s < len && start + s < buf.length; s++) {
    const tt = s / SR;
    const env = Math.exp(-tt * 3.8) * Math.min(1, tt / 0.006);
    const v = Math.sin(2 * Math.PI * f * tt) +
      0.32 * Math.sin(2 * Math.PI * f * 3.98 * tt) * Math.exp(-tt * 6);
    buf[start + s] += v * env * 0.36;
  }
}

for (let b = 0; b < 5; b++) {
  const t0 = b * BAR;
  addKick(t0, 0.55); addKick(t0 + 1.0, 0.55);
  [0.25, 0.75, 1.25, 1.75].forEach((dt) => addShaker(t0 + dt, 0.07));
  addStab(t0 + 0.5, STABS[b]); addStab(t0 + 1.5, STABS[b]);
  [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75].forEach((dt, i) => {
    addBass(t0 + dt, (i === 2 || i === 6) ? FIFTHS[b] : ROOTS[b]);
  });
}
[[0.25, "G4"], [0.75, "A4"], [1.25, "C5"], [1.75, "D5"], [2.25, "E5"],
 [2.75, "D5"], [3.25, "B4"], [3.75, "A4"], [4.5, "E4"], [5.0, "G4"],
 [5.5, "A4"], [6.25, "C5"], [6.75, "A4"], [7.5, "G4"], [8.25, "A4"],
 [8.75, "B4"], [9.5, "D5"]
].forEach(([t, n]) => addPluck(t, nf(n)));

// fold tail over head -> seamless loop
const out = new Float64Array(N);
for (let i = 0; i < N; i++) out[i] = buf[i];
for (let i = 0; i < TAIL_N; i++) out[i] += buf[N + i];

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
const outFile = path.join(outDir, "belt-music.wav");
fs.writeFileSync(outFile, Buffer.concat([header, data]));
console.log(`wrote ${outFile} (10.0s seamless loop)`);
