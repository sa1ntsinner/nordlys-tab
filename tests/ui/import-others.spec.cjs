const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* A backup from another new-tab extension adds its folders after these, and
   the setup as it was is kept in the restore point. */

async function importFile(page, name, content) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await page.locator('#cfg-import-universal').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) });
}

test('a Speed Dial 2 export comes over as folders after the ones here', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const before = await page.evaluate(() => window.Nordlys.config.groups.length);
  await importFile(page, 'speed-dial-2-export-2026-10-21.json', JSON.stringify({
    dials: [{ title: 'Gmail', url: 'https://mail.google.com/', position: 1, idgroup: 0 }, { title: 'GitHub', url: 'https://github.com/', position: 1, idgroup: 1 }],
    groups: [{ id: 0, title: 'Home', position: 0 }, { id: 1, title: 'Work', position: 1 }], preferences: {}
  }));
  await expect(page.locator('#toast-dock')).toContainText('came over from Speed Dial 2');
  const groups = await page.evaluate(() => window.Nordlys.config.groups.map(g => g.label));
  expect(groups.length).toBe(before + 2);
  expect(groups.slice(-2)).toEqual(['Home', 'Work']);
  await expect(page.locator('#board .card', { hasText: 'Work' }).locator('.tile')).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point')).config.groups.length)).toBe(before);
  expect(runtimeErrors).toEqual([]);
});

test('an Infinity backup with its own extension is read too', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await importFile(page, 'infinityBackup-2026-10-21.infinity', JSON.stringify({ version: 'v2', data: { site: { sites: [[{ name: 'BBC', type: 'web', target: 'https://www.bbc.com/' }]] } } }));
  await expect(page.locator('#toast-dock')).toContainText('came over from Infinity');
  expect(await page.evaluate(() => window.Nordlys.config.groups.at(-1))).toMatchObject({ label: 'Page 1', links: [{ name: 'BBC', url: 'https://www.bbc.com/' }] });
});

test('a bookmarks file with folders inside folders brings each link once', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><A HREF="https://github.com/">GitHub</A>
    <DT><H3>Docs</H3>
    <DL><p>
      <DT><A HREF="https://developer.mozilla.org/">MDN</A>
    </DL><p>
  </DL><p>
</DL><p>`;
  const before = await page.evaluate(() => window.Nordlys.config.groups.length);
  await importFile(page, 'bookmarks.html', html);
  await page.waitForFunction(n => window.Nordlys?.config?.groups?.length === n + 2, before);
  const added = await page.evaluate(n => window.Nordlys.config.groups.slice(n).map(g => [g.label, g.links.map(l => l.name)]), before);
  expect(added).toEqual([['Work', ['GitHub']], ['Work / Docs', ['MDN']]]);
});
