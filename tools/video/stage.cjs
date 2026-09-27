/* What both promo recorders share: a static server for the built site,
   the slowed clock the page is filmed under, and the overlay drawn into the
   page (caption, title card, pointer). */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const serve = (SITE) => new Promise((resolve) => {
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

/* Runs before the page's own scripts: its sense of time, slowed. */
/* opts: the slow-down, or { slow, clock } where clock "HH:MM" sets the
   page's clock to that time today, so the greeting reads the same in every take. */
function dilate(opts) {
  const slow = typeof opts === 'number' ? opts : opts.slow;
  const perf = performance.now.bind(performance);
  const realNow = Date.now;
  const p0 = perf(), r0 = realNow();
  let d0 = r0;
  if (opts && opts.clock) { const [h, m] = opts.clock.split(':').map(Number); const day = new Date(r0); day.setHours(h, m, 0, 0); d0 = day.getTime(); }
  const vPerf = () => p0 + (perf() - p0) / slow;
  /* The wall clock can be held (window.__holdClock(true)) while a shot is
     set up off camera, so the time on screen only moves while filming. */
  let held = null, lost = 0;
  const running = () => d0 + (realNow() - r0) / slow;
  const vNow = () => (held ?? running()) - lost;
  window.__holdClock = (on) => {
    if (on && held == null) held = running();
    else if (!on && held != null) { lost += running() - held; held = null; }
  };
  performance.now = vPerf;
  const RealDate = Date;
  function VDate(...a) {
    if (!new.target) return new RealDate(vNow()).toString();
    return a.length ? new RealDate(...a) : new RealDate(vNow());
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = vNow; VDate.parse = RealDate.parse; VDate.UTC = RealDate.UTC;
  window.Date = VDate;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(vPerf()));
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (fn, ms = 0, ...rest) => st(fn, ms * slow, ...rest);
  window.setInterval = (fn, ms = 0, ...rest) => si(fn, ms * slow, ...rest);
  window.__virtualNow = vPerf;
}

/* Drawn into the page: a caption, a title card and a pointer. */
function overlay() {
  const style = document.createElement('style');
  style.textContent = `
    #pv-caption { position: fixed; left: 56px; top: 48px; z-index: 2147483600; pointer-events: none; max-width: 560px;
      font: 500 30px/1.15 "Outfit", system-ui, sans-serif; letter-spacing: -0.02em; color: #f3f6fb;
      text-shadow: 0 2px 24px rgba(0,0,0,.45); opacity: 0; transform: translateY(-10px); filter: blur(6px);
      transition: opacity .5s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1), filter .6s; }
    #pv-caption.on { opacity: 1; transform: none; filter: none; }
    #pv-caption small { display: block; margin-bottom: 8px; font: 600 12px/1 "Instrument Sans", system-ui, sans-serif; letter-spacing: .18em; text-transform: uppercase; color: rgba(243,246,251,.65); }
    html[data-theme="porcelain-light"] #pv-caption, html.light-ui #pv-caption { color: #10131a; text-shadow: none; }
    html[data-theme="porcelain-light"] #pv-caption small { color: rgba(16,19,26,.6); }
    #pv-card { position: fixed; inset: 0; z-index: 2147483601; display: grid; place-items: center; pointer-events: none;
      background: radial-gradient(90% 80% at 50% 45%, rgba(4,6,11,.55), rgba(4,6,11,.95)); opacity: 0; transition: opacity .9s cubic-bezier(.22,1,.36,1); }
    #pv-card.on { opacity: 1; }
    #pv-card .in { text-align: center; transform: scale(.97); filter: blur(8px); transition: transform 1.4s cubic-bezier(.22,1,.36,1), filter 1s; }
    #pv-card.on .in { transform: none; filter: none; }
    #pv-card img { width: 84px; height: 84px; margin: 0 auto 26px; display: block; }
    #pv-card h1 { margin: 0; font: 500 88px/1 "Outfit", system-ui, sans-serif; letter-spacing: -0.045em; color: #f3f6fb; }
    #pv-card p { margin: 20px 0 0; font: 400 26px/1.35 "Instrument Sans", system-ui, sans-serif; color: #b3bdd0; }
    #pv-card .tags { margin-top: 34px; display: flex; gap: 12px; justify-content: center; }
    #pv-card .tags span { padding: 10px 20px; border-radius: 999px; font: 500 18px/1 "Instrument Sans", system-ui, sans-serif; color: #dfe6f2; box-shadow: inset 0 0 0 1.5px rgba(210,222,245,.22); }
    #pv-pointer { position: fixed; left: 0; top: 0; z-index: 2147483602; width: 26px; height: 26px; pointer-events: none;
      transform: translate(-100px, -100px); filter: drop-shadow(0 3px 6px rgba(0,0,0,.45)); transition: opacity .3s; }
    #pv-pointer.hide { opacity: 0; }
    #pv-pointer svg { transition: transform .12s; transform-origin: 4px 3px; }
    #pv-pointer.down svg { transform: scale(.86); }
    #pv-ripple { position: fixed; z-index: 2147483602; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; pointer-events: none;
      border: 2px solid rgba(255,255,255,.7); opacity: 0; transform: scale(.4); }
    #pv-ripple.go { animation: pv-ripple .55s cubic-bezier(.22,1,.36,1); }
    @keyframes pv-ripple { 0% { opacity: .9; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.4); } }
  `;
  document.head.append(style);
  const caption = Object.assign(document.createElement('div'), { id: 'pv-caption' });
  const card = Object.assign(document.createElement('div'), { id: 'pv-card' });
  const pointer = Object.assign(document.createElement('div'), { id: 'pv-pointer', className: 'hide' });
  const ripple = Object.assign(document.createElement('div'), { id: 'pv-ripple' });
  pointer.innerHTML = '<svg viewBox="0 0 30 30" width="26" height="26"><path d="M4 3l19 11-8.2 1.6L11 24z" fill="#fff" stroke="#0b0e16" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.append(caption, card, pointer, ripple);
  document.addEventListener('mousemove', (e) => { pointer.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 3}px)`; }, true);
  document.addEventListener('mousedown', (e) => {
    pointer.classList.add('down');
    ripple.style.left = `${e.clientX}px`; ripple.style.top = `${e.clientY}px`;
    ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go');
  }, true);
  document.addEventListener('mouseup', () => pointer.classList.remove('down'), true);
  window.__pv = {
    caption(title, eyebrow) {
      if (!title) { caption.classList.remove('on'); return; }
      const show = () => { caption.innerHTML = `${eyebrow ? `<small>${eyebrow}</small>` : ''}${title}`; caption.classList.add('on'); };
      if (caption.classList.contains('on')) { caption.classList.remove('on'); setTimeout(show, 320); } else show();
    },
    card(html) { if (!html) { card.classList.remove('on'); return; } card.innerHTML = `<div class="in">${html}</div>`; requestAnimationFrame(() => card.classList.add('on')); },
    pointer(on) { pointer.classList.toggle('hide', !on); }
  };
}


module.exports = { serve, dilate, overlay };
