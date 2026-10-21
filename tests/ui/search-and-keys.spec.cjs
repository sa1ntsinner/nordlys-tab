const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The search box can be turned off and still opens from the keyboard; the
   last searches can be forgotten for good; ? shows the shortcuts. */

async function openGeneral(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').click();
}

test('a hidden search box still opens with / and Ctrl+K, and hides again', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openGeneral(page);
  await page.locator('#cfg-show-search').evaluate(box => { box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.keyboard.press('Escape');
  await expect(page.locator('#searchwrap')).toBeHidden();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  await expect(page.locator('#q')).toBeFocused();
  await expect(page.locator('#searchwrap')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#searchwrap')).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#q')).toBeFocused();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('#searchwrap')).toBeHidden();
});

test('with Remember recent searches off, nothing is kept and the old ones are gone', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => localStorage.setItem('nordlys_search_history', JSON.stringify(['old search'])));
  await openGeneral(page);
  await page.locator('#cfg-remember-searches').evaluate(box => { box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(await page.evaluate(() => localStorage.getItem('nordlys_search_history'))).toBeNull();
  await page.evaluate(() => window.Nordlys.widgets.search.saveSearchHistory('kept nowhere'));
  expect(await page.evaluate(() => localStorage.getItem('nordlys_search_history'))).toBeNull();
});

test('? shows the keyboard shortcuts, and Escape puts focus back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#board .tile').first().focus();
  await page.keyboard.press('Shift+Slash');
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Open or close settings');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('#board .tile').first()).toBeFocused();
  // Typed into the search box, ? is only a character.
  await page.locator('#q').focus();
  await page.keyboard.type('what?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
});
