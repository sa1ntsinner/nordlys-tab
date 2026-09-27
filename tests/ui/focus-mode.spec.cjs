const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Focus mode (focus-mode.js): the whole page for one thing, on the same
   timer as the dashboard's timer card. */

const fm = page => page.locator('#focus-mode');
async function command(page, text) {
  await page.locator('#q').click();
  await page.locator('#q').fill(`>${text}`);
  await page.locator('#q').press('Enter');
}
const on = page => page.evaluate(async () => { window.Nordlys.dashboard.setOn(true); await window.Nordlys.dashboard.render(); });

test('"> focus" opens it, the timer runs, and Escape brings you back to the page', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await command(page, 'focus');
  await expect(fm(page)).toBeVisible();
  await expect(fm(page)).toHaveAttribute('role', 'dialog');
  await expect(fm(page).locator('.fm-face')).toHaveText('25:00');
  await expect(fm(page).getByRole('button', { name: 'Start' })).toBeFocused();
  await fm(page).getByRole('button', { name: 'Start' }).click();
  await expect(fm(page)).toHaveClass(/is-running/);
  await expect(fm(page).locator('.fm-status-text')).toHaveText('Focusing');
  await expect(fm(page).locator('.fm-face')).not.toHaveText('25:00', { timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(fm(page)).toBeHidden();
  expect(runtimeErrors).toEqual([]);
});

test('the timer card and focus mode are one timer', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  const timer = page.locator('#dash .dash-card[data-type="timer"]');
  await timer.getByRole('button', { name: 'Start' }).click();
  await timer.getByRole('button', { name: 'Open focus mode' }).click();
  await expect(fm(page)).toHaveClass(/is-running/);
  await fm(page).getByRole('button', { name: 'Pause' }).click();
  await page.keyboard.press('Escape');
  await expect(timer).not.toHaveClass(/is-running/);
  expect(await timer.locator('.dash-timer-face').textContent()).toBe(await fm(page).locator('.fm-face').textContent());
});

test('five more minutes, and skipping to the break without counting it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await command(page, 'focus');
  await fm(page).getByRole('button', { name: 'Five more minutes' }).click();
  await expect(fm(page).locator('.fm-face')).toHaveText('30:00');
  await fm(page).getByRole('button', { name: 'Skip to the next part' }).click();
  await expect(fm(page).locator('.fm-phase')).toHaveText('Break');
  await expect(fm(page)).toHaveClass(/is-rest/);
  await expect(fm(page).locator('.fm-stats')).toContainText('0 sessions');
});

test('a finished focus is counted in the minutes of the day, and a streak builds', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install();
  await command(page, 'focus');
  await fm(page).getByRole('button', { name: 'Start' }).click();
  await page.clock.fastForward('25:02');
  await expect(fm(page).locator('.fm-phase')).toHaveText('Break', { timeout: 5000 });
  await expect(fm(page).locator('.fm-stats')).toContainText('Today: 25 min');
  await expect(fm(page).locator('.fm-stats')).toContainText('1 sessions');
});

test('count up measures how long, and stopping logs it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install();
  await command(page, 'focus');
  await fm(page).getByRole('radio', { name: 'Count up' }).click();
  await expect(fm(page).locator('.fm-face')).toHaveText('0:00');
  await expect(fm(page).getByRole('button', { name: 'Five more minutes' })).toBeHidden();
  await fm(page).getByRole('button', { name: 'Start' }).click();
  await page.clock.fastForward('12:00');
  await expect(fm(page).locator('.fm-face')).toHaveText(/^12:0\d$/);
  await fm(page).getByRole('button', { name: 'Reset' }).click();
  await expect(fm(page).locator('.fm-stats')).toContainText('Today: 12 min');
});

test('what you will focus on is kept, and Enter starts the timer', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await command(page, 'focus');
  const intent = fm(page).getByRole('textbox', { name: 'I will focus on…' });
  await intent.fill('The release notes');
  await intent.press('Enter');
  await expect(fm(page)).toHaveClass(/is-running/);
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await command(page, 'focus');
  await expect(fm(page).getByRole('textbox', { name: 'I will focus on…' })).toHaveValue('The release notes');
  await expect(fm(page)).toHaveClass(/is-running/);
});

test('a sound plays only while a focus runs', async ({ nordlysPage, browserName }) => {
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'Playwright WebKit on Windows has no AudioContext; Safari has');
  const { page } = nordlysPage;
  await command(page, 'focus');
  await fm(page).getByRole('radio', { name: 'Rain' }).click();
  await expect(fm(page).getByRole('radio', { name: 'Rain' })).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.Nordlys.dashboard.sounds.playing)).toBeFalsy();
  await fm(page).getByRole('button', { name: 'Start' }).click();
  await expect.poll(() => page.evaluate(() => window.Nordlys.dashboard.sounds.playing)).toBe('rain');
  await fm(page).getByRole('button', { name: 'Pause' }).click();
  await expect.poll(() => page.evaluate(() => window.Nordlys.dashboard.sounds.playing)).toBeFalsy();
});

test('tasks from the dashboard are there to tick off', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await on(page);
  await page.evaluate(() => window.Nordlys.dashboard.addTask('Send the invoice'));
  await command(page, 'focus');
  const box = fm(page).getByRole('checkbox', { name: 'Send the invoice' });
  await box.check();
  await page.keyboard.press('Escape');
  await expect(page.locator('#dash .dash-card[data-type="tasks"] .dash-task.is-done')).toHaveText('Send the invoice');
});

test('focus stays inside while it is open', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await command(page, 'focus');
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#focus-mode')))).toBe(true);
  }
});

test('in Russian it speaks Russian', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.I18N.setLanguage('ru'));
  await command(page, 'фокус');
  await expect(fm(page)).toBeVisible();
  const text = await fm(page).innerText();
  expect(text).toMatch(/Фокус|Помидоро/);
  expect(text).not.toMatch(/focus\.[a-z]|Count up|Pomodoro/);
});
