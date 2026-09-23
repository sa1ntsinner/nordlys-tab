const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openShare(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await page.locator('#look-share').scrollIntoViewIfNeeded();
}

const A_LOOK = {
  theme: 'gruvbox-dark', bgMode: 'frost', bgSeed: 99, iconShape: 'circle',
  mood: { name: 'Hearth', colors: ['#ffb86c', '#ff5555', '#bd93f9'] }
};

test('Copy puts the look on the clipboard, and it carries no bookmark', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openShare(page);
  await page.locator('#look-copy').click();
  await expect(page.locator('#look-status')).toHaveText('Copied. Paste it anywhere to share it.');
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith('nordlys-look:v1:')).toBe(true);
  const look = await page.evaluate(text => window.NordlysLook.decode(text).look, code);
  expect(look.theme).toBe('aurora-void');
  expect(JSON.stringify(look)).not.toMatch(/YouTube|github\.com|groups/);
});

test('a pasted look is tried on without saving, and put back exactly', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openShare(page);
  const before = await page.evaluate(() => JSON.stringify(window.Nordlys.config));
  const stored = JSON.stringify(nordlysPage.storageState.nordlys_config);
  const code = await page.evaluate(look => window.NordlysLook.encode(look), A_LOOK);

  await page.locator('#look-paste').fill(code);
  await page.locator('#look-try').click();
  await expect(page.locator('#look-decide')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gruvbox-dark');
  expect(await page.evaluate(() => window.Nordlys.bgEngine.mode)).toBe('frost');
  expect(JSON.stringify(nordlysPage.storageState.nordlys_config), 'nothing written while trying').toBe(stored);

  await page.locator('#look-revert').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aurora-void');
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.config))).toBe(before);

  await page.locator('#look-try').click();
  await page.locator('#look-keep').click();
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.theme).toBe('gruvbox-dark');
  expect(nordlysPage.storageState.nordlys_config.bgPalettes.some(mood => mood.name === 'Hearth')).toBe(true);
});

test('closing the panel mid-try puts the old look back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openShare(page);
  await page.locator('#look-paste').fill(await page.evaluate(look => window.NordlysLook.encode(look), A_LOOK));
  await page.locator('#look-try').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gruvbox-dark');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aurora-void');
});

test('something that is not a look is refused and changes nothing', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openShare(page);
  const before = await page.evaluate(() => JSON.stringify(window.Nordlys.config));
  await page.locator('#look-paste').fill('javascript:alert(1)');
  await page.locator('#look-try').click();
  await expect(page.locator('#look-status')).toHaveText("That isn't a Nordlys look.");
  await expect(page.locator('#look-decide')).toBeHidden();
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.config))).toBe(before);
});

test('the picture of a look is a 1200 by 630 image', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openShare(page);
  const download = page.waitForEvent('download');
  await page.locator('#look-picture').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('nordlys-look.png');
  const path = await file.path();
  const size = await page.evaluate(async bytes => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    const image = await createImageBitmap(blob);
    return [image.width, image.height];
  }, [...require('node:fs').readFileSync(path)]);
  expect(size).toEqual([1200, 630]);
});

/* Revert used to put the whole config back as it was when the look was
   tried on, so a bookmark added in the meantime went with it. */
test('reverting a look keeps a bookmark added while it was being tried', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openShare(page);
  await page.locator('#look-paste').fill(await page.evaluate(look => window.NordlysLook.encode(look), A_LOOK));
  await page.locator('#look-try').click();
  await page.evaluate(() => {
    window.Nordlys.config.groups[0].links.push({ name: 'Added mid-try', url: 'https://mid.test/' });
    window.Nordlys.saveConfig();
  });
  await page.locator('#look-revert').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aurora-void');
  const names = config => config.groups[0].links.map(link => link.name);
  expect(names(await page.evaluate(() => window.Nordlys.config))).toContain('Added mid-try');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.theme).toBe('aurora-void');
  expect(names(nordlysPage.storageState.nordlys_config)).toContain('Added mid-try');
});
