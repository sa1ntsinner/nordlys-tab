const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The clock ticked every second in a tab nobody could see, and on whatever
   millisecond the page happened to open, so a new second showed up to a
   second late. */
test('the clock turns on the second, rests out of sight, and is right again the moment it is back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const seconds = () => page.evaluate(() => document.getElementById('ss').textContent.replace(/\s/g, '').slice(0, 2));
  // Each turn of the seconds, by where in its second it landed.
  await page.evaluate(() => {
    window.__turns = [];
    new MutationObserver(() => window.__turns.push(Date.now() % 1000)).observe(document.getElementById('ss'), { subtree: true, childList: true, characterData: true });
  });
  await page.waitForFunction(() => window.__turns.length >= 3, null, { timeout: 5000 });
  const late = await page.evaluate(() => window.__turns.slice(1));
  for (const ms of late) expect(ms, 'a new second is shown within a frame or two of it').toBeLessThan(250);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // A figure still turning when the tab went finishes; after that, nothing.
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__turns = []; });
  await page.waitForTimeout(2300);
  expect(await page.evaluate(() => window.__turns.length), 'out of sight, nothing turns').toBe(0);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const now = await page.evaluate(() => String(new Date().getSeconds()).padStart(2, '0'));
  expect([now, String((Number(now) + 59) % 60).padStart(2, '0')]).toContain(await seconds());
  await page.waitForFunction(() => window.__turns.length >= 2, null, { timeout: 3000 });
});
