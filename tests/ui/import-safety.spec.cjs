const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const LEGACY_FIXTURE = join(__dirname, '..', 'fixtures', 'legacy-2.0-backup.json');

/* An import replaces the whole setup, so it is the one place a bad file can do
   lasting harm. The rule: nothing is written until the file has been checked,
   what was there before is kept in the restore point, and a file that cannot be
   used is refused with the reason rather than saved and discovered on the next
   open as a page that no longer starts. */

async function openBackupTab(page) {
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Backup' }).click();
}

async function dropFile(page, name, body) {
  await page.locator('#cfg-import-universal').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) });
}

async function importFile(page, name, body) {
  await openBackupTab(page);
  await dropFile(page, name, body);
}

test('a file whose groups is not a list is refused before anything is written', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await page.evaluate(() => ({
    live: JSON.stringify(window.Nordlys.config.groups.map(group => group.label)),
    // A fresh page has written nothing yet; whatever is there, it must stay so.
    stored: localStorage.getItem('nordlys_config')
  }));
  await importFile(page, 'broken.json', JSON.stringify({ theme: 'aurora-void', groups: {} }));

  // The refusal is said out loud, with what is wrong.
  await expect(page.locator('.toast, [role="status"], [role="alert"]').filter({ hasText: /groups should be a list/ }).first()).toBeVisible();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.config.groups.map(group => group.label))), 'the live setup is untouched').toBe(before.live);
  expect(await page.evaluate(() => localStorage.getItem('nordlys_config')), 'and nothing was written').toBe(before.stored);
  expect('nordlys_config' in nordlysPage.storageState && nordlysPage.storageState.nordlys_config?.groups?.constructor === Object, 'the mirror never received the broken shape').toBe(false);
});

test('a file that is not even an object is refused', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await importFile(page, 'list.json', JSON.stringify([1, 2, 3]));
  await expect(page.locator('.toast, [role="status"], [role="alert"]').filter({ hasText: /does not contain a settings object/ }).first()).toBeVisible();
  expect(await page.evaluate(() => Array.isArray(window.Nordlys.config.groups))).toBe(true);
});

test('a sound import keeps what it replaced in the restore point', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    localStorage.removeItem('nordlys_restore_point');
    window.Nordlys.config.groups[0].label = 'BEFORE IMPORT';
    window.Nordlys.saveConfig();
  });
  const loaded = page.waitForEvent('load');
  await importFile(page, 'ok.json', JSON.stringify({ theme: 'nordic-snow', groups: [{ label: 'AFTER IMPORT', cols: 2, hidden: false, links: [] }] }));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].label)).toBe('AFTER IMPORT');
  const point = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point') || 'null'));
  expect(point?.config?.groups?.[0]?.label, 'the previous setup can be brought back').toBe('BEFORE IMPORT');
});

test('a 2.0 backup with numeric range values stored as text still imports', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const loaded = page.waitForEvent('load');
  await importFile(page, 'nordlys-2.0.json', JSON.stringify({
    version: '2.0.0', theme: 'aurora-void', cardRadius: '22', tileSize: '86',
    groups: [{ label: 'FROM 2.0', cols: 2, hidden: false, links: [] }]
  }));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => ({
    label: window.Nordlys.config.groups[0]?.label,
    cardRadius: window.Nordlys.config.cardRadius,
    tileSize: window.Nordlys.config.tileSize
  }))).toEqual({ label: 'FROM 2.0', cardRadius: 22, tileSize: 86 });
});

/* Defence in depth: a config that is already broken in storage must not stop the
   page from starting. It is held as well as it can be, and the original is kept. */
test('a stored config with groups that is not a list still starts the page', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.evaluate(() => {
    localStorage.removeItem('nordlys_restore_point');
    const broken = { ...window.Nordlys.config, groups: {} };
    localStorage.setItem('nordlys_config', JSON.stringify(broken));
    window.chrome.storage.local.set({ nordlys_config: broken }, () => {});
  });
  runtimeErrors.length = 0;
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid), null, { timeout: 5000 });
  expect(runtimeErrors.filter(text => text.startsWith('pageerror')), 'no uncaught error on start').toEqual([]);
  expect(await page.evaluate(() => Array.isArray(window.Nordlys.config.groups))).toBe(true);
  const point = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point') || 'null'));
  expect(point, 'what was stored is kept for inspection').toBeTruthy();
});

/* There is one restore-point slot. An import took a snapshot of the setup being
   replaced — and then, if the imported file needed a migration, the reload took
   a second snapshot of the imported file over it. Every export from 2.1.0 to
   2.2.1 needs a migration, so the files people actually import were exactly the
   ones that lost the setup they replaced. */
test('importing a file that needs migrating still keeps the setup it replaced', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    localStorage.removeItem('nordlys_restore_point');
    window.Nordlys.config.groups[0].label = 'MY REAL SETUP';
    window.Nordlys.saveConfig();
  });
  const loaded = page.waitForEvent('load');
  // A 2.2.1-era export: glass sliders and an engine choice that no longer exist.
  await importFile(page, 'old-backup.json', JSON.stringify({
    version: '2.2.1', theme: 'liquid-glass', glassBlur: 0, defaultEngine: 'duckduckgo', bgMode: 'particles',
    groups: [{ label: 'FROM FILE', cols: 2, hidden: false, links: [] }]
  }));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].label)).toBe('FROM FILE');
  expect(await page.evaluate(() => window.Nordlys.config.theme), 'the import arrived migrated').toBe('frosted-glass');
  const point = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point') || 'null'));
  expect(point?.config?.groups?.[0]?.label, 'the setup being replaced is the one kept').toBe('MY REAL SETUP');
});

/* A real backup a user sent in, rebuilt field for field with invented content —
   nine folders, twenty-two bookmarks, embedded icons in four encodings, and the
   two range controls 2.0 wrote as text. See tests/unit/backup-file.test.cjs. */
test('a real-world 2.0 backup opens whole, icons and all', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const file = JSON.parse(readFileSync(LEGACY_FIXTURE, 'utf8'));
  runtimeErrors.length = 0;
  const loaded = page.waitForEvent('load');
  await importFile(page, 'nordlys-backup-2.0.json', JSON.stringify(file));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  expect(runtimeErrors.filter(text => text.startsWith('pageerror'))).toEqual([]);
  const live = await page.evaluate(() => ({
    folders: window.Nordlys.config.groups.map(group => group.label),
    links: window.Nordlys.config.groups.reduce((total, group) => total + group.links.length, 0),
    images: window.Nordlys.config.groups.flatMap(group => group.links).filter(link => link.customImg).length,
    cardRadius: window.Nordlys.config.cardRadius,
    tileSize: window.Nordlys.config.tileSize,
    theme: window.Nordlys.config.theme
  }));
  expect(live.folders).toEqual(file.groups.map(group => group.label));
  expect(live.links).toBe(22);
  expect(live.images, 'every embedded icon survived the round trip').toBe(13);
  expect({ cardRadius: live.cardRadius, tileSize: live.tileSize }, 'text ranges arrive as numbers').toEqual({ cardRadius: 18, tileSize: 72 });
  expect(live.theme).toBe('oled-obsidian');
  await expect(page.locator('#board .card')).toHaveCount(9);
  await expect(page.locator('#board .tile')).toHaveCount(22);
});

/* What the export claims is what the import restores. The custom themes and the
   drawer width never lived in the config, so they travel beside it in one
   namespaced envelope — which an older build ignores and this one lifts out
   before the config is validated. */
test('an export carries the themes and the geometry, and an import puts them back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const file = await page.evaluate(() => {
    localStorage.setItem('nordlys_custom_themes', JSON.stringify([{ name: 'Studio', bg: '#101317' }]));
    localStorage.setItem('nordlys_drawer_width', '688px');
    return window.Nordlys.settings.buildBackupPayload();
  });
  expect(file.nordlysBackup.customThemes[0].name).toBe('Studio');
  expect(file.nordlysBackup.drawerWidth).toBe('688px');
  expect(file.theme, 'the config is still the top level').toBeTruthy();

  await page.evaluate(() => {
    localStorage.removeItem('nordlys_custom_themes');
    localStorage.removeItem('nordlys_drawer_width');
  });
  const loaded = page.waitForEvent('load');
  await importFile(page, 'nordlys-backup.json', JSON.stringify(file));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_custom_themes'))[0].name)).toBe('Studio');
  expect(await page.evaluate(() => localStorage.getItem('nordlys_drawer_width'))).toBe('688px');
  expect(await page.evaluate(() => 'nordlysBackup' in window.Nordlys.config), 'the envelope is not stored as settings').toBe(false);
});

test('the export panel says which files it cannot carry', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Backup' }).click();
  const note = await page.locator('#backup-export-note').innerText();
  expect(note, 'wallpaper and video are named as excluded').toMatch(/wallpaper/i);
  expect(note, 'and the themes that are included are named').toMatch(/theme/i);
});

/* A config large enough that rewriting it fails — a board of embedded icons is
   the ordinary way to get there — used to send the page back to the empty
   defaults: one swallowed write, and loadConfig returned DEFAULT_CONFIG with
   the real board still sitting untouched in storage. */
test('a config that cannot be rewritten still opens the board it holds', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === 'nordlys_config' && localStorage.getItem('__deny_config_write')) {
        const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error;
      }
      return real.call(this, name, value);
    };
  });
  await page.evaluate(() => {
    // Stored in a shape that needs migrating, so the load has to rewrite it.
    localStorage.setItem('nordlys_config', JSON.stringify({
      theme: 'aurora-void', bgMode: 'particles', glassBlur: 0,
      groups: [{ label: 'STILL HERE', cols: 2, hidden: false, links: [{ name: 'Kept', url: 'https://kept.test/', icon: 'globe', color: '#79bd03' }] }]
    }));
    localStorage.setItem('__deny_config_write', '1');
  });
  runtimeErrors.length = 0;
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(runtimeErrors.filter(text => text.startsWith('pageerror'))).toEqual([]);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0]?.label)).toBe('STILL HERE');
  await expect(page.locator('#board .cat b').first()).toHaveText('STILL HERE');
  // The write failed, so what is in storage is still the un-migrated original.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).bgMode)).toBe('particles');

  /* The branch itself, with the async rescue from the browser-storage mirror
     taken out of the picture: a load that cannot write must still return the
     board it just read, not the empty defaults. */
  expect(await page.evaluate(() => window.Nordlys.loadConfig().groups[0]?.label)).toBe('STILL HERE');
});

/* ── An import that fails halfway ────────────────────────────────── */

/* An import writes four keys — the restore point, the config, the themes and
   the drawer width — and localStorage has no transaction. Written one at a
   time with only the config checked, a file that ran out of room somewhere in
   the middle left a setup that had never existed anywhere: the restore point
   replaced by a snapshot nobody asked for, or the imported themes sitting
   under the config they did not come with. Either all four land, or the exact
   previous bytes of all four are still there and the reason is said. */

const PREVIOUS_THEME = [{ name: 'Mine', bg: '#101317' }];

async function seedSetupWorthKeeping(page) {
  return page.evaluate(theme => {
    localStorage.setItem('nordlys_restore_point', JSON.stringify({
      savedAt: '2026-01-01T00:00:00.000Z', cause: 'migration', version: '2.1.0',
      config: { groups: [{ label: 'FROM BEFORE', cols: 2, hidden: false, links: [] }] }
    }));
    localStorage.setItem('nordlys_undo_point', JSON.stringify({
      savedAt: '2026-01-02T00:00:00.000Z', cause: 'reset', version: '2.2.3',
      config: { groups: [{ label: 'ONE RESET AGO', cols: 2, hidden: false, links: [] }] }
    }));
    localStorage.setItem('nordlys_custom_themes', JSON.stringify(theme));
    localStorage.setItem('nordlys_drawer_width', '712px');
    window.Nordlys.config.groups[0].label = 'MY REAL SETUP';
    window.Nordlys.saveConfig();
    // A reload would clear this, which is the point: a refused import must not.
    window.__neverReloaded = true;
    return {
      labels: window.Nordlys.config.groups.map(group => group.label),
      config: localStorage.getItem('nordlys_config'),
      restorePoint: localStorage.getItem('nordlys_restore_point')
    };
  }, PREVIOUS_THEME);
}

const INCOMING = JSON.stringify({
  theme: 'nordic-snow',
  groups: [{ label: 'FROM FILE', cols: 2, hidden: false, links: [] }],
  nordlysBackup: { customThemes: [{ name: 'Imported', bg: '#000000' }], drawerWidth: '999px' }
});

async function denyWritesTo(page, key) {
  await page.evaluate(name => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (target, value) {
      if (target === name) { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
      return real.call(this, target, value);
    };
  }, key);
}

async function expectNothingMoved(nordlysPage, before) {
  const { page } = nordlysPage;
  // The no-room message, in the reader's language, and no reload behind it.
  await expect(page.locator('#toast-dock .toast').first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__neverReloaded), 'a refused import does not reload').toBe(true);

  const now = await page.evaluate(() => ({
    live: window.Nordlys.config.groups.map(group => group.label),
    config: localStorage.getItem('nordlys_config'),
    restorePoint: localStorage.getItem('nordlys_restore_point'),
    undoPoint: JSON.parse(localStorage.getItem('nordlys_undo_point') || 'null'),
    themes: JSON.parse(localStorage.getItem('nordlys_custom_themes') || 'null'),
    width: localStorage.getItem('nordlys_drawer_width')
  }));
  expect(now.live, 'the board on screen is the one that was there').toEqual(before.labels);
  expect(now.config, 'and so is the config in storage, byte for byte').toBe(before.config);
  expect(now.restorePoint, 'the restore point was not spent on an import that did not happen').toBe(before.restorePoint);
  expect(now.undoPoint?.config?.groups?.[0]?.label, 'nor was the undo point').toBe('ONE RESET AGO');
  expect(now.themes, 'the themes someone authored are their own').toEqual(PREVIOUS_THEME);
  expect(now.width, 'and the drawer is the width they dragged it to').toBe('712px');
  expect(nordlysPage.storageState.nordlys_config?.groups?.[0]?.label, 'the mirror never saw the imported config')
    .not.toBe('FROM FILE');
}

test('an import whose config will not fit leaves every part of the setup where it was', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await seedSetupWorthKeeping(page);
  await openBackupTab(page);
  await denyWritesTo(page, 'nordlys_config');
  await dropFile(page, 'too-big.json', INCOMING);
  await expectNothingMoved(nordlysPage, before);
});

/* The themes travel beside the config, and used to be written after it with
   their failure swallowed: the import "succeeded", reloaded, and came back on
   an imported board wearing the themes of the setup it replaced. */
test('an import whose themes will not fit rolls the restore point back too', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await seedSetupWorthKeeping(page);
  await openBackupTab(page);
  await denyWritesTo(page, 'nordlys_custom_themes');
  await dropFile(page, 'themes-too-big.json', INCOMING);
  await expectNothingMoved(nordlysPage, before);
});

test('an import that cannot keep what it replaces does not replace it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await seedSetupWorthKeeping(page);
  await openBackupTab(page);
  await denyWritesTo(page, 'nordlys_restore_point');
  await dropFile(page, 'no-room-for-a-way-back.json', INCOMING);
  await expectNothingMoved(nordlysPage, before);
});

/* The guard is one-way: a file that fits still lands whole, all four keys. */
test('an import that fits writes the config, the themes, the width and the way back together', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedSetupWorthKeeping(page);
  await openBackupTab(page);
  const loaded = page.waitForEvent('load');
  await dropFile(page, 'fits.json', INCOMING);
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => ({
    live: window.Nordlys.config.groups.map(group => group.label),
    restorePoint: JSON.parse(localStorage.getItem('nordlys_restore_point')).config.groups[0].label,
    themes: JSON.parse(localStorage.getItem('nordlys_custom_themes'))[0].name,
    width: localStorage.getItem('nordlys_drawer_width')
  }))).toEqual({ live: ['FROM FILE'], restorePoint: 'MY REAL SETUP', themes: 'Imported', width: '999px' });
});
