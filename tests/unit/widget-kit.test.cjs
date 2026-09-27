const { test } = require('node:test');
const assert = require('node:assert');
const K = require('../../src/js/widget-kit.js');

const DAY = 24 * 3600 * 1000;
const at = iso => new Date(iso).getTime();

// ── Tasks ────────────────────────────────────────────────────────
test('a task is added trimmed, and an empty one is not added at all', () => {
  const list = K.tasks.create();
  assert.strictEqual(K.tasks.add(list, '   ', at('2026-09-26T09:00')), null);
  const task = K.tasks.add(list, '  Write the release notes  ', at('2026-09-26T09:00'));
  assert.strictEqual(task.text, 'Write the release notes');
  assert.strictEqual(list.items.length, 1);
  assert.ok(task.id);
});

test('a very long task is cut to a sensible length', () => {
  const list = K.tasks.create();
  const task = K.tasks.add(list, 'x'.repeat(2000), 0);
  assert.strictEqual(task.text.length, K.tasks.MAX_TEXT);
});

test('done tasks sink below open ones, and ones done on an earlier day drop off', () => {
  const list = K.tasks.create();
  const a = K.tasks.add(list, 'A', at('2026-09-25T09:00'));
  K.tasks.add(list, "B", at("2026-09-25T09:00"));
  const c = K.tasks.add(list, 'C', at('2026-09-26T09:00'));
  K.tasks.toggle(list, a.id, at('2026-09-25T18:00'));
  K.tasks.toggle(list, c.id, at('2026-09-26T10:00'));
  const view = K.tasks.view(list, at('2026-09-26T12:00'));
  assert.deepStrictEqual(view.map(t => t.text), ['B', 'C']);
  assert.strictEqual(view[1].done, true);
});

test('toggling twice opens a task again', () => {
  const list = K.tasks.create();
  const a = K.tasks.add(list, 'A', 0);
  K.tasks.toggle(list, a.id, 10);
  K.tasks.toggle(list, a.id, 20);
  assert.strictEqual(list.items[0].done, false);
  assert.strictEqual(list.items[0].doneAt, undefined);
});

test('a task moves to a new place among the others', () => {
  const list = K.tasks.create();
  const [a, , c] = ['A', 'B', 'C'].map(text => K.tasks.add(list, text, 0));
  K.tasks.move(list, c.id, 0);
  assert.deepStrictEqual(list.items.map(t => t.text), ['C', 'A', 'B']);
  K.tasks.move(list, a.id, 99);
  assert.deepStrictEqual(list.items.map(t => t.text), ['C', 'B', 'A']);
});

test('clearing done tasks keeps the open ones', () => {
  const list = K.tasks.create();
  const a = K.tasks.add(list, 'A', 0);
  K.tasks.add(list, 'B', 0);
  K.tasks.toggle(list, a.id, 5);
  assert.strictEqual(K.tasks.clearDone(list), 1);
  assert.deepStrictEqual(list.items.map(t => t.text), ['B']);
});

test('removing and editing a task', () => {
  const list = K.tasks.create();
  const a = K.tasks.add(list, 'A', 0);
  K.tasks.edit(list, a.id, '  Changed ');
  assert.strictEqual(list.items[0].text, 'Changed');
  K.tasks.edit(list, a.id, '   ');
  assert.strictEqual(list.items.length, 0, 'emptied text removes the task');
});

// ── Focus of the day ─────────────────────────────────────────────
test('the focus of the day belongs to the day it was set', () => {
  const focus = K.focus.create();
  K.focus.set(focus, ' Ship 2.6 ', at('2026-09-26T08:00'));
  assert.strictEqual(K.focus.today(focus, at('2026-09-26T23:00')).text, 'Ship 2.6');
  assert.strictEqual(K.focus.today(focus, at('2026-09-27T07:00')), null);
});

test('a focus can be marked done and kept in a short history', () => {
  const focus = K.focus.create();
  for (let day = 1; day <= 40; day++) {
    K.focus.set(focus, `Day ${day}`, at('2026-08-01T08:00') + day * DAY);
    K.focus.finish(focus, true, at('2026-08-01T20:00') + day * DAY);
  }
  assert.strictEqual(K.focus.today(focus, at('2026-08-01T21:00') + 40 * DAY).done, true);
  assert.ok(focus.history.length <= K.focus.HISTORY);
  assert.strictEqual(focus.history[focus.history.length - 1].text, 'Day 39');
});

// ── Focus timer ──────────────────────────────────────────────────
test('the timer counts down while it runs and holds while paused', () => {
  const t = K.timer.create({ focus: 25, rest: 5 });
  K.timer.start(t, 0);
  assert.strictEqual(K.timer.remaining(t, 60_000), 24 * 60_000);
  K.timer.pause(t, 60_000);
  assert.strictEqual(K.timer.remaining(t, 10 * 60_000), 24 * 60_000);
  K.timer.start(t, 10 * 60_000);
  assert.strictEqual(K.timer.remaining(t, 11 * 60_000), 23 * 60_000);
});

test('a finished focus counts a session and turns into a break', () => {
  const t = K.timer.create({ focus: 25, rest: 5 });
  K.timer.start(t, at('2026-09-26T09:00'));
  const change = K.timer.tick(t, at('2026-09-26T09:25:01'));
  assert.strictEqual(change, 'rest');
  assert.strictEqual(t.phase, 'rest');
  assert.strictEqual(K.timer.sessions(t, at('2026-09-26T12:00')), 1);
  assert.strictEqual(K.timer.sessions(t, at('2026-09-27T12:00')), 0);
  assert.strictEqual(K.timer.tick(t, at('2026-09-26T09:26')), null);
});

test('after the break the timer waits for the next focus instead of running on', () => {
  const t = K.timer.create({ focus: 1, rest: 1 });
  K.timer.start(t, 0);
  K.timer.tick(t, 60_001);
  assert.strictEqual(K.timer.tick(t, 120_002), 'focus');
  assert.strictEqual(t.running, false);
  assert.strictEqual(K.timer.remaining(t, 999_999), 60_000);
});

test('reset brings the timer back to a full focus', () => {
  const t = K.timer.create({ focus: 25, rest: 5 });
  K.timer.start(t, 0);
  K.timer.reset(t);
  assert.strictEqual(t.running, false);
  assert.strictEqual(t.phase, 'focus');
  assert.strictEqual(K.timer.remaining(t, 5_000_000), 25 * 60_000);
});

test('minutes are clamped to something a person could mean', () => {
  const t = K.timer.create({ focus: 0, rest: 999 });
  assert.strictEqual(t.focus, 1);
  assert.strictEqual(t.rest, 60);
});

test('the clock face reads minutes and seconds', () => {
  assert.strictEqual(K.timer.face(25 * 60_000), '25:00');
  assert.strictEqual(K.timer.face(61_500), '1:02');
  assert.strictEqual(K.timer.face(-5), '0:00');
});

// ── Countdown ────────────────────────────────────────────────────
test('a countdown counts whole days to the date', () => {
  assert.deepStrictEqual(K.countdown('2026-10-01', at('2026-09-26T23:30')), { days: 5, state: 'ahead' });
  assert.deepStrictEqual(K.countdown('2026-09-26', at('2026-09-26T08:00')), { days: 0, state: 'today' });
  assert.deepStrictEqual(K.countdown('2026-09-20', at('2026-09-26T08:00')), { days: 6, state: 'past' });
  assert.strictEqual(K.countdown('not a date', 0), null);
});

// ── World clock ──────────────────────────────────────────────────
test('a world clock tells the time there and whether it is another day', () => {
  const now = at('2026-09-26T23:30:00Z');
  const tokyo = K.clock('Asia/Tokyo', now, { hour12: false, home: 'Europe/Berlin' });
  assert.strictEqual(tokyo.time, '08:30');
  assert.strictEqual(tokyo.dayShift, 0, "both already on the 27th");
  const auckland = K.clock("Pacific/Auckland", at("2026-09-26T12:00:00Z"), { hour12: false, home: "Europe/Berlin" });
  assert.strictEqual(auckland.dayShift, 1);
  const ny = K.clock('America/New_York', now, { hour12: false, home: 'Europe/Berlin' });
  assert.strictEqual(ny.time, '19:30');
  assert.strictEqual(ny.dayShift, -1, 'Berlin is already on the 27th, New York still on the 26th');
});

test('an unknown time zone is refused rather than guessed', () => {
  assert.strictEqual(K.clock('Mars/Olympus', 0), null);
});

// ── Weather ──────────────────────────────────────────────────────
test('the forecast address asks Open-Meteo for just what is shown', () => {
  const url = new URL(K.weather.url({ lat: 51.51, lon: 7.47, units: 'metric' }));
  assert.strictEqual(url.host, 'api.open-meteo.com');
  assert.strictEqual(url.searchParams.get('latitude'), '51.51');
  assert.strictEqual(url.searchParams.get('temperature_unit'), null);
  const us = new URL(K.weather.url({ lat: 40.7, lon: -74, units: 'imperial' }));
  assert.strictEqual(us.searchParams.get('temperature_unit'), 'fahrenheit');
});

test('weather codes fold into a few kinds of sky', () => {
  assert.strictEqual(K.weather.kind(0), 'clear');
  assert.strictEqual(K.weather.kind(2), 'partly');
  assert.strictEqual(K.weather.kind(3), 'cloudy');
  assert.strictEqual(K.weather.kind(45), 'fog');
  assert.strictEqual(K.weather.kind(53), 'drizzle');
  assert.strictEqual(K.weather.kind(63), 'rain');
  assert.strictEqual(K.weather.kind(81), 'rain');
  assert.strictEqual(K.weather.kind(73), 'snow');
  assert.strictEqual(K.weather.kind(95), 'storm');
  assert.strictEqual(K.weather.kind(1234), 'cloudy');
});

test('a forecast answer becomes today and the days ahead', () => {
  const answer = {
    current: { temperature_2m: 14.6, weather_code: 61, is_day: 1 },
    daily: { time: ['2026-09-26', '2026-09-27', '2026-09-28'], temperature_2m_max: [16.2, 18.9, 12], temperature_2m_min: [9.1, 10, 7.5], weather_code: [61, 1, 71], precipitation_probability_max: [80, 10, 55] }
  };
  const w = K.weather.parse(answer);
  assert.deepStrictEqual(w.now, { temp: 15, kind: 'rain', day: true });
  assert.strictEqual(w.days.length, 3);
  assert.deepStrictEqual(w.days[1], { date: '2026-09-27', hi: 19, lo: 10, kind: 'clear', rain: 10 });
  assert.strictEqual(K.weather.parse({}), null);
});

// ── Focus mode: minutes, streaks, count-up ──────────────────────
test('minutes focused today add up the sessions, whatever length each was', () => {
  const t = K.timer.create({ focus: 25, rest: 5 });
  K.timer.start(t, at('2026-09-26T09:00'));
  K.timer.tick(t, at('2026-09-26T09:25:01'));
  t.focus = 50; K.timer.reset(t);
  K.timer.start(t, at('2026-09-26T11:00'));
  K.timer.tick(t, at('2026-09-26T11:50:01'));
  assert.strictEqual(K.timer.minutes(t, at('2026-09-26T20:00')), 75);
  assert.strictEqual(K.timer.sessions(t, at('2026-09-26T20:00')), 2);
});

test('a log from an older build still counts', () => {
  const t = K.timer.create({ focus: 25 });
  t.log = ['2026-09-26', '2026-09-26'];
  assert.strictEqual(K.timer.sessions(t, at('2026-09-26T20:00')), 2);
  assert.strictEqual(K.timer.minutes(t, at('2026-09-26T20:00')), 50);
});

test('a streak counts the days in a row with a finished focus, today or up to yesterday', () => {
  const t = K.timer.create({ focus: 25 });
  t.log = [{ day: '2026-09-23', min: 25 }, { day: '2026-09-24', min: 25 }, { day: '2026-09-25', min: 25 }];
  assert.strictEqual(K.timer.streak(t, at('2026-09-26T08:00')), 3, 'today not yet, the streak still stands');
  t.log.push({ day: '2026-09-26', min: 25 });
  assert.strictEqual(K.timer.streak(t, at('2026-09-26T20:00')), 4);
  assert.strictEqual(K.timer.streak(t, at('2026-09-28T08:00')), 0, 'a missed day ends it');
});

test('five more minutes stretch the phase that is on, running or not', () => {
  const t = K.timer.create({ focus: 25 });
  K.timer.more(t, 5, 0);
  assert.strictEqual(K.timer.remaining(t, 0), 30 * 60_000);
  K.timer.start(t, 0);
  K.timer.more(t, 5, 60_000);
  assert.strictEqual(K.timer.remaining(t, 60_000), 34 * 60_000);
});

test('skipping a focus goes to the break without counting it', () => {
  const t = K.timer.create({ focus: 25, rest: 5 });
  K.timer.start(t, 0);
  K.timer.skip(t, 60_000);
  assert.strictEqual(t.phase, 'rest');
  assert.strictEqual(t.running, true);
  assert.strictEqual(K.timer.sessions(t, 60_000), 0);
  K.timer.skip(t, 120_000);
  assert.strictEqual(t.phase, 'focus');
  assert.strictEqual(t.running, false);
});

test('count-up measures how long, and a stop of a minute or more is logged', () => {
  const t = K.timer.create({ focus: 25 });
  K.timer.setMode(t, 'countup');
  K.timer.start(t, at('2026-09-26T09:00'));
  assert.strictEqual(K.timer.elapsed(t, at('2026-09-26T09:10')), 10 * 60_000);
  K.timer.pause(t, at('2026-09-26T09:10'));
  K.timer.start(t, at('2026-09-26T10:00'));
  K.timer.stop(t, at('2026-09-26T10:05:30'));
  assert.strictEqual(K.timer.minutes(t, at('2026-09-26T12:00')), 15);
  assert.strictEqual(K.timer.elapsed(t, at('2026-09-26T12:00')), 0);
  K.timer.start(t, at('2026-09-26T13:00'));
  K.timer.stop(t, at('2026-09-26T13:00:40'));
  assert.strictEqual(K.timer.sessions(t, at('2026-09-26T13:01')), 1, 'forty seconds is not a session');
});

// ── Tasks v2: when, how important, and the smaller steps ─────────
const SAT = at('2026-09-26T10:00'); // a Saturday
test('quick add reads when a task is due and whether it matters most', () => {
  const p = (text, lang) => K.tasks.parse(text, SAT, lang);
  assert.deepStrictEqual(p('Call the dentist tomorrow'), { text: 'Call the dentist', due: '2026-09-27', priority: false });
  assert.deepStrictEqual(p('Pay rent today !'), { text: 'Pay rent', due: '2026-09-26', priority: true });
  assert.deepStrictEqual(p('Report on monday'), { text: 'Report', due: '2026-09-28', priority: false });
  assert.deepStrictEqual(p('Gym in 3 days'), { text: 'Gym', due: '2026-09-29', priority: false });
  assert.deepStrictEqual(p('Позвонить маме завтра', 'ru'), { text: 'Позвонить маме', due: '2026-09-27', priority: false });
  assert.deepStrictEqual(p('Отчёт в понедельник !', 'ru'), { text: 'Отчёт', due: '2026-09-28', priority: true });
  assert.deepStrictEqual(p('Tomorrowland tickets'), { text: 'Tomorrowland tickets', due: null, priority: false }, 'a word inside a word is not a date');
  assert.deepStrictEqual(p('Saturday market', 'en'), { text: 'Saturday market', due: null, priority: false }, 'a weekday at the start is a name, not a date');
});

test('views: all, today (and overdue), later, and done', () => {
  const list = K.tasks.create();
  const a = K.tasks.add(list, 'No date', SAT);
  const b = K.tasks.add(list, 'Overdue', SAT, { due: '2026-09-20' });
  const c = K.tasks.add(list, 'Today', SAT, { due: '2026-09-26' });
  const d = K.tasks.add(list, 'Next week', SAT, { due: '2026-10-02' });
  const e = K.tasks.add(list, 'Finished', SAT);
  K.tasks.toggle(list, e.id, SAT);
  const names = view => K.tasks.filter(list, view, SAT).map(t => t.text);
  assert.deepStrictEqual(names('all'), ['No date', 'Overdue', 'Today', 'Next week', 'Finished']);
  assert.deepStrictEqual(names('today'), ['Overdue', 'Today']);
  assert.deepStrictEqual(names('upcoming'), ['Next week']);
  assert.deepStrictEqual(names('done'), ['Finished']);
  assert.strictEqual(K.tasks.state(b, SAT), 'overdue');
  assert.strictEqual(K.tasks.state(c, SAT), 'today');
  assert.strictEqual(K.tasks.state(d, SAT), 'later');
  assert.strictEqual(K.tasks.state(a, SAT), 'none');
});

test('a task that matters most comes first among the open ones', () => {
  const list = K.tasks.create();
  K.tasks.add(list, 'A', SAT);
  const b = K.tasks.add(list, 'B', SAT);
  K.tasks.setPriority(list, b.id, true);
  assert.deepStrictEqual(K.tasks.filter(list, 'all', SAT).map(t => t.text), ['B', 'A']);
});

test('subtasks: added, ticked, counted, and the task is not done until it is ticked itself', () => {
  const list = K.tasks.create();
  const t = K.tasks.add(list, 'Move house', SAT);
  const s1 = K.tasks.addSub(list, t.id, 'Boxes', SAT);
  K.tasks.addSub(list, t.id, '  ', SAT);
  const s2 = K.tasks.addSub(list, t.id, 'Van', SAT);
  assert.strictEqual(list.items[0].subs.length, 2);
  K.tasks.toggleSub(list, t.id, s1.id);
  assert.deepStrictEqual(K.tasks.progress(list.items[0]), { done: 1, total: 2 });
  K.tasks.removeSub(list, t.id, s2.id);
  assert.deepStrictEqual(K.tasks.progress(list.items[0]), { done: 1, total: 1 });
  assert.strictEqual(list.items[0].done, false);
});

test('a due date can be set, moved to tomorrow, and cleared', () => {
  const list = K.tasks.create();
  const t = K.tasks.add(list, 'Thing', SAT, { due: '2026-09-20' });
  K.tasks.setDue(list, t.id, K.tasks.shift(SAT, 1));
  assert.strictEqual(list.items[0].due, '2026-09-27');
  K.tasks.setDue(list, t.id, null);
  assert.strictEqual(list.items[0].due, undefined);
  K.tasks.setDue(list, t.id, 'garbage');
  assert.strictEqual(list.items[0].due, undefined);
});

// ── Habits ───────────────────────────────────────────────────────
test('a habit is ticked for a day, and a tick can be taken back', () => {
  const h = K.habits.create();
  const read = K.habits.add(h, '  Read 20 pages ');
  assert.strictEqual(read.name, 'Read 20 pages');
  assert.strictEqual(K.habits.add(h, '   '), null);
  K.habits.toggle(h, read.id, '2026-09-26');
  assert.strictEqual(K.habits.done(read, '2026-09-26'), true);
  K.habits.toggle(h, read.id, '2026-09-26');
  assert.strictEqual(K.habits.done(read, '2026-09-26'), false);
});

test('the week shows the last seven days ending today', () => {
  const h = K.habits.create();
  const walk = K.habits.add(h, 'Walk');
  for (const day of ['2026-09-20', '2026-09-24', '2026-09-26']) K.habits.toggle(h, walk.id, day);
  const week = K.habits.week(walk, SAT);
  assert.deepStrictEqual(week.map(d => d.day), ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']);
  assert.deepStrictEqual(week.map(d => d.done), [true, false, false, false, true, false, true]);
});

test('a streak runs back from today, or from yesterday while today is still open', () => {
  const h = K.habits.create();
  const run = K.habits.add(h, 'Run');
  for (const day of ['2026-09-23', '2026-09-24', '2026-09-25']) K.habits.toggle(h, run.id, day);
  assert.strictEqual(K.habits.streak(run, SAT), 3);
  K.habits.toggle(h, run.id, '2026-09-26');
  assert.strictEqual(K.habits.streak(run, SAT), 4);
  assert.strictEqual(K.habits.streak(run, at('2026-09-28T10:00')), 0);
});

test('old ticks are let go after a year, so the list never grows without end', () => {
  const h = K.habits.create();
  const x = K.habits.add(h, 'X');
  x.days = Array.from({ length: 500 }, (v, i) => K.tasks.shift(SAT, -i)).reverse();
  K.habits.toggle(h, x.id, K.tasks.shift(SAT, 1));
  assert.ok(x.days.length <= 400);
});

// ── Tab stash ────────────────────────────────────────────────────
const TABS = [
  { id: 1, url: 'chrome-extension://abc/newtab.html', title: 'New Tab' },
  { id: 2, url: 'https://github.com/sa1ntsinner/nordlys-tab', title: 'Nordlys', favIconUrl: 'https://github.com/favicon.ico' },
  { id: 3, url: 'https://news.ycombinator.com/', title: 'Hacker News', pinned: true },
  { id: 4, url: 'chrome://settings/', title: 'Settings' },
  { id: 5, url: 'https://en.wikipedia.org/wiki/Aurora', title: 'Aurora - Wikipedia' },
  { id: 6, url: 'javascript:alert(1)', title: 'x' }
];
test('stashing keeps the web pages of the window, and leaves this page, pinned tabs and browser pages', () => {
  const kept = K.stash.pick(TABS, 'chrome-extension://abc/');
  assert.deepStrictEqual(kept.map(t => t.id), [2, 5]);
});

test('a stash is a group with its time, newest first, and a tab taken out of it is gone from it', () => {
  const s = K.stash.create();
  const g1 = K.stash.add(s, K.stash.pick(TABS, 'chrome-extension://abc/'), 1000);
  const g2 = K.stash.add(s, [{ url: 'https://example.com/', title: 'Example' }], 2000);
  assert.deepStrictEqual(s.groups.map(g => g.id), [g2.id, g1.id]);
  assert.deepStrictEqual(g1.tabs.map(t => t.title), ['Nordlys', 'Aurora - Wikipedia']);
  assert.strictEqual(K.stash.add(s, [], 3000), null, 'nothing to stash, no empty group');
  K.stash.take(s, g1.id, 'https://github.com/sa1ntsinner/nordlys-tab');
  assert.deepStrictEqual(s.groups.find(g => g.id === g1.id).tabs.map(t => t.title), ['Aurora - Wikipedia']);
  K.stash.take(s, g1.id, 'https://en.wikipedia.org/wiki/Aurora');
  assert.strictEqual(s.groups.some(g => g.id === g1.id), false, 'an emptied group goes');
});

test('a stash never grows past what storage should hold', () => {
  const s = K.stash.create();
  for (let i = 0; i < 70; i++) K.stash.add(s, Array.from({ length: 150 }, (v, j) => ({ url: `https://e.com/${i}/${j}`, title: 't' })), i);
  assert.ok(s.groups.length <= K.stash.MAX_GROUPS);
  assert.ok(s.groups.every(g => g.tabs.length <= K.stash.MAX_TABS));
});
