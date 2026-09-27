const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The dashboard (dashboard.js over widget-kit.js): off unless asked for, a
   row of cards when it is on, each keeping what it holds across a reload. */

const dash = page => page.locator('#dash');
const card = (page, type) => page.locator(`#dash .dash-card[data-type="${type}"]`).first();
async function command(page, text) {
  await page.locator('#q').click();
  await page.locator('#q').fill(`>${text}`);
  await page.locator('#q').press('Enter');
}
async function turnOn(page) {
  await command(page, 'dashboard');
  await expect(dash(page)).toBeVisible();
}

test('the New tab mode shows no dashboard and runs none of it', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await expect(dash(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-dashboard'))).toBe(false);
  expect(await page.locator('#dash > *').count()).toBe(0);
  expect(runtimeErrors).toEqual([]);
});

test('turning it on brings three cards to start from, and it stays on after a reload', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await turnOn(page);
  await expect(page.locator('#dash .dash-card')).toHaveCount(3);
  expect(await page.locator('#dash .dash-card').evaluateAll(cards => cards.map(c => c.dataset.type))).toEqual(['focus', 'tasks', 'timer']);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('#dash .dash-card')).toHaveCount(3);
  // Off again is the plain page, and the cards come back as they were.
  await command(page, 'dashboard');
  await expect(dash(page)).toBeHidden();
  await command(page, 'dashboard');
  await expect(page.locator('#dash .dash-card')).toHaveCount(3);
  expect(runtimeErrors).toEqual([]);
});

test('a task is added, ticked off and still there after a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await turnOn(page);
  const tasks = card(page, 'tasks');
  const input = tasks.getByRole('textbox', { name: 'Add a task' });
  await input.fill('Write the release notes');
  await input.press('Enter');
  await input.fill('Water the plants');
  await input.press('Enter');
  await expect(tasks.locator('.dash-task')).toHaveCount(2);
  await expect(tasks.locator('.dash-foot')).toContainText('2 to do');
  await tasks.getByRole('checkbox', { name: 'Write the release notes' }).check();
  await expect(tasks.locator('.dash-task.is-done')).toHaveText('Write the release notes');
  // Done ones sink below the open ones.
  await expect(tasks.locator('.dash-task-text').first()).toHaveText('Water the plants');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(card(page, 'tasks').locator('.dash-task')).toHaveCount(2);
  await expect(card(page, 'tasks').locator('.dash-task.is-done')).toHaveCount(1);
});

test('"> task" adds to the list from the search box', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await command(page, 'task Call the dentist');
  await expect(card(page, 'tasks').locator('.dash-task-text')).toHaveText(['Call the dentist']);
});

test('a task can be edited in place, and emptying it removes it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await command(page, 'task Draft');
  const tasks = card(page, 'tasks');
  await tasks.locator('.dash-task-text').dblclick();
  const field = tasks.locator('.dash-task-edit');
  await field.fill('Final');
  await field.press('Enter');
  await expect(tasks.locator('.dash-task-text')).toHaveText(['Final']);
  await tasks.locator('.dash-task-text').dblclick();
  await tasks.locator('.dash-task-edit').fill('');
  await tasks.locator('.dash-task-edit').press('Enter');
  await expect(tasks.locator('.dash-task')).toHaveCount(0);
});

test('the focus of the day is set with Enter and can be marked done', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await turnOn(page);
  const focus = card(page, 'focus');
  await focus.getByRole('textbox').fill('Ship 2.6');
  await focus.getByRole('textbox').press('Enter');
  await expect(focus.locator('.dash-focus-text')).toHaveText('Ship 2.6');
  await focus.getByRole('checkbox', { name: 'Done' }).check();
  await expect(focus.locator('.dash-focus')).toHaveClass(/is-done/);
});

test('the timer starts, counts down and pauses', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await turnOn(page);
  const timer = card(page, 'timer');
  await expect(timer.locator('.dash-timer-face')).toHaveText('25:00');
  await timer.getByRole('button', { name: 'Start' }).click();
  await expect(timer).toHaveClass(/is-running/);
  await expect(timer.locator('.dash-timer-face')).not.toHaveText('25:00', { timeout: 3000 });
  await timer.getByRole('button', { name: 'Pause' }).click();
  await expect(timer).not.toHaveClass(/is-running/);
  const held = await timer.locator('.dash-timer-face').textContent();
  await page.waitForTimeout(1300);
  await expect(timer.locator('.dash-timer-face')).toHaveText(held);
  await timer.getByRole('button', { name: 'Reset' }).click();
  await expect(timer.locator('.dash-timer-face')).toHaveText('25:00');
});

test('a card is added from the adder, removed from its menu, and Undo brings it back with what it held', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await turnOn(page);
  await page.locator('#dash .dash-add').click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: /Note/ }).click();
  const note = card(page, 'notes');
  await expect(note).toBeVisible();
  await note.locator('textarea').fill('Keys are in the blue bowl');
  await page.waitForTimeout(600);
  await note.getByRole('button', { name: /options/ }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'Remove card' }).click();
  await expect(page.locator('#dash .dash-card[data-type="notes"]')).toHaveCount(0);
  await page.locator('#toast-dock .toast-action').last().click();
  await expect(card(page, 'notes').locator('textarea')).toHaveValue('Keys are in the blue bowl');
});

test('the menu moves a card and makes it wider', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await turnOn(page);
  // The order a person reads them in, top row first.
  const types = () => page.evaluate(() => window.Nordlys.dashboard.readingOrder().map(id => document.querySelector(`.dash-card[data-widget-id="${id}"]`).dataset.type));
  await card(page, 'tasks').getByRole('button', { name: /options/ }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'Move left' }).click();
  await expect.poll(types).toEqual(['tasks', 'focus', 'timer']);
  await card(page, 'tasks').getByRole('button', { name: /options/ }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'Make wider' }).click();
  await expect(card(page, 'tasks')).toHaveAttribute('data-w', '6');
  // Escape closes a menu and gives focus back to its button.
  await card(page, 'tasks').getByRole('button', { name: /options/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.dash-menu')).toHaveCount(0);
  await expect(card(page, 'tasks').getByRole('button', { name: /options/ })).toBeFocused();
});

test('Settings has a Dashboard tab that turns it on and adds cards', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-dashboard').click();
  const section = page.locator('#sec-dashboard');
  await section.locator('label.tg').first().click();
  await expect(section.getByRole('checkbox', { name: /Show the dashboard/ })).toBeChecked();
  await expect(dash(page)).toBeVisible();
  await section.getByRole('button', { name: /World clocks/ }).click();
  await expect(page.locator('#dash .dash-card[data-type="clocks"]')).toHaveCount(1);
  await expect(page.locator('#dash .dash-card[data-type="clocks"] .dash-clocks li')).toHaveCount(2);
});

test('each profile keeps its own dashboard', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await turnOn(page);
  await page.evaluate(() => window.Nordlys.sync.create({ name: 'Home', from: 'empty' }));
  await expect(dash(page)).toBeHidden();
  const main = await page.evaluate(() => window.Nordlys.sync.list()[0].id);
  await page.evaluate(id => window.Nordlys.sync.switchTo(id, { undo: false }), main);
  await expect(page.locator('#dash .dash-card')).toHaveCount(3);
});

test('weather: a place is found by name and the forecast is drawn from Open-Meteo', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  let forecasts = 0;
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [{ name: 'Dortmund', admin1: 'North Rhine-Westphalia', country: 'Germany', latitude: 51.5149, longitude: 7.466 }] } }));
  await page.route('https://api.open-meteo.com/**', route => {
    forecasts++;
    route.fulfill({ json: {
      current: { temperature_2m: 14.6, weather_code: 61, is_day: 1 },
      daily: { time: ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'], temperature_2m_max: [16, 19, 12, 13, 15], temperature_2m_min: [9, 10, 7, 8, 9], weather_code: [61, 1, 71, 3, 2], precipitation_probability_max: [80, 10, 55, 20, 5] }
    } });
  });
  await turnOn(page);
  await page.locator('#dash .dash-add').click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: /Weather/ }).click();
  const weather = card(page, 'weather');
  await weather.getByRole('button', { name: 'Choose a place' }).click();
  const dialog = page.locator('.dash-dialog');
  await dialog.getByRole('searchbox').fill('Dortm');
  await dialog.getByRole('button', { name: /Dortmund/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(weather.locator('.dash-weather-now b')).toHaveText('15°');
  await expect(weather.locator('.dash-weather-place span')).toHaveText('Dortmund');
  await expect(weather.locator('.dash-weather-days li')).toHaveCount(4);
  // A reload within half an hour uses what it has.
  const asked = forecasts;
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(card(page, 'weather').locator('.dash-weather-now b')).toHaveText('15°');
  expect(forecasts).toBe(asked);
});
