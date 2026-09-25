const test = require('node:test');
const assert = require('node:assert/strict');
const { vectorDataUrl, search, titleFromSlug } = require('../../src/js/icon-discovery.js');

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

test('oversized provider responses are rejected before parsing', async () => {
  const fetchImpl = async () => new Response(' '.repeat(512 * 1024 + 1), { status: 200, headers: { 'content-type': 'application/json' } });
  await assert.rejects(search('github', { fetchImpl }), /too large/);
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
