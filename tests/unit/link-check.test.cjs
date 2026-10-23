const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../src/js/link-check.js');

/* Check the bookmarks (link-check.js): the same page written two ways is one
   page, and a page is called gone only when its own site says so. */

test('one page however it was written', () => {
  assert.equal(L.pageOf('https://www.Example.com/docs/#intro'), L.pageOf('http://example.com/docs'));
  assert.notEqual(L.pageOf('https://example.com/docs?page=2'), L.pageOf('https://example.com/docs'));
  assert.notEqual(L.pageOf('https://example.com:8443/'), L.pageOf('https://example.com/'));
  assert.equal(L.pageOf('javascript:alert(1)'), null);
});

test('the bookmarks on the board more than once, each place in board order', () => {
  const groups = [
    { label: 'Work', links: [{ name: 'Docs', url: 'https://docs.test/' }, { name: 'Mail', url: 'https://mail.test/' }] },
    { label: 'Mine', source: { folderId: '9' }, links: [{ name: 'Docs too', url: 'https://www.docs.test' }] },
    { label: 'Read', links: [{ name: 'Mail', url: 'https://mail.test/#inbox' }, { name: 'News', url: 'https://news.test/' }] }
  ];
  assert.deepEqual(L.twins(groups).map((twin) => twin.places.map((place) => [place.folder, place.name, place.followed])), [
    [['Work', 'Docs', false], ['Mine', 'Docs too', true]],
    [['Work', 'Mail', false], ['Read', 'Mail', false]]
  ]);
});

test('gone only when the site says so; its errors are told apart from a page that is missing', () => {
  assert.equal(L.verdict(404), 'gone');
  assert.equal(L.verdict(410), 'gone');
  assert.equal(L.verdict(503), 'error');
  for (const fine of [200, 301, 401, 403, 429]) assert.equal(L.verdict(fine), 'ok', String(fine));
});

test('each page is asked once; a HEAD the site refuses is asked again as a GET', async () => {
  const realFetch = global.fetch;
  const asked = [];
  const statuses = { 'https://a.test/': { HEAD: 200 }, 'https://gone.test/': { HEAD: 404, GET: 404 }, 'https://nohead.test/': { HEAD: 405, GET: 200 } };
  global.fetch = async (url, options) => {
    asked.push(`${options.method} ${url}${options.mode === 'no-cors' ? ' no-cors' : ''}`);
    if (url.includes('down')) throw new TypeError('Failed to fetch');
    if (options.credentials !== 'omit') throw new Error('cookies were sent');
    return { status: statuses[url]?.[options.method] ?? 0, body: null };
  };
  try {
    const answers = await L.check(['https://a.test/', 'https://gone.test/', 'https://nohead.test/', 'https://down.test/', 'https://a.test/', 'http://plain.test/'], (url) => url.startsWith('https://'));
    assert.deepEqual(Object.fromEntries([...answers].map(([url, answer]) => [url, answer.state])), {
      'https://a.test/': 'ok', 'https://gone.test/': 'gone', 'https://nohead.test/': 'ok', 'https://down.test/': 'unreachable', 'http://plain.test/': 'ok'
    });
    assert.equal(asked.filter((line) => line.endsWith('https://a.test/')).length, 1, 'a page twice on the board is asked once');
    assert.ok(asked.includes('HEAD http://plain.test/ no-cors'), 'a site Nordlys may not read is only asked whether it answers');
    assert.ok(asked.includes('GET https://nohead.test/'));
  } finally { global.fetch = realFetch; }
});
