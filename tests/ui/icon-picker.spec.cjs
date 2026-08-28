const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('icon picker is a focus-contained source-tab dialog with real tile preview', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary').click();
  await folder.locator('.bookmark-summary-row').first().getByRole('button', { name: /Edit YouTube/ }).click();
  const trigger = folder.locator('.bookmark-summary-row').first().getByRole('button', { name: /Choose icon/ }); await trigger.click();
  const dialog = page.locator('#icon-modal'); await expect(dialog).toHaveAttribute('role', 'dialog'); await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await page.waitForTimeout(300);
  const width = (await dialog.locator('.modal-box').boundingBox()).width; expect(width).toBeGreaterThanOrEqual(640); expect(width).toBeLessThanOrEqual(680);
  await expect(dialog.getByRole('tab')).toHaveCount(5);
  await expect(dialog.locator('#icon-live-preview .tile .box')).toBeVisible();
  await page.locator('#icon-search').fill('github');
  const result = dialog.getByRole('button', { name: /GitHub/ }); await expect(result).toHaveCount(1);
  const cell = await result.boundingBox(); expect(cell.width).toBeGreaterThanOrEqual(72); expect(cell.height).toBeGreaterThanOrEqual(72);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('icon picker fits a 320px viewport', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.setViewportSize({ width: 320, height: 568 }); await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary strong').click();
  await folder.locator('.bookmark-summary-row').first().getByRole('button', { name: /Edit YouTube/ }).click(); await folder.getByRole('button', { name: /Choose icon/ }).click();
  const box = await page.locator('#icon-modal .modal-box').boundingBox(); expect(box.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
