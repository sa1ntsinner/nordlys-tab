/* How far each accent in the music is from what happens on screen.

   node tools/video/sync-check.cjs <video.mp4> <timeline.json> [--fix out.json]

   Decodes the video small and grey, measures how much each frame differs
   from the one before, and for every hit finds where the picture starts to
   change near it. Prints the offset per hit (positive: the picture moves
   after the sound). With --fix, writes a timeline whose switch and impact
   hits sit on the frame where the change starts, and clicks on the frame
   the page answers them. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const [, , video, timelineFile, flag, fixOut] = process.argv;
const W = 96, H = 54, FPS = 60;
const raw = execFileSync(FFMPEG, ['-v', 'error', '-i', video, '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
const size = W * H, frames = Math.floor(raw.length / size);
const diff = new Float32Array(frames);
for (let f = 1; f < frames; f++) {
  let sum = 0;
  for (let i = 0; i < size; i++) sum += Math.abs(raw[f * size + i] - raw[(f - 1) * size + i]);
  diff[f] = sum / size;
}
// The sky moves all the time; a change is motion well above its local floor.
const floor = (f) => { const a = []; for (let k = Math.max(1, f - 90); k < Math.min(frames, f + 90); k++) a.push(diff[k]); a.sort((x, y) => x - y); return a[Math.floor(a.length * 0.5)] || 0; };

const plan = JSON.parse(fs.readFileSync(timelineFile, 'utf8'));
const rows = [];
for (const hit of plan.hits) {
  const centre = Math.round(hit.at * FPS);
  const base = floor(centre);
  let onset = null, peak = 0;
  for (let f = Math.max(1, centre - 18); f < Math.min(frames, centre + 36); f++) {
    if (diff[f] > peak) peak = diff[f];
    if (onset === null && diff[f] > base * 2.2 + 0.6) onset = f;
  }
  rows.push({ ...hit, onset: onset === null ? null : onset / FPS, offset: onset === null ? null : onset / FPS - hit.at, strength: +(peak / (base + 0.01)).toFixed(1) });
}
for (const r of rows) console.log(`${r.at.toFixed(3).padStart(7)}s ${r.kind.padEnd(7)} ${r.offset === null ? '   no change seen' : `${(r.offset * 1000).toFixed(0).padStart(5)} ms  x${r.strength}`}`);
const seen = rows.filter((r) => r.offset !== null && (r.kind === 'switch' || r.kind === 'impact'));
if (seen.length) {
  const abs = seen.map((r) => Math.abs(r.offset)).sort((a, b) => a - b);
  console.log(`switch/impact: median |offset| ${(abs[Math.floor(abs.length / 2)] * 1000).toFixed(0)} ms, worst ${(abs[abs.length - 1] * 1000).toFixed(0)} ms`);
}
if (flag === '--fix' && fixOut) {
  // A click lands on the frame the page answers it, if that is close to the
  // press; a change lands where it starts.
  const hits = rows.map(({ at, kind, onset, offset }) => ({ kind, at: onset !== null && (kind === 'switch' || kind === 'impact' || (kind === 'tick' && offset > -0.02 && offset < 0.1)) ? onset : at }));
  fs.writeFileSync(fixOut, JSON.stringify({ ...plan, hits }, null, 1));
  console.log(`wrote ${fixOut}`);
}
