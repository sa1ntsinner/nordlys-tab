const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../../src/js/config-schema.js');

/* A backup file has to answer to two readers at once: this build, and whichever
   build the person is actually running when they open it again. Every release
   since 2.0 wrote the config object at the top level, so that is where it stays.
   Everything the config never held — the themes someone authored, the width they
   dragged the drawer to — travels in one namespaced envelope beside it, which an
   older build ignores and this one lifts out before the config is validated.

   tests/fixtures/legacy-2.0-backup.json is the shape of a real 2.0.0 export,
   contributed by a user, rebuilt field for field with invented names, example
   URLs and placeholder images. Nothing of theirs is in this repository. */

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'legacy-2.0-backup.json');
const legacy = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

test('a backup written today reads back as the same config and the same extras', () => {
  const config = { theme: 'aurora-void', tileSize: 78, groups: [{ label: 'A', cols: 2, hidden: false, links: [] }] };
  const extras = { customThemes: [{ name: 'Mine', bg: '#101317' }], drawerWidth: '720px' };
  const file = schema.buildBackupFile(config, extras);

  // The config is still the top level, field for field.
  assert.equal(file.theme, 'aurora-void');
  assert.deepEqual(file.groups, config.groups);

  const read = schema.readBackupFile(JSON.parse(JSON.stringify(file)));
  assert.deepEqual(read.config.groups, config.groups);
  assert.deepEqual(read.extras.customThemes, extras.customThemes);
  assert.equal(read.extras.drawerWidth, '720px');
  assert.equal(schema.validateConfig(read.config).ok, true);
});

test('the envelope never reaches the live config', () => {
  const file = schema.buildBackupFile({ theme: 'nordic-snow', groups: [] }, { customThemes: [], drawerWidth: '600px' });
  const read = schema.readBackupFile(file);
  assert.equal(schema.BACKUP_EXTRAS_KEY in read.config, false, 'the envelope is lifted out, not merged');
});

test('a file with no envelope — every backup written before this build — reads as itself', () => {
  const read = schema.readBackupFile(legacy());
  assert.deepEqual(read.extras, {}, 'nothing is invented for a file that carries nothing');
  assert.equal(read.config.groups.length, 9);
  assert.equal(read.config.version, '2.0.0');
});

test('a damaged envelope is ignored rather than failing the whole import', () => {
  for (const damaged of [5, 'nope', null, [], { customThemes: 'not a list', drawerWidth: 42 }]) {
    const file = { theme: 'aurora-void', groups: [], [schema.BACKUP_EXTRAS_KEY]: damaged };
    const read = schema.readBackupFile(file);
    assert.equal(schema.validateConfig(read.config).ok, true, `envelope ${JSON.stringify(damaged)} must not sink the config`);
    assert.deepEqual(read.extras.customThemes, undefined);
    assert.deepEqual(read.extras.drawerWidth, undefined);
  }
});

/* The two lines that used to refuse this exact file. 2.0 wrote every range
   control exactly as the DOM handed it over — as text — so a real backup came
   back as "cardRadius should be a number". Canonicalising first is what accepts
   it; the type check itself is untouched, and still refuses "22px". */
test('the 2.0 fixture is refused raw and accepted once its numbers are canonicalised', () => {
  assert.deepEqual(schema.validateConfig(legacy()).errors, [
    'cardRadius should be a number, not string',
    'tileSize should be a number, not string'
  ]);
  assert.equal(schema.validateConfig(schema.normalizeImportConfig(legacy())).ok, true);
  assert.equal(schema.validateConfig(schema.normalizeImportConfig({ cardRadius: '22px', groups: [] })).ok, false);
});

test('the 2.0 fixture carries the icon encodings the real file carried', () => {
  const images = legacy().groups.flatMap(group => group.links).map(link => link.customImg).filter(Boolean);
  for (const prefix of ['data:image/png;base64,', 'data:image/x-icon;base64,', 'data:image/jpeg;base64,', 'data:image/svg+xml,']) {
    assert.ok(images.some(image => image.startsWith(prefix)), `no ${prefix} icon in the fixture`);
  }
  // An embedded image is not a URL that can run code, and must never be read as one.
  assert.equal(schema.validateConfig(schema.normalizeImportConfig(legacy())).ok, true);
});

/* The fixture is derived from someone's real board. It carries the schema and
   none of the content: every host is an example domain, every image a 1x1
   placeholder, and no address, search or account of theirs is anywhere in it. */
test('the fixture holds nothing from the file it was derived from', () => {
  const raw = fs.readFileSync(FIXTURE, 'utf8');
  const hosts = legacy().groups.flatMap(group => group.links).map(link => new URL(link.url).hostname);
  for (const host of hosts) {
    assert.ok(host.endsWith('.example'), `${host} is not a reserved example host`);
  }
  for (const pattern of ['tu-dortmund', 'wallet', 'bitcoin', 'mail.', '@', 'token', 'search?q=']) {
    assert.ok(!raw.toLowerCase().includes(pattern), `fixture leaks "${pattern}"`);
  }
});
