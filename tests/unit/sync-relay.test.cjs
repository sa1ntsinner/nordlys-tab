const { test } = require('node:test');
const assert = require('node:assert');
globalThis.NordlysSyncModel = require('../../src/js/sync-model.js');
const NordlysSyncEngine = require('../../src/js/sync-engine.js');
const Relay = require('../../src/js/sync-relay.js');

/* Sync with a code, end to end: the engine, the relay's client and the
   relay's own rules (relay/src/core.js) over a store in memory. Only the
   network between them is missing. */
const core = import('../../relay/src/core.js');
async function world() {
  const { handle, memoryStore, LIMITS } = await core;
  const store = memoryStore();
  const calls = [];
  let down = false;
  const fetchImpl = async (url, options = {}) => {
    if (down) throw new TypeError('Failed to fetch');
    calls.push(`${options.method || 'GET'} ${new URL(url).pathname}`);
    return handle(new Request(url, { method: options.method, headers: options.headers, body: options.body }), store);
  };
  return { store, calls, LIMITS, handle, fetchImpl, relay: code => Relay.create(code, { fetchImpl, url: 'https://relay.test' }), down: value => { down = value; } };
}
function area() {
  const data = new Map();
  return {
    get: async keys => (keys == null ? Object.fromEntries([...data].map(([k, v]) => [k, JSON.parse(v)])) : Object.fromEntries([].concat(keys).filter(k => data.has(k)).map(k => [k, JSON.parse(data.get(k))]))),
    set: async items => { for (const [k, v] of Object.entries(items)) data.set(k, JSON.stringify(v)); },
    remove: async keys => { for (const k of [].concat(keys)) data.delete(k); }
  };
}
const snapshot = groups => ({ person: { language: 'en' }, profiles: [{ id: 'main', name: 'Main', color: 'teal', config: { theme: 'aurora-void', groups } }] });
const folder = (id, label, links) => ({ id, label, cols: 2, links: links.map(([lid, name]) => ({ id: lid, name, url: `https://${lid}.example/` })) });
const names = view => view.profiles[0].config.groups.flatMap(g => g.links.map(l => l.name));
async function device(w, name, sync = null) {
  const engine = new NordlysSyncEngine({ local: area(), sync, relay: w.relay, deviceName: name });
  await engine.load();
  return engine;
}

test('a code is 20 characters, shown in fives, and read back however it was typed', () => {
  const code = Relay.newCode();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{20}$/);
  assert.match(Relay.showCode(code), /^(.{5}-){3}.{5}$/);
  assert.strictEqual(Relay.readCode(Relay.showCode(code).toLowerCase()), code);
  assert.strictEqual(Relay.readCode(` ${code.slice(0, 10)} ${code.slice(10)} `), code);
  assert.strictEqual(Relay.readCode('OIL0U-00000-00000-00000'), '0110V000000000000000');
  assert.strictEqual(Relay.readCode('too short'), null);
  assert.strictEqual(Relay.readCode(`${code}0`), null);
  assert.notStrictEqual(Relay.newCode(), code);
});

test('a board turned on with a code arrives on a device that enters the code', async () => {
  const w = await world();
  const code = Relay.newCode();
  const mac = await device(w, 'macOS · Safari');
  await mac.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail'], ['l2', 'Drive']])]), mode: 'merge', code });
  assert.strictEqual((await mac.status()).state, 'ready');
  assert.strictEqual((await mac.status()).code, code);
  const pc = await device(w, 'Windows · Helium');
  const view = await pc.enable({ snapshot: snapshot([]), mode: 'use-sync', code });
  assert.deepStrictEqual(names(view), ['Gmail', 'Drive']);
  assert.deepStrictEqual((await pc.status()).devices.map(d => d.name).sort(), ['Windows · Helium', 'macOS · Safari']);
  // The first device learns of the second on its next pull.
  await mac.pull();
  assert.strictEqual((await mac.status()).devices.length, 2);
});

test('edits travel both ways, and a device with another code sees none of it', async () => {
  const w = await world();
  const code = Relay.newCode();
  const a = await device(w, 'A');
  const b = await device(w, 'B');
  await a.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]), mode: 'merge', code });
  const start = await b.enable({ snapshot: snapshot([]), mode: 'use-sync', code });
  start.profiles[0].config.groups[0].links.push({ id: 'l9', name: 'Notes', url: 'https://notes.example/' });
  await b.push(start);
  assert.deepStrictEqual(names(await a.pull()), ['Gmail', 'Notes']);
  const stranger = await device(w, 'C');
  const own = await stranger.enable({ snapshot: snapshot([folder('g7', 'Mine', [['l7', 'Private']])]), mode: 'merge', code: Relay.newCode() });
  assert.deepStrictEqual(names(own), ['Private']);
  assert.strictEqual((await stranger.status()).devices.length, 1);
});

test('the relay holds nothing it could read: no name, address, device name or code', async () => {
  const w = await world();
  const code = Relay.newCode();
  const a = await device(w, 'Kitchen laptop');
  await a.enable({ snapshot: snapshot([folder('g1', 'Secret folder', [['l1', 'Private bank']])]), mode: 'merge', code });
  const kept = JSON.stringify([...w.store.rows.values()]) + w.calls.join(' ');
  for (const word of ['Secret', 'Private', 'bank', 'Kitchen', 'l1.example', code, a.state.device.id]) assert.ok(!kept.includes(word), `the relay saw "${word}"`);
  assert.ok(w.store.rows.size === 1);
});

test('a piece the code does not open is passed over, not taken for damage', async () => {
  const w = await world();
  const code = Relay.newCode();
  const a = await device(w, 'A');
  await a.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]), mode: 'merge', code });
  const room = [...w.store.rows.values()][0].room;
  await w.store.put(room, 'f'.repeat(32), Buffer.from('not ours at all, whoever wrote it').toString('base64'), Date.now());
  const b = await device(w, 'B');
  const view = await b.enable({ snapshot: snapshot([]), mode: 'use-sync', code });
  assert.deepStrictEqual(names(view), ['Gmail']);
  assert.strictEqual((await b.status()).state, 'ready');
});

test('a relay that does not answer leaves sync off when turning it on, and keeps the edit when it is on', async () => {
  const w = await world();
  const code = Relay.newCode();
  const a = await device(w, 'A');
  w.down(true);
  await assert.rejects(a.enable({ snapshot: snapshot([]), mode: 'merge', code }));
  assert.strictEqual(a.enabled(), false);
  assert.strictEqual((await a.status()).code, null);
  w.down(false);
  const view = await a.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]), mode: 'merge', code });
  w.down(true);
  view.profiles[0].config.groups[0].links.push({ id: 'l2', name: 'Drive', url: 'https://drive.example/' });
  await a.push(view);
  assert.strictEqual((await a.status()).state, 'error');
  w.down(false);
  await a.push(view);
  assert.strictEqual((await a.status()).state, 'ready');
  const b = await device(w, 'B');
  assert.deepStrictEqual(names(await b.enable({ snapshot: snapshot([]), mode: 'use-sync', code })), ['Gmail', 'Drive']);
});

test('forgetting a device takes its piece off the relay; turning sync off forgets the code here', async () => {
  const w = await world();
  const code = Relay.newCode();
  const a = await device(w, 'A');
  const b = await device(w, 'B');
  await a.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]), mode: 'merge', code });
  await b.enable({ snapshot: snapshot([]), mode: 'use-sync', code });
  assert.strictEqual(w.store.rows.size, 2);
  await a.forget(b.state.device.id);
  assert.strictEqual(w.store.rows.size, 1);
  await a.disable();
  assert.strictEqual(a.state.relay, null);
  assert.strictEqual((await a.status()).code, null);
});

test('nothing changed is answered without the pieces, and the browser way still works beside it', async () => {
  const w = await world();
  const code = Relay.newCode();
  const a = await device(w, 'A');
  await a.enable({ snapshot: snapshot([folder('g1', 'Daily', [['l1', 'Gmail']])]), mode: 'merge', code });
  const room = [...w.store.rows.values()][0].room;
  const first = await w.handle(new Request(`https://relay.test/v1/r/${room}`), w.store);
  const again = await w.handle(new Request(`https://relay.test/v1/r/${room}`, { headers: { 'If-None-Match': first.headers.get('ETag') } }), w.store);
  assert.strictEqual(again.status, 304);
  assert.strictEqual(await a.pull(), null);
  const browser = area();
  const c = await device(w, 'C', browser);
  await c.enable({ snapshot: snapshot([folder('g2', 'Work', [['l5', 'Jira']])]), mode: 'merge' });
  assert.strictEqual((await c.status()).code, null);
  assert.ok(Object.keys(await browser.get(null)).some(key => key.startsWith('nl.sync.2.')));
  assert.strictEqual(w.store.rows.size, 1);
});

test('the relay refuses what is not a piece, a thirteenth device, and names that are not names', async () => {
  const w = await world();
  const room = 'a'.repeat(32);
  const put = (device, body) => w.handle(new Request(`https://relay.test/v1/r/${room}/${device}`, { method: 'PUT', body }), w.store);
  const name = n => n.toString(16).padStart(32, '0');
  for (let n = 0; n < w.LIMITS.devices; n++) assert.strictEqual((await put(name(n), 'QUJD')).status, 204);
  assert.strictEqual((await put(name(99), 'QUJD')).status, 409);
  assert.strictEqual((await put(name(0), 'QUJE')).status, 204, 'a device already in the room may still write');
  assert.strictEqual((await put(name(0), '<script>')).status, 413);
  assert.strictEqual((await put(name(0), 'A'.repeat(w.LIMITS.piece + 4))).status, 413);
  assert.strictEqual((await put('../etc', 'QUJD')).status, 400);
  assert.strictEqual((await w.handle(new Request('https://relay.test/v1/r/short'), w.store)).status, 400);
  assert.strictEqual((await w.handle(new Request('https://relay.test/'), w.store)).status, 404);
  const options = await w.handle(new Request(`https://relay.test/v1/r/${room}`, { method: 'OPTIONS' }), w.store);
  assert.strictEqual(options.headers.get('Access-Control-Allow-Origin'), '*');
  const { prune } = await core;
  await prune(w.store, Date.now() + (w.LIMITS.idleDays + 1) * 86400000);
  assert.strictEqual(w.store.rows.size, 0);
});
