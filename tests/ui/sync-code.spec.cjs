const { test, expect } = require('../helpers/nordlys-fixture.cjs');
globalThis.NordlysSyncModel = require('../../src/js/sync-model.js');
const NordlysSyncEngine = require('../../src/js/sync-engine.js');
const Relay = require('../../src/js/sync-relay.js');

/* Sync with a code, on the page (sync-ui.js, sync-client.js, sync-relay.js).
   The relay is its real rules (relay/src/core.js) over a store in memory,
   answering in place of the network; the other device is an engine here. */
async function relayFor(page) {
  const { handle, memoryStore } = await import('../../relay/src/core.js');
  const store = memoryStore();
  const asked = [];
  let down = false;
  const answer = (url, options = {}) => handle(new Request(url, { method: options.method, headers: options.headers, body: options.body }), store);
  await page.route(`${Relay.URL}/**`, async route => {
    const request = route.request();
    asked.push(`${request.method()} ${new URL(request.url()).pathname}`);
    if (down) return route.abort('connectionrefused');
    /* Asked afresh every time: Playwright's WebKit cannot hand a page a 304.
       The unit tests cover the answer without the pieces. */
    const headers = { ...request.headers() };
    delete headers['if-none-match'];
    const response = await answer(request.url(), { method: request.method(), headers, body: request.postData() ?? undefined });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  return { store, asked, answer, down: value => { down = value; } };
}
function area() {
  const data = new Map();
  return {
    get: async keys => (keys == null ? Object.fromEntries([...data].map(([k, v]) => [k, JSON.parse(v)])) : {}),
    set: async items => { for (const [k, v] of Object.entries(items)) data.set(k, JSON.stringify(v)); },
    remove: async keys => { for (const k of [].concat(keys)) data.delete(k); }
  };
}
async function otherDevice(relay, name) {
  const engine = new NordlysSyncEngine({ local: area(), relay: code => Relay.create(code, { fetchImpl: relay.answer }), deviceName: name });
  await engine.load();
  return engine;
}
const labels = page => page.evaluate(() => window.Nordlys.config.groups.map(group => group.label));
async function openSync(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-sync').click();
}
async function choose(page, way) {
  await page.locator('label.tg:has(#cfg-sync-on)').click();
  await page.locator(`#nl-form-modal input[name="way"][value="${way}"]`).check();
  await page.locator('#nl-form-ok').click();
}

test('a new code turns sync on, shows the code, and a device that enters it gets the board', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  await openSync(page);
  await choose(page, 'new');
  await expect(page.locator('#sec-sync .sync-state')).toHaveClass(/is-ready/);
  const shown = await page.locator('#sec-sync .sync-code').textContent();
  expect(shown).toMatch(/^([0-9A-Z]{5}-){3}[0-9A-Z]{5}$/);
  // The browser's own sync was not touched, and the relay holds one sealed piece.
  expect(Object.keys(await page.evaluate(() => window.__syncState()))).toEqual([]);
  expect(relay.store.rows.size).toBe(1);
  const mine = await labels(page);
  expect(JSON.stringify([...relay.store.rows.values()])).not.toContain(mine[0]);

  const laptop = await otherDevice(relay, 'Laptop');
  const view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code: Relay.readCode(shown) });
  expect(view.profiles[0].config.groups.map(group => group.label)).toEqual(mine);

  // The laptop renames a folder; this page learns of it when it asks.
  view.profiles[0].config.groups[0].label = 'Renamed on the laptop';
  await laptop.push(view);
  await page.evaluate(() => window.Nordlys.sync.pullNow());
  await expect.poll(() => labels(page)).toContain('Renamed on the laptop');
  await expect(page.locator('#sec-sync .sync-device')).toHaveCount(2);
  await expect(page.locator('#sec-sync .sync-device', { hasText: 'Laptop' })).toBeVisible();
});

test('entering a code joins the devices that have it; a wrong one is refused', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  const code = Relay.newCode();
  const desktop = await otherDevice(relay, 'Desktop');
  await desktop.enable({
    snapshot: { person: {}, profiles: [{ id: 'main', name: 'Main', color: 'teal', config: { theme: 'aurora-void', groups: [{ id: 'g-far', label: 'From the desktop', cols: 2, links: [{ id: 'l-far', name: 'Far', url: 'https://far.example/' }] }] } }] },
    mode: 'merge', code
  });
  await openSync(page);
  await choose(page, 'join');
  const field = page.locator('#nl-form-modal input[name="code"]');
  // Not a code at all, then a code nobody uses: both keep the question open.
  await field.fill('hello');
  await page.locator('#nl-form-ok').click();
  await expect(page.getByText('That is not a code').first()).toBeVisible();
  await expect(field).toHaveValue('hello');
  const unused = Relay.showCode(Relay.newCode());
  await field.fill(unused);
  await page.locator('#nl-form-ok').click();
  await expect(page.getByText('No device syncs with this code').first()).toBeVisible();
  await expect(field).toHaveValue(unused);
  expect(await page.evaluate(() => window.Nordlys.sync.syncing())).toBe(false);
  // Typed the way people type: lower case, spaces.
  await field.fill(Relay.showCode(code).toLowerCase().replace(/-/g, ' '));
  await page.locator('#nl-form-ok').click();
  // The devices already have a setup, so this one is asked what to do with its own.
  await expect(page.locator('#nl-form-modal input[name="mode"]:checked')).toHaveValue('use-sync');
  await page.locator('#nl-form-ok').click();
  await expect(page.locator('#sec-sync .sync-state')).toHaveClass(/is-ready/);
  await expect.poll(() => labels(page)).toEqual(['From the desktop']);
  await expect(page.locator('#sec-sync .sync-code')).toHaveText(Relay.showCode(code));
});

test('a new tab asks the relay once and takes what changed; turning sync off stops the asking', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  await openSync(page);
  await choose(page, 'new');
  await expect(page.locator('#sec-sync .sync-state')).toHaveClass(/is-ready/);
  const code = Relay.readCode(await page.locator('#sec-sync .sync-code').textContent());
  const laptop = await otherDevice(relay, 'Laptop');
  const view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code });
  view.profiles[0].config.groups[0].label = 'Changed while this tab was closed';
  await laptop.push(view);

  await page.evaluate(() => localStorage.removeItem('nordlys_relay_asked'));
  relay.asked.length = 0;
  await page.reload();
  await expect.poll(() => labels(page), { timeout: 8000 }).toContain('Changed while this tab was closed');
  expect(relay.asked.filter(line => line.startsWith('GET')).length).toBeGreaterThan(0);

  await openSync(page);
  await page.locator('label.tg:has(#cfg-sync-on)').click();
  await expect(page.locator('#sec-sync .sync-code')).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem('nordlys_relay_asked'));
  relay.asked.length = 0;
  await page.reload();
  await page.waitForTimeout(1500);
  expect(relay.asked).toEqual([]);
});

test('a relay that does not answer leaves the switch off and says so', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  relay.down(true);
  await openSync(page);
  await choose(page, 'new');
  await expect(page.locator('#cfg-sync-on')).not.toBeChecked();
  await expect(page.locator('.toast, [role="alert"], [role="status"]').filter({ hasText: /didn't answer/ }).first()).toBeVisible();
  expect(await page.evaluate(() => window.Nordlys.sync.syncing())).toBe(false);
});
