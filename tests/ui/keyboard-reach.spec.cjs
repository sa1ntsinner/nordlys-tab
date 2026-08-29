const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function tabThrough(page, presses = 60) {
  const seen = [];
  for (let press = 0; press < presses; press++) {
    await page.keyboard.press('Tab');
    const here = await page.evaluate(() => {
      const node = document.activeElement;
      if (!node || node === document.body) return null;
      return node.id || node.getAttribute('aria-label') || node.className || node.tagName;
    });
    if (here) seen.push(here);
  }
  return seen;
}

/* Everything the canvas offers has to be reachable without a mouse — the tiles,
   the folder controls, the search field and the way into settings. */
test('the canvas can be operated from the keyboard alone', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const reached = await tabThrough(page, 70);

  const wanted = {
    'the search field': item => item === 'q',
    'the search engine switch': item => /engine/i.test(item),
    'a bookmark tile': item => /tile/.test(item),
    'the folder drag handle': item => /Drag folder/i.test(item),
    'the folder fold control': item => /Fold folder/i.test(item),
    'the folder resize slider': item => /Columns for/i.test(item),
    'the settings button': item => item === 'gear'
  };
  const missing = Object.entries(wanted)
    .filter(([, matches]) => !reached.some(matches))
    .map(([name]) => name);
  expect(missing, `never reached by Tab: ${missing.join(', ')}`).toEqual([]);
});

/* Focus must not be able to leave the page into browser chrome and strand the
   user mid-task while a folder is folded away in the dock. */
test('a folded folder stays reachable from the keyboard', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#board > .card').first().locator('.foldBtn').click();
  await page.waitForTimeout(360);
  await expect(page.locator('#hiddenDock')).toBeVisible();

  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const reached = await tabThrough(page, 70);
  expect(reached.some(item => /restore|hidden|dock/i.test(item)), 'the dock chip was never reached by Tab').toBe(true);
});
