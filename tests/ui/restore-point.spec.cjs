const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Across every start-page extension studied, the complaint that turns a
   five-star user into an uninstall in a single event is losing their setup.
   The most-discussed bug in the largest competitor's tracker is exactly that,
   and the usual cause is not a crash but an upgrade that migrated something
   wrongly — data intact, experience identical to deletion.

   Nothing here can promise a migration is correct. It can promise the state
   before it still exists. */

const RESTORE_KEY = 'nordlys_restore_point';
const CONFIG_KEY = 'aether_tab_config';

test('a migration keeps what it replaced', async ({ nordlysPage }) => {
  const { page } = nordlysPage;

  // A config as an older release would have written it: a scene and a set of
  // glass sliders that no longer exist.
  await page.evaluate(([configKey, restoreKey]) => {
    localStorage.removeItem(restoreKey);
    localStorage.setItem(configKey, JSON.stringify({
      theme: 'aurora-void',
      bgMode: 'particles',
      glassBlur: 0,
      groups: [{ label: 'KEEPSAKE', cols: 3, hidden: false, links: [
        { name: 'Something', url: 'https://example.test/', icon: 'globe', color: '#7c9cff' }
      ] }]
    }));
  }, [CONFIG_KEY, RESTORE_KEY]);

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));

  // The migration ran.
  expect(await page.evaluate(() => window.Aurora.config.bgMode)).toBe('gradient');
  expect(await page.evaluate(() => window.Aurora.config.glassLevel)).toBe('off');

  // And the state it replaced is still there, exactly as it was.
  const point = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), RESTORE_KEY);
  expect(point, 'a restore point must exist after a migration').toBeTruthy();
  expect(point.config.bgMode, 'kept verbatim, not normalised').toBe('particles');
  expect(point.config.glassBlur).toBe(0);
  expect(point.config.groups[0].label).toBe('KEEPSAKE');
  expect(typeof point.savedAt).toBe('string');
});

test('a load that migrates nothing leaves no restore point', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(key => localStorage.removeItem(key), RESTORE_KEY);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  // The defaults need no migration, so there is nothing to go back to.
  expect(await page.evaluate(key => localStorage.getItem(key), RESTORE_KEY)).toBeNull();
});

test('the offer appears only when there is something behind it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;

  await page.evaluate(key => localStorage.removeItem(key), RESTORE_KEY);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await expect(page.locator('#restore-point-row'), 'no net, no promise of one').toBeHidden();

  await page.evaluate(([restoreKey]) => {
    localStorage.setItem(restoreKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      version: '2.1.0',
      config: { theme: 'gruvbox-dark', bgMode: 'aurora', groups: [] }
    }));
  }, [RESTORE_KEY]);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await expect(page.locator('#restore-point-row')).toBeVisible();
  await expect(page.locator('#restore-point-when')).not.toBeEmpty();
});

test('taking the offer puts the old settings back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(restoreKey => {
    localStorage.setItem(restoreKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      version: '2.1.0',
      config: {
        theme: 'gruvbox-dark',
        bgMode: 'aurora',
        groups: [{ label: 'FROM BEFORE', cols: 2, hidden: false, links: [
          { name: 'Old', url: 'https://old.test/', icon: 'globe', color: '#fabd2f' }
        ] }]
      }
    }));
  }, RESTORE_KEY);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await page.locator('#cfg-restore-point').click();
  await page.getByRole('button', { name: /Put those back/i }).last().click();

  await page.waitForFunction(() => window.Aurora?.config?.groups?.[0]?.label === 'FROM BEFORE', null, { timeout: 5000 });
  expect(await page.evaluate(() => window.Aurora.config.theme)).toBe('gruvbox-dark');
  await expect(page.locator('#board .cat b').first()).toHaveText('FROM BEFORE');
});
