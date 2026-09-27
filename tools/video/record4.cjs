/* Films the promo as shots, and edits them to a finished piece of music.

   node tools/video/record4.cjs <film.cjs> <map.json> <music> <out.mp4>
        [--size 4k|1080] [--slow 6] [--only 3,4,5] [--work dir] [--encoder x264|nvenc]

   <film.cjs> is the script: its shots, written in the music's own time
   (bars and beats from music-map.py). Each shot is filmed on its own, from
   the live demo (.site-dist, npm run site): the page is set up off camera,
   then filmed slowed down (stage.cjs) while its script runs, and the camera
   moves the page itself (film-overlay.cjs), so a close-up stays sharp.
   The shots are then joined by ffmpeg on the beats the script names, cut
   hard or crossfaded, and the music goes under them as it is: nothing is
   added to it and nothing moved in it. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve, dilate } = require('./stage.cjs');
const { filmOverlay } = require('./film-overlay.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SITE = path.join(ROOT, '.site-dist');
const args = process.argv.slice(2);
const [filmFile, mapFile, musicFile, outArg] = args;
const out = path.resolve(outArg);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SLOW = Number(flag('slow', 6));
const SIZE = flag('size', '4k');
const ENCODER = flag('encoder', 'x264');
// The joined film: x264 by default (best at a given size), or NVENC for speed.
const FINAL = flag('final', 'x264');
const ONLY = flag('only', '') ? flag('only').split(',').map(Number) : null;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VIEW = { width: 1440, height: 810 };
const SCALE = SIZE === '4k' ? 3840 / 1440 : 1920 / 1440;
const FRAME = { width: Math.round(VIEW.width * SCALE), height: Math.round(VIEW.height * SCALE) };
const FPS = 60;
const WORK = path.resolve(flag('work', fs.mkdtempSync(path.join(os.tmpdir(), 'nordlys-film-'))));
fs.mkdirSync(WORK, { recursive: true });

const MAP = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const film = require(path.resolve(filmFile));
const BEAT = 60 / MAP.tempo;
// The music's time: bar n (0 is the first downbeat), beat b within it.
const bar = (n, b = 0) => {
  const D = MAP.downbeats;
  const i = Math.floor(n);
  const base = i < D.length ? D[i] : D[D.length - 1] + (i - D.length + 1) * BEAT * 4;
  const next = i + 1 < D.length ? D[i + 1] : base + BEAT * 4;
  return base + ((n - i) * 4 + b) * ((next - base) / 4) - film.from;
};
const music = { bar, BEAT, BAR: BEAT * 4, map: MAP, from: film.from };
const SHOTS = film.shots(music);
// The script says where it ends, in bars, while it lays out its shots.
music.to = film.to; music.length = film.to - film.from;
SHOTS.forEach((s, i) => { s.index = i; s.to = SHOTS[i + 1] ? SHOTS[i + 1].from : music.length; });
const half = (i) => (i > 0 && i < SHOTS.length ? (SHOTS[i].into?.d ?? 1 / FPS) / 2 : 0);

const encode = (list, file, seconds) => {
  const codec = ENCODER === 'nvenc'
    ? ['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'constqp', '-qp', '14']
    : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '12'];
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `fps=${FPS},scale=${FRAME.width}:${FRAME.height}:flags=lanczos,format=yuv420p,tpad=stop_mode=clone:stop_duration=2`,
    ...codec, '-r', String(FPS), '-t', seconds.toFixed(4), '-an', file], { stdio: 'inherit' });
};

async function shoot(page, cdp) {
  const js = (fn, arg) => page.evaluate(fn, arg);
  for (const shot of SHOTS) {
    if (ONLY && !ONLY.includes(shot.index)) continue;
    const head = half(shot.index), tail = half(shot.index + 1);
    // A little more tail than the transition needs: xfade stops the whole
    // stream if its first input ends even a frame before the transition does.
    const clipFrom = shot.from - head, clipTo = shot.to + tail + 0.12;
    const dir = path.join(WORK, `shot-${String(shot.index).padStart(2, '0')}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const frames = [];
    let recording = false, t0 = 0;
    const vnow = () => (Date.now() / 1000 - t0) / SLOW + clipFrom;
    const vwait = (seconds) => page.waitForTimeout(Math.max(0, seconds * 1000 * SLOW));
    const until = async (t) => { const left = t - vnow(); if (left > 0) await vwait(left); };
    let mouse = { x: 1100, y: 620 };
    const s = {
      page, js, music, bar, BEAT, shot, vwait,
      at: until,
      caption: (title, eyebrow, where) => js(([t, e, w]) => window.__fx.caption(t, e, false, w), [title, eyebrow, where]),
      card: (html) => js((h) => window.__fx.card(h), html),
      statement: (text) => js((t) => window.__fx.statement(t), text),
      flash: () => js(() => window.__fx.flash()),
      pointer: (on) => js((v) => window.__fx.pointer(v), on),
      bare: (on, instant = false) => js(([o, i]) => window.__fx.bare(o, i), [on, instant]),
      // The camera: look at a selector (or {x,y} or 'center') at scale, over seconds of film.
      look: (target, scale = 1, seconds = 0, ease) => js(([t, sc, ms, e]) => window.__fx.look(t, sc, ms, e), [target, scale, Math.round(seconds * 1000), ease]),
      theme: (key) => js((k) => { Nordlys.setTheme(k); Nordlys.saveConfig(); }, key),
      scene: (key) => js((k) => { Nordlys.config.bgMode = k; Nordlys.saveConfig(); Nordlys.updateBackgroundMode(); }, key),
      glide: async (x, y, seconds = 0.6) => {
        const from = { ...mouse };
        const steps = Math.max(8, Math.round(seconds * 40));
        for (let i = 1; i <= steps; i++) {
          const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
          if (recording) await vwait(seconds / steps);
        }
        mouse = { x, y };
      },
      centre: async (locator) => { const b = await locator.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; },
      /* Glide to a control so the press lands exactly on t. The control is
         looked for again on every step: the camera may be moving it. */
      clickOn: async (t, locator, travel = 0.45) => {
        await until(t - travel);
        const from = { ...mouse };
        const steps = Math.max(8, Math.round(travel * 40));
        for (let i = 1; i <= steps; i++) {
          const [x, y] = await s.centre(locator);
          const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
          mouse = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
          if (recording) await vwait((travel - 0.02) / steps);
        }
        const [x, y] = await s.centre(locator);
        await page.mouse.move(x, y); mouse = { x, y };
        await until(t); await page.mouse.down(); await vwait(0.05); await page.mouse.up();
      },
      // Types so each character falls on a step, the last one on end.
      typeTo: async (text, end, step = BEAT / 4) => {
        const start = end - (text.length - 1) * step;
        for (const [i, ch] of [...text].entries()) { await until(start + i * step); await page.keyboard.type(ch); }
      },
      settle: (seconds = 0.4) => page.waitForTimeout(seconds * 1000 * SLOW)
    };
    // Off camera: the page as the shot opens. The clock on screen waits.
    await js(() => window.__holdClock?.(true));
    await js((keep) => { if (!keep) window.__fx.caption(null, null, true); window.__fx.card(null, true); window.__fx.pointer(false); }, Boolean(shot.keepCaption));
    if (shot.setup) await shot.setup(s);
    await s.settle(shot.settle ?? 0.5);
    // On camera.
    const onFrame = ({ data, metadata, sessionId }) => {
      const file = path.join(dir, `f${String(frames.length).padStart(6, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file, t: metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    };
    cdp.on('Page.screencastFrame', onFrame);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 93, maxWidth: FRAME.width, maxHeight: FRAME.height, everyNthFrame: 1 });
    await page.waitForTimeout(250);
    await js(() => window.__holdClock?.(false));
    t0 = Date.now() / 1000; recording = true;
    if (shot.run) await shot.run(s);
    await until(clipTo);
    recording = false;
    await js(() => window.__holdClock?.(true));
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', onFrame);
    // Frames at the film's own speed, from the moment the shot began.
    const firstIndex = Math.max(0, frames.findIndex((f) => f.t >= t0) - 1);
    const kept = frames.slice(firstIndex);
    const vt = (f) => Math.max(0, (f.t - t0) / SLOW);
    const length = clipTo - clipFrom;
    const list = kept.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.0001, (kept[i + 1] ? vt(kept[i + 1]) : length) - vt(f)).toFixed(5)}`).join('\n') + `\nfile '${kept[kept.length - 1].file.replace(/\\/g, '/')}'\n`;
    fs.writeFileSync(path.join(dir, 'list.txt'), list);
    encode(path.join(dir, 'list.txt'), path.join(WORK, `clip-${String(shot.index).padStart(2, '0')}.mp4`), length);
    for (const f of kept) fs.rmSync(f.file, { force: true });
    console.log(`shot ${shot.index} ${shot.name}: ${music.bar ? '' : ''}${shot.from.toFixed(2)}-${shot.to.toFixed(2)} s, ${kept.length} frames`);
  }
}

function assemble() {
  const clips = SHOTS.map((s) => path.join(WORK, `clip-${String(s.index).padStart(2, '0')}.mp4`));
  const inputs = clips.flatMap((c) => ['-i', c]);
  const parts = [];
  let last = '0:v';
  for (let i = 1; i < SHOTS.length; i++) {
    const d = SHOTS[i].into?.d ?? 1 / FPS;
    const type = SHOTS[i].into?.type || 'fade';
    const offset = SHOTS[i].from - d / 2;
    const label = i === SHOTS.length - 1 ? 'vout' : `x${i}`;
    parts.push(`[${last}][${i}:v]xfade=transition=${type}:duration=${d.toFixed(4)}:offset=${offset.toFixed(4)}[${label}]`);
    last = label;
  }
  const picture = path.join(WORK, 'picture.mp4');
  const final = FINAL === 'nvenc'
    ? ['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '17', '-b:v', '45M', '-maxrate', '70M', '-bufsize', '90M', '-profile:v', 'high']
    : ['-c:v', 'libx264', '-preset', 'slow', '-crf', SIZE === '4k' ? '16' : '17', '-profile:v', 'high'];
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';') || '[0:v]null[vout]', '-map', `[${parts.length ? 'vout' : 'vout'}]`,
    ...final, '-pix_fmt', 'yuv420p', '-r', String(FPS), '-t', music.length.toFixed(3), '-movflags', '+faststart', picture], { stdio: 'inherit' });
  const fadeOut = film.fadeOut ?? 2;
  const audio = [`atrim=start=${film.from.toFixed(3)}:end=${film.to.toFixed(3)}`, 'asetpts=PTS-STARTPTS', film.from > 0 ? 'afade=t=in:d=0.3' : null, `afade=t=out:st=${(music.length - fadeOut).toFixed(3)}:d=${fadeOut}`].filter(Boolean).join(',');
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', picture, '-i', musicFile, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-af', audio, '-c:a', 'aac', '-b:a', '320k', '-t', music.length.toFixed(3), '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.writeFileSync(out.replace(/\.mp4$/, '.timeline.json'), JSON.stringify({ tempo: MAP.tempo, seconds: music.length, hits: SHOTS.slice(1).map((s) => ({ at: s.from, kind: (s.into?.d ?? 0) > 0.1 ? 'fade' : 'switch', shot: s.name })) }, null, 1));
  console.log(`wrote ${out}`);
}

(async () => {
  if (!fs.existsSync(path.join(SITE, 'demo/index.html'))) throw new Error('Run `npm run site` first.');
  console.log(`${SHOTS.length} shots over ${music.length.toFixed(1)} s; work in ${WORK}`);
  if (flag('assemble-only', null) === null) {
    const server = await serve(SITE);
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
    const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, locale: 'en-US' });
    await context.addInitScript(dilate, { slow: SLOW, clock: film.clock || '09:41' });
    if (film.routes) await film.routes(context);
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('page:', error.message));
    await page.goto(`${base}/demo/index.html`);
    await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.sync && window.Nordlys.dashboard);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Animation.enable');
    await page.evaluate(() => { Nordlys.bgEngine.frameBudget = () => 1000 / 60; Nordlys.setTheme('aurora-void'); Nordlys.config.bgMode = 'aurora'; Nordlys.config.onePageFit = true; Nordlys.saveConfig(); location.reload(); });
    await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.dashboard);
    await page.evaluate(filmOverlay);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { Nordlys.bgEngine.frameBudget = () => 1000 / 60; document.documentElement.style.scrollBehavior = 'auto'; });
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
    if (film.prepare) await film.prepare({ page, js: (fn, arg) => page.evaluate(fn, arg), music });
    await page.mouse.move(1100, 620);
    await page.waitForTimeout(2000 * SLOW / 2);
    await shoot(page, cdp);
    await browser.close();
    server.close();
  }
  if (!ONLY) assemble();
})().catch((error) => { console.error(error); process.exit(1); });
