/* The music for the promo videos, made from the video's own timeline.

   The recorder puts every click and switch on a beat and writes down when
   it happened; this turns that list into a track where the same moments
   land on an accent. Nothing is sampled: every sound is a few oscillators,
   noise and filters, so there is no licence to worry about.

   node tools/video/score.cjs <timeline.json> <out.wav>
   timeline: { bpm, seconds, sections: [{ at, kind }], hits: [{ at, kind }] }
     sections  "intro" | "groove" | "drop" | "calm" | "outro", from a time
     hits      "tick" (a click), "switch" (a change), "rise" (the moment
               before something opens), "impact" (something big arrives) */
const fs = require('node:fs');

const RATE = 48000;
const [, , inFile, outFile = 'score.wav'] = process.argv;
const plan = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const BPM = plan.bpm || 112;
const BEAT = 60 / BPM;
const SECONDS = plan.seconds;
const N = Math.ceil(SECONDS * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);
const duck = new Float32Array(N).fill(1); // the pump the kick gives the pads

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const sectionAt = (t) => { let kind = 'intro'; for (const s of plan.sections) if (s.at <= t + 1e-6) kind = s.kind; return kind; };
const add = (s, l, r) => { if (s >= 0 && s < N) { L[s] += l; R[s] += r; } };

// Bm – G – D – A, two bars each: hopeful, a little wistful, moving.
const PROG = [[47, 50, 54, 57], [43, 47, 50, 54], [50, 54, 57, 61], [45, 49, 52, 57]];
const chordAt = (t) => PROG[Math.floor(t / (BEAT * 8)) % PROG.length];

// ── Instruments ────────────────────────────────────────────────
function kick(t0, gain = 1) {
  const s0 = Math.floor(t0 * RATE);
  for (let i = 0; i < 0.45 * RATE; i++) {
    const t = i / RATE;
    const f = 48 + 110 * Math.exp(-t * 38);
    const v = Math.sin(2 * Math.PI * f * t + 0.2) * Math.exp(-t * 9) * 0.75 * gain + (i < 90 ? (rand() - 0.5) * 0.25 * (1 - i / 90) : 0);
    add(s0 + i, v, v);
  }
  // The pads step back and breathe in again.
  for (let i = 0; i < 0.42 * RATE; i++) { const s = s0 + i; if (s < N) duck[s] = Math.min(duck[s], 0.35 + 0.65 * Math.min(1, i / (0.42 * RATE)) ** 1.6); }
}
function noiseHit(t0, { len = 0.12, gain = 0.25, tone = 0.5, pan = 0 } = {}) {
  const s0 = Math.floor(t0 * RATE);
  let lp = 0, prev = 0;
  for (let i = 0; i < len * RATE; i++) {
    const t = i / RATE;
    const w = rand() * 2 - 1;
    lp += (w - lp) * tone;
    const hp = lp - prev; prev = lp;
    const v = hp * Math.exp(-t * (4 / len)) * gain;
    add(s0 + i, v * (1 - pan), v * (1 + pan));
  }
}
// A soft snap rather than a clap, and a shaker rather than a hi-hat: the
// groove is felt, not heard over the picture.
const clap = (t0, gain = 0.5) => { noiseHit(t0, { len: 0.09, gain: gain * 0.42, tone: 0.3 }); noiseHit(t0 + 0.008, { len: 0.14, gain: gain * 0.2, tone: 0.18 }); };
const hat = (t0, gain = 0.12, open = false) => noiseHit(t0, { len: open ? 0.12 : 0.05, gain: gain * 0.34, tone: 0.45, pan: (rand() - 0.5) * 0.5 });

function pluck(t0, midi, { len = 0.5, gain = 0.12, pan = 0, bright = 1 } = {}) {
  const s0 = Math.floor(t0 * RATE);
  const f = hz(midi);
  for (let i = 0; i < len * RATE; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.003) * Math.exp(-t * (6 / len));
    const ph = 2 * Math.PI * f * t;
    const v = (Math.sin(ph) + 0.45 * bright * Math.sin(2 * ph) * Math.exp(-t * 9) + 0.2 * bright * Math.sin(3 * ph) * Math.exp(-t * 14)) * env * gain;
    add(s0 + i, v * (1 - pan), v * (1 + pan));
  }
}
// A Rhodes-like electric piano: two-operator FM, the bell of the attack
// fading into a round tone.
function keys(t0, midi, { len = 1.2, gain = 0.1, pan = 0 } = {}) {
  const s0 = Math.floor(t0 * RATE);
  const f = hz(midi);
  for (let i = 0; i < len * RATE; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * (2.6 / len)) * Math.min(1, (len - t) / 0.08);
    const index = 1.6 * Math.exp(-t * 7) + 0.25;
    const v = Math.sin(2 * Math.PI * f * t + index * Math.sin(2 * Math.PI * f * t)) * env * gain;
    add(s0 + i, v * (1 - pan), v * (1 + pan));
  }
}
// A marimba bar: short, woody, nothing that rings over the next frame.
function marimba(t0, midi, gain = 0.05, pan = 0) {
  const s0 = Math.floor(t0 * RATE);
  const f = hz(midi);
  for (let i = 0; i < 0.35 * RATE; i++) {
    const t = i / RATE;
    const v = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 11) + 0.25 * Math.sin(2 * Math.PI * f * 3.93 * t) * Math.exp(-t * 40)) * Math.min(1, t / 0.0015) * gain;
    add(s0 + i, v * (1 - pan), v * (1 + pan));
  }
}
function bass(t0, midi, len, gain = 0.32) {
  const s0 = Math.floor(t0 * RATE);
  const f = hz(midi);
  let lp = 0;
  for (let i = 0; i < len * RATE; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.005) * Math.min(1, (len - t) / 0.03) * (0.75 + 0.25 * Math.exp(-t * 6));
    const saw = 2 * ((f * t) % 1) - 1;
    const cut = 0.04 + 0.12 * Math.exp(-t * 10);
    lp += (saw - lp) * cut;
    const v = (lp * 0.8 + Math.sin(2 * Math.PI * f * t) * 0.6) * env * gain;
    add(s0 + i, v, v);
  }
}
function bell(t0, midi, gain = 0.1, pan = 0) {
  const s0 = Math.floor(t0 * RATE);
  const f = hz(midi);
  for (let i = 0; i < 2.2 * RATE; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.002) * Math.exp(-t * 2.2);
    const v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 5) + 0.15 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 9)) * env * gain;
    add(s0 + i, v * (1 - pan), v * (1 + pan));
  }
}
function swell(tEnd, len = 1.6, gain = 0.22) {
  // Noise opening up into the moment: a reverse cymbal, more or less.
  const s1 = Math.floor(tEnd * RATE), s0 = Math.max(0, s1 - Math.floor(len * RATE));
  let lp = 0;
  for (let s = s0; s < s1; s++) {
    const k = (s - s0) / (s1 - s0);
    lp += ((rand() * 2 - 1) - lp) * (0.05 + 0.6 * k * k);
    const v = lp * k ** 2.2 * gain;
    add(s, v * (1 - 0.3 * k), v * (1 + 0.3 * k));
  }
}
function impact(t0, gain = 0.8) {
  kick(t0, 1.2 * gain);
  noiseHit(t0, { len: 1.4, gain: 0.18 * gain, tone: 0.6 });
  const s0 = Math.floor(t0 * RATE);
  for (let i = 0; i < 1.6 * RATE; i++) { const t = i / RATE; const v = Math.sin(2 * Math.PI * (38 + 20 * Math.exp(-t * 3)) * t) * Math.exp(-t * 2.2) * 0.45 * gain; add(s0 + i, v, v); }
}

// Pads: detuned saws through a slow low-pass, pumped by the kick.
function pads() {
  const voices = [];
  for (let bar = 0; bar * BEAT * 4 < SECONDS + 2; bar += 2) {
    const t0 = bar * BEAT * 4;
    for (const note of chordAt(t0 + 0.01)) voices.push({ t0: t0 - 0.05, len: BEAT * 8 + 0.4, f: hz(note + 12), ph: [rand(), rand(), rand()] });
  }
  const padL = new Float32Array(N), padR = new Float32Array(N);
  for (const v of voices) {
    const s0 = Math.max(0, Math.floor(v.t0 * RATE)), s1 = Math.min(N, Math.floor((v.t0 + v.len) * RATE));
    let lpL = 0, lpR = 0;
    for (let s = s0; s < s1; s++) {
      const t = s / RATE - v.t0;
      const env = Math.min(1, t / 0.6) * Math.min(1, (v.len - t) / 0.5);
      const kind = sectionAt(s / RATE);
      const open = { intro: 0.02, groove: 0.05, drop: 0.12, calm: 0.018, outro: 0.03 }[kind];
      const saw = (d, p) => 2 * ((v.f * d * (s / RATE) + p) % 1) - 1;
      const a = saw(1.003, v.ph[0]) + saw(0.997, v.ph[1]);
      const b = saw(1.0, v.ph[2]) + saw(1.006, v.ph[0]);
      lpL += (a - lpL) * open; lpR += (b - lpR) * open;
      const level = { intro: 0.06, groove: 0.05, drop: 0.058, calm: 0.1, outro: 0.06 }[kind];
      padL[s] += lpL * env * level; padR[s] += lpR * env * level;
    }
  }
  for (let s = 0; s < N; s++) { L[s] += padL[s] * duck[s]; R[s] += padR[s] * duck[s]; }
}

// ── The arrangement ────────────────────────────────────────────
const beats = Math.ceil(SECONDS / BEAT);
for (let b = 0; b < beats; b++) {
  const t = b * BEAT;
  const kind = sectionAt(t);
  const inBar = b % 4;
  const chord = chordAt(t);
  const drums = kind === 'groove' || kind === 'drop';
  if (drums) {
    kick(t, inBar === 0 ? 1 : 0.85);
    if (kind === 'drop' && inBar === 2) kick(t + BEAT * 0.5, 0.6);
    if (inBar === 1 || inBar === 3) clap(t, kind === 'drop' ? 0.5 : 0.36);
    hat(t + BEAT / 2, kind === 'drop' ? 0.13 : 0.1, inBar === 3);
    if (kind === 'drop') { hat(t + BEAT / 4, 0.05); hat(t + (3 * BEAT) / 4, 0.05); }
  }
  if (kind === 'intro' && inBar === 0) kick(t, 0.5);
  if (kind === 'outro' && inBar === 0 && b % 8 === 0) kick(t, 0.6);
  // Bass: eighths on the root, a step up at the end of the bar.
  if (drums) for (let e = 0; e < 2; e++) bass(t + e * BEAT / 2, chord[0] - 12 + (inBar === 3 && e === 1 ? 7 : 0), BEAT / 2 - 0.02, kind === 'drop' ? 0.27 : 0.22);
  if (kind === 'calm' && inBar === 0) bass(t, chord[0] - 12, BEAT * 4 - 0.05, 0.22);
  // Arp: sixteenths through the chord, brighter in the drop.
  if (kind !== 'calm' && kind !== 'outro') {
    const pattern = [0, 1, 2, 3, 2, 1, 3, 2];
    for (let q = 0; q < 4; q++) {
      if (kind === 'intro' && q % 2) continue;
      const note = chord[pattern[(b * 4 + q) % pattern.length]] + 24;
      pluck(t + q * BEAT / 4, note - 12, { len: 0.34, gain: kind === 'drop' ? 0.06 : 0.045, pan: q % 2 ? 0.35 : -0.35, bright: kind === 'drop' ? 0.8 : 0.5 });
    }
  }
  // Chords on the keys, on the one and the and of two: the warmth under it all.
  if (drums && (inBar === 0 || inBar === 2)) for (const [k, n] of chord.slice(1).entries()) keys(t + (inBar === 2 ? BEAT / 2 : 0) + k * 0.006, n + 12, { len: BEAT * 1.6, gain: 0.03, pan: (k - 1) * 0.3 });
  if (kind === 'calm') {
    // Slow, glassy notes over the pad: the room goes quiet, not empty.
    if (b % 2 === 0) pluck(t, chord[(b / 2) % 4] + 24, { len: 2.2, gain: 0.09, pan: (rand() - 0.5) * 0.8, bright: 0.5 });
    if (b % 4 === 3) bell(t + BEAT / 2, chord[2] + 36, 0.045, (rand() - 0.5) * 0.6);
  }
}
pads();

// The moments of the video. Two within a frame or so are one moment, and
// sound twice as loud if played twice.
const moments = [];
for (const hit of [...(plan.hits || [])].sort((a, b) => a.at - b.at)) {
  const last = moments[moments.length - 1];
  if (last && hit.at - last.at < 0.06) { if (hit.kind === 'impact') last.kind = 'impact'; continue; }
  moments.push({ ...hit });
}
for (const hit of moments) {
  const chord = chordAt(hit.at);
  // A click is a soft wooden tap, a change a warm chord: both sit inside the
  // music instead of on top of it.
  if (hit.kind === 'tick') marimba(hit.at, chord[1 + Math.floor(rand() * 3)] + 24, 0.055, (rand() - 0.5) * 0.5);
  if (hit.kind === 'switch') { keys(hit.at, chord[0] + 24, { len: 0.9, gain: 0.06, pan: -0.2 }); keys(hit.at + 0.005, chord[2] + 24, { len: 0.9, gain: 0.055, pan: 0.2 }); marimba(hit.at, chord[1] + 36, 0.022, 0); noiseHit(hit.at, { len: 0.22, gain: 0.03, tone: 0.35 }); }
  if (hit.kind === 'rise') swell(hit.at, 1.7);
  if (hit.kind === 'impact') { impact(hit.at, 0.7); for (const n of chord) keys(hit.at, n + 12, { len: 2.4, gain: 0.04, pan: (rand() - 0.5) * 0.8 }); }
}

// ── A small room, then the master ──────────────────────────────
function reverb(input, spread) {
  const combs = [1687, 1601, 2053, 2251].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const passes = [556, 441, 341].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const out = new Float32Array(input.length);
  let lp = 0;
  for (let s = 0; s < input.length; s++) {
    let sum = 0;
    for (const c of combs) { const y = c.buf[c.i]; lp = y * 0.55 + lp * 0.45; c.buf[c.i] = input[s] + lp * 0.8; c.i = (c.i + 1) % c.buf.length; sum += y; }
    let y = sum / 4;
    for (const a of passes) { const b = a.buf[a.i]; const o = -y + b; a.buf[a.i] = y + b * 0.5; a.i = (a.i + 1) % a.buf.length; y = o; }
    out[s] = y;
  }
  return out;
}
// Take the fizz off the top: a one-pole low-pass around 12 kHz.
for (const ch of [L, R]) { let y = 0; const a = 1 - Math.exp(-2 * Math.PI * 12000 / RATE); for (let s = 0; s < N; s++) { y += (ch[s] - y) * a; ch[s] = y; } }
const wl = reverb(L, 0), wr = reverb(R, 19);
const mix = new Float32Array(N * 2);
let peak = 0;
const fadeOut = Math.min(3, SECONDS / 6) * RATE;
for (let s = 0; s < N; s++) {
  const f = Math.min(1, s / (0.05 * RATE), (N - s) / fadeOut);
  const l = (L[s] + wl[s] * 0.28) * f, r = (R[s] + wr[s] * 0.28) * f;
  mix[2 * s] = l; mix[2 * s + 1] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
// A soft limiter: loud enough to feel it, never harsh.
const drive = 1.4 / peak;
const data = Buffer.alloc(mix.length * 2);
for (let i = 0; i < mix.length; i++) data.writeInt16LE(Math.round(Math.tanh(mix[i] * drive) * 0.89 * 32767), i * 2);
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
head.write('data', 36); head.writeUInt32LE(data.length, 40);
fs.writeFileSync(outFile, Buffer.concat([head, data]));
console.log(`${outFile}: ${SECONDS.toFixed(1)} s at ${BPM} bpm, ${(plan.hits || []).length} accents`);
