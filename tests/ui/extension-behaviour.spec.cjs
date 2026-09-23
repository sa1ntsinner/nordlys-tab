const { test, expect } = require('@playwright/test');
const { launchExtension } = require('../helpers/real-extension.cjs');
const { DEMO_BOARD } = require('../helpers/demo-board.cjs');

/* Behaviour that only the real extension can prove. Each test here is the
   user's own gesture — typing, pressing a key, choosing a file — followed by
   what they would see, under the product's actual content security policy and
   its actual storage. */

test.describe.configure({ mode: 'serial' });

let ext;
test.beforeEach(async () => { ext = await launchExtension(); });
test.afterEach(async () => { await ext?.close(); });

test('arithmetic typed into the search box gets its answer under the real CSP', async () => {
  const { page } = ext;
  await page.locator('#q').click();
  await page.keyboard.type('45 * 12 + sqrt(144)');
  await expect(page.locator('#sugg .sugg-calc .calc-val')).toHaveText('45 * 12 + sqrt(144) = 552');

  await page.locator('#q').fill('');
  await page.keyboard.type('2+2');
  await expect(page.locator('#sugg .sugg-calc .calc-val')).toHaveText('2+2 = 4');

  expect(await ext.violations(), 'nothing was blocked by the policy on the way').toEqual([]);
  expect(ext.errors.filter(text => /content security policy|unsafe-eval/i.test(text))).toEqual([]);
});

test('Enter on Cancel leaves everything in place in the real dialog', async () => {
  const { page } = ext;
  // A real install opens empty, so the folder this test declines to delete has
  // to be put there first — through the extension's own storage.
  await ext.installBoard(DEMO_BOARD);
  const before = await page.evaluate(() => window.Nordlys.config.groups.length);
  expect(before, 'the board under test must actually hold folders').toBeGreaterThan(0);
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Bookmarks' }).click();
  await page.locator('.bookmark-folder-accordion').first()
    .locator('.bookmark-folder-head').getByRole('button', { name: /More actions for/ }).click();
  await page.locator('.nl-overflow-menu').getByRole('menuitem', { name: 'Delete folder' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.Nordlys.config.groups.length)).toBe(before);
});

/* The newest surfaces, in the real extension: Arrange and its size panel, the
   icon picker's address pane, and a second tab taking the first one's save —
   the storage event exists only between real extension pages. */
test('arranging, the address pane and a second tab work under the real policy', async () => {
  const { page } = ext;
  await ext.installBoard(DEMO_BOARD);
  await page.evaluate(() => window.Nordlys.grid.arrange.enter());
  await page.locator('#arrange-size').click();
  await page.locator('[data-tile="96"]').click();
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.tileSize)).toBe(96);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await expect(page.locator('#icon-url-source')).toBeVisible();
  await page.keyboard.press('Escape');

  const second = await page.context().newPage();
  await second.goto(page.url());
  await second.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await second.evaluate(() => {
    window.Nordlys.config.groups[0].links.push({ name: 'From the second tab', url: 'https://second.test/' });
    window.Nordlys.saveConfig();
  });
  await expect(page.locator('#board .tile', { hasText: 'From the second tab' })).toBeVisible();
  await second.close();

  expect(await ext.violations(), 'nothing was blocked by the policy').toEqual([]);
  expect(ext.errors.filter(text => !/favicon|Failed to load resource/i.test(text))).toEqual([]);
});

/* An icon from an address, the whole way, in the real extension: fetched,
   drawn into its thumbnail on a canvas, stored, and remembered after a
   reload — each a step the content security policy or real storage could
   break where the test server does not. */
test('an icon taken from an address is remembered across a reload', async () => {
  const { page } = ext;
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHUlEQVR42mNkYPhfz0AEYBxVSF+FjKMKRxWSrhAAhm0f8Uq+1cQAAAAASUVORK5CYII=', 'base64');
  await page.context().route('https://icons.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } }));
  await ext.installBoard(DEMO_BOARD);
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await page.locator('#icon-url-input').fill('https://icons.test/real.png');
  await page.locator('#icon-url-input').press('Enter');
  await expect(page.locator('#icon-url-status')).toHaveText('Image ready', { timeout: 10000 });
  await page.locator('#icon-url-apply-btn').click();
  await expect(page.locator('#icon-modal')).toBeHidden();

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  const link = await page.evaluate(() => window.Nordlys.config.groups[0].links[0]);
  expect(link.iconUrl).toBe('https://icons.test/real.png');
  expect(link.customImg).toMatch(/^data:image\//);
  expect(link.iconUrls[0].thumb).toMatch(/^data:image\/(webp|png);base64,/);
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await expect(page.locator('#icon-url-input')).toHaveValue('https://icons.test/real.png');
  expect(await ext.violations()).toEqual([]);
});
