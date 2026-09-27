/* New music for a finished video, without filming it again.

   node tools/video/rescore.cjs <video.mp4> [out.mp4]

   Reads <video>.timeline.json, moves each accent onto the frame where the
   picture changes (sync-check.cjs), writes the score (score.cjs) and puts
   it under the same picture. The video stream is copied, not re-encoded. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const [, , video, out = video.replace(/\.mp4$/, '.rescored.mp4')] = process.argv;
const timeline = video.replace(/\.mp4$/, '.timeline.json');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nordlys-rescore-'));
const fixed = path.join(work, 'timeline.json'), music = path.join(work, 'score.wav');
const node = (script, ...args) => execFileSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit', env: process.env });
node('sync-check.cjs', video, timeline, '--fix', fixed);
node('score.cjs', fixed, music);
const seconds = JSON.parse(fs.readFileSync(fixed, 'utf8')).seconds;
execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', video, '-i', music, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', seconds.toFixed(2), '-movflags', '+faststart', out], { stdio: 'inherit' });
node('sync-check.cjs', out, fixed);
fs.rmSync(work, { recursive: true, force: true });
console.log(`wrote ${out}`);
