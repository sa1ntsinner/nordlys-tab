const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function looks() {
  const window = {};
  vm.runInContext(readFileSync('src/js/look-share.js', 'utf8'), vm.createContext({ window, TextEncoder, TextDecoder, btoa, atob }));
  return window.NordlysLook;
}
// Objects made inside the sandbox have its prototypes; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));

const CONFIG = {
  theme: 'nord-frost', bgMode: 'frost', bgPalette: 'mood-1', bgMotion: 0.4, bgIntensity: 1.2, bgSeed: 2654435761,
  bgPalettes: [{ id: 'mood-1', name: 'Midwinter', colors: ['#aabbcc', '#334455', '#ffeedd'] }],
  fonts: { display: 'Outfit', interface: 'Instrument Sans' }, cardRadius: 20, iconShape: 'circle',
  userName: 'Alex', customCss: 'body { background: url(https://tracker.test/x) }',
  groups: [{ label: 'Daily', links: [{ name: 'Mail', url: 'https://mail.test/' }] }]
};

test('a look carries the appearance and nothing the person keeps on the board', () => {
  const { capture, encode, decode } = looks();
  const code = encode(capture(CONFIG));
  const { look } = decode(code);
  assert.equal(look.theme, 'nord-frost');
  assert.equal(look.bgMode, 'frost');
  assert.equal(look.bgSeed, 2654435761);
  assert.deepEqual(plain(look.mood), { name: 'Midwinter', colors: ['#aabbcc', '#334455', '#ffeedd'] });
  assert.deepEqual(plain(look.fonts), { display: 'Outfit', interface: 'Instrument Sans' });
  for (const secret of ['userName', 'customCss', 'groups', 'bgPalettes']) assert.equal(look[secret], undefined, secret);
  assert.ok(!code.includes('tracker') && !code.includes('Alex'));
  assert.ok(code.length < 600, `short enough to paste: ${code.length}`);
});

test('a wallpaper or video look is shared without its media', () => {
  const { capture } = looks();
  assert.equal(capture({ ...CONFIG, bgMode: 'custom-image' }).bgMode, undefined);
});

test('a hostile look is refused or stripped, never applied as written', () => {
  const { encode, decode, PREFIX } = looks();
  assert.equal(decode('hello').error, 'notALook');
  assert.equal(decode(`${PREFIX}!!!`).error, 'damaged');
  assert.equal(decode(`${PREFIX}${'A'.repeat(5000)}`).error, 'damaged');
  const hostile = decode(encode({
    theme: 'custom', customTheme: { bg: 'red; }', card: '#000000' },
    bgMode: 'javascript:alert(1)', bgMotion: 1e9, bgSeed: -1, cardRadius: '20px',
    fonts: { display: 'Evil"; } body { display:none } "' },
    customCss: '* { display: none }', groups: [{ links: [{ url: 'javascript:alert(1)' }] }],
    __proto__: { polluted: true }, iconShape: 'circle'
  }));
  assert.deepEqual(plain(hostile.look), { iconShape: 'circle' });
  assert.equal({}.polluted, undefined);
});

test('a studio theme travels with its colours, and only whole ones', () => {
  const { encode, decode } = looks();
  const studio = { bg: '#0A0F1D', card: '#111c35', border: '#2a3f6d', accent: '#35d6c0', glow: '#5b6cff', text: '#f1f5f9', dim: '#8ca0c4' };
  assert.equal(decode(encode({ theme: 'custom', customTheme: studio })).look.customTheme.bg, '#0a0f1d');
  assert.equal(decode(encode({ theme: 'custom', customTheme: { ...studio, dim: 'grey' }, cardGap: 12 })).look.theme, undefined);
});

/* How the board is laid out and whether the sky follows the sun are part of
   how the page looks; which folders share a row is part of what it holds. */
test('a look carries the layout and the daylight, never the rows', () => {
  const { capture, encode, decode } = looks();
  const config = { ...CONFIG, boardLayout: 'fitted', bgDaylight: true, groups: [{ label: 'Daily', row: 0, links: [] }, { label: 'Work', row: 1, links: [] }] };
  const { look } = decode(encode(capture(config)));
  assert.equal(look.boardLayout, 'fitted');
  assert.equal(look.bgDaylight, true);
  assert.equal(JSON.stringify(look).includes('"row"'), false);
  assert.equal(decode(encode({ boardLayout: 'masonry' })).error, 'empty', 'a layout this version does not know is dropped');
});

test('a look carries the size and spacing of the board, and refuses what it cannot draw', () => {
  const { capture, encode, decode } = looks();
  const { look } = decode(encode(capture({ ...CONFIG, tileSize: 96, cardGap: 20, boardGap: 36, boardWidth: 'wide', tileLabels: false })));
  assert.equal(look.boardGap, 36);
  assert.equal(look.boardWidth, 'wide');
  assert.equal(look.tileLabels, false);
  const { look: hostile } = decode(encode({ theme: 'nord-frost', boardGap: 900, boardWidth: 'endless', tileLabels: 'no' }));
  assert.equal('boardGap' in hostile, false);
  assert.equal('boardWidth' in hostile, false);
  assert.equal('tileLabels' in hostile, false);
});
