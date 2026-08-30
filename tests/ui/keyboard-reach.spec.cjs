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
    'the folder fold control': item => /hide this folder/i.test(item),
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


/* The grip and the hide button now wait for a pointer to arrive. A control that
   is focusable but invisible is worse than one that is always there, so focus
   has to bring them back — otherwise a keyboard user tabs into nothing. */
test('chrome hidden until hover still appears for a keyboard', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('body').click({ position: { x: 5, y: 5 } });

  const hiddenAtRest = await page.evaluate(() => {
    const grip = document.querySelector('#board .groupGrip');
    return grip ? Number(getComputedStyle(grip).opacity) : null;
  });
  expect(hiddenAtRest, 'the grip should start out of the way').toBeLessThan(0.05);

  await page.locator('#board .groupGrip').first().focus();
  /* Opacity is transitioned, so reading it in the same tick reports the value
     the control is leaving rather than the one it is arriving at. */
  await expect.poll(() => page.evaluate(
    () => Number(getComputedStyle(document.querySelector('#board .groupGrip')).opacity)
  )).toBeGreaterThan(0.5);

  const onFocus = await page.evaluate(() => {
    const grip = document.querySelector('#board .groupGrip');
    const fold = document.querySelector('#board .foldBtn');
    const handle = document.querySelector('#board [role="slider"]');
    return {
      grip: Number(getComputedStyle(grip).opacity),
      fold: Number(getComputedStyle(fold).opacity),
      handle: Number(getComputedStyle(handle).opacity)
    };
  });
  expect(onFocus.grip, 'the focused grip must be visible').toBeGreaterThan(0.5);
  expect(onFocus.fold, 'its neighbours come back with it').toBeGreaterThan(0.2);
  expect(onFocus.handle, 'the resize slider is in the same tab order').toBeGreaterThan(0.2);
});
