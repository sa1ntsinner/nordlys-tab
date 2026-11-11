const test = require('node:test');
const assert = require('node:assert/strict');
const { vectorDataUrl, markupDataUrl, titleFromSlug, parseQuery, originsFor, brandFromHost, namesFor, rank, find, fromIconify, fromCommons, context } = require('../../src/js/icon-discovery.js');

test('brand vectors become inert path-only data URLs', () => {
  const url = vectorDataUrl({ width: 24, height: 24, body: '<path fill="currentColor" d="M2 2H22V22H2Z"/>' }, '#35d6c0');
  assert.match(url, /^data:image\/svg\+xml/);
  assert.match(decodeURIComponent(url), /<path d="M2 2H22V22H2Z"\/>/);
  assert.doesNotMatch(decodeURIComponent(url), /currentColor/);
});

test('active or unsupported SVG markup is refused', () => {
  assert.throws(() => vectorDataUrl({ body: '<script>alert(1)</script><path d="M0 0"/>' }), /Unsupported/);
  assert.throws(() => vectorDataUrl({ body: '<path d="M0 0" onload="alert(1)"/>' }), /Unsupported/);
  assert.throws(() => vectorDataUrl({ width: 100000, height: 24, body: '<path d="M0 0"/>' }), /dimensions/);
});

/* A full-colour mark keeps its fills and gradients, and nothing that could
   run or reach outside. */
test('a colour mark keeps its gradients and refuses script, handlers and outside addresses', () => {
  const kept = decodeURIComponent(markupDataUrl({ width: 256, height: 256, body: '<defs><linearGradient id="a"><stop stop-color="#f00"/></linearGradient></defs><path fill="url(#a)" d="M0 0h9v9z"/>' }));
  assert.match(kept, /fill="url\(#a\)"/);
  assert.match(kept, /viewBox="0 0 256 256"/);
  for (const body of ['<script>1</script>', '<path d="M0 0" onclick="x()"/>', '<image href="https://example.org/a.png"/>', '<use href="https://example.org/a.svg#b"/>',
    '<path style="x" fill="url(https://example.org/a)" d="M0 0"/>', '<foreignObject></foreignObject>', '<style>a{}</style>']) {
    assert.throws(() => markupDataUrl({ body }), /Unsupported/, body);
  }
});

test('what is typed is a name, a site or a picture', () => {
  assert.deepEqual(parseQuery('  '), { kind: 'empty' });
  assert.equal(parseQuery('Spotify').kind, 'name');
  assert.equal(parseQuery('Stack Overflow').kind, 'name');
  assert.equal(parseQuery('Node.js runtime').kind, 'name');
  const site = parseQuery('open.spotify.com/collection');
  assert.deepEqual([site.kind, site.origin, site.name], ['site', 'https://open.spotify.com', 'spotify']);
  assert.equal(parseQuery('https://github.com').kind, 'site');
  assert.equal(parseQuery('https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg').kind, 'image');
  assert.equal(parseQuery('example.org/logo.PNG?v=2').kind, 'image');
  assert.equal(parseQuery('data:image/png;base64,AAAA').kind, 'image');
  assert.equal(parseQuery('javascript:alert(1)').kind, 'name');
});

test('only a link asks for a site, and only for that site', () => {
  assert.deepEqual(originsFor(parseQuery('Spotify')), []);
  // A page inside a larger site is looked for on that site's front page too.
  assert.deepEqual(originsFor(parseQuery('https://open.spotify.com/x')), ['https://open.spotify.com/*', 'https://www.spotify.com/*']);
  assert.deepEqual(originsFor(parseQuery('https://www.youtube.com/watch')), ['https://www.youtube.com/*']);
  assert.deepEqual(originsFor(parseQuery('https://cdn.example.org/a/logo.svg')), ['https://cdn.example.org/*']);
  assert.deepEqual(originsFor(parseQuery('data:image/png;base64,AAAA')), []);
});

test('a host is known by its own word', () => {
  const expectations = { 'www.youtube.com': 'youtube', 'open.spotify.com': 'spotify', 'bbc.co.uk': 'bbc', 'store.steampowered.com': 'steampowered', 'localhost': 'localhost', 'chatgpt.com': 'chatgpt' };
  for (const [host, brand] of Object.entries(expectations)) assert.equal(brandFromHost(host), brand, host);
});

const pick = (list) => rank(list).map(choice => choice.id);

test('a vector comes first, then a large clear picture; an opaque one and a favicon come last', () => {
  const order = pick([
    { id: 'favicon', src: 'a', from: 'site-icon', width: 32, height: 32, measured: true },
    { id: 'opaque', src: 'b', from: 'site-touch', width: 180, height: 180, opaque: true, measured: true },
    { id: 'clear', src: 'c', from: 'site-icon', width: 192, height: 192, measured: true },
    { id: 'vector', src: 'd', from: 'site-icon', vector: true, width: 24, height: 24, measured: true }
  ]);
  assert.deepEqual(order, ['vector', 'clear', 'opaque', 'favicon']);
});

test('a smaller clear picture beats a larger one on an opaque plate', () => {
  assert.deepEqual(pick([
    { id: 'plate', src: 'a', from: 'site-touch', width: 180, height: 180, opaque: true, measured: true },
    { id: 'clear', src: 'b', from: 'site-icon', width: 96, height: 96, measured: true }
  ]), ['clear', 'plate']);
});

test('wordmarks and banners are refused, a picture the person pointed at never is', () => {
  assert.deepEqual(pick([
    { id: 'wordmark', src: 'a', from: 'wikimedia-logo', vector: true, width: 800, height: 240 },
    { id: 'banner', src: 'b', from: 'site-og', width: 1200, height: 630, measured: true },
    { id: 'pasted', src: 'c', from: 'address', width: 1200, height: 400, measured: true }
  ]), ['pasted']);
});

test('one favicon at most, the same picture once, six choices in all', () => {
  const many = Array.from({ length: 9 }, (_, at) => ({ id: `v${at}`, src: `s${at}`, from: 'logos', vector: true, width: 10, height: 10 }));
  assert.equal(rank(many).length, 6);
  const small = [16, 24, 32].map(size => ({ id: `f${size}`, src: `f${size}`, from: 'site-icon', width: size, height: size, measured: true }));
  assert.deepEqual(pick(small), ['f32']);
  assert.equal(rank([many[0], { ...many[1], src: many[0].src }]).length, 1);
});

const reply = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('the brand sets answer with the brand itself, not its neighbours', async () => {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    if (url.includes('/search?')) return reply({ icons: ['simple-icons:steam', 'logos:steam', 'simple-icons:steamdb', 'simple-icons:steamdeck', 'logos:steam-icon', 'other:steam'] });
    if (url.includes('cdn.simpleicons.org')) return new Response('<svg fill="#000000"/>');
    if (url.includes('/logos.json')) return reply({ prefix: 'logos', icons: { steam: { body: '<path fill="#000" d="M0 0h9v9z"/>', width: 512, height: 128 }, 'steam-icon': { body: '<path fill="#000" d="M0 0h9v9z"/>', width: 256, height: 256 } } });
    return reply({ prefix: 'simple-icons', width: 24, height: 24, icons: { steam: { body: '<path d="M0 0h9v9z"/>' } } });
  };
  const found = await fromIconify('Steam', context({ fetchImpl }));
  assert.deepEqual(found.map(icon => icon.id).sort(), ['logos:steam', 'logos:steam-icon', 'simple-icons:steam']);
  assert.ok(asked.every(url => ['api.iconify.design', 'cdn.simpleicons.org'].includes(new URL(url).host)));
  // The wide wordmark is dropped by the ranking, the square mark leads, the single-colour one follows.
  assert.deepEqual(pick(found), ['logos:steam-icon', 'simple-icons:steam']);
});

/* Simple Icons and SVG Logos do not have every brand (Amazon is in neither).
   The other sets fill the gap with a vector, so a 48 px favicon is not the answer. */
test('a brand missing from the first two sets is found in the others, in colour and in one colour', async () => {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    if (url.includes('/search?')) return reply({ icons: ['selfhst:amazon', 'selfhst:amazon-light', 'selfhst:amazon-dark', 'selfhst:amazon-s3', 'thesvg-color:amazon', 'thesvg-color:amazon-q', 'cib:amazon', 'cib:amazon-pay', 'fa7-brands:amazon', 'ri:amazon-fill'] });
    const prefix = /\/([a-z0-9-]+)\.json/.exec(url)?.[1];
    const colour = { body: '<path fill="#f90" d="M0 0h9v9z"/><path fill="#fff" d="M1 1h3v3z"/>' };
    if (prefix === 'selfhst') return reply({ prefix, width: 512, height: 512, icons: { amazon: colour, 'amazon-light': colour, 'amazon-dark': colour } });
    if (prefix === 'thesvg-color') return reply({ prefix, width: 256, height: 256, icons: { amazon: colour } });
    if (prefix === 'cib') return reply({ prefix, width: 32, height: 32, icons: { amazon: { body: '<path fill="currentColor" d="M0 0h9v9z"/>' } } });
    if (prefix === 'fa7-brands') return reply({ prefix, icons: { amazon: { body: '<path fill="currentColor" d="M0 0h9v9z"/>', width: 448, height: 512 } } });
    throw new Error(`unexpected ${url}`);
  };
  const found = await fromIconify('Amazon', context({ fetchImpl }));
  assert.deepEqual(found.map(icon => icon.id).sort(), ['cib:amazon', 'fa7-brands:amazon', 'selfhst:amazon', 'selfhst:amazon-dark', 'selfhst:amazon-light', 'thesvg-color:amazon']);
  assert.ok(found.every(icon => icon.vector && icon.src.startsWith('data:image/svg+xml')));
  assert.match(asked[0], /prefixes=logos,selfhst,thesvg-color,simple-icons,cib,fa7-brands/);
  assert.ok(asked.every(url => new URL(url).host === 'api.iconify.design'));
  // A one-colour set draws in a colour of ours, never in what the catalogue sent.
  assert.match(decodeURIComponent(found.find(icon => icon.id === 'cib:amazon').src), /fill="#10151f"/);
  // The colour marks lead; the one-colour ones are there to fall back on.
  assert.deepEqual(pick(found).slice(0, 1).map(id => id.split(':')[0]), ['selfhst']);
  assert.ok(pick(found).indexOf('cib:amazon') > pick(found).indexOf('thesvg-color:amazon'));
});

test('Commons gives the file named "<Brand> icon" and nothing that merely mentions the brand', async () => {
  const pages = (titles) => ({ query: { pages: Object.fromEntries(titles.map((title, at) => [at + 1, { index: at + 1, title, imageinfo: [{ url: `https://upload.wikimedia.org/a/${at}.svg`, width: 512, height: 512, mime: 'image/svg+xml' }] }])) } });
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    return reply(pages(['File:Tabler-icons brand-amazon.svg', 'File:AWS Simple Icons Storage Amazon S3.svg', 'File:Amazon icon.svg', 'File:Amazon Prime icon.svg', 'File:Amazon app icon 2021.svg']));
  };
  const found = await fromCommons('Amazon', context({ fetchImpl }));
  assert.deepEqual(found.map(icon => icon.id), ['wikimedia:Amazon icon.svg', 'wikimedia:Amazon app icon 2021.svg']);
  assert.ok(found.every(icon => icon.from === 'wikimedia-icon' && icon.vector && icon.distance > 0));
  assert.equal(new URL(asked[0]).host, 'commons.wikimedia.org');
  assert.match(decodeURIComponent(asked[0]), /intitle:"Amazon" intitle:icon filemime:image\/svg\+xml/);
  // Too short to be told from anything, or nothing typed: not asked at all.
  assert.deepEqual(await fromCommons('X', context({ fetchImpl })), []);
  assert.equal(asked.length, 1);
  // A file elsewhere, or not a vector, is not taken.
  const odd = async () => reply({ query: { pages: { 1: { title: 'File:Amazon icon.svg', imageinfo: [{ url: 'https://example.org/a.svg', width: 9, height: 9, mime: 'image/svg+xml' }] }, 2: { title: 'File:Amazon icon.svg', imageinfo: [{ url: 'https://upload.wikimedia.org/a.png', width: 9, height: 9, mime: 'image/png' }] } } } });
  assert.deepEqual(await fromCommons('Amazon', context({ fetchImpl: odd })), []);
});

test('oversized provider responses are rejected before parsing', async () => {
  const fetchImpl = async () => new Response(' '.repeat(512 * 1024 + 1), { status: 200, headers: { 'content-type': 'application/json' } });
  await assert.rejects(fromIconify('github', context({ fetchImpl })), /too large/);
});

test('a name asks the two catalogues and never the site', async () => {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(new URL(url).host);
    if (url.includes('iconify.design/search')) return reply({ icons: ['logos:spotify-icon'] });
    if (url.includes('logos.json')) return reply({ prefix: 'logos', icons: { 'spotify-icon': { body: '<path fill="#1ed760" d="M0 0h9v9z"/>', width: 256, height: 256 } } });
    if (url.includes('wbsearchentities')) return reply({ search: [{ id: 'Q689141' }] });
    if (url.includes('query.wikidata.org')) return reply({ results: { bindings: [
      { item: { value: 'http://www.wikidata.org/entity/Q689141' }, p: { value: 'http://www.wikidata.org/prop/direct/P8972' }, v: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Spotify%20icon.svg' } },
      { item: { value: 'http://www.wikidata.org/entity/Q689141' }, p: { value: 'http://www.wikidata.org/prop/direct/P154' }, v: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Spotify%20logo%20with%20text.svg' } }
    ] } });
    if (url.includes('commons.wikimedia.org')) return reply({ query: { pages: {
      1: { title: 'File:Spotify icon.svg', imageinfo: [{ url: 'https://upload.wikimedia.org/a/Spotify_icon.svg', width: 512, height: 512, mime: 'image/svg+xml' }] },
      2: { title: 'File:Spotify logo with text.svg', imageinfo: [{ url: 'https://upload.wikimedia.org/a/Spotify_logo_with_text.svg', width: 559, height: 168, mime: 'image/svg+xml' }] }
    } } });
    throw new Error(`unexpected ${url}`);
  };
  // Pictures are measured in a browser; here each is taken as its catalogue describes it.
  const measureImpl = async (candidate) => ({ ...candidate, src: candidate.src || candidate.url, measured: true });
  const { choices, offline } = await find('Spotify', { fetchImpl, measureImpl });
  assert.equal(offline, false);
  assert.deepEqual(choices.map(choice => choice.id).sort(), ['logos:spotify-icon', 'wikimedia:Spotify icon.svg']);
  assert.deepEqual([...new Set(asked)].sort(), ['api.iconify.design', 'commons.wikimedia.org', 'query.wikidata.org', 'www.wikidata.org']);
});

test('a link whose site may not be read still gets the catalogues, and says so', async () => {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(new URL(url).host);
    if (url.includes('iconify.design/search')) return reply({ icons: ['simple-icons:example'] });
    if (url.includes('cdn.simpleicons.org')) return new Response('<svg fill="#336699"/>');
    if (url.includes('simple-icons.json')) return reply({ prefix: 'simple-icons', width: 24, height: 24, icons: { example: { body: '<path d="M0 0h9v9z"/>' } } });
    return reply({ search: [] });
  };
  const measureImpl = async (candidate) => ({ ...candidate, src: candidate.src || candidate.url, measured: true });
  const result = await find('https://example.org/', { access: Promise.resolve(false), fetchImpl, measureImpl });
  assert.equal(result.declined, true);
  assert.deepEqual(result.choices.map(choice => choice.id), ['simple-icons:example']);
  assert.ok(!asked.includes('example.org'), 'the site itself was never asked');
});

test('with no network the answer is "offline", not "nothing found"', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const result = await find('Spotify', { fetchImpl });
  assert.deepEqual([result.choices.length, result.offline], [0, true]);
  const none = await find('Zzyzx', { fetchImpl: async () => reply({ icons: [], search: [] }) });
  assert.deepEqual([none.choices.length, none.offline], [0, false]);
});

/* Simple Icons runs a brand's words together; a result used to read
   "Githubactions" and "Googledrive". */
test('search results are named the way the brands name themselves', () => {
  const expectations = {
    github: 'GitHub', githubactions: 'GitHub Actions', googledrive: 'Google Drive', microsoftteams: 'Microsoft Teams',
    stackoverflow: 'Stack Overflow', youtubemusic: 'YouTube Music', nodedotjs: 'Node.js', figma: 'Figma',
    adobephotoshop: 'Adobe Photoshop', 'hacker-news': 'Hacker News', app: 'App', npm: 'npm', googletv: 'Google TV'
  };
  for (const [slug, title] of Object.entries(expectations)) assert.equal(titleFromSlug(slug), title, slug);
});

/* ── What cannot be seen on the tile does not come first ─────────── */

const mark = (id, from, extra = {}) => ({ id, src: id, from, vector: true, width: 256, height: 256, measured: true, ...extra });
const DARK_TILE = 0.002, LIGHT_TILE = 0.93;

test('of two one-colour marks, the one that reads on this tile as it stands goes first', () => {
  const black = mark('black', 'logos-icon', { mono: true, flat: true, luminance: 0.01 });
  const white = mark('white', 'logos-icon', { mono: true, flat: true, luminance: 0.95 });
  assert.deepEqual(rank([black, white], { ground: DARK_TILE }).map(choice => choice.id), ['white', 'black']);
  assert.deepEqual(rank([white, black], { ground: LIGHT_TILE }).map(choice => choice.id), ['black', 'white']);
  // With no tile to judge by, neither is preferred.
  assert.equal(rank([black, white])[0].score, rank([black, white])[1].score);
});

test('a shaded mark that reads goes before a better-ranked one that would have to be re-toned', () => {
  const letter = mark('letter', 'wikimedia-icon', { mono: true, flat: true, luminance: 0.01 });
  const globe = mark('globe', 'wikimedia-logo', { mono: true, flat: false, luminance: 0.6 });
  assert.deepEqual(rank([letter, globe], { ground: DARK_TILE }).map(choice => choice.id), ['globe', 'letter']);
  assert.deepEqual(rank([letter, globe], { ground: LIGHT_TILE }).map(choice => choice.id), ['letter', 'globe']);
});

test('art in several dark colours is lost on a dark tile and falls behind; a one-colour mark only a little', () => {
  const art = mark('art', 'logos-icon', { luminance: 0.01 });
  const navy = mark('navy', 'simple-icons', { flat: true, luminance: 0.02 });
  const [first, second] = rank([art, navy], { ground: DARK_TILE });
  assert.deepEqual([first.id, second.id], ['navy', 'art']);
  assert.ok(first.score - second.score >= 10);
});

/* ── Wordmarks, and the same drawing twice ───────────────────────── */

test('a wordmark in a square box is a wordmark: any square mark goes before it, and alone it is the last resort', () => {
  const wordmark = mark('wordmark', 'simple-icons', { inkAspect: 5.2, flat: true });
  const favicon = { id: 'favicon', src: 'f', from: 'site-icon', width: 32, height: 32, measured: true, inkAspect: 1 };
  assert.deepEqual(rank([wordmark, favicon]).map(choice => choice.id), ['favicon']);
  assert.deepEqual(rank([wordmark]).map(choice => choice.id), ['wordmark']);
});

test('the same drawing from two places is offered once, the better of the two', () => {
  const look = Array.from({ length: 64 }, (_, at) => (at % 9 === 0 ? 1 : 0.2));
  const other = Array.from({ length: 64 }, (_, at) => (at % 2 ? 1 : 0));
  const choices = rank([
    mark('catalogue', 'simple-icons', { look }),
    mark('site', 'site-icon', { look: look.map(cell => Math.min(1, cell + 0.02)) }),
    mark('different', 'wikimedia-logo', { look: other })
  ]);
  assert.deepEqual(choices.map(choice => choice.id), ['site', 'different']);
});

/* ── Names ───────────────────────────────────────────────────────── */

test('a name is also looked up as the words of the address it is for, and as its own words', () => {
  assert.deepEqual(namesFor('Gemini', 'gemini.google.com').map(name => name.slug), ['gemini', 'google']);
  assert.deepEqual(namesFor('Courses', 'moodle.example.edu').map(name => [name.slug, name.distance]), [['courses', 0], ['moodle', 6], ['example', 16]]);
  assert.deepEqual(namesFor('RST GitLab', 'git.rst.example.de').map(name => name.slug), ['rstgitlab', 'example', 'gitlab']);
  assert.deepEqual(namesFor('Steam', '').map(name => name.slug), ['steam']);
});

test('a brand filed under the name of its maker is found by its own name', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/search?')) return reply({ icons: ['logos:google-gemini-icon', 'simple-icons:googlegemini', 'logos:google-icon', 'simple-icons:geminiprotocol'] });
    if (url.includes('cdn.simpleicons.org')) return new Response('<svg fill="#8E75B2"/>');
    if (url.includes('/logos.json')) return reply({ prefix: 'logos', icons: { 'google-gemini-icon': { body: '<path fill="#48f" d="M0 0h9v9z"/>', width: 256, height: 256 } } });
    return reply({ prefix: 'simple-icons', width: 24, height: 24, icons: { googlegemini: { body: '<path d="M0 0h9v9z"/>' } } });
  };
  const found = await fromIconify('Gemini', context({ fetchImpl }));
  assert.deepEqual(found.map(icon => icon.id).sort(), ['logos:google-gemini-icon', 'simple-icons:googlegemini']);
  assert.ok(found.every(icon => icon.distance === 4), 'a little behind an entry under the very name');
});

/* ── Time ────────────────────────────────────────────────────────── */

test('a source that never answers does not hold the others: the search ends on its budget with what it has', async () => {
  const fetchImpl = async (url, { signal } = {}) => {
    if (url.includes('iconify.design/search')) return reply({ icons: ['logos:spotify-icon'] });
    if (url.includes('logos.json')) return reply({ prefix: 'logos', icons: { 'spotify-icon': { body: '<path fill="#1ed760" d="M0 0h9v9z"/>', width: 256, height: 256 } } });
    // Wikidata hangs until it is told to stop.
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('stopped'))));
  };
  const measureImpl = async (candidate) => ({ ...candidate, src: candidate.src || candidate.url, measured: true });
  const heard = [];
  const started = Date.now();
  const result = await find('Spotify', { fetchImpl, measureImpl, budget: 150, onProgress: choices => heard.push([Date.now() - started, choices[0].id]) });
  assert.equal(result.late, true);
  assert.deepEqual(result.choices.map(choice => choice.id), ['logos:spotify-icon']);
  assert.equal(heard[0][1], 'logos:spotify-icon');
  assert.ok(heard[0][0] < 120, 'the good icon was announced before the budget ran out');
  assert.ok(Date.now() - started < 1000);
});
