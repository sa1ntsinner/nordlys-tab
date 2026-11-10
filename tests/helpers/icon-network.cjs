/* A pretend internet for the icon finder: every request that leaves the page
   is answered here or refused, and written down. */
const zlib = require('node:zlib');

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
};

/* A PNG of one colour. `plate` paints the whole square; otherwise a disc on a
   clear ground, so its corners are see-through. */
function png(side, [r, g, b] = [220, 40, 40], { plate = false } = {}) {
  const raw = Buffer.alloc((side * 4 + 1) * side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const inside = plate || Math.hypot(x - side / 2 + 0.5, y - side / 2 + 0.5) <= side * 0.42;
    raw.set([r, g, b, inside ? 255 : 0], y * (side * 4 + 1) + 1 + x * 4);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(side, 0); header.writeUInt32BE(side, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const svg = (fill = '#1ed760') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${fill}"/></svg>`;

/* routes: { 'substring of the address': body | { status, body, type } | 'offline' }.
   The longest matching key answers; anything unmatched gets a 404. */
async function pretendInternet(page, origin, routes = {}) {
  const asked = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  await page.route(url => !url.href.startsWith(origin) && /^https?:$/.test(url.protocol), route => {
    const url = route.request().url();
    asked.push(url);
    // A key that is a whole page address answers only that page, not everything under it.
    const key = keys.find(candidate => url === candidate) ?? keys.find(candidate => !candidate.startsWith('http') && url.includes(candidate));
    const answer = key === undefined ? { status: 404, body: '' } : routes[key];
    if (answer === 'offline') return route.abort('internetdisconnected');
    const shaped = Buffer.isBuffer(answer) || typeof answer === 'string' ? { body: answer } : answer.body === undefined && answer.status === undefined ? { body: JSON.stringify(answer) } : answer;
    const body = shaped.body ?? '';
    const type = shaped.type || (Buffer.isBuffer(body) ? 'image/png' : /^\s*<svg/.test(body) ? 'image/svg+xml' : /^\s*<(!doctype|html)/i.test(body) ? 'text/html' : 'application/json');
    return route.fulfill({ status: shaped.status || 200, contentType: type, headers: { 'access-control-allow-origin': '*' }, body });
  });
  return asked;
}

/* What the two catalogues say for one brand. */
function catalogues({ slug = 'spotify', colour = true, wikimedia = true } = {}) {
  const routes = {
    'api.iconify.design/search': { icons: [...(colour ? [`logos:${slug}-icon`] : []), `simple-icons:${slug}`] },
    'api.iconify.design/logos.json': { prefix: 'logos', icons: { [`${slug}-icon`]: { body: '<circle cx="128" cy="128" r="120" fill="#1ed760"/>', width: 256, height: 256 } } },
    'api.iconify.design/simple-icons.json': { prefix: 'simple-icons', width: 24, height: 24, icons: { [slug]: { body: '<path d="M2 2H22V22H2Z"/>' } } },
    'www.wikidata.org/w/api.php': { search: wikimedia ? [{ id: 'Q1' }] : [] },
    'query.wikidata.org/sparql': { results: { bindings: [
      { item: { value: 'http://www.wikidata.org/entity/Q1' }, p: { value: 'http://www.wikidata.org/prop/direct/P8972' }, v: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Brand%20icon.svg' } }
    ] } },
    'commons.wikimedia.org/w/api.php': { query: { pages: { 1: { title: 'File:Brand icon.svg', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Brand_icon.svg', width: 512, height: 512, mime: 'image/svg+xml' }] } } } },
    'upload.wikimedia.org/': svg('#ff5500'),
    'cdn.simpleicons.org/': '<svg xmlns="http://www.w3.org/2000/svg" fill="#1DB954" viewBox="0 0 24 24"><path d="M2 2H22V22H2Z"/></svg>'
  };
  return routes;
}

const SILENT = { 'api.iconify.design/search': { icons: [] }, 'www.wikidata.org/w/api.php': { search: [] } };

module.exports = { png, svg, pretendInternet, catalogues, SILENT };
