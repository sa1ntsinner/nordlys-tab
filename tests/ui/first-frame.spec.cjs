const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The first frame of a new tab is the board. The settings drawer is wired,
   and each icon's contrast against its plate is measured, only after that
   frame is drawn, so neither one holds the board back. */

test('nothing but the board runs before the first frame', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // What had run by the moment the page's start-up finished, which is when
  // window.Nordlys is assigned: everything after that waits for a frame.
  await page.addInitScript(() => {
    let app;
    Object.defineProperty(window, 'Nordlys', {
      configurable: true,
      get: () => app,
      set: (value) => {
        app = value;
        window.__firstFrame = {
          settings: Boolean(value.builtSettings),
          board: document.querySelectorAll('#board .card').length,
          measured: document.querySelectorAll('#board [data-icon-tone]').length
        };
      }
    });
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.builtSettings));
  const first = await page.evaluate(() => window.__firstFrame);
  expect(first.board).toBeGreaterThan(0);
  expect(first.settings).toBe(false);
  expect(first.measured).toBe(0);
});

test('the gear works before the settings are wired', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.addInitScript(() => {
    // Hold back the frame that would wire them, as a slow machine would.
    window.requestAnimationFrame = () => 0;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => Boolean(window.Nordlys.builtSettings))).toBe(false);
  await page.locator('#gear').click();
  await expect(page.locator('body')).toHaveClass(/cfgopen/);
});
