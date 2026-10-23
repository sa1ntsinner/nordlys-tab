/* Backup → Settings as text: the settings to read, change or paste in, and
   to read from a web address. Applied as a backup file is, so the setup it
   replaces is kept and a file that is wrong is refused with its reasons. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openText(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await page.locator('#backup-text summary').click();
  // Filled on the toggle event, which comes a moment after the opening.
  await expect(page.locator('#cfg-text')).not.toHaveValue('');
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')));

test('the settings are shown as text, and the changed text applies with the old setup kept', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.customCss = '#clock { letter-spacing: 1px; }'; window.Nordlys.saveConfig(); });
  await openText(page);
  const shown = JSON.parse(await page.locator('#cfg-text').inputValue());
  expect(shown.groups.length).toBeGreaterThan(0);
  shown.userName = 'Ada';
  await page.locator('#cfg-text').fill(JSON.stringify(shown, null, 2));
  await Promise.all([page.waitForEvent('load'), page.locator('#cfg-text-apply').click()]);
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  const after = await stored(page);
  expect(after.userName).toBe('Ada');
  expect(after.customCss, 'its own CSS is not new code to read first').toBe('#clock { letter-spacing: 1px; }');
  const point = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point')));
  expect(point.config.groups.length, 'the setup it replaced is kept').toBe(shown.groups.length);
  expect(point.config.userName).not.toBe('Ada');
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('text that is not settings is refused, with the reason, and nothing changes', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await stored(page);
  await openText(page);
  await page.locator('#cfg-text').fill('{ "groups": ');
  await page.locator('#cfg-text-apply').click();
  await expect(page.locator('#cfg-text')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#toast-dock')).toContainText('Import failed');
  await page.locator('#cfg-text').fill('{ "groups": {} }');
  await page.locator('#cfg-text-apply').click();
  await expect(page.locator('#toast-dock')).toContainText('groups should be a list');
  expect(await stored(page)).toEqual(before);
  // Opened again, what was typed and not applied is still there to fix.
  await page.locator('#backup-text summary').click();
  await page.locator('#backup-text summary').click();
  await expect(page.locator('#cfg-text')).toHaveValue('{ "groups": {} }');
});

test('settings are read from an https address once the browser gives leave, and wait to be applied', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const team = { userName: 'Team', groups: [{ label: 'Team', links: [{ name: 'Wiki', url: 'https://wiki.example/' }] }] };
  const asked = [];
  await page.route('https://files.example/**', (route) => {
    asked.push(route.request().url());
    return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(team) });
  });
  const before = await stored(page);
  await openText(page);
  await page.locator('#cfg-url').fill('http://files.example/team.json');
  await page.locator('#cfg-url-load').click();
  await expect(page.locator('#cfg-url')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#toast-dock')).toContainText('https://');

  await page.evaluate(() => { window.__origins = { grant: false }; });
  await page.locator('#cfg-url').fill('https://files.example/team.json');
  await page.locator('#cfg-url').press('Enter');
  await expect(page.locator('#toast-dock')).toContainText('cannot be read');
  expect(asked).toEqual([]);

  await page.evaluate(() => { window.__origins.grant = true; });
  await page.locator('#cfg-url-load').click();
  await expect(page.locator('#cfg-text')).toHaveValue(JSON.stringify(team, null, 2));
  expect(asked).toEqual(['https://files.example/team.json']);
  expect(await page.evaluate(() => window.__origins.asked)).toEqual(['https://files.example/*', 'https://files.example/*']);
  expect(await stored(page), 'nothing changes until it is applied').toEqual(before);

  await Promise.all([page.waitForEvent('load'), page.locator('#cfg-text-apply').click()]);
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect((await stored(page)).groups.map((group) => group.label)).toEqual(['Team']);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});
