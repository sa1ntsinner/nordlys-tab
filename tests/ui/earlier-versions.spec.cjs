const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Earlier versions: the one place a way back is kept. A copy of the whole
   setup is made a little after every change, and before each thing that
   replaces the setup: an update of the extension, an import, a reset, an
   older copy put back. Each copy says which, with the time. They are kept on
   this device in an IndexedDB of their own (autosave.js), which a reset
   leaves alone, and any of them can be put back from Settings → Backup.

   Until 2.6.4 there were four stores for this, each with its own rules; what
   they held is moved over on the first new tab. */

const list = page => page.evaluate(() => window.NordlysAutosave.list(true));
const setFolders = (page, labels) => page.evaluate((names) => {
  window.Nordlys.config.groups = names.map((label) => ({ label, cols: 2, links: [{ name: label, url: `https://${label.toLowerCase()}.test/` }] }));
  window.Nordlys.saveConfig();
  return window.Nordlys.keepCopy();
}, labels);
const ready = page => page.waitForFunction(() => Boolean(window.Nordlys?.settings));
const labels = page => page.evaluate(() => window.Nordlys.config.groups.map(group => group.label));

async function openBackup(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
}

async function reset(page) {
  await openBackup(page);
  const reloaded = page.waitForEvent('load');
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await reloaded;
  await ready(page);
}

async function putBack(page, row) {
  const reloaded = page.waitForEvent('load');
  await row.getByRole('button', { name: 'Put it back' }).click();
  await page.locator('#confirm-modal').getByRole('button', { name: 'Put it back' }).click();
  await reloaded;
  await ready(page);
}

// No copy can be written: what a full or refused IndexedDB looks like to the page.
const refuseCopies = page => page.evaluate(() => { window.NordlysAutosave.keep = () => Promise.reject(new Error('no room')); });

test.beforeEach(async ({ nordlysPage }) => {
  // The fixture's own first load counts as an update from a build that kept no version.
  await expect.poll(() => nordlysPage.page.evaluate(() => localStorage.getItem('nordlys_seen_version'))).not.toBeNull();
  await nordlysPage.page.evaluate(() => window.NordlysAutosave.clear());
});

/* ── After a change ──────────────────────────────────────────────── */

test('a change is kept once, with what it holds; the same setup is not kept twice', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await setFolders(page, ['One']);
  await setFolders(page, ['One']);
  expect((await list(page)).length).toBe(1);
  await setFolders(page, ['One', 'Two']);
  const copies = await list(page);
  expect(copies.map((copy) => [copy.folders, copy.links, copy.cause])).toEqual([[2, 2, undefined], [1, 1, undefined]]);
  expect(Date.parse(copies[0].savedAt)).toBeGreaterThan(Date.parse(copies[1].savedAt) - 1);
  expect(runtimeErrors).toEqual([]);
});

test('opening new tabs without changing anything keeps nothing more', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['One']);
  for (let i = 0; i < 2; i += 1) {
    await page.reload();
    await ready(page);
    await page.evaluate(() => window.Nordlys.keepCopy());
  }
  expect((await list(page)).length).toBe(1);
});

test('a copy holds what the cards hold and the other spaces, never a service\'s keys', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => new Promise(resolve => {
    localStorage.setItem('nordlys_profiles', JSON.stringify({ version: 1, active: 'p1', list: [{ id: 'p1', name: 'Home', color: 'teal' }, { id: 'p2', name: 'Work', color: 'amber' }], deleted: [] }));
    chrome.storage.local.set({ 'nordlys_profile.p2': { groups: [{ label: 'WORK', cols: 2, hidden: false, links: [] }] }, 'nordlys_dash.n1': { text: 'mine' }, nordlys_connections: { todoist: { token: 'secret' } } }, resolve);
  }));
  await page.reload();
  await ready(page);
  await page.evaluate(() => window.Nordlys.keepCopy());
  const [copy] = await list(page);
  expect(copy.spaces).toBe(2);
  expect(copy.file.nordlysBackup.dashboardData.n1).toEqual({ text: 'mine' });
  expect(copy.file.nordlysBackup.spaces.list.find(space => space.id === 'p2').config.groups[0].label).toBe('WORK');
  expect(JSON.stringify(copy.file)).not.toContain('secret');
  await openBackup(page);
  await expect(page.locator('.autosave-copy').first()).toContainText('spaces: 2');
});

test('the list is read when Backup is opened, not on the way to the board', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['One']);
  await page.evaluate(() => { window.__listed = 0; const real = window.NordlysAutosave.list; window.NordlysAutosave.list = (...args) => { window.__listed += 1; return real(...args); }; });
  await setFolders(page, ['One', 'Two']);
  expect(await page.evaluate(() => window.__listed)).toBe(0);
  await openBackup(page);
  await expect(page.locator('.autosave-copy')).toHaveCount(2);
  // Once it is open, a copy kept meanwhile shows up.
  await setFolders(page, ['One', 'Two', 'Three']);
  await expect(page.locator('.autosave-copy')).toHaveCount(3);
});

/* Every new tab used to build the whole setup as a file, three seconds in,
   only to find the newest copy already held it. */
test('a new tab after which nothing changed does not read the setup to find that out', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['One']);
  await page.reload();
  await ready(page);
  await page.evaluate(() => { window.__captured = 0; const real = window.Nordlys.captureFile.bind(window.Nordlys); window.Nordlys.captureFile = (...args) => { window.__captured += 1; return real(...args); }; });
  await page.waitForTimeout(3600);
  expect(await page.evaluate(() => window.__captured)).toBe(0);
  expect((await list(page)).length).toBe(1);
});

test('a change the last tab was closed on is kept by the next one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['One']);
  // Saved, and the tab gone before its fifteen seconds were up.
  await page.evaluate(() => { window.Nordlys.config.groups[0].label = 'Renamed'; window.Nordlys.saveConfig(); });
  await page.reload();
  await ready(page);
  await expect.poll(async () => (await list(page)).map(copy => copy.file.groups[0].label), { timeout: 8000 }).toEqual(['Renamed', 'One']);
});

/* Until 2.6.4 a copy was one record, the file and the line about it together. */
test('copies kept by an earlier build are still there, each with its line', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => new Promise((resolve, reject) => {
    const gone = indexedDB.deleteDatabase('nordlys_autosaves');
    gone.onerror = () => reject(gone.error);
    gone.onsuccess = () => {
      const open = indexedDB.open('nordlys_autosaves', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('copies', { keyPath: 'id' });
      open.onsuccess = () => {
        const database = open.result;
        const write = database.transaction('copies', 'readwrite');
        const file = label => ({ groups: [{ label, cols: 2, links: [{ name: label, url: 'https://kept.test/' }] }], nordlysBackup: { formatVersion: 1, savedAt: '2026-11-16T10:00:00.000Z' } });
        write.objectStore('copies').put({ id: 1794700000000, savedAt: '2026-11-16T10:00:00.000Z', file: file('Older'), folders: 1, links: 1 });
        write.objectStore('copies').put({ id: 1794800000000, savedAt: '2026-11-17T10:00:00.000Z', file: file('Newer'), folders: 1, links: 1 });
        write.oncomplete = () => { database.close(); resolve(); };
      };
    };
  }));
  const copies = await list(page);
  expect(copies.map(copy => [copy.file.groups[0].label, copy.folders, copy.links, copy.spaces])).toEqual([['Newer', 1, 1, 1], ['Older', 1, 1, 1]]);
  expect(copies.every(copy => copy.size > 0 && typeof copy.sum === 'string')).toBe(true);
  // And the newest of them is known for the setup it holds: the same setup is not kept again.
  await page.evaluate(() => window.NordlysAutosave.keep({ groups: [{ label: 'Newer', cols: 2, links: [{ name: 'Newer', url: 'https://kept.test/' }] }], nordlysBackup: { formatVersion: 1, savedAt: '2026-11-18T10:00:00.000Z' } }));
  expect((await list(page)).length).toBe(2);
  await openBackup(page);
  await expect(page.locator('.autosave-copy')).toHaveCount(2);
});

test('Forget them all deletes the copies and leaves the setup', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['Stays']);
  await openBackup(page);
  await page.locator('#autosaves-forget').click();
  await page.locator('#confirm-modal').getByRole('button', { name: 'Forget them all' }).click();
  await expect(page.locator('#autosaves')).toBeHidden();
  expect(await list(page)).toEqual([]);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].label)).toBe('Stays');
});

test('with no copy there is no list to promise one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackup(page);
  await expect(page.locator('#autosaves')).toBeHidden();
});

/* ── Before an update ────────────────────────────────────────────── */

async function seedOlderVersion(page) {
  await page.evaluate(() => {
    localStorage.setItem('nordlys_seen_version', '2.4.0');
    localStorage.setItem('nordlys_config', JSON.stringify({ theme: 'gruvbox-dark', bgMode: 'pillars', groups: [{ label: 'Before', cols: 2, hidden: false, links: [{ name: 'Old', url: 'https://old.test/', icon: 'globe', color: '#fabd2f' }] }] }));
  });
  await page.reload();
  await ready(page);
}
const updates = async page => (await list(page)).filter(copy => copy.cause === 'update');

test('a new version keeps a copy of the setup as it was, once', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await seedOlderVersion(page);
  await expect.poll(async () => (await updates(page)).length).toBe(1);
  const [copy] = await updates(page);
  expect(copy.from).toBe('2.4.0');
  // As stored, before the retired sky was moved on.
  expect(JSON.stringify(copy.file)).toContain('pillars');
  expect(await page.evaluate(() => window.Nordlys.config.bgMode)).toBe('meteors');
  await page.reload();
  await ready(page);
  await page.waitForTimeout(300);
  expect((await updates(page)).length).toBe(1);
  await openBackup(page);
  await expect(page.locator('.autosave-copy[data-cause="update"]')).toContainText('Before the update to');
  expect(runtimeErrors).toEqual([]);
});

test('a new tab of the same version keeps no copy', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.reload();
  await ready(page);
  await page.waitForTimeout(300);
  expect(await updates(page)).toEqual([]);
});

/* A board too big for localStorage lives in browser storage alone. The copy
   before an update was taken from localStorage, so for that board it was
   either an older one or none at all, and the version was marked seen. */
test('the copy before an update is of the newest board, also when only browser storage has it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => new Promise(resolve => {
    localStorage.setItem('nordlys_seen_version', '2.4.0');
    localStorage.setItem('nordlys_config', JSON.stringify({ groups: [{ label: 'Stale', cols: 2, hidden: false, links: [] }] }));
    localStorage.setItem('nordlys_config_saved_at', '1000');
    chrome.storage.local.set({ nordlys_config: { groups: [{ label: 'Newest', cols: 2, hidden: false, links: [] }] }, nordlys_config_saved_at: 2000 }, resolve);
  }));
  await page.reload();
  await ready(page);
  await expect.poll(async () => (await updates(page)).map(copy => copy.file.groups[0].label)).toEqual(['Newest']);
  expect(await labels(page)).toEqual(['Newest']);
});

test('a copy that could not be written is tried again on the next new tab', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // The first load after this cannot write its copy; the ones after can.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__refused_once')) return;
    sessionStorage.setItem('__refused_once', '1');
    let held;
    Object.defineProperty(window, 'NordlysAutosave', { configurable: true, get: () => held, set(api) { held = Object.assign({}, api, { keep: () => Promise.reject(new Error('no room')) }); } });
  });
  await seedOlderVersion(page);
  await page.waitForTimeout(300);
  expect(await updates(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('nordlys_seen_version'))).toBe('2.4.0');
  await page.reload();
  await ready(page);
  await expect.poll(async () => (await updates(page)).length).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('nordlys_seen_version'))).not.toBe('2.4.0');
});

/* ── What the four older stores held ─────────────────────────────── */

test('copies from the older stores are moved over with their causes and dates, and the old stores go', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => new Promise(resolve => {
    const one = label => ({ theme: 'gruvbox-dark', groups: [{ label, cols: 2, hidden: false, links: [] }] });
    localStorage.setItem('nordlys_restore_point', JSON.stringify({ savedAt: '2026-09-01T10:00:00.000Z', cause: 'import', version: '2.5.0', config: one('BEFORE IMPORT') }));
    localStorage.setItem('nordlys_undo_point', JSON.stringify({ savedAt: '2026-10-01T10:00:00.000Z', cause: 'reset', version: '2.5.3', media: true, customThemes: [{ name: 'Mine', bg: '#101317' }], drawerWidth: '712px',
      profiles: JSON.stringify({ version: 1, active: 'p1', list: [{ id: 'p1', name: 'Home', color: 'teal' }, { id: 'p2', name: 'Work', color: 'amber' }], deleted: [] }), config: one('BEFORE RESET') }));
    chrome.storage.local.set({
      nordlys_reset_copy: { savedAt: '2026-10-01T10:00:00.000Z', items: { 'nordlys_profile.p2': one('WORK'), 'nordlys_dash.n1': { text: 'mine' } } },
      nordlys_update_copies: [
        { savedAt: '2026-11-01T10:00:00.000Z', from: '2.6.1', to: '2.6.2', file: one('BEFORE 2.6.2') },
        { savedAt: '2026-08-01T10:00:00.000Z', from: '2.5.0', to: '2.5.1', file: one('BEFORE 2.5.1') }
      ]
    }, resolve);
  }));
  await page.reload();
  await ready(page);
  await expect.poll(async () => (await list(page)).length).toBe(4);
  const copies = await list(page);
  expect(copies.map(copy => [copy.cause, copy.savedAt, copy.file.groups[0].label])).toEqual([
    ['update', '2026-11-01T10:00:00.000Z', 'BEFORE 2.6.2'],
    ['reset', '2026-10-01T10:00:00.000Z', 'BEFORE RESET'],
    ['import', '2026-09-01T10:00:00.000Z', 'BEFORE IMPORT'],
    ['update', '2026-08-01T10:00:00.000Z', 'BEFORE 2.5.1']
  ]);
  const before = copies[1];
  expect(before.media).toBe(true);
  expect(before.file.nordlysBackup.customThemes[0].name).toBe('Mine');
  expect(before.file.nordlysBackup.drawerWidth).toBe('712px');
  expect(before.file.nordlysBackup.dashboardData.n1).toEqual({ text: 'mine' });
  expect(before.file.nordlysBackup.spaces.list.find(space => space.id === 'p2').config.groups[0].label).toBe('WORK');
  expect(copies[0].to).toBe('2.6.2');
  expect(await page.evaluate(() => [localStorage.getItem('nordlys_restore_point'), localStorage.getItem('nordlys_undo_point')])).toEqual([null, null]);
  await expect.poll(() => 'nordlys_update_copies' in storageState || 'nordlys_reset_copy' in storageState).toBe(false);
  // Nothing is moved twice.
  await page.reload();
  await ready(page);
  await page.waitForTimeout(300);
  expect((await list(page)).length).toBe(4);
});

/* ── Before a reset ──────────────────────────────────────────────── */

test('the reset dialog says what goes and that there is a way back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackup(page);
  await page.locator('#cfg-reset').click();
  const message = await page.locator('#confirm-modal .confirm-message').innerText();
  expect(message, 'names what is removed').toMatch(/bookmark|folder/i);
  expect(message, 'names the way back').toMatch(/Earlier versions/);
  // Focus starts on the safe answer, so a reflexive Enter cannot reset anything.
  expect(await page.evaluate(() => document.activeElement?.classList.contains('confirm-cancel'))).toBe(true);
  await page.locator('#confirm-modal .confirm-cancel').click();
  await expect(page.locator('#board .tile').first()).toBeVisible();
});

test('a reset keeps everything it removed, and the board comes back whole', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    localStorage.setItem('nordlys_custom_themes', JSON.stringify([{ name: 'Mine', bg: '#101317' }]));
    localStorage.setItem('nordlys_drawer_width', '712px');
  });
  const before = await labels(page);
  await reset(page);
  expect((await labels(page)).length, 'the reset happened').toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('nordlys_custom_themes'))).toBeNull();
  const copies = await list(page);
  expect(copies[0].cause).toBe('reset');
  expect(copies[0].file.groups.map(group => group.label)).toEqual(before);

  await openBackup(page);
  const row = page.locator('.autosave-copy[data-cause="reset"]');
  await expect(row).toContainText('Before a reset');
  await putBack(page, row);
  expect(await labels(page)).toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_custom_themes'))[0].name), 'a theme someone authored is not collateral').toBe('Mine');
  expect(await page.evaluate(() => localStorage.getItem('nordlys_drawer_width'))).toBe('712px');
  await expect(page.locator('#board .card').first()).toBeVisible();
});

/* A reset clears browser storage too: the other spaces, what the cards held. */
test('the copy kept before a reset brings back the other spaces and what the cards held, never a service\'s keys', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => new Promise(resolve => {
    localStorage.setItem('nordlys_profiles', JSON.stringify({ version: 1, active: 'p1', list: [{ id: 'p1', name: 'Home', color: 'teal' }, { id: 'p2', name: 'Work', color: 'amber' }], deleted: [] }));
    chrome.storage.local.set({ 'nordlys_profile.p2': { groups: [{ label: 'WORK', cols: 2, hidden: false, links: [] }] }, 'nordlys_dash.n1': { text: 'mine' }, nordlys_connections: { todoist: { token: 'secret' } } }, resolve);
  }));
  await page.reload();
  await ready(page);
  await reset(page);
  expect(storageState['nordlys_dash.n1'], 'the reset happened').toBeUndefined();
  expect(storageState['nordlys_profile.p2']).toBeUndefined();

  await openBackup(page);
  await putBack(page, page.locator('.autosave-copy[data-cause="reset"]'));
  expect(storageState['nordlys_dash.n1']).toEqual({ text: 'mine' });
  expect(storageState['nordlys_profile.p2'].groups[0].label).toBe('WORK');
  const spaces = JSON.parse(await page.evaluate(() => localStorage.getItem('nordlys_profiles')));
  expect(spaces.list.map(space => space.name)).toEqual(['Home', 'Work']);
  expect(spaces.active).toBe('p1');
  expect(storageState.nordlys_connections, 'a reset is also how a service is taken off a device').toBeUndefined();
});

/* A wallpaper is far too large to sit inside a copy, so the reset moves it to
   one slot in the media vault instead of deleting it. */
test('a reset sets the wallpaper aside rather than deleting it, and its copy brings it back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => {
    await MediaVault.saveMedia('custom_bg', new Blob(['not really an image'], { type: 'image/png' }), 'image/png');
    window.Nordlys.config.bgMode = 'wallpaper';
    window.Nordlys.saveConfig();
  });
  await reset(page);
  expect(await page.evaluate(async () => Boolean(await MediaVault.getMedia('custom_bg'))), 'the reset removed it').toBe(false);
  expect((await list(page))[0].media, 'and recorded that it did').toBe(true);

  await openBackup(page);
  await putBack(page, page.locator('.autosave-copy[data-cause="reset"]'));
  expect(await page.evaluate(() => window.Nordlys.config.bgMode)).toBe('wallpaper');
  expect(await page.evaluate(async () => Boolean(await MediaVault.getMedia('custom_bg')))).toBe(true);
  expect(await page.evaluate(async () => Boolean(await MediaVault.getMedia('nordlys_undo_bg'))), 'one slot, handed back rather than hoarded').toBe(false);
});

/* If no copy can be written there is no way back. That is said, and the
   reset happens only if it is asked for a second time. */
test('a reset that cannot keep a copy says so, and does not happen unless asked again', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => { await MediaVault.saveMedia('custom_bg', new Blob(['the wallpaper on screen now'], { type: 'image/png' }), 'image/png'); });
  const before = await labels(page);
  await refuseCopies(page);
  await openBackup(page);
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await expect(page.locator('#confirm-modal .confirm-message')).toContainText('cannot be taken back');
  await page.locator('#confirm-modal .confirm-cancel').click();
  await page.waitForTimeout(600);
  expect(await labels(page), 'nothing was reset').toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).groups.length)).toBe(before.length);
  expect(await page.evaluate(async () => (await MediaVault.getMedia('custom_bg')).text()), 'the live wallpaper is where it was').toBe('the wallpaper on screen now');
  expect(await page.evaluate(async () => Boolean(await MediaVault.getMedia('nordlys_undo_bg'))), 'and the slot beside it was not spent').toBe(false);

  const reloaded = page.waitForEvent('load');
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await reloaded;
  await ready(page);
  expect((await labels(page)).length, 'asked twice, it happens').toBe(0);
});

test('a reset leaves the earlier versions alone', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['One']);
  await setFolders(page, ['One', 'Two']);
  await reset(page);
  const copies = await list(page);
  expect(copies.map(copy => copy.cause || 'change')).toEqual(['reset', 'change', 'change']);
});

/* No modal cascade: one question, then the action. */
test('reset asks exactly once', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await reset(page);
  await expect(page.locator('#confirm-modal')).toBeHidden();
});

/* ── Putting a copy back ─────────────────────────────────────────── */

test('the dialog distinguishes its title, its question and its button', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['Before']);
  await openBackup(page);
  await page.locator('.autosave-copy').first().getByRole('button', { name: 'Put it back' }).click();
  const dialog = await page.evaluate(() => ({
    title: document.querySelector('#confirm-modal .confirm-title').textContent.trim(),
    message: document.querySelector('#confirm-modal .confirm-message').textContent.trim(),
    confirm: document.querySelector('#confirm-modal .confirm-ok').textContent.trim()
  }));
  expect(dialog.title).not.toBe(dialog.message);
  expect(dialog.message).not.toBe(dialog.confirm);
  expect(dialog.message, 'says the current setup is replaced').toMatch(/replace/i);
  expect(dialog.message, 'says it can be taken back').toMatch(/undo|back/i);
});

test('an earlier version is put back, and what it replaced is kept as a copy that says so', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['Before']);
  await setFolders(page, ['After']);
  await openBackup(page);
  await expect(page.locator('.autosave-copy')).toHaveCount(2);
  await expect(page.locator('.autosave-copy').first()).toContainText('Bookmarks: 1, folders: 1');
  await putBack(page, page.locator('.autosave-copy').nth(1));
  expect(await labels(page)).toEqual(['Before']);
  const copies = await list(page);
  expect(copies[0].cause).toBe('restore');
  expect(copies[0].file.groups[0].label).toBe('After');
  // And that one goes back the same way: there is no step that cannot be retraced.
  await openBackup(page);
  await expect(page.locator('.autosave-copy[data-cause="restore"]')).toContainText('Before an earlier version was put back');
  await putBack(page, page.locator('.autosave-copy[data-cause="restore"]').first());
  expect(await labels(page)).toEqual(['After']);
});

test('a copy that cannot be kept first means nothing is replaced', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['Before']);
  await setFolders(page, ['After']);
  await openBackup(page);
  await refuseCopies(page);
  await page.locator('.autosave-copy').nth(1).getByRole('button', { name: 'Put it back' }).click();
  await page.locator('#confirm-modal').getByRole('button', { name: 'Put it back' }).click();
  await expect(page.locator('#toast-dock .toast').first()).toBeVisible();
  await page.waitForTimeout(400);
  expect(await labels(page)).toEqual(['After']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).groups[0].label)).toBe('After');
});

test('a space here that the copy does not have is not lost: it waits among the deleted ones', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  const meta = list => JSON.stringify({ version: 1, active: 'p1', list, deleted: [] });
  await page.evaluate(([two]) => new Promise(resolve => {
    localStorage.setItem('nordlys_profiles', two);
    chrome.storage.local.set({ 'nordlys_profile.p2': { groups: [{ label: 'WORK', cols: 2, hidden: false, links: [] }] } }, resolve);
  }), [meta([{ id: 'p1', name: 'Home', color: 'teal' }, { id: 'p2', name: 'Work', color: 'amber' }])]);
  await page.reload();
  await ready(page);
  await page.evaluate(() => window.Nordlys.keepCopy());
  // A third space is made after the copy.
  await page.evaluate(([three]) => new Promise(resolve => {
    localStorage.setItem('nordlys_profiles', three);
    chrome.storage.local.set({ 'nordlys_profile.p3': { groups: [{ label: 'LATER', cols: 2, hidden: false, links: [] }] } }, resolve);
  }), [meta([{ id: 'p1', name: 'Home', color: 'teal' }, { id: 'p2', name: 'Work', color: 'amber' }, { id: 'p3', name: 'Later', color: 'violet' }])]);
  await page.reload();
  await ready(page);
  await openBackup(page);
  await putBack(page, page.locator('.autosave-copy').last());
  const spaces = JSON.parse(await page.evaluate(() => localStorage.getItem('nordlys_profiles')));
  expect(spaces.list.map(space => space.id)).toEqual(['p1', 'p2']);
  expect(spaces.deleted.map(space => space.id)).toEqual(['p3']);
  expect(storageState['nordlys_profile.p3'].groups[0].label).toBe('LATER');
});

/* ── The list itself ─────────────────────────────────────────────── */

test('the list fits at 320px', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 320, height: 640 });
  await setFolders(page, ['One']);
  await page.evaluate(() => window.Nordlys.keepCopy('restore'));
  await openBackup(page);
  for (const target of ['#autosaves', '.autosave-copy[data-cause="restore"]', '.autosave-copy[data-cause="restore"] .update-copy-actions', '#autosaves-forget']) {
    const box = await page.locator(target).first().boundingBox();
    expect(box, `${target} is on screen`).not.toBeNull();
    expect(box.x, `${target} starts inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${target} ends inside the viewport`).toBeLessThanOrEqual(321);
  }
});

/* ── Two tabs ────────────────────────────────────────────────────── */

/* A board too big for localStorage is saved to browser storage alone, and no
   storage event tells the other open tabs: they kept their older board, and
   wrote it over the newer one at their next change. */
test('a save that only browser storage took reaches a tab that is already open', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const at = Date.now() + 60000;
  const board = { groups: [{ label: 'From the other tab', cols: 2, hidden: false, links: [] }] };
  await page.evaluate(([config, when]) => window.__storageChanged({ nordlys_config: { newValue: config }, nordlys_config_saved_at: { newValue: when } }, 'local'), [board, at]);
  await expect.poll(() => labels(page)).toEqual(['From the other tab']);
});

test('a save that localStorage took as well is left to the storage event, and this tab\'s own is not taken twice', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await labels(page);
  const board = { groups: [{ label: 'Older', cols: 2, hidden: false, links: [] }] };
  // Not newer than the fast copy: the other tab's save fitted there too.
  await page.evaluate(([config]) => { window.Nordlys.saveConfig(); window.__storageChanged({ nordlys_config: { newValue: config }, nordlys_config_saved_at: { newValue: Number(localStorage.getItem('nordlys_config_saved_at')) - 5 } }, 'local'); }, [board]);
  await page.waitForTimeout(200);
  expect(await labels(page)).toEqual(before);
});
