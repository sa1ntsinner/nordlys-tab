const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, score } = require('../../src/js/commands.js');

const WORLD = {
  themes: [{ key: 'nord-frost', name: 'Nord Frost' }, { key: 'nordic-snow', name: 'Nordic Snow' }, { key: 'aurora-void', name: 'Aurora Void' }],
  scenes: [{ key: 'polaris', name: 'Polaris' }, { key: 'halo', name: 'Halo' }, { key: 'aurora', name: 'Nordlys' }],
  moods: [{ key: 'ember', name: 'Ember' }, { key: 'mood_1', name: 'Midwinter' }],
  folders: [{ key: 0, name: 'Daily' }, { key: 1, name: 'Dev & tech' }, { key: 2, name: 'Shopping', hidden: true }],
  bookmarks: [{ key: '0:0', name: 'YouTube', folder: 0 }, { key: '1:0', name: 'GitHub', folder: 1 }],
  tabs: [{ key: 'background', name: 'Background' }, { key: 'backup', name: 'Backup' }]
};
const kinds = result => result.candidates.map(c => `${c.kind}:${c.target?.key ?? c.name ?? c.verb ?? ''}`);

test('a bare > asks for the list of what can be done', () => {
  assert.equal(parse('', WORLD).help, true);
});

test('each verb finds what it names, best match first', () => {
  assert.deepEqual(kinds(parse('theme nord', WORLD)), ['theme:nord-frost', 'theme:nordic-snow']);
  assert.deepEqual(kinds(parse('sky po', WORLD)), ['sky:polaris']);
  assert.deepEqual(kinds(parse('mood mid', WORLD)), ['mood:mood_1']);
  assert.deepEqual(kinds(parse('hide daily', WORLD)), ['hide:0']);
  assert.deepEqual(kinds(parse('show shop', WORLD)), ['show:2']);
  assert.deepEqual(kinds(parse('hide shop', WORLD)), [], 'a hidden folder cannot be hidden again');
  assert.deepEqual(kinds(parse('shuffle', WORLD)), ['shuffle:']);
  assert.deepEqual(kinds(parse('settings back', WORLD)), ['settings:background', 'settings:backup']);
});

test('two-part commands split at their joiner, whichever language', () => {
  const rename = parse('rename Daily to Morning coffee', WORLD).candidates[0];
  assert.equal(rename.target.name, 'Daily');
  assert.equal(rename.name, 'Morning coffee');
  const move = parse('move youtube to dev', WORLD).candidates[0];
  assert.deepEqual([move.target.key, move.folder.key], ['0:0', 1]);
  assert.deepEqual(kinds(parse('move youtube to daily', WORLD)), [], 'nothing moves to where it already is');
  const russian = { verbs: { move: ['переместить'], rename: ['переименовать'] }, joiners: ['в', 'на'] };
  const moved = parse('переместить youtube в dev', WORLD, russian).candidates[0];
  assert.deepEqual([moved.target.key, moved.folder.key], ['0:0', 1]);
  const renamed = parse('переименовать Daily в Утро', WORLD, russian).candidates[0];
  assert.equal(renamed.name, 'Утро');
});

test('the longest verb wins, and a verb being typed offers what it could become', () => {
  assert.deepEqual(kinds(parse('new folder Reading', WORLD)), ['newFolder:Reading']);
  assert.deepEqual(kinds(parse('folder Reading', WORLD)), ['newFolder:Reading']);
  assert.ok(kinds(parse('sh', WORLD)).includes('verb:shuffle') && kinds(parse('sh', WORLD)).includes('verb:show'));
});

test('matching forgives case, accents and the shape of a name', () => {
  assert.ok(score('nordl', 'Nordlys') > score('ordl', 'Nordlys'));
  assert.ok(score('devtech', 'Dev & tech') > 0);
  assert.ok(score('etoile', 'Étoile') > 0);
  assert.equal(score('zz', 'Daily'), 0);
});

test('size and spacing have a verb of their own', () => {
  assert.deepEqual(kinds(parse('size', WORLD)), ['size:']);
  assert.deepEqual(kinds(parse('spacing', WORLD)), ['size:']);
  assert.deepEqual(kinds(parse('размер', WORLD, { verbs: { size: ['размер', 'отступы'] } })), ['size:']);
});
