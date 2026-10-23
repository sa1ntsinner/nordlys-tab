const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* A site the focus timer card lists is kept shut while a focus runs: the
   worker sends its tab to blocked.html (tested in tests/unit/worker.test.cjs),
   which says until when and goes on to the site by itself once no focus
   runs. The site is stood in for with page.route. */

const site = (page) => page.route(/^https:\/\/(www\.)?shut\.test\//, route => route.fulfill({ contentType: 'text/html', body: '<title>the site itself</title>' }));
const timerIs = (page, timer) => page.evaluate((timer) => new Promise((resolve) => chrome.storage.local.set({ 'nordlys_dash.focus-timer': timer }, resolve)), timer);

test('the quiet page says until when, and goes on to the site when the focus ends', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await site(page);
  await timerIs(page, { running: true, phase: 'focus', endsAt: Date.now() + 3000 });
  await page.goto(`${origin}/blocked.html?u=${encodeURIComponent('https://www.shut.test/watch?v=1')}`);
  await expect(page.locator('h1')).toHaveText('Kept shut while you focus');
  await expect(page.locator('#shut-said')).toHaveText(/^shut\.test opens at .+, when this focus ends\.$/);
  await page.waitForURL('https://www.shut.test/watch?v=1', { timeout: 8000 });
});

test('the timer card keeps the list, and asks to see the tabs from the click that sets it', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.evaluate(async () => {
    window.__tabs = { grantOnRequest: true };
    const d = window.Nordlys.dashboard;
    d.setOn(true);
    d.add('timer');
    await d.render();
    d.openSettings(d.widgets().find((widget) => widget.type === 'timer'));
  });
  await page.getByRole('textbox', { name: 'Sites kept shut while focusing' }).fill('youtube.com\nreddit.com');
  await page.locator('.dash-dialog').getByRole('button', { name: 'Save' }).click();
  expect(await page.evaluate(() => [window.__tabs.granted, window.Nordlys.dashboard.widgets().find((widget) => widget.type === 'timer').settings.shut])).toEqual([true, 'youtube.com\nreddit.com']);
  expect(runtimeErrors).toEqual([]);
});

test('with no focus running, it goes straight on; it never goes anywhere but the web', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await site(page);
  await timerIs(page, { running: false, phase: 'focus', endsAt: Date.now() + 60000 });
  await page.goto(`${origin}/blocked.html?u=${encodeURIComponent('https://shut.test/')}`);
  await page.waitForURL('https://shut.test/');
  await page.goto(`${origin}/blocked.html?u=${encodeURIComponent('javascript:alert(1)')}`);
  await expect(page.locator('h1')).toHaveText('Kept shut while you focus');
  expect(page.url()).toContain('/blocked.html');
});
