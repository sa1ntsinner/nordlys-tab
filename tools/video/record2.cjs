/* Records the promo videos from the live demo (.site-dist/, built by
   `npm run site`), in 4K and at 60 frames a second, with music made for
   the same timeline (score.cjs).

   The page is slowed down while it is filmed: its clocks, timers, frames
   and animations all run SLOW times slower, so Chrome has time to hand
   over every 4K frame, and the frames are put back at real speed after.
   Every action is placed on a beat of the music and written down, and the
   music puts an accent on the same moment.

   node tools/video/record2.cjs <youtube|store> <out.mp4> [--slow 6] [--size 4k|1080] */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const SITE = path.join(ROOT, '.site-dist');
const args = process.argv.slice(2);
const cut = args[0] || 'youtube';
const out = path.resolve(args[1] || path.join(ROOT, 'docs/video', `nordlys-${cut}.mp4`));
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SLOW = Number(flag('slow', 6));
const SIZE = flag('size', '4k');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VIEW = { width: 1440, height: 810 };
const SCALE = SIZE === '4k' ? 3840 / 1440 : 1920 / 1440;
const FRAME = { width: Math.round(VIEW.width * SCALE), height: Math.round(VIEW.height * SCALE) };
const BPM = 112;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'nordlys-video-'));

const { serve, dilate, overlay } = require('./stage.cjs');

const INTRO = '<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>A new tab page for Chrome</p>';
const OUTRO = '<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>Free on the Chrome Web Store</p><div class="tags"><span>No account</span><span>No tracking</span><span>Open source</span></div>';

const { seedDashboard } = require('../artwork/dashboard-seed.cjs');

async function film(page, short) {
  const hits = [];
  const sections = [];
  let t0 = 0;
  const vnow = () => (Date.now() - t0) / 1000 / SLOW;
  const vwait = (seconds) => page.waitForTimeout(Math.max(0, seconds * 1000 * SLOW));
  // Waits until the given bar and beat of the music.
  const at = async (bar, beat = 0) => { const t = bar * BAR + beat * BEAT; const left = t - vnow(); if (left > 0) await vwait(left); return t; };
  const hit = (kind) => hits.push({ at: Math.round(vnow() * 1000) / 1000, kind });
  const section = (bar, kind) => sections.push({ at: bar * BAR, kind });
  const js = (fn, arg) => page.evaluate(fn, arg);
  const say = (title, eyebrow) => js(([t, e]) => window.__pv.caption(t, e), [title, eyebrow]);
  const card = (html) => js((h) => window.__pv.card(h), html);
  const pointer = (on) => js((v) => window.__pv.pointer(v), on);
  let mouse = { x: 1100, y: 600 };
  // The pointer glides with ease-in-out over the given time.
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
  const click = async (locator, kind = 'tick', seconds = 0.5) => { const [x, y] = await centre(locator); await glide(x, y, seconds); await page.mouse.down(); hit(kind); await vwait(0.06); await page.mouse.up(); };
  const typeSlow = async (text, per = 0.055) => { for (const ch of text) { await page.keyboard.type(ch); await vwait(per); } await page.evaluate(() => window.scrollTo(0, 0)); };
  const scene = (key) => js((k) => { Nordlys.config.bgMode = k; Nordlys.saveConfig(); Nordlys.updateBackgroundMode(); }, key);
  const theme = (key) => js((k) => { Nordlys.setTheme(k); Nordlys.saveConfig(); }, key);
  const q = page.locator('#q');

  t0 = Date.now();
  // ── Opening ──
  section(0, 'intro');
  await card(INTRO);
  await at(short ? 0 : 1, 2); hit('rise');
  await at(short ? 1 : 2);
  hit('impact');
  await card(null);
  section(short ? 1 : 2, 'groove');
  await pointer(true);
  await say('Your bookmarks, in folders', 'Nordlys');
  await glide(760, 500, 1.2);
  // ── Arrange ──
  await at(short ? 2 : 4);
  await js(() => Nordlys.grid.arrange.enter()); hit('switch');
  await say('Drag them where you want them');
  const daily = page.locator('#board .cat b', { hasText: 'Daily' }).first();
  const social = page.locator('#board .cat b', { hasText: 'Work' }).first();
  const [dx, dy] = await centre(daily);
  const sb = await social.boundingBox();
  await glide(dx - 10, dy, 0.5);
  await page.mouse.down();
  await glide(dx + 20, dy + 12, 0.1);
  await glide(sb.x + sb.width * 0.6, sb.y + 40, short ? 0.9 : 1.4);
  await at(short ? 3 : 5, 2);
  await page.mouse.up(); hit('tick');
  await vwait(0.5);
  await click(page.locator('#arrange-done'), 'tick', 0.4);
  await glide(1150, 260, 0.5);
  await pointer(false);
  // ── Skies ──
  await at(short ? 3 : 6, 2);
  await say('Nine skies, drawn live', 'Backgrounds');
  const skies = short ? ['polaris', 'silk'] : ['polaris', 'halo', 'silk', 'baikal'];
  for (const [i, key] of skies.entries()) { await at((short ? 3 : 6) + Math.floor((i + 1) / 2), ((i + 1) % 2) * 2); await scene(key); hit('switch'); }
  // ── Themes ──
  await at(short ? 4 : 8, short ? 2 : 0);
  await theme('oled-obsidian'); await scene('drift'); hit('switch');
  await say('OLED black', '21 themes');
  if (!short) {
    await at(8, 2); await theme('porcelain-light'); await scene('horizon'); hit('switch');
    await at(9, 0); await theme('oled-obsidian'); await scene('drift'); hit('switch');
    // ── Search ──
    await at(9, 2);
    await say('The search box does math', 'And commands');
    await pointer(true);
    await click(q, 'tick', 0.4);
    await pointer(false);
    await typeSlow('1920 / 16 * 9', 0.07);
    await at(10, 2); hit('tick');
    await at(11, 0);
    await page.fill('#q', '');
    await typeSlow('> sky polaris', 0.06);
    await at(11, 2); await page.keyboard.press('Enter'); hit('rise');
    await page.locator('#q').blur();
  }
  // ── The dashboard arrives ──
  const drop = short ? 6 : 12;
  if (short) { await at(5, 0); hit('rise'); }
  await at(drop);
  section(drop, 'drop');
  hit('impact');
  await say('A dashboard, when you want one', 'Dashboard');
  await js(seedDashboard, 'video');
  // Let the page settle into its fit before anything is picked up.
  await vwait(0.6);
  await page.waitForFunction(() => { const r = document.querySelector('#dash .dash-card')?.getBoundingClientRect(); const last = window.__lastBox; window.__lastBox = r && `${r.left},${r.top},${r.width}`; return r && last === window.__lastBox; }, null, { polling: 400 * SLOW });
  // Drag the timer across.
  await pointer(true);
  const timerHead = page.locator('#dash .dash-card[data-type="clocks"] .dash-head h2');
  const focusCard = page.locator('#dash .dash-card[data-type="countdown"]');
  await at(drop + 1);
  const [tx, ty] = await centre(timerHead);
  const fb = await focusCard.boundingBox();
  const own = await page.locator('#dash .dash-card[data-type="clocks"]').boundingBox();
  await glide(tx - 20, ty, 0.5);
  await page.mouse.down(); hit('tick');
  await glide(tx - 10, ty + 8, 0.1);
  // The card travels by exactly the distance between the two, so it lands squarely.
  await glide(tx - 20 + (fb.x - own.x), ty + (fb.y - own.y), 1.0);
  await at(drop + 2); await page.mouse.up(); hit('tick');
  await vwait(0.5);
  if (!short) {
    // Stretch the note by its corner.
    const note = page.locator('#dash .dash-card[data-type="tasks"]');
    await note.hover();
    const corner = await note.locator('.dash-resize').boundingBox();
    await at(drop + 2, 2);
    await glide(corner.x + 9, corner.y + 9, 0.4);
    await page.mouse.down(); hit('tick');
    await glide(corner.x + 20, corner.y + 100, 0.9);
    await at(drop + 3); await page.mouse.up(); hit('tick');
    await say('Move them, stretch them');
  }
  // A task, typed in plain words.
  await at(short ? 8 : drop + 3, 2);
  await say('Tomorrow, today, “!” for important', 'Tasks');
  const add = page.locator('#dash .dash-card[data-type="tasks"]').getByRole('textbox', { name: 'Add a task' });
  await click(add, 'tick', 0.4);
  await typeSlow('Call Anna tomorrow !', 0.05);
  await at(short ? 9 : drop + 4, 2); await page.keyboard.press('Enter'); hit('switch');
  if (!short) {
    const today = page.locator('#dash .dash-card[data-type="habits"] .dash-habit-day.is-today').first();
    await at(drop + 5); await click(today, 'tick', 0.5);
  }
  // ── Focus mode ──
  const calm = short ? 10 : 18;
  await at(calm - 1, 2); hit('rise');
  await at(calm);
  section(calm, 'calm');
  await say(null);
  await js(() => Nordlys.focusMode.show()); hit('switch');
  await vwait(0.7);
  await page.locator('#focus-mode .fm-intent').fill('');
  await pointer(true);
  await click(page.locator('#focus-mode .fm-intent'), 'tick', 0.5);
  await typeSlow('The release notes', 0.05);
  await click(page.locator('#focus-mode').getByRole('radio', { name: 'Rain' }), 'tick', 0.5);
  await at(calm + 1);
  await click(page.locator('#focus-mode .fm-go'), 'switch', 0.5);
  await glide(1300, 700, 0.8);
  await pointer(false);
  await at(short ? calm + 1 : calm + 3, 2);
  await js(() => { Nordlys.focusMode.hide(); Nordlys.dashboard.sounds.stop(); });
  if (!short) {
    // ── Layouts, corners, profiles ──
    const back = calm + 4;
    await at(back); section(back, 'drop'); hit('impact');
    await say('Start from a layout', 'Five of them');
    for (const [i, preset] of ['calm', 'travel', 'minimal', 'deep'].entries()) {
      await at(back + Math.floor(i / 2), (i % 2) * 2);
      await js(seedDashboard, preset); hit('switch');
    }
    await at(back + 2);
    await js(() => { const n = Nordlys; n.config.cornerShape = 'smooth'; n.config.cardRadius = 30; document.documentElement.dataset.corners = 'smooth'; document.documentElement.style.setProperty('--card-radius', '30px'); n.saveConfig(); }); hit('switch');
    await say('Corners like app icons', 'Appearance');
    await at(back + 3);
    await say('Work and Home, synced through Chrome', 'Profiles');
    await js(async () => {
      const s = Nordlys.sync; const first = s.list()[0]; s.rename(first.id, 'Work');
      await s.create({ name: 'Home', from: 'copy' });
      Nordlys.setTheme('gruvbox-dark'); Nordlys.config.bgMode = 'nacre'; Nordlys.saveConfig(); Nordlys.updateBackgroundMode();
      document.querySelectorAll('#toast-dock > *').forEach((t) => t.remove());
    }); hit('switch');
    await at(back + 4);
    await js(async () => { const s = Nordlys.sync; await s.switchTo(s.list()[0].id, { undo: false }); }); hit('switch');
  }
  // ── End ──
  const end = short ? 12 : calm + 10;
  await at(end - 1, 2); hit('rise');
  await at(end); section(end, 'outro'); hit('impact');
  await say(null);
  await card(OUTRO);
  await at(end + 2);
  return { bpm: BPM, seconds: (end + 2) * BAR, sections, hits };
}

(async () => {
  if (!fs.existsSync(path.join(SITE, 'demo/index.html'))) throw new Error('Run `npm run site` first.');
  const server = await serve(SITE);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, locale: 'en-US' });
  await context.addInitScript(dilate, SLOW);
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('page:', error.message));
  await page.goto(`${base}/demo/index.html`);
  await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.sync && window.Nordlys.dashboard);
  await page.evaluate(overlay);
  await page.evaluate(() => document.fonts.ready);
  // Everything that animates in CSS runs slowed with the rest; the sky may draw every frame.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  /* One page fit on: the dashboard and the folders always fit the frame,
     so the camera never scrolls. */
  await page.evaluate(() => { Nordlys.bgEngine.frameBudget = () => 1000 / 60; Nordlys.setTheme('aurora-void'); Nordlys.config.bgMode = 'aurora'; Nordlys.config.onePageFit = true; Nordlys.saveConfig(); location.reload(); });
  await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.dashboard);
  await page.evaluate(overlay);
  await page.evaluate(() => { Nordlys.bgEngine.frameBudget = () => 1000 / 60; document.documentElement.style.scrollBehavior = 'auto'; });
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  await page.mouse.move(1100, 600);
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
  const timeline = await film(page, cut === 'store');
  await cdp.send('Page.stopScreencast');
  await browser.close();
  server.close();

  // Real seconds back to the video's own.
  const first = frames.find((f) => f.t >= started - 0.5) || frames[0];
  const kept = frames.filter((f) => f.t >= first.t);
  const vt = (f) => (f.t - first.t) / SLOW;
  const span = vt(kept[kept.length - 1]);
  console.log(`${kept.length} frames over ${span.toFixed(1)} s of video (${(kept.length / span).toFixed(1)} fps before resampling)`);
  const list = kept.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${((kept[i + 1] ? vt(kept[i + 1]) : vt(f) + 1 / 60) - vt(f)).toFixed(5)}`).join('\n') + `\nfile '${kept[kept.length - 1].file.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(WORK, 'list.txt'), list);
  // The music follows the timeline, shifted by where filming began.
  const shift = (started - first.t) / SLOW;
  timeline.hits = timeline.hits.map((h) => ({ ...h, at: h.at + shift }));
  timeline.sections = timeline.sections.map((s) => ({ ...s, at: s.at + shift }));
  timeline.seconds = Math.min(span, timeline.seconds + shift);
  fs.writeFileSync(path.join(WORK, 'timeline.json'), JSON.stringify(timeline, null, 1));
  fs.writeFileSync(out.replace(/\.mp4$/, '.timeline.json'), JSON.stringify(timeline, null, 1));
  const music = path.join(WORK, 'music.wav');
  execFileSync(process.execPath, [path.join(__dirname, 'score.cjs'), path.join(WORK, 'timeline.json'), music], { stdio: 'inherit' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'list.txt'), '-i', music,
    '-vf', `fps=60,scale=${FRAME.width}:${FRAME.height}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', SIZE === '4k' ? '17' : '18', '-profile:v', 'high', '-r', '60',
    '-c:a', 'aac', '-b:a', '256k', '-t', timeline.seconds.toFixed(2), '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(WORK, { recursive: true, force: true });
  // The page answers a few frames after the action; the music waits for it.
  const synced = out.replace(/\.mp4$/, '.synced.mp4');
  execFileSync(process.execPath, [path.join(__dirname, 'rescore.cjs'), out, synced], { stdio: 'inherit', env: { ...process.env, FFMPEG } });
  fs.renameSync(synced, out);
  console.log(`wrote ${path.relative(ROOT, out)}`);
})().catch((error) => { console.error(error); process.exit(1); });
