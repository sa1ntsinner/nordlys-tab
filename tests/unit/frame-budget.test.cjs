const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The sky paints at most thirty frames a second, fifteen once nobody has
   touched anything for a minute, and moves at the same pace whatever the rate.
   Driven here by a synthetic clock — vsyncs on a fixed grid, timers that fire
   when they are due (or as late as `late` says), a main thread that can stall —
   so the numbers are exact. */
function harness({ late = () => 0 } = {}) {
  let now = 0;
  let hz = 60;
  let nextId = 1;
  let frames = [];
  const timers = new Map();
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx = new Proxy({}, {
    get: (target, key) => (key in target ? target[key]
      : /^create(Linear|Radial|Conic)Gradient$/.test(String(key)) ? () => gradient : noop),
    set: (target, key, value) => { target[key] = value; return true; }
  });
  const canvas = { getContext: () => ctx, style: {}, width: 0, height: 0 };
  const listeners = {};
  const docListeners = {};
  const motion = { matches: false, listeners: [], addEventListener: (type, fn) => motion.listeners.push(fn) };
  const stats = { callbacks: 0, overlaps: 0, maxTimers: 0 };
  const watch = () => {
    stats.maxTimers = Math.max(stats.maxTimers, timers.size);
    if (timers.size && frames.length) stats.overlaps++;
  };
  const document = {
    hidden: false, addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); },
    getElementById: () => canvas,
    documentElement: { classList: { contains: () => false }, style: { setProperty: noop, removeProperty: noop } }
  };
  const context = vm.createContext({
    window: {
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
      dispatchEvent: noop, matchMedia: () => motion,
      devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900
    },
    document,
    performance: { now: () => now },
    requestAnimationFrame: fn => { const id = nextId++; frames.push({ id, fn }); watch(); return id; },
    cancelAnimationFrame: id => { frames = frames.filter(frame => frame.id !== id); },
    setTimeout: (fn, ms) => {
      const id = nextId++;
      const due = now + Math.max(0, ms);
      timers.set(id, { fn, at: due + late(due) });
      watch();
      return id;
    },
    clearTimeout: id => { timers.delete(id); },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    CustomEvent: class { constructor(type) { this.type = type; } }
  });
  vm.runInContext(`${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;`, context);
  const engine = new context.Engine();
  let paints = [];
  const render = engine.render.bind(engine);
  engine.render = dt => { paints.push(now); render(dt); };

  const nextVsync = () => {
    const period = 1000 / hz;
    return (Math.floor(now / period + 1e-7) + 1) * period;
  };
  // Everything due before `ms` from now happens, in order.
  const advance = ms => {
    const end = now + ms;
    for (;;) {
      let timer = null;
      for (const [id, entry] of timers) if (!timer || entry.at < timer[1].at) timer = [id, entry];
      const timerAt = timer ? Math.max(timer[1].at, now) : Infinity;
      const vsyncAt = frames.length ? nextVsync() : Infinity;
      const at = Math.min(timerAt, vsyncAt);
      if (at > end) break;
      now = at;
      if (timerAt <= vsyncAt) {
        timers.delete(timer[0]);
        timer[1].fn();
      } else {
        const batch = frames;
        frames = [];
        stats.callbacks += batch.length;
        batch.forEach(frame => frame.fn(now));
      }
    }
    now = end;
  };
  return {
    engine, stats, motion,
    get now() { return now; },
    get paints() { return paints; },
    pending: () => ({ frames: frames.length, timers: timers.size }),
    touch: () => listeners.pointerdown?.forEach(fn => fn()),
    setHidden(hidden) {
      document.hidden = hidden;
      docListeners.visibilitychange?.forEach(fn => fn());
    },
    // Run the panel at `hz` for `seconds`.
    run(rate, seconds) {
      hz = rate;
      const start = engine.t;
      paints = [];
      stats.callbacks = 0;
      advance(seconds * 1000);
      return { renders: paints.length, advanced: engine.t - start, callbacks: stats.callbacks };
    },
    advance,
    // The main thread is busy: time passes and nothing runs.
    skip: ms => { now += ms; }
  };
}

const period = hz => 1000 / hz;
const gaps = times => times.slice(1).map((time, i) => time - times[i]);

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

/* The budget used to be waited out with a vsync callback every refresh, three
   empty ones in four at 120 Hz, seven in eight when idle. A timer now sleeps
   through them, so each paint costs about one callback at any panel rate —
   and lands on exactly the vsync it did before. */
for (const hz of [60, 120, 144, 240]) {
  test(`at ${hz} Hz the page is woken about once per paint, on the same vsyncs`, () => {
    const sky = harness();
    sky.engine.start();
    sky.run(hz, 1);
    const { renders, callbacks } = sky.run(hz, 3);
    assert.ok(renders >= 87 && renders <= 92, `renders ${renders}`);
    assert.ok(callbacks / renders <= 1.2, `${callbacks} callbacks for ${renders} paints`);
    // Each paint on the first vsync the budget allows, never one later.
    const refresh = period(hz);
    const onTime = Math.ceil((1000 / 30 - 2) / refresh - 1e-7) * refresh;
    for (const gap of gaps(sky.paints)) assert.ok(Math.abs(gap - onTime) < 0.01, `gap ${gap} at ${hz} Hz, expected ${onTime}`);
    assert.equal(sky.stats.maxTimers, 1);
    assert.equal(sky.stats.overlaps, 0, 'a timer and a vsync request are never pending together');
  });
}

test('at the idle rate a 120 Hz panel is woken about once per paint too', () => {
  const sky = harness();
  sky.engine.start();
  sky.skip(61000);
  sky.run(120, 1);
  const { renders, callbacks } = sky.run(120, 4);
  assert.ok(renders >= 58 && renders <= 62, `idle renders ${renders}`);
  assert.ok(callbacks / renders <= 1.2, `${callbacks} callbacks for ${renders} paints`);
});

/* Windows rounds a timer up to its 15.6 ms tick when it has not been asked for
   finer ones. The lead grows by however late the timers have been, so the
   paints keep their vsyncs; the price is a few empty callbacks, still fewer
   than a callback every refresh. */
test('timers that wake late on a coarse clock do not cost paints', () => {
  const tick = 15.625;
  const sky = harness({ late: due => Math.ceil(due / tick) * tick - due });
  sky.engine.start();
  sky.run(120, 1);
  const { renders, callbacks } = sky.run(120, 4);
  const onTime = gaps(sky.paints).filter(gap => gap < 1000 / 30 - 2 + period(120) - 0.01).length;
  assert.ok(renders >= 116, `renders ${renders}`);
  assert.ok(onTime / (renders - 1) >= 0.95, `${onTime} of ${renders - 1} paints on time`);
  assert.ok(callbacks / renders < 3, `${callbacks} callbacks for ${renders} paints`);
});

test('pausing leaves nothing scheduled, and resuming picks up without a burst', () => {
  const sky = harness();
  sky.engine.start();
  sky.run(120, 1);
  sky.engine.pause();
  assert.equal(sky.engine.animId, null);
  assert.deepEqual(sky.pending(), { frames: 0, timers: 0 });
  assert.equal(sky.run(120, 1).renders, 0);
  sky.engine.resume();
  assert.ok(sky.engine.animId !== null);
  const { renders } = sky.run(120, 2);
  assert.ok(renders >= 58 && renders <= 60, `renders ${renders}`);
  for (const gap of gaps(sky.paints)) assert.ok(gap >= 1000 / 30 - 2, `gap ${gap}`);
});

test('a hidden page has no timer running, and a visible one paints again', () => {
  const sky = harness();
  sky.engine.start();
  sky.run(120, 1);
  sky.setHidden(true);
  assert.deepEqual(sky.pending(), { frames: 0, timers: 0 });
  assert.equal(sky.run(120, 2).renders, 0);
  sky.setHidden(false);
  const { renders } = sky.run(120, 2);
  assert.ok(renders >= 58 && renders <= 60, `renders ${renders}`);
});

test('a long stall is one late frame, not a catch-up burst', () => {
  const sky = harness();
  sky.engine.start();
  sky.run(120, 1);
  const before = sky.engine.t;
  sky.skip(500);
  sky.run(120, 1);
  const [first, ...rest] = gaps(sky.paints);
  assert.ok(first >= 1000 / 30 - 2, `first gap ${first}`);
  for (const gap of rest) assert.ok(gap >= 1000 / 30 - 2, `gap ${gap}`);
  // The first frame after the stall advances at most six 60fps frames.
  assert.ok(sky.paints.length <= 31, `paints ${sky.paints.length}`);
  assert.ok(sky.engine.t - before < 0.005 * (6 + 31 * 2.1), `advanced ${sky.engine.t - before}`);
});

/* Idle, the next paint is up to 66 ms away and a timer is sleeping towards it.
   Someone touching the page brings the thirty-a-second budget back at once,
   exactly as the per-vsync check did, rather than after the idle wait. */
test('input while idle wakes the sleeping frame for the sooner budget', () => {
  const sky = harness();
  sky.engine.start();
  sky.skip(61000);
  sky.run(120, 1);
  const last = sky.paints.at(-1);
  sky.advance(last + 5 - sky.now);
  assert.ok(sky.pending().timers === 1, 'the idle frame is asleep on a timer');
  sky.touch();
  assert.ok(sky.pending().timers + sky.pending().frames === 1, 'one frame source, not two');
  sky.advance(80);
  const next = sky.paints.find(time => time > last);
  assert.ok(next - last <= 1000 / 30 - 2 + period(120) + 0.01, `next paint after ${next - last} ms`);
});

test('reduced motion parks the loop with nothing scheduled, and lifting it resumes', () => {
  const sky = harness();
  sky.engine.start();
  sky.run(120, 1);
  sky.motion.matches = true;
  sky.motion.listeners.forEach(fn => fn({ matches: true }));
  sky.run(120, 0.2);
  assert.equal(sky.engine.animId, null);
  assert.deepEqual(sky.pending(), { frames: 0, timers: 0 });
  assert.equal(sky.run(120, 1).renders, 0);
  sky.motion.matches = false;
  sky.motion.listeners.forEach(fn => fn({ matches: false }));
  const { renders } = sky.run(120, 1);
  assert.ok(renders >= 28 && renders <= 30, `renders ${renders}`);
});

test('a parked scene repaints at once; a moving one keeps its single queued frame', () => {
  const sky = harness();
  sky.engine.start();
  sky.run(120, 1);
  sky.engine.setAtmosphere({ motion: 0 });
  sky.run(120, 0.2);
  assert.equal(sky.engine.animId, null);
  const held = sky.paints.length;
  sky.engine.resize();
  sky.engine.repaint();
  assert.equal(sky.paints.length, held + 2, 'resize and repaint paint the held frame straight away');

  sky.engine.setAtmosphere({ motion: 1 });
  sky.run(120, 0.5);
  const queued = sky.pending();
  sky.engine.resize();
  sky.engine.repaint();
  assert.deepEqual(sky.pending(), queued, 'invalidating a moving scene adds no second frame');
  const { renders } = sky.run(120, 1);
  assert.ok(renders >= 28 && renders <= 30, `renders ${renders}`);
  assert.equal(sky.stats.overlaps, 0);
  assert.equal(sky.stats.maxTimers, 1);
});
