const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

/* Two files carry the version and only one of them is what Chrome installs.
   When they disagree the About panel confidently reports a build that is not
   running, which is the kind of thing that wastes an afternoon of a bug report. */
test('the manifest and the running config report the same version', () => {
  const manifest = JSON.parse(read('manifest.json')).version;
  const app = read('src/js/app.js').match(/version:\s*"([^"]+)"/)?.[1];
  assert.strictEqual(app, manifest, 'src/js/app.js and manifest.json disagree');
});

test('the version is a plain three-part number Chrome will accept', () => {
  const manifest = JSON.parse(read('manifest.json')).version;
  assert.match(manifest, /^\d+\.\d+\.\d+$/, `not a store-acceptable version: ${manifest}`);
  // Every part must be an integer 0-65535 with no leading zeros, or upload fails.
  for (const part of manifest.split('.')) {
    assert.ok(Number(part) <= 65535, `${part} is out of range`);
    assert.ok(!/^0\d/.test(part), `${part} has a leading zero`);
  }
});

/* The release docs tell the user which file to upload. A stale filename there
   means shipping the previous build without noticing. */
test('the release instructions name the current archive', () => {
  const version = JSON.parse(read('manifest.json')).version;
  for (const doc of ['RELEASE_GUIDE.md', 'docs/CHROME_STORE_GUIDE.md']) {
    const stale = [...read(doc).matchAll(/nordlys-v(\d+\.\d+\.\d+)\.zip/g)]
      .map(match => match[1])
      .filter(found => found !== version);
    assert.deepStrictEqual([...new Set(stale)], [], `${doc} still names ${[...new Set(stale)]}`);
  }
});
