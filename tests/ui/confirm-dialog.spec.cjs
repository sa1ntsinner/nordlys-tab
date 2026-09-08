const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The confirm dialog guards every destructive action in the product: deleting a
   folder, resetting everything. A keyboard user reads the two buttons, moves to
   Cancel, and presses Enter — and Enter used to confirm regardless of which
   button had focus. That is the single most dangerous interaction a product can
   have: the control that says "no" does "yes". */

async function openDeleteFolderDialog(page) {
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Bookmarks' }).click();
  await page.locator('.bookmark-folder-accordion').first()
    .locator('.bookmark-folder-head').getByRole('button', { name: /More actions for/ }).click();
  await page.locator('.nl-overflow-menu').getByRole('menuitem', { name: 'Delete folder' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('a destructive dialog opens with focus on the safe answer', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const dialog = await openDeleteFolderDialog(page);
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focused, 'Cancel takes focus first when the action destroys something').toBe('Cancel');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
});

test('Enter on Cancel cancels', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await page.evaluate(() => window.Nordlys.config.groups.length);
  const dialog = await openDeleteFolderDialog(page);
  await dialog.getByRole('button', { name: 'Cancel' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  expect(await page.locator('.bookmark-folder-accordion').count(), 'nothing was deleted').toBe(before);
  expect(await page.evaluate(() => window.Nordlys.config.groups.length)).toBe(before);
});

test('Enter on the confirm button confirms', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await page.evaluate(() => window.Nordlys.config.groups.length);
  const dialog = await openDeleteFolderDialog(page);
  await dialog.getByRole('button', { name: 'Delete' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.bookmark-folder-accordion')).toHaveCount(before - 1);
});

test('Enter with focus on neither button does nothing destructive', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await page.evaluate(() => window.Nordlys.config.groups.length);
  const dialog = await openDeleteFolderDialog(page);
  // Focus the dialog itself, as happens after clicking on its text.
  await dialog.evaluate(node => { node.tabIndex = -1; node.focus(); });
  await page.keyboard.press('Enter');
  await expect(dialog, 'the dialog stays open, waiting for an actual answer').toBeVisible();
  expect(await page.evaluate(() => window.Nordlys.config.groups.length)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('a non-destructive dialog may start on its confirm button', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const focused = await page.evaluate(async () => {
    const pending = confirmDialog({ title: 'Continue?', message: 'Nothing is lost either way.', confirmText: 'Continue', danger: false });
    await new Promise(resolve => setTimeout(resolve, 50));
    const active = document.activeElement?.textContent?.trim();
    document.querySelector('#confirm-modal .confirm-cancel').click();
    await pending;
    return active;
  });
  expect(focused).toBe('Continue');
});
