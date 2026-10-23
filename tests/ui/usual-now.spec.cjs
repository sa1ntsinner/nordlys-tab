const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The empty search box offers what is usually opened at this hour: counted
   from the bookmarks opened on the board, kept on this device only, and
   forgotten when the setting is turned off (search-sources.js, widgets.js). */

test('the empty search box offers what is usually opened now, and forgets it when told to', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups = [{ label: 'Morning', cols: 3, hidden: false, links: [{ name: 'Standup', url: 'https://standup.test/' }, { name: 'Mail', url: 'https://mail.test/' }] }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
    localStorage.removeItem('nordlys_search_history');
  });
  // Three opens of Standup in this hour, one of Mail: a middle click each, the way a tile is opened in the background.
  const open = (name) => page.locator('#board .tile', { hasText: name }).dispatchEvent('auxclick', { button: 1 });
  for (let i = 0; i < 3; i++) await open('Standup');
  await open('Mail');
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('nordlys_rhythm')).urls))).toEqual(['https://standup.test/', 'https://mail.test/']);

  await page.locator('#q').focus();
  const usual = page.locator('#sugg .sugg-usual');
  await expect(usual).toHaveCount(1);
  await expect(usual.locator('.bm-name')).toHaveText('Standup');
  await expect(usual.locator('.sugg-badge')).toHaveText('Usually now');
  await page.keyboard.press('Escape');

  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').click();
  await page.locator('label.tg', { has: page.locator('#cfg-suggest-usual') }).click();
  expect(await page.evaluate(() => [window.Nordlys.config.suggestUsual, localStorage.getItem('nordlys_rhythm')])).toEqual([false, null]);
  await open('Standup');
  expect(await page.evaluate(() => localStorage.getItem('nordlys_rhythm'))).toBeNull();
  expect(runtimeErrors).toEqual([]);
});
