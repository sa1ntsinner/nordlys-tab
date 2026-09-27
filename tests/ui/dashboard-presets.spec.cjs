const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Layouts to start from, and Balance for the hours after work. */

const types = page => page.evaluate(() => window.Nordlys.dashboard.readingOrder().map(id => window.Nordlys.dashboard.widgets().find(w => w.id === id).type));
async function openSection(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-dashboard').click();
}

test('a layout is chosen in Settings, laid out as drawn, and Undo brings the old one back', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => { window.Nordlys.dashboard.setOn(true); await window.Nordlys.dashboard.render(); });
  const before = await types(page);
  await openSection(page);
  await page.locator('#sec-dashboard').getByRole('button', { name: /Planner/ }).click();
  expect(await types(page)).toEqual(['focus', 'countdown', 'tasks', 'habits', 'timer', 'notes']);
  await page.keyboard.press('Escape');
  const boxes = await page.locator('#dash .dash-card').evaluateAll(cards => cards.map(c => c.getBoundingClientRect()).map(r => [r.left, r.top, r.right, r.bottom]));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    expect(a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2).toBe(false);
  }
  await page.locator('#toast-dock .toast-action').last().click();
  expect(await types(page)).toEqual(before);
  expect(runtimeErrors).toEqual([]);
});

test('every layout draws a picture of itself', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => { window.Nordlys.dashboard.setOn(true); await window.Nordlys.dashboard.render(); });
  await openSection(page);
  await expect(page.locator('#sec-dashboard .dash-preset')).toHaveCount(5);
  for (const count of await page.locator('#sec-dashboard .dash-preset-picture').evaluateAll(pics => pics.map(p => p.children.length))) expect(count).toBeGreaterThan(0);
});

test('Balance rests the working cards outside the hours, and brings them back inside', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install({ time: new Date('2026-09-28T20:30:00') }); // a Monday evening
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); d.applyPreset('planner'); await d.render(); });
  await openSection(page);
  await page.locator('#sec-dashboard .dash-balance label.tg').click();
  await expect(page.locator('#sec-dashboard .dash-balance-hours')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.locator('#dash .dash-card').evaluateAll(cards => cards.map(c => c.dataset.type).sort())).toEqual(['countdown', 'notes']);
  // Morning comes, the working cards are back without a reload.
  await page.clock.setSystemTime(new Date('2026-09-29T09:30:00'));
  await page.clock.fastForward('01:01');
  await expect.poll(() => page.locator('#dash .dash-card').count()).toBe(6);
});

test('on a weekend Balance rests all day, unless weekdays only is turned off', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install({ time: new Date('2026-09-26T11:00:00') }); // Saturday
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); d.applyPreset('deep'); d.setBalance({ on: true }); await d.render(); });
  await expect(page.locator('#dash .dash-card')).toHaveCount(1);
  await page.evaluate(async () => { window.Nordlys.dashboard.setBalance({ weekdays: false }); await window.Nordlys.dashboard.render(); });
  await expect(page.locator('#dash .dash-card')).toHaveCount(4);
});

test('the folders can be set aside while the dashboard is on, and One page fit still fits', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); d.applyPreset('planner'); await d.render(); });
  await openSection(page);
  await page.locator('#sec-dashboard').getByRole('checkbox', { name: /Show the folders/ }).evaluate(node => node.closest('.row').querySelector('label.tg').click());
  await page.keyboard.press('Escape');
  await expect(page.locator('#board')).toBeHidden();
  await page.evaluate(() => { window.Nordlys.config.onePageFit = true; window.Nordlys.saveConfig(); location.reload(); });
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('#board')).toBeHidden();
  await page.waitForTimeout(600);
  const bottom = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#dash .dash-card')].map(n => n.getBoundingClientRect().bottom)));
  expect(bottom).toBeLessThanOrEqual(901);
  // Off, and the folders are back.
  await page.evaluate(() => window.Nordlys.dashboard.setOn(false));
  await expect(page.locator('#board')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
