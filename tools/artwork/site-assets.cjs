/* Turns the frames the store generator captured (tools/artwork/.scratch) into
   the web-sized pictures the site uses (site/assets). Run `npm run artwork`
   first, then `node tools/artwork/site-assets.cjs`. Needs ffmpeg with libwebp. */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const FROM = path.join(ROOT, 'tools/artwork/.scratch');
const TO = path.join(ROOT, 'site/assets');

// [captured frame, published name, width in pixels]
const PICTURES = [
  ['sky.png', 'board.webp', 2400],
  ['arrange.png', 'arrange.webp', 1800],
  ['icons.png', 'icon-history.webp', 1200],
  ['icons-board.png', 'icons-board.webp', 1800],
  ['light.png', 'theme-light.webp', 1600],
  ['dark.png', 'theme-dark.webp', 1600],
  ['daylight-dawn.png', 'daylight-dawn.webp', 1000],
  ['daylight-day.png', 'daylight-day.webp', 1000],
  ['daylight-sunset.png', 'daylight-sunset.webp', 1000],
  ['daylight-night.png', 'daylight-night.webp', 1000]
];

fs.mkdirSync(TO, { recursive: true });
for (const [source, name, width] of PICTURES) {
  const input = path.join(FROM, source);
  if (!fs.existsSync(input)) throw new Error(`${source} is missing: run npm run artwork first`);
  const output = path.join(TO, name);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-vf', `scale=${width}:-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', '84', '-compression_level', '6', output]);
  console.log(`  ${name} ${Math.round(fs.statSync(output).size / 1024)}KB`);
}
