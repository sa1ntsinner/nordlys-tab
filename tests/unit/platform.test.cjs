const { test } = require('node:test');
const assert = require('node:assert');
require('../../src/js/search-engines.js');
const P = require('../../src/js/platform.js');

test('the browser is told apart by the address the page is served from', () => {
  assert.strictEqual(P.detect({ protocol: 'chrome-extension:', userAgent: 'Mozilla/5.0 Chrome/151.0 Safari/537.36' }).name, 'chrome');
  assert.strictEqual(P.detect({ protocol: 'chrome-extension:', userAgent: 'Mozilla/5.0 Chrome/151.0 Safari/537.36 Edg/151.0' }).name, 'edge');
  assert.strictEqual(P.detect({ protocol: 'moz-extension:', userAgent: 'Mozilla/5.0 Firefox/140.0' }).name, 'firefox');
  assert.strictEqual(P.detect({ protocol: 'safari-web-extension:', userAgent: 'Mozilla/5.0 Version/18.0 Safari/605.1.15' }).name, 'safari');
  assert.strictEqual(P.detect({ protocol: 'https:', userAgent: 'x' }).name, 'web');
});

test('only Chrome-family pages have the browser\'s favicon cache', () => {
  assert.strictEqual(P.detect({ protocol: 'chrome-extension:', userAgent: 'Chrome' }).faviconCache, true);
  assert.strictEqual(P.detect({ protocol: 'moz-extension:', userAgent: 'Firefox' }).faviconCache, false);
  assert.strictEqual(P.detect({ protocol: 'safari-web-extension:', userAgent: 'Safari' }).faviconCache, false);
  // A plain page (the tests, the site's demo) is treated as Chrome.
  assert.strictEqual(P.detect({ protocol: 'http:', userAgent: 'x' }).faviconCache, true);
});

test('a search engine the person chose makes a proper address, and only known ones are used', () => {
  assert.strictEqual(P.searchUrl('duckduckgo', 'a b&c'), 'https://duckduckgo.com/?q=a%20b%26c');
  assert.strictEqual(P.searchUrl('google', 'x'), 'https://www.google.com/search?q=x');
  assert.strictEqual(P.searchUrl('kagi', 'x'), 'https://kagi.com/search?q=x');
  assert.strictEqual(P.searchUrl('nonsense', 'x'), null);
  assert.ok(Object.keys(P.ENGINES).length >= 6);
});
