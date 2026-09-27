const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The dashboard in the situations that break things: a backup taken and
   brought back, a reset, time passing, another language, the network
   refusing, a crowded row, a page fitted to the window, the keyboard. */

const card = (page, type) => page.locator(`#dash .dash-card[data-type="${type}"]`).first();
const on = page => page.evaluate(async () => { window.Nordlys.dashboard.setOn(true); await window.Nordlys.dashboard.render(); });
const ready = page => page.waitForFunction(() => Boolean(window.Nordlys?.grid));
async function addTask(page, text) {
  const input = card(page, 'tasks').getByRole('textbox', { name: 'Add a task' });
  await input.fill(text);
  await input.press('Enter');
}

test('a backup carries the cards and what they hold, and an import brings both back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  await addTask(page, 'Pack the charger');
  const payload = await page.evaluate(() => window.Nordlys.settings.buildBackupPayload());
  expect(payload.dashboard.on).toBe(true);
  expect(Object.values(payload.nordlysBackup.dashboardData).some(data => data.items?.[0]?.text === 'Pack the charger')).toBe(true);
  // Everything goes, then the file comes back.
  await page.evaluate(async () => {
    window.Nordlys.dashboard.setOn(false);
    const keys = Object.keys(await new Promise(resolve => chrome.storage.local.get(null, resolve))).filter(key => key.startsWith('nordlys_dash.'));
    await new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  const loaded = page.waitForEvent('load');
  await page.locator('#cfg-import-universal').setInputFiles({ name: 'nordlys-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
  await loaded;
  await ready(page);
  await expect(card(page, 'tasks').locator('.dash-task-text')).toHaveText(['Pack the charger']);
});

test('a reset takes the dashboard away with everything else', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  await addTask(page, 'Something');
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await page.locator('#cfg-reset').click();
  const loaded = page.waitForEvent('load');
  await page.locator('#confirm-modal .confirm-ok').click();
  await loaded;
  await ready(page);
  await expect(page.locator('#dash')).toBeHidden();
  const left = await page.evaluate(async () => Object.keys(await new Promise(resolve => chrome.storage.local.get(null, resolve))).filter(key => key.startsWith('nordlys_dash.')));
  expect(left).toEqual([]);
});

test('when a focus runs out the break begins by itself and the session is counted', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install();
  await on(page);
  const timer = card(page, 'timer');
  await timer.getByRole('button', { name: 'Start' }).click();
  await page.clock.fastForward('25:02');
  await expect(timer.locator('.dash-timer-phase')).toHaveText('Break', { timeout: 5000 });
  await expect(timer.locator('.dash-timer-dots i.on')).toHaveCount(1);
  await page.clock.fastForward('05:02');
  await expect(timer.locator('.dash-timer-phase')).toHaveText('Focus');
  await expect(timer).not.toHaveClass(/is-running/);
  await expect(timer.locator('.dash-timer-face')).toHaveText('25:00');
});

test('a timer left running survives a reload and keeps its place in time', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  await card(page, 'timer').getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1500);
  await page.reload();
  await ready(page);
  await expect(card(page, 'timer')).toHaveClass(/is-running/);
  await expect(card(page, 'timer').locator('.dash-timer-face')).not.toHaveText('25:00');
});

test('a focus set yesterday asks again today', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install({ time: new Date('2026-09-26T20:00:00') });
  await page.reload();
  await ready(page);
  await on(page);
  await card(page, 'focus').getByRole('textbox').fill('Yesterday thing');
  await card(page, 'focus').getByRole('textbox').press('Enter');
  await page.clock.setSystemTime(new Date('2026-09-27T08:00:00'));
  await page.reload();
  await ready(page);
  await expect(card(page, 'focus').getByRole('textbox')).toBeVisible();
});

test('in Russian and German the cards speak the language', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  for (const [lang, words] of [['ru', ['Фокус дня', 'Задачи', 'Таймер фокуса']], ['de', ['Fokus des Tages', 'Aufgaben', 'Fokus-Timer']]]) {
    await page.evaluate(value => window.I18N.setLanguage(value), lang);
    await expect(page.locator('#dash .dash-head h2')).toHaveText(words);
    const text = await page.locator('#dash').innerText();
    expect(text).not.toMatch(/dash\.[a-z]/);
    expect(text).not.toMatch(/What matters|Add a task/);
  }
});

test('when the forecast cannot be had the card says so, and nothing breaks', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.evaluate(async () => {
    const d = window.Nordlys.dashboard;
    d.setOn(true);
    const id = d.add('weather');
    d.change(id, w => ({ ...w, settings: { ...w.settings, place: { name: 'Oslo', label: 'Oslo', lat: 59.9, lon: 10.7 } } }));
    await d.render();
  });
  await expect(card(page, 'weather')).toContainText('No forecast right now');
  expect(runtimeErrors.filter(line => !/net::ERR_FAILED|Failed to fetch|Failed to load resource|Cross-Origin Request Blocked|NetworkError when attempting to fetch/.test(line))).toEqual([]);
});

test('a countdown reads days ahead, today and days since', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install({ time: new Date('2026-09-26T10:00:00') });
  await page.reload();
  await ready(page);
  const set = date => page.evaluate(async value => {
    const d = window.Nordlys.dashboard;
    d.setOn(true);
    let w = d.widgets().find(x => x.type === 'countdown');
    if (!w) { d.add('countdown'); w = d.widgets().find(x => x.type === 'countdown'); }
    d.change(w.id, x => ({ ...x, settings: { title: 'the trip', date: value } }));
    await d.render();
  }, date);
  await set('2026-10-01');
  await expect(card(page, 'countdown')).toContainText('5days until the trip');
  await set('2026-09-26');
  await expect(card(page, 'countdown').locator('b')).toHaveText('Today');
  await set('2026-09-20');
  await expect(card(page, 'countdown')).toContainText('days since the trip');
});

test('clocks: a city is added by name in the settings and removed again', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); d.add('clocks'); await d.render(); });
  const clocks = card(page, 'clocks');
  await clocks.hover();
  await clocks.getByRole('button', { name: /options/ }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'Settings' }).click();
  const dialog = page.locator('.dash-dialog');
  await dialog.getByRole('combobox').fill('Sydney');
  await dialog.getByRole('combobox').press('Enter');
  await expect(dialog.locator('.dash-zone-list li')).toHaveCount(3);
  await dialog.getByRole('button', { name: /Remove America\/New York/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(clocks.locator('.dash-clock-city')).toHaveText(['Tokyo', 'Sydney']);
});

test('a crowded dashboard still lays out without a card over another', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(async () => {
    const d = window.Nordlys.dashboard;
    d.setOn(true);
    for (const type of ['notes', 'weather', 'clocks', 'countdown', 'quote', 'tasks', 'timer', 'notes', 'quote']) d.add(type);
    await d.render();
  });
  const boxes = await page.locator('#dash .dash-card').evaluateAll(cards => cards.map(c => { const r = c.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
  expect(boxes.length).toBe(12);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    const overlap = a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;
    expect(overlap, `cards ${i} and ${j} overlap`).toBe(false);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('with One page fit on, the dashboard and the board are fitted together', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 1440, height: 900 });
  await Promise.all([page.waitForEvent('load'), page.evaluate(async () => { window.Nordlys.config.onePageFit = true; window.Nordlys.saveConfig(); location.reload(); })]);
  await ready(page);
  await on(page);
  await page.waitForTimeout(800);
  const bottom = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#dash .dash-card, #board .card')].map(node => node.getBoundingClientRect().bottom)));
  expect(bottom).toBeLessThanOrEqual(900 + 1);
});

test('the keyboard: menus walk with arrows, Escape leaves an edit unchanged', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  await addTask(page, 'Keep this');
  const text = card(page, 'tasks').locator('.dash-task-text');
  await text.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type(' and not this');
  await page.keyboard.press('Escape');
  await expect(text).toHaveText('Keep this');
  await expect(page.locator('#dash')).toBeVisible();
  await card(page, 'tasks').getByRole('button', { name: /options/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.dash-menu [role="menuitem"]').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.dash-menu [role="menuitem"]').nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.dash-menu [role="menuitem"]').last()).toBeFocused();
});

test('"> timer" starts the timer from the search box, and runs no second one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const command = async text => { await page.locator('#q').click(); await page.locator('#q').fill(`>${text}`); await page.locator('#q').press('Enter'); };
  await command('timer');
  await expect(card(page, 'timer')).toHaveClass(/is-running/);
  await command('timer');
  await expect(card(page, 'timer')).not.toHaveClass(/is-running/);
  await expect(page.locator('#dash .dash-card[data-type="timer"]')).toHaveCount(1);
});

test('removing from Settings can be undone', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  await page.locator('#gear').click();
  await page.locator('#settings-tab-dashboard').click();
  await page.locator('#sec-dashboard').getByRole('button', { name: 'Remove card: Tasks' }).click();
  await expect(page.locator('#dash .dash-card[data-type="tasks"]')).toHaveCount(0);
  await page.locator('#toast-dock .toast-action').last().click();
  await expect(page.locator('#dash .dash-card[data-type="tasks"]')).toHaveCount(1);
});

test('a line for today can come from your own list only', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => {
    const d = window.Nordlys.dashboard; d.setOn(true);
    const id = d.add('quote');
    d.change(id, w => ({ ...w, settings: { mine: 'Stay curious — Me\nKeep going', source: 'mine' } }));
    await d.render();
  });
  await expect(card(page, 'quote').locator('blockquote')).toHaveText(/“(Stay curious|Keep going)”/);
});

test('a list in a card\'s settings can be opened and chosen from, over the dialog', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  const timer = card(page, 'timer');
  await timer.hover();
  await timer.getByRole('button', { name: /options/ }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'Settings' }).click();
  await page.locator('.dash-dialog #dash-field-sound + .nl-select').click();
  await page.locator('.nl-select-list.open [role="option"]', { hasText: 'Ocean' }).click();
  await page.locator('.dash-dialog').getByRole('button', { name: 'Save' }).click();
  expect(await page.evaluate(() => window.Nordlys.dashboard.widgets().find(w => w.type === 'timer').settings.sound)).toBe('ocean');
});
