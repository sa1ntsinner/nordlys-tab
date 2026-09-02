const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Rows carry one button now. Everything they used to spell out along the row —
   edit, up, down, move to, delete — lives behind it, so these helpers say
   "through the menu" once instead of at every call site. */
async function openSettings(page) {
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Bookmarks' }).click();
}

function menu(page) {
  return page.locator('.nl-overflow-menu');
}

async function act(page, scope, subject, item) {
  await scope.getByRole('button', { name: new RegExp(`More actions for ${subject}`) }).first().click();
  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole('menuitem', { name: item }).click();
}

test('bookmark folders are compact accordions with focused editors and explicit movement', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  const folders = page.locator('.bookmark-folder-accordion');
  await expect(folders).toHaveCount(5);
  await expect(folders.first().locator('.bookmark-folder-count')).toHaveText('8');
  await folders.first().locator('summary').click();
  const rows = folders.first().locator('.bookmark-summary-row');
  await expect(rows).toHaveCount(8);

  await expect(rows.first().locator('.bookmark-editor')).toBeHidden();
  await act(page, rows.first(), 'YouTube', 'Edit');
  await expect(rows.first().locator('.bookmark-editor')).toBeVisible();

  await act(page, folders.first().locator('.bookmark-summary-row').first(), 'YouTube', 'Move down');
  await expect(folders.first().locator('.bookmark-summary-name').nth(1)).toHaveText('YouTube');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.links?.[1]?.name).toBe('YouTube');
});

test('deletion offers a one-shot Undo that restores the exact location', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  const folder = page.locator('.bookmark-folder-accordion').first();
  await folder.locator('summary').click();
  await act(page, folder.locator('.bookmark-summary-row').first(), 'YouTube', 'Delete');
  await expect(folder.locator('.bookmark-summary-row')).toHaveCount(7);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(folder.locator('.bookmark-summary-name').first()).toHaveText('YouTube');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.links?.[0]?.name).toBe('YouTube');
});

test('Undo follows the deleted bookmark folder identity after folders are reordered', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  const first = page.locator('.bookmark-folder-accordion').first();
  await first.locator('summary').click();
  await act(page, first.locator('.bookmark-summary-row').first(), 'YouTube', 'Delete');
  await act(page, page.locator('.bookmark-folder-accordion').first().locator('.bookmark-folder-head'), 'DAILY', 'Move down');
  await page.getByRole('button', { name: 'Undo' }).click();
  const movedFolder = page.locator('.bookmark-folder-accordion').nth(1);
  await expect(movedFolder.locator('.bookmark-summary-name').first()).toHaveText('YouTube');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[1]?.links?.[0]?.name).toBe('YouTube');
});

test('a collapsed folder shows its name, its count and one way in', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  const folder = page.locator('.bookmark-folder-accordion').first();
  await expect(folder.locator('.bookmark-summary-list')).toBeHidden();

  /* The whole point of the row: a collapsed folder offers exactly one control,
     not the seven that used to wrap onto a second line. */
  const controls = await folder.locator('.bookmark-folder-head button:visible, .bookmark-folder-head select:visible').count();
  expect(controls, 'a collapsed folder should carry one button').toBe(1);

  await act(page, folder.locator('.bookmark-folder-head'), 'DAILY', 'Rename');
  const name = folder.getByRole('textbox', { name: /Folder name/ });
  await name.fill('Daily');
  await name.press('Enter');
  await expect(folder.locator('summary strong')).toHaveText('Daily');
});

test('an open folder puts adding a bookmark and its column count in reach', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  const folder = page.locator('.bookmark-folder-accordion').first();
  await folder.locator('summary').click();

  // The visible control is themed; the native element behind it stays the value
  // source, so set it the way that control does when it commits.
  await folder.locator('select[aria-label*="Columns"]').evaluate(select => {
    select.value = '6';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.cols).toBe(6);

  await folder.getByRole('button', { name: /Add bookmark to/ }).click();
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.links?.at(-1)?.name).toBe('New Bookmark');
});

test('expanded bookmark actions stay grouped within their row', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  await page.locator('.bookmark-folder-summary').first().click();
  const row = page.locator('.bookmark-summary-row').first();
  await expect(row.locator('.bookmark-row-actions > *:visible')).toHaveCount(1);
  const overflow = await row.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return [...node.querySelectorAll('.bookmark-row-actions > *')]
      .filter(control => control.getClientRects().length)
      .filter(control => {
        const box = control.getBoundingClientRect();
        return box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom;
      })
      .map(control => control.getAttribute('aria-label'));
  });
  expect(overflow).toEqual([]);
});

/* Moving a bookmark between folders was a <select> in the middle of the row.
   A select cannot live inside a menu, so the folders became a second page of
   it — which also has to be reachable without a mouse. */
test('the overflow menu moves a bookmark to another folder from the keyboard', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  const folder = page.locator('.bookmark-folder-accordion').first();
  await folder.locator('summary').click();
  await folder.locator('.bookmark-summary-row').first()
    .getByRole('button', { name: /More actions for YouTube/ }).click();

  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole('menuitem', { name: 'Move to folder' }).click();
  // The same menu now lists the other folders, and focus is already on one.
  await expect(menu(page).getByRole('menuitem', { name: 'DEV & TECH' })).toBeVisible();
  await page.keyboard.press('Enter');

  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[1]?.links?.at(-1)?.name).toBe('YouTube');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.links?.some(link => link.name === 'YouTube')).toBe(false);
});
