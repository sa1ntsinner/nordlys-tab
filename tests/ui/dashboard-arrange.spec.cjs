const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Moving and resizing the dashboard cards with the mouse (dash-arrange.js
   over dash-layout.js). The starter layout on a wide window:
     focus 6×2 at 0,0 · tasks 3×3 at 6,0 · timer 3×2 at 9,0 */

const card = (page, type) => page.locator(`#dash .dash-card[data-type="${type}"]`).first();
const spots = page => page.evaluate(() => Object.fromEntries(window.Nordlys.dashboard.layout().map(it => {
  const type = window.Nordlys.dashboard.widgets().find(w => w.id === it.id).type;
  return [type, [it.x, it.y, it.w, it.h]];
})));
const noOverlap = async page => {
  const boxes = await page.locator('#dash .dash-card').evaluateAll(cards => cards.map(c => c.getBoundingClientRect()).map(r => [r.left, r.top, r.right, r.bottom]));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    expect(a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2, `cards ${i} and ${j} overlap`).toBe(false);
  }
};

test.beforeEach(async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => { window.Nordlys.dashboard.setOn(true); await window.Nordlys.dashboard.render(); });
});

async function drag(page, from, to, { steps = 16, release = true } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps });
  await page.waitForTimeout(120);
  if (release) await page.mouse.up();
  await page.waitForTimeout(500);
}

test('a card is picked up by its header and set down in another place', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  expect(await spots(page)).toEqual({ focus: [0, 0, 6, 2], tasks: [6, 0, 3, 3], timer: [9, 0, 3, 2] });
  const head = await card(page, 'timer').locator('.dash-head h2').boundingBox();
  const focus = await card(page, 'focus').boundingBox();
  // Timer's corner onto the start of the row.
  await drag(page, { x: head.x + 10, y: head.y + 8 }, { x: focus.x + 30, y: focus.y + 20 });
  const after = await spots(page);
  expect(after.timer.slice(0, 2)).toEqual([0, 0]);
  await noOverlap(page);
  // Kept across a reload.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await spots(page)).toEqual(after);
  expect(runtimeErrors).toEqual([]);
});

test('while it is carried the others step aside and an outline shows where it will land', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const head = await card(page, 'timer').locator('.dash-head h2').boundingBox();
  const focus = await card(page, 'focus').boundingBox();
  await drag(page, { x: head.x + 10, y: head.y + 8 }, { x: focus.x + 30, y: focus.y + 20 }, { release: false });
  await expect(page.locator('#dash .dash-ghost')).toHaveCount(1);
  await expect(card(page, 'timer')).toHaveClass(/is-lifted/);
  const ghost = await page.locator('#dash .dash-ghost').boundingBox();
  expect(Math.abs(ghost.x - focus.x)).toBeLessThan(4);
  // Focus has moved out from under it already, before the drop.
  await page.waitForTimeout(500);
  const focusNow = await card(page, 'focus').boundingBox();
  expect(Math.hypot(focusNow.x - focus.x, focusNow.y - focus.y)).toBeGreaterThan(20);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.locator('#dash .dash-ghost')).toHaveCount(0);
  await expect(card(page, 'timer')).not.toHaveClass(/is-lifted/);
});

test('Escape while carrying puts everything back where it was', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await spots(page);
  const head = await card(page, 'timer').locator('.dash-head h2').boundingBox();
  await drag(page, { x: head.x + 10, y: head.y + 8 }, { x: 200, y: head.y + 300 }, { release: false });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect(await spots(page)).toEqual(before);
  await noOverlap(page);
});

test('the corner stretches a card cell by cell, and the rest make room', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const box = await card(page, 'tasks').boundingBox();
  await card(page, 'tasks').hover();
  const corner = await card(page, 'tasks').locator('.dash-resize').boundingBox();
  const cell = box.width / 3;
  await drag(page, { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, { x: corner.x + cell * 3, y: corner.y + corner.height / 2 });
  const after = await spots(page);
  expect(after.tasks[2]).toBe(6);
  await noOverlap(page);
  await expect(card(page, 'tasks')).toHaveAttribute('data-w', '6');
});

test('a card cannot be made smaller than it can show', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await card(page, 'timer').hover();
  const corner = await card(page, 'timer').locator('.dash-resize').boundingBox();
  await drag(page, { x: corner.x + 9, y: corner.y + 9 }, { x: corner.x - 400, y: corner.y - 300 });
  const after = await spots(page);
  expect(after.timer[2]).toBeGreaterThanOrEqual(3);
  expect(after.timer[3]).toBeGreaterThanOrEqual(2);
});

test('clicking in a card, its buttons and its fields never starts a drag', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await spots(page);
  const input = card(page, 'tasks').getByRole('textbox', { name: 'Add a task' });
  const box = await input.boundingBox();
  await drag(page, { x: box.x + 20, y: box.y + 8 }, { x: box.x - 300, y: box.y + 200 });
  expect(await spots(page)).toEqual(before);
  await card(page, 'timer').getByRole('button', { name: 'Start' }).click();
  await expect(card(page, 'timer')).toHaveClass(/is-running/);
  expect(await spots(page)).toEqual(before);
});

test('a narrow window stacks the cards in reading order and does not drag', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(400);
  const tops = await page.locator('#dash .dash-card').evaluateAll(cards => cards.map(c => [c.dataset.type, Math.round(c.getBoundingClientRect().top)]).sort((a, b) => a[1] - b[1]).map(([t]) => t));
  expect(tops).toEqual(['focus', 'tasks', 'timer']);
  await noOverlap(page);
  const before = await spots(page);
  const head = await card(page, 'timer').locator('.dash-head h2').boundingBox();
  await drag(page, { x: head.x + 10, y: head.y + 8 }, { x: head.x + 10, y: head.y - 300 });
  expect(await spots(page)).toEqual(before);
});

test('with One page fit on, a drop that makes the grid taller still lands where it was dropped', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 1440, height: 810 });
  await Promise.all([page.waitForEvent('load'), page.evaluate(() => { window.Nordlys.config.onePageFit = true; window.Nordlys.saveConfig(); location.reload(); })]);
  await page.waitForFunction(() => Boolean(window.Nordlys?.dashboard));
  await page.evaluate(async () => {
    const d = window.Nordlys.dashboard; d.setOn(true);
    const cards = [['focus', 0, 0, 6, 2], ['countdown', 6, 0, 3, 2], ['clocks', 9, 0, 3, 2], ['tasks', 0, 2, 5, 3], ['habits', 5, 2, 4, 3], ['timer', 9, 2, 3, 3]];
    d.write({ ...d.state, on: true, seeded: true, widgets: cards.map(([type, x, y, w, h]) => ({ ...d.blank(type), x, y, w, h })) });
    await d.render();
  });
  await page.waitForTimeout(600);
  const head = await card(page, 'clocks').locator('.dash-head h2').boundingBox();
  const focus = await card(page, 'focus').boundingBox();
  // At a person's pace, so the page has time to react while the card is in the hand.
  await page.mouse.move(head.x + 10, head.y + 6);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(head.x + 10 + (focus.x + 12 - head.x - 10) * i / 30, head.y + 6 + (focus.y + 12 - head.y - 6) * i / 30);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(700);
  const after = await spots(page);
  expect(after.clocks.slice(0, 2)).toEqual([0, 0]);
  await noOverlap(page);
  expect(await page.locator('#dash').innerText()).not.toMatch(/\bnull\b|\bundefined\b/);
});
