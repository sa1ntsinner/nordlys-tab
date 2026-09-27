const { test } = require('node:test');
const assert = require('node:assert');
const C = require('../../src/js/connectors.js');

const K = C.CONNECTORS;
const at = iso => new Date(iso).getTime();

test('every connector says what it needs, where to get it, and where it will reach', () => {
  for (const [id, c] of Object.entries(K)) {
    assert.ok(c.name && c.color && c.kind, `${id} names itself`);
    assert.ok(Array.isArray(c.fields), `${id} lists its fields`);
    for (const f of c.fields) assert.ok(f.key && f.label, `${id}.${f.key}`);
    const origins = C.originsOf(id, { host: 'https://gitlab.example.com', site: 'team.atlassian.net', url: 'https://calendar.google.com/calendar/ical/x/basic.ics' });
    assert.ok(origins.length >= 1, `${id} names the address it needs`);
    for (const o of origins) assert.match(o, /^https?:\/\/[^/*]+\/\*$/, `${id}: ${o}`);
    assert.ok(typeof c.read === 'function' && (c.requests || c.steps), `${id} can read`);
  }
});

test('Todoist: tasks, their dates and the top priority', () => {
  const [req] = K.todoist.requests({ token: 't' });
  assert.strictEqual(req.headers.Authorization, 'Bearer t');
  const items = K.todoist.read([{ results: [{ id: '7', content: 'Pay rent', due: { date: '2026-10-01' }, priority: 4 }, { id: '8', content: 'Read', priority: 1 }], next_cursor: null }]);
  assert.deepStrictEqual(items.map(i => [i.id, i.title, i.due, i.priority]), [['todoist:7', 'Pay rent', '2026-10-01', true], ['todoist:8', 'Read', null, false]]);
  assert.match(items[0].url, /^https:\/\/app\.todoist\.com\/app\/task\/7$/);
  const done = K.todoist.complete({ token: 't' }, items[0]);
  assert.strictEqual(done.url, 'https://api.todoist.com/api/v1/tasks/7/close');
  assert.strictEqual(done.method, 'POST');
});

test('GitHub: assigned issues and review requests, once each, with the repository', () => {
  const issue = { id: 1, title: 'Fix sync', html_url: 'https://github.com/a/b/issues/1', repository: { full_name: 'a/b' } };
  const pr = { id: 2, title: 'Add port', html_url: 'https://github.com/a/b/pull/2', pull_request: {}, repository_url: 'https://api.github.com/repos/a/b' };
  const items = K.github.read([[issue, pr], { items: [pr] }]);
  assert.deepStrictEqual(items.map(i => [i.title, i.context]), [['Fix sync', 'a/b'], ['Review: Add port', 'a/b']]);
});

test('Trello drops cards already done; Asana drops finished tasks', () => {
  const cards = K.trello.read([[{ id: 'c1', name: 'Plan', due: '2026-10-02T12:00:00.000Z', shortUrl: 'https://trello.com/c/1', board: { name: 'Home' } }, { id: 'c2', name: 'Old', dueComplete: true }]]);
  assert.deepStrictEqual(cards.map(c => [c.title, c.context]), [['Plan', 'Home']]);
  const tasks = K.asana.read([{ data: [{ gid: '9', name: 'Write', due_on: '2026-10-03', permalink_url: 'https://app.asana.com/0/1/9', completed: false, projects: [{ name: 'Launch' }] }, { gid: '10', name: 'Done', completed: true }] }]);
  assert.deepStrictEqual(tasks.map(t => [t.title, t.due, t.context]), [['Write', '2026-10-03', 'Launch']]);
});

test('ClickUp, Linear, Jira, GitLab and Notion answers read the same way', () => {
  assert.strictEqual(K.clickup.read([[{ tasks: [{ id: 'x', name: 'Ship', url: 'https://app.clickup.com/t/x', due_date: String(at('2026-10-04T10:00:00')), priority: { priority: 'urgent' } }] }]])[0].priority, true);
  const lin = K.linear.read([{ data: { viewer: { assignedIssues: { nodes: [{ id: 'l', identifier: 'NOR-12', title: 'Firefox port', url: 'https://linear.app/x/issue/NOR-12', dueDate: '2026-10-05', priority: 1, team: { key: 'NOR' } }] } } } }]);
  assert.deepStrictEqual([lin[0].title, lin[0].due, lin[0].priority], ['NOR-12 Firefox port', '2026-10-05', true]);
  const jira = K.jira.read([{ issues: [{ id: '1', key: 'WEB-3', fields: { summary: 'Landing', duedate: '2026-10-06', priority: { name: 'High' }, project: { name: 'Web' } } }] }], { site: 'team.atlassian.net' });
  assert.deepStrictEqual([jira[0].title, jira[0].url, jira[0].priority], ['WEB-3 Landing', 'https://team.atlassian.net/browse/WEB-3', true]);
  const gl = K.gitlab.read([[{ id: 5, title: 'Bug', web_url: 'https://gitlab.com/a/b/-/issues/5', due_date: '2026-10-07', references: { full: 'a/b#5' } }], [{ id: 6, title: 'MR', web_url: 'https://gitlab.com/a/b/-/merge_requests/6', references: { full: 'a/b!6' } }]]);
  assert.deepStrictEqual(gl.map(i => [i.title, i.context]), [['Bug', 'a/b'], ['Merge: MR', 'a/b']]);
  const notion = K.notion.read([{ results: [
    { id: 'p1', url: 'https://www.notion.so/p1', properties: { Name: { type: 'title', title: [{ plain_text: 'Write post' }] }, When: { type: 'date', date: { start: '2026-10-08' } }, Done: { type: 'checkbox', checkbox: false } } },
    { id: 'p2', url: 'https://www.notion.so/p2', properties: { Name: { type: 'title', title: [{ plain_text: 'Old' }] }, Status: { type: 'status', status: { name: 'Done' } } } }
  ] }]);
  assert.deepStrictEqual(notion.map(n => [n.title, n.due]), [['Write post', '2026-10-08']]);
});

test('an address that is not a web address is never kept as a link', () => {
  const [bad] = K.github.read([[{ id: 3, title: 'x', html_url: 'javascript:alert(1)' }], { items: [] }]);
  assert.strictEqual(bad.url, null);
});

test('Notion takes a database link or its bare id', () => {
  const [a] = K.notion.requests({ token: 't', database: 'https://www.notion.so/team/Tasks-1a2b3c4d5e6f708192a3b4c5d6e7f809?v=1' });
  assert.match(a.url, /databases\/1a2b3c4d5e6f708192a3b4c5d6e7f809\/query$/);
});

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:one
DTSTART:20260928T090000Z
DTEND:20260928T093000Z
SUMMARY:Standup\\, team
LOCATION:Room 2
END:VEVENT
BEGIN:VEVENT
UID:weekly
DTSTART:20260929T150000Z
DTEND:20260929T160000Z
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Gym
END:VEVENT
BEGIN:VEVENT
UID:holiday
DTSTART;VALUE=DATE:20261003
SUMMARY:Unity Day
END:VEVENT
BEGIN:VEVENT
UID:past
DTSTART:20260101T090000Z
SUMMARY:Long ago
END:VEVENT
BEGIN:VEVENT
UID:gone
DTSTART:20260930T090000Z
STATUS:CANCELLED
SUMMARY:Cancelled
END:VEVENT
BEGIN:VEVENT
UID:folded
DTSTART:20261001T080000Z
SUMMARY:A very long title that
  goes on
END:VEVENT
END:VCALENDAR`;

test('a calendar file becomes the next two weeks of events, repeats unrolled', () => {
  const list = C.events(ICS, at('2026-09-27T12:00:00Z'));
  assert.deepStrictEqual(list.map(e => e.title), ['Standup, team', 'Gym', 'A very long title that goes on', 'Unity Day', 'Gym']);
  assert.strictEqual(list.find(e => e.title === 'Unity Day').allDay, true);
  assert.strictEqual(list[0].location, 'Room 2');
  const items = K.ics.read([ICS], {}, at('2026-09-27T12:00:00Z'));
  assert.strictEqual(items[0].due, C.day('2026-09-28T09:00:00Z'));
});

test('a service counts as connected only when its fields are filled', () => {
  assert.strictEqual(C.ready('todoist', {}), false);
  assert.strictEqual(C.ready('todoist', { token: 'x' }), true);
  assert.strictEqual(C.ready('jira', { site: 's', email: 'e' }), false);
  assert.strictEqual(C.ready('asana', { token: 'x' }), true, 'the workspace is optional');
  assert.strictEqual(C.ready('gitlab', { token: 'x' }), true, 'the server defaults to gitlab.com');
  assert.strictEqual(C.ready('googletasks', {}), false);
  assert.strictEqual(C.ready('googletasks', { accessToken: 'a' }), true);
});
