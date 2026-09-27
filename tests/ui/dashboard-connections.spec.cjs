const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Connected apps: a token pasted once, tasks and events read from each
   service, ticked back where the service allows it. The services are stood
   in for with page.route, answering the way their APIs do. */

const inbox = page => page.locator('#dash .dash-card[data-type="inbox"]').first();
const agenda = page => page.locator('#dash .dash-card[data-type="agenda"]').first();

test.beforeEach(async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.clock.install({ time: new Date('2026-09-27T10:00:00') });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.dashboard));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); d.add('inbox'); d.add('agenda'); await d.render(); });
});

async function connect(page, name, fields) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-dashboard').click();
  await page.locator('#sec-dashboard .dash-connection', { hasText: name }).click();
  for (const [id, value] of Object.entries(fields)) await page.locator(`#dash-conn-${id}`).fill(value);
  await page.locator('.dash-dialog').getByRole('button', { name: 'Connect' }).click();
  await expect(page.locator('.dash-dialog')).toHaveCount(0, { timeout: 5000 });
  await page.keyboard.press('Escape');
}

test('Todoist: connected with a token, its tasks listed by when, one ticked done in Todoist', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const closed = [];
  await page.route('https://api.todoist.com/api/v1/tasks?**', route => {
    expect(route.request().headers().authorization).toBe('Bearer td-1');
    route.fulfill({ json: { results: [
      { id: '1', content: 'Pay rent', due: { date: '2026-09-25' }, priority: 4 },
      { id: '2', content: 'Call Anna', due: { date: '2026-09-27' } },
      { id: '3', content: 'Plan the trip', due: { date: '2026-10-20' } }
    ], next_cursor: null } });
  });
  await page.route('https://api.todoist.com/api/v1/tasks/*/close', route => { closed.push(route.request().url()); route.fulfill({ status: 204, body: '' }); });
  await connect(page, 'Todoist', { token: 'td-1' });
  expect(await page.evaluate(() => window.__origins.asked)).toContain('https://api.todoist.com/*');
  await expect(inbox(page).locator('.dash-inbox-title')).toHaveText(['Pay rent', 'Call Anna', 'Plan the trip']);
  await expect(inbox(page).locator('.dash-inbox-group')).toHaveText(['Overdue', 'Today', 'Later']);
  // A click, not check(): the row leaves the list once Todoist says it is done.
  await inbox(page).getByRole('checkbox', { name: 'Done in Todoist: Call Anna' }).click();
  await expect(inbox(page).locator('.dash-inbox-title')).toHaveText(['Pay rent', 'Plan the trip']);
  expect(closed).toEqual(['https://api.todoist.com/api/v1/tasks/2/close']);
  // The token is in local storage only: not the config, not a backup.
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.config))).not.toContain('td-1');
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.settings.buildBackupPayload()))).not.toContain('td-1');
  expect(runtimeErrors).toEqual([]);
});

test('two apps merge into one list, and a filter shows one of them', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.github.com/issues?**', route => route.fulfill({ json: [{ id: 10, title: 'Fix the port', html_url: 'https://github.com/a/b/issues/10', repository: { full_name: 'a/b' } }] }));
  await page.route('https://api.github.com/search/issues?**', route => route.fulfill({ json: { items: [] } }));
  await page.route('https://api.linear.app/graphql', route => route.fulfill({ json: { data: { viewer: { assignedIssues: { nodes: [{ id: 'l1', identifier: 'NOR-1', title: 'Store copy', url: 'https://linear.app/x/issue/NOR-1', dueDate: '2026-09-28', team: { key: 'NOR' } }] } } } } }));
  await connect(page, 'GitHub', { token: 'gh' });
  await connect(page, 'Linear', { token: 'ln' });
  await expect(inbox(page).locator('.dash-inbox-title')).toHaveText(['NOR-1 Store copy', 'Fix the port']);
  await inbox(page).getByRole('tab', { name: 'GitHub' }).click();
  await expect(inbox(page).locator('.dash-inbox-title')).toHaveText(['Fix the port']);
  // GitHub issues can't be ticked from here: they open in GitHub instead.
  await expect(inbox(page).getByRole('button', { name: 'Open in GitHub' })).toBeVisible();
});

test('a refused token is said in the dialog, and nothing is saved', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.todoist.com/**', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-dashboard').click();
  await page.locator('#sec-dashboard .dash-connection', { hasText: 'Todoist' }).click();
  await page.locator('#dash-conn-token').fill('wrong');
  await page.locator('.dash-dialog').getByRole('button', { name: 'Connect' }).click();
  await expect(page.locator('.dash-dialog .dash-form-error')).toContainText('The token was refused (401)');
  expect(await page.evaluate(() => window.Nordlys.dashboard.connected('todoist'))).toBe(false);
});

test('one app failing leaves the others shown, with the error at the foot', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  let fail = false;
  await page.route('https://api.todoist.com/**', route => fail ? route.fulfill({ status: 500, body: 'down' }) : route.fulfill({ json: { results: [{ id: '1', content: 'From Todoist' }] } }));
  await page.route('https://api.trello.com/**', route => route.fulfill({ json: [{ id: 'c', name: 'From Trello', shortUrl: 'https://trello.com/c/c', board: { name: 'Home' } }] }));
  await connect(page, 'Todoist', { token: 't' });
  await connect(page, 'Trello', { key: 'k', token: 't' });
  fail = true;
  await inbox(page).getByRole('button', { name: 'Refresh' }).click();
  await expect(inbox(page).locator('.dash-inbox-title')).toHaveText(['From Trello']);
  await expect(inbox(page).locator('.dash-inbox-error')).toContainText('Todoist: The service answered 500');
});

test('a calendar link: the next events by day, all-day ones marked', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:1', 'DTSTART:20260927T140000Z', 'DTEND:20260927T150000Z', 'SUMMARY:Design review', 'LOCATION:Room 4', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:2', 'DTSTART;VALUE=DATE:20260928', 'SUMMARY:Holiday', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  await page.route('https://calendar.example.com/**', route => route.fulfill({ body: ics, headers: { 'content-type': 'text/calendar' } }));
  await connect(page, 'Calendar (ICS link)', { url: 'https://calendar.example.com/me/basic.ics' });
  await expect(agenda(page).locator('.dash-event-title')).toHaveText(['Design review', 'Holiday']);
  await expect(agenda(page).locator('.dash-inbox-group')).toHaveText(['Today', 'Tomorrow']);
  await expect(agenda(page).locator('.dash-event').nth(1).locator('.dash-event-time')).toHaveText('All day');
});

test('with nothing connected the cards offer to connect, and Google says it comes next', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await inbox(page).getByRole('button', { name: 'Connect an app' }).click();
  await expect(page.locator('.dash-menu [role="menuitem"]').first()).toBeVisible();
  await page.locator('.dash-menu').getByRole('menuitem', { name: /Google Tasks/ }).click();
  await expect(page.locator('.dash-dialog')).toContainText('comes in the next update');
  await expect(page.locator('.dash-dialog').getByRole('button', { name: 'Sign in' })).toBeDisabled();
});

test('disconnecting takes the tasks away and forgets the token', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.todoist.com/**', route => route.fulfill({ json: { results: [{ id: '1', content: 'X' }] } }));
  await connect(page, 'Todoist', { token: 'secret-t' });
  await expect(inbox(page).locator('.dash-inbox-title')).toHaveText(['X']);
  await page.locator('#gear').click();
  await page.locator('#settings-tab-dashboard').click();
  await page.locator('#sec-dashboard .dash-connection', { hasText: 'Todoist' }).click();
  await page.locator('.dash-dialog').getByRole('button', { name: 'Disconnect' }).click();
  await page.keyboard.press('Escape');
  await expect(inbox(page).getByRole('button', { name: 'Connect an app' })).toBeVisible();
  const stored = await page.evaluate(async () => JSON.stringify(await new Promise(r => chrome.storage.local.get('nordlys_connections', r))));
  expect(stored).not.toContain('secret-t');
});
