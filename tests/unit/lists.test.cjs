const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../src/js/lists.js');

/* Folders that follow a list at an address (lists.js): whatever shape the
   list is kept in, the same folders come out; a folder keeps the look set
   on it here, and a list is asked at most once an hour. */

const shape = (folders) => folders.map((folder) => [folder.label, folder.links.map((link) => `${link.name} ${link.url}`)]);

test('a Nordlys backup, folders, links and addresses as JSON', () => {
  const backup = { theme: 'aurora', groups: [{ label: 'Ops', links: [{ name: 'Grafana', url: 'https://grafana.test/' }, { name: 'Run', url: 'javascript:alert(1)' }] }, { label: 'Empty', links: [] }] };
  assert.deepEqual(shape(L.parse(JSON.stringify(backup), 'https://team.test/links.json')), [['Ops', ['Grafana https://grafana.test/']]]);
  assert.deepEqual(shape(L.parse('[{"title":"Docs","href":"https://docs.test/"},"https://www.mail.test/"]', 'https://team.test/links.json')), [['links', ['Docs https://docs.test/', 'mail.test https://www.mail.test/']]]);
  assert.deepEqual(shape(L.parse('{"name":"Read","links":[{"url":"https://news.test/"}]}', 'https://team.test/')), [['Read', ['news.test https://news.test/']]]);
});

test('plain text and Markdown: names beside the addresses, headings start folders', () => {
  const text = [
    'Team links, kept by Ops',
    '- Grafana: https://grafana.test/d/1',
    '1Password https://1password.test',
    '',
    '## Docs',
    '* [Handbook](https://handbook.test/start)',
    'https://wiki.test/page. ',
    'Reading:',
    '  2. News — https://news.test/today'
  ].join('\r\n');
  assert.deepEqual(shape(L.parse(text, 'https://raw.test/acme/team-links.md')), [
    ['team-links', ['Grafana https://grafana.test/d/1', '1Password https://1password.test']],
    ['Docs', ['Handbook https://handbook.test/start', 'wiki.test https://wiki.test/page']],
    ['Reading', ['News https://news.test/today']]
  ]);
  assert.deepEqual(L.parse('nothing to see here', 'https://team.test/'), []);
});

test('each link keeps the look set on it here; the list owns the name and the address', () => {
  const before = [{ id: 'l1', name: 'Old name', url: 'https://a.test/', icon: 'github', color: '#ff0000' }, { id: 'l2', name: 'Twice', url: 'https://b.test/' }, { id: 'l3', name: 'Twice', url: 'https://b.test/', icon: 'mail' }];
  const fresh = [{ name: 'B', url: 'https://b.test/' }, { name: 'A', url: 'https://a.test/' }, { name: 'B again', url: 'https://b.test/' }, { name: 'New', url: 'https://c.test/' }];
  assert.deepEqual(L.keepLooks(fresh, before), [
    { id: 'l2', name: 'B', url: 'https://b.test/' },
    { id: 'l1', name: 'A', url: 'https://a.test/', icon: 'github', color: '#ff0000' },
    { id: 'l3', name: 'B again', url: 'https://b.test/', icon: 'mail' },
    { name: 'New', url: 'https://c.test/' }
  ]);
});

test('a list is read at most once an hour; a folder it no longer has is marked, never emptied', async () => {
  const lists = { 'https://team.test/links.md': '# Ops\nGrafana https://grafana.test/\n# Docs\nWiki https://wiki.test/' };
  const asked = [];
  const fetchText = async (url) => { asked.push(url); if (!lists[url]) throw new Error('HTTP 404'); return lists[url]; };
  const ops = { label: 'Ops', source: { type: 'list', url: 'https://team.test/links.md', folder: 'Ops' }, links: [{ id: 'l1', name: 'Grafana', url: 'https://grafana.test/', color: '#00ff00' }] };
  const docs = { label: 'Docs', source: { type: 'list', url: 'https://team.test/links.md', folder: 'Docs' }, links: [] };
  const gone = { label: 'Gone', source: { type: 'list', url: 'https://gone.test/links.md', folder: 'Gone' }, links: [{ name: 'Keep', url: 'https://keep.test/' }] };
  const groups = [ops, docs, gone, { label: 'Mine', links: [] }];
  const now = 5e12;

  assert.equal(await L.refresh(groups, { now, fetchText }), true);
  assert.deepEqual(asked, ['https://team.test/links.md', 'https://gone.test/links.md'], 'one read for both folders that follow one list');
  assert.deepEqual(ops.links, [{ id: 'l1', name: 'Grafana', url: 'https://grafana.test/', color: '#00ff00' }]);
  assert.deepEqual(docs.links, [{ name: 'Wiki', url: 'https://wiki.test/' }]);
  assert.deepEqual(gone.links, [{ name: 'Keep', url: 'https://keep.test/' }], 'a list that cannot be read leaves its folder as it was');

  lists['https://team.test/links.md'] = '# Ops\nGrafana https://grafana.test/\nLogs https://logs.test/';
  assert.equal(await L.refresh(groups, { now: now + L.EVERY - 1, fetchText }), false);
  assert.equal(asked.length, 2, 'not asked again within the hour');
  assert.equal(await L.refresh(groups, { now: now + L.EVERY, fetchText }), true);
  assert.deepEqual(ops.links.map((link) => link.name), ['Grafana', 'Logs']);
  assert.equal(docs.source.missing, true);
  assert.deepEqual(docs.links, [{ name: 'Wiki', url: 'https://wiki.test/' }]);
});
