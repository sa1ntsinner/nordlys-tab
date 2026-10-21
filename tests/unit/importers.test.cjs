const { test } = require('node:test');
const assert = require('node:assert');
const I = require('../../src/js/importers.js');

/* One file of each, shaped as each extension writes it. */
const shape = result => result && { from: result.from, groups: result.groups.map(g => [g.label, g.links.map(l => l.name + ' ' + l.url + (l.customImg ? ' +icon' : ''))]) };

test('FVD Speed Dial: groups by position, dials by group, an image address kept as the icon', () => {
  const file = { db: {
    groups: [{ id: 2, name: 'Work', position: 2 }, { id: 1, name: 'Default', position: 1 }],
    dials: [
      { url: 'https://github.com/', title: '', auto_title: 'GitHub', position: 1, group_id: 2, deny: 0, thumb_source_type: 'screen', thumb: 'data:image/png;base64,AAA' },
      { url: 'https://mail.google.com/', title: 'Gmail', position: 2, group_id: 1, deny: 0, thumb_source_type: 'url', thumb_url: 'https://example.com/g.png' },
      { url: 'https://news.ycombinator.com/', title: 'HN', position: 1, group_id: 1, deny: 0 },
      { url: 'https://denied.example/', title: 'Gone', position: 3, group_id: 1, deny: 1 }
    ], deny: [] }, prefs: {} };
  assert.deepStrictEqual(shape(I.read(file)), { from: 'FVD Speed Dial', groups: [
    ['Default', ['HN https://news.ycombinator.com/', 'Gmail https://mail.google.com/ +icon']],
    ['Work', ['GitHub https://github.com/']]
  ] });
});

test('Speed Dial 2: Home is group 0, listed or not; the older file keyed by index reads the same', () => {
  const now = { dials: [
    { title: 'Gmail', url: 'https://mail.google.com/', position: 1, idgroup: 0, thumbnail: '' },
    { title: 'GitHub', url: 'https://github.com/', position: 1, idgroup: 1, thumbnail: 'https://example.com/gh.png' }
  ], groups: [{ id: 0, title: 'Home', position: 0 }, { id: 1, title: 'Work', position: 1 }], preferences: {} };
  assert.deepStrictEqual(shape(I.read(now)).groups, [['Home', ['Gmail https://mail.google.com/']], ['Work', ['GitHub https://github.com/ +icon']]]);
  const old = { settings: {}, groups: { 0: { id: 3, title: 'Work', position: 1 } }, dials: { 0: { title: 'GitHub', url: 'https://github.com/', position: 1, idgroup: 3 }, 1: { title: 'Home one', url: 'https://example.com/', position: 1, idgroup: 0 } } };
  assert.deepStrictEqual(shape(I.read(old)).groups, [['Home', ['Home one https://example.com/']], ['Work', ['GitHub https://github.com/']]]);
});

test('Infinity: each page a folder, a folder on a page a folder of its own, app tiles left out', () => {
  const file = { version: 'v2', data: { site: { sites: [
    [
      { name: 'GitHub', type: 'web', target: 'https://github.com/', bgType: 'image', bgImage: 'https://icons.example/gh.png' },
      { name: 'News', children: [{ name: 'BBC', type: 'web', target: 'https://www.bbc.com/', bgType: 'color' }] }
    ],
    [{ name: 'Weather', type: 'app', target: 'infinity://weather' }, { name: 'Mail', type: 'web', target: 'https://mail.example/' }]
  ] } } };
  assert.deepStrictEqual(shape(I.read(file)), { from: 'Infinity', groups: [
    ['Page 1', ['GitHub https://github.com/ +icon']], ['News', ['BBC https://www.bbc.com/']], ['Page 2', ['Mail https://mail.example/']]
  ] });
});

test('nightTab: 7.x groups, the older bookmarks key and plain-string names', () => {
  const now = { nightTab: true, version: '7.6.0', state: {}, bookmark: [{ name: { text: 'Cool stuff' }, items: [
    { url: 'https://mail.google.com/', display: { name: { text: 'Gmail' }, visual: { type: 'icon' } } },
    { url: 'https://img.example/', display: { name: { text: 'Pics' }, visual: { type: 'image', image: { url: 'https://img.example/i.png' } } } }
  ] }] };
  assert.deepStrictEqual(shape(I.read(now)).groups, [['Cool stuff', ['Gmail https://mail.google.com/', 'Pics https://img.example/ +icon']]]);
  const old = { nightTab: true, version: '5.0.0', bookmarks: [{ name: 'Old', items: [{ url: 'https://a.example/', name: 'A' }] }] };
  assert.deepStrictEqual(shape(I.read(old)).groups, [['Old', ['A https://a.example/']]]);
});

test('Bonjourr: groups by name, a folder inside one, links in order, an empty title named by its site', () => {
  const file = {
    about: { browser: 'chrome', version: '22.3.0' },
    linkgroups: { on: true, selected: 'default', groups: ['default', 'Work'], pinned: [], synced: [] },
    linksAb12Cd: { _id: 'linksAb12Cd', parent: 'default', order: 1, title: 'GitHub', url: 'https://github.com/', icon: { type: 'auto' } },
    linksZz00Zz: { _id: 'linksZz00Zz', parent: 'default', order: 0, title: 'First', url: 'https://first.example/' },
    linksEf34Gh: { _id: 'linksEf34Gh', parent: 'default', folder: true, order: 2, title: 'News' },
    linksIj56Kl: { _id: 'linksIj56Kl', parent: 'linksEf34Gh', order: 0, title: 'BBC', url: 'https://www.bbc.com/', icon: { type: 'url', value: 'https://example.com/bbc.png' } },
    linksMn78Op: { _id: 'linksMn78Op', parent: 'Work', order: 0, title: '', url: 'https://linear.app/' }
  };
  assert.deepStrictEqual(shape(I.read(file)), { from: 'Bonjourr', groups: [
    ['Bonjourr', ['First https://first.example/', 'GitHub https://github.com/']],
    ['News', ['BBC https://www.bbc.com/ +icon']],
    ['Work', ['linear.app https://linear.app/']]
  ] });
});

test('Tabliss: each links widget is a folder', () => {
  const file = { version: 3, 'widget/abc': { key: 'widget/links', order: 0 }, 'data/abc': { links: [{ url: 'https://github.com/', name: 'GitHub', icon: '_favicon' }, { url: 'https://x.example/' }] } };
  assert.deepStrictEqual(shape(I.read(file)), { from: 'Tabliss', groups: [['Tabliss', ['GitHub https://github.com/', 'x.example https://x.example/']]] });
});

test('only web addresses come over, a Nordlys backup is not mistaken for any of these, and junk is null', () => {
  const file = { nightTab: true, version: '7.6.0', state: {}, bookmark: [{ name: { text: 'G' }, items: [
    { url: 'javascript:alert(1)', display: { name: { text: 'x' } } }, { url: 'chrome://settings', display: { name: { text: 'y' } } }
  ] }] };
  assert.deepStrictEqual(I.read(file).groups, [], 'nothing left, so no empty folder either');
  assert.strictEqual(I.read({ theme: 'aurora-void', groups: [{ label: 'Daily', links: [] }] }), null);
  assert.strictEqual(I.read([]), null);
  assert.strictEqual(I.read(null), null);
});
