const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { openIconPicker } = require('../helpers/flows.cjs');

/* An icon taken from a web address kept the picture and forgot the address:
   the next time the picker opened, the field was empty. The address is kept
   now, and so are the last few, each shown by the picture it gave. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHUlEQVR42mNkYPhfz0AEYBxVSF+FjKMKRxWSrhAAhm0f8Uq+1cQAAAAASUVORK5CYII=', 'base64');

/* The first time through the real path; after that the drawer has been
   redrawn under the editor, so the picker is reopened the way the editor does. */
async function openCustomPane(page) {
  if (!(await page.evaluate(() => document.body.classList.contains('cfgopen')))) {
    await page.locator('#gear').click();
    await page.locator('#settings-tab-bookmarks').click();
    const folder = page.locator('.bookmark-folder-accordion').first();
    await folder.locator('summary').click();
    await openIconPicker(page, folder);
  } else {
    await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  }
  await expect(page.locator('#icon-modal')).toBeVisible();
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await expect(page.locator('#modal-pane-custom')).toBeVisible();
}

async function useAddress(page, address) {
  await page.locator('#icon-url-input').fill(address);
  await page.locator('#icon-url-input').press('Enter');
  await expect(page.locator('#icon-url-status')).toHaveText('Image ready');
  await page.locator('#icon-url-apply-btn').click();
  await expect(page.locator('#icon-modal')).toBeHidden();
}

const link = page => page.evaluate(() => {
  const { iconUrl, iconUrls = [], customImg } = window.Nordlys.config.groups[0].links[0];
  return { iconUrl, urls: iconUrls.map(entry => entry.url), thumbs: iconUrls.map(entry => entry.thumb), customImg };
});

test.beforeEach(async ({ nordlysPage }) => {
  await nordlysPage.page.route('https://icons.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
});

test('the address an icon came from is there when the picker opens again', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCustomPane(page);
  await useAddress(page, 'https://icons.test/one.png');
  const saved = await link(page);
  expect(saved.iconUrl).toBe('https://icons.test/one.png');
  expect(saved.customImg).toMatch(/^data:image\//);
  expect(saved.thumbs[0]).toMatch(/^data:image\/(webp|png);base64,/);

  await openCustomPane(page);
  await expect(page.locator('#icon-url-input')).toHaveValue('https://icons.test/one.png');
  await expect(page.locator('#icon-url-status')).toHaveText('In use, from this address');
  const versions = page.locator('.icon-url-version');
  await expect(versions).toHaveCount(1);
  await expect(versions.first()).toHaveClass(/is-current/);
});

test('earlier addresses stay as versions to go back to, remove or change', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCustomPane(page);
  await useAddress(page, 'https://icons.test/one.png');
  await openCustomPane(page);
  await useAddress(page, 'https://icons.test/two.png');
  expect((await link(page)).urls).toEqual(['https://icons.test/two.png', 'https://icons.test/one.png']);

  // Going back to an earlier one previews it, and using it brings it to the front.
  await openCustomPane(page);
  const older = page.locator('.icon-url-version[data-url="https://icons.test/one.png"]');
  await older.locator('.icon-url-pick').click();
  await expect(page.locator('#icon-url-input')).toHaveValue('https://icons.test/one.png');
  await expect(page.locator('#icon-url-status')).toHaveText('Image ready');
  await page.locator('#icon-url-apply-btn').click();
  expect((await link(page)).urls).toEqual(['https://icons.test/one.png', 'https://icons.test/two.png']);

  // Removing one leaves the tile's icon alone and can be undone.
  await openCustomPane(page);
  const before = (await link(page)).customImg;
  const two = page.locator('.icon-url-version[data-url="https://icons.test/two.png"]');
  await two.hover();
  await two.locator('[data-tool="remove"]').click();
  await expect(two).toHaveCount(0);
  expect((await link(page)).urls).toEqual(['https://icons.test/one.png']);
  expect((await link(page)).customImg).toBe(before);
  await page.locator('#toast-dock .toast-action').last().click();
  await expect(page.locator('.icon-url-version')).toHaveCount(2);
  expect((await link(page)).urls).toEqual(['https://icons.test/one.png', 'https://icons.test/two.png']);

  // Changing one puts the new address where the old one was.
  const restored = page.locator('.icon-url-version[data-url="https://icons.test/two.png"]');
  await restored.hover();
  await restored.locator('[data-tool="edit"]').click();
  await expect(page.locator('#icon-url-editing')).toBeVisible();
  await expect(page.locator('#icon-url-input')).toBeFocused();
  await useAddress(page, 'https://icons.test/three.png');
  expect((await link(page)).urls).toEqual(['https://icons.test/three.png', 'https://icons.test/one.png']);
});

test('the versions are one stop for the keyboard, walked with the arrows', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCustomPane(page);
  await useAddress(page, 'https://icons.test/one.png');
  await openCustomPane(page);
  await useAddress(page, 'https://icons.test/two.png');
  await openCustomPane(page);
  const picks = page.locator('.icon-url-pick');
  await expect(picks).toHaveCount(2);
  expect(await picks.evaluateAll(nodes => nodes.map(node => node.tabIndex))).toEqual([0, -1]);
  await picks.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(picks.nth(1)).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(page.locator('.icon-url-version')).toHaveCount(1);
  await expect(picks.first()).toBeFocused();
});

test('another kind of icon stops claiming an address but keeps the list', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCustomPane(page);
  await useAddress(page, 'https://icons.test/one.png');
  await openCustomPane(page);
  await page.locator('#icon-monogram-apply-btn').click();
  const after = await link(page);
  expect(after.iconUrl).toBeUndefined();
  expect(after.urls).toEqual(['https://icons.test/one.png']);
  await openCustomPane(page);
  await expect(page.locator('#icon-url-input')).toHaveValue('');
  await expect(page.locator('.icon-url-version.is-current')).toHaveCount(0);
});
