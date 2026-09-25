const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* What each scene asks of the screen canvas in one frame. Chrome's 2D canvas
   rasterises a thick antialiased stroke's whole bounding box on the CPU, in
   the GPU process (sky-gl.js says how much that cost Silk): a line wider than
   a device pixel may be stroked across a small box, never across the window.
   Long lines belong to the GPU layer; hairlines, circles and fills are drawn
   by the GPU as they are. And a frame is a few hundred calls at most — every
   one is recorded, sent to the GPU process and replayed there.

   The context here keeps the transform and the bounds of the path being
   built, which is all these two rules need. */
const MAX_CALLS = 700;
const THICK = 1.25;         // device pixels: wider than this is not a hairline
const MAX_BOX = 512 * 512;  // device pixels: a stroke's bounding box, beyond which the CPU pays for it

function surveyor() {
  const log = { strokes: [], draws: 0 };
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const state = { lineWidth: 1 };
  let box = null;
  let circle = false;
  const apply = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const add = (x, y) => {
    const [X, Y] = apply(x, y);
    if (!box) box = { x0: X, y0: Y, x1: X, y1: Y };
    else { box.x0 = Math.min(box.x0, X); box.y0 = Math.min(box.y0, Y); box.x1 = Math.max(box.x1, X); box.y1 = Math.max(box.y1, Y); }
  };
  const disc = (cx, cy, rx, ry, from, to, rotation = 0) => {
    // A whole circle alone in its path is drawn by the GPU's own oval renderer.
    const whole = Math.abs(to - from) >= Math.PI * 2 - 1e-6;
    circle = whole && !box;
    const [a, b] = whole ? [0, Math.PI * 2] : [from, to];
    for (let i = 0; i <= 32; i++) {
      const t = a + ((b - a) * i) / 32;
      const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
      add(cx + x * Math.cos(rotation) - y * Math.sin(rotation), cy + x * Math.sin(rotation) + y * Math.cos(rotation));
    }
  };
  const scale = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const gradient = () => ({ addColorStop() {} });
  const own = {
    save() { stack.push([m.slice(), { ...state }]); },
    restore() { const top = stack.pop(); if (top) { m = top[0]; Object.assign(state, top[1]); } },
    setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f]; },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    getTransform() { return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; },
    transform(a, b, c, d, e, f) { m = multiply(m, [a, b, c, d, e, f]); },
    translate(x, y) { m = multiply(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = multiply(m, [x, 0, 0, y, 0, 0]); },
    rotate(a) { m = multiply(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    beginPath() { box = null; circle = false; },
    moveTo(x, y) { circle = false; add(x, y); },
    lineTo(x, y) { circle = false; add(x, y); },
    quadraticCurveTo(a, b, x, y) { circle = false; add(a, b); add(x, y); },
    bezierCurveTo(a, b, c, d, x, y) { circle = false; add(a, b); add(c, d); add(x, y); },
    arc(x, y, r, from, to, anticlockwise) { disc(x, y, r, r, anticlockwise ? to : from, anticlockwise ? from : to); },
    ellipse(x, y, rx, ry, rotation, from, to, anticlockwise) { disc(x, y, rx, ry, anticlockwise ? to : from, anticlockwise ? from : to, rotation); },
    rect(x, y, w, h) { circle = false; add(x, y); add(x + w, y + h); },
    closePath() {},
    clip() {},
    stroke(path) {
      log.draws++;
      const shape = path ? path.shape(apply) : { box, circle };
      if (!shape.box) return;
      log.strokes.push({ width: state.lineWidth * scale(), area: (shape.box.x1 - shape.box.x0) * (shape.box.y1 - shape.box.y0), circle: shape.circle });
    },
    fill() { log.draws++; },
    fillRect() { log.draws++; },
    strokeRect() { log.draws++; },
    fillText() { log.draws++; },
    drawImage() { log.draws++; },
    clearRect() {},
    createLinearGradient: gradient, createRadialGradient: gradient, createConicGradient: gradient,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}
  };
  const ctx = new Proxy(own, {
    get: (target, key) => key in target ? target[key] : state[key],
    set: (target, key, value) => { state[key] = value; return true; }
  });
  return { ctx, log };
}

// Path2D as the canvas has it, keeping only the points it passes through.
class RecordedPath {
  constructor() { this.points = []; }
  moveTo(x, y) { this.points.push([x, y]); }
  lineTo(x, y) { this.points.push([x, y]); }
  shape(apply) {
    if (!this.points.length) return { box: null };
    const all = this.points.map(([x, y]) => apply(x, y));
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    return { box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }, circle: false };
  }
}

function engineOn(size = [1600, 900], dpr = 1.5) {
  const { ctx, log } = surveyor();
  const canvas = { getContext: () => ctx, style: {}, width: 0, height: 0 };
  const noop = () => {};
  const context = vm.createContext({
    window: {
      addEventListener: noop, dispatchEvent: noop, matchMedia: () => ({ matches: false, addEventListener: noop }),
      devicePixelRatio: dpr, innerWidth: size[0], innerHeight: size[1]
    },
    document: {
      hidden: false, addEventListener: noop, getElementById: () => canvas, createElement: () => ({ getContext: () => surveyor().ctx, width: 0, height: 0 }),
      documentElement: { classList: { contains: () => false }, style: { setProperty: noop, removeProperty: noop } }
    },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1, cancelAnimationFrame: noop, setTimeout: () => 1, clearTimeout: noop,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    CustomEvent: class { constructor(type) { this.type = type; } },
    Path2D: RecordedPath
  });
  // The GPU layer's script is loaded, but there is no WebGL2 here: every scene
  // shows what it would ask of the 2D canvas on a machine without one, except
  // those that hand their long lines to the layer, which say so in its place.
  vm.runInContext(`${readFileSync('src/js/sky-gl.js', 'utf8')}\n${readFileSync('src/js/background.js', 'utf8')}
    this.Engine = NordlysBackgroundEngine; this.SCENES = [...NORDLYS_GENERATIVE_SCENES]; this.SkyGL = NordlysSkyGL;`, context);
  return { context, log };
}

function frameOf(scene, { gl = true } = {}) {
  const { context, log } = engineOn();
  // A layer that draws nothing: the frame's 2D calls are what is measured.
  if (gl) context.SkyGL.create = () => ({ lost: false, begin() {}, stream: (data, count) => ({ count }), layer: (key, version, build) => ({ count: build().count }), strips() {}, paint() {}, release() {} });
  else context.SkyGL.create = () => null;
  const engine = new context.Engine();
  engine.setMode(scene);
  engine.stop();
  // Two frames: the first may build what the rest reuse.
  engine.render(1);
  log.strokes.length = 0;
  log.draws = 0;
  engine.render(1);
  return log;
}

test('the scenes on offer are the ones the gallery shows', () => {
  const { context } = engineOn();
  assert.deepEqual(Array.from(context.SCENES), ['aurora', 'polaris', 'halo', 'pillars', 'nacre', 'silk', 'baikal', 'drift', 'horizon']);
});

for (const scene of ['aurora', 'polaris', 'halo', 'pillars', 'nacre', 'silk', 'baikal', 'drift', 'horizon']) {
  test(`${scene} strokes no thick line across the window on the screen canvas`, () => {
    const log = frameOf(scene);
    const heavy = log.strokes.filter(s => s.width > THICK && s.area > MAX_BOX && !s.circle);
    assert.equal(heavy.length, 0, `${heavy.length} strokes, e.g. ${JSON.stringify(heavy[0])}`);
  });

  test(`${scene} paints a frame in at most ${MAX_CALLS} calls`, () => {
    const log = frameOf(scene);
    assert.ok(log.draws > 0, 'it paints something');
    assert.ok(log.draws <= MAX_CALLS, `${log.draws} calls`);
  });
}
