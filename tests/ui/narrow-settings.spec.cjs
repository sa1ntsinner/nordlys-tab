const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* At 320px the folder's action row ran straight off both edges of the sheet —
   "Hide" showed as "de", "Rename" as "Renam" — because the row never wrapped. */
test('folder controls stay inside the sheet on a phone-width screen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 320, height: 640 });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await expect(page.locator('#sec-bookmarks')).toBeVisible();
  await page.locator('.bookmark-folder-accordion').first().locator('summary').click();
  await page.waitForTimeout(300);

  const escaped = await page.evaluate(() => {
    // The navigation rail scrolls horizontally on purpose at this width, so the
    // question is only about the section content.
    const body = document.querySelector('#cfg .cbody');
    const sheet = body.getBoundingClientRect();
    return [...body.querySelectorAll('button, .nl-select, input')]
      .filter(node => node.getClientRects().length && !node.closest('[hidden],[inert],[aria-hidden="true"]'))
      .filter(node => {
        const box = node.getBoundingClientRect();
        return box.left < sheet.left - 1 || box.right > sheet.right + 1;
      })
      .map(node => `${(node.getAttribute('aria-label') || node.textContent || node.id).trim().slice(0, 28)}`);
  });
  expect(escaped, 'controls hanging outside the settings sheet').toEqual([]);

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
