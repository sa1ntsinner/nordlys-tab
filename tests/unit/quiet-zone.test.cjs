const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The quiet-zone solver decides how much sky the engine takes back from under
   the clock, the date and the search field. It is a pure function of the
   pixels it is shown, so it is tested here without a canvas. What the engine
   shows it, and how a curtain is filled, is checked against a 2D context that
   records every call. */
function engine(globals = {}) {
  const context = vm.createContext({ window: {}, document: {}, ...globals });
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

/* A 2D context that paints nothing and remembers everything it was asked. */
function recorder(own = {}) {
  const calls = [];
  const sets = [];
  const state = {};
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        const result = own[key] ? own[key](...args)
          : /Gradient$/.test(key) ? { stops: [], addColorStop(offset, colour) { this.stops.push([offset, colour]); } }
          : undefined;
        calls.push({ name: key, args, result });
        return result;
      };
    },
    set(target, key, value) {
      sets.push([key, value]);
      target[key] = value;
      return true;
    }
  });
  return { ctx, calls, sets, called: name => calls.filter(call => call.name === name) };
}

function aurora(Engine, fields) {
  const sky = Object.assign(Object.create(Engine.prototype), {
    canvas: {}, w: 960, h: 540, dpr: 1.25, mode: 'aurora', t: 1.7, motion: 1, intensity: 1, sky: null,
    palette: ['#35d6c0', '#5b6cff', '#9d4edd'], paletteRgb: [[53, 214, 192], [91, 108, 255], [157, 78, 221]],
    stars: [], meteors: [], quietZones: [], quietAlphas: [], quietSolvedAt: -Infinity, quietGround: NIGHT,
    solvingQuiet: false, motionQuery: { matches: false }
  }, fields);
  sky.initNebulae();
  return sky;
}

const page = extra => ({
  documentElement: { classList: { contains: () => false } },
  ...extra
});

test('the quiet sample is painted from the scene, never read back from the screen', () => {
  const pixels = new Uint8ClampedArray(96 * 54 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([180, 230, 220, 230], i);
  const scratch = recorder({ getImageData: () => ({ data: pixels }) });
  const canvas = { width: 0, height: 0, getContext: (_type, options) => {
    assert.equal(options.willReadFrequently, true);
    return scratch.ctx;
  } };
  const Engine = engine({ document: page({ createElement: () => canvas }), performance: { now: () => 5000 } });
  const screen = recorder();
  const sky = aurora(Engine, { ctx: screen.ctx, quietZones: [{ x: 0, y: 0, w: 960, h: 540, inks: [[DIM, 4.8]] }] });

  sky.render(1);

  // The screen is painted and quietened, and nothing is ever read from it.
  assert.equal(screen.called('getImageData').length, 0);
  assert.equal(screen.called('drawImage').length, 0);
  assert.ok(screen.called('fill').length >= 6, 'six curtains on screen');
  assert.ok(screen.sets.some(([key, value]) => key === 'globalCompositeOperation' && value === 'destination-out'));
  // The sample is the same scene at its own size, painted once and read once:
  // it does not solve quiet zones of its own.
  assert.deepEqual(scratch.called('setTransform')[0].args, [96 / 960, 0, 0, 54 / 540, 0, 0]);
  assert.equal(scratch.called('clearRect').length, 1);
  assert.equal(scratch.called('fill').length, screen.called('fill').length);
  assert.equal(scratch.called('getImageData').length, 1);
  assert.ok(!scratch.sets.some(([key, value]) => key === 'globalCompositeOperation' && value === 'destination-out'));
  // Painting the sample does not move the sky: only the real frame advanced it.
  assert.ok(Math.abs(sky.t - (1.7 + 0.005)) < 1e-12, `t ${sky.t}`);
  assert.equal(sky.ctx, screen.ctx);
  assert.equal(sky.solvingQuiet, false);
  assert.ok(sky.quietAlphas[0] > 0, 'the bright sample was quietened');
});

test('a failed sample hands the screen back to the scene', () => {
  const scratch = recorder({ clearRect: () => { throw Error('lost context'); } });
  const Engine = engine({ document: page({ createElement: () => ({ getContext: () => scratch.ctx }) }) });
  const screen = recorder();
  const sky = aurora(Engine, { ctx: screen.ctx, quietZones: [{ x: 0, y: 0, w: 960, h: 540, inks: [[DIM, 4.8]] }] });
  assert.throws(() => sky.solveQuiet(), /lost context/);
  assert.equal(sky.ctx, screen.ctx);
  assert.equal(sky.solvingQuiet, false);
});

test('an aurora curtain is closed where its gradient has faded, not at the foot of the screen', () => {
  const Engine = engine({ document: page() });
  for (const spread of [1, 2.1, 2.2, 2.4]) {
    for (const t of [0, 1.7, 3.3, 9.1, 40]) {
      const screen = recorder();
      const sky = aurora(Engine, { ctx: screen.ctx, w: 2048, h: 1152, t, ink: 1 });
      sky.drawRibbon(0.62, '#9d4edd', 0.08, 1.5, 0.8, spread);
      const [gradient] = screen.called('createLinearGradient');
      const [, top, , fade] = gradient.args;
      assert.deepEqual(gradient.result.stops.at(-1), [1, 'transparent']);
      const ys = [...screen.called('moveTo'), ...screen.called('lineTo')].map(call => call.args[1]);
      // The wave stays inside the painted band, so nothing visible is clipped...
      assert.ok(Math.min(...ys) > top, `spread ${spread} t ${t}`);
      assert.ok(Math.max(...ys) <= fade, `spread ${spread} t ${t}`);
      // ...and the fill ends where the gradient does.
      assert.equal(screen.called('moveTo')[0].args[1], fade);
      assert.equal(screen.called('lineTo').at(-1).args[1], fade);
      assert.ok(fade < 1152);
    }
  }
});
