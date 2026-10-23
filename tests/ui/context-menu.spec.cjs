const { test, expect } = require('../helpers/nordlys-fixture.cjs');
test('tile context menu supports Shift+F10, roving keys, and focus restoration', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const tile = page.locator('#board .tile').first(); await tile.focus(); await page.keyboard.press('Shift+F10');
  await page.waitForTimeout(120);
  const menu = page.locator('#tile-ctx-menu'); await expect(menu).toHaveAttribute('role', 'menu'); await expect(menu.getByRole('menuitem')).toHaveCount(6); await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitem').last()).toBeFocused(); await page.keyboard.press('Home'); await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape'); await expect(tile).toBeFocused();
});

test('quick edit uses the shared modal focus lifecycle', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const tile = page.locator('#board .tile').first(); await tile.focus(); await page.keyboard.press('Shift+F10'); await page.waitForTimeout(120);
  await expect(page.locator('#tile-ctx-menu').getByRole('menuitem').first()).toBeFocused(); await page.keyboard.press('Enter');
  const dialog = page.locator('#quick-edit-modal'); await expect(dialog).toHaveAttribute('role', 'dialog'); await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await page.keyboard.press('Escape'); await expect(tile).toBeFocused();
});

test('Menu key, Space activation, and viewport collision use the top-layer menu', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.setViewportSize({ width: 320, height: 568 });
  const tile = page.locator('#board .tile').first(); await tile.focus(); await page.keyboard.press('ContextMenu');
  const menu = page.locator('#tile-ctx-menu'); await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.evaluate(() => window.Nordlys.grid.positionMenu(document.querySelector('#tile-ctx-menu'), innerWidth - 1, innerHeight - 1, document.querySelector('#board .tile')));
  const box = await menu.boundingBox(); expect(box.x + box.width).toBeLessThanOrEqual(320); expect(box.y + box.height).toBeLessThanOrEqual(568);
  await page.keyboard.press('Space'); await expect(page.locator('#quick-edit-modal')).toBeVisible(); await expect(menu).toBeHidden();
  expect(await page.evaluate(() => NordlysUI.layers.map(layer => layer.root.id))).toEqual(['quick-edit-modal']);
});

/* On Windows the browser sends its own contextmenu event at the Menu key's
   keyup, after the keydown has opened the menu: the same request twice. A
   second opening that ran late put the menu back after it had been used. */
test('the Menu key opens the menu once', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    const grid = window.Nordlys.grid;
    const open = grid.openTileContextMenu.bind(grid);
    window.__opened = 0;
    grid.openTileContextMenu = (...args) => { window.__opened++; return open(...args); };
  });
  const tile = page.locator('#board .tile').first();
  await tile.focus();
  await page.keyboard.press('ContextMenu');
  await expect(page.locator('#tile-ctx-menu').getByRole('menuitem').first()).toBeFocused();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__opened)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(tile).toBeFocused();
});
