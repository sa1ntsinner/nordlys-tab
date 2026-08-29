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

test('Undo follows the deleted bookmark folder identity after folders are reordered', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const first = page.locator('.bookmark-folder-accordion').first(); await first.locator('summary').click();
  await first.getByRole('button', { name: /Delete YouTube/ }).click();
  await first.getByRole('button', { name: /Move .* down/ }).first().click();
  await page.getByRole('button', { name: 'Undo' }).click();
  const movedFolder = page.locator('.bookmark-folder-accordion').nth(1);
  await expect(movedFolder.locator('.bookmark-summary-name').first()).toHaveText('YouTube');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[1]?.links?.[0]?.name).toBe('YouTube');
});

test('collapsed folder exposes only working management controls', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first();
  await expect(folder.locator('.bookmark-summary-list')).toBeHidden();
  await expect(folder.getByRole('button', { name: /More actions/ })).toHaveCount(0);
  await folder.getByRole('button', { name: /Rename/ }).click();
  const name = folder.getByRole('textbox', { name: /Folder name/ }); await name.fill('Daily'); await name.press('Enter');
  await expect(folder.locator('summary strong')).toHaveText('Daily');
  await folder.getByRole('combobox', { name: /Columns/ }).selectOption('6');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[0]?.cols).toBe(6);
  await folder.getByRole('button', { name: /Add bookmark/ }).click();
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[0]?.links?.at(-1)?.name).toBe('New Bookmark');
});

test('expanded bookmark actions stay grouped within their row', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  await page.locator('.bookmark-folder-summary').first().click();
  await expect(page.locator('.bookmark-summary-row').first().locator('.bookmark-row-actions > *')).toHaveCount(5);
  const overflow = await page.locator('.bookmark-summary-row').first().evaluate(row => {
    const bounds = row.getBoundingClientRect();
    return [...row.querySelectorAll('.bookmark-row-actions > *')].filter(control => { const box = control.getBoundingClientRect(); return box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom; }).map(control => control.getAttribute('aria-label'));
  });
  expect(overflow).toEqual([]);
});
