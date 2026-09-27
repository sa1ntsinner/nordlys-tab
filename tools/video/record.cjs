/* Records the promo videos from the live demo the website runs (.site-dist/,
   built by `npm run site`). Every frame is the real page: the scenes drive it
   with the mouse and keyboard, and a caption and a pointer are drawn into it.
   Frames come from Chrome's screencast with their own timestamps, and
   ffmpeg turns them into a steady 30 fps video with the music under it.

   node tools/video/record.cjs <youtube|store> <out.mp4> */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const SITE = path.join(ROOT, '.site-dist');
const cut = process.argv[2] || 'youtube';
const out = path.resolve(process.argv[3] || path.join(ROOT, 'docs/video', `nordlys-${cut}.mp4`));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const WORK = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'nordlys-video-'));
/* Laid out at a laptop size and drawn at 4/3 scale: 1920 x 1080 frames that
   show the board at the size people see it. */
const SIZE = { width: 1440, height: 810 };
const SCALE = 4 / 3;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.jpg': 'image/jpeg' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      let file = decodeURIComponent(request.url.split('?')[0]);
      if (file.endsWith('/')) file += 'index.html';
      fs.readFile(path.join(SITE, file), (error, data) => {
        if (error) { response.writeHead(404); response.end(); return; }
        response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
        response.end(data);
      });
    }).listen(0, () => resolve(server));
  });
}

/* Drawn into the page: a caption at the upper left, where the board leaves room, a title card, a pointer. */
function overlay() {
  const style = document.createElement('style');
  style.textContent = `
    #pv-caption { position: fixed; left: 52px; top: 44px; z-index: 2147483600; pointer-events: none;
      font: 500 27px/1.2 "Outfit", system-ui, sans-serif; letter-spacing: -0.01em; color: #f1f5fb;
      padding: 14px 22px; border-radius: 18px; background: rgba(8, 11, 20, 0.62);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(210,222,245,.12), 0 30px 60px -20px rgba(0,0,0,.7);
      backdrop-filter: blur(18px); opacity: 0; transform: translateY(-12px); transition: opacity .6s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.32,.72,0,1); }
    #pv-caption.on { opacity: 1; transform: none; }
    #pv-caption small { display: block; margin-top: 4px; font: 400 17px/1.3 "Instrument Sans", system-ui, sans-serif; color: #a9b4c8; }
    #pv-card { position: fixed; inset: 0; z-index: 2147483601; display: grid; place-items: center; pointer-events: none;
      background: radial-gradient(90% 80% at 50% 45%, rgba(5,7,12,.55), rgba(5,7,12,.92)); opacity: 0; transition: opacity .9s cubic-bezier(.22,1,.36,1); }
    #pv-card.on { opacity: 1; }
    #pv-card .in { text-align: center; transform: translateY(18px) scale(.985); transition: transform 1.2s cubic-bezier(.32,.72,0,1); }
    #pv-card.on .in { transform: none; }
    #pv-card img { width: 88px; height: 88px; margin: 0 auto 26px; display: block; filter: drop-shadow(0 20px 40px rgba(53,214,192,.35)); }
    #pv-card h1 { margin: 0; font: 500 80px/1 "Outfit", system-ui, sans-serif; letter-spacing: -0.04em; color: #f3f6fb; }
    #pv-card p { margin: 22px 0 0; font: 400 28px/1.35 "Instrument Sans", system-ui, sans-serif; color: #b3bdd0; }
    #pv-card .tags { margin-top: 40px; display: flex; gap: 14px; justify-content: center; }
    #pv-card .tags span { padding: 10px 20px; border-radius: 999px; font: 500 19px/1 "Instrument Sans", system-ui, sans-serif; color: #dfe6f2; box-shadow: inset 0 0 0 1.5px rgba(210,222,245,.2); background: rgba(255,255,255,.04); }
    #pv-pointer { position: fixed; left: 0; top: 0; z-index: 2147483602; width: 30px; height: 30px; pointer-events: none;
      transform: translate(-100px, -100px); transition: opacity .3s; filter: drop-shadow(0 3px 6px rgba(0,0,0,.45)); }
    #pv-pointer.down svg { transform: scale(.88); transform-origin: 4px 4px; }
    #pv-pointer svg { transition: transform .12s; }
    #pv-pointer.hide { opacity: 0; }
  `;
  document.head.append(style);
  const caption = Object.assign(document.createElement('div'), { id: 'pv-caption' });
  const card = Object.assign(document.createElement('div'), { id: 'pv-card' });
  const pointer = Object.assign(document.createElement('div'), { id: 'pv-pointer', className: 'hide' });
  pointer.innerHTML = '<svg viewBox="0 0 30 30" width="30" height="30"><path d="M4 3l19 11-8.2 1.6L11 24z" fill="#fff" stroke="#0b0e16" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.append(caption, card, pointer);
  const move = (event) => { pointer.style.transform = `translate(${event.clientX - 4}px, ${event.clientY - 3}px)`; };
  document.addEventListener('mousemove', move, true);
  document.addEventListener('mousedown', () => pointer.classList.add('down'), true);
  document.addEventListener('mouseup', () => pointer.classList.remove('down'), true);
  window.__pv = {
    caption(title, sub) {
      if (!title) { caption.classList.remove('on'); return; }
      const show = () => { caption.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`; caption.classList.add('on'); };
      if (caption.classList.contains('on')) { caption.classList.remove('on'); setTimeout(show, 380); } else show();
    },
    card(html) {
      if (!html) { card.classList.remove('on'); return; }
      card.innerHTML = `<div class="in">${html}</div>`;
      requestAnimationFrame(() => card.classList.add('on'));
    },
    pointer(on) { pointer.classList.toggle('hide', !on); }
  };
}

const INTRO = '<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>A new tab page for Chrome</p>';
const OUTRO = '<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>Free on the Chrome Web Store</p><div class="tags"><span>No account</span><span>No tracking</span><span>Open source</span></div>';
const SKIES = [['polaris', 'Polaris'], ['halo', 'Halo'], ['pillars', 'Pillars'], ['nacre', 'Nacre'], ['silk', 'Silk'], ['baikal', 'Baikal'], ['drift', 'Contour'], ['horizon', 'Fjord'], ['aurora', 'Nordlys']];

async function scenes(page, short) {
  const wait = (ms) => page.waitForTimeout(ms);
  const say = (title, sub) => page.evaluate(([t, s]) => window.__pv.caption(t, s), [title, sub]);
  const card = (html) => page.evaluate((h) => window.__pv.card(h), html);
  const pointer = (on) => page.evaluate((v) => window.__pv.pointer(v), on);
  const app = (fn, arg) => page.evaluate(fn, arg);
  const glide = async (x, y, steps = 28) => { await page.mouse.move(x, y, { steps }); };
  const centre = async (locator) => { const box = await locator.boundingBox(); return [box.x + box.width / 2, box.y + box.height / 2]; };
  const scene = (key) => app((k) => { Nordlys.config.bgMode = k; Nordlys.saveConfig(); Nordlys.updateBackgroundMode(); }, key);
  const theme = (key) => app((k) => { Nordlys.setTheme(k); Nordlys.saveConfig(); }, key);

  // Intro
  await card(INTRO);
  await wait(short ? 2600 : 3600);
  await card(null);
  await wait(900);
  await say('Your bookmarks, in folders', 'Brought in from Chrome on first open');
  await glide(980, 520, 40);
  await pointer(true);
  await glide(760, 480, 40);
  await wait(short ? 1600 : 2600);

  // Arrange: carry a folder to the end of the row.
  await say('Drag a folder to move it', short ? '' : 'The board shows where it will land');
  await app(() => Nordlys.grid.arrange.enter());
  await wait(900);
  const daily = page.locator('#board .cat b', { hasText: 'Daily' }).first();
  const social = page.locator('#board .cat b', { hasText: 'Social' }).first();
  const [dx, dy] = await centre(daily);
  const socialBox = await social.boundingBox();
  await glide(dx - 10, dy, 30);
  await wait(300);
  await page.mouse.down();
  await glide(dx + 20, dy + 14, 4);
  await glide(socialBox.x + socialBox.width + 260, socialBox.y + 120, 60);
  await wait(700);
  await page.mouse.up();
  await wait(short ? 1400 : 1600);

  if (!short) {
    await say('Size and spacing in one panel', 'With Undo, if you went too far');
    const [sx, sy] = await centre(page.locator('#arrange-size'));
    await glide(sx, sy, 30);
    await page.mouse.click(sx, sy);
    await wait(700);
    const slider = page.locator('#arrange-tile-size');
    const box = await slider.boundingBox();
    const at = (value) => box.x + ((value - 56) / (110 - 56)) * box.width;
    await glide(at(78), box.y + box.height / 2, 20);
    await page.mouse.down();
    await glide(at(96), box.y + box.height / 2, 40);
    await wait(500);
    await glide(at(84), box.y + box.height / 2, 30);
    await page.mouse.up();
    await wait(1400);
  }
  const [ex, ey] = await centre(page.locator('#arrange-done'));
  await glide(ex, ey, 30);
  await page.mouse.click(ex, ey);
  await wait(700);
  await glide(1120, 290, 30);
  await pointer(false);

  // Skies
  const skies = short ? SKIES.filter(([k]) => ['polaris', 'nacre', 'silk', 'baikal', 'aurora'].includes(k)) : SKIES;
  for (const [index, [key, name]] of skies.entries()) {
    await scene(key);
    await say(index === 0 ? 'Nine animated backgrounds' : name, index === 0 ? name : '');
    await wait(short ? 1700 : 2500);
  }

  // Themes
  if (!short) {
    await say('21 themes, light and dark', 'The sky takes the colours too');
    for (const key of ['tokyo-night', 'porcelain-light', 'gruvbox-dark', 'dracula-velvet', 'aurora-void']) {
      await theme(key);
      await wait(2000);
    }
  }

  // Search box
  await say('The search box does math', short ? '' : 'And takes commands after >');
  await pointer(true);
  const [qx, qy] = await centre(page.locator('#q'));
  await glide(qx - 200, qy, 30);
  await page.mouse.click(qx - 200, qy);
  await pointer(false);
  await page.keyboard.type('1920 / 16 * 9', { delay: 110 });
  await wait(short ? 1800 : 2200);
  if (!short) {
    await page.fill('#q', '');
    await say('Commands after >', 'Change the sky, the theme, a folder');
    await page.keyboard.type('> sky halo', { delay: 120 });
    await wait(1400);
    await page.keyboard.press('Enter');
    await wait(2600);
  }
  await page.fill('#q', '').catch(() => {});
  await page.locator('#q').blur();
  await page.keyboard.press('Escape');

  // Profiles
  await say('Profiles for work and home', short ? '' : 'Each one a whole setup, synced through Chrome');
  await app(async () => {
    const first = Nordlys.sync.list()[0];
    Nordlys.sync.rename(first.id, 'Work');
    await Nordlys.sync.create({ name: 'Home', from: 'copy' });
    Nordlys.setTheme('gruvbox-dark');
    Nordlys.config.bgMode = 'nacre';
    Nordlys.saveConfig();
    Nordlys.updateBackgroundMode();
  });
  await wait(short ? 1600 : 2200);
  await pointer(true);
  const [px, py] = await centre(page.locator('#profile-chip'));
  await glide(px, py, 30);
  await page.mouse.click(px, py);
  await wait(900);
  const work = page.locator('#profile-menu [role="menuitem"], #profile-menu button', { hasText: 'Work' }).first();
  const [wx, wy] = await centre(work);
  await glide(wx, wy, 20);
  await wait(250);
  await page.mouse.click(wx, wy);
  await wait(short ? 1500 : 2200);
  await glide(1200, 230, 30);
  await pointer(false);

  // Outro
  await say(null);
  await wait(400);
  await card(OUTRO);
  await wait(short ? 3600 : 4800);
}

(async () => {
  if (!fs.existsSync(path.join(SITE, 'demo/index.html'))) throw new Error('Run `npm run site` first.');
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: SCALE, locale: 'en-US', timezoneId: 'Europe/Berlin' });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('page:', error.message));
  await page.goto(`${base}/demo/index.html`);
  await page.waitForFunction(() => window.Nordlys?.grid && window.Nordlys.sync);
  await page.evaluate(overlay);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1100, 600);
  await page.waitForTimeout(2500);

  const cdp = await context.newCDPSession(page);
  const frames = [];
  let index = 0;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(WORK, `f${String(index++).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await scenes(page, cut === 'store');
  await cdp.send('Page.stopScreencast');
  await browser.close();
  server.close();

  const span = frames[frames.length - 1].t - frames[0].t;
  console.log(`${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps captured)`);
  const list = frames.map((frame, i) => {
    const next = frames[i + 1]?.t ?? frame.t + 1 / 30;
    return `file '${frame.file.replace(/\\/g, '/')}'\nduration ${(next - frame.t).toFixed(4)}`;
  }).join('\n') + `\nfile '${frames[frames.length - 1].file.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(WORK, 'list.txt'), list);

  const music = path.join(WORK, 'music.wav');
  execFileSync(process.execPath, [path.join(__dirname, 'ambient.cjs'), String(Math.ceil(span) + 1), music], { stdio: 'inherit' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'list.txt'), '-i', music,
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high',
    '-af', `afade=t=out:st=${Math.max(0, span - 3).toFixed(2)}:d=3`, '-c:a', 'aac', '-b:a', '192k',
    '-t', span.toFixed(2), '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(WORK, { recursive: true, force: true });
  console.log(`wrote ${path.relative(ROOT, out)}`);
})().catch((error) => { console.error(error); process.exit(1); });
