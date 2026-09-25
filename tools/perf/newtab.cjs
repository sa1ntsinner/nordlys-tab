/* Reproducible local new-tab probe. No product files or user Chrome profile are touched.
   One build:  node tools/perf/newtab.cjs --channel chrome --board dense --seconds 8
   One page fit: add --one-page-fit on|off to seed the setting and report the fit (off by default)
   Frame clock: --cadence raf (default, the probe runs its own rAF) or render (no probe rAF)
   Quiet zones: --quiet-alpha 0.45 makes every zone take back exactly that much sky
   Meteors: --seed 7 replaces Math.random with a seeded stream before the page loads
   Scene: --scene silk seeds that atmosphere before the page loads (unset: the app's default, aurora)
   Silk's parts: --silk-skip bloom,sheen drops those parts of renderSilk (with --scene silk --gl off)
   GPU layer: --gl off paints Silk, Polaris and Contour in 2D, as a browser without WebGL2 would
   A/B builds: node tools/perf/ab.cjs (see tools/perf/README.md) */
const { chromium } = require('@playwright/test');
const { resolve, join } = require('node:path');
const { writeFile, mkdir } = require('node:fs/promises');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { startStaticServer } = require('../../tests/helpers/static-server.cjs');
const { DEMO_BOARD } = require('../../tests/helpers/demo-board.cjs');

const args = process.argv.slice(2);
const option = (key, fallback) => { const i = args.indexOf(`--${key}`); return i < 0 ? fallback : args[i + 1]; };
const seconds = Number(option('seconds', '8'));
// Settle time before each sample; the first sample otherwise overlaps font loading and the first quiet solve.
const warmupMs = Number(option('warmup', '0.4')) * 1000;
const output = option('out', '');
const width = Number(option('width', '1920'));
const height = Number(option('height', '1080'));
const deviceScaleFactor = Number(option('dpr', '1'));
const boardName = option('board', 'demo');
const repo = resolve(option('root', resolve(__dirname, '../..')));
const channel = option('channel', 'chromium');
const profileStartup = args.includes('--profile-startup');
const only = option('only', 'all');
const canvasDpr = args.includes('--canvas-dpr') ? Number(option('canvas-dpr', '1')) : null;
const skipMethod = option('skip-method', '');
const screenshot = option('screenshot', '');
const fixedPhase = args.includes('--fixed-phase');
const noGlass = args.includes('--no-glass');
const idle = args.includes('--idle');
const extension = args.includes('--extension');
const tabCount = Number(option('tabs', '1'));
const simulateHidden = args.includes('--simulate-hidden');
// Unset (the default): the board is seeded as saved and nothing about One page fit is touched or read.
// `on`/`off` seeds the setting, times every fit pass and reports the fit once it has settled.
const onePageFit = option('one-page-fit', '');
if (onePageFit && !['on', 'off'].includes(onePageFit)) throw Error('--one-page-fit takes on or off');
/* `raf` (the default, and every report before reportVersion 2): the probe runs its own
   requestAnimationFrame loop for the whole sample and reports rafFps / rafP95Ms from it. That
   loop keeps the page producing display frames at the virtual display's rate (about 120/s)
   in every scene, the paused and solid ones included, and its CPU lands in the figures.
   `render`: the probe schedules no frame of its own and waits in Node; the raf* fields are
   null, and the frame intervals come only from the timestamps of the engine's own renders. */
const cadence = option('cadence', 'raf');
if (!['raf', 'render'].includes(cadence)) throw Error('--cadence takes raf or render');
const quietAlpha = args.includes('--quiet-alpha') ? Number(option('quiet-alpha', '')) : null;
if (quietAlpha !== null && !(quietAlpha >= 0.01 && quietAlpha <= 1)) throw Error('--quiet-alpha takes a number from 0.01 to 1');
const seed = args.includes('--seed') ? Number(option('seed', '')) : null;
if (seed !== null && !(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff)) throw Error('--seed takes a whole number from 0 to 4294967295');
if (!Number.isFinite(seconds) || seconds < 2 || !Number.isFinite(warmupMs) || warmupMs < 0 || !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(deviceScaleFactor)) throw Error('Invalid duration or viewport');

/* The atmospheres the canvas draws, as NORDLYS_GENERATIVE_SCENES in background.js names them.
   Unset (the default): no bgMode is seeded, so the app's own default (aurora) applies exactly as
   before. Set: bgMode is seeded into the saved board before the page loads, and the run fails
   unless the engine is in that scene after load and at the end of the scene's sample. */
const SCENES = ['aurora', 'polaris', 'halo', 'pillars', 'nacre', 'silk', 'baikal', 'drift', 'horizon'];
const scene = args.includes('--scene') ? String(option('scene', '')) : '';
if (args.includes('--scene') && !SCENES.includes(scene)) throw Error(`--scene takes ${SCENES.join(', ')}`);
// Halo draws tonight's moon from the date (bgRealSky, on by default); `off` holds it full.
const realSky = args.includes('--real-sky') ? String(option('real-sky', '')) : '';
if (args.includes('--real-sky') && !['on', 'off'].includes(realSky)) throw Error('--real-sky takes on or off');

/* The first sample is the scene as it moves. It was always labelled `aurora`, and it still is
   when no --scene is given, so every earlier report and `--only aurora` keep their meaning. With
   --scene it carries the scene's own name; `--only scene` keeps it whichever scene that is. */
function planSamples({ scene = '', only = 'all' } = {}) {
  const label = scene || 'aurora';
  if (only === 'all') return { label, sceneOnly: false };
  if (only === 'scene' || only === label) return { label, sceneOnly: true };
  if (only === 'aurora') throw Error(`--only aurora keeps the Aurora sample, but --scene ${scene} labels it '${label}': use --only scene or --only ${label}`);
  throw Error(`--only takes all, scene or ${label}`);
}
const plan = planSamples({ scene, only });

/* renderSilk in parts. `strokes`: every thread stroke. `bloom`: each thread's wide, faint passes,
   keeping its thin core. `sheen`: the band of light swept over the threads. `depth`: the backdrop
   fill laid behind them. `field`: the vector-field walk (silkAngle), frozen at the first frame
   after the split, so the threads keep one shape and every stroke and fill is still drawn. */
const SILK_PARTS = ['strokes', 'bloom', 'sheen', 'depth', 'field'];
const silkSkip = args.includes('--silk-skip') ? String(option('silk-skip', '')).split(',').filter(Boolean) : [];
if (args.includes('--silk-skip') && (!silkSkip.length || silkSkip.some(part => !SILK_PARTS.includes(part)))) throw Error(`--silk-skip takes a comma list of ${SILK_PARTS.join(', ')}`);
if (silkSkip.length && scene !== 'silk') throw Error('--silk-skip needs --scene silk');
/* The long lines of Silk, Polaris and Contour go to the GPU layer (sky-gl.js) where there is WebGL2.
   `off` holds them on the 2D canvas, the way a browser without it paints them: the before of that change,
   and the only path --silk-skip can split, since it drops the 2D strokes. */
const glMode = args.includes('--gl') ? String(option('gl', '')) : 'on';
if (!['on', 'off'].includes(glMode)) throw Error('--gl takes on or off');
if (silkSkip.length && glMode !== 'off') throw Error('--silk-skip splits the 2D strokes, which the GPU layer replaces: add --gl off');
// One method, or a comma list. Each is replaced by a no-op after load; a name the engine lacks fails the run.
const skipMethods = skipMethod.split(',').filter(Boolean);
if (skipMethods.includes('silkAngle')) throw Error('--skip-method silkAngle returns undefined, which turns every thread to NaN and throws: use --silk-skip field');
if (silkSkip.length && skipMethods.includes('renderSilk')) throw Error('--silk-skip splits renderSilk; it cannot be combined with --skip-method renderSilk');

/* Runs in the page (and in tests/unit/perf-probe.test.cjs against background.js in a vm), so
   it takes everything it needs as arguments. It wraps the engine's own renderSilk and silkAngle,
   and while renderSilk runs, the stroke and fillRect of whichever context is this.ctx at that
   moment: the live canvas, or the quiet-zone sample solveQuiet paints. `passes` is the length of
   NORDLYS_SILK_PASSES, the strokes each thread gets. Counts land on engine.__perfSilkSplit. */
function splitSilk(engine, parts, passes) {
  const skip = new Set(parts);
  if (typeof engine.renderSilk !== 'function' || typeof engine.silkAngle !== 'function') throw Error('--silk-skip: this build has no renderSilk / silkAngle');
  if (!(Number.isInteger(passes) && passes >= 1) || (skip.has('bloom') && passes < 2)) throw Error(`--silk-skip: NORDLYS_SILK_PASSES is ${passes}, not the pass list the split expects`);
  const stats = engine.__perfSilkSplit = { renders: 0, strokesDrawn: 0, skipped: Object.fromEntries(parts.map(part => [part, 0])) };
  const renderSilk = engine.renderSilk, silkAngle = engine.silkAngle;
  // One entry per call, in the order renderSilk walks the threads; the walk restarts every render.
  const frozen = [];
  let step = 0;
  if (skip.has('field')) engine.silkAngle = function (...args) {
    if (step < frozen.length) { stats.skipped.field++; return frozen[step++]; }
    step++;
    const angle = silkAngle.apply(this, args);
    frozen.push(angle);
    return angle;
  };
  engine.renderSilk = function (...args) {
    const ctx = this.ctx;
    const own = { stroke: Object.getOwnPropertyDescriptor(ctx, 'stroke'), fillRect: Object.getOwnPropertyDescriptor(ctx, 'fillRect') };
    const { stroke, fillRect } = ctx;
    let strokes = 0;
    stats.renders++;
    step = 0;
    ctx.stroke = function (...a) {
      // Each thread is stroked once per pass, widest first; the last pass is the core.
      const core = strokes++ % passes === passes - 1;
      if (skip.has('strokes')) { stats.skipped.strokes++; return; }
      if (skip.has('bloom') && !core) { stats.skipped.bloom++; return; }
      stats.strokesDrawn++;
      return stroke.apply(this, a);
    };
    ctx.fillRect = function (...a) {
      const part = this.globalCompositeOperation === 'source-atop' ? 'sheen' : this.globalCompositeOperation === 'destination-over' ? 'depth' : null;
      if (part && skip.has(part)) { stats.skipped[part]++; return; }
      return fillRect.apply(this, a);
    };
    try { return renderSilk.apply(this, args); }
    finally {
      for (const key of ['stroke', 'fillRect']) {
        if (own[key]) Object.defineProperty(ctx, key, own[key]);
        else delete ctx[key];
      }
    }
  };
  engine.repaint();
  return { parts, passes };
}

const denseBoard = { ...DEMO_BOARD, groups: [
  ...DEMO_BOARD.groups,
  { label: 'AI', cols: 2, hidden: false, links: [
    { name: 'Assistant', url: 'https://example.com/assistant', color: '#91a5ff', icon: 'openai' },
    { name: 'Search', url: 'https://example.com/search', color: '#22b8cd', icon: 'brain' }] },
  { label: 'Work', cols: 2, hidden: false, links: [
    { name: 'Code', url: 'https://example.com/code', color: '#a5b4fc', icon: 'github' },
    { name: 'Notes', url: 'https://example.com/notes', color: '#f8f9fa', icon: 'notion' }] },
  { label: 'Read', cols: 1, hidden: false, links: [
    { name: 'News', url: 'https://example.com/news', color: '#e5e7eb', icon: 'school' }] },
  { label: 'Misc', cols: 1, hidden: false, links: [
    { name: 'Maps', url: 'https://example.com/maps', color: '#86efac', icon: 'tag' }] },
] };
const savedBoard = boardName === 'dense' ? denseBoard : DEMO_BOARD;
// Only the keys a flag asks for; with none, the board is seeded exactly as saved.
const board = { ...savedBoard, ...(onePageFit ? { onePageFit: onePageFit === 'on' } : {}),
  ...(scene ? { bgMode: scene } : {}), ...(realSky ? { bgRealSky: realSky === 'on' } : {}) };

const metricMap = metrics => Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
const round = (value, digits = 2) => value == null ? null : Number(value.toFixed(digits));
const percentile = (values, p) => values.length ? values[Math.min(values.length - 1, Math.ceil(p * values.length) - 1)] : null;
const execFileAsync = promisify(execFile);

async function processes(session) {
  const { processInfo } = await session.send('SystemInfo.getProcessInfo');
  return Object.fromEntries(processInfo.map(p => [p.id, { type: p.type, cpuSec: p.cpuTime }]));
}

async function processMemory(result) {
  if (process.platform === 'win32') {
    const ids = Object.keys(result).join(',');
    const command = `Get-Process -Id ${ids} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`;
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', command], { windowsHide: true });
    for (const p of [].concat(JSON.parse(stdout || '[]'))) {
      if (result[p.Id]) {
        result[p.Id].workingSetMiB = round(p.WorkingSet64 / 1048576);
        result[p.Id].privateMiB = round(p.PrivateMemorySize64 / 1048576);
      }
    }
  }
  return result;
}

/* Wraps PageFit.prototype.fit as page-fit.js publishes it, before the app exists: the first fit
   runs inside the app's constructor (grid.render), so wrapping after load would miss it. */
function timeFitPasses() {
  const passes = window.__perfFitPasses = [];
  let api;
  Object.defineProperty(window, 'NordlysPageFit', { configurable: true, enumerable: true, get: () => api, set(value) {
    api = value;
    const proto = value?.PageFit?.prototype;
    if (!proto?.fit || proto.__perfWrapped) return;
    const fit = proto.fit;
    proto.fit = function (...args) {
      // A pass that returns at once (switch off, a drag, re-entry) is kept but not counted as a fit.
      const active = this.active && !this.fitting && !this.app?.grid?.isDragging && !this.app?.grid?.frozen;
      const trials = this.trials, start = performance.now();
      try { return fit.apply(this, args); }
      finally { passes.push({ atMs: start, durationMs: performance.now() - start, active,
        stage: this.state.stage, zoom: this.state.zoom, trials: this.trials - trials }); }
    };
    proto.__perfWrapped = true;
  } });
}

/* The fit as the page wears it, after fit passes have stopped for 500 ms (at most 5 s): fonts
   and the surface's resize observer can each ask for another pass after the first. */
function pageFitState(page) {
  return page.evaluate(async () => {
    const r2 = value => value == null ? null : Math.round(value * 100) / 100;
    const r4 = value => value == null ? null : Math.round(value * 1e4) / 1e4;
    const passes = window.__perfFitPasses || [];
    await document.fonts?.ready;
    const deadline = performance.now() + 5000;
    let seen = -1, quietSince = 0, settled = false;
    while (performance.now() < deadline) {
      await new Promise(done => requestAnimationFrame(done));
      if (passes.length !== seen) { seen = passes.length; quietSince = performance.now(); }
      else if (performance.now() - quietSince >= 500) { settled = true; break; }
    }
    const fit = window.Nordlys?.pageFit;
    const doc = document.scrollingElement || document.documentElement;
    const active = passes.filter(p => p.active);
    return {
      supported: Boolean(fit), enabled: fit ? fit.enabled : null, settled,
      attribute: document.documentElement.getAttribute('data-page-fit'),
      stage: fit?.state.stage ?? null, t: fit?.state.t ?? null, zoom: fit?.state.zoom ?? null,
      // What Chrome applies, to compare with the zoom the fit settled on (both at 4 places).
      surfaceCssZoom: r4(document.getElementById('fit-surface')?.currentCSSZoom),
      boardCssZoom: r4(document.getElementById('board')?.currentCSSZoom),
      scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth,
      fitsVertically: doc.scrollHeight <= doc.clientHeight, fitsHorizontally: doc.scrollWidth <= doc.clientWidth,
      // The first pass that actually fitted, timed from navigation start; null when the switch is off.
      coldFit: active[0] ? { atMs: r2(active[0].atMs), durationMs: r2(active[0].durationMs), trials: active[0].trials, stage: active[0].stage } : null,
      passes: passes.length, activePasses: active.length, activeFitMsTotal: r2(active.reduce((total, p) => total + p.durationMs, 0)),
      trials: fit?.trials ?? null,
    };
  });
}

/* mulberry32, installed before any page script, so the meteors (the engine's only Math.random
   draws per frame) fall in the same sequence on every run and on both builds of an A/B. */
function seedRandom(seed) {
  let state = seed | 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Every quiet zone asks for a contrast no colour pair reaches (22:1; the most there is, black
   on white, is 21:1), so the solver returns the zone's ceiling, `most`, which is set to the
   alpha asked for. The app's own zones pass through here whenever it sends them again. The
   solver still paints and reads its sample, but skips the bisection a real partial cut runs. */
async function forceQuietAlpha(page, alpha) {
  return page.evaluate(async alpha => {
    const engine = window.Nordlys.bgEngine;
    const deadline = performance.now() + 5000;
    while (!engine.quietZones.length && performance.now() < deadline) await new Promise(done => setTimeout(done, 50));
    const set = engine.setQuietZones;
    engine.setQuietZones = function (zones) {
      return set.call(this, Array.isArray(zones) ? zones.map(zone => zone?.inks ? { ...zone, most: alpha,
        inks: zone.inks.map(([ink, , inkAlpha]) => [ink, 22, inkAlpha]) } : zone) : zones);
    };
    engine.setQuietZones(engine.quietZones);
    return engine.quietZones.length;
  }, alpha);
}

const intervalStats = times => {
  const intervals = times.slice(1).map((at, i) => at - times[i]);
  const sorted = intervals.slice().sort((a, b) => a - b);
  return { intervals, sorted };
};

async function measure(page, cdp, browserCdp, label, mutate) {
  if (mutate) await mutate();
  await page.waitForTimeout(warmupMs);
  await page.evaluate(() => {
    const engine = window.Nordlys?.bgEngine;
    window.__perfFrames = 0;
    window.__perfScratchFrames = 0;
    window.__perfScratchMs = 0;
    window.__perfLoopTimes = [];
    window.__perfRepaints = 0;
    window.__perfQuietSolves = [];
    window.__perfMeteors = 0;
    if (engine && !engine.__perfWrapped) {
      const render = engine.render;
      engine.render = function (...args) {
        if (this.solvingQuiet) window.__perfScratchFrames++;
        else {
          window.__perfFrames++;
          // The loop always passes the time since its last frame; repaint() and held stills pass 0.
          if (args[0] > 0) window.__perfLoopTimes.push(performance.now());
          else window.__perfRepaints++;
        }
        const start = performance.now();
        try { return render.apply(this, args); }
        finally {
          const elapsed = performance.now() - start;
          if (this.solvingQuiet) window.__perfScratchMs += elapsed;
          else window.__perfRenderMs += elapsed;
        }
      };
      if (typeof engine.solveQuiet === 'function') {
        const solve = engine.solveQuiet;
        engine.solveQuiet = function (...args) {
          const alphas = solve.apply(this, args);
          window.__perfQuietSolves.push(alphas);
          return alphas;
        };
      }
      // The array is created once in the constructor and only ever emptied in place.
      engine.meteors.push = function (...items) {
        window.__perfMeteors += items.length;
        return Array.prototype.push.apply(this, items);
      };
      engine.__perfWrapped = true;
    }
    window.__perfRenderMs = 0;
    window.__perfScratchMs = 0;
    // --silk-skip: count this sample only.
    const split = engine?.__perfSilkSplit;
    if (split) { split.renders = 0; split.strokesDrawn = 0; for (const part in split.skipped) split.skipped[part] = 0; }
  });
  const beforeProcesses = await processes(browserCdp);
  const beforeCpuAt = Date.now();
  const before = metricMap((await cdp.send('Performance.getMetrics')).metrics);
  const { frames: beforeFrames, at: startedAt } = await page.evaluate(() => ({ frames: window.__perfFrames, at: performance.now() }));
  // `render` cadence: nothing runs in the page for the sample but the page itself.
  const rafIntervals = cadence === 'render' ? null : await page.evaluate(ms => new Promise(done => {
    const intervals = [], started = performance.now();
    let last = 0;
    const tick = now => {
      if (last) intervals.push(now - last);
      last = now;
      if (now - started < ms) requestAnimationFrame(tick);
      else done(intervals);
    };
    requestAnimationFrame(tick);
  }), seconds * 1000);
  if (cadence === 'render') await new Promise(done => setTimeout(done, seconds * 1000));
  const render = await page.evaluate(startedAt => {
    const engine = window.Nordlys.bgEngine, endedAt = performance.now();
    return { frames: window.__perfFrames, scratchFrames: window.__perfScratchFrames,
      ms: window.__perfRenderMs, scratchMs: window.__perfScratchMs,
      quietZones: engine.quietZones.length, quietAlphas: engine.quietAlphas,
      loopTimes: window.__perfLoopTimes.filter(at => at >= startedAt && at <= endedAt),
      repaints: window.__perfRepaints, quietSolves: window.__perfQuietSolves, meteors: window.__perfMeteors,
      silkSplit: engine.__perfSilkSplit ? JSON.parse(JSON.stringify(engine.__perfSilkSplit)) : null,
      // Which way the scene's long lines were drawn: the GPU layer, held off it (--gl off), or never asked for.
      engine: { mode: engine.mode, running: engine.running, parked: engine.animId === null,
        layer: engine.gl ? (engine.gl.lost ? 'lost' : 'gpu') : engine.gl === null ? '2d' : 'none' } };
  }, startedAt);
  const after = metricMap((await cdp.send('Performance.getMetrics')).metrics);
  const afterProcesses = await processes(browserCdp);
  const cpuElapsed = (Date.now() - beforeCpuAt) / 1000;
  await processMemory(afterProcesses);
  const frames = render.frames - beforeFrames;
  const sorted = rafIntervals ? rafIntervals.slice().sort((a, b) => a - b) : null;
  const elapsed = (after.Timestamp - before.Timestamp);
  const loop = intervalStats(render.loopTimes);
  const zones = render.quietSolves.reduce((most, alphas) => Math.max(most, alphas.length), 0);
  const quietAlphaMax = Array.from({ length: zones }, (_, i) => round(Math.max(...render.quietSolves.map(alphas => alphas[i] || 0)), 3));
  return {
    label, elapsedSec: round(elapsed), canvasFps: round(frames / elapsed), canvasFrames: frames,
    scratchFrames: render.scratchFrames,
    scratchRenderMsPerFrame: render.scratchFrames ? round(render.scratchMs / render.scratchFrames) : 0,
    quietZones: render.quietZones, quietAlphas: render.quietAlphas,
    // Every solve in the sample (warmup excluded), not just the last one quietAlphas shows.
    quiet: { solves: render.quietSolves.length, nonzeroSolves: render.quietSolves.filter(alphas => alphas.some(a => a >= 0.01)).length,
      alphaMax: quietAlphaMax },
    meteorsSpawned: render.meteors,
    // --silk-skip only: renderSilk calls (scratch ones included), strokes drawn, and what each part dropped.
    ...(render.silkSplit ? { silkSplit: render.silkSplit } : {}),
    canvasRenderMsPerFrame: frames ? round(render.ms / frames) : 0,
    /* The engine's own frames, timed where the probe wraps render() (loop frames only: repaints are
       counted apart). The same in both cadences. No loop frame means no interval: `absent` says so
       and why, rather than a 0 fps or 0 ms that reads like a fast frame. */
    renderCadence: {
      loopFrames: render.loopTimes.length, repaints: render.repaints, intervals: loop.intervals.length,
      fps: round(render.loopTimes.length / elapsed),
      p50Ms: round(percentile(loop.sorted, 0.5)), p95Ms: round(percentile(loop.sorted, 0.95)), maxMs: round(loop.sorted.at(-1)),
      over50MsPct: loop.intervals.length ? round(100 * loop.intervals.filter(ms => ms > 50).length / loop.intervals.length) : null,
      absent: loop.intervals.length === 0,
      reason: loop.intervals.length ? null : !render.engine.running ? 'engine stopped (paused, solid or hidden)'
        : render.engine.parked ? 'engine parked: a held still frame' : 'engine running but fewer than two loop frames arrived',
      engine: render.engine,
    },
    // Null with --cadence render: the probe ran no requestAnimationFrame to measure.
    rafFps: sorted ? round(rafIntervals.length / elapsed) : null, rafP95Ms: sorted ? round(percentile(sorted, 0.95)) : null,
    rafOver25MsPct: sorted ? round(100 * rafIntervals.filter(ms => ms > 25).length / Math.max(rafIntervals.length, 1)) : null,
    rendererTaskMsPerSec: round((after.TaskDuration - before.TaskDuration) * 1000 / elapsed),
    scriptMsPerSec: round((after.ScriptDuration - before.ScriptDuration) * 1000 / elapsed),
    layoutMsPerSec: round((after.LayoutDuration - before.LayoutDuration) * 1000 / elapsed),
    styleMsPerSec: round((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000 / elapsed),
    jsHeapMiB: round(after.JSHeapUsedSize / 1048576),
    domNodes: after.Nodes,
    processes: Object.entries(afterProcesses).map(([id, p]) => ({ pid: Number(id), type: p.type,
      cpuMsPerSec: round(((p.cpuSec || 0) - (beforeProcesses[id]?.cpuSec || 0)) * 1000 / cpuElapsed),
      privateMiB: p.privateMiB, workingSetMiB: p.workingSetMiB })),
  };
}

async function main() {
  const server = extension ? null : await startStaticServer(repo);
  const profileDir = extension ? mkdtempSync(join(tmpdir(), 'nordlys-perf-')) : null;
  let browser, context;
  try {
    if (extension) {
      context = await chromium.launchPersistentContext(profileDir, { headless: true, channel,
        viewport: { width, height }, deviceScaleFactor, colorScheme: 'dark', reducedMotion: 'no-preference', locale: 'en-US',
        args: [`--disable-extensions-except=${repo}`, `--load-extension=${repo}`] });
    } else {
      browser = await chromium.launch({ headless: true, ...(channel === 'chromium' ? {} : { channel }) });
      context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor,
        colorScheme: 'dark', reducedMotion: 'no-preference', locale: 'en-US' });
    }
    const browserCdp = await (browser || context.browser()).newBrowserCDPSession();
    if (args.includes('--no-desynchronized')) await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, options) {
        if (this.id === 'bg-canvas' && options) return getContext.call(this, type, { ...options, desynchronized: false });
        return getContext.call(this, type, options);
      };
    });
    if (onePageFit) await context.addInitScript(timeFitPasses);
    if (seed !== null) await context.addInitScript(seedRandom, seed);
    if (!extension) await context.addInitScript(savedBoard => localStorage.setItem('nordlys_config', JSON.stringify(savedBoard)), board);
    const page = extension ? (context.pages()[0] || await context.newPage()) : await context.newPage();
    if (extension) {
      await page.goto('chrome://newtab');
      await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
      await page.evaluate(savedBoard => localStorage.setItem('nordlys_config', JSON.stringify(savedBoard)), board);
    }
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    let profile;
    if (profileStartup) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
    const started = Date.now();
    if (extension) await page.reload({ waitUntil: 'domcontentloaded' });
    else await page.goto(`${server.origin}/newtab.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.Nordlys?.bgEngine && document.querySelectorAll('#board .card').length));
    const startupWallMs = Date.now() - started;
    if (profileStartup) profile = (await cdp.send('Profiler.stop')).profile;
    const startup = await page.evaluate(() => ({
      domContentLoadedMs: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
      loadMs: performance.getEntriesByType('navigation')[0].loadEventEnd,
      boardCards: document.querySelectorAll('#board .card').length,
      mode: window.Nordlys.config.bgMode,
      canvasPixels: document.getElementById('bg-canvas').width * document.getElementById('bg-canvas').height,
      nodeCounts: {
        document: document.querySelectorAll('*').length,
        settings: document.querySelector('#cfg')?.querySelectorAll('*').length ?? null,
        board: document.querySelector('#board')?.querySelectorAll('*').length ?? null,
        iconPicker: document.querySelector('#icon-picker')?.querySelectorAll('*').length ?? null,
      },
      topResources: performance.getEntriesByType('resource').sort((a, b) => b.duration - a.duration).slice(0, 8)
        .map(({ name, duration, transferSize }) => ({ name: new URL(name).pathname, durationMs: Math.round(duration), transferSize })),
    }));
    // The scene as the page settled on it: what was stored, what the engine draws, and what shapes it.
    startup.scene = await page.evaluate(requested => {
      const engine = window.Nordlys.bgEngine;
      const moon = engine.mode === 'halo' && typeof engine.moonTonight === 'function' ? engine.moonTonight() : null;
      return { requested, config: window.Nordlys.config.bgMode, engine: engine.mode, attribute: document.documentElement.dataset.bg,
        running: engine.running, motion: engine.motion, intensity: engine.intensity, palette: engine.paletteName ?? null,
        seed: engine.seed ?? null, realSky: engine.realSky ?? null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(engine.mode === 'silk' && Array.isArray(engine.silk) ? { silk: { threads: engine.silk.length, steps: engine.silk.reduce((sum, thread) => sum + thread.steps, 0) } } : {}),
        ...(moon ? { moon: { phase: moon.phase, illumination: moon.illumination, south: moon.south } } : {}) };
    }, scene || null);
    if (scene && (startup.scene.engine !== scene || startup.scene.config !== scene)) throw Error(`--scene ${scene} was seeded, but the page stored ${startup.scene.config} and the engine draws ${startup.scene.engine}`);
    // Read before any probe option changes the page, and before the scenes, so settling costs no sample time.
    const pageFit = onePageFit ? { requested: onePageFit, ...await pageFitState(page) } : undefined;
    const gpu = await browserCdp.send('SystemInfo.getInfo').then(info => ({ featureStatus: info.gpu?.featureStatus,
      devices: info.gpu?.devices?.map(d => ({ vendorId: d.vendorId, deviceId: d.deviceId, vendorString: d.vendorString, deviceString: d.deviceString })) })).catch(error => ({ error: error.message }));
    if (canvasDpr !== null || skipMethods.length) await page.evaluate(({ dpr, methods }) => {
      const engine = window.Nordlys.bgEngine;
      if (dpr !== null) {
        engine.dpr = dpr;
        engine.canvas.width = Math.floor(engine.w * dpr);
        engine.canvas.height = Math.floor(engine.h * dpr);
        engine.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      // A misspelt name used to add a property nothing called, and the run measured everything.
      for (const method of methods) {
        if (typeof engine[method] !== 'function') throw Error(`--skip-method ${method}: the engine has no such method`);
        engine[method] = () => {};
      }
      engine.repaint();
    }, { dpr: canvasDpr, methods: skipMethods });
    if (glMode === 'off') await page.evaluate(() => {
      const engine = window.Nordlys.bgEngine;
      // Held off until the scene changes, which a probe run never does.
      engine.gl?.release?.();
      engine.gl = null;
      engine.repaint();
    });
    if (silkSkip.length) await page.evaluate(`(${splitSilk})(window.Nordlys.bgEngine, ${JSON.stringify(silkSkip)}, typeof NORDLYS_SILK_PASSES === 'undefined' ? null : NORDLYS_SILK_PASSES.length)`);
    const forcedQuietZones = quietAlpha !== null ? await forceQuietAlpha(page, quietAlpha) : null;
    if (noGlass) await page.addStyleTag({ content: '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' });
    if (idle) await page.evaluate(() => { window.Nordlys.bgEngine.lastInput = performance.now() - 61000; });
    if (fixedPhase) await page.evaluate(() => {
      const engine = window.Nordlys.bgEngine;
      engine.pause(); engine.t = 12; engine.render(0);
    });
    if (screenshot) await page.screenshot({ path: resolve(screenshot) });
    const samples = [];
    samples.push(await measure(page, cdp, browserCdp, plan.label, null));
    const live = samples[0];
    if (scene && live.renderCadence.engine.mode !== scene) throw Error(`--scene ${scene}: the engine was drawing ${live.renderCadence.engine.mode} at the end of the sample`);
    // A part that dropped nothing means renderSilk no longer draws the way splitSilk expects.
    if (silkSkip.length && !live.silkSplit?.renders) throw Error('--silk-skip: Silk never rendered during the sample (a held still or --fixed-phase has nothing to split)');
    if (silkSkip.length && silkSkip.some(part => !live.silkSplit.skipped[part])) throw Error(`--silk-skip: a part dropped nothing: ${JSON.stringify(live.silkSplit)}`);
    if (!plan.sceneOnly) samples.push(await measure(page, cdp, browserCdp, 'paused', () => page.evaluate(() => window.Nordlys.bgEngine.pause())));
    if (!plan.sceneOnly) samples.push(await measure(page, cdp, browserCdp, 'solid', () => page.evaluate(async () => {
      window.Nordlys.config.bgMode = 'solid';
      await window.Nordlys.updateBackgroundMode();
    })));
    if (!plan.sceneOnly) samples.push(await measure(page, cdp, browserCdp, 'solid-no-glass', async () => {
      await page.addStyleTag({ content: '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' });
    }));
    let multitab;
    if (extension && tabCount > 1) {
      const initial = await processMemory(await processes(browserCdp));
      const pages = [page];
      for (let i = 1; i < tabCount; i++) {
        const next = await context.newPage();
        await next.goto('chrome://newtab');
        await next.waitForFunction(() => Boolean(window.Nordlys?.bgEngine));
        pages.push(next);
      }
      await pages.at(-1).bringToFront();
      if (simulateHidden) for (const previous of pages.slice(0, -1)) await previous.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const beforeMulti = await processes(browserCdp);
      const cpuStart = Date.now();
      await pages.at(-1).waitForTimeout(seconds * 1000);
      const afterMulti = await processMemory(await processes(browserCdp));
      const cpuElapsed = (Date.now() - cpuStart) / 1000;
      const states = await Promise.all(pages.map(p => p.evaluate(() => ({ visibility: document.visibilityState,
        running: window.Nordlys?.bgEngine?.running, canvasPixels: document.getElementById('bg-canvas')?.width * document.getElementById('bg-canvas')?.height }))));
      const summarize = record => ({ totalPrivateMiB: round(Object.values(record).reduce((sum, p) => sum + (p.privateMiB || 0), 0)),
        totalWorkingSetMiB: round(Object.values(record).reduce((sum, p) => sum + (p.workingSetMiB || 0), 0)),
        gpu: Object.values(record).filter(p => p.type === 'GPU').map(p => ({ privateMiB: p.privateMiB, workingSetMiB: p.workingSetMiB })),
        renderers: Object.values(record).filter(p => p.type === 'renderer').map(p => ({ privateMiB: p.privateMiB, workingSetMiB: p.workingSetMiB })) });
      multitab = { tabCount, simulatedHidden: simulateHidden, states, oneTab: summarize(initial), manyTabs: summarize(afterMulti),
        processCpuMsPerSec: Object.entries(afterMulti).map(([id, p]) => ({ type: p.type,
          cpuMsPerSec: round(((p.cpuSec || 0) - (beforeMulti[id]?.cpuSec || 0)) * 1000 / cpuElapsed) })) };
    }
    const version = browser ? browser.version() : (await browserCdp.send('Browser.getVersion')).product;
    /* reportVersion 2 adds renderCadence, quiet, meteorsSpawned and the probe fields below, and lets
       the raf* fields be null (--cadence render). With the defaults every version-1 field keeps its
       meaning. Reports without a reportVersion are version 1: they all ran the probe's own rAF.
       reportVersion 3 adds probe.scene, realSky, skippedMethods and silkSkip, startup.scene, and
       silkSplit on samples; only with --scene is the first sample labelled other than `aurora`. Within version 3,
       probe.gl and renderCadence.engine.layer say whether the GPU layer drew the long lines. */
    const report = { reportVersion: 3, timestamp: new Date().toISOString(), browser: version, channel, extension, platform: process.platform, gpu,
      probe: { only, canvasDpr, skipMethod, noGlass, idle, fixedPhase, noDesynchronized: args.includes('--no-desynchronized'),
        onePageFit: onePageFit || null, cadence, quietAlpha, forcedQuietZones, seed, gl: glMode,
        scene: scene || null, realSky: realSky || null, skippedMethods: skipMethods, silkSkip: silkSkip.length ? silkSkip : null },
      viewport: { width, height, dpr: deviceScaleFactor }, board: boardName,
      secondsPerSample: seconds, warmupSec: warmupMs / 1000, wallStartupMs: startupWallMs,
      startup, ...(pageFit ? { pageFit } : {}), errors, samples, ...(multitab ? { multitab } : {}) };
    if (profile) {
      const nodes = Object.fromEntries(profile.nodes.map(node => [node.id, node]));
      const selfUs = {};
      profile.samples?.forEach((id, index) => { selfUs[id] = (selfUs[id] || 0) + (profile.timeDeltas?.[index] || 0); });
      report.startupCpuTop = Object.entries(selfUs).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, us]) => ({
        function: nodes[id].callFrame.functionName, url: nodes[id].callFrame.url, line: nodes[id].callFrame.lineNumber + 1,
        selfMs: round(us / 1000),
      }));
    }
    if (output) { await mkdir(resolve(output, '..'), { recursive: true }); await writeFile(resolve(output), JSON.stringify(report, null, 2)); }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally { await context?.close(); await browser?.close(); await server?.close(); if (profileDir) rmSync(profileDir, { recursive: true, force: true }); }
}

// Required (tests/unit/perf-probe.test.cjs), it only lends its helpers; run, it probes.
if (require.main === module) main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
module.exports = { SCENES, SILK_PARTS, planSamples, splitSilk };
