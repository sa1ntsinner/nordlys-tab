const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Reset was the one action in the product that deleted its own safety net: the
   key list it cleared included nordlys_restore_point, and it took no snapshot
   of its own. "This cannot be undone" was accurate, which is the problem.

   Restore had the mirror of it — useRestorePoint() replaced the live config
   without keeping what it replaced, so an accidental press lost the setup from
   five seconds ago, and its confirm dialog used the same sentence for its
   title, its message and its button.

   Two slots, two meanings, one level deep:
     nordlys_restore_point — what was there before Nordlys changed it (a
                             migration, an import). Untouched by reset.
     nordlys_undo_point    — one step back from the last thing the person did
                             that replaced everything (a reset, a restore).
                             Taking the step consumes the slot, so there is no
                             chain of snapshots and never more than two. */

const RESTORE_KEY = 'nordlys_restore_point';
const UNDO_KEY = 'nordlys_undo_point';

async function openBackup(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
}

async function seedRestorePoint(page, label = 'FROM BEFORE') {
  await page.evaluate(([key, folder]) => {
    localStorage.setItem(key, JSON.stringify({
      savedAt: new Date().toISOString(), cause: 'migration', version: '2.1.0',
      config: { theme: 'gruvbox-dark', bgMode: 'aurora', groups: [{ label: folder, cols: 2, hidden: false, links: [
        { name: 'Old', url: 'https://old.test/', icon: 'globe', color: '#fabd2f' }
      ] }] }
    }));
  }, [RESTORE_KEY, label]);
}

/* An undo point left by an earlier reset, with the wallpaper that reset moved
   aside. The pair is what the next reset must not spend before it has a way
   back of its own. */
async function seedUndoPoint(page, { label = 'ONE RESET AGO', media = false } = {}) {
  await page.evaluate(([key, folder, hadMedia]) => {
    localStorage.setItem(key, JSON.stringify({
      savedAt: new Date().toISOString(), cause: 'reset', version: '2.2.3', media: hadMedia,
      config: { theme: 'aurora-void', groups: [{ label: folder, cols: 2, hidden: false, links: [] }] }
    }));
  }, [UNDO_KEY, label, media]);
}

async function putMedia(page, id, body) {
  await page.evaluate(async ([key, text]) => {
    await MediaVault.saveMedia(key, new Blob([text], { type: 'image/png' }), 'image/png');
  }, [id, body]);
}

async function mediaText(page, id) {
  return page.evaluate(async key => {
    const blob = await MediaVault.getMedia(key);
    return blob ? await blob.text() : null;
  }, id);
}

/* The quota, forced at one key. Everything else in the page keeps working, so
   what the test sees is the one write failing rather than the store dying. */
async function denyWritesTo(page, key) {
  await page.evaluate(name => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (target, value) {
      if (target === name) { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
      return real.call(this, target, value);
    };
  }, key);
}

/* ── Reset ───────────────────────────────────────────────────────── */

test('the reset dialog says what goes and that there is a way back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackup(page);
  await page.locator('#cfg-reset').click();
  const message = await page.locator('#confirm-modal .confirm-message').innerText();
  expect(message, 'names what is removed').toMatch(/bookmark|folder/i);
  expect(message, 'names the way back').toMatch(/undo|back|restore/i);
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
  const labels = await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label));

  await openBackup(page);
  const reloaded = page.waitForEvent('load');
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await reloaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  expect(await page.evaluate(() => window.Nordlys.config.groups.length), 'the reset happened').toBe(0);
  const point = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), UNDO_KEY);
  expect(point?.cause).toBe('reset');
  expect(point?.config?.groups?.map(group => group.label)).toEqual(labels);
  expect(point?.customThemes?.[0]?.name, 'a theme someone authored is not collateral').toBe('Mine');
  expect(point?.drawerWidth).toBe('712px');

  await openBackup(page);
  await expect(page.locator('#undo-point-row')).toBeVisible();
  await page.locator('#cfg-undo-point').click();
  await page.waitForFunction(count => window.Nordlys?.config?.groups?.length === count, labels.length, { timeout: 5000 });
  expect(await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label))).toEqual(labels);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_custom_themes'))[0].name)).toBe('Mine');
  expect(await page.evaluate(() => localStorage.getItem('nordlys_drawer_width'))).toBe('712px');
  await expect(page.locator('#board .card').first()).toBeVisible();
});

/* A wallpaper is far too large to sit inside a snapshot, so the reset moves it
   to one slot in the media vault instead of deleting it. Without that, the undo
   would bring back a config that points at a wallpaper no longer on disk. */
test('a reset sets the wallpaper aside rather than deleting it, and the undo brings it back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => {
    await MediaVault.saveMedia('custom_bg', new Blob(['not really an image'], { type: 'image/png' }), 'image/png');
    window.Nordlys.config.bgMode = 'wallpaper';
    window.Nordlys.saveConfig();
  });
  await openBackup(page);
  const reloaded = page.waitForEvent('load');
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await reloaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  expect(await page.evaluate(async () => Boolean(await MediaVault.getMedia('custom_bg'))), 'the reset removed it').toBe(false);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).media, UNDO_KEY), 'and recorded that it did').toBe(true);

  await openBackup(page);
  await page.locator('#cfg-undo-point').click();
  await page.waitForFunction(() => window.Nordlys?.config?.bgMode === 'wallpaper', null, { timeout: 5000 });
  expect(await page.evaluate(async () => Boolean(await MediaVault.getMedia('custom_bg')))).toBe(true);
  expect(await page.evaluate(async () => Boolean(await MediaVault.getMedia('nordlys_undo_bg'))), 'one slot, handed back rather than hoarded').toBe(false);
});

test('a reset does not spend the restore point it found', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedRestorePoint(page);
  await openBackup(page);
  const reloaded = page.waitForEvent('load');
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await reloaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  const point = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), RESTORE_KEY);
  expect(point?.config?.groups?.[0]?.label, 'the other way back survived the reset').toBe('FROM BEFORE');
});

/* If the snapshot cannot be written there is no way back, so the destructive
   half must not run. Nothing is removed and the reason is said. */
test('a reset that cannot save a way back does not happen at all', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const labels = await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label));
  await page.evaluate(key => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
      return real.call(this, name, value);
    };
  }, UNDO_KEY);
  await openBackup(page);
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await expect(page.locator('#toast-dock .toast').first()).toBeVisible();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label))).toEqual(labels);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).groups.length)).toBe(labels.length);
});

/* There is one wallpaper slot, and until the new snapshot is written it still
   belongs to the undo point already sitting there. Moving the live wallpaper
   into it first, and only then finding there is no room for the snapshot, left
   the previous way back promising a wallpaper that had been written over. */
test('a reset that cannot save a way back leaves the previous one usable, wallpaper and all', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedUndoPoint(page, { media: true });
  await putMedia(page, 'nordlys_undo_bg', 'the wallpaper the previous undo brings back');
  await putMedia(page, 'custom_bg', 'the wallpaper on screen now');
  const labels = await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label));
  await denyWritesTo(page, UNDO_KEY);

  await openBackup(page);
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await expect(page.locator('#toast-dock .toast').first()).toBeVisible();
  await page.waitForTimeout(600);

  expect(await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label)), 'nothing was reset').toEqual(labels);
  const point = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), UNDO_KEY);
  expect(point?.config?.groups?.[0]?.label, 'the undo point that was there is still there').toBe('ONE RESET AGO');
  expect(point?.media, 'still saying it has a wallpaper').toBe(true);
  expect(await mediaText(page, 'nordlys_undo_bg'), 'and the wallpaper it names is still the one it saved').toBe('the wallpaper the previous undo brings back');
  expect(await mediaText(page, 'custom_bg'), 'the live wallpaper is where it was').toBe('the wallpaper on screen now');
});

/* The same hole from the other side: with no wallpaper of its own, the reset
   emptied the slot before it had earned it. Nothing was gained by that, and an
   older undo point lost the only copy of its wallpaper. */
test('a reset with no wallpaper does not empty the previous undo point before it has a way back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedUndoPoint(page, { media: true });
  await putMedia(page, 'nordlys_undo_bg', 'the only copy left of that wallpaper');
  await denyWritesTo(page, UNDO_KEY);

  await openBackup(page);
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await expect(page.locator('#toast-dock .toast').first()).toBeVisible();
  await page.waitForTimeout(600);

  expect(await mediaText(page, 'nordlys_undo_bg'), 'the slot was not spent on a reset that did not happen').toBe('the only copy left of that wallpaper');
  const point = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), UNDO_KEY);
  expect(point?.config?.groups?.[0]?.label).toBe('ONE RESET AGO');
});

/* Transactional is not the same as hoarding: after a reset that does land there
   is still exactly one snapshot and one wallpaper behind it. */
test('a second reset overwrites the one slot rather than collecting them', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedUndoPoint(page, { media: true });
  await putMedia(page, 'nordlys_undo_bg', 'the wallpaper from one reset ago');
  await putMedia(page, 'custom_bg', 'the wallpaper on screen now');
  await page.evaluate(() => { window.Nordlys.config.bgMode = 'wallpaper'; window.Nordlys.saveConfig(); });

  await openBackup(page);
  const reloaded = page.waitForEvent('load');
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await reloaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  expect(await mediaText(page, 'nordlys_undo_bg'), 'one slot, holding what this reset took').toBe('the wallpaper on screen now');
  expect(await mediaText(page, 'custom_bg'), 'and the live one is gone').toBeNull();
  const point = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), UNDO_KEY);
  expect(point?.media).toBe(true);
  expect(point?.config?.groups?.[0]?.label, 'one snapshot, the newest').not.toBe('ONE RESET AGO');
});

/* ── Restore ─────────────────────────────────────────────────────── */

test('the restore dialog distinguishes its title, its question and its button', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedRestorePoint(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await openBackup(page);
  await page.locator('#cfg-restore-point').click();
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

test('a restore can itself be undone, once', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label));
  await seedRestorePoint(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await openBackup(page);
  await page.locator('#cfg-restore-point').click();
  await page.locator('#confirm-modal .confirm-ok').click();

  await page.waitForFunction(() => window.Nordlys?.config?.groups?.[0]?.label === 'FROM BEFORE', null, { timeout: 5000 });
  expect(await page.evaluate(() => window.Nordlys.config.theme)).toBe('gruvbox-dark');
  const point = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), UNDO_KEY);
  expect(point?.cause).toBe('restore');
  expect(point?.config?.groups?.map(group => group.label)).toEqual(before);

  await page.locator('#cfg-undo-point').click();
  await page.waitForFunction(labels => window.Nordlys?.config?.groups?.[0]?.label === labels[0], before, { timeout: 5000 });
  expect(await page.evaluate(() => window.Nordlys.config.groups.map(group => group.label))).toEqual(before);
  // One level, not a chain: taking the step back spends the slot.
  expect(await page.evaluate(key => localStorage.getItem(key), UNDO_KEY)).toBeNull();
  await expect(page.locator('#undo-point-row')).toBeHidden();
});

test('the board and the drawer both follow a restore, without a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedRestorePoint(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await openBackup(page);
  await page.locator('#cfg-restore-point').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await expect(page.locator('#board .cat b').first()).toHaveText('FROM BEFORE');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('gruvbox-dark');
  await expect(page.locator('#cfg'), 'the drawer stays where it was').toBeVisible();
});

test('a restore is announced and leaves focus on the way back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedRestorePoint(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await openBackup(page);
  await page.locator('#cfg-restore-point').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await expect(page.locator('#nl-live-region')).not.toBeEmpty();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('cfg-undo-point');
});

/* ── The row itself ──────────────────────────────────────────────── */

test('the undo row promises nothing when there is nothing behind it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(key => localStorage.removeItem(key), UNDO_KEY);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await openBackup(page);
  await expect(page.locator('#undo-point-row')).toBeHidden();
});

test('the recovery rows fit at 320px', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 320, height: 640 });
  await seedRestorePoint(page);
  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), cause: 'reset', version: '2.2.3', config: { groups: [] } }));
  }, UNDO_KEY);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await openBackup(page);
  for (const id of ['#restore-point-row', '#undo-point-row', '#cfg-restore-point', '#cfg-undo-point']) {
    const box = await page.locator(id).boundingBox();
    expect(box, `${id} is on screen`).not.toBeNull();
    expect(box.x, `${id} starts inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${id} ends inside the viewport`).toBeLessThanOrEqual(321);
  }
});

/* No modal cascade: one question, then the action. */
test('reset asks exactly once', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackup(page);
  const reloaded = page.waitForEvent('load');
  await page.locator('#cfg-reset').click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await reloaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('#confirm-modal')).toBeHidden();
});
