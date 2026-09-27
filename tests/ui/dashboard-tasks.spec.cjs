const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The task card: four views, dates and importance typed in plain words,
   steps inside a task, and the order changed by hand or by keyboard. */

const tasks = page => page.locator('#dash .dash-card[data-type="tasks"]').first();
const texts = page => tasks(page).locator('.dash-task-text').allTextContents();

test.beforeEach(async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install({ time: new Date('2026-09-26T10:00:00') });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => {
    const d = window.Nordlys.dashboard;
    d.setOn(true);
    await d.render();
    const w = d.widgets().find(x => x.type === 'tasks');
    d.change(w.id, x => ({ ...x, w: 6, h: 5 }));
    await d.render();
  });
});

async function add(page, text) {
  const input = tasks(page).getByRole('textbox', { name: 'Add a task' });
  await input.fill(text);
  await input.press('Enter');
}

test('typed words set the date and importance, and the hint says what was understood', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const input = tasks(page).getByRole('textbox', { name: 'Add a task' });
  await input.fill('Call the dentist tomorrow !');
  await expect(tasks(page).locator('.dash-task-hint')).toHaveText('Tomorrow · Important');
  await input.press('Enter');
  const row = tasks(page).locator('.dash-task').first();
  await expect(row.locator('.dash-task-text')).toHaveText('Call the dentist');
  await expect(row.locator('.dash-task-due')).toHaveText('Tomorrow');
  await expect(row).toHaveClass(/is-important/);
});

test('the four views sort the list by when', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await add(page, 'Anytime');
  await add(page, 'Pay rent today');
  await add(page, 'Report on monday');
  await add(page, 'Done already');
  await tasks(page).getByRole('checkbox', { name: 'Done already' }).check();
  await tasks(page).getByRole('tab', { name: /Today/ }).click();
  expect(await texts(page)).toEqual(['Pay rent']);
  await tasks(page).getByRole('tab', { name: /Later/ }).click();
  expect(await texts(page)).toEqual(['Report']);
  await tasks(page).getByRole('tab', { name: /Done/ }).click();
  expect(await texts(page)).toEqual(['Done already']);
  await expect(tasks(page).getByRole('textbox', { name: 'Add a task' })).toBeHidden();
  // Adding in Today makes a task for today.
  await tasks(page).getByRole('tab', { name: /Today/ }).click();
  await add(page, 'Water the plants');
  expect(await texts(page)).toEqual(['Pay rent', 'Water the plants']);
  // The chosen view is kept.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(tasks(page).getByRole('tab', { name: /Today/ })).toHaveAttribute('aria-selected', 'true');
});

test('a task overdue says so', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => {
    const d = window.Nordlys.dashboard;
    const w = d.widgets().find(x => x.type === 'tasks');
    const list = d.data.get(w.id) || { items: [] };
    window.NordlysWidgetKit.tasks.add(list, 'Late thing', Date.now(), { due: '2026-09-20' });
    d.persist(w.id, list);
    d.refreshKey(w.id, list);
  });
  await expect(tasks(page).locator('.dash-task-due.is-overdue')).toBeVisible();
});

test('steps inside a task: added, ticked and counted', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await add(page, 'Move house');
  await tasks(page).getByRole('button', { name: 'Steps and details: Move house' }).click();
  const step = tasks(page).getByRole('textbox', { name: 'Add a step' });
  await step.fill('Boxes');
  await step.press('Enter');
  await tasks(page).getByRole('textbox', { name: 'Add a step' }).fill('Van');
  await tasks(page).getByRole('textbox', { name: 'Add a step' }).press('Enter');
  await tasks(page).getByRole('checkbox', { name: 'Boxes' }).check();
  await expect(tasks(page).locator('.dash-task-subs')).toHaveText('1/2');
  await expect(tasks(page).getByRole('checkbox', { name: 'Move house' })).not.toBeChecked();
});

test('the date menu moves a task to tomorrow and takes the date away', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await add(page, 'Thing');
  await tasks(page).locator('.dash-task').first().hover();
  await tasks(page).getByRole('button', { name: 'When' }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'Tomorrow' }).click();
  await expect(tasks(page).locator('.dash-task-due')).toHaveText('Tomorrow');
  await tasks(page).locator('.dash-task').first().hover();
  await tasks(page).getByRole('button', { name: 'When' }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'No date' }).click();
  await expect(tasks(page).locator('.dash-task-due')).toHaveCount(0);
});

test('important tasks rise to the top; the flag toggles it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await add(page, 'First');
  await add(page, 'Second');
  const second = tasks(page).locator('.dash-task', { hasText: 'Second' });
  await second.hover();
  await second.getByRole('button', { name: 'Important' }).click();
  expect(await texts(page)).toEqual(['Second', 'First']);
});

test('the order is changed by dragging a task, and by Alt and an arrow', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const t of ['One', 'Two', 'Three']) await add(page, t);
  const three = await tasks(page).locator('.dash-task', { hasText: 'Three' }).locator('.dash-task-text').boundingBox();
  const one = await tasks(page).locator('.dash-task', { hasText: 'One' }).boundingBox();
  await page.mouse.move(three.x + 20, three.y + 5);
  await page.mouse.down();
  await page.mouse.move(three.x + 20, three.y - 10, { steps: 3 });
  await page.mouse.move(three.x + 20, one.y + 4, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => texts(page)).toEqual(['Three', 'One', 'Two']);
  await tasks(page).locator('.dash-task-text', { hasText: 'Three' }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => texts(page)).toEqual(['One', 'Three', 'Two']);
  await expect(tasks(page).locator('.dash-task-text', { hasText: 'Three' })).toBeFocused();
});

test('Russian dates are understood in the Russian page', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.I18N.setLanguage('ru'));
  const input = tasks(page).getByRole('textbox', { name: 'Добавить задачу' });
  await input.fill('Позвонить маме завтра');
  await input.press('Enter');
  await expect(tasks(page).locator('.dash-task-due')).toHaveText('Завтра');
  await expect(tasks(page).locator('.dash-task-text')).toHaveText('Позвонить маме');
});

test('"> task" reads the date and importance too', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#q').click();
  await page.locator('#q').fill('>task Reply to Anna tomorrow !');
  await page.locator('#q').press('Enter');
  const row = tasks(page).locator('.dash-task', { hasText: 'Reply to Anna' });
  await expect(row.locator('.dash-task-text')).toHaveText('Reply to Anna');
  await expect(row.locator('.dash-task-due')).toHaveText('Tomorrow');
  await expect(row).toHaveClass(/is-important/);
});

/* More tasks than a small card holds: the list scrolls, no row is squeezed,
   and the edge fades while more is below (a row cut through its middle
   with nothing to say why looked broken). */
test('a long list in a small card scrolls and keeps every row whole', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async () => {
    const d = window.Nordlys.dashboard;
    const w = d.widgets().find(x => x.type === 'tasks');
    d.change(w.id, x => ({ ...x, w: 4, h: 3 }));
    await d.render();
  });
  for (const text of ['one', 'two', 'three', 'four', 'five', 'six', 'seven']) await add(page, text);
  const rows = await tasks(page).locator('.dash-task').evaluateAll(nodes => nodes.map(node => ({ height: node.getBoundingClientRect().height, content: node.scrollHeight })));
  expect(rows.length).toBe(7);
  for (const row of rows) expect(row.height).toBeGreaterThanOrEqual(row.content - 1);
  const list = await tasks(page).locator('.dash-tasks').evaluate(node => ({ scroll: node.scrollHeight, client: node.clientHeight }));
  expect(list.scroll).toBeGreaterThan(list.client);
  // A row cut by the edge fades out, so the list reads as one that scrolls.
  await expect(tasks(page).locator('.dash-tasks')).toHaveClass(/is-more/);
  await tasks(page).locator('.dash-tasks').evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
  await expect(tasks(page).locator('.dash-tasks')).not.toHaveClass(/is-more/);
});
