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

/* Runs before the page's own scripts: a clock that moves only when the
   recorder moves it (plates.cjs). performance.now, requestAnimationFrame and
   the timers read it; window.__vclock.advance(ms) moves it on, firing every
   timer that falls due on the way, in order, each at its own time. The wall
   clock (Date) starts at opts.clock ("HH:MM" today) and can be held while a
   plate is set up off camera, so the time on screen only runs on camera,
   and set back (anchor) so that every plate reads the same time.
   With Chrome drawing only when asked (HeadlessExperimental.beginFrame), a
   frame is then the page at an exact time, however long it took to draw. */
function virtualClock(opts) {
  const base = performance.now();
  let v = 0;
  const [h, m] = (opts.clock || '09:41').split(':').map(Number);
  const day = new Date();
  day.setHours(h, m, 0, 0);
  const wall0 = day.getTime();
  let wallHeld = true, wallV = 0;
  performance.now = () => base + v;
  const RealDate = Date;
  const wall = () => wall0 + wallV;
  function VDate(...a) {
    if (!new.target) return new RealDate(wall()).toString();
    return a.length ? new RealDate(...a) : new RealDate(wall());
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = wall; VDate.parse = RealDate.parse; VDate.UTC = RealDate.UTC;
  window.Date = VDate;
  const timers = new Map();
  let seq = 0;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = ++seq; timers.set(id, { due: v + Math.max(0, Number(ms) || 0), fn, args, every: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = ++seq; const every = Math.max(1, Number(ms) || 0); timers.set(id, { due: v + every, fn, args, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(base + v));
  const move = (to) => { if (!wallHeld) wallV += to - v; v = to; };
  /* CSS transitions and animations (and element.animate()) run on the document
     timeline, which Chrome keeps on real time even when frames are begun by hand:
     at 5K, where a frame takes a tenth of a second to draw, the page's own camera
     moves ran five times too fast. So each one is held, and set frame by frame to
     the virtual time since it began, and finished at its end (its finished promise
     resolves, transitionend fires). Left alone: one the page paused itself, and a
     view transition's (a theme change): held, a view transition never closes, and
     Chrome stops drawing the page behind its still picture. */
  const began = new WeakMap();
  const animations = (from) => {
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished' || a.playbackRate < 0) continue;
      if (String(a.effect?.pseudoElement || '').startsWith('::view-transition')) continue;
      let t0 = began.get(a);
      if (t0 === undefined) {
        if (a.playState === 'paused') continue;
        t0 = from; // it began since the last frame
        began.set(a, t0);
      }
      try {
        if (a.playState !== 'paused') a.pause();
        const t = (v - t0) * a.playbackRate;
        const end = a.effect ? a.effect.getComputedTiming().endTime : 0;
        if (end !== Infinity && t >= end) { a.finish(); began.delete(a); } else a.currentTime = t;
      } catch (error) { console.error(error); }
    }
  };
  /* A heartbeat: a pixel that changes every frame (by a third of a percent of
     black, which no eye or encoder can see), so that every frame begun is drawn.
     A still page gives Chrome nothing to draw, and then no picture comes back. */
  let beat = null;
  const heartbeat = () => {
    if (!beat && document.body) {
      beat = document.createElement('div');
      beat.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;z-index:2147483647;background:#000;opacity:0.002';
      document.body.append(beat);
    }
    if (beat) beat.style.opacity = beat.style.opacity === '0.002' ? '0.003' : '0.002';
  };
  window.__vclock = {
    advance(ms) {
      const from = v;
      const end = v + ms;
      for (;;) {
        let next = null;
        for (const [id, t] of timers) if (t.due <= end && (!next || t.due < next[1].due)) next = [id, t];
        if (!next) break;
        const [id, t] = next;
        if (t.due > v) move(t.due);
        if (t.every) t.due += t.every; else timers.delete(id);
        try { if (typeof t.fn === 'function') t.fn(...t.args); } catch (error) { console.error(error); }
      }
      move(end);
      animations(from);
      heartbeat();
      return v;
    },
    hold(on) { wallHeld = Boolean(on); },
    // The wall clock back to its start plus ms, so every plate reads the same time.
    anchor(ms) { wallV = ms; },
    now: () => v
  };
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


module.exports = { serve, dilate, virtualClock, overlay };
