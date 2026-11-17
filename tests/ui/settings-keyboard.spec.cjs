const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The drawer walks Tab itself (ui-primitives.js), and its list of stops left
   out the headings of the sections that open: Typography, Check the
   bookmarks, Settings as text. What was folded away could be opened with a
   pointer and by nothing else. */

async function tabUntil(page, selector, limit = 80) {
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(sel => Boolean(document.activeElement?.matches(sel)), selector)) return true;
  }
  return false;
}

test('a folded section in Settings is reached with Tab, opened with Enter, and what is in it is reached next', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  expect(await tabUntil(page, '#backup-text > summary'), 'the heading is a stop').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#backup-text')).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#backup-text')) && document.activeElement.tagName !== 'SUMMARY'), 'and its contents come after it').toBe(true);
  // Back out the way it came.
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement?.matches('#backup-text > summary'))).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test('what is inside a folded section is not a stop while it is folded', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  expect(await tabUntil(page, '#backup-text > summary')).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#backup-text')))).toBe(false);
});
