const { test } = require('node:test');
const assert = require('node:assert');
const M = require('../../src/js/sync-model.js');

const bytes = value => Buffer.byteLength(JSON.stringify(value));
const board = (label, names, extra = {}) => ({ label, cols: 2, hidden: false, ...extra, links: names.map(name => ({ name, url: `https://${name.toLowerCase()}.example/` })) });
const snapshot = (profiles, person = { language: 'en', userName: 'Elmir' }) => ({ person, profiles });
const profile = (id, name, groups, look = { theme: 'aurora-void', bgMode: 'aurora' }) => ({ id, name, color: 'teal', config: { ...look, groups } });
const device = (name, snap) => { const state = M.create(name); M.update(state, M.clone(snap)); return state; };
const exchange = (from, to) => M.merge(to, M.exportChunks(from));

test('ids are given once and kept', () => {
  const config = { groups: [board('Daily', ['Gmail', 'Drive'])] };
  assert.strictEqual(M.normalize(config), true);
  const ids = JSON.stringify(config.groups.map(g => [g.id, g.links.map(l => l.id)]));
  assert.strictEqual(M.normalize(config), false);
  assert.strictEqual(JSON.stringify(config.groups.map(g => [g.id, g.links.map(l => l.id)])), ids);
});

test('a snapshot comes back out of the model as it went in', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail', 'Drive']), board('Code', ['GitHub'])]), profile('home', 'Home', [board('Watch', ['YouTube'])], { theme: 'nord-frost', bgMode: 'silk' })]);
  M.normalizeSnapshot(snap);
  const state = device('a', snap);
  const out = M.materialize(state);
  assert.deepStrictEqual(out.person, snap.person);
  assert.deepStrictEqual(out.profiles.map(p => [p.id, p.name, p.config.theme, p.config.groups.map(g => [g.label, g.links.map(l => l.name)])]),
    [['work', 'Work', 'aurora-void', [['Daily', ['Gmail', 'Drive']], ['Code', ['GitHub']]]], ['home', 'Home', 'nord-frost', [['Watch', ['YouTube']]]]]);
});

test('edits to different fields on two devices both survive', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail'])])]);
  M.normalizeSnapshot(snap);
  const a = device('a', snap);
  const b = M.create('b'); M.merge(b, M.exportChunks(a));
  const onA = M.materialize(a); onA.profiles[0].config.groups[0].links[0].name = 'Mail';
  const onB = M.materialize(b); onB.profiles[0].config.groups[0].links[0].url = 'https://mail.example/';
  M.update(a, onA); M.update(b, onB);
  exchange(a, b); exchange(b, a);
  for (const state of [a, b]) {
    const link = M.materialize(state).profiles[0].config.groups[0].links[0];
    assert.deepStrictEqual([link.name, link.url], ['Mail', 'https://mail.example/']);
  }
});

test('three devices end on the same board whatever order the chunks arrive in', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail', 'Drive'])])]);
  M.normalizeSnapshot(snap);
  const seed = device('a', snap);
  const devices = ['a', 'b', 'c'].map(name => { const s = M.create(name); M.merge(s, M.exportChunks(seed)); return s; });
  devices[0].records = M.clone(seed.records); devices[0].clock = seed.clock;
  const edits = [
    c => { c.profiles[0].config.groups[0].label = 'Mail and files'; },
    c => { c.profiles[0].config.groups[0].label = 'Everyday'; c.profiles[0].config.theme = 'tokyo-night'; },
    c => { c.profiles[0].config.groups[0].links.pop(); }
  ];
  devices.forEach((s, i) => { const view = M.materialize(s); edits[i](view); M.update(s, view); });
  const chunks = devices.map(s => M.exportChunks(s));
  const orders = [[0, 1, 2], [2, 1, 0], [1, 2, 0]];
  const results = orders.map(order => { const s = M.create('z'); for (const i of order) M.merge(s, chunks[i]); return JSON.stringify(M.materialize(s)); });
  assert.strictEqual(new Set(results).size, 1);
  const final = JSON.parse(results[0]).profiles[0].config;
  assert.deepStrictEqual(final.groups[0].links.map(l => l.name), ['Gmail']);
  assert.strictEqual(final.theme, 'tokyo-night');
});

test('a deletion is not undone by an offline rename', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail', 'Drive'])])]);
  M.normalizeSnapshot(snap);
  const a = device('a', snap);
  const b = M.create('b'); M.merge(b, M.exportChunks(a));
  const onA = M.materialize(a); onA.profiles[0].config.groups[0].links.splice(1, 1); M.update(a, onA);
  const onB = M.materialize(b); onB.profiles[0].config.groups[0].links[1].name = 'Docs'; M.update(b, onB);
  exchange(a, b); exchange(b, a);
  assert.deepStrictEqual(M.materialize(b).profiles[0].config.groups[0].links.map(l => l.name), ['Gmail']);
  assert.deepStrictEqual(M.materialize(a).profiles[0].config.groups[0].links.map(l => l.name), ['Gmail']);
});

test('a folder moved to another profile moves with its bookmarks', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail'])]), profile('home', 'Home', [])]);
  M.normalizeSnapshot(snap);
  const a = device('a', snap);
  const view = M.materialize(a);
  view.profiles[1].config.groups.push(view.profiles[0].config.groups.shift());
  M.update(a, view);
  const out = M.materialize(a);
  assert.deepStrictEqual(out.profiles.map(p => p.config.groups.map(g => g.links.map(l => l.name))), [[], [['Gmail']]]);
});

test('a deleted profile takes its folders with it and can come back', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail'])]), profile('home', 'Home', [board('Watch', ['YouTube'])])]);
  M.normalizeSnapshot(snap);
  const a = device('a', snap);
  const view = M.materialize(a); view.profiles.pop(); M.update(a, view);
  assert.deepStrictEqual(M.materialize(a).profiles.map(p => p.id), ['work']);
  assert.deepStrictEqual(M.deletedProfiles(a).map(p => p.id), ['home']);
  M.restoreProfile(a, 'home');
  const back = M.materialize(a).profiles.find(p => p.id === 'home');
  assert.deepStrictEqual(back.config.groups.map(g => g.links.map(l => l.name)), [['YouTube']]);
});

test('person fields are shared and the look belongs to each profile', () => {
  const snap = snapshot([profile('work', 'Work', [], { theme: 'aurora-void', timeFormat: '12h' })], { language: 'ru', timeFormat: '24h' });
  M.normalizeSnapshot(snap);
  const state = device('a', snap);
  assert.strictEqual(state.records.c.language.v, 'ru');
  assert.strictEqual(state.records.c.timeFormat.v, '24h');
  assert.strictEqual(state.records['c/work'].timeFormat, undefined, 'a person field never lands in a profile');
  assert.strictEqual(state.records['c/work'].theme.v, 'aurora-void');
});

test('what cannot travel stays out of the chunks', () => {
  const linked = board('Chrome bar', ['Linked'], { source: { type: 'browser', folderId: '1' } });
  const daily = board('Daily', ['Gmail']);
  daily.links[0].customImg = 'data:image/png;base64,AAAA';
  const snap = snapshot([profile('work', 'Work', [daily, linked], { theme: 'aurora-void', customCss: 'body{}', bgMode: 'custom-image' })]);
  M.normalizeSnapshot(snap);
  const state = device('a', snap);
  const text = JSON.stringify(M.exportChunks(state));
  assert.ok(!text.includes('data:image'), 'embedded images stay local');
  assert.ok(!text.includes('body{}'), 'custom CSS stays local');
  assert.ok(!text.includes('custom-image'), 'a wallpaper background stays local');
  assert.ok(!text.includes('Linked'), 'folders linked to Chrome bookmarks stay local');
  assert.ok(text.includes('Gmail'));
});

test('a big board is packed into chunks under 8 KB, not one item per record', () => {
  const profiles = ['work', 'home', 'study'].map(id => profile(id, id, Array.from({ length: 10 }, (_, g) => board(`Folder ${g}`, Array.from({ length: 10 }, (_, l) => `Site${g}x${l}`)))));
  const snap = snapshot(profiles);
  M.normalizeSnapshot(snap);
  const state = device('a', snap);
  const chunks = M.exportChunks(state);
  const keys = Object.keys(chunks);
  assert.ok(keys.length < 40, `${keys.length} items for 330 records`);
  for (const [key, value] of Object.entries(chunks)) assert.ok(Buffer.byteLength(key) + bytes(value) <= 8192, `${key} is ${bytes(value)} bytes`);
  const copy = M.create('b'); M.merge(copy, chunks);
  assert.strictEqual(M.materialize(copy).profiles.reduce((n, p) => n + p.config.groups.reduce((m, g) => m + g.links.length, 0), 0), 300);
});

test('damaged or foreign chunks are refused as a whole and change nothing', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail'])])]);
  M.normalizeSnapshot(snap);
  const a = device('a', snap);
  const before = JSON.stringify(a.records);
  const good = M.exportChunks(device('b', snap));
  const [key] = Object.keys(good);
  const bad = { ...good, [key]: { ...good[key], e: { 'l/x': { url: [5, 'javascript:alert(1)'] } } } };
  assert.throws(() => M.merge(a, bad), /unsafe|invalid|damaged/i);
  assert.strictEqual(JSON.stringify(a.records), before);
  assert.strictEqual(M.merge(a, { 'nl.sync.1.old.c': { v: 1 }, unrelated: 1 }), false, 'other formats are ignored');
});

test('a bookmark kept on this device leaves the others, and comes back when shared again', () => {
  const snap = snapshot([profile('work', 'Work', [board('Daily', ['Gmail', 'Bank'])])]);
  M.normalizeSnapshot(snap);
  const a = device('a', snap);
  const b = M.create('b'); M.merge(b, M.exportChunks(a));
  const names = state => M.materialize(state).profiles[0].config.groups[0].links.map(l => l.name);
  const view = M.materialize(a); view.profiles[0].config.groups[0].links[1].local = true; M.update(a, view);
  M.merge(a, M.exportChunks(a));
  M.merge(b, M.exportChunks(a));
  assert.deepStrictEqual(names(a), ['Gmail', 'Bank'], 'still here');
  assert.deepStrictEqual(names(b), ['Gmail'], 'gone from the other device');
  const again = M.materialize(a); delete again.profiles[0].config.groups[0].links[1].local; M.update(a, again);
  M.merge(b, M.exportChunks(a));
  assert.deepStrictEqual(names(b), ['Gmail', 'Bank']);
});
