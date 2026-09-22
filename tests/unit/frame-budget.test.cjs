const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The sky paints at most thirty frames a second, fifteen once nobody has
   touched anything for a minute, and moves at the same pace whatever the rate.
   Driven here by synthetic vsyncs, so the numbers are exact. */
function harness() {
  let now = 0;
  let pending = null;
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx = new Proxy({}, {
    get: (target, key) => (key in target ? target[key]
      : /^create(Linear|Radial|Conic)Gradient$/.test(String(key)) ? () => gradient : noop),
    set: (target, key, value) => { target[key] = value; return true; }
  });
  const canvas = { getContext: () => ctx, style: {}, width: 0, height: 0 };
  const listeners = {};
  const context = vm.createContext({
    window: {
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
      dispatchEvent: noop, matchMedia: () => ({ matches: false, addEventListener: noop }),
      devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900
    },
    document: {
      hidden: false, addEventListener: noop, getElementById: () => canvas,
      documentElement: { classList: { contains: () => false }, style: { setProperty: noop, removeProperty: noop } }
    },
    performance: { now: () => now },
    requestAnimationFrame: fn => { pending = fn; return 1; },
    cancelAnimationFrame: () => { pending = null; },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    CustomEvent: class { constructor(type) { this.type = type; } }
  });
  vm.runInContext(`${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;`, context);
  const engine = new context.Engine();
  let renders = 0;
  const render = engine.render.bind(engine);
  engine.render = dt => { renders++; render(dt); };
  return {
    engine,
    touch: () => listeners.pointerdown?.forEach(fn => fn()),
    // Run the panel at `hz` for `seconds`, starting `at` ms into the session.
    run(hz, seconds) {
      const start = engine.t;
      renders = 0;
      const step = 1000 / hz;
      const frames = Math.round(seconds * hz);
      for (let i = 0; i < frames; i++) {
        now += step;
        const fn = pending;
        pending = null;
        fn?.(now);
      }
      return { renders, advanced: engine.t - start };
    },
    skip: ms => { now += ms; }
  };
}

test('a 60 Hz panel is painted thirty times a second', () => {
  const sky = harness();
  sky.engine.start();
  sky.run(60, 1);
  const { renders } = sky.run(60, 2);
  assert.ok(renders >= 58 && renders <= 62, `renders ${renders}`);
});

test('a 144 Hz panel is not painted any more often', () => {
  const sky = harness();
  sky.engine.start();
  sky.run(144, 1);
  const { renders } = sky.run(144, 2);
  assert.ok(renders >= 54 && renders <= 62, `renders ${renders}`);
});

test('the sky moves at the same pace at 60 Hz, 144 Hz and when idle', () => {
  const a = harness(); a.engine.start(); a.run(60, 1);
  const b = harness(); b.engine.start(); b.run(144, 1);
  const c = harness(); c.engine.start(); c.skip(61000); c.run(60, 1);
  const pace = [a.run(60, 4).advanced, b.run(144, 4).advanced, c.run(60, 4).advanced];
  for (const value of pace) assert.ok(Math.abs(value - pace[0]) < pace[0] * 0.04, `pace ${pace}`);
  // 0.005 per 60fps-frame, four seconds: 1.2 units.
  assert.ok(Math.abs(pace[0] - 1.2) < 0.06, `pace ${pace[0]}`);
});

test('after a minute without input it paints at the idle rate, and input restores it', () => {
  const sky = harness();
  sky.engine.start();
  sky.skip(61000);
  const idle = sky.run(60, 2).renders;
  assert.ok(idle >= 28 && idle <= 32, `idle renders ${idle}`);
  sky.touch();
  const awake = sky.run(60, 2).renders;
  assert.ok(awake >= 58, `awake renders ${awake}`);
});
