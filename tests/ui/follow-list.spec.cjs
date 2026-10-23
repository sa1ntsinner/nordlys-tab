const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Settings → Bookmarks → Follow a list at an address: a list a team keeps
   at a web address becomes folders that follow it. Read once on the click,
   again once an hour; the look set here is kept, and the folders take no
   edit the next read would undo. The list is stood in for with page.route. */

test('a list at an address comes onto the board as folders that follow it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  let list = '# Ops\nGrafana https://grafana.test/\n\n# Docs\n- [Handbook](https://handbook.test/)';
  let reads = 0;
  await page.route('https://team.test/links.md', route => { reads++; route.fulfill({ status: 200, contentType: 'text/plain', body: list }); });
  await page.evaluate(() => {
    window.Nordlys.config.groups = [{ label: 'Mine', cols: 3, hidden: false, links: [{ name: 'Mail', url: 'https://mail.test/' }] }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await page.locator('#follow-list summary').click();
  await page.getByRole('textbox', { name: 'Address of the list' }).fill('https://team.test/links.md');
  await page.locator('#follow-run').click();
  await expect(page.locator('#toast-dock')).toContainText('2 bookmarks in 2 folders came over from team.test.');
  expect(await page.evaluate(() => window.__origins.asked)).toEqual(['https://team.test/*']);
  const source = { type: 'list', url: 'https://team.test/links.md' };
  expect(await page.evaluate(() => window.Nordlys.config.groups.map(group => [group.label, group.source, group.links.map(link => link.name)]))).toEqual([
    ['Mine', undefined, ['Mail']], ['Ops', { ...source, folder: 'Ops' }, ['Grafana']], ['Docs', { ...source, folder: 'Docs' }, ['Handbook']]
  ]);
  await expect(page.locator('.bookmark-folder-accordion[data-linked="true"] .bookmark-folder-linked')).toHaveText(['team.test', 'team.test']);

  // Nothing is added to a followed folder, or taken out of it, here.
  expect(await page.evaluate(() => window.Nordlys.grid.addLinkFrom(1, { name: 'Logs', url: 'https://logs.test/' }))).toBe(false);
  await expect(page.locator('#toast-dock')).toContainText('This folder follows a list at team.test. Change the list there.');
  await page.keyboard.press('Escape');
  await page.locator('#board .tile', { hasText: 'Grafana' }).click({ button: 'right' });
  await expect(page.locator('#tile-ctx-menu [data-action="delete"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#tile-ctx-menu [data-action="delete"]')).toHaveAttribute('title', 'This folder follows a list at team.test. Change the list there.');
  await page.keyboard.press('Escape');

  // Read again once an hour has passed; the colour set on a bookmark stays.
  list = '# Ops\nGrafana https://grafana.test/\nLogs https://logs.test/\n\n# Docs\n- [Handbook](https://handbook.test/)';
  const opsAfterRead = () => page.evaluate(async () => {
    await window.Nordlys.followLists();
    return window.Nordlys.config.groups[1].links.map(link => [link.name, link.color]);
  });
  await page.evaluate(() => { window.Nordlys.config.groups[1].links[0].color = '#ff0000'; });
  expect(await opsAfterRead()).toEqual([['Grafana', '#ff0000']]);
  expect(reads).toBe(1);
  await page.evaluate(() => localStorage.setItem('nordlys_lists_read', JSON.stringify({ 'https://team.test/links.md': Date.now() - 3600001 })));
  expect(await opsAfterRead()).toEqual([['Grafana', '#ff0000'], ['Logs', undefined]]);
  expect(reads).toBe(2);
  await expect(page.locator('#board .tile', { hasText: 'Logs' })).toBeVisible();

  // Let go of, the folder keeps what was on screen and takes edits again.
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await page.locator('.bookmark-folder-accordion').nth(1).locator('.bookmark-folder-head').getByRole('button', { name: /More actions for/ }).click();
  await page.locator('.nl-overflow-menu').getByRole('menuitem', { name: 'Stop following the list' }).click();
  expect(await page.evaluate(() => [window.Nordlys.config.groups[1].source, window.Nordlys.config.groups[1].links.length])).toEqual([undefined, 2]);
  expect(await page.evaluate(() => window.Nordlys.grid.addLinkFrom(1, { name: 'Logs too', url: 'https://logs.test/2' }))).toBe(true);
});

test('a bookmarks file a browser exported is read the same way', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://team.test/bookmarks.html', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Team</H3><DL><p><DT><A HREF="/wiki">Wiki</A><DT><A HREF="https://ci.test/">CI</A></DL><p></DL>' }));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await page.locator('#follow-list summary').click();
  await page.locator('#follow-url').fill('https://team.test/bookmarks.html');
  await page.locator('#follow-url').press('Enter');
  await expect(page.locator('#toast-dock')).toContainText('came over from team.test');
  expect(await page.evaluate(() => window.Nordlys.config.groups.at(-1))).toMatchObject({ label: 'Team', links: [{ name: 'Wiki', url: 'https://team.test/wiki' }, { name: 'CI', url: 'https://ci.test/' }] });
});
