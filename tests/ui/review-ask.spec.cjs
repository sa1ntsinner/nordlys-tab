/* The review card (review-ask.js): shown once, in a corner, without taking
   the focus, with a link to the store this copy came from. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('the review card asks once, takes no focus, and goes to the store', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const run = () => page.evaluate(() => {
    window.NordlysPlatform.name = 'firefox';
    window.NordlysReviewAsk.run({ delay: 0 });
  });
  await page.evaluate(() => localStorage.setItem('nordlys_review', JSON.stringify({ since: Date.now() - 15 * 86400000, tabs: 29 })));
  await page.locator('#q').focus();
  await run();
  const card = page.getByRole('complementary', { name: 'A few words for Nordlys?' });
  await expect(card).toBeVisible();
  await expect(page.locator('#q')).toBeFocused();
  await expect(card.getByRole('link', { name: 'Write a review' })).toHaveAttribute('href', 'https://addons.mozilla.org/firefox/addon/nordlys/reviews/');
  await card.getByRole('button', { name: 'No, thanks' }).click();
  await expect(card).toHaveCount(0);
  await run();
  await page.waitForTimeout(100);
  await expect(page.locator('.review-ask')).toHaveCount(0);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('nordlys_review'))).done).toBe(true);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});
