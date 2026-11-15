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

/* A push waits a moment after an edit. A tab closed or left inside that
   moment used to drop it, and the next tab's pull put the stored copy,
   without the edit, over the board. */
test('an edit left unsent when the tab closes is sent by the next tab, before it pulls', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  const code = Relay.newCode();
  await page.evaluate(code => window.Nordlys.sync.enable('merge', code), code);
  const laptop = await otherDevice(relay, 'Laptop');
  let view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code });
  view.profiles[0].config.groups[1].label = 'Changed on the laptop';
  await laptop.push(view);
  // An edit here, and the tab goes at once: no time for its push.
  await page.evaluate(() => {
    window.Nordlys.config.groups[0].label = 'Edited here';
    window.Nordlys.saveConfig();
    localStorage.removeItem('nordlys_relay_asked');
  });
  await page.reload();
  await expect.poll(() => labels(page), { timeout: 8000 }).toContain('Changed on the laptop');
  expect(await labels(page)).toContain('Edited here');
  await expect.poll(async () => { view = await laptop.pull() || view; return view.profiles[0].config.groups[0].label; }, { timeout: 8000 }).toBe('Edited here');
});

test('a send that failed is tried again when the next tab opens, without another edit', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  const code = Relay.newCode();
  await page.evaluate(code => window.Nordlys.sync.enable('merge', code), code);
  const laptop = await otherDevice(relay, 'Laptop');
  let view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code });
  // This page has taken all there is, so the next pull brings nothing that would send by itself.
  await page.evaluate(() => window.Nordlys.sync.pullNow());
  relay.down(true);
  await page.evaluate(async () => {
    window.Nordlys.config.groups[0].label = 'Edited while offline';
    window.Nordlys.saveConfig();
    await window.Nordlys.sync.pushNow();
  });
  relay.down(false);
  await page.evaluate(() => localStorage.removeItem('nordlys_relay_asked'));
  await page.reload();
  await expect.poll(async () => { view = await laptop.pull() || view; return view.profiles[0].config.groups[0].label; }, { timeout: 8000 }).toBe('Edited while offline');
});

/* An icon chosen on one device is a picture kept in the bookmark, too large
   for the sync items, so the other device used to fall back to a letter or a
   glyph. Each picture now travels on its own beside the items. */
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
test('an icon picture chosen here reaches the device that enters the code', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  await page.evaluate(picture => { const link = window.Nordlys.config.groups[0].links[0]; link.customImg = picture; window.Nordlys.saveConfig(); }, RED);
  const code = Relay.newCode();
  await page.evaluate(code => window.Nordlys.sync.enable('merge', code), code);
  const laptop = await otherDevice(relay, 'Laptop');
  const view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code });
  const link = view.profiles[0].config.groups[0].links[0];
  expect(link.customImg).toBeUndefined();
  expect(link.iconRef).toMatch(/^[0-9a-f]{32}$/);
  expect(await Relay.create(code, { fetchImpl: relay.answer }).getPicture(link.iconRef)).toBe(RED);
});

test('an icon picture chosen on another device is fetched and shown here', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  const code = Relay.newCode();
  const desktop = await otherDevice(relay, 'Desktop');
  const ref = require('node:crypto').createHash('sha256').update(RED).digest('hex').slice(0, 32);
  await Relay.create(code, { fetchImpl: relay.answer }).putPicture(ref, RED);
  await desktop.enable({
    snapshot: { person: {}, profiles: [{ id: 'main', name: 'Main', color: 'teal', config: { theme: 'aurora-void', groups: [{ id: 'g-far', label: 'From the desktop', cols: 2, links: [{ id: 'l-far', name: 'Far', url: 'https://far.example/', iconRef: ref }] }] } }] },
    mode: 'merge', code
  });
  await page.evaluate(code => window.Nordlys.sync.enable('use-sync', code), code);
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links[0].customImg)).toBe(RED);
  await expect(page.locator('.nl-icon[data-icon-kind="raster"] img').first()).toHaveAttribute('src', RED);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links[0].iconRef)).toBe(ref);
});

const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
test('a board synced before pictures travelled sends them on its next load', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  const code = Relay.newCode();
  await page.evaluate(code => window.Nordlys.sync.enable('merge', code), code);
  const laptop = await otherDevice(relay, 'Laptop');
  let view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code });
  const id = view.profiles[0].config.groups[0].links[0].id;
  // The laptop holds an older picture of its own for the same bookmark, as the earlier build left it.
  view.profiles[0].config.groups[0].links[0].customImg = BLUE;
  await laptop.push(view);
  // Here the picture is put on the bookmark by a build that did not send pictures.
  await page.evaluate(picture => { const link = window.Nordlys.config.groups[0].links[0]; link.customImg = picture; delete link.iconRef; window.Nordlys.sync.saveQuietly(); }, RED);
  await page.evaluate(() => localStorage.removeItem('nordlys_relay_asked'));
  await page.reload();
  const sent = async () => { view = await laptop.pull() || view; return view.profiles[0].config.groups[0].links.find(link => link.id === id).iconRef; };
  await expect.poll(sent, { timeout: 10000 }).toMatch(/^[0-9a-f]{32}$/);
  const ref = await sent();
  expect(await Relay.create(code, { fetchImpl: relay.answer }).getPicture(ref)).toBe(RED);
  // The page kept its own picture and the id stayed the one the laptop got.
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links[0].customImg)).toBe(RED);
});

test('a newer picture from another device replaces the one here and is not sent back over', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  const code = Relay.newCode();
  await page.evaluate(picture => { const link = window.Nordlys.config.groups[0].links[0]; link.customImg = picture; window.Nordlys.saveConfig(); }, BLUE);
  await page.evaluate(code => window.Nordlys.sync.enable('merge', code), code);
  const laptop = await otherDevice(relay, 'Laptop');
  const view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code });
  const link = view.profiles[0].config.groups[0].links[0];
  const ref = require('node:crypto').createHash('sha256').update(RED).digest('hex').slice(0, 32);
  await Relay.create(code, { fetchImpl: relay.answer }).putPicture(ref, RED);
  link.iconRef = ref;
  await laptop.push(view);
  await page.evaluate(() => window.Nordlys.sync.pullNow());
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links[0].customImg)).toBe(RED);
  await page.evaluate(() => window.Nordlys.sync.syncNow());
  const after = (await laptop.pull()) || view;
  expect(after.profiles[0].config.groups[0].links[0].iconRef).toBe(ref);
});

test('a picture too large to send travels drawn at the size a tile shows', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const relay = await relayFor(page);
  const big = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 300;
    const pen = canvas.getContext('2d');
    // Noise, which no format can make small.
    const noise = pen.createImageData(300, 300);
    let seed = 2463534242;
    for (let i = 0; i < noise.data.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      noise.data[i] = i % 4 === 3 ? 255 : seed & 255;
    }
    pen.putImageData(noise, 0, 0);
    const picture = canvas.toDataURL('image/png');
    const link = window.Nordlys.config.groups[0].links[0];
    link.customImg = picture; window.Nordlys.saveConfig();
    return picture;
  });
  expect(big.length).toBeGreaterThan(120000);
  const code = Relay.newCode();
  await page.evaluate(code => window.Nordlys.sync.enable('merge', code), code);
  const laptop = await otherDevice(relay, 'Laptop');
  const view = await laptop.enable({ snapshot: { person: {}, profiles: [] }, mode: 'use-sync', code });
  const picture = await Relay.create(code, { fetchImpl: relay.answer }).getPicture(view.profiles[0].config.groups[0].links[0].iconRef);
  expect(picture.length).toBeLessThanOrEqual(120000);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links[0].customImg)).toBe(picture);
});
