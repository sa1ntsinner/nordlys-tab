/* Records the promo video cut to a piece of music, not the other way round.

   node tools/video/record3.cjs <map.json> <music.wav> <out.mp4>
        [--from 0] [--to <end>] [--size 4k|1080] [--slow 6]

   The music is finished before filming starts; nothing is added to it.
   music-map.py finds its beats, bars, accents, sections and drops, and every
   change in the picture is put on one of them: the dashboard arrives on the
   first drop, cards land on the one, the skies change on the beat in the
   second drop, the page goes quiet with the breakdown. Actions that need a
   run-up (a drag, typing) start early so that what shows lands on the beat.

   The page is filmed slowed down (stage.cjs), as in record2.cjs, and put
   back at real speed. Afterwards the picture is measured against the beats
   (sync-check.cjs): the few frames the page takes to answer are taken up by
   delaying the music as a whole, never by moving a note. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve, dilate, overlay } = require('./stage.cjs');
const { seedDashboard } = require('../artwork/dashboard-seed.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SITE = path.join(ROOT, '.site-dist');
const args = process.argv.slice(2);
const [mapFile, musicFile, outArg] = args;
const out = path.resolve(outArg || path.join(ROOT, 'docs/video/nordlys-youtube-4k.mp4'));
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SLOW = Number(flag('slow', 6));
const SIZE = flag('size', '4k');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VIEW = { width: 1440, height: 810 };
const SCALE = SIZE === '4k' ? 3840 / 1440 : 1920 / 1440;
const FRAME = { width: Math.round(VIEW.width * SCALE), height: Math.round(VIEW.height * SCALE) };
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'nordlys-video3-'));

const MAP = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const FROM = Number(flag('from', 0));
const TO = Number(flag('to', MAP.duration));
const LENGTH = TO - FROM;
const BEAT = 60 / MAP.tempo;
const BAR = BEAT * 4;
// Times in the film start at the excerpt's start.
const inWindow = (t) => t >= FROM - 1e-3 && t <= TO + 1e-3;
const local = (t) => t - FROM;
const BEATS = MAP.beats.filter(inWindow).map(local);
const DOWN = MAP.downbeats.filter(inWindow).map(local);
const ACCENTS = MAP.accents.filter((a) => inWindow(a.t)).map((a) => ({ t: local(a.t), s: a.s }));
const DROPS = MAP.drops.filter(inWindow).map(local);
const SECTIONS = MAP.sections.map((s) => ({ ...s, start: local(s.start), end: local(s.end) })).filter((s) => s.end > 0 && s.start < LENGTH);

/* The shape of the excerpt, read from the music: where the drops are, the
   quietest stretch between them, and where it winds down. */
function phases() {
  const d1 = DROPS[0] ?? DOWN[Math.min(8, DOWN.length - 1)];
  const near = (t) => DOWN.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), DOWN[0]);
  // Four bars of build where the intro is long enough, two where it is short.
  const build1 = Math.max(0, near(d1 - (d1 >= 8 * BAR ? 4 : 2) * BAR));
  /* The breakdown is the quietest stretch after the first drop (a rise in
     energy inside a drop is not a second drop), and the second drop is the
     first one after it. */
  const candidates = SECTIONS.filter((s) => s.start >= d1 + 4 * BAR && s.start <= LENGTH - 8 * BAR && s.end - s.start >= 2 * BAR);
  const quiet = candidates.sort((x, y) => x.energy - y.energy)[0];
  let breakStart = null, breakEnd = null;
  let d2 = quiet ? DROPS.find((t) => t >= quiet.start + BAR) : undefined;
  if (quiet && quiet.energy < 0.8) {
    breakStart = near(quiet.start);
    d2 = d2 ?? near(quiet.end);
    breakEnd = near(Math.max(breakStart + 2 * BAR, d2 - 2 * BAR));
  } else d2 = undefined;
  const last = SECTIONS[SECTIONS.length - 1];
  let outro = near(Math.max((d2 ?? d1) + 8 * BAR, LENGTH - 4 * BAR));
  if (last && last.energy < 0.6 && last.start > (d2 ?? d1) + 4 * BAR) outro = near(last.start);
  outro = Math.min(outro, near(LENGTH - 2 * BAR));
  return { build1, d1, breakStart, breakEnd, d2, outro, end: LENGTH };
}

const INTRO = '<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>A new tab page for your day</p>';
const OUTRO = '<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>Free on the Chrome Web Store</p><div class="tags"><span>No account</span><span>No tracking</span><span>Open source</span></div>';

/* A soft white flash for the biggest arrivals, drawn into the page. */
function flashLayer() {
  const layer = Object.assign(document.createElement('div'), { id: 'pv-flash' });
  layer.style.cssText = 'position:fixed;inset:0;z-index:2147483599;pointer-events:none;background:radial-gradient(70% 60% at 50% 45%,rgba(255,255,255,.34),rgba(255,255,255,0));opacity:0';
  document.body.append(layer);
  window.__pv.flash = () => layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
}

async function film(page, P) {
  const marks = [];
  let t0 = 0;
  const vnow = () => (Date.now() - t0) / 1000 / SLOW;
  const vwait = (seconds) => page.waitForTimeout(Math.max(0, seconds * 1000 * SLOW));
  const until = async (t) => { const left = t - vnow(); if (left > 0) await vwait(left); };
  // A visible change that should sit on t: written down to be checked later.
  const mark = (t, kind = 'switch') => marks.push({ at: t, kind });
  const js = (fn, arg) => page.evaluate(fn, arg);
  const say = (title, eyebrow) => js(([t, e]) => window.__pv.caption(t, e), [title, eyebrow]);
  const card = (html) => js((h) => window.__pv.card(h), html);
  const pointer = (on) => js((v) => window.__pv.pointer(v), on);
  const flash = () => js(() => window.__pv.flash());
  let mouse = { x: 1100, y: 600 };
  const glide = async (x, y, seconds = 0.6) => {
    const from = { ...mouse };
    const steps = Math.max(8, Math.round(seconds * 40));
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await vwait(seconds / steps);
    }
    mouse = { x, y };
  };
  const centre = async (locator) => { const b = await locator.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  // Glide to a control so that the press lands exactly on t.
  const clickOn = async (t, locator, travel = 0.45) => {
    const [x, y] = await centre(locator);
    await until(t - travel); await glide(x, y, travel - 0.02);
    await until(t); await page.mouse.down(); mark(t, 'tick'); await vwait(0.05); await page.mouse.up();
  };
  // Type so that each character falls on a subdivision, the last on `end`.
  const typeTo = async (text, end, step = BEAT / 4) => {
    const start = end - (text.length - 1) * step;
    for (const [i, ch] of [...text].entries()) { await until(start + i * step); await page.keyboard.type(ch); }
  };
  const scene = (key) => js((k) => { Nordlys.config.bgMode = k; Nordlys.saveConfig(); Nordlys.updateBackgroundMode(); }, key);
  const theme = (key) => js((k) => { Nordlys.setTheme(k); Nordlys.saveConfig(); }, key);
  const downIn = (a, b) => DOWN.filter((t) => t >= a - 1e-3 && t < b - 1e-3);
  const beatsIn = (a, b) => BEATS.filter((t) => t >= a - 1e-3 && t < b - 1e-3);
  const q = page.locator('#q');
  const { build1, d1, breakStart, breakEnd, d2, outro, end } = P;

  t0 = Date.now();
  // ── Opening: the name, on the first accent ──
  const first = ACCENTS.find((a) => a.s > 0.35 && a.t < build1 - BAR)?.t ?? DOWN[0];
  if (build1 >= BAR) {
    await until(first ?? 0); await card(INTRO); mark(first ?? 0);
    await until(build1); await card(null); mark(build1);
  }
  await pointer(true);
  await say('Your bookmarks, in folders', 'Nordlys');

  // ── The build: a folder carried across, landing on the one ──
  const buildDowns = downIn(build1, d1);
  if (buildDowns.length >= 2) {
    const enter = buildDowns[buildDowns.length >= 3 ? 1 : 0];
    await until(enter - 0.02); await js(() => Nordlys.grid.arrange.enter()); mark(enter);
    await say('Put them where you want them');
    const daily = page.locator('#board .cat b', { hasText: 'Daily' }).first();
    const work = page.locator('#board .cat b', { hasText: 'Work' }).first();
    const [dx, dy] = await centre(daily);
    const wb = await work.boundingBox();
    const land = buildDowns[buildDowns.length - 1];
    await glide(dx - 10, dy, 0.4);
    await page.mouse.down();
    await glide(dx + 20, dy + 12, 0.1);
    await until(land - 1.3); await glide(wb.x + wb.width * 0.6, wb.y + 40, 1.25);
    await until(land); await page.mouse.up(); mark(land, 'tick');
    await clickOn(d1 - 2 * BEAT, page.locator('#arrange-done'), 0.35);
  }
  await glide(1150, 260, 0.4);
  await pointer(false);

  // ── First drop: the dashboard arrives ──
  const drop1End = breakStart ?? outro;
  await until(d1 - 0.02);
  await js(seedDashboard, 'video'); await flash(); mark(d1, 'impact');
  await say('A dashboard for your day', 'Free');
  const downs1 = downIn(d1 + BAR * 0.5, drop1End);
  let k = 0;
  const nextDown = () => downs1[k++];
  // Wait for the fit to settle before anything is picked up.
  await vwait(0.5);
  await pointer(true);
  let t = nextDown();
  if (t != null) {
    // A card carried onto another: the swap lands on the one.
    const head = page.locator('#dash .dash-card[data-type="clocks"] .dash-head h2');
    const target = page.locator('#dash .dash-card[data-type="countdown"]');
    const [hx, hy] = await centre(head);
    const own = await page.locator('#dash .dash-card[data-type="clocks"]').boundingBox();
    const tb = await target.boundingBox();
    await until(t - 1.3); await glide(hx - 20, hy, 0.3); await page.mouse.down();
    await glide(hx - 10, hy + 8, 0.08);
    await glide(hx - 20 + (tb.x - own.x), hy + (tb.y - own.y), 0.85);
    await until(t); await page.mouse.up(); mark(t, 'tick');
  }
  t = nextDown();
  if (t != null) {
    // Stretched by the corner, let go on the one.
    const tasks = page.locator('#dash .dash-card[data-type="tasks"]');
    await tasks.hover();
    const corner = await tasks.locator('.dash-resize').boundingBox();
    await until(t - 1.1); await glide(corner.x + 9, corner.y + 9, 0.3);
    await page.mouse.down();
    await glide(corner.x + 20, corner.y + 100, 0.7);
    await until(t); await page.mouse.up(); mark(t, 'tick');
    await say('Move them, stretch them');
  }
  t = nextDown();
  if (t != null) {
    // A task in plain words; Enter on the one.
    const add = page.locator('#dash .dash-card[data-type="tasks"]').getByRole('textbox', { name: 'Add a task' });
    await clickOn(t - BAR + BEAT * 0.5, add, 0.35);
    await say('“tomorrow”, “!” for important', 'Tasks');
    await typeTo('Call Anna tomorrow !', t - BEAT / 2, BEAT / 8);
    await until(t); await page.keyboard.press('Enter'); mark(t);
  }
  t = nextDown();
  if (t != null) await clickOn(t, page.locator('#dash .dash-card[data-type="habits"] .dash-habit-day.is-today').first(), 0.45);
  await pointer(false);
  // Whatever is left of the drop: a layout on every other beat, then the corners.
  const rest = beatsIn(downs1[k] ?? drop1End, drop1End).filter((_, i) => i % 2 === 0);
  const presets = ['calm', 'travel', 'minimal', 'deep', 'planner'];
  if (rest.length) await say('Five layouts to start from', 'Dashboard');
  for (const [i, bt] of rest.entries()) {
    if (i < presets.length) { await until(bt - 0.02); await js(seedDashboard, presets[i]); mark(bt); }
    else if (i === presets.length) {
      await until(bt - 0.02);
      await js(() => { const n = Nordlys; n.config.cornerShape = 'smooth'; n.config.cardRadius = 30; document.documentElement.dataset.corners = 'smooth'; document.documentElement.style.setProperty('--card-radius', '30px'); n.saveConfig(); });
      mark(bt); await say('Corners like app icons', 'Appearance');
    } else if (i === presets.length + 1) { await until(bt - 0.02); await theme('oled-obsidian'); await scene('drift'); mark(bt); await say('Black for OLED, or any of 21', 'Themes'); }
    else {
      // Then a theme on every other beat until the drop gives way.
      // Light and dark in turn, so each change reads at a glance.
      const themes = ['porcelain-light', 'gruvbox-dark', 'sakura-daylight', 'catppuccin-mocha', 'solarized-light', 'cyberpunk-neon', 'sage-light', 'tokyo-night', 'gruvbox-light', 'oled-obsidian'];
      const th = themes[(i - presets.length - 2) % themes.length];
      await until(bt - 0.02); await theme(th); mark(bt);
    }
  }

  // ── Breakdown: one thing at a time ──
  if (breakStart != null) {
    await until(breakStart - 0.02);
    await say(null);
    await js(() => Nordlys.focusMode.show()); mark(breakStart);
    await vwait(0.4);
    await page.locator('#focus-mode .fm-intent').fill('');
    const bd = downIn(breakStart, breakEnd);
    await pointer(true);
    await clickOn(breakStart + BEAT * 2, page.locator('#focus-mode .fm-intent'), 0.4);
    await typeTo('The release notes', (bd[1] ?? breakStart + BAR) - BEAT, BEAT / 4);
    // The timer starts on the one; the rain comes in half a bar later.
    if (bd[1] != null) await clickOn(bd[1], page.locator('#focus-mode .fm-go'), 0.5);
    if (bd[1] != null) await clickOn(bd[1] + 2 * BEAT, page.locator('#focus-mode').getByRole('radio', { name: 'Rain' }), 0.5);
    await glide(1300, 700, 0.8);
    await pointer(false);
    await until(breakEnd - 0.02);
    await js(() => { Nordlys.focusMode.hide(); Nordlys.dashboard.sounds?.stop?.(); Nordlys.dashboard.setOn(false); }); mark(breakEnd);
  }

  // ── Second build: the search box, typed in time ──
  if (d2 != null) {
    const bd = downIn(breakEnd ?? d2 - 4 * BAR, d2);
    await say('Math in the search box', 'And commands');
    await pointer(true);
    await clickOn((bd[0] ?? d2 - 2 * BAR) + BEAT * 0.5, q, 0.4);
    await pointer(false);
    const mid = bd[Math.floor(bd.length / 2)] ?? d2 - BAR;
    await typeTo('1920 / 16 * 9', mid - BEAT, BEAT / 4);
    await until(mid - 0.02); await page.fill('#q', ''); mark(mid);
    await typeTo('> sky polaris', d2 - BEAT, BEAT / 4);
    // ── Second drop: Enter is the drop ──
    await until(d2 - 0.02); await page.keyboard.press('Enter'); await flash(); mark(d2, 'impact');
    await q.blur();
    await js(() => document.querySelectorAll('#toast-dock > *').forEach((x) => x.remove()));
    await say('Nine skies, drawn live', 'Backgrounds');
    const looks = [['halo', 'nord-frost'], ['silk', 'catppuccin-mocha'], ['pillars', 'sunset-amber'], ['nacre', 'peach-sunset'], ['baikal', 'aurora-void'], ['drift', 'oled-obsidian'], ['horizon', 'porcelain-light'], ['aurora', 'aurora-void']];
    const beats2 = beatsIn(d2 + BEAT, outro);
    // A new sky on every beat while it lasts, then the profiles on the one.
    const skyBeats = beats2.slice(0, looks.length);
    for (const [i, bt] of skyBeats.entries()) { await until(bt - 0.02); await js(([s, th]) => { Nordlys.setTheme(th); Nordlys.config.bgMode = s; Nordlys.saveConfig(); Nordlys.updateBackgroundMode(); }, looks[i]); mark(bt); }
    const after = downIn((skyBeats[skyBeats.length - 1] ?? d2) + BEAT / 2, outro);
    if (after[0] != null) {
      await until(after[0] - 0.02);
      await js(async () => {
        const s = Nordlys.sync; const firstProfile = s.list()[0]; s.rename(firstProfile.id, 'Work');
        await s.create({ name: 'Home', from: 'copy' });
        Nordlys.setTheme('gruvbox-dark'); Nordlys.config.bgMode = 'nacre'; Nordlys.saveConfig(); Nordlys.updateBackgroundMode();
        document.querySelectorAll('#toast-dock > *').forEach((x) => x.remove());
      });
      mark(after[0]); await say('Work and Home, synced', 'Profiles');
    }
    if (after[1] != null) { await until(after[1] - 0.02); await js(async () => { const s = Nordlys.sync; await s.switchTo(s.list()[0].id, { undo: false }); Nordlys.dashboard.setOn(true); await Nordlys.dashboard.render(); }); mark(after[1]); }
    if (after[2] != null) {
      // The apps it connects to, as Settings lists them.
      await until(after[2] - 0.02);
      await js(() => { Nordlys.settings.open('dashboard'); });
      mark(after[2]); await say('Tasks from the apps you use', 'Connected apps');
      await vwait(0.3);
      await js(() => document.querySelector('.dash-connections')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
    if (after[3] != null) { await until(after[3] - 0.02); await js(() => Nordlys.settings.close()); mark(after[3]); await say(null); }
  }

  // ── The end, on the one ──
  await until(outro - 0.02);
  await say(null);
  await card(OUTRO); mark(outro, 'impact');
  await until(end);
  return { tempo: MAP.tempo, seconds: end, phases: P, hits: marks };
}

(async () => {
  if (!fs.existsSync(path.join(SITE, 'demo/index.html'))) throw new Error('Run `npm run site` first.');
  const P = phases();
  console.log('phases', JSON.stringify(Object.fromEntries(Object.entries(P).map(([key, v]) => [key, v == null ? null : +v.toFixed(2)]))));
  const server = await serve(SITE);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, locale: 'en-US' });
  await context.addInitScript(dilate, { slow: SLOW, clock: '09:41' });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('page:', error.message));
  await page.goto(`${base}/demo/index.html`);
  await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.sync && window.Nordlys.dashboard);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  await page.evaluate(() => { Nordlys.bgEngine.frameBudget = () => 1000 / 60; Nordlys.setTheme('aurora-void'); Nordlys.config.bgMode = 'aurora'; Nordlys.config.onePageFit = true; Nordlys.saveConfig(); location.reload(); });
  await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.dashboard);
  await page.evaluate(overlay);
  await page.evaluate(flashLayer);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { Nordlys.bgEngine.frameBudget = () => 1000 / 60; document.documentElement.style.scrollBehavior = 'auto'; });
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  await page.mouse.move(1100, 600);
  // The aurora needs a moment to draw its ribbons before the first frame.
  await page.waitForTimeout(2500 * SLOW / 2);

  const frames = [];
  let index = 0;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(WORK, `f${String(index++).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: FRAME.width, maxHeight: FRAME.height, everyNthFrame: 1 });
  const started = Date.now() / 1000;
  const timeline = await film(page, P);
  await cdp.send('Page.stopScreencast');
  await browser.close();
  server.close();

  // Frames from the moment filming began, at the video's own speed.
  const kept = frames.filter((f) => f.t >= started - 1 / 60);
  const vt = (f) => (f.t - started) / SLOW;
  const list = kept.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0, (kept[i + 1] ? vt(kept[i + 1]) : vt(f) + 1 / 60) - Math.max(0, vt(f))).toFixed(5)}`).join('\n') + `\nfile '${kept[kept.length - 1].file.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(WORK, 'list.txt'), list);
  console.log(`${kept.length} frames over ${vt(kept[kept.length - 1]).toFixed(1)} s`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const silent = path.join(WORK, 'picture.mp4');
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'list.txt'),
    '-vf', `fps=60,scale=${FRAME.width}:${FRAME.height}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', SIZE === '4k' ? '17' : '18', '-profile:v', 'high', '-r', '60', '-t', LENGTH.toFixed(3), silent], { stdio: 'inherit' });
  const timelineFile = out.replace(/\.mp4$/, '.timeline.json');
  fs.writeFileSync(timelineFile, JSON.stringify(timeline, null, 1));

  // How late the picture answers, measured; the music waits by as much.
  let delay = 0;
  try {
    const report = execFileSync(process.execPath, [path.join(__dirname, 'sync-check.cjs'), silent, timelineFile], { env: process.env }).toString();
    const offsets = [...report.matchAll(/(switch|impact)\s+(-?\d+) ms/g)].map((m) => Number(m[2])).filter((ms) => Math.abs(ms) < 150).sort((a, b) => a - b);
    if (offsets.length) delay = offsets[Math.floor(offsets.length / 2)] / 1000;
    console.log(report.split('\n').slice(-2).join('\n'), `-> music delayed ${(delay * 1000).toFixed(0)} ms`);
  } catch (error) { console.error('sync check failed', error.message); }
  const fadeIn = FROM > 0 ? 0.25 : 0, fadeOut = 1.6;
  const audioFilter = [
    `atrim=start=${FROM.toFixed(3)}:end=${TO.toFixed(3)}`, 'asetpts=PTS-STARTPTS',
    delay > 0 ? `adelay=${Math.round(delay * 1000)}:all=1` : delay < 0 ? `atrim=start=${(-delay).toFixed(3)},asetpts=PTS-STARTPTS` : null,
    fadeIn ? `afade=t=in:d=${fadeIn}` : null,
    `afade=t=out:st=${(LENGTH - fadeOut).toFixed(3)}:d=${fadeOut}`
  ].filter(Boolean).join(',');
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', musicFile, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-af', audioFilter, '-c:a', 'aac', '-b:a', '256k', '-t', LENGTH.toFixed(3), '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(WORK, { recursive: true, force: true });
  console.log(`wrote ${path.relative(ROOT, out)}`);
})().catch((error) => { console.error(error); process.exit(1); });
