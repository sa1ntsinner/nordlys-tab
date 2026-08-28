const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('bookmark folders are compact accordions with focused editors and explicit movement', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folders = page.locator('.bookmark-folder-accordion'); await expect(folders).toHaveCount(5);
  await expect(folders.first().locator('.bookmark-folder-count')).toHaveText('8');
  await folders.first().locator('summary').click();
  const rows = folders.first().locator('.bookmark-summary-row'); await expect(rows).toHaveCount(8);
  await expect(rows.first().locator('.bookmark-editor')).toBeHidden();
  await rows.first().getByRole('button', { name: /Edit YouTube/ }).click();
  await expect(rows.first().locator('.bookmark-editor')).toBeVisible();
  await rows.first().getByRole('button', { name: /Move YouTube down/ }).click();
  await expect(folders.first().locator('.bookmark-summary-name').nth(1)).toHaveText('YouTube');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[0]?.links?.[1]?.name).toBe('YouTube');
});

test('deletion offers a one-shot Undo that restores the exact location', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary').click();
  await folder.locator('.bookmark-summary-row').first().getByRole('button', { name: /Delete YouTube/ }).click();
  await expect(folder.locator('.bookmark-summary-row')).toHaveCount(7);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(folder.locator('.bookmark-summary-name').first()).toHaveText('YouTube');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[0]?.links?.[0]?.name).toBe('YouTube');
});
