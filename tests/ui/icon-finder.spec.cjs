const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { png, svg, pretendInternet, catalogues, SILENT } = require('../helpers/icon-network.cjs');

/* The icon dialog is one field. A name or a link goes in; the finder looks
   in the open brand sets, in Wikidata and, for a link, on the site itself,
   and puts the best mark on the tile. Every test here runs against a pretend
   internet, so what is asked of whom is part of what is asserted. */

const link = (page, at = 0) => page.evaluate(index => window.Nordlys.config.groups[0].links[index], at);

async function openDialog(page, at = 0) {
  await page.evaluate(index => window.Nordlys.settings.openIconModal(0, index), at);
  await expect(page.locator('#icon-modal')).toBeVisible();
}

async function find(page, text) {
  await page.locator('#icon-find').fill(text);
  await page.locator('#icon-find').press('Enter');
}

const hostsOf = (asked) => [...new Set(asked.map(url => new URL(url).host))].sort();

test('opening the dialog and typing in it ask nobody anything', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const asked = await pretendInternet(page, origin);
  await openDialog(page);
  await expect(page.locator('#icon-find')).toBeFocused();
  await expect(page.locator('#icon-find')).toHaveValue('YouTube');
  await page.locator('#icon-find').fill('https://example.org');
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);
  // One field, and none of the old ways in.
  await expect(page.locator('#icon-modal [role="tab"]')).toHaveCount(0);
  await expect(page.locator('#icon-view-find input:not([type="file"])')).toHaveCount(1);
});

test('a name finds the brand mark, puts it on the tile and offers the others', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const asked = await pretendInternet(page, origin, catalogues());
  const before = await link(page);
  await openDialog(page);
  await find(page, 'Spotify');

  // The best one is applied without another press: the colour mark from the open set.
  await expect.poll(async () => (await link(page)).iconSource).toBe('logos:spotify-icon');
  const chosen = await link(page);
  expect(chosen.customImg).toMatch(/^data:image\/svg\+xml/);
  expect(chosen.icon).toBeUndefined();
  await expect(page.locator('.tile').first().locator('img')).toHaveAttribute('src', chosen.customImg);

  // Then the others, and last the icon the tile had.
  const choices = page.locator('#icon-choices [role="radio"]');
  await expect(choices).toHaveCount(4);
  await expect(choices.nth(0)).toHaveAttribute('aria-checked', 'true');
  await choices.nth(1).click();
  await expect.poll(async () => (await link(page)).iconSource).toBe('wikimedia:Brand icon.svg');
  await choices.last().click();
  expect(await link(page)).toEqual(before);

  // A name is sent to the two catalogues and to nobody else; the bookmark's own site is not touched.
  expect(hostsOf(asked)).toEqual(['api.iconify.design', 'cdn.simpleicons.org', 'commons.wikimedia.org', 'query.wikidata.org', 'upload.wikimedia.org', 'www.wikidata.org']);
  expect(asked.some(url => /user|bookmark|youtube/i.test(url))).toBe(false);
});

test('the choices are walked with the arrows', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await pretendInternet(page, origin, catalogues());
  await openDialog(page);
  await find(page, 'Spotify');
  const choices = page.locator('#icon-choices [role="radio"]');
  await expect(choices).toHaveCount(4);
  await choices.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(choices.nth(1)).toBeFocused();
  await expect(choices.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#icon-choices [tabindex="0"]')).toHaveCount(1);
});

test('a link reads the site and prefers its vector over its pictures', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const asked = await pretendInternet(page, origin, {
    ...SILENT,
    'https://brand.test/': `<!doctype html><html><head>
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
      <link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
      <link rel="icon" type="image/svg+xml" href="/mark.svg">
      <meta property="og:image" content="https://brand.test/share.png">
    </head><body><header><a href="/"><img class="site-logo" src="/wordmark.svg" alt="Brand logo"></a></header></body></html>`,
    'brand.test/mark.svg': svg('#7c3aed'),
    'brand.test/wordmark.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 80" width="400" height="80"><rect width="400" height="80" fill="#111"/></svg>',
    'brand.test/favicon-32.png': png(32),
    'brand.test/touch.png': png(180, [20, 20, 20], { plate: true }),
    'brand.test/share.png': png(64, [0, 0, 200], { plate: true })
  });
  await openDialog(page);
  await find(page, 'https://brand.test/');
  await expect.poll(async () => (await link(page)).customImg || '').toMatch(/^data:image\/svg\+xml/);
  const chosen = await link(page);
  expect(decodeURIComponent(atob(chosen.customImg.split(',')[1] || '') || chosen.customImg)).toContain('#7c3aed');
  // Where it came from is kept with the bookmark.
  expect(chosen.iconUrl).toBe('https://brand.test/mark.svg');
  // Leave was asked for that one site, in the press itself.
  expect(await page.evaluate(() => window.__origins.asked)).toEqual(['https://brand.test/*']);
  // The wordmark is too wide to be an icon and is not offered.
  expect(await page.locator('#icon-choices [role="radio"]').count()).toBeLessThanOrEqual(5);
  expect(asked.some(url => url.includes('wordmark.svg'))).toBe(true);
});

test('a clear picture is taken over a larger one on an opaque plate', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await pretendInternet(page, origin, {
    ...SILENT,
    'https://plate.test/': `<!doctype html><html><head>
      <link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
      <link rel="icon" type="image/png" sizes="96x96" href="/clear.png">
    </head><body></body></html>`,
    'plate.test/touch.png': png(180, [200, 30, 30], { plate: true }),
    'plate.test/clear.png': png(96, [30, 160, 60])
  });
  await openDialog(page);
  await find(page, 'plate.test');
  await expect.poll(async () => (await link(page)).iconUrl).toBe('https://plate.test/clear.png');
  // The plate is still there to choose, after the clear one.
  await expect(page.locator('#icon-choices [role="radio"]')).toHaveCount(3);
});

test('a site with nothing but a favicon gives the favicon', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await pretendInternet(page, origin, {
    ...SILENT,
    'https://small.test/': '<!doctype html><html><head><title>Small</title><link rel="shortcut icon" href="/tiny.png"></head><body></body></html>',
    'small.test/tiny.png': png(16, [40, 90, 200])
  });
  await openDialog(page);
  await find(page, 'https://small.test/');
  await expect.poll(async () => (await link(page)).iconUrl).toBe('https://small.test/tiny.png');
  expect((await link(page)).customImg).toMatch(/^data:image\//);
});

test('the address of a picture is taken as it is', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const asked = await pretendInternet(page, origin, { 'pictures.test/wide.png': png(128, [10, 120, 200]) });
  await openDialog(page);
  await find(page, 'https://pictures.test/wide.png');
  await expect.poll(async () => (await link(page)).iconUrl).toBe('https://pictures.test/wide.png');
  expect(hostsOf(asked)).toEqual(['pictures.test']);
});

test('leave refused: the site is never read, the catalogues still answer, and the dialog says so', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await page.evaluate(() => { window.__origins = { grant: false }; });
  const asked = await pretendInternet(page, origin, { ...catalogues({ slug: 'brand' }), 'https://brand.test/': '<html></html>' });
  await openDialog(page);
  await page.locator('#icon-find').fill('https://brand.test/');
  // Before the press, one sentence says the browser will ask.
  await expect(page.locator('#icon-find-status')).toContainText('brand.test');
  await page.locator('#icon-find').press('Enter');
  await expect.poll(async () => (await link(page)).iconSource).toBe('logos:brand-icon');
  await expect(page.locator('#icon-find-status')).toContainText('not allowed');
  expect(asked.some(url => url.startsWith('https://brand.test'))).toBe(false);
});

test('leave refused and no catalogue knows it: nothing changes, and the reason is given', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await page.evaluate(() => { window.__origins = { grant: false }; });
  await pretendInternet(page, origin, SILENT);
  const before = await link(page);
  await openDialog(page);
  await find(page, 'https://unknown.test/');
  await expect(page.locator('#icon-find-status')).toContainText('not allowed to read unknown.test');
  expect(await link(page)).toEqual(before);
  await expect(page.locator('#icon-choices')).toBeHidden();
});

test('offline: the icon stays and the dialog says there is no connection', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await pretendInternet(page, origin, { '': 'offline' });
  const before = await link(page);
  await openDialog(page);
  await find(page, 'Spotify');
  await expect(page.locator('#icon-find-status')).toContainText('No connection');
  expect(await link(page)).toEqual(before);
  await expect(page.locator('#icon-find-btn')).not.toHaveAttribute('aria-busy', 'true');
});

test('a name nobody knows offers the bookmark\'s own site as the next place to look', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await pretendInternet(page, origin, {
    ...SILENT,
    'https://www.youtube.com/': '<!doctype html><html><head><link rel="icon" type="image/svg+xml" href="/yt.svg"></head><body></body></html>',
    'www.youtube.com/yt.svg': svg('#ff0000')
  });
  await openDialog(page);
  await find(page, 'My videos');
  await expect(page.locator('#icon-find-status')).toContainText('Nothing found for “My videos”');
  const next = page.locator('#icon-find-site');
  await expect(next).toHaveText('Look on youtube.com');
  await next.click();
  await expect.poll(async () => (await link(page)).iconUrl).toBe('https://www.youtube.com/yt.svg');
});

test('an icon chosen from the old library keeps drawing, and comes back with one press', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await pretendInternet(page, origin, catalogues());
  // The demo board's first bookmark carries a key into the library that shipped before.
  expect((await link(page)).icon).toBe('youtube');
  await expect(page.locator('.tile').first().locator('.nl-icon[data-icon-kind="builtin"] svg path')).toHaveCount(1);
  await openDialog(page);
  await expect(page.locator('#icon-live-preview .nl-icon[data-icon-kind="builtin"]')).toHaveCount(1);
  await find(page, 'Spotify');
  await expect(page.locator('#icon-live-preview .nl-icon[data-icon-kind="raster"]')).toHaveCount(1);
  await page.locator('#icon-choices .is-before').click();
  await expect(page.locator('.tile').first().locator('.nl-icon[data-icon-kind="builtin"]')).toHaveCount(1);
});

test('letters: what is typed, when it is short, otherwise the first letter of the name', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const asked = await pretendInternet(page, origin);
  await openDialog(page);
  await page.locator('#icon-letters').click();
  expect((await link(page)).monogram).toBe('Y');
  await page.locator('#icon-find').fill('yt');
  await page.locator('#icon-letters').click();
  const lettered = await link(page);
  expect([lettered.monogram, lettered.customImg, lettered.icon]).toEqual(['YT', undefined, undefined]);
  await expect(page.locator('#icon-live-preview .mono')).toHaveText('YT');
  expect(asked).toEqual([]);
});

test('Escape closes the dialog and gives focus back; what was applied stays', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await pretendInternet(page, origin, catalogues());
  await page.locator('.tile').first().focus();
  await openDialog(page);
  await find(page, 'Spotify');
  await expect.poll(async () => (await link(page)).iconSource).toBe('logos:spotify-icon');
  await page.keyboard.press('Escape');
  await expect(page.locator('#icon-modal')).toBeHidden();
  expect((await link(page)).iconSource).toBe('logos:spotify-icon');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).groups[0].links[0].iconSource);
  expect(stored).toBe('logos:spotify-icon');
});
