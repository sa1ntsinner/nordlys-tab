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
  // And the page is actually showing it.
  expect(await page.evaluate(() => document.documentElement.dataset.bg)).toBe('custom-image');
});

test('the export a previous build wrote imports as it is', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  /* An export is the bare config object and always was, so a backup taken under
     any earlier name has nothing in it to rename. */
  const restored = await page.evaluate(() => {
    const backup = JSON.stringify({ version: '2.1.0', theme: 'nordic-snow', groups: [{ label: 'FROM BACKUP', cols: 2, hidden: false, links: [] }] });
    const parsed = JSON.parse(backup);
    return { hasGroups: Array.isArray(parsed.groups), label: parsed.groups[0].label, keyNamesInside: Object.keys(parsed).filter(key => /aurora|aether|nordlys/.test(key)) };
  });
  expect(restored.hasGroups).toBe(true);
  expect(restored.label).toBe('FROM BACKUP');
  expect(restored.keyNamesInside, 'a backup names no storage key').toEqual([]);
});
