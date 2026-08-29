const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function renderedFocusableIds(root) {
  return root.evaluate(node => [...node.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(item => item.getClientRects().length && !item.closest('[hidden],[aria-hidden="true"],[inert]') && !item.closest('details:not([open]) > :not(summary)'))
    .map((item, index) => { if (!item.id) item.id = `focus-probe-${crypto.randomUUID()}-${index}`; return item.id; }));
}

async function expectCycles(page, root) {
  await expect(root).toBeVisible();
  const ids = await renderedFocusableIds(root); expect(ids.length).toBeGreaterThan(1);
  expect(await root.evaluate(node => NordlysUI.visibleFocusable(node).map(item => item.id))).toEqual(ids);
  await page.locator(`#${ids.at(-1)}`).focus(); await page.keyboard.press('Tab'); await expect(page.locator(`#${ids[0]}`)).toBeFocused();
  await page.locator(`#${ids[0]}`).focus(); await page.keyboard.press('Shift+Tab'); await expect(page.locator(`#${ids.at(-1)}`)).toBeFocused();
}

test('every settings section contains forward and backward keyboard focus', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); const drawer = page.locator('#cfg');
  for (const id of ['appearance', 'background', 'bookmarks', 'general', 'custom-css', 'backup']) {
    await page.locator(`#settings-tab-${id}`).click(); await expectCycles(page, drawer);
    for (let index = 0; index < 35; index++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('#cfg') !== null), `${id} leaked focus`).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(page.locator('#gear')).toBeFocused(); await expect(drawer).toBeHidden();
});

test('icon picker is the sole top layer and restores its settings opener', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary').click();
  await folder.locator('.bookmark-summary-row').first().getByRole('button', { name: /Edit YouTube/ }).click();
  const opener = folder.getByRole('button', { name: /Choose icon/ }); await opener.click();
  const picker = page.locator('#icon-modal'); await expect(picker).toBeVisible(); await expect(page.locator('#cfg')).toHaveAttribute('inert', ''); await expectCycles(page, picker);
  await page.keyboard.press('Escape'); await expect(picker).toBeHidden(); await expect(opener).toBeFocused(); await expect(page.locator('#cfg')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#cfg')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('#gear')).toBeFocused();
});

test('quick edit and nested confirmation close one top layer at a time', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const tile = page.locator('#board .tile').first(); await tile.focus(); await page.keyboard.press('Shift+F10');
  await expect(page.locator('#tile-ctx-menu').getByRole('menuitem').first()).toBeFocused(); await page.keyboard.press('Enter');
  const quick = page.locator('#quick-edit-modal'); await expect(quick).toBeVisible(); await expectCycles(page, quick);
  await page.evaluate(() => { window.__confirmResult = confirmDialog({ title: 'Delete bookmark?', message: 'Test nested confirmation' }); });
  const confirm = page.locator('#confirm-modal'); await expect(confirm).toBeVisible(); await expect(confirm).toHaveAttribute('role', 'alertdialog'); await expect(confirm).toHaveAttribute('aria-labelledby', 'confirm-title');
  await expect(quick).toHaveAttribute('inert', ''); await expectCycles(page, confirm);
  await page.keyboard.press('Escape'); await expect(confirm).toBeHidden(); await expect(quick).toBeVisible(); await expect(quick).not.toHaveAttribute('inert', '');
  await page.keyboard.press('Escape'); await expect(quick).toBeHidden(); await expect(tile).toBeFocused();
});
