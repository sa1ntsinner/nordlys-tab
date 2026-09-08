const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The product says nothing leaves the machine unless asked. Opening the icon
   picker used to disprove that at once: it built a Google favicon URL for the
   bookmark and loaded it before the person had chosen anything — they might
   have wanted the built-in icon and never touched the website tab. And when
   that image failed, the page quietly asked DuckDuckGo instead.

   Now: opening the picker reaches nothing. The website-icon tab reads from the
   browser's own favicon cache, which is local. A remote provider is contacted
   only when its chip is pressed. */

function watchOutbound(page, origin) {
  const outbound = [];
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) outbound.push(url);
  });
  // Nothing in these tests may actually reach the network.
  return outbound;
}

async function openPickerForFirstBookmark(page) {
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await expect(page.locator('#icon-modal')).toBeVisible();
}

test('opening the icon picker contacts nobody', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const outbound = watchOutbound(page, origin);
  await openPickerForFirstBookmark(page);
  await page.waitForTimeout(600);
  expect(outbound, 'no request may leave the page just because the picker opened').toEqual([]);
});

test('the website-icon tab reads the browser cache, not a remote service', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const outbound = watchOutbound(page, origin);
  await openPickerForFirstBookmark(page);
  await page.locator('.icon-tab-btn[data-tab="favicon"]').click();
  await page.waitForTimeout(600);
  expect(outbound, 'the local cache is not a network request').toEqual([]);
  await expect(page.locator('.icon-chip[data-fav-source="chrome"]'), 'the browser cache is the default source').toHaveClass(/active/);
  const preview = page.locator('#favicon-preview-img-box img');
  await expect(preview).toHaveAttribute('src', /_favicon\//);
});

test('a remote provider is contacted only when its chip is pressed', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await page.route('https://www.google.com/**', route => route.abort());
  await page.route('https://icons.duckduckgo.com/**', route => route.abort());
  const outbound = watchOutbound(page, origin);
  await openPickerForFirstBookmark(page);
  await page.locator('.icon-tab-btn[data-tab="favicon"]').click();
  await page.locator('.favicon-sources summary').click();
  await page.locator('.icon-chip[data-fav-source="google"]').click();
  await expect.poll(() => outbound.some(url => url.startsWith('https://www.google.com/s2/favicons')), 'pressing Google asks Google').toBe(true);
  // And a failure there does not silently try the next provider.
  await page.waitForTimeout(600);
  expect(outbound.some(url => url.includes('duckduckgo.com')), 'DuckDuckGo is not asked unless chosen').toBe(false);
});
