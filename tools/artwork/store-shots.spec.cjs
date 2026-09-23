const { test, expect } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const compose = require('./compose.cjs');
const { BOARDS } = require('./store-board.cjs');

/* Regenerates the five Chrome Web Store screenshots. Each is a headline over
   the real product: the extension is opened on a board of well-known sites
   (store-board.cjs) in its own theme, scene and arrangement, captured at twice
   its pixels, and set into a layout from compose.cjs. Every look is one the
   product's own settings make; nothing in a screenshot is drawn by hand. */

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/store-assets');
const SCRATCH = path.join(ROOT, 'tools/artwork/.scratch');

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, timezoneId: 'Europe/Berlin' });
test.setTimeout(180000);

/* The scene animates on a slow clock: in the first second the aurora is still a
   flat wash, and only after roughly a dozen does it draw the ribbons that make
   it worth showing. */
const CANVAS_WARMUP = 14000;
const STILL = '*,*::before,*::after{transition:none!important}#q{caret-color:transparent!important}';

async function frame(page, name, warmup = 700) {
  await page.waitForTimeout(warmup);
  await page.addStyleTag({ content: STILL });
  await page.waitForTimeout(200);
  const file = path.join(SCRATCH, name);
  await page.screenshot({ path: file, animations: 'disabled' });
  return `/tools/artwork/.scratch/${name}`;
}

/* Lays a composition out in a page of its own, at the store's size. */
async function render(context, origin, name, html) {
  fs.writeFileSync(path.join(SCRATCH, 'compose.html'), html);
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 1280, height: 800 });
  await sheet.goto(`${origin}/tools/artwork/.scratch/compose.html`);
  await sheet.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode().catch(() => {}))]));
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: path.join(OUT, name), scale: 'css' });
  await sheet.close();
  console.log(`  ${name} ${Math.round(fs.statSync(path.join(OUT, name)).size / 1024)}KB`);
}

/* Three pictures for one bookmark, as if taken from three addresses over
   time: the same mark, drawn three ways. */
async function iconVersions(page) {
  return page.evaluate(() => [['#ff4d4d', '#b3122e'], ['#2b2f3a', '#12141a'], ['#ffffff', '#e8ebf2']].map(([top, bottom], index) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
    const g = canvas.getContext('2d');
    const fill = g.createLinearGradient(0, 0, 0, 128);
    fill.addColorStop(0, top); fill.addColorStop(1, bottom);
    g.fillStyle = fill;
    g.beginPath(); g.roundRect(8, 24, 112, 80, 24); g.fill();
    g.fillStyle = index === 2 ? '#e0253a' : '#ffffff';
    g.beginPath(); g.moveTo(52, 44); g.lineTo(86, 64); g.lineTo(52, 84); g.closePath(); g.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  }));
}

const shot = name => `/tools/artwork/.scratch/${name}`;

/* One screenshot per test, each opening its own board and look. */
const scene = (key, run) => test.describe(key, () => {
  test.use({ nordlysBoard: BOARDS[key] });
  test(`screenshot: ${key}`, async ({ nordlysPage }) => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(SCRATCH, { recursive: true });
    await nordlysPage.page.evaluate(() => document.getElementById('board')?.classList.add('board-loaded'));
    await run(nordlysPage);
  });
});

scene('sky', async ({ page, origin }) => {
  const sky = await frame(page, 'sky.png', CANVAS_WARMUP);
  await render(page.context(), origin, 'screenshot-1-sky.png', compose.slide({
    title: 'A new tab under a living sky',
    subtitle: 'Six moving scenes, drawn on your own machine, with your bookmarks in folders on top.',
    image: sky
  }));
});

scene('arrange', async ({ page, origin }) => {
  await page.waitForTimeout(CANVAS_WARMUP - 4000);
  await page.mouse.click(40, 890, { button: 'right' });
  await page.locator('#board-ctx-menu [data-action="arrange"]').click();
  await expect(page.locator('#arrange-bar')).toBeVisible();
  await page.locator('.arrange-layout[data-layout="fitted"]').click();
  await expect(page.locator('.arrange-layout[data-layout="fitted"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#arrange-size').click();
  await expect(page.locator('#arrange-size-panel')).toBeVisible();
  await page.mouse.move(720, 20);
  const arrange = await frame(page, 'arrange.png', 1500);
  await render(page.context(), origin, 'screenshot-2-arrange.png', compose.slide({
    title: 'Arrange it the way you think',
    subtitle: 'Fitted rows, or folders where you drop them. Set size and spacing, and one Undo takes it back.',
    image: arrange
  }));
});

scene('icons', async ({ page, origin }) => {
  const board = await frame(page, 'icons-board.png', CANVAS_WARMUP);
  // Three pictures one bookmark has come from, served as if from three addresses.
  const pictures = await iconVersions(page);
  await page.route('https://icons.example/**', route => {
    const index = Number(/v(\d)/.exec(route.request().url())?.[1] || 1) - 1;
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(pictures[index], 'base64') });
  });
  const openCustom = async () => {
    await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
    await expect(page.locator('#icon-modal')).toBeVisible();
    await page.locator('.icon-tab-btn[data-tab="custom"]').click();
    await expect(page.locator('#modal-pane-custom')).toBeVisible();
  };
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  for (const version of [3, 2, 1]) {
    await openCustom();
    await page.locator('#icon-url-input').fill(`https://icons.example/play-v${version}.png`);
    await page.locator('#icon-url-input').press('Enter');
    await expect(page.locator('#icon-url-status')).toHaveText('Image ready');
    await page.locator('#icon-url-apply-btn').click();
    await expect(page.locator('#icon-modal')).toBeHidden();
  }
  await openCustom();
  await expect(page.locator('.icon-url-version')).toHaveCount(3);
  await page.evaluate(() => document.activeElement?.blur());
  const source = page.locator('#icon-url-source');
  await source.scrollIntoViewIfNeeded();
  await page.locator('.icon-url-version').nth(1).hover();
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: STILL });
  const box = await source.boundingBox();
  await page.screenshot({ path: path.join(SCRATCH, 'icons.png'), animations: 'disabled', clip: { x: box.x - 22, y: box.y - 18, width: box.width + 44, height: box.height + 30 } });
  await render(page.context(), origin, 'screenshot-3-icons.png', compose.feature({
    title: 'Every bookmark, the icon you want',
    subtitle: 'A site’s own icon, a letter, or a picture from any address — and the ones you used before stay in reach.',
    back: board, detail: shot('icons.png')
  }));
});

scene('daylight', async ({ page, origin }) => {
  // An equinox day in Berlin at four hours, the clock saying which. Only the
  // date is held: Playwright's clock would also stop the frame timer, and the
  // sky with it.
  await page.evaluate(() => {
    window.Nordlys.config.bgDaylight = true;
    window.Nordlys.saveConfig();
    window.Nordlys.bgEngine.setDaylight(true);
  });
  await page.waitForTimeout(CANVAS_WARMUP - 6000);
  const hours = [['Dawn', '2026-09-22T04:50:00Z'], ['Day', '2026-09-22T11:00:00Z'], ['Sunset', '2026-09-22T17:05:00Z'], ['Night', '2026-09-22T21:30:00Z']];
  const frames = [];
  for (const [label, iso] of hours) {
    await page.evaluate(iso => {
      const Real = window.__RealDate ||= Date, fixed = new Real(iso).getTime();
      window.Date = class extends Real { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
      window.Nordlys.bgEngine.followSun();
    }, iso);
    frames.push({ label, image: await frame(page, `daylight-${label.toLowerCase()}.png`, 6000) });
  }
  await render(page.context(), origin, 'screenshot-4-daylight.png', compose.mosaic({
    title: 'Lit by the time of day',
    subtitle: 'Turn on daylight and every scene follows the sun where you are. No location asked, nothing sent.',
    frames, backdropImage: frames[2].image
  }));
});

// The same board light, then dark with the theme grid open; the second
// composes both.
scene('light', async ({ page }) => {
  await frame(page, 'light.png', CANVAS_WARMUP);
});

scene('dark', async ({ page, origin }) => {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await expect(page.locator('#sec-appearance')).toBeVisible();
  await page.evaluate(() => document.activeElement?.blur());
  const dark = await frame(page, 'dark.png', CANVAS_WARMUP);
  await render(page.context(), origin, 'screenshot-5-themes.png', compose.pair({
    title: 'Light or dark, always readable',
    subtitle: '21 themes, light and dark, each checked for contrast on every panel it paints.',
    back: shot('light.png'), front: dark, backdropImage: dark
  }));
});
