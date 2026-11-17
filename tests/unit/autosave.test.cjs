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

test('spaces that are no use are not carried: one alone, none in use, another without its board', () => {
  const carried = (spaces) => schema.readBackupFile(schema.buildBackupFile({ groups: [] }, { spaces })).extras.spaces;
  assert.strictEqual(carried({ active: 'a', list: [{ id: 'a', name: 'Home' }] }), undefined);
  assert.strictEqual(carried({ active: 'x', list: [{ id: 'a', config: {} }, { id: 'b', config: {} }] }), undefined);
  assert.strictEqual(carried({ active: 'a', list: [{ id: 'a' }, { id: 'b' }] }), undefined);
  assert.strictEqual(carried({ active: 'a', list: [{ id: 'a' }, { id: '../b', config: {} }, { id: 'c', config: {} }] }).list.length, 2);
});
