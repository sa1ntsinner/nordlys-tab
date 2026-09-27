/* A calm ambient bed for the promo videos, made from scratch so there is no
   licence to worry about: slow pad chords, a few soft bell notes and a plain
   Schroeder reverb. Usage: node tools/video/ambient.cjs <seconds> <out.wav> */
const fs = require('node:fs');

const RATE = 44100;
const seconds = Number(process.argv[2] || 75);
const out = process.argv[3] || 'ambient.wav';
const N = Math.floor(seconds * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Dmaj9, Bm11, Gmaj7(#11), A6sus: open voicings, eight seconds each.
const CHORDS = [
  [38, 50, 57, 61, 64, 69],
  [35, 47, 54, 57, 62, 64],
  [31, 43, 50, 54, 57, 61],
  [33, 45, 52, 54, 59, 64]
];
const BAR = 8;

let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Pads: each note a few detuned sines with soft harmonics, a slow swell.
for (let bar = 0; bar * BAR < seconds + BAR; bar++) {
  const chord = CHORDS[bar % CHORDS.length];
  const start = bar * BAR - 1.5;
  const length = BAR + 3;
  for (const [index, note] of chord.entries()) {
    const f = hz(note);
    const pan = index / (chord.length - 1) - 0.5;
    const gain = (note < 45 ? 0.07 : 0.035) / Math.sqrt(chord.length);
    const s0 = Math.max(0, Math.floor(start * RATE));
    const s1 = Math.min(N, Math.floor((start + length) * RATE));
    const phases = [random(), random(), random()].map((p) => p * Math.PI * 2);
    for (let s = s0; s < s1; s++) {
      const t = s / RATE - start;
      const env = Math.sin(Math.PI * Math.min(1, t / length)) ** 1.6;
      const wob = 1 + 0.0015 * Math.sin(2 * Math.PI * 0.21 * t + index);
      const w = 2 * Math.PI * f * wob * (s / RATE);
      let v = Math.sin(w + phases[0]) + 0.7 * Math.sin(w * 1.004 + phases[1]) + 0.7 * Math.sin(w * 0.996 + phases[2]);
      v += 0.18 * Math.sin(2 * w) + 0.06 * Math.sin(3 * w);
      v *= gain * env;
      L[s] += v * (0.5 - pan * 0.6);
      R[s] += v * (0.5 + pan * 0.6);
    }
  }
}

// Bells: sparse notes from the chord, high and quiet, a long decay.
for (let bar = 0; bar * BAR < seconds; bar++) {
  const chord = CHORDS[bar % CHORDS.length];
  const count = bar === 0 ? 2 : 4;
  for (let k = 0; k < count; k++) {
    const when = bar * BAR + 0.6 + k * (BAR / count) + random() * 0.4;
    const note = chord[2 + Math.floor(random() * (chord.length - 2))] + 24;
    const f = hz(note);
    const pan = random() - 0.5;
    const s0 = Math.floor(when * RATE);
    const s1 = Math.min(N, s0 + 5 * RATE);
    for (let s = s0; s < s1; s++) {
      const t = (s - s0) / RATE;
      const env = Math.min(1, t / 0.006) * Math.exp(-t * 1.3);
      const v = 0.028 * env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 3));
      L[s] += v * (0.5 - pan * 0.7);
      R[s] += v * (0.5 + pan * 0.7);
    }
  }
}

// Schroeder reverb, wet only, mixed back in.
function reverb(input, spread) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + spread), i: 0, g: 0.84 }));
  const passes = [556, 441].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const wet = new Float32Array(input.length);
  let lp = 0;
  for (let s = 0; s < input.length; s++) {
    let sum = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      lp = y * 0.6 + lp * 0.4;
      c.buf[c.i] = input[s] + lp * c.g;
      c.i = (c.i + 1) % c.buf.length;
      sum += y;
    }
    let y = sum / 4;
    for (const a of passes) {
      const b = a.buf[a.i];
      const o = -y + b;
      a.buf[a.i] = y + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      y = o;
    }
    wet[s] = y;
  }
  return wet;
}
const wl = reverb(L, 0);
const wr = reverb(R, 23);

// Fades, a gentle limiter, 16-bit PCM.
const fadeIn = 2.5 * RATE;
const fadeOut = 4 * RATE;
let peak = 0;
const mix = new Float32Array(N * 2);
for (let s = 0; s < N; s++) {
  const f = Math.min(1, s / fadeIn, (N - s) / fadeOut);
  mix[2 * s] = (L[s] * 0.75 + wl[s] * 0.9) * f;
  mix[2 * s + 1] = (R[s] * 0.75 + wr[s] * 0.9) * f;
  peak = Math.max(peak, Math.abs(mix[2 * s]), Math.abs(mix[2 * s + 1]));
}
const scale = 0.7 / peak;
const data = Buffer.alloc(mix.length * 2);
for (let i = 0; i < mix.length; i++) data.writeInt16LE(Math.round(Math.tanh(mix[i] * scale) * 32767), i * 2);
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
head.write('data', 36); head.writeUInt32LE(data.length, 40);
fs.writeFileSync(out, Buffer.concat([head, data]));
console.log(`${out}: ${seconds}s`);
