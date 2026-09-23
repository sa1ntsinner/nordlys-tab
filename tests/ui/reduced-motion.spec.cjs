const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');

/* The suite runs with motion on, so what reduced motion changes was checked
   by nobody, and it had broken three things: keyboard menus opened with
   nothing focused, layout changes glided when they should have jumped, and
   the undo notice lost its centring and slid off a phone's screen. These are
   the paths that go through what "reduce" changes: focus into layers,
   geometry that must not animate, and glass that must stay readable without
   its blur. (It has to be a context option; the top-level one is ignored.) */
test.use({ contextOptions: { reducedMotion: 'reduce' }, nordlysBoard: NINE_FOLDERS });

test('the page really is in reduced motion here', async ({ nordlysPage }) => {
  expect(await nordlysPage.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
});

test('menus, dialogs and the drawer take focus the moment they open', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#board .tile').first().focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('#tile-ctx-menu').getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quick-title-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  expect(await page.evaluate(() => document.getElementById('icon-modal').contains(document.activeElement))).toBe(true);
});

test('a change of spacing lands at once instead of gliding', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const gap = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#board .grid')).columnGap));
  await page.evaluate(() => { window.Nordlys.config.cardGap = 24; window.Nordlys.applyGeometryTokens(); });
  expect(await gap()).toBeCloseTo(22, 0);
});

test('at 320px the undo notice stays on the screen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => window.NordlysUI.showUndoToast({ message: 'Folder deleted', duration: 60000, onAction: () => {} }));
  const box = await page.locator('#toast-dock .toast').first().boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});

test('without its blur the glass is solid', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const opacity = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--glass-opacity').trim());
  expect(Number(opacity)).toBe(1);
  const blur = await page.locator('#board .card').first().evaluate(card => getComputedStyle(card).backdropFilter);
  expect(blur).toBe('none');
});

test('the Glass choice says why it changes nothing while the glass is solid', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#advanced-glass-settings > summary').click();
  await expect(page.locator('.glass-solid-note')).toBeVisible();
});
