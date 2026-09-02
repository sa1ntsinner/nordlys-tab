const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The product is Nordlys and, as of this build, so is everything it writes.
   Earlier builds wrote "aurora_tab_config", then "aether_tab_config", plus five
   more keys and an IndexedDB database under the old name. A rename that lost
   any of that would be the one failure this category never forgives — losing
   someone's setup — so the move has to be automatic, complete, and once. */

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('every key an older build wrote is found under its new name, once', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    const keepsake = { theme: 'gruvbox-dark', groups: [{ label: 'HEIRLOOM', cols: 3, hidden: false, links: [
      { name: 'Kept', url: 'https://kept.test/', icon: 'globe', color: '#ffaa00' }
    ] }] };
    for (const key of ['nordlys_config', 'nordlys_search_history', 'nordlys_language', 'nordlys_drawer_width', 'nordlys_custom_themes']) {
      localStorage.removeItem(key);
    }
    localStorage.setItem('aether_tab_config', JSON.stringify(keepsake));
    localStorage.setItem('aurora_search_history', JSON.stringify(['old query']));
    localStorage.setItem('aurora_language', 'de');
    localStorage.setItem('aurora_drawer_width', '640px');
    localStorage.setItem('aurora_custom_themes', JSON.stringify([{ id: 'mine', name: 'Mine' }]));
    // The chrome.storage mirror held the old key too.
    window.chrome.storage.local.set({ aether_tab_config: keepsake }, () => {});
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  const after = await page.evaluate(() => ({
    config: JSON.parse(localStorage.getItem('nordlys_config') || 'null'),
    history: localStorage.getItem('nordlys_search_history'),
    language: localStorage.getItem('nordlys_language'),
    width: localStorage.getItem('nordlys_drawer_width'),
    themes: localStorage.getItem('nordlys_custom_themes'),
    oldKeysLeft: ['aether_tab_config', 'aurora_tab_config', 'aurora_search_history', 'aurora_language', 'aurora_drawer_width', 'aurora_custom_themes']
      .filter(key => localStorage.getItem(key) !== null),
    live: window.Nordlys.config.groups[0].label,
    theme: window.Nordlys.config.theme
  }));
  expect(after.config?.groups?.[0]?.label, 'the board moved across').toBe('HEIRLOOM');
  expect(after.live, 'and is what the page shows').toBe('HEIRLOOM');
  expect(after.theme).toBe('gruvbox-dark');
  expect(after.history).toBe(JSON.stringify(['old query']));
  expect(after.language).toBe('de');
  expect(after.width).toBe('640px');
  expect(JSON.parse(after.themes)[0].id).toBe('mine');
  expect(after.oldKeysLeft, 'nothing stays under the old names').toEqual([]);

  // The mirror carries one key now, like the page does.
  const mirror = nordlysPage.storageState;
  expect(mirror.nordlys_config?.groups?.[0]?.label).toBe('HEIRLOOM');
  expect('aether_tab_config' in mirror, 'the old mirror key is gone').toBe(false);
});

test('a new key that already exists is never overwritten by an old one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    localStorage.setItem('nordlys_language', 'fr');
    localStorage.setItem('aurora_language', 'de');
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => localStorage.getItem('nordlys_language')), 'the newer value wins').toBe('fr');
  expect(await page.evaluate(() => localStorage.getItem('aurora_language')), 'and the stale one is cleared').toBeNull();
});

test('a wallpaper stored under the old database name is still the wallpaper', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // Put a record where the previous build would have left it, and nothing new.
  await page.evaluate(async () => {
    await new Promise(resolve => { const r = indexedDB.deleteDatabase('Nordlys_MediaVault'); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
    const legacy = await new Promise((resolve, reject) => {
      const request = indexedDB.open('AuroraTab_MediaVault', 1);
      request.onupgradeneeded = event => event.target.result.createObjectStore('wallpapers', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    await new Promise((resolve, reject) => {
      const tx = legacy.transaction('wallpapers', 'readwrite');
      tx.objectStore('wallpapers').put({ id: 'custom_bg', blob: new Blob([bytes], { type: 'image/png' }), type: 'image/png', timestamp: 1 });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    legacy.close();
    const config = { ...window.Nordlys.config, bgMode: 'custom-image' };
    localStorage.setItem('nordlys_config', JSON.stringify(config));
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  // The first read goes through the move.
  const moved = await page.evaluate(async () => {
    const blob = await MediaVault.getMedia('custom_bg');
    const names = (await indexedDB.databases()).map(entry => entry.name);
    return { size: blob?.size ?? null, type: blob?.type ?? null, names };
  });
  expect(moved.size, 'the record is readable through the new database').toBeGreaterThan(0);
  expect(moved.type).toBe('image/png');
  expect(moved.names, 'the new database exists').toContain('Nordlys_MediaVault');
  expect(moved.names, 'and the old one is gone').not.toContain('AuroraTab_MediaVault');
  // And the page is actually showing it: the image element got the blob.
  await expect.poll(() => page.evaluate(() => document.getElementById('bg-media')?.src || '')).toMatch(/^blob:/);
});

/* The move can fail part way — a blocked delete, a read error — and is retried
   on the next load. Between the two the user may have chosen a wallpaper, which
   went into the new database. The retry must not put the old one back over it. */
test('a retried move never puts an old wallpaper over a newer one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => {
    const openWith = name => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = event => event.target.result.createObjectStore('wallpapers', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const put = (db, record) => new Promise((resolve, reject) => {
      const tx = db.transaction('wallpapers', 'readwrite');
      tx.objectStore('wallpapers').put(record);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    for (const name of ['Nordlys_MediaVault', 'AuroraTab_MediaVault']) {
      await new Promise(resolve => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
    }
    const legacy = await openWith('AuroraTab_MediaVault');
    await put(legacy, { id: 'custom_bg', blob: new Blob(['OLD'], { type: 'image/png' }), type: 'image/png', timestamp: 1 });
    legacy.close();
    const current = await openWith('Nordlys_MediaVault');
    await put(current, { id: 'custom_bg', blob: new Blob(['NEWER'], { type: 'image/jpeg' }), type: 'image/jpeg', timestamp: 2 });
    current.close();
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  const kept = await page.evaluate(async () => {
    const blob = await MediaVault.getMedia('custom_bg');
    const names = (await indexedDB.databases()).map(entry => entry.name);
    return { type: blob?.type, text: blob ? await blob.text() : null, names };
  });
  expect(kept.text, 'the newer wallpaper is the one that stays').toBe('NEWER');
  expect(kept.type).toBe('image/jpeg');
  expect(kept.names, 'and the old database is still cleaned up').not.toContain('AuroraTab_MediaVault');
});

/* Chrome clears an extension's localStorage with "clear site data", and the
   chrome.storage mirror is then the only copy of a setup. A first version of
   the rename wrote defaults over that copy and deleted the original — the
   restore that ran afterwards had nothing left to restore. */
test('a setup that survives only in the mirror is restored, and the mirror keeps it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    const keepsake = { theme: 'gruvbox-dark', groups: [{ label: 'ONLY COPY', cols: 3, hidden: false, links: [] }] };
    localStorage.removeItem('nordlys_config');
    window.chrome.storage.local.remove('nordlys_config', () => {});
    window.chrome.storage.local.set({ aether_tab_config: keepsake }, () => {});
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0]?.label), 'the page shows the only copy').toBe('ONLY COPY');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.label, 'the mirror holds it under the new key').toBe('ONLY COPY');
  await expect.poll(() => 'aether_tab_config' in nordlysPage.storageState, 'and not under the old one').toBe(false);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('nordlys_config'))).groups[0].label).toBe('ONLY COPY');
});

/* A backup is the bare config object and always was, so one saved under any
   earlier build has nothing in it to rename — but it may carry settings that no
   longer exist, and those go through the same migrations a stored config does. */
test('a backup exported by an earlier build imports through the real import path', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Backup' }).click();
  const backup = { version: '2.1.0', theme: 'nordic-snow', defaultEngine: 'duckduckgo', bgMode: 'particles',
    groups: [{ label: 'FROM BACKUP', cols: 2, hidden: false, links: [] }] };
  const loaded = page.waitForEvent('load');
  await page.locator('#cfg-import-universal').setInputFiles({ name: 'nordlys-backup-2026-01-01.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  const after = await page.evaluate(() => ({
    label: window.Nordlys.config.groups[0]?.label, theme: window.Nordlys.config.theme,
    bgMode: window.Nordlys.config.bgMode, bgMotion: window.Nordlys.config.bgMotion,
    engine: 'defaultEngine' in window.Nordlys.config
  }));
  expect(after.label).toBe('FROM BACKUP');
  expect(after.theme).toBe('nordic-snow');
  expect(after.bgMode, 'a removed scene in the backup lands on its survivor').toBe('aurora');
  expect(after.bgMotion, 'and stays still, as particles was').toBe(0);
  expect(after.engine, 'a removed setting in the backup is dropped').toBe(false);
});
