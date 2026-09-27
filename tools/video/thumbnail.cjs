/* The YouTube thumbnail, 1280 x 720, from a frame of the finished video.

   node tools/video/thumbnail.cjs <video.mp4> <out.png> [--at 12.5] */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const [, , video, out = path.join(ROOT, 'docs/video/youtube/thumbnail.png')] = process.argv;
const at = process.argv.includes('--at') ? process.argv[process.argv.indexOf('--at') + 1] : '12.5';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nordlys-thumb-'));
const frame = path.join(work, 'frame.png');
execFileSync(FFMPEG, ['-v', 'error', '-y', '-ss', at, '-i', video, '-frames:v', '1', '-vf', 'scale=2560:-1', frame]);
const url = (p) => `file:///${p.replace(/\\/g, '/')}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Outfit; src: url("${url(path.join(ROOT, 'src/fonts/outfit.woff2'))}"); font-weight: 100 900; }
  @font-face { font-family: Instrument; src: url("${url(path.join(ROOT, 'src/fonts/instrument-sans.woff2'))}"); font-weight: 100 900; }
  body { margin: 0; width: 1280px; height: 720px; overflow: hidden; background: #05070d; }
  .glow { position: absolute; inset: 0; background: radial-gradient(60% 75% at 72% 50%, rgba(70, 120, 255, .30), transparent 70%); }
  .shot { position: absolute; right: -70px; top: 78px; width: 880px; border-radius: 22px;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, .14), 0 40px 90px rgba(0, 0, 0, .7); transform: perspective(1500px) rotateY(-13deg); }
  h1 { position: absolute; left: 72px; top: 178px; margin: 0; font: 600 124px/1 Outfit; letter-spacing: -.045em; color: #fff; }
  p { position: absolute; left: 76px; top: 330px; margin: 0; width: 470px; font: 500 42px/1.15 Outfit; letter-spacing: -.02em; color: #c9d4ea; }
  .tags { position: absolute; left: 76px; top: 486px; display: flex; gap: 12px; }
  .tags span { padding: 11px 20px; border-radius: 999px; font: 500 23px/1 Instrument; color: #eef3fb; box-shadow: inset 0 0 0 1.5px rgba(210, 222, 245, .3); }
</style></head><body><div class="glow"></div><img class="shot" src="${url(frame)}">
<h1>Nordlys</h1><p>A new tab with a dashboard for your day</p><div class="tags"><span>Free</span><span>No account</span></div></body></html>`;
const page = path.join(work, 'thumb.html');
fs.writeFileSync(page, html);
(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await tab.goto(url(page));
  await tab.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await tab.screenshot({ path: out });
  await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`wrote ${path.relative(ROOT, out)}`);
})();
