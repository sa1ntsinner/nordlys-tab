const test = require('node:test');
const assert = require('node:assert');
const autosave = require('../../src/js/autosave.js');

const DAY = 86400000;
const now = new Date(2026, 10, 16, 12, 0, 0).getTime();

test('the newest ten are kept whatever their age', () => {
  const ids = Array.from({ length: 14 }, (_, i) => now - i * 60000);
  const keep = autosave.kept(ids, now);
  for (const id of ids.slice(0, 10)) assert.ok(keep.has(id));
});

test('older than the newest ten, one copy a day stays: the last of that day', () => {
  const today = Array.from({ length: 12 }, (_, i) => now - i * 60000);
  const yesterday = [now - DAY, now - DAY - 3600000, now - DAY - 7200000];
  const keep = autosave.kept([...today, ...yesterday], now);
  assert.ok(keep.has(yesterday[0]));
  assert.ok(!keep.has(yesterday[1]));
  assert.ok(!keep.has(yesterday[2]));
  // The eleventh and twelfth of today are neither among the newest ten nor the day's last.
  assert.ok(!keep.has(today[10]));
  assert.ok(!keep.has(today[11]));
});

test('a copy older than thirty days goes, unless it is among the newest ten', () => {
  const recent = Array.from({ length: 10 }, (_, i) => now - i * DAY);
  const old = now - 45 * DAY;
  assert.ok(!autosave.kept([...recent, old], now).has(old));
  assert.ok(autosave.kept([now, old], now).has(old));
});

test('two files alike but for the moment they were written are one setup', () => {
  const a = { groups: [{ links: [{ url: 'https://a.example' }] }], nordlysBackup: { formatVersion: 1, savedAt: '2026-11-16T10:00:00.000Z' } };
  const b = JSON.parse(JSON.stringify(a));
  b.nordlysBackup.savedAt = '2026-11-16T11:00:00.000Z';
  assert.strictEqual(autosave.mark(a), autosave.mark(b));
  b.groups[0].links.push({ url: 'https://b.example' });
  assert.notStrictEqual(autosave.mark(a), autosave.mark(b));
  assert.strictEqual(a.nordlysBackup.savedAt, '2026-11-16T10:00:00.000Z');
});

test('a copy says how many bookmarks, folders and spaces it holds', () => {
  assert.deepStrictEqual(autosave.count({ groups: [{ links: [1, 2] }, { links: [3] }, {}] }), { folders: 3, links: 3, spaces: 1 });
  assert.deepStrictEqual(autosave.count(null), { folders: 0, links: 0, spaces: 1 });
  assert.strictEqual(autosave.count({ groups: [], nordlysBackup: { spaces: { active: 'a', list: [{ id: 'a' }, { id: 'b', config: {} }] } } }).spaces, 2);
});

test('copies with a cause are counted apart: the newest three of each stay, whatever their age', () => {
  const changes = Array.from({ length: 40 }, (_, i) => now - i * 60000);
  const updates = [now - 400 * DAY, now - 300 * DAY, now - 200 * DAY, now - 100 * DAY];
  const reset = [now - 90 * DAY];
  const keep = autosave.kept([...changes, ...updates, ...reset], now, { update: updates, reset });
  assert.ok(keep.has(updates[1]) && keep.has(updates[2]) && keep.has(updates[3]));
  assert.ok(!keep.has(updates[0]));
  assert.ok(keep.has(reset[0]));
  // The changes are thinned as before, and none of them is pushed out by a copy with a cause.
  for (const id of changes.slice(0, 10)) assert.ok(keep.has(id));
  assert.ok(!keep.has(changes[20]));
});

const schema = require('../../src/js/config-schema.js');

test('a backup file carries the other spaces, and a file without them reads as before', () => {
  const spaces = { active: 'a', list: [{ id: 'a', name: 'Home', color: 'teal' }, { id: 'b', name: 'Work', color: 'amber', config: { groups: [{ label: 'W', links: [] }] } }] };
  const file = schema.buildBackupFile({ groups: [] }, { spaces });
  const read = schema.readBackupFile(JSON.parse(JSON.stringify(file)));
  assert.deepStrictEqual(read.extras.spaces, spaces);
  assert.strictEqual(read.config.nordlysBackup, undefined);
  assert.strictEqual(schema.readBackupFile(schema.buildBackupFile({ groups: [] })).extras.spaces, undefined);
});

test('one space is carried by name; spaces that are no use are not: none in use, another without its board', () => {
  const carried = (spaces) => schema.readBackupFile(schema.buildBackupFile({ groups: [] }, { spaces })).extras.spaces;
  assert.deepStrictEqual(carried({ active: 'a', list: [{ id: 'a', name: 'Home' }] }), { active: 'a', list: [{ id: 'a', name: 'Home', color: '' }] });
  assert.strictEqual(carried({ active: 'x', list: [{ id: 'a', config: {} }, { id: 'b', config: {} }] }), undefined);
  assert.deepStrictEqual(carried({ active: 'a', list: [{ id: 'a' }, { id: 'b' }] }).list.map(space => space.id), ['a']);
  assert.strictEqual(carried({ active: 'a', list: [{ id: 'a' }, { id: '../b', config: {} }, { id: 'c', config: {} }] }).list.length, 2);
});

test('the copies are held to the room there is: the oldest made as the setup changed go first', () => {
  const lines = [
    { id: 1, size: 40 }, { id: 2, size: 40 }, { id: 3, size: 40 }, { id: 4, size: 40 }, { id: 5, size: 40 },
    { id: 6, size: 40, cause: 'update' }
  ];
  const stay = new Set(lines.map(line => line.id));
  assert.deepStrictEqual([...autosave.roomFor(lines, stay, 1000)].sort(), [1, 2, 3, 4, 5, 6], 'with room for all, all stay');
  // 240 held, room for 170: the two oldest changes go, and that is enough.
  assert.deepStrictEqual([...autosave.roomFor(lines, stay, 170)].sort(), [3, 4, 5, 6]);
  // However little room: the newest three changes and the newest copy of each cause stay.
  assert.deepStrictEqual([...autosave.roomFor(lines, stay, 1)].sort(), [3, 4, 5, 6]);
  // Copies with a cause give way too, oldest first, once the plain ones are down to three.
  const caused = [...lines, { id: 7, size: 40, cause: 'update' }, { id: 8, size: 40, cause: 'reset' }];
  assert.deepStrictEqual([...autosave.roomFor(caused, new Set(caused.map(line => line.id)), 200)].sort(), [3, 4, 5, 7, 8]);
  // A copy the rules already let go is not brought back.
  assert.ok(!autosave.roomFor(lines, new Set([4, 5, 6]), 1000).has(1));
});

test('the mark of a setup in a few characters: the same for the same setup, another for another', () => {
  const a = autosave.mark({ groups: [{ links: [{ url: 'https://a.example' }] }] });
  const b = autosave.mark({ groups: [{ links: [{ url: 'https://b.example' }] }] });
  assert.strictEqual(autosave.sum(a), autosave.sum(a));
  assert.notStrictEqual(autosave.sum(a), autosave.sum(b));
  assert.ok(autosave.sum(a).length < 40);
});

test('what a card fetched, and the running timer, are not a change of the setup', () => {
  const file = (cards) => ({ groups: [], nordlysBackup: { dashboardData: cards } });
  const base = autosave.mark(file({ n1: { text: 'mine' }, w1: { at: 1, value: 3 }, 'focus-timer': { running: false } }));
  assert.strictEqual(autosave.mark(file({ n1: { text: 'mine' }, w1: { at: 2, value: 9 }, 'focus-timer': { running: true } })), base);
  assert.notStrictEqual(autosave.mark(file({ n1: { text: 'changed' }, w1: { at: 1, value: 3 } })), base);
  assert.ok(autosave.fetched('w1', { at: 5 }) && autosave.fetched('focus-timer', {}) && !autosave.fetched('n1', { text: '' }));
});
