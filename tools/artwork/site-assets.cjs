/* Turns the frames the store generator captured (tools/artwork/.scratch) into
   the web-sized pictures the site and the README use (site/assets), and lays
   the nine skies out as one picture for the README. Chromium does the
   resizing and the WebP encoding, so nothing beyond Playwright is needed.
   Run `npm run artwork` first, then `node tools/artwork/site-assets.cjs`. */

const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const compose = require('./compose.cjs');
const { SKIES } = require('./store-board.cjs');
const { startStaticServer } = require('../../tests/helpers/static-server.cjs');

const ROOT = path.resolve(__dirname, '../..');
const FROM = path.join(ROOT, 'tools/artwork/.scratch');
const TO = path.join(ROOT, 'site/assets');
const QUALITY = 0.84;

// [captured frame, published name, width in pixels]
const PICTURES = [
  ['sky.png', 'board.webp', 2400],
  ['arrange.png', 'arrange.webp', 1800],
  ['light.png', 'theme-light.webp', 1600],
  ['dark.png', 'theme-dark.webp', 1600],
  ['extra-calc.png', 'extra-calc.webp', 1100],
  ['extra-commands.png', 'extra-commands.webp', 1100],
  ['extra-icons.png', 'extra-icons.webp', 1100],
  ...SKIES.map(sky => [`sky-${sky.scene}.png`, `skies/${sky.scene}.webp`, 960]),
  ['skies-grid.png', 'skies.webp', 1600]
];

/* Halves while the picture is still twice the width wanted, then takes the
   last step at once, so a large reduction is filtered and not just sampled. */
function encode(page, png, width) {
  return page.evaluate(async ({ source, width, quality }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    let canvas = image, w = image.naturalWidth, h = image.naturalHeight;
    const step = (nextW, nextH) => {
      const next = Object.assign(document.createElement('canvas'), { width: nextW, height: nextH });
      const context = next.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(canvas, 0, 0, nextW, nextH);
      canvas = next; w = nextW; h = nextH;
    };
    while (w / 2 >= width) step(Math.round(w / 2), Math.round(h / 2));
    if (w !== width) step(width, Math.round(h * width / w));
    return canvas.toDataURL('image/webp', quality).split(',')[1];
  }, { source: png.toString('base64'), width, quality: QUALITY });
}

(async () => {
  for (const [source] of PICTURES) {
    if (source !== 'skies-grid.png' && !fs.existsSync(path.join(FROM, source))) throw new Error(`${source} is missing: run npm run artwork first`);
  }
  const server = await startStaticServer(ROOT);
  const browser = await chromium.launch();
  try {
    // The nine skies as one picture, laid out like the store's but untitled.
    const sheet = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    fs.writeFileSync(path.join(FROM, 'skies-grid.html'), compose.grid({
      frames: SKIES.map(sky => ({ label: sky.name, image: `/tools/artwork/.scratch/sky-${sky.scene}.png` }))
    }));
    await sheet.goto(`${server.origin}/tools/artwork/.scratch/skies-grid.html`);
    await sheet.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode().catch(() => {}))]));
    await sheet.screenshot({ path: path.join(FROM, 'skies-grid.png') });
    await sheet.close();

    const page = await browser.newPage();
    for (const [source, name, width] of PICTURES) {
      const output = path.join(TO, name);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, Buffer.from(await encode(page, fs.readFileSync(path.join(FROM, source)), width), 'base64'));
      console.log(`  ${name} ${Math.round(fs.statSync(output).size / 1024)}KB`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
