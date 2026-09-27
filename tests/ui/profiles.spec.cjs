const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Profiles on the page and sync through Chrome (sync-client.js, sync-ui.js).
   The fixture gives the page a Chrome sync area in memory; window.__syncRemote
   writes into it the way another device would. */

const labels = page => page.evaluate(() => window.Nordlys.config.groups.map(group => group.label));
async function newProfile(page, name, from = 'empty') {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-sync').click();
  await page.locator('#sec-sync').getByRole('button', { name: 'New profile' }).click();
  const form = page.locator('#nl-form-modal');
  await expect(form).toBeVisible();
  await form.locator('input[name="name"]').fill(name);
  await form.locator(`input[name="from"][value="${from}"]`).check();
  await form.locator('#nl-form-ok').click();
  await expect(form).toBeHidden();
}
const closeSettings = page => page.keyboard.press('Escape');

test('one profile shows no chip; a second one appears under the greeting and switches the whole board', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await labels(page);
  expect(before.length).toBeGreaterThan(0);
  await expect(page.locator('#profile-chip')).toBeHidden();
  await newProfile(page, 'Home');
  await closeSettings(page);
  await expect(page.locator('#profile-chip')).toBeVisible();
  await expect(page.locator('#profile-chip .profile-name')).toHaveText('Home');
  expect(await labels(page)).toEqual([]);
  // Back through the menu, with every folder where it was.
  await page.locator('#profile-chip').click();
  const menu = page.locator('#profile-menu');
  await expect(menu).toBeVisible();
  await menu.locator('.ctx-item', { hasText: 'Main' }).click();
  await expect.poll(() => labels(page)).toEqual(before);
  await expect(page.locator('#profile-chip .profile-name')).toHaveText('Main');
  // One undo goes back to Home.
  await page.locator('#toast-dock .toast-action').last().click();
  await expect.poll(() => labels(page)).toEqual([]);
});

test('the person stays the same across profiles; the look does not', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.userName = 'Elmir'; window.Nordlys.config.theme = 'tokyo-night'; window.Nordlys.saveConfig(); });
  await newProfile(page, 'Study');
  // The switch finishes a moment after the dialog closes.
  await expect.poll(() => page.evaluate(() => window.Nordlys.sync.active().name)).toBe('Study');
  const study = await page.evaluate(() => ({ name: window.Nordlys.config.userName, theme: window.Nordlys.config.theme }));
  expect(study.name).toBe('Elmir');
  expect(study.theme).not.toBe('tokyo-night');
});

test('"> profile" switches from the search box', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await newProfile(page, 'Home');
  await closeSettings(page);
  const q = page.locator('#q');
  await q.click();
  await q.fill('>profile main');
  await expect(page.locator('#sugg .sugg-command').first()).toContainText('Main');
  await q.press('Enter');
  await expect(page.locator('#profile-chip .profile-name')).toHaveText('Main');
});

test('a deleted profile can be restored from settings', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await newProfile(page, 'Home', 'copy');
  const section = page.locator('#sec-sync');
  // Delete Main, which is not in use now.
  await section.locator('.sync-profile', { hasText: 'Main' }).getByRole('button', { name: 'Delete' }).click();
  await page.locator('#confirm-modal .confirm-ok').click();
  await expect(section.locator('.sync-profiles').first().locator('.sync-profile')).toHaveCount(1);
  await expect(section.locator('.sync-deleted', { hasText: 'Main' })).toBeVisible();
  await section.locator('.sync-deleted', { hasText: 'Main' }).getByRole('button', { name: 'Restore' }).click();
  await expect(section.locator('.sync-profile')).toHaveCount(2);
});

test('turning sync on sends the board, and a change from another device arrives', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-sync').click();
  await page.locator('label.tg:has(#cfg-sync-on)').click();
  await expect(page.locator('#sec-sync .sync-state')).toHaveClass(/is-ready/);
  const keys = await page.evaluate(() => Object.keys(window.__syncState()));
  expect(keys.some(key => key.startsWith('nl.sync.2.'))).toBe(true);
  expect(JSON.stringify(await page.evaluate(() => window.__syncState()))).not.toContain('data:image');

  // Another device renames the first folder.
  await page.evaluate(async () => {
    const M = window.NordlysSyncModel;
    const other = M.create('laptop');
    M.merge(other, window.__syncState());
    const view = M.materialize(other);
    view.profiles[0].config.groups[0].label = 'Renamed on the laptop';
    M.update(other, view);
    await window.__syncRemote(M.exportChunks(other));
  });
  await expect.poll(() => labels(page), { timeout: 8000 }).toContain('Renamed on the laptop');
});

test('with sync on, a bookmark can be kept on this device or read differently here', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // Off: the menu has nothing about devices.
  await page.locator('.tile').first().click({ button: 'right' });
  await expect(page.locator('#tile-ctx-menu [data-action="device-here-only"]')).toBeHidden();
  await page.keyboard.press('Escape');

  await page.locator('#gear').click();
  await page.locator('#settings-tab-sync').click();
  await page.locator('label.tg:has(#cfg-sync-on)').click();
  await expect(page.locator('#sec-sync .sync-state')).toHaveClass(/is-ready/);
  await closeSettings(page);

  await page.locator('.tile').first().click({ button: 'right' });
  await page.locator('#tile-ctx-menu [data-action="device-here-only"]').click();
  await expect(page.locator('.tile').first()).toHaveClass(/is-here-only/);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links[0].local)).toBe(true);

  await page.locator('.tile').nth(1).click({ button: 'right' });
  await page.locator('#tile-ctx-menu [data-action="device-different"]').click();
  const form = page.locator('#nl-form-modal');
  await form.locator('input[name="url"]').fill('https://only-here.example/');
  await form.locator('#nl-form-ok').click();
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links[1].url)).toBe('https://only-here.example/');
  await expect(page.locator('.tile').nth(1)).toHaveClass(/is-different-here/);
  // Sync still carries the shared address.
  await page.evaluate(() => window.Nordlys.sync.pushNow());
  expect(JSON.stringify(await page.evaluate(() => window.__syncState()))).not.toContain('only-here.example');

  await page.locator('.tile').nth(1).click({ button: 'right' });
  await page.locator('#tile-ctx-menu [data-action="device-shared"]').click();
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links[1].url)).not.toBe('https://only-here.example/');
});

test('turning sync on where sync already has a setup asks what to do', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => {
    const M = window.NordlysSyncModel;
    const other = M.create('laptop');
    M.update(other, { person: { language: 'en' }, profiles: [{ id: 'laptopmain', name: 'Laptop', color: 'amber', config: { theme: 'nord-frost', groups: [{ id: 'g1', label: 'From the laptop', links: [] }] } }] });
    await window.__syncRemote(M.exportChunks(other));
  });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-sync').click();
  await page.locator('label.tg:has(#cfg-sync-on)').click();
  const form = page.locator('#nl-form-modal');
  await expect(form).toBeVisible();
  await expect(form.locator('input[name="mode"]')).toHaveCount(3);
  await form.locator('input[value="use-sync"]').check();
  await form.locator('#nl-form-ok').click();
  await expect.poll(() => labels(page)).toEqual(['From the laptop']);
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.theme)).toBe('nord-frost');
});
