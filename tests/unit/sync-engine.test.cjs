const { test } = require('node:test');
const assert = require('node:assert');
globalThis.NordlysSyncModel = require('../../src/js/sync-model.js');
const NordlysSyncEngine = require('../../src/js/sync-engine.js');

/* chrome.storage in memory: one sync area shared by every device, a local
   area each, and Chrome's limits enforced the way Chrome enforces them. */
function area({ limits = false } = {}) {
  const data = new Map();
  return {
    data,
    get: async keys => {
      if (keys === null || keys === undefined) return Object.fromEntries([...data].map(([k, v]) => [k, JSON.parse(v)]));
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter(k => data.has(k)).map(k => [k, JSON.parse(data.get(k))]));
    },
    set: async items => {
      for (const [k, v] of Object.entries(items)) {
        const size = Buffer.byteLength(k) + Buffer.byteLength(JSON.stringify(v));
        if (limits && size > 8192) throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
        data.set(k, JSON.stringify(v));
      }
    },
    remove: async keys => { for (const k of [].concat(keys)) data.delete(k); }
  };
}
const snapshot = (groups, look = { theme: 'aurora-void' }) => ({ person: { language: 'en' }, profiles: [{ id: 'main', name: 'Main', color: 'teal', config: { ...look, groups } }] });
const folder = (id, label, links) => ({ id, label, cols: 2, links: links.map(([lid, name]) => ({ id: lid, name, url: `https://${lid}.example/` })) });
const names = view => view.profiles[0].config.groups.flatMap(g => g.links.map(l => l.name));
async function engine(sync, name) {
  const e = new NordlysSyncEngine({ local: area(), sync, deviceName: name });
  await e.load();
  return e;
}

test('a board turned on on one device arrives on the next', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'Laptop');
  await a.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail'], ['l2', 'Drive']])]), mode: 'merge' });
  assert.strictEqual((await a.status()).state, 'ready');
  const b = await engine(sync, 'Desktop');
  const view = await b.enable({ snapshot: snapshot([]), mode: 'use-sync' });
  assert.deepStrictEqual(names(view), ['Gmail', 'Drive']);
  assert.deepStrictEqual((await b.status()).devices.map(d => d.name).sort(), ['Desktop', 'Laptop']);
});

test('an edit on one device reaches the other on its next pull', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'A');
  const start = snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]);
  await a.enable({ snapshot: start, mode: 'merge' });
  const b = await engine(sync, 'B');
  await b.enable({ snapshot: snapshot([]), mode: 'use-sync' });
  const edited = JSON.parse(JSON.stringify(start));
  edited.profiles[0].config.groups[0].links.push({ id: 'l2', name: 'Calendar', url: 'https://cal.example/' });
  await a.push(edited);
  const view = await b.pull();
  assert.deepStrictEqual(names(view), ['Gmail', 'Calendar']);
  assert.strictEqual(await b.pull(), null, 'nothing new, nothing to redraw');
});

test('"different here" changes one device only, and is dropped with its bookmark', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'A');
  const start = snapshot([folder('g1', 'Daily', [['l1', 'Mail'], ['l2', 'Bank']])]);
  await a.enable({ snapshot: start, mode: 'merge' });
  const b = await engine(sync, 'B');
  await b.enable({ snapshot: snapshot([]), mode: 'use-sync' });
  const onB = await b.override('l/l1', { url: 'https://work-mail.example/' });
  assert.strictEqual(onB.profiles[0].config.groups[0].links[0].url, 'https://work-mail.example/');
  // An edit to the overridden field on B stays B's own; the name edit travels.
  onB.profiles[0].config.groups[0].links[0].url = 'https://other-mail.example/';
  onB.profiles[0].config.groups[0].links[0].name = 'Post';
  await b.push(onB);
  const onA = await a.pull();
  assert.deepStrictEqual([onA.profiles[0].config.groups[0].links[0].name, onA.profiles[0].config.groups[0].links[0].url], ['Post', 'https://l1.example/']);
  assert.strictEqual((await b.view()).profiles[0].config.groups[0].links[0].url, 'https://other-mail.example/');
  assert.deepStrictEqual(await b.overrides(), { 'l/l1': { url: 'https://other-mail.example/' } });
  // Back to the shared address.
  const shared = await b.override('l/l1', null);
  assert.strictEqual(shared.profiles[0].config.groups[0].links[0].url, 'https://l1.example/');
  // An override on a bookmark deleted elsewhere does not keep a ghost alive.
  await b.override('l/l2', { name: 'My bank' });
  onA.profiles[0].config.groups[0].links.pop();
  await a.push(onA);
  const after = await b.pull();
  assert.deepStrictEqual(names(after), ['Post']);
  assert.deepStrictEqual(await b.overrides(), {}, 'the override went with its bookmark');
});

test('a look kept on this device only', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'A');
  await a.enable({ snapshot: snapshot([], { theme: 'aurora-void', bgMode: 'aurora' }), mode: 'merge' });
  const b = await engine(sync, 'B');
  await b.enable({ snapshot: snapshot([]), mode: 'use-sync' });
  await b.keepLookHere('main', { theme: 'porcelain-light', bgMode: 'baikal' });
  assert.strictEqual((await b.view()).profiles[0].config.theme, 'porcelain-light');
  assert.strictEqual((await a.pull()), null, 'the other device never hears of it');
  await b.keepLookHere('main', null);
  assert.strictEqual((await b.view()).profiles[0].config.theme, 'aurora-void');
});

test('replacing sync with this device wins everywhere', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'A');
  await a.enable({ snapshot: snapshot([folder('g1', 'Old', [['l1', 'Old link']])]), mode: 'merge' });
  const b = await engine(sync, 'B');
  await b.enable({ snapshot: snapshot([folder('g9', 'Mine', [['l9', 'My link']])]), mode: 'replace-sync' });
  const onA = await a.pull();
  assert.deepStrictEqual(names(onA), ['My link']);
});

test('merging keeps what both devices had', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'A');
  await a.enable({ snapshot: snapshot([folder('g1', 'A', [['l1', 'From A']])]), mode: 'merge' });
  const b = await engine(sync, 'B');
  const view = await b.enable({ snapshot: snapshot([folder('g2', 'B', [['l2', 'From B']])]), mode: 'merge' });
  assert.deepStrictEqual(names(view).sort(), ['From A', 'From B']);
});

test('a full sync area stops sending and keeps every edit here', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'A');
  const big = snapshot(Array.from({ length: 30 }, (_, g) => folder(`g${g}`, `Folder ${g}`, Array.from({ length: 20 }, (_, l) => [`l${g}x${l}`, `Site ${g}.${l} `.repeat(12)]))));
  await a.enable({ snapshot: big, mode: 'merge' });
  const status = await a.status();
  assert.strictEqual(status.state, 'full');
  assert.match(status.error, /100 KB/);
  assert.strictEqual(sync.data.size, 0, 'nothing cut down was sent');
  assert.strictEqual(names(await a.view()).length, 600, 'the board here is whole');
});

test('damaged data in sync is skipped and the board here is kept', async () => {
  const sync = area({ limits: true });
  const a = await engine(sync, 'A');
  await a.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]), mode: 'merge' });
  await sync.set({ 'nl.sync.2.intruder.0': { v: 2, a: 'intruder', i: 0, e: { 'l/l1': { url: [99, 'javascript:alert(1)'] } } } });
  assert.strictEqual(await a.pull(), null);
  const status = await a.status();
  assert.strictEqual(status.state, 'error');
  assert.deepStrictEqual(names(await a.view()), ['Gmail']);
});

test('turning sync on keeps a backup of the board as it was', async () => {
  const local = area();
  const e = new NordlysSyncEngine({ local, sync: area(), deviceName: 'A' });
  await e.load();
  const start = snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]);
  await e.enable({ snapshot: start, mode: 'merge' });
  const backups = await e.backups();
  assert.strictEqual(backups.length, 1);
  assert.deepStrictEqual(backups[0].snapshot, start);
});
