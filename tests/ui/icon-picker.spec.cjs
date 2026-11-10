const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { openIconPicker } = require('../helpers/flows.cjs');

test('the icon dialog holds focus, has one field and shows the real tile', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary').click();
  const trigger = await openIconPicker(page, folder);
  const dialog = page.locator('#icon-modal'); await expect(dialog).toHaveAttribute('role', 'dialog'); await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await page.waitForTimeout(300);
  const width = (await dialog.locator('.modal-box').boundingBox()).width; expect(width).toBeGreaterThanOrEqual(420); expect(width).toBeLessThanOrEqual(460);
  /* One field, no tabs: a name or a link, and the finder does the rest. */
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.locator('#icon-live-preview .tile .box')).toBeVisible();
  await expect(dialog.locator('#icon-live-preview .nl-icon[data-icon-kind="builtin"]')).toHaveCount(1);
  await expect(dialog.locator('#icon-live-preview .mono')).toHaveCount(0);
  await expect(page.locator('#icon-find')).toBeFocused();
  await page.locator('#icon-find').fill('github');
  /* Typing alone is private; the explicit button is the network boundary. */
  await expect(dialog.locator('#icon-choices [role="radio"]')).toHaveCount(0);
  const search = dialog.getByRole('button', { name: 'Find' });
  const target = await search.boundingBox(); expect(target.height).toBeGreaterThanOrEqual(40);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('icon picker fits a 320px viewport', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.setViewportSize({ width: 320, height: 568 }); await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary strong').click();
  await openIconPicker(page, folder);
  const box = await page.locator('#icon-modal .modal-box').boundingBox(); expect(box.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
