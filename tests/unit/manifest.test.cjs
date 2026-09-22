const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'manifest.json'), 'utf8'));

/* A web-accessible resource can be fetched by any page the user visits, which
   is how a site finds out an extension is installed. Nordlys has no content
   scripts, and its own pages reach _favicon/ and their files without the list,
   so it used to hand every website a way to fingerprint its users for nothing. */
test('nothing in the extension is exposed to web pages', () => {
  assert.strictEqual(MANIFEST.web_accessible_resources, undefined);
});

test('scripts run only from the package', () => {
  assert.match(MANIFEST.content_security_policy.extension_pages, /script-src 'self'(;|$)/);
});
