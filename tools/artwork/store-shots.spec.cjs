const { test, expect } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const compose = require('./compose.cjs');
const { BOARDS, SKIES } = require('./store-board.cjs');

/* Regenerates the five Chrome Web Store screenshots. Each is a headline over
   the real product: the extension is opened on a board of well-known sites
   (store-board.cjs) in its own theme, scene and arrangement, captured at twice
   its pixels, and set into a layout from compose.cjs. Every look is one the
   product's own settings make; nothing in a screenshot is drawn by hand. The
   frames are kept in tools/artwork/.scratch for site-assets.cjs. */

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/store-assets');
const SCRATCH = path.join(ROOT, 'tools/artwork/.scratch');

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, timezoneId: 'Europe/Berlin' });
test.setTimeout(240000);

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

/* Part of the page: the boxes of the given elements taken together, with room
   around them, cut off at a height when a list runs on. */
async function closeUp(page, name, selectors, { pad = 22, height = Infinity } = {}) {
  await page.addStyleTag({ content: STILL });
  await page.waitForTimeout(300);
  const boxes = [];
  for (const selector of selectors) {
    const box = await page.locator(selector).first().boundingBox();
    if (box) boxes.push(box);
  }
  const x = Math.max(0, Math.min(...boxes.map(box => box.x)) - pad);
  const y = Math.max(0, Math.min(...boxes.map(box => box.y)) - pad);
  const right = Math.max(...boxes.map(box => box.x + box.width)) + pad;
  const bottom = Math.min(Math.max(...boxes.map(box => box.y + box.height)) + pad, y + height);
  await page.screenshot({ path: path.join(SCRATCH, name), animations: 'disabled', clip: { x, y, width: right - x, height: bottom - y } });
  return shot(name);
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

const shot = name => `/tools/artwork/.scratch/${name}`;
const hide = (page, ids) => page.evaluate(ids => {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node) node.style.visibility = 'hidden';
  }
}, ids);

/* One test per board, each opening its own look. */
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
    title: 'Bookmarks on your new tab',
    subtitle: 'Arrange folders over an animated background. No account or analytics.',
    image: sky
  }));
});

scene('skies', async ({ page, origin }) => {
  await hide(page, ['board', 'searchwrap', 'gear', 'hiddenDock', 'greet', 'fit-toggle']);
  const frames = [];
  for (const sky of SKIES) {
    await page.evaluate(({ scene, theme, intensity = 1 }) => {
      window.Nordlys.setTheme(theme);
      window.Nordlys.config.bgMode = scene;
      window.Nordlys.config.bgIntensity = intensity;
      window.Nordlys.saveConfig();
      window.Nordlys.updateBackgroundMode();
    }, sky);
    frames.push({ label: sky.name, image: await frame(page, `sky-${sky.scene}.png`, sky.scene === 'aurora' ? CANVAS_WARMUP : 6000) });
  }
  await render(page.context(), origin, 'screenshot-2-skies.png', compose.grid({
    title: '9 animated backgrounds',
    subtitle: 'Change the colours or speed, or use your own picture or video.',
    frames, backdropImage: frames[1].image
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
  await render(page.context(), origin, 'screenshot-3-arrange.png', compose.slide({
    title: 'Move folders around',
    subtitle: 'Choose free or fitted rows. Adjust tile size, spacing and width in one panel. Undo any change.',
    image: arrange
  }));
});

/* The search box and the icon picker up close. The brand search is the real
   one, so this is what a person searching "google" gets from Iconify. */
scene('extras', async ({ page }) => {
  await page.waitForTimeout(6000);
  const search = page.locator('#q');
  await search.click();
  await search.fill('45 * 12 + sqrt(144)');
  await expect(page.locator('#sugg .sugg-calc')).toBeVisible();
  await closeUp(page, 'extra-calc.png', ['#searchwrap', '#sugg']);

  await search.fill('>');
  await expect(page.locator('#sugg .sugg-command').nth(3)).toBeVisible();
  const rows = await page.locator('#sugg .sugg-command').nth(3).boundingBox();
  const top = (await page.locator('#searchwrap').boundingBox()).y;
  await closeUp(page, 'extra-commands.png', ['#searchwrap', '#sugg'], { pad: 10, height: rows.y + rows.height + 4 - (top - 10) });
  await search.fill('');
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await expect(page.locator('#icon-modal')).toBeVisible();
  await page.locator('#icon-search').fill('google');
  // The one step that goes online; a slow answer is asked for again.
  for (let attempt = 1; ; attempt++) {
    await page.locator('#icon-search-btn').click();
    try {
      await expect(page.locator('#modal-icon-grid .icon-item').nth(7)).toBeVisible({ timeout: 12000 });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(1200);
  // The search field and the first three rows of what it found.
  await page.addStyleTag({ content: STILL });
  const pane = await page.locator('#modal-pane-search').boundingBox();
  const field = await page.locator('#icon-search').boundingBox();
  const bottom = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#modal-icon-grid .icon-item')].map(item => item.getBoundingClientRect());
    const rows = [...new Set(boxes.map(box => Math.round(box.top)))].sort((a, b) => a - b);
    const third = rows[Math.min(2, rows.length - 1)];
    return Math.max(...boxes.filter(box => Math.round(box.top) === third).map(box => box.bottom));
  });
  const y = field.y - 16;
  await page.screenshot({ path: path.join(SCRATCH, 'extra-icons.png'), animations: 'disabled', clip: { x: pane.x, y, width: pane.width, height: bottom + 6 - y } });
});

scene('daylight', async ({ page, origin }) => {
  // An equinox day in Berlin at four hours. Only the date is held:
  // Playwright's clock would also stop the frame timer, and the sky with it.
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
  await render(page.context(), origin, 'screenshot-4-extras.png', compose.tiles({
    title: 'Search, icons and time of day',
    subtitle: 'Math and commands in the search box, icons by brand name, and a background that follows the time of day.',
    cells: [
      { label: 'Math in search', image: shot('extra-calc.png') },
      { label: 'Commands with >', image: shot('extra-commands.png') },
      { label: 'Brand icons', image: shot('extra-icons.png') },
      { label: 'Time of day', images: frames }
    ],
    backdropImage: frames[2].image
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
    title: '21 themes',
    subtitle: '11 dark and 10 light themes. You can make your own from three colours.',
    back: shot('light.png'), front: dark, backdropImage: dark
  }));
});
