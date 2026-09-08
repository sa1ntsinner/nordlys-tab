const { test, expect } = require('@playwright/test');
const { launchExtension } = require('../helpers/real-extension.cjs');

/* Behaviour that only the real extension can prove. Each test here is the
   user's own gesture — typing, pressing a key, choosing a file — followed by
   what they would see, under the product's actual content security policy and
   its actual storage. */

test.describe.configure({ mode: 'serial' });

let ext;
test.beforeEach(async () => { ext = await launchExtension(); });
test.afterEach(async () => { await ext?.close(); });

test('arithmetic typed into the search box gets its answer under the real CSP', async () => {
  const { page } = ext;
  await page.locator('#q').click();
  await page.keyboard.type('45 * 12 + sqrt(144)');
  await expect(page.locator('#sugg .sugg-calc .calc-val')).toHaveText('45 * 12 + sqrt(144) = 552');

  await page.locator('#q').fill('');
  await page.keyboard.type('2+2');
  await expect(page.locator('#sugg .sugg-calc .calc-val')).toHaveText('2+2 = 4');

  expect(await ext.violations(), 'nothing was blocked by the policy on the way').toEqual([]);
  expect(ext.errors.filter(text => /content security policy|unsafe-eval/i.test(text))).toEqual([]);
});

test('Enter on Cancel leaves everything in place in the real dialog', async () => {
  const { page } = ext;
  const before = await page.evaluate(() => window.Nordlys.config.groups.length);
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Bookmarks' }).click();
  await page.locator('.bookmark-folder-accordion').first()
    .locator('.bookmark-folder-head').getByRole('button', { name: /More actions for/ }).click();
  await page.locator('.nl-overflow-menu').getByRole('menuitem', { name: 'Delete folder' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.Nordlys.config.groups.length)).toBe(before);
});
