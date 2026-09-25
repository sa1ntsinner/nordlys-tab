const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { SCENES, planSamples, splitSilk } = require('../../tools/perf/newtab.cjs');

/* The perf probe (tools/perf/newtab.cjs) takes Silk apart by wrapping the
   engine's own renderSilk, and it can only do that while renderSilk draws the
   way the probe assumes: one stroke per pass per thread, the core last, the
   sheen and the depth as one fillRect each under their own composite
   operation, and the field walked through silkAngle. These tests run the real
   renderSilk from background.js against a context that records every call, so
   a change to Silk that would make the probe measure the wrong thing fails
   here instead of in a benchmark nobody questions. */
class RecordingContext {
  constructor() {
    Object.assign(this, { calls: [], globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1 });
  }
  save() {} restore() {} beginPath() {}
  moveTo(x, y) { this.calls.push(['moveTo', x, y]); }
  lineTo(x, y) { this.calls.push(['lineTo', x, y]); }
  stroke() { this.calls.push(['stroke', this.lineWidth, this.globalAlpha]); }
  fillRect() { this.calls.push(['fillRect', this.globalCompositeOperation]); }
  createLinearGradient() { return { addColorStop() {} }; }
}

function silk() {
  const context = vm.createContext({ window: {}, document: { documentElement: { classList: { contains: () => false } } } });
  vm.runInContext(`${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;`, context);
  const passes = vm.runInContext('NORDLYS_SILK_PASSES', context);
  const scenes = vm.runInContext('[...NORDLYS_GENERATIVE_SCENES]', context);
  const engine = Object.create(context.Engine.prototype);
  Object.assign(engine, { w: 1440, h: 900, t: 31.7, ink: 1, ctx: new RecordingContext(),
    paletteRgb: [[53, 214, 192], [91, 108, 255], [157, 78, 221]] });
  engine.rng = context.Engine.stream(7);
  engine.initSilk();
  engine.rng = null;
  return { engine, passes, scenes };
}

const count = (ctx, name) => ctx.calls.filter(call => call[0] === name).length;
const path = ctx => ctx.calls.filter(call => call[0] === 'moveTo' || call[0] === 'lineTo');

test('the probe offers exactly the scenes the engine draws', () => {
  assert.deepEqual([...SCENES].sort(), [...silk().scenes].sort());
});

test('renderSilk still draws the way the probe splits it', () => {
  const { engine, passes } = silk();
  engine.renderSilk();
  const threads = engine.silk.length;
  assert.equal(count(engine.ctx, 'stroke'), threads * passes.length);
  // The core, the one pass `bloom` keeps, is the last and the narrowest.
  const widths = passes.map(pass => pass.width);
  assert.equal(Math.min(...widths), widths.at(-1));
  assert.deepEqual(engine.ctx.calls.filter(call => call[0] === 'fillRect').map(call => call[1]), ['source-atop', 'destination-over']);
});

test('bloom keeps one core stroke per thread and nothing else', () => {
  const { engine, passes } = silk();
  splitSilk(engine, ['bloom'], passes.length);
  engine.renderSilk();
  const threads = engine.silk.length;
  const strokes = engine.ctx.calls.filter(call => call[0] === 'stroke');
  assert.equal(strokes.length, threads);
  strokes.forEach(([, width], i) => assert.equal(width, engine.silk[i].width * passes.at(-1).width));
  assert.deepEqual({ ...engine.__perfSilkSplit, skipped: { ...engine.__perfSilkSplit.skipped } },
    { renders: 1, strokesDrawn: threads, skipped: { bloom: threads * (passes.length - 1) } });
});

test('strokes, sheen and depth each drop only their own calls', () => {
  const { engine, passes } = silk();
  splitSilk(engine, ['strokes', 'sheen', 'depth'], passes.length);
  engine.renderSilk();
  assert.equal(count(engine.ctx, 'stroke'), 0);
  assert.equal(count(engine.ctx, 'fillRect'), 0);
  // The walk still runs: every thread is still traced.
  assert.equal(path(engine.ctx).length, engine.silk.reduce((sum, thread) => sum + thread.steps + 1, 0));
  assert.deepEqual({ ...engine.__perfSilkSplit.skipped }, { strokes: engine.silk.length * passes.length, sheen: 1, depth: 1 });
});

test('field freezes the walk at its first frame and draws everything else', () => {
  const live = silk();
  live.engine.renderSilk();
  const before = path(live.engine.ctx);
  live.engine.ctx = new RecordingContext();
  live.engine.t += 5;
  live.engine.renderSilk();
  assert.notDeepEqual(path(live.engine.ctx), before, 'the field moves with t');

  const { engine, passes } = silk();
  splitSilk(engine, ['field'], passes.length);
  engine.renderSilk();
  const first = path(engine.ctx);
  assert.deepEqual(first, before);
  engine.ctx = new RecordingContext();
  engine.t += 5;
  engine.renderSilk();
  assert.deepEqual(path(engine.ctx), first);
  assert.equal(count(engine.ctx, 'stroke'), engine.silk.length * passes.length);
  assert.equal(count(engine.ctx, 'fillRect'), 2);
  assert.equal(engine.__perfSilkSplit.skipped.field, engine.silk.reduce((sum, thread) => sum + thread.steps, 0));
});

test('the split follows whichever context renderSilk paints, and leaves each as it was', () => {
  const { engine, passes } = silk();
  splitSilk(engine, ['sheen'], passes.length);
  const screen = engine.ctx;
  const sample = new RecordingContext();
  engine.ctx = sample; // as solveQuiet does for the quiet-zone sample
  engine.renderSilk();
  engine.ctx = screen;
  engine.renderSilk();
  for (const ctx of [screen, sample]) {
    assert.deepEqual(ctx.calls.filter(call => call[0] === 'fillRect').map(call => call[1]), ['destination-over']);
    assert.equal(Object.hasOwn(ctx, 'stroke') || Object.hasOwn(ctx, 'fillRect'), false);
  }
});

test('a pass list the split does not recognise fails loudly', () => {
  const { engine } = silk();
  assert.throws(() => splitSilk(engine, ['bloom'], 1), /NORDLYS_SILK_PASSES/);
  assert.throws(() => splitSilk(engine, ['sheen'], null), /NORDLYS_SILK_PASSES/);
});

test('without --scene the first sample is still aurora, and --only aurora still keeps it', () => {
  assert.deepEqual(planSamples({}), { label: 'aurora', sceneOnly: false });
  assert.deepEqual(planSamples({ only: 'aurora' }), { label: 'aurora', sceneOnly: true });
  assert.deepEqual(planSamples({ only: 'scene' }), { label: 'aurora', sceneOnly: true });
  assert.deepEqual(planSamples({ scene: 'aurora', only: 'aurora' }), { label: 'aurora', sceneOnly: true });
});

test('with --scene the sample carries the scene, and --only aurora is refused rather than mislabelled', () => {
  assert.deepEqual(planSamples({ scene: 'silk' }), { label: 'silk', sceneOnly: false });
  assert.deepEqual(planSamples({ scene: 'silk', only: 'scene' }), { label: 'silk', sceneOnly: true });
  assert.deepEqual(planSamples({ scene: 'halo', only: 'halo' }), { label: 'halo', sceneOnly: true });
  assert.throws(() => planSamples({ scene: 'silk', only: 'aurora' }), /--only scene or --only silk/);
  assert.throws(() => planSamples({ only: 'paused' }), /--only takes/);
});
