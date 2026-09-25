const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');

/* One page fit (src/js/page-fit.js) with scrollbars that take room.
   Headless Chromium hides scrollbars; Chrome on Windows draws ones that take
   width. Measuring a page taller than the window would narrow the board
   being measured by a scrollbar, and cost a layout each time it came and
   went. Its own file: a browser launched with scrollbars is a worker of its
   own, which Playwright only allows at the top of a file. */

test.use({
  nordlysBoard: { ...NINE_FOLDERS, onePageFit: true },
  viewport: { width: 1536, height: 864 },
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }
});

test('the fit measures at the full width, and leaves the page free to scroll', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.waitForFunction(() => {
    const fit = window.Nordlys?.pageFit;
    return fit && !fit.frame && !fit.timer && !fit.fitting && fit.state.room === 864;
  });
  // This window does draw a scrollbar: off, the page is taller and narrower.
  const off = await page.evaluate(() => {
    window.Nordlys.config.onePageFit = false;
    window.Nordlys.pageFit.request({ now: true });
    return { client: document.documentElement.clientWidth, full: innerWidth };
  });
  expect(off.client).toBeLessThan(off.full);
  const widths = await page.evaluate(() => {
    const fit = window.Nordlys.pageFit;
    window.Nordlys.config.onePageFit = true;
    localStorage.removeItem(window.NordlysPageFit.HINT_STORE);
    fit.remembered = null;
    const seen = [];
    const need = fit.need.bind(fit);
    fit.need = () => { seen.push(document.documentElement.clientWidth); return need(); };
    fit.request({ now: true });
    fit.need = need;
    return [...new Set(seen)];
  });
  expect(widths, 'every trial measured without a scrollbar').toEqual([off.full]);
  const after = await page.evaluate(() => ({
    stage: window.Nordlys.pageFit.state.stage,
    holding: document.documentElement.hasAttribute('data-fit-measuring'),
    overflow: getComputedStyle(document.body).overflowY,
    scroll: document.scrollingElement.scrollHeight, client: document.scrollingElement.clientHeight,
    width: document.documentElement.clientWidth
  }));
  expect(after.stage).toBe('compact');
  // Nothing is held once the pass is over: a page taller than this would scroll.
  expect({ holding: after.holding, overflow: after.overflow }).toEqual({ holding: false, overflow: 'auto' });
  expect(after.scroll).toBeLessThanOrEqual(after.client);
  expect(after.width).toBe(off.full);
  expect(runtimeErrors).toEqual([]);
});
