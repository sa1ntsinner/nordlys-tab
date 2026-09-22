const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openPicker(page) {
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await expect(page.locator('#icon-modal')).toBeVisible();
}

function watchOutbound(page, origin) {
  const outbound = [];
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) outbound.push(url);
  });
  return outbound;
}

test('the picker starts with intentional online discovery without contacting anyone', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const outbound = watchOutbound(page, origin);
  await openPicker(page);
  await expect(page.locator('.icon-tab-btn[data-tab="search"]')).toHaveClass(/active/);
  await expect(page.locator('#icon-search')).toBeFocused();
  await expect(page.locator('.icon-category-chips')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(outbound).toEqual([]);
});

test('an explicit search stores a self-contained vector instead of a remote dependency', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const outbound = watchOutbound(page, origin);
  await page.route('https://api.iconify.design/search?**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ icons: ['simple-icons:github'], total: 1 })
  }));
  await page.route('https://api.iconify.design/simple-icons.json?**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ prefix: 'simple-icons', width: 24, height: 24, icons: {
      github: { body: '<path d="M12 2L22 22H2Z"/>' }
    } })
  }));

  await openPicker(page);
  await page.locator('#icon-search').fill('GitHub');
  await page.locator('#icon-search-btn').click();
  await expect(page.locator('#modal-icon-grid .icon-item')).toHaveCount(1);
  await page.locator('#modal-icon-grid .icon-item').click();

  const icon = await page.evaluate(() => window.Nordlys.config.groups[0].links[0]);
  expect(icon.customImg).toMatch(/^data:image\/svg\+xml/);
  expect(icon.customImg).toContain('%3Csvg');
  expect(icon.icon).toBeUndefined();
  await expect(page.locator('#icon-modal')).not.toBeVisible();
  expect(outbound.every(url => url.startsWith('https://api.iconify.design/'))).toBe(true);
});

test('a failed search explains what to do and leaves the bookmark unchanged', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.iconify.design/search?**', route => route.fulfill({ status: 503, body: 'down' }));
  await openPicker(page);
  const before = await page.evaluate(() => JSON.stringify(window.Nordlys.config.groups[0].links[0]));
  await page.locator('#icon-search').fill('Nordlys');
  await page.locator('#icon-search-btn').click();
  await expect(page.locator('#icon-search-status')).toContainText('Try again');
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.config.groups[0].links[0]))).toBe(before);
});
