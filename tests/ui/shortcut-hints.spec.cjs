const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Rest the mouse on a control with a shortcut and a small label shows its
   keys; a touch, a click or a key shows nothing. The one-letter shortcuts
   work outside text fields only. */

const hint = page => page.locator('.shortcut-hint');

test('resting the mouse on the gear shows its name and keys, and leaving takes it away', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const title = await page.locator('#gear').getAttribute('title');
  await page.locator('#gear').hover();
  await expect(hint(page)).toBeVisible();
  await expect(hint(page).locator('kbd')).toHaveText([/Ctrl|⌘/, ',']);
  await expect(hint(page)).toHaveAttribute('aria-hidden', 'true');
  // The browser's own tooltip steps aside while it shows, and comes back.
  expect(await page.locator('#gear').getAttribute('title')).toBeNull();
  await page.mouse.move(5, 5);
  await expect(hint(page)).toHaveCount(0);
  expect(await page.locator('#gear').getAttribute('title')).toBe(title);
  expect(runtimeErrors).toEqual([]);
});

test('the search box shows both of its keys, and a tile its Alt number', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#search').hover();
  await expect(hint(page).locator('kbd')).toHaveText(['/', /Ctrl|⌘/, 'K']);
  await page.locator('#board .tile[data-shortcut="1"]').hover();
  await expect(hint(page).locator('kbd')).toHaveText([/Alt|⌥/, '1'], { timeout: 4000 });
});

test('a click puts the hint away, and the setting turns hints off', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#search').hover();
  await expect(hint(page)).toBeVisible();
  await page.mouse.down();
  await expect(hint(page)).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.Nordlys.config.shortcutHints = false; });
  await page.mouse.move(5, 5);
  await page.locator('#gear').hover();
  await page.waitForTimeout(800);
  await expect(hint(page)).toHaveCount(0);
});

test('one letter does one thing, and nothing while typing', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const folders = () => page.evaluate(() => window.Nordlys.config.groups.length);
  const before = await folders();
  await page.keyboard.press('d');
  await expect.poll(() => page.evaluate(() => window.Nordlys.dashboard.on)).toBe(true);
  await page.keyboard.press('d');
  await expect.poll(() => page.evaluate(() => window.Nordlys.dashboard.on)).toBe(false);
  const light = await page.evaluate(() => window.Nordlys.isLightTheme());
  await page.keyboard.press('l');
  await expect.poll(() => page.evaluate(() => window.Nordlys.isLightTheme())).toBe(!light);
  await page.locator('#q').focus();
  await page.keyboard.type('nd');
  await expect(page.locator('#q')).toHaveValue('nd');
  expect(await folders()).toBe(before);
  expect(await page.evaluate(() => window.Nordlys.dashboard.on)).toBe(false);
});
