const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Defects that the throwaway inspection sweeps found once. The sweeps are not
   committed, so anything they catch has to leave a permanent trace here or the
   same bug is free to come back unnoticed. One test per defect, named after the
   symptom rather than the fix. */

/* A 1x1 PNG, enough for MediaVault to store and the page to read back. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('switching themes faster than the transition settles raises nothing', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  /* Each theme change runs a view transition. Starting another before the first
     settles aborts it, and an aborted transition rejects a promise that reached
     the console as an uncaught error. */
  await page.evaluate(async () => {
    const themes = ['oled-obsidian', 'cyberpunk-neon', 'nordic-snow', 'gruvbox-dark', 'mint-breeze', 'aurora-void'];
    for (const theme of themes) {
      window.Aurora.setTheme(theme);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  });
  await page.waitForTimeout(600);
  const uncaught = runtimeErrors.filter(entry => entry.startsWith('pageerror'));
  expect(uncaught, 'rapid theme switching should raise no uncaught errors').toEqual([]);
});

test('uploading a wallpaper moves the scene selection with it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('.scene-card[data-scene="aurora"]')).toHaveAttribute('aria-checked', 'true');

  await page.locator('#cfg-custom-media').setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: PIXEL });

  /* The mode changes from code, not from a card, so the card had no reason to
     know: Wallpaper would run while Aurora stayed highlighted. */
  await expect(page.locator('.scene-card[data-scene="custom-image"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.scene-card[data-scene="aurora"]')).toHaveAttribute('aria-checked', 'false');
  // And the controls that belong to a wallpaper come with it.
  await expect(page.locator('#cfg-bg-blur')).toBeVisible();
  await expect(page.locator('#cfg-bg-motion')).toBeHidden();
});

test('removing a wallpaper hands the scene back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await page.locator('#cfg-custom-media').setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: PIXEL });
  await expect(page.locator('#cfg-remove-media')).toBeVisible();

  await page.locator('#cfg-remove-media').click();
  await expect(page.locator('.scene-card[data-scene="custom-image"]')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#cfg-bg-motion')).toBeVisible();
  await expect(page.locator('#cfg-remove-media')).toBeHidden();
});

test('a submenu keeps focus inside the menu it opened from', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first();
  await folder.locator('summary').click();
  await folder.locator('.bookmark-summary-row').first()
    .getByRole('button', { name: /More actions for YouTube/ }).click();

  const menu = page.locator('.nl-overflow-menu');
  await menu.getByRole('menuitem', { name: 'Move to folder' }).click();

  /* A submenu builds its items after the menu has opened, so they miss the pass
     that takes menu items out of the tab order. Tab then walks straight out of
     the menu that is supposed to be holding focus. */
  const strays = await menu.evaluate(root =>
    [...root.querySelectorAll('[role="menuitem"]')].filter(item => item.tabIndex !== -1).length);
  expect(strays, 'every submenu item stays out of the tab order').toBe(0);

  await page.keyboard.press('Tab');
  const stillInside = await page.evaluate(() => Boolean(document.activeElement?.closest('.nl-overflow-menu')));
  expect(stillInside, 'Tab must not escape an open menu').toBe(true);
});

test('the folder head keeps its three parts on one line at phone width', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 360, height: 720 });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  const summary = page.locator('.bookmark-folder-summary').first();
  await expect(summary).toBeVisible();

  /* Three children in a two-column grid put the count on a second row. Compare
     vertical centres, not top edges: the count badge is taller than the name and
     centres against it, so their tops legitimately differ by a pixel or two. */
  const spread = await summary.evaluate(node => {
    const centres = [...node.children]
      .filter(child => child.getClientRects().length)
      .map(child => { const box = child.getBoundingClientRect(); return box.top + box.height / 2; });
    return Math.max(...centres) - Math.min(...centres);
  });
  expect(spread, 'name, count and chevron share one line').toBeLessThan(6);
});
