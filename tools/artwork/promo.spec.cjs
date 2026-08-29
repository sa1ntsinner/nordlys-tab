const { test } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');

/* Builds the two Chrome Web Store promo tiles. The backdrop is the
   product's own canvas captured at the tile's aspect ratio, not a drawing of
   it, so the artwork cannot drift from what the extension actually renders. */

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/store-assets');
const TILES = [
  { name: 'promo-marquee-1400x560.png', width: 1400, height: 560, scale: 1 },
  { name: 'promo-small-440x280.png', width: 440, height: 280, scale: 0.44 }
];
test.setTimeout(300000);

function promoPage({ backdrop, scale, tagline }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Outfit"; src: url("/src/fonts/outfit.woff2") format("woff2"); font-weight: 100 900; }
  @font-face { font-family: "Instrument Sans"; src: url("/src/fonts/instrument-sans.woff2") format("woff2"); font-weight: 400 700; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body {
    background: #070b14 url("${backdrop}") center/cover no-repeat;
    display: grid; place-items: center; text-align: center;
    font-family: "Instrument Sans", system-ui, sans-serif;
  }
  .plate {
    display: grid; justify-items: center; gap: ${28 * scale}px;
    padding: ${44 * scale}px ${64 * scale}px;
  }
  .lockup { display: flex; align-items: center; gap: ${22 * scale}px; }
  .mark { width: ${96 * scale}px; height: ${96 * scale}px; border-radius: ${26 * scale}px;
          box-shadow: 0 ${18 * scale}px ${44 * scale}px rgba(0,0,0,.45); }
  .word { font-family: "Outfit", system-ui, sans-serif; font-weight: 500;
          font-size: ${104 * scale}px; letter-spacing: ${-2.5 * scale}px; line-height: 1;
          color: #eef3fb; text-shadow: 0 ${4 * scale}px ${28 * scale}px rgba(0,0,0,.55); }
  .tag { font-size: ${27 * scale}px; font-weight: 400; letter-spacing: ${0.2 * scale}px;
         color: rgba(228,238,252,.82); text-shadow: 0 ${2 * scale}px ${16 * scale}px rgba(0,0,0,.6); }
  </style></head><body>
    <div class="plate">
      <div class="lockup">
        <img class="mark" src="/icons/icon128.png" alt="">
        <span class="word">Nordlys</span>
      </div>
      ${tagline ? `<p class="tag">${tagline}</p>` : ''}
    </div>
  </body></html>`;
}

test('build the promo tiles', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  fs.mkdirSync(path.join(ROOT, 'tools/artwork/.scratch'), { recursive: true });

  for (const tile of TILES) {
    // Capture the canvas alone at the tile's shape.
    await page.setViewportSize({ width: tile.width, height: tile.height });
    await page.evaluate(() => {
      window.Aurora.bgEngine?.setAtmosphere({ motion: 1, intensity: 1.45 });
      for (const id of ['board', 'center-stack', 'search', 'gear', 'hiddenDock']) {
        const node = document.getElementById(id);
        if (node) node.style.visibility = 'hidden';
      }
      document.querySelectorAll('#clock, #date, #greet, #q').forEach(node => { node.style.visibility = 'hidden'; });
    });
    await page.waitForTimeout(14000);
    const backdrop = `tools/artwork/.scratch/backdrop-${tile.width}.png`;
    await page.screenshot({ path: path.join(ROOT, backdrop) });

    const html = promoPage({
      backdrop: `/${backdrop}`,
      scale: tile.scale,
      tagline: tile.width > 800 ? "A new tab you'll actually want to look at" : ''
    });
    fs.writeFileSync(path.join(ROOT, 'tools/artwork/.scratch/promo.html'), html);
    await page.goto(`${origin}/tools/artwork/.scratch/promo.html`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, tile.name) });
    console.log(`  ${tile.name} ${Math.round(fs.statSync(path.join(OUT, tile.name)).size / 1024)}KB`);
    await page.goto(`${origin}/newtab.html`);
    await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  }
});
