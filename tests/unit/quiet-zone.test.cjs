const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The quiet-zone solver decides how much sky the engine takes back from under
   the clock, the date and the search field. It is a pure function of the
   pixels it is shown, so it is tested here without a canvas. */
function engine() {
  const context = vm.createContext({ window: {}, document: {} });
  vm.runInContext(`${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;`, context);
  return context.Engine;
}

const channel = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (top, alpha, under) => top.map((v, i) => v * alpha + under[i] * (1 - alpha));
const field = (rgba, count = 40) => Array.from({ length: count }, () => rgba);

const NIGHT = [6, 10, 20];
const DAY = [248, 250, 252];
const INK = [233, 239, 251];
const DIM = [140, 160, 196];
const DARK_INK = [15, 23, 42];

test('a dark sky needs nothing taken back', () => {
  const Engine = engine();
  const cut = Engine.quietAlpha(field([20, 30, 60, 0.6]), NIGHT, { inks: [[DIM, 4.8]] });
  assert.equal(cut, 0);
});

test('a bright curtain behind the date is taken back until the date reads', () => {
  const Engine = engine();
  const sky = [120, 230, 210, 0.9];
  const zone = { inks: [[DIM, 4.8]] };
  const cut = Engine.quietAlpha(field(sky), NIGHT, zone);
  assert.ok(cut > 0 && cut < 0.9, `cut ${cut}`);
  const seen = over(sky.slice(0, 3), sky[3] * (1 - cut), NIGHT);
  assert.ok(ratio(DIM, seen) >= 4.8, `ratio ${ratio(DIM, seen)}`);
  // And not much more than it needs: a tenth less would not do.
  const less = over(sky.slice(0, 3), sky[3] * (1 - cut * 0.9), NIGHT);
  assert.ok(ratio(DIM, less) < 4.8);
});

test('a brighter sky takes more back', () => {
  const Engine = engine();
  const zone = { inks: [[DIM, 4.8]] };
  const soft = Engine.quietAlpha(field([90, 170, 160, 0.6]), NIGHT, zone);
  const loud = Engine.quietAlpha(field([200, 240, 230, 0.95]), NIGHT, zone);
  assert.ok(loud > soft, `${loud} > ${soft}`);
});

test('in a light theme the same operation lifts a darkened sky under dark text', () => {
  const Engine = engine();
  const sky = [40, 60, 140, 0.8];
  const cut = Engine.quietAlpha(field(sky), DAY, { inks: [[DARK_INK, 4.8]] });
  assert.ok(cut > 0);
  assert.ok(ratio(DARK_INK, over(sky.slice(0, 3), sky[3] * (1 - cut), DAY)) >= 4.8);
});

test('glass between the sky and the text is counted', () => {
  const Engine = engine();
  const sky = [180, 230, 220, 0.9];
  const bare = Engine.quietAlpha(field(sky), NIGHT, { inks: [[DIM, 4.8]] });
  const glazed = Engine.quietAlpha(field(sky), NIGHT, { inks: [[DIM, 4.8]], cover: [11, 18, 34, 0.6] });
  assert.ok(glazed < bare, `${glazed} < ${bare}`);
});

test('every ink in a zone is satisfied, including a quieter colon', () => {
  const Engine = engine();
  const sky = [150, 200, 240, 0.85];
  const digits = Engine.quietAlpha(field(sky), NIGHT, { inks: [[INK, 3.3]] });
  const withColon = Engine.quietAlpha(field(sky), NIGHT, { inks: [[INK, 3.3], [INK, 3.3, 0.66]] });
  assert.ok(withColon >= digits);
});

test('a few hot pixels, a star or a glint, do not dim the whole zone', () => {
  const Engine = engine();
  const pixels = [...field([20, 30, 60, 0.6], 36), ...field([255, 255, 255, 1], 3)];
  assert.equal(Engine.quietAlpha(pixels, NIGHT, { inks: [[DIM, 4.8]] }), 0);
});

test('when no attenuation can help it stops at the ceiling rather than erasing the sky', () => {
  const Engine = engine();
  // Mid-grey text on a mid-grey page: the sky only ever moves the background
  // towards the text's own colour, so no amount taken back reaches the ratio.
  const grey = [118, 118, 118];
  const cut = Engine.quietAlpha(field([255, 255, 255, 1]), grey, { inks: [[grey, 4.8]], most: 0.8 });
  assert.equal(cut, 0.8);
});
