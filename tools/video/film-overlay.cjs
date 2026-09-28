/* What the film draws over the page: captions, title cards, a flash, the
   pointer, and the camera. Runs inside the page (page.evaluate), so it may use
   only what the page has. The camera moves the page itself (a transform on
   <body>), so a close-up is drawn again at its new size and stays sharp; the
   overlay sits on <html>, outside the camera, and never moves with it. */
function filmOverlay() {
  const css = `
  html.fx-cam { overflow: hidden !important; }
  html.fx-cam body { transform-origin: 0 0; width: 100vw; min-height: 100vh; overflow: hidden; }
  #fx-root { position: fixed; inset: 0; z-index: 2147483600; pointer-events: none; font-synthesis: none; }
  /* Under a caption the page goes quiet: a shade from the caption's edge, and
     just behind the words a soft blur, so a busy card under them reads as
     texture rather than as text. On a light theme the shade is light and the
     words are dark. */
  #fx-shade { position: absolute; inset: 0; opacity: 0; transition: opacity 900ms cubic-bezier(.2,.8,.2,1);
    background: radial-gradient(58% 44% at 14% 100%, rgba(2,4,9,.5), rgba(2,4,9,0) 74%),
      linear-gradient(180deg, rgba(2,4,9,0) 46%, rgba(2,4,9,.3) 70%, rgba(2,4,9,.66)); }
  #fx-shade.on { opacity: 1; }
  #fx-shade.top { background: radial-gradient(58% 44% at 14% 0%, rgba(2,4,9,.5), rgba(2,4,9,0) 74%),
      linear-gradient(0deg, rgba(2,4,9,0) 46%, rgba(2,4,9,.3) 70%, rgba(2,4,9,.66)); }
  html.light-ui #fx-shade { background: radial-gradient(58% 44% at 14% 100%, rgba(248,249,252,.7), rgba(248,249,252,0) 74%),
      linear-gradient(180deg, rgba(248,249,252,0) 46%, rgba(248,249,252,.36) 70%, rgba(248,249,252,.78)); }
  html.light-ui #fx-shade.top { background: radial-gradient(58% 44% at 14% 0%, rgba(248,249,252,.7), rgba(248,249,252,0) 74%),
      linear-gradient(0deg, rgba(248,249,252,0) 46%, rgba(248,249,252,.36) 70%, rgba(248,249,252,.78)); }
  #fx-cap.top { top: 64px; bottom: auto; }
  #fx-cap { position: absolute; z-index: 0; left: 76px; bottom: 70px; max-width: 1040px; color: #f5f7fb; }
  #fx-cap::before { content: ""; position: absolute; z-index: -1; inset: -44px -96px -38px -70px; opacity: 0;
    -webkit-backdrop-filter: blur(18px) saturate(.9); backdrop-filter: blur(18px) saturate(.9);
    -webkit-mask-image: radial-gradient(closest-side, #000 48%, transparent); mask-image: radial-gradient(closest-side, #000 48%, transparent);
    transition: opacity 800ms cubic-bezier(.2,.8,.2,1); }
  #fx-cap.on::before { opacity: 1; }
  #fx-cap.out::before { opacity: 0; transition-duration: 420ms; }
  #fx-cap small { display: block; margin-bottom: 14px; font: 600 13px/1 "Instrument Sans", system-ui, sans-serif; letter-spacing: .24em; text-transform: uppercase; color: rgba(245,247,251,.72); opacity: 0; transform: translateY(8px); transition: opacity 700ms cubic-bezier(.2,.8,.2,1), transform 900ms cubic-bezier(.2,.8,.2,1); }
  #fx-cap.on small { opacity: 1; transform: none; }
  #fx-cap .line { font: 500 58px/1.04 "Outfit", system-ui, sans-serif; letter-spacing: -.035em; text-wrap: balance; text-shadow: 0 2px 30px rgba(0,0,0,.35); }
  html.light-ui #fx-cap { color: #0e1219; }
  html.light-ui #fx-cap small { color: rgba(14,18,25,.62); }
  html.light-ui #fx-cap .line { text-shadow: 0 1px 26px rgba(255,255,255,.6); }
  #fx-cap .w { display: inline-block; opacity: 0; transform: translateY(.5em); filter: blur(10px);
    transition: opacity 800ms cubic-bezier(.2,.8,.2,1), transform 1000ms cubic-bezier(.16,1,.3,1), filter 800ms cubic-bezier(.2,.8,.2,1); }
  #fx-cap.on .w { opacity: 1; transform: none; filter: none; }
  #fx-cap.out .w, #fx-cap.out small { opacity: 0; transform: translateY(-.25em); filter: blur(6px); transition-duration: 420ms; transition-delay: 0ms !important; }
  /* Quick: whole in about a third of a second, for a caption over shots a beat long. */
  #fx-cap.quick .w { transition-duration: 260ms, 300ms, 260ms; }
  #fx-cap.quick small, #fx-cap.quick::before, #fx-shade.quick { transition-duration: 280ms; }
  #fx-card { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity 1000ms cubic-bezier(.2,.8,.2,1);
    background: radial-gradient(95% 85% at 50% 46%, rgba(3,5,10,.52), rgba(3,5,10,.93)); }
  #fx-card.on { opacity: 1; }
  #fx-card .in { text-align: center; color: #f5f7fb; }
  #fx-card img { width: 92px; height: 92px; margin: 0 auto 30px; display: block; opacity: 0; transform: scale(.86); filter: blur(8px);
    transition: opacity 1000ms cubic-bezier(.2,.8,.2,1), transform 1400ms cubic-bezier(.16,1,.3,1), filter 1000ms; }
  #fx-card h1 { margin: 0; font: 500 128px/1 "Outfit", system-ui, sans-serif; letter-spacing: .12em; opacity: 0; filter: blur(12px);
    transition: letter-spacing 2200ms cubic-bezier(.16,1,.3,1), opacity 1200ms cubic-bezier(.2,.8,.2,1), filter 1400ms; }
  #fx-card p { margin: 26px 0 0; font: 400 30px/1.3 "Instrument Sans", system-ui, sans-serif; color: #b9c3d6; opacity: 0; transform: translateY(10px);
    transition: opacity 1000ms cubic-bezier(.2,.8,.2,1) 500ms, transform 1200ms cubic-bezier(.16,1,.3,1) 500ms; }
  #fx-card .tags { margin-top: 38px; display: flex; gap: 12px; justify-content: center; opacity: 0; transition: opacity 1000ms cubic-bezier(.2,.8,.2,1) 900ms; }
  #fx-card .tags span { padding: 11px 22px; border-radius: 999px; font: 500 19px/1 "Instrument Sans", system-ui, sans-serif; color: #e2e8f3; box-shadow: inset 0 0 0 1.5px rgba(210,222,245,.24); background: rgba(255,255,255,.03); }
  #fx-card.on img { opacity: 1; transform: none; filter: none; }
  #fx-card.on h1 { letter-spacing: -.045em; opacity: 1; filter: none; }
  #fx-card.on p, #fx-card.on .tags { opacity: 1; transform: none; }
  #fx-card .big { font: 500 96px/1.06 "Outfit", system-ui, sans-serif; letter-spacing: -.04em; }
  #fx-card .big .w { display: inline-block; opacity: 0; transform: translateY(.4em); filter: blur(12px);
    transition: opacity 700ms cubic-bezier(.2,.8,.2,1), transform 900ms cubic-bezier(.16,1,.3,1), filter 700ms; }
  #fx-card.on .big .w { opacity: 1; transform: none; filter: none; }
  #fx-flash { position: absolute; inset: 0; opacity: 0; background: radial-gradient(75% 65% at 50% 46%, rgba(255,255,255,.42), rgba(255,255,255,0) 70%); }
  #fx-pointer { position: absolute; left: 0; top: 0; width: 28px; height: 28px; transform: translate(-100px,-100px); filter: drop-shadow(0 3px 8px rgba(0,0,0,.45)); transition: opacity 300ms; }
  #fx-pointer.hide { opacity: 0; }
  #fx-pointer svg { transition: transform 120ms; transform-origin: 4px 3px; }
  #fx-pointer.down svg { transform: scale(.84); }
  #fx-ripple { position: absolute; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; border: 2px solid rgba(255,255,255,.75); opacity: 0; }
  /* A sky with nothing on it: the page's own parts step aside, and come back one after another. */
  #greet, #clock, #date, #searchwrap, #board, #dash, #gear, #hiddenDock, #fit-toggle, #profile-chip {
    transition: opacity 1100ms cubic-bezier(.2,.8,.2,1), translate 1300ms cubic-bezier(.16,1,.3,1) !important; }
  html.fx-bare #greet, html.fx-bare #clock, html.fx-bare #date, html.fx-bare #searchwrap, html.fx-bare #board, html.fx-bare #dash,
  html.fx-bare #gear, html.fx-bare #hiddenDock, html.fx-bare #fit-toggle, html.fx-bare #profile-chip { opacity: 0 !important; translate: 0 18px; }
  #clock { transition-delay: 0ms; } #date, #greet { transition-delay: 90ms; } #profile-chip { transition-delay: 140ms; }
  #searchwrap { transition-delay: 200ms; } #board, #dash { transition-delay: 340ms; } #gear, #hiddenDock, #fit-toggle { transition-delay: 480ms; }
  html.fx-instant #greet, html.fx-instant #clock, html.fx-instant #date, html.fx-instant #searchwrap, html.fx-instant #board, html.fx-instant #dash,
  html.fx-instant #gear, html.fx-instant #hiddenDock, html.fx-instant #fit-toggle, html.fx-instant #profile-chip { transition: none !important; }
  #toast-dock { display: none !important; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const root = Object.assign(document.createElement('div'), { id: 'fx-root' });
  root.innerHTML = '<div id="fx-shade"></div><div id="fx-cap"></div><div id="fx-card"></div><div id="fx-flash"></div><div id="fx-ripple"></div><div id="fx-pointer" class="hide"><svg viewBox="0 0 30 30" width="28" height="28"><path d="M4 3l19 11-8.2 1.6L11 24z" fill="#fff" stroke="#0b0e16" stroke-width="1.6" stroke-linejoin="round"/></svg></div>';
  document.documentElement.append(root);
  document.documentElement.classList.add('fx-cam');
  const $ = (id) => root.querySelector(`#${id}`);
  const words = (text, delay0 = 0, step = 55) => text.split(' ').map((w, i) => `<span class="w" style="transition-delay:${delay0 + i * step}ms">${w}</span>`).join(' ');
  const pointer = $('fx-pointer'), ripple = $('fx-ripple');
  // pointermove, not mousemove: a MouseEvent's position is rounded to whole CSS pixels (3.6 pixels
  // of a 5K plate), so a slow glide would step unevenly; a PointerEvent's is not.
  document.addEventListener('pointermove', (e) => { pointer.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 3}px)`; }, true);
  document.addEventListener('mousedown', (e) => {
    pointer.classList.add('down');
    ripple.style.left = `${e.clientX}px`; ripple.style.top = `${e.clientY}px`;
    ripple.animate([{ opacity: .9, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }, true);
  document.addEventListener('mouseup', () => pointer.classList.remove('down'), true);

  const body = document.body;
  const W = () => window.innerWidth, H = () => window.innerHeight;
  const cam = { tx: 0, ty: 0, s: 1 };
  /* The page must not see the camera. One page fit measures boxes with
     getBoundingClientRect, which includes the camera's transform: close up,
     the board looks too big for the window and would be shrunk to fit. While
     a fit runs, boxes are read as if the camera were at rest. */
  const fitter = window.Nordlys?.pageFit;
  if (fitter && !fitter.filmed) {
    const fit = fitter.fit.bind(fitter);
    const rect = Element.prototype.getBoundingClientRect;
    fitter.fit = () => {
      const t = getComputedStyle(body).transform;
      if (!t || t === 'none') return fit();
      const back = new DOMMatrix(t).inverse();
      Element.prototype.getBoundingClientRect = function () {
        const r = rect.call(this);
        if (!body.contains(this)) return r;
        const a = back.transformPoint(new DOMPoint(r.left, r.top)), b = back.transformPoint(new DOMPoint(r.right, r.bottom));
        return new DOMRect(a.x, a.y, b.x - a.x, b.y - a.y);
      };
      try { return fit(); } finally { Element.prototype.getBoundingClientRect = rect; }
    };
    fitter.filmed = true;
  }
  const place = (cx, cy, s) => {
    let tx = W() / 2 - cx * s, ty = H() / 2 - cy * s;
    tx = Math.min(0, Math.max(W() - W() * s, tx)); ty = Math.min(0, Math.max(H() - H() * s, ty));
    if (s <= 1) { tx = (W() - W() * s) / 2; ty = (H() - H() * s) / 2; }
    return { tx, ty, s };
  };
  // A point of the page, where it sits without the camera.
  const at = (target) => {
    if (!target || target === 'center') return { x: W() / 2, y: H() / 2 };
    if (typeof target === 'object') return target;
    const node = document.querySelector(target);
    if (!node) return { x: W() / 2, y: H() / 2 };
    const r = node.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - cam.tx) / cam.s, y: (r.top + r.height / 2 - cam.ty) / cam.s };
  };
  window.__fx = {
    caption(title, eyebrow, instant, where, quick) {
      const cap = $('fx-cap'), shade = $('fx-shade');
      if (!title) {
        if (instant) { cap.innerHTML = ''; cap.classList.remove('on', 'out'); shade.style.transition = 'none'; shade.classList.remove('on'); void shade.offsetWidth; shade.style.transition = ''; return; }
        cap.classList.add('out'); cap.classList.remove('on'); shade.classList.remove('on'); return;
      }
      cap.classList.remove('on', 'out');
      cap.classList.toggle('top', where === 'top');
      shade.classList.toggle('top', where === 'top');
      cap.classList.toggle('quick', Boolean(quick));
      shade.classList.toggle('quick', Boolean(quick));
      cap.innerHTML = `${eyebrow ? `<small>${eyebrow}</small>` : ''}<div class="line">${quick ? words(title, 0, 20) : words(title, 120)}</div>`;
      void cap.offsetWidth;
      cap.classList.add('on'); shade.classList.add('on');
    },
    card(html, instant) {
      const card = $('fx-card');
      if (!html) {
        if (instant) { card.style.transition = 'none'; card.classList.remove('on'); card.innerHTML = ''; void card.offsetWidth; card.style.transition = ''; return; }
        card.classList.remove('on'); return;
      }
      card.innerHTML = `<div class="in">${html}</div>`;
      void card.offsetWidth;
      card.classList.add('on');
    },
    statement(text) { this.card(`<div class="big">${text.split('|').map((line, i) => `<div>${words(line, i * 260, 70)}</div>`).join('')}</div>`); },
    flash() { $('fx-flash').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' }); },
    pointer(on) { pointer.classList.toggle('hide', !on); },
    bare(on, instant) {
      document.documentElement.classList.toggle('fx-instant', Boolean(instant));
      document.documentElement.classList.toggle('fx-bare', Boolean(on));
      if (instant) { void document.body.offsetWidth; requestAnimationFrame(() => document.documentElement.classList.remove('fx-instant')); }
    },
    // Moves the camera to look at target at scale s, over ms (0: at once).
    look(target, s = 1, ms = 0, ease = 'cubic-bezier(.45,0,.15,1)') {
      const p = at(target);
      Object.assign(cam, place(p.x, p.y, s));
      body.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      body.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`;
      if (!ms) void body.offsetWidth;
      return { ...cam };
    },
    point(target) { return at(target); },
    state() { return { ...cam }; }
  };
}

module.exports = { filmOverlay };
