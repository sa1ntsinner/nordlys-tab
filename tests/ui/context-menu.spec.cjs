const { test, expect } = require('../helpers/nordlys-fixture.cjs');
test('tile context menu supports Shift+F10, roving keys, and focus restoration', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const tile = page.locator('#board .tile').first(); await tile.focus(); await page.keyboard.press('Shift+F10');
  await page.waitForTimeout(120);
  const menu = page.locator('#tile-ctx-menu'); await expect(menu).toHaveAttribute('role', 'menu'); await expect(menu.getByRole('menuitem')).toHaveCount(5); await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitem').last()).toBeFocused(); await page.keyboard.press('Home'); await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape'); await expect(tile).toBeFocused();
});

test('quick edit uses the shared modal focus lifecycle', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const tile = page.locator('#board .tile').first(); await tile.focus(); await page.keyboard.press('Shift+F10'); await page.waitForTimeout(120);
  await expect(page.locator('#tile-ctx-menu').getByRole('menuitem').first()).toBeFocused(); await page.keyboard.press('Enter');
  const dialog = page.locator('#quick-edit-modal'); await expect(dialog).toHaveAttribute('role', 'dialog'); await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await page.keyboard.press('Escape'); await expect(tile).toBeFocused();
});
