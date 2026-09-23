const { test } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const compose = require('./compose.cjs');

/* Builds the two Chrome Web Store promo tiles and the cover for the Buy Me a
   Coffee page. The sky in each is the product's own canvas captured at that
   picture's shape, not a drawing of it, so the artwork cannot drift from what
   the extension actually renders. */

const ROOT = path.resolve(__dirname, '../..');
const SCRATCH = path.join(ROOT, 'tools/artwork/.scratch');
const PIECES = [
  { name: 'docs/store-assets/promo-marquee-1400x560.png', width: 1400, height: 560, layout: 'marquee' },
  { name: 'docs/store-assets/promo-small-440x280.png', width: 440, height: 280, layout: 'small' },
  { name: 'docs/brand/buymeacoffee-cover.png', width: 2400, height: 600, layout: 'cover' }
];

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
test.setTimeout(420000);

const hide = (page, hidden) => page.evaluate(hidden => {
  for (const id of ['board', 'center-stack', 'search', 'gear', 'hiddenDock', 'clock', 'date', 'greet']) {
    const node = document.getElementById(id);
    if (node) node.style.visibility = hidden ? 'hidden' : '';
  }
}, hidden);

async function render(context, origin, piece, html) {
  fs.writeFileSync(path.join(SCRATCH, 'promo.html'), html);
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: piece.width, height: piece.height });
  await sheet.goto(`${origin}/tools/artwork/.scratch/promo.html`);
  await sheet.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode().catch(() => {}))]));
  await sheet.waitForTimeout(300);
  const file = path.join(ROOT, piece.name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sheet.screenshot({ path: file, scale: 'css' });
  await sheet.close();
  console.log(`  ${piece.name} ${Math.round(fs.statSync(file).size / 1024)}KB`);
}

test('build the promo tiles and the cover', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const context = page.context();
  fs.mkdirSync(SCRATCH, { recursive: true });

  // The board itself, for the marquee to lean in from the edge.
  await page.evaluate(() => {
    window.Nordlys.config.groups.slice(4).forEach(group => { group.hidden = true; });
    window.Nordlys.saveConfig();
    window.Nordlys.bgEngine?.setAtmosphere({ motion: 1, intensity: 1.45 });
    window.Nordlys.grid.render();
    document.getElementById('board')?.classList.add('board-loaded');
  });
  await page.waitForTimeout(14000);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
  await page.screenshot({ path: path.join(SCRATCH, 'promo-product.png') });

  await hide(page, true);
  for (const piece of PIECES) {
    // The sky alone, at the picture's shape. A cover is wider than any screen,
    // so it is captured at half its size and drawn at twice the pixels.
    const scale = piece.width > 1600 ? 0.5 : 1;
    await page.setViewportSize({ width: Math.round(piece.width * scale), height: Math.round(piece.height * scale) });
    await page.waitForTimeout(9000);
    const sky = `sky-${piece.width}x${piece.height}.png`;
    await page.screenshot({ path: path.join(SCRATCH, sky) });
    const html = compose[piece.layout]({ sky: `/tools/artwork/.scratch/${sky}`, product: '/tools/artwork/.scratch/promo-product.png', width: piece.width, height: piece.height });
    await render(context, origin, piece, html);
  }
});
