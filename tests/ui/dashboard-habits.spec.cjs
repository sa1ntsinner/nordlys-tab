const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The habits card: a week of dots per habit, tapped to tick a day, and the
   run of days in a row beside it. */

const habits = page => page.locator('#dash .dash-card[data-type="habits"]').first();

test.beforeEach(async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install({ time: new Date('2026-09-26T10:00:00') });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); d.add('habits'); await d.render(); });
});

test('a habit is added, today is ticked, and the streak shows', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const input = habits(page).getByRole('textbox', { name: 'Add a habit' });
  await input.fill('Read 20 pages');
  await input.press('Enter');
  await expect(habits(page).locator('.dash-habit-name').last()).toHaveText('Read 20 pages');
  const days = habits(page).getByRole('group', { name: 'Read 20 pages' }).getByRole('button');
  await expect(days).toHaveCount(7);
  await days.nth(5).click();
  await days.nth(6).click();
  await expect(days.nth(6)).toHaveAttribute('aria-pressed', 'true');
  await expect(habits(page).locator('.dash-habit-streak.is-on b')).toHaveText('2');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(habits(page).locator('.dash-habit-streak.is-on b')).toHaveText('2');
  expect(runtimeErrors).toEqual([]);
});

test('a tick taken back ends the streak it made', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await habits(page).getByRole('textbox', { name: 'Add a habit' }).fill('Walk');
  await habits(page).getByRole('textbox', { name: 'Add a habit' }).press('Enter');
  const today = habits(page).getByRole('group', { name: 'Walk' }).getByRole('button').nth(6);
  await today.click();
  await today.click();
  await expect(today).toHaveAttribute('aria-pressed', 'false');
  await expect(habits(page).locator('.dash-habit-streak.is-on')).toHaveCount(0);
});

test('the day buttons say which day they are', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await habits(page).getByRole('textbox', { name: 'Add a habit' }).fill('Stretch');
  await habits(page).getByRole('textbox', { name: 'Add a habit' }).press('Enter');
  await expect(habits(page).getByRole('button', { name: /Stretch: Saturday, 26 September|Stretch: Saturday, September 26/ })).toHaveCount(1);
});
