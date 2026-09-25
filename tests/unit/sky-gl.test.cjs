const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The GPU line layer (sky-gl.js) turns the long lines of the sky into
   triangle strips. The strips are built by a pure function, so their
   geometry is checked here without a GPU; what the engine hands the layer,
   and when it draws in 2D instead, is checked against a fake layer and a 2D
   context that records every call. */
function layer() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(`${readFileSync('src/js/sky-gl.js', 'utf8')}\nthis.SkyGL = NordlysSkyGL; this.FLOATS = NORDLYS_GL_FLOATS;`, context);
  return context;
}

const vertex = (out, FLOATS, index) => Array.from(out.subarray(index * FLOATS, (index + 1) * FLOATS));
const near = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-5, `${label}: [${actual}] is not [${expected}]`));
};
const flat = (i, rgba) => { rgba[0] = 1; rgba[1] = 0.5; rgba[2] = 0.25; rgba[3] = 0.1 * (i + 1); };

test('a line becomes a strip of two vertices a point, reach out along its normal in device pixels', () => {
  const { SkyGL, FLOATS } = layer();
  const out = new Float32Array(32 * FLOATS);
  // Three CSS points along +x, drawn at a device pixel ratio of 2.
  const next = SkyGL.strip(out, 0, [0, 0, 10, 0, 20, 0], 3, 2, 1.5, 4, flat);
  // Six vertices, and the last one repeated so the next line can join the same strip.
  assert.equal(next, 7);
  // x, y, across, r, g, b, a, core width: the normal of +x is +y.
  near(vertex(out, FLOATS, 0), [0, 4, 4, 1, 0.5, 0.25, 0.1, 1.5], 'first point, one side');
  near(vertex(out, FLOATS, 1), [0, -4, -4, 1, 0.5, 0.25, 0.1, 1.5], 'first point, other side');
  near(vertex(out, FLOATS, 2), [20, 4, 4, 1, 0.5, 0.25, 0.2, 1.5], 'second point is scaled to device pixels');
  near(vertex(out, FLOATS, 5), [40, -4, -4, 1, 0.5, 0.25, 0.3, 1.5], 'last point');
  near(vertex(out, FLOATS, 6), vertex(out, FLOATS, 5), 'the last vertex is repeated');
});

test('a second line joins the strip through a repeated first vertex', () => {
  const { SkyGL, FLOATS } = layer();
  const out = new Float32Array(32 * FLOATS);
  const first = SkyGL.strip(out, 0, [0, 0, 10, 0], 2, 1, 1, 2, flat);
  assert.equal(first, 5);
  // A vertical line: the normal of +y is -x.
  const second = SkyGL.strip(out, first, [50, 0, 50, 10], 2, 1, 1, 2, flat);
  assert.equal(second, first + 6, 'a repeated first vertex, four, and a repeated last one');
  near(vertex(out, FLOATS, first), [48, 0, 2, 1, 0.5, 0.25, 0.1, 1], 'the join repeats the new line\'s first vertex');
  near(vertex(out, FLOATS, first + 1), vertex(out, FLOATS, first), 'and then draws from it');
  near(vertex(out, FLOATS, first + 2), [52, 0, -2, 1, 0.5, 0.25, 0.1, 1], 'its other side');
});

test('a bend takes the normal of the two segments around the point', () => {
  const { SkyGL, FLOATS } = layer();
  const out = new Float32Array(32 * FLOATS);
  // A right angle at (10, 0): +x, then +y. The middle normal bisects the two.
  SkyGL.strip(out, 0, [0, 0, 10, 0, 10, 10], 3, 1, 1, Math.SQRT2, flat);
  near(vertex(out, FLOATS, 2).slice(0, 3), [9, 1, Math.SQRT2], 'the corner, one side');
  near(vertex(out, FLOATS, 3).slice(0, 3), [11, -1, -Math.SQRT2], 'the corner, other side');
});

test('a cap pushes both ends out along the line', () => {
  const { SkyGL, FLOATS } = layer();
  const out = new Float32Array(32 * FLOATS);
  SkyGL.strip(out, 0, [0, 0, 10, 0], 2, 1, 1, 1, flat, 0.5);
  near(vertex(out, FLOATS, 0).slice(0, 2), [-0.5, 1], 'the start moves back');
  near(vertex(out, FLOATS, 3).slice(0, 2), [10.5, -1], 'the end moves on');
});

test('a turn is a rotation about a point, in the column order the shader reads', () => {
  const { SkyGL } = layer();
  const m = SkyGL.turn(Math.PI / 2, 100, 50);
  const apply = ([x, y]) => [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]];
  near(apply([100, 50]), [100, 50], 'the centre holds still');
  // A quarter turn clockwise on a y-down screen: right of the centre goes below it.
  near(apply([110, 50]), [100, 60], 'a point to the right');
  near(apply([100, 60]), [90, 50], 'a point below');
  assert.equal(m[8], 1);
});

test('the room a strip needs is two vertices a point and two for its joins', () => {
  const { SkyGL } = layer();
  assert.equal(SkyGL.room([3, 57, 40]), (3 + 57 + 40) * 2 + 6);
});

/* ── The engine and the layer ──────────────────────────────────────── */

function recorder() {
  const calls = [];
  const gradient = () => ({ stops: [], addColorStop(offset, colour) { this.stops.push([offset, colour]); } });
  const target = { calls };
  const ctx = new Proxy(target, {
    get: (object, key) => {
      if (key in object) return object[key];
      if (/^create(Linear|Radial|Conic)Gradient$/.test(String(key))) return () => gradient();
      if (key === 'getTransform') return () => ({ a: 1 });
      return (...args) => { calls.push([key, ...args]); };
    },
    set: (object, key, value) => { object[key] = value; return true; }
  });
  return ctx;
}

function engineWith({ gl = 'fake' } = {}) {
  const screen = recorder();
  const canvas = { getContext: () => screen, style: {}, width: 0, height: 0 };
  const noop = () => {};
  const context = vm.createContext({
    window: {
      addEventListener: noop, dispatchEvent: noop, matchMedia: () => ({ matches: false, addEventListener: noop }),
      devicePixelRatio: 1.5, innerWidth: 1200, innerHeight: 800
    },
    document: {
      hidden: false, addEventListener: noop, getElementById: () => canvas,
      documentElement: { classList: { contains: () => false }, style: { setProperty: noop, removeProperty: noop } }
    },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1, cancelAnimationFrame: noop, setTimeout: () => 1, clearTimeout: noop,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    CustomEvent: class { constructor(type) { this.type = type; } },
    Path2D: class { moveTo() {} lineTo() {} }
  });
  const sources = gl ? [readFileSync('src/js/sky-gl.js', 'utf8')] : [];
  vm.runInContext(`${sources.join('\n')}\n${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;${gl ? ' this.SkyGL = NordlysSkyGL;' : ''}`, context);
  const layers = [];
  if (gl === 'fake') {
    const FLOATS = vm.runInContext('NORDLYS_GL_FLOATS', context);
    context.SkyGL.create = () => {
      const fake = {
        lost: false, released: false, frames: [], builds: [], kept: new Map(),
        begin(width, height) { this.frames.push({ width, height, draws: [], painted: null }); },
        stream(data, count) { return { data: Float32Array.from(data.subarray(0, count * FLOATS)), count }; },
        layer(key, version, build) {
          const held = this.kept.get(key);
          if (held && held.version === version) return held;
          const { data, count } = build();
          const entry = { data: Float32Array.from(data.subarray(0, count * FLOATS)), count, version };
          this.builds.push(key);
          this.kept.set(key, entry);
          return entry;
        },
        strips(source, options) { this.frames.at(-1).draws.push({ source, options }); },
        paint(ctx, op) { this.frames.at(-1).painted = { screen: ctx === screen, op }; },
        release() { this.released = true; }
      };
      layers.push(fake);
      return fake;
    };
  } else if (gl === 'none') {
    context.SkyGL.create = () => null;
  }
  const engine = new context.Engine();
  engine.setMode('silk');
  engine.stop();
  return { engine, screen, layers, context };
}

const strokes = ctx => ctx.calls.filter(([name]) => name === 'stroke').length;

test('on the screen, Silk hands its threads to the GPU layer and strokes nothing', () => {
  const { engine, screen, layers } = engineWith();
  screen.calls.length = 0;
  engine.render(1);
  assert.equal(layers.length, 1, 'one layer, made when Silk first paints');
  const frame = layers[0].frames.at(-1);
  assert.deepEqual([frame.width, frame.height], [engine.canvas.width, engine.canvas.height], 'the layer is the canvas, pixel for pixel');
  assert.equal(frame.draws.length, 1, 'every thread in one draw');
  const { source, options } = frame.draws[0];
  const points = engine.silk.reduce((sum, thread) => sum + thread.steps + 1, 0);
  assert.equal(source.count, points * 2 + engine.silk.length * 2 - 1, 'two vertices a point, joined into one strip');
  // Silk's own three passes, wide and faint first, become the strip's bands.
  assert.deepEqual(JSON.parse(JSON.stringify(options.bands)), [[6, 0.22], [2.4, 0.5], [1, 1]]);
  assert.equal(options.blend, 'screen');
  assert.equal(options.ink, engine.ink);
  assert.deepEqual(frame.painted, { screen: true, op: 'source-over' }, 'laid onto the screen canvas');
  assert.equal(strokes(screen), 0, 'no thread is stroked on the 2D canvas');
  // The sheen and the depth are still the canvas's own fills.
  assert.ok(screen.calls.filter(([name]) => name === 'fillRect').length >= 2);
});

test('the strip carries the thread\'s gradient: dark at both ends, lit between', () => {
  const { engine, layers, context } = engineWith();
  engine.render(1);
  const FLOATS = vm.runInContext('NORDLYS_GL_FLOATS', context);
  const { data } = layers[0].frames.at(-1).draws[0].source;
  const thread = engine.silk[0];
  const alphaAt = index => data[index * FLOATS + 6];
  const last = thread.steps;
  assert.ok(alphaAt(0) < 1e-6, 'the thread arrives out of the dark');
  assert.ok(alphaAt(last * 2) < 0.02 * thread.alpha, 'and leaves into it');
  const middle = Math.max(...Array.from({ length: last + 1 }, (_, i) => alphaAt(i * 2)));
  assert.ok(Math.abs(middle - thread.alpha) < 0.12 * thread.alpha, `its brightest is its own alpha (${middle} vs ${thread.alpha})`);
  // Its core is its own width, in device pixels.
  assert.ok(Math.abs(data[7] - thread.width * engine.dpr) < 1e-5);
});

test('a still of Silk is stroked in 2D, three passes a thread, and never asks for the layer', () => {
  const { engine, layers } = engineWith();
  const own = recorder();
  const still = { getContext: () => own, clientWidth: 90, clientHeight: 60, width: 0, height: 0 };
  engine.paintStill(still, 'silk', { width: 90, height: 60, dpr: 1 });
  assert.equal(layers.length, 0, 'a thumbnail is small enough for the 2D canvas');
  assert.ok(strokes(own) > 0 && strokes(own) % 3 === 0, `${strokes(own)} strokes`);
});

test('the quiet-zone sample is painted in 2D even while the screen uses the layer', () => {
  const { engine, layers } = engineWith();
  const scratch = recorder();
  scratch.getImageData = () => ({ data: new Uint8ClampedArray(96 * 64 * 4) });
  const main = engine.ctx;
  engine.ctx = scratch;
  engine.solvingQuiet = true;
  try { engine.render(0); } finally { engine.ctx = main; engine.solvingQuiet = false; }
  assert.equal(layers.length, 0);
  assert.equal(strokes(scratch), engine.silk.length * 3);
});

test('without WebGL2 the screen strokes the threads in 2D, as it always did', () => {
  const { engine, screen } = engineWith({ gl: 'none' });
  screen.calls.length = 0;
  engine.render(1);
  assert.equal(strokes(screen), engine.silk.length * 3);
});

test('without the layer script at all the engine still paints Silk', () => {
  const { engine, screen } = engineWith({ gl: null });
  screen.calls.length = 0;
  engine.render(1);
  assert.equal(strokes(screen), engine.silk.length * 3);
});

test('a lost context sends the screen back to 2D until the scene is chosen again', () => {
  const { engine, screen, layers } = engineWith();
  engine.render(1);
  layers[0].lost = true;
  screen.calls.length = 0;
  engine.render(1);
  assert.equal(strokes(screen), engine.silk.length * 3, 'lost: the frame is drawn in 2D');
  engine.setMode('halo');
  engine.setMode('silk');
  engine.stop();
  engine.render(1);
  assert.equal(layers.length, 2, 'choosing the scene again makes a new layer');
});

test('leaving for a scene that draws no long lines lets the layer go', () => {
  const { engine, layers } = engineWith();
  engine.render(1);
  engine.setMode('halo');
  assert.equal(layers[0].released, true);
});

/* Polaris's arcs never change shape: the sky only turns. The field is built
   once and turned by a matrix, frame after frame. */
test('Polaris builds its field of arcs once and turns it every frame', () => {
  const { engine, screen, layers } = engineWith();
  engine.setMode('polaris');
  engine.stop();
  engine.render(1);
  engine.render(1);
  engine.render(1);
  const layer = layers.at(-1);
  assert.deepEqual(layer.builds, ['polaris'], 'built once');
  const turns = layer.frames.slice(-3).map(frame => Array.from(frame.draws[0].options.matrix));
  assert.notDeepEqual(turns[0], turns[2], 'and turned as time passes');
  const { source } = layer.frames.at(-1).draws[0];
  assert.ok(source.count > engine.polaris.length * 10, `${source.count} vertices for ${engine.polaris.length} arcs`);
  assert.equal(strokes(screen), 0, 'no arc is stroked on the 2D canvas');
});

test('a new colour mood builds the field again, a new moment does not', () => {
  const { engine, layers } = engineWith();
  engine.setMode('polaris');
  engine.stop();
  engine.render(1);
  engine.t += 10;
  engine.render(0);
  assert.equal(layers.at(-1).builds.length, 1);
  engine.applyPalette(['#ffd166', '#f48c6b', '#b86bff']);
  engine.render(0);
  assert.equal(layers.at(-1).builds.length, 2);
});

/* Contour stroked a dozen full-window paths a frame, which the 2D canvas
   rasterises on the CPU as it did Silk's threads: it held twenty-six frames a
   second, not thirty. Its lines go to the GPU layer too, merged where two
   pieces of one line meet rather than brightened. */
test('on the screen, Contour draws its lines on the GPU layer, merged where they meet', () => {
  const { engine, screen, layers } = engineWith();
  engine.setMode('drift');
  engine.stop();
  screen.calls.length = 0;
  engine.render(1);
  const frame = layers.at(-1).frames.at(-1);
  assert.equal(frame.draws.length, 1);
  assert.equal(frame.draws[0].options.blend, 'max');
  assert.ok(frame.draws[0].source.count > 1000, `${frame.draws[0].source.count} vertices`);
  assert.deepEqual(frame.painted, { screen: true, op: 'screen' }, 'laid over the summits\' light the way the lines were');
  assert.equal(strokes(screen), 0);
});

test('Contour builds its lines again only when the ground has moved', () => {
  const { engine, layers } = engineWith();
  engine.setMode('drift');
  engine.stop();
  engine.render(0);
  engine.render(0);
  assert.equal(layers.at(-1).builds.length, 1, 'the same ground, the same lines');
  engine.t += 0.2;
  engine.render(0);
  assert.equal(layers.at(-1).builds.length, 2, 'the ground moved');
});

test('a still of Contour strokes its levels in 2D', () => {
  const { engine, layers } = engineWith();
  engine.setMode('drift');
  engine.stop();
  const own = recorder();
  const still = { getContext: () => own, clientWidth: 90, clientHeight: 60, width: 0, height: 0 };
  engine.paintStill(still, 'drift', { width: 90, height: 60, dpr: 1 });
  assert.equal(layers.length, 0);
  assert.ok(strokes(own) > 5, `${strokes(own)} levels`);
});

/* The quiet zones are solved on a sample about ninety pixels across, where a
   one-pixel trail comes out a fifteenth of a pixel wide and all but vanishes:
   the contrast sweep found a bright trail across "Good night" that the solver
   never saw. In the sample every trail is at least a sample pixel wide, so a
   bright one behind the words is seen at its own brightness. */
test('in the quiet-zone sample every Polaris trail is at least a sample pixel wide', () => {
  const { engine } = engineWith({ gl: 'none' });
  engine.setMode('polaris');
  engine.stop();
  const scratch = recorder();
  const scale = 96 / engine.w;
  scratch.getTransform = () => ({ a: scale });
  const widths = [];
  const own = new Proxy(scratch, {
    set: (target, key, value) => { if (key === 'lineWidth') widths.push(value); target[key] = value; return true; },
    get: (target, key) => target[key]
  });
  const main = engine.ctx;
  engine.ctx = own;
  engine.solvingQuiet = true;
  try { engine.render(0); } finally { engine.ctx = main; engine.solvingQuiet = false; }
  assert.ok(widths.length > 20, `${widths.length} trails`);
  assert.ok(Math.min(...widths) >= 1 / scale - 1e-6, `thinnest ${Math.min(...widths)} at a scale of ${scale}`);
  // And on the screen they keep their own widths.
  widths.length = 0;
  const screen = new Proxy(recorder(), {
    set: (target, key, value) => { if (key === 'lineWidth') widths.push(value); target[key] = value; return true; },
    get: (target, key) => target[key]
  });
  engine.ctx = screen;
  try { engine.render(0); } finally { engine.ctx = main; }
  assert.ok(Math.max(...widths) < 3, `widest on the screen ${Math.max(...widths)}`);
});

test('a still of Polaris strokes its arcs in 2D around the pole', () => {
  const { engine, layers } = engineWith();
  engine.setMode('polaris');
  engine.stop();
  const own = recorder();
  const still = { getContext: () => own, clientWidth: 90, clientHeight: 60, width: 0, height: 0 };
  engine.paintStill(still, 'polaris', { width: 90, height: 60, dpr: 1 });
  assert.equal(layers.length, 0);
  assert.ok(strokes(own) > 40, `${strokes(own)} arcs`);
});
