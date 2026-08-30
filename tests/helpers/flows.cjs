/* Paths several specs need but none of them own.

   Reaching a bookmark's editor goes through the row's overflow menu now that a
   row carries one button instead of five. Six specs walk that path, so it lives
   here: a change to the menu is a change in one file, not six. */

function overflowMenu(page) {
  return page.locator('.nl-overflow-menu');
}

async function openRowMenu(page, folder, name) {
  await folder.locator('.bookmark-summary-row').first()
    .getByRole('button', { name: new RegExp(`More actions for ${name}`) }).first().click();
  return overflowMenu(page);
}

async function openRowEditor(page, folder, name = 'YouTube') {
  const menu = await openRowMenu(page, folder, name);
  await menu.getByRole('menuitem', { name: 'Edit' }).click();
}

/* Returns the Choose icon button, since callers assert focus returns to it. */
async function openIconPicker(page, folder, name = 'YouTube') {
  await openRowEditor(page, folder, name);
  const trigger = folder.getByRole('button', { name: /Choose icon/ }).first();
  await trigger.click();
  return trigger;
}

module.exports = { overflowMenu, openRowMenu, openRowEditor, openIconPicker };
