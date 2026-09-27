/* Films the plates for the Remotion edit (tools/video/remotion): clean clips
   of the live demo, one per moment, with no captions, at 5120 x 2880 and
   exactly 60 frames a second.

   node tools/video/plates.cjs <film.cjs> <out-dir> [--only a,b] [--scale 3.5556]
        [--codec hevc|h264] [--quality 92]

   The page runs on a clock of its own (stage.cjs virtualClock): nothing on
   it moves unless the recorder moves it on, and Chrome runs in its
   deterministic mode, drawing a frame only when asked
   (HeadlessExperimental.beginFrame) and at the device scale it was started
   with. So every frame is the page exactly 1/60 s after the one before,
   however long it took to draw: the sky, the CSS transitions, the camera and
   the pointer are all where they should be, and nothing is dropped or
   doubled. (The screencast the older recorders used gives frames at the
   page's CSS size, 1440 x 810, whatever the scale.)

   Each plate is set up off camera, then filmed frame by frame while its
   script runs on the same clock; the frames go straight to ffmpeg. Beside
   each plate, <name>.json: its size, length, and the times and boxes (in
   plate pixels) its script marked, for the edit to aim at. The film file is
   the script: see films/*.cjs. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');
const { serve, virtualClock } = require('./stage.cjs');
const { filmOverlay } = require('./film-overlay.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SITE = path.join(ROOT, '.site-dist');
const args = process.argv.slice(2);
const [filmFile, outArg] = args;
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const OUT = path.resolve(outArg);
const FPS = 60;
const TICK = 1000 / FPS;
const VIEW = { width: 1440, height: 810 };
const SCALE = Number(flag('scale', 5120 / 1440));
const CODEC = flag('codec', 'hevc');
const QUALITY = Number(flag('quality', 92));
const ONLY = flag('only', '') ? flag('only').split(',') : null;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// Where the mouse waits between plates: a corner with nothing under it, so no
// card or tile wears a hover it was never given.
const PARK = { x: 4, y: 4 };

const film = require(path.resolve(filmFile));
fs.mkdirSync(OUT, { recursive: true });
// index.json: every plate in the folder, for the edit to read in one go.
const writeIndex = () => {
  const all = {};
  for (const f of fs.readdirSync(OUT).filter((n) => n.endsWith('.json') && n !== 'index.json').sort()) all[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(all));
};

function encoder(file) {
  const codec = CODEC === 'h264'
    ? ['-c:v', 'libx264', '-preset', 'faster', '-crf', '12', '-profile:v', 'high', '-level', '6.1']
    : ['-c:v', 'hevc_nvenc', '-preset', 'p6', '-tune', 'hq', '-rc', 'constqp', '-qp', '15', '-tag:v', 'hvc1'];
  // Chrome's JPEGs are full-range BT.601; the plates are BT.709, as video is.
  return spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=full:out_range=tv,format=yuv420p',
    ...codec, '-g', '30', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
}

(async () => {
  if (!fs.existsSync(path.join(SITE, 'demo/index.html'))) throw new Error('Run `npm run site` first.');
  const server = await serve(SITE);
  const browser = await chromium.launch({
    args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars',
      '--deterministic-mode', '--enable-begin-frame-control', '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout',
      '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging',
      /* Room for the tiles: at 5K with the page's own camera zoomed in, the default
         budget ran out and whole cards were left undrawn in some frames. */
      '--force-gpu-mem-available-mb=8192',
      `--force-device-scale-factor=${SCALE}`, `--window-size=${VIEW.width},${VIEW.height}`]
  });
  // One time zone wherever it is filmed, so the world clocks read the same.
  const context = await browser.newContext({ viewport: null, locale: 'en-US', timezoneId: film.timezone || 'Europe/Berlin' });
  await context.addInitScript(virtualClock, { clock: film.clock || '09:41' });
  if (film.routes) await film.routes(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('page:', error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeadlessExperimental.enable');

  // ── The clock and the frames ──
  let ticks = 0;
  const advance = () => cdp.send('Runtime.evaluate', { expression: `window.__vclock && window.__vclock.advance(${TICK})` });
  const beginFrame = (screenshot) => {
    ticks += 1;
    return cdp.send('HeadlessExperimental.beginFrame', { frameTimeTicks: 1000 + ticks * TICK, interval: TICK,
      ...(screenshot ? { screenshot: { format: 'jpeg', quality: QUALITY, optimizeForSpeed: true } } : {}) });
  };
  // Off camera the page is kept going by a pump: frames as fast as it can draw them.
  let pumping = null;
  const pump = () => {
    if (pumping) return;
    let on = true;
    const done = (async () => { while (on) { await advance(); await beginFrame(false); await new Promise((r) => setImmediate(r)); } })();
    pumping = { stop: async () => { on = false; await done; pumping = null; } };
  };
  const pumpFrames = async (n) => {
    const was = Boolean(pumping);
    if (was) await pumping.stop();
    for (let i = 0; i < n; i++) { await advance(); await beginFrame(false); }
    if (was) pump();
  };

  pump();
  const js = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(`http://localhost:${server.address().port}/demo/index.html`);
  await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.sync && window.Nordlys.dashboard);
  await js(() => { Nordlys.setTheme('aurora-void'); Nordlys.config.bgMode = 'aurora'; Nordlys.config.onePageFit = true; Nordlys.saveConfig(); });
  if (film.board) await js(film.board);
  await js(() => location.reload());
  await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.dashboard);
  await js(filmOverlay);
  await js(() => document.fonts.ready);
  await js(() => { Nordlys.bgEngine.frameBudget = () => 1000 / 60; document.documentElement.style.scrollBehavior = 'auto'; });
  const music = film.music || {};
  if (film.prepare) await film.prepare({ page, js, music });
  await page.mouse.move(PARK.x, PARK.y);
  await pumpFrames(90);

  // ── Plates ──
  const plates = film.plates(music);
  for (const plate of plates) {
    if (ONLY && !ONLY.includes(plate.name)) continue;
    const frames = Math.round(plate.seconds * FPS);
    let mode = 'setup', frame = -1, mouse = { ...PARK }, buttons = 0;
    const inflight = [];
    const marks = {}, rects = {};
    /* The script's own time on camera: plate seconds, frame by frame. A
       script is one sequence of steps (no parallel branches): it acts, then
       waits for a later frame with at(); the recorder draws a frame only
       while the script is waiting, so every step lands on the frame it asked for. */
    let waiters = [], active = true, finished = false, signal = null;
    const notify = () => { if (signal) { const r = signal; signal = null; r(); } };
    const at = (t) => {
      if (mode !== 'run') return pumpFrames(Math.max(0, Math.round(t * FPS)));
      const f = Math.round(t * FPS);
      if (f <= frame) return Promise.resolve();
      return new Promise((resolve) => { waiters.push({ f, resolve }); active = false; notify(); });
    };
    const now = () => (mode === 'run' ? Math.max(0, frame) / FPS : 0);
    // A box on the page in CSS pixels: a selector, or [selector, index] for the nth match.
    const box = (sel) => js((q) => {
      const [css, i] = Array.isArray(q) ? q : [q, 0];
      const n = document.querySelectorAll(css)[i];
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }, sel);
    const centre = async (sel) => { const b = await box(sel); if (!b) throw new Error(`${plate.name}: nothing at ${sel}`); return [b.x + b.w / 2, b.y + b.h / 2]; };
    const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    const s = {
      page, js, cdp, music, plate, now, at, box, centre,
      wait: (dt) => (mode === 'run' ? at(now() + dt) : pumpFrames(Math.round(dt * FPS))),
      settle: (seconds = 0.4) => (mode === 'run' ? at(now() + seconds) : pumpFrames(Math.round(seconds * FPS))),
      mark: (key) => { marks[key] = now(); },
      rect: async (key, sel) => { const b = await box(sel); if (b) rects[key] = { t: now(), x: b.x * SCALE, y: b.y * SCALE, w: b.w * SCALE, h: b.h * SCALE }; return b; },
      pointer: (on) => js((v) => window.__fx.pointer(v), on),
      bare: (on, instant = false) => js(([o, i]) => window.__fx.bare(o, i), [on, instant]),
      // The in-page camera: look at a selector (or {x,y} or 'center') at scale, over seconds.
      look: (target, scale = 1, seconds = 0, curve) => js(([t, sc, ms, e]) => window.__fx.look(t, sc, ms, e), [target, scale, Math.round(seconds * 1000), curve]),
      theme: (key) => js((k) => { Nordlys.setTheme(k); Nordlys.saveConfig(); }, key),
      scene: (key) => js((k) => { Nordlys.config.bgMode = k; Nordlys.saveConfig(); Nordlys.updateBackgroundMode(); }, key),
      /* The mouse, by hand over CDP. A move is only handled when a frame is
         drawn (Chrome lines mouse moves up with frames), so on camera it is
         sent and not waited for: the recorder collects it after the frame. */
      move: (x, y) => {
        mouse = { x, y };
        const sent = cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: buttons ? 'left' : 'none', buttons });
        if (mode === 'run') { inflight.push(sent); return Promise.resolve(); }
        return sent;
      },
      down: () => { buttons = 1; return cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: mouse.x, y: mouse.y, button: 'left', buttons: 1, clickCount: 1 }); },
      up: () => { buttons = 0; return cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mouse.x, y: mouse.y, button: 'left', buttons: 0, clickCount: 1 }); },
      // One step a frame, eased at both ends; at once while setting up.
      glide: async (x, y, seconds = 0.6) => {
        const from = { ...mouse };
        const n = mode === 'run' ? Math.max(1, Math.round(seconds * FPS)) : 1;
        const t0 = now();
        for (let i = 1; i <= n; i++) {
          if (mode === 'run') await at(t0 + i / FPS);
          const k = ease(i / n);
          await s.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
        }
      },
      /* Glide to a control so the press lands on t. The control is measured
         again every frame: the camera may be moving it. */
      clickOn: async (t, sel, travel = 0.45, mark) => {
        await at(t - travel);
        const from = { ...mouse };
        const n = Math.max(1, Math.round(travel * FPS));
        const t0 = t - travel;
        for (let i = 1; i <= n; i++) {
          await at(t0 + i / FPS);
          const [x, y] = await centre(sel);
          const k = ease(i / n);
          await s.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
        }
        await at(t);
        await s.down();
        if (mark) marks[mark] = now();
        await at(t + 0.06);
        await s.up();
      },
      press: async (key, t) => { if (t != null) await at(t); await page.keyboard.press(key); },
      // Types so that each character falls on a step, the last one on end.
      typeTo: async (text, end, step) => {
        const start = end - (text.length - 1) * step;
        for (const [i, ch] of [...text].entries()) { await at(start + i * step); await page.keyboard.type(ch); }
      }
    };

    /* Off camera: the page as the plate opens. The wall clock is held, and set
       back to the same minute for every plate (ten seconds past it): on camera
       it stays held too unless the plate needs it to run (clock: true), so a
       clock on screen never moves between one shot and the next. */
    pump();
    await js(() => { window.__vclock.hold(true); window.__vclock.anchor(10000); window.__fx.pointer(false); });
    await s.move(PARK.x, PARK.y);
    // Laid out with the camera at rest; the setup then frames it.
    await s.look('center', 1);
    if (film.reset) await film.reset(s);
    if (plate.setup) await plate.setup(s);
    await s.settle(plate.settle ?? 0.5);
    await pumping.stop();

    // On camera.
    const file = path.join(OUT, `${plate.name}.mp4`);
    const ff = encoder(file);
    const exited = once(ff, 'exit');
    if (plate.clock) await js(() => window.__vclock.hold(false));
    mode = 'run';
    const script = (async () => { if (plate.run) await plate.run(s); })().then(() => { finished = true; active = false; notify(); }, (error) => { finished = error; active = false; notify(); });
    const started = Date.now();
    let waited = 0; // frames asked for again (see below)
    for (frame = 0; frame < frames; frame++) {
      await advance();
      // Let the script act on this frame, until it waits for a later one (or ends).
      const due = waiters.filter((w) => w.f <= frame);
      waiters = waiters.filter((w) => w.f > frame);
      if (due.length) { active = true; for (const w of due) w.resolve(); }
      const since = Date.now();
      while (active && !finished) {
        await new Promise((resolve) => { signal = resolve; setTimeout(resolve, 1000); });
        if (Date.now() - since > 30000) { console.warn(`${plate.name}: script busy at frame ${frame}`); break; }
      }
      if (finished && finished !== true) throw finished;
      /* A view transition (a theme change) holds the page's drawing for a moment,
         on Chrome's own clock: then no picture comes back. Ask again, without
         moving the page's time, until it draws. */
      let shot = await beginFrame(true);
      for (let tries = 0; !shot.screenshotData && tries < 400; tries++) {
        await new Promise((r) => setTimeout(r, 10));
        shot = await beginFrame(true);
        waited += 1;
      }
      if (!shot.screenshotData) throw new Error(`${plate.name}: no picture at frame ${frame}`);
      if (inflight.length) await Promise.all(inflight.splice(0));
      if (!ff.stdin.write(Buffer.from(shot.screenshotData, 'base64'))) await once(ff.stdin, 'drain');
    }
    mode = 'setup';
    ff.stdin.end();
    await exited;
    if (ff.exitCode) throw new Error(`${plate.name}: ffmpeg failed`);
    await js(() => window.__vclock.hold(true));
    // Anything the script still waits for after the last frame is dropped.
    for (const w of waiters) w.resolve();
    waiters = [];
    await Promise.race([script, new Promise((r) => setTimeout(r, 2000))]);
    const meta = { name: plate.name, fps: FPS, frames, seconds: frames / FPS, width: Math.round(VIEW.width * SCALE), height: Math.round(VIEW.height * SCALE),
      scale: SCALE, marks, rects, note: plate.note || '' };
    fs.writeFileSync(path.join(OUT, `${plate.name}.json`), JSON.stringify(meta, null, 1));
    writeIndex();
    console.log(`${plate.name}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(1)} s${waited ? ` (asked again ${waited} times)` : ''}`);
    pump();
    await page.mouse.move(PARK.x, PARK.y);
  }
  if (pumping) await pumping.stop();
  await browser.close();
  server.close();
})().catch((error) => { console.error(error); process.exit(1); });
