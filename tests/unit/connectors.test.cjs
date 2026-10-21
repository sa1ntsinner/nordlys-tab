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
    const origins = C.originsOf(id, { url: 'https://calendar.google.com/calendar/ical/x/basic.ics' });
    assert.ok(origins.length >= 1, `${id} names the address it needs`);
    for (const o of origins) assert.match(o, /^https?:\/\/[^/*]+\/\*$/, `${id}: ${o}`);
    assert.ok(typeof c.read === 'function' && c.requests, `${id} can read`);
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

test('an address that is not a web address is never kept as a link', () => {
  const [bad] = K.github.read([[{ id: 3, title: 'x', html_url: 'javascript:alert(1)' }], { items: [] }]);
  assert.strictEqual(bad.url, null);
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
  assert.strictEqual(C.ready('ics', { url: ' ' }), false);
  assert.strictEqual(C.ready('gitlab', { token: 'x' }), false, 'an app no longer read from is never connected');
});

test('only apps with a token or a link are left: no sign-in window, nothing to register', () => {
  assert.deepStrictEqual(Object.keys(K), ['todoist', 'github', 'ics']);
  assert.strictEqual(C.signIn, undefined);
});

/* Calendars as real ones send them: a zone of their own, repeats by month
   and year, a meeting called off and one moved. */
const zoned = body => `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR`;
const ev = lines => `BEGIN:VEVENT\n${lines.join('\n')}\nEND:VEVENT`;

test('a time with a TZID is read in that zone, not in the viewer\'s', () => {
  const list = C.events(zoned(ev(['UID:ny', 'DTSTART;TZID=America/New_York:20261005T090000', 'DTEND;TZID=America/New_York:20261005T100000', 'SUMMARY:Call'])), at('2026-10-04T00:00:00Z'));
  assert.strictEqual(list[0].start, '2026-10-05T13:00:00.000Z');
  assert.strictEqual(list[0].end, '2026-10-05T14:00:00.000Z');
});

test('a weekly meeting keeps its hour across the change to winter time', () => {
  const list = C.events(zoned(ev(['UID:w', 'DTSTART;TZID=Europe/Berlin:20261019T090000', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Standup'])), at('2026-10-18T00:00:00Z'));
  assert.deepStrictEqual(list.map(e => e.start), ['2026-10-19T07:00:00.000Z', '2026-10-26T08:00:00.000Z']);
});

test('BYDAY gives every day it names, and EXDATE takes one away', () => {
  const list = C.events(zoned(ev(['UID:mwf', 'DTSTART:20261005T080000Z', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR', 'EXDATE:20261007T080000Z', 'SUMMARY:Run'])), at('2026-10-04T00:00:00Z'));
  assert.deepStrictEqual(list.map(e => e.start.slice(0, 10)), ['2026-10-05', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16']);
});

test('monthly and yearly repeats are unrolled, by day of month and by "the last Friday"', () => {
  const ics = zoned([
    ev(['UID:rent', 'DTSTART;VALUE=DATE:20260115', 'RRULE:FREQ=MONTHLY', 'SUMMARY:Rent']),
    ev(['UID:review', 'DTSTART:20260130T100000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR', 'SUMMARY:Review']),
    ev(['UID:bday', 'DTSTART;VALUE=DATE:19900620', 'RRULE:FREQ=YEARLY', 'SUMMARY:Birthday']),
    ev(['UID:thanks', 'DTSTART;VALUE=DATE:20201126', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=4TH', 'SUMMARY:Thanksgiving'])
  ].join('\n'));
  assert.deepStrictEqual(C.events(ics, at('2026-10-14T00:00:00Z'), 31).map(e => [e.title, e.start.slice(0, 10)]), [['Rent', '2026-10-15'], ['Review', '2026-10-30']]);
  assert.deepStrictEqual(C.events(ics, at('2026-06-15T00:00:00Z')).map(e => e.title), ['Rent', 'Birthday', 'Review']);
  assert.deepStrictEqual(C.events(ics, at('2026-11-20T00:00:00Z')).map(e => [e.title, e.start.slice(0, 10)]), [['Thanksgiving', '2026-11-26'], ['Review', '2026-11-27']]);
});

test('a meeting moved with RECURRENCE-ID shows once, at its new time', () => {
  const ics = zoned([
    ev(['UID:sync', 'DTSTART:20261005T150000Z', 'DTEND:20261005T153000Z', 'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Sync']),
    ev(['UID:sync', 'RECURRENCE-ID:20261012T150000Z', 'DTSTART:20261013T160000Z', 'DTEND:20261013T163000Z', 'SUMMARY:Sync (moved)'])
  ].join('\n'));
  assert.deepStrictEqual(C.events(ics, at('2026-10-04T00:00:00Z')).map(e => [e.title, e.start]), [
    ['Sync', '2026-10-05T15:00:00.000Z'], ['Sync (moved)', '2026-10-13T16:00:00.000Z']
  ]);
});

test('COUNT counts from the first time, even years back, and a daily repeat from long ago is quick', () => {
  const ics = zoned([
    ev(['UID:old', 'DTSTART:20200101T090000Z', 'RRULE:FREQ=DAILY;COUNT=10', 'SUMMARY:Gone']),
    ev(['UID:pill', 'DTSTART:20100101T080000Z', 'RRULE:FREQ=DAILY', 'SUMMARY:Pill'])
  ].join('\n'));
  const t = Date.now();
  const list = C.events(ics, at('2026-10-04T00:00:00Z'));
  assert.ok(Date.now() - t < 500, 'sixteen years of a daily repeat');
  assert.strictEqual(list.filter(e => e.title === 'Gone').length, 0);
  assert.strictEqual(list.filter(e => e.title === 'Pill').length, 14);
});
