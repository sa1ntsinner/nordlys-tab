const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Wanting less on screen used to mean writing Custom CSS, which is a strange
   price for a start page whose whole argument is that it stays out of the way. */

async function setHeader(page, value) {
  await page.locator('#cfg-header-style').evaluate((select, choice) => {
    select.value = choice;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('the header can be full, compact or gone', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').click();

  const clock = page.locator('#clock');
  const date = page.locator('#date');
  const greet = page.locator('#greet');

  await expect(clock).toBeVisible();
  await expect(greet).toBeVisible();

  await setHeader(page, 'compact');
  await expect(clock).toBeVisible();
  await expect(date).toBeVisible();
  await expect(greet).toBeHidden();

  await setHeader(page, 'hidden');
  await expect(page.locator('#hero')).toBeHidden();

  await setHeader(page, 'full');
  await expect(greet).toBeVisible();
});

test('the choice survives a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').click();
  await setHeader(page, 'hidden');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.headerStyle).toBe('hidden');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('#hero')).toBeHidden();
  // The board is what remains, and it must still be there.
  await expect(page.locator('#board .tile').first()).toBeVisible();
});
