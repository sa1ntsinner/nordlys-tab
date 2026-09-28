/* The Nordlys website, laid out as a star atlas. The sky behind the whole page
   is the extension's own engine (sky/background.js) on #bg-canvas; the hour
   ring sets the time it is drawn for, as the extension follows the sun. The
   deck is the extension's own new tab (demo/index.html, built by
   tools/site-build.cjs) in an iframe; its controls call the same app object
   the extension's settings call. Motion comes from GSAP and Lenis, served
   with the site. With reduced motion nothing moves on its own and every part
   is laid out in order. */
(function () {
  const root = document.documentElement;
  root.classList.add('js');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 760px)');
  const ua = navigator.userAgent;
  const phone = /Android|iPhone|iPad|Mobile/i.test(ua);
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const SVG = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs = {}, text) => {
    const node = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    return node;
  };

  /* ── Getting it ──────────────────────────────────────────────────
     Each store's page from a meta tag (empty means not there yet), and the
     visitor's browser picked out, so the main button says "Add to Edge" in
     Edge and goes to the right place. Where the store is not ready, or on a
     phone, the button offers the demo on this page instead. */
  const stores = Object.fromEntries(['chrome', 'edge', 'firefox', 'safari'].map(key => [key, document.querySelector(`meta[name="nordlys-store-${key}"]`)?.content.trim() || '']));
  const browser = /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Safari\//.test(ua) && !/Chrome\/|Chromium\//.test(ua) ? 'safari' : 'chrome';
  const NAMES = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari' };
  // Edge also installs from the Chrome Web Store, until its own listing is up.
  const target = phone ? '' : stores[browser] || (browser === 'edge' ? stores.chrome : '');
  for (const link of $$('[data-get]')) link.href = target || '#observe';
  for (const label of $$('[data-get-label]')) label.textContent = target ? `Add to ${NAMES[browser]}, it's free` : 'Try it here';
  // The index's own button says the same in fewer words.
  for (const label of $$('[data-get-short]')) label.textContent = target ? 'Get Nordlys' : 'Try it';
  // With the main button already offering the demo, its neighbour would only say it twice.
  if (!target) for (const link of $$('[data-try-here]')) link.hidden = true;
  for (const note of $$('[data-get-note]')) {
    if (phone) note.textContent = 'Nordlys is for the browser on your computer. You can try it right here.';
    else if (!target) note.textContent = `The ${NAMES[browser]} version is in the store's review. You can try it here meanwhile, or in Chrome or Edge.`;
    else if (browser === 'edge' && !stores.edge) note.textContent = 'In Edge, it installs from the Chrome Web Store.';
  }

  /* ── The sky ─────────────────────────────────────────────────────
     One engine for the page, following the sun where the visitor is. It is
     stopped whenever no part of the page that shows the sky is on screen. */
  const engine = typeof NordlysBackgroundEngine === 'function' ? new NordlysBackgroundEngine() : null;
  if (engine) {
    engine.setDaylight(true);
    engine.setAtmosphere({ intensity: 1.35 });
    engine.setMode('aurora');
  }
  const skyParts = new Set();
  const skyWatch = new IntersectionObserver(entries => {
    for (const entry of entries) entry.isIntersecting ? skyParts.add(entry.target) : skyParts.delete(entry.target);
    if (!engine) return;
    if (skyParts.size) { engine.start(); engine.resumeIfMoving?.(); } else engine.stop();
  });
  for (const part of $$('#opening, #plates, #get')) skyWatch.observe(part);

  /* ── The planisphere ─────────────────────────────────────────────
     A 24-hour ring round a window onto the sky, noon at the top and midnight
     at the bottom, as the sun stands. Turning it sets the time the sky is
     drawn for; "Back to now" hands it back to the clock. */
  const hero = $('#top');
  const ring = $('#hour-ring');
  const graticule = $('.graticule');
  const nowButton = $('#sky-now');
  const timeOut = $('#sky-time');
  const phaseOut = $('#sky-phase');
  const hint = $('#ring-hint');
  const TURNED = 'nordlys-site-ring-turned';
  try { if (hint && localStorage.getItem(TURNED)) hint.hidden = true; } catch { /* no storage here */ }
  const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();
  const place = window.NordlysSky ? window.NordlysSky.zonePlace(zone, new Date()) : null;
  const geometry = { cx: 0, cy: 0, r: 180, size: 456 };
  let minutes = 0;
  let following = true;

  const nowMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
  const dateAt = value => { const date = new Date(); date.setHours(Math.floor(value / 60), value % 60, 0, 0); return date; };
  const hhmm = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const phaseAt = value => (window.NordlysSky && place ? window.NordlysSky.daylight(dateAt(value), place).phase : 'night');
  // Noon at the top, turning clockwise.
  const angleOf = value => ((value - 720) / 1440) * Math.PI * 2;
  const at = (radius, angle, cx, cy) => [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];

  function drawRing() {
    const { r, size } = geometry;
    const c = size / 2;
    ring.setAttribute('viewBox', `0 0 ${size} ${size}`);
    ring.replaceChildren();
    ring.append(make('circle', { class: 'ring-edge', cx: c, cy: c, r: r + 0.5 }));
    ring.append(make('circle', { class: 'ring-edge', cx: c, cy: c, r: r + 24 }));
    for (let step = 0; step < 96; step++) {
      const value = step * 15;
      const major = step % 12 === 0;
      const hour = step % 4 === 0;
      const [x1, y1] = at(r + 5, angleOf(value), c, c);
      const [x2, y2] = at(r + (major ? 22 : hour ? 15 : 9), angleOf(value), c, c);
      ring.append(make('line', { class: `tick${major ? ' major' : hour ? ' hour' : ''}`, x1, y1, x2, y2 }));
      if (major) {
        const [tx, ty] = at(r + 38, angleOf(value), c, c);
        ring.append(make('text', { x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(value / 60).padStart(2, '0')));
      }
    }
    const nowMark = make('path', { class: 'now-mark' });
    const knobLine = make('line', { class: 'knob-line' });
    const knob = make('circle', { class: 'knob', r: 7 });
    ring.append(nowMark, knobLine, knob);
    drawHands();
  }

  function drawHands() {
    const { r, size } = geometry;
    const c = size / 2;
    const knobLine = ring.querySelector('.knob-line');
    const knob = ring.querySelector('.knob');
    const nowMark = ring.querySelector('.now-mark');
    if (!knob) return;
    const angle = angleOf(minutes);
    const [x1, y1] = at(r, angle, c, c);
    const [x2, y2] = at(r + 24, angle, c, c);
    knobLine.setAttribute('x1', x1); knobLine.setAttribute('y1', y1); knobLine.setAttribute('x2', x2); knobLine.setAttribute('y2', y2);
    knob.setAttribute('cx', x2); knob.setAttribute('cy', y2);
    // A small mark outside the ring for the real time, when the ring is turned away from it.
    const real = angleOf(nowMinutes());
    const [px, py] = at(r + 52, real, c, c);
    const [lx, ly] = at(r + 60, real - 0.03, c, c);
    const [rx, ry] = at(r + 60, real + 0.03, c, c);
    nowMark.setAttribute('d', `M${px} ${py} L${lx} ${ly} L${rx} ${ry} Z`);
    nowMark.style.opacity = following ? '0' : '1';
  }

  // A preview turns the ring and the sky without taking them off the clock.
  function setMinutes(value, { user = false, preview = false } = {}) {
    minutes = ((Math.round(value) % 1440) + 1440) % 1440;
    if (user) {
      following = false;
      if (hint && !hint.hidden) {
        hint.hidden = true;
        try { localStorage.setItem(TURNED, '1'); } catch { /* no storage here */ }
      }
    }
    const shown = hhmm(minutes);
    const phase = phaseAt(minutes);
    ring.setAttribute('aria-valuenow', String(minutes));
    ring.setAttribute('aria-valuetext', `${shown}, ${phase}`);
    timeOut.textContent = shown;
    timeOut.dateTime = shown;
    phaseOut.textContent = phase;
    nowButton.hidden = following;
    if (engine) {
      const fixed = dateAt(minutes);
      engine.now = following && !preview ? () => new Date() : () => new Date(fixed.getTime());
      engine.followSun();
    }
    drawHands();
  }

  function drawGraticule() {
    const { width, height } = hero.getBoundingClientRect();
    const { cx, cy, r } = geometry;
    graticule.setAttribute('viewBox', `0 0 ${width} ${height}`);
    graticule.replaceChildren();
    const add = (node, opacity) => { node.setAttribute('stroke-opacity', opacity); graticule.append(node); };
    // Inside the window, the chart's own lines; outside, the plate's.
    for (const k of [0.36, 0.7]) add(make('circle', { cx, cy, r: r * k }), 0.13);
    for (const k of [1.6, 2.3, 3.1]) add(make('circle', { cx, cy, r: r * k }), 0.07);
    for (let hour = 0; hour < 24; hour++) {
      const angle = (hour / 24) * Math.PI * 2;
      const [x1, y1] = at(r * 0.12, angle, cx, cy);
      const [x2, y2] = at(r, angle, cx, cy);
      add(make('line', { x1, y1, x2, y2 }), hour % 6 === 0 ? 0.14 : 0.07);
      if (hour % 2 === 0) {
        const [x3, y3] = at(r + 80, angle, cx, cy);
        const [x4, y4] = at(r * 3.4, angle, cx, cy);
        add(make('line', { x1: x3, y1: y3, x2: x4, y2: y4 }), 0.05);
      }
    }
  }

  function layout() {
    const box = hero.getBoundingClientRect();
    const width = box.width;
    const height = Math.max(box.height, window.innerHeight);
    if (narrow.matches) {
      const r = Math.round(Math.min(width * 0.32, 150));
      geometry.r = r;
      geometry.size = r * 2 + 80;
      hero.style.setProperty('--r', `${r}px`);
      hero.style.setProperty('--rw', `${r}px`);
      const planisphere = $('.planisphere').getBoundingClientRect();
      geometry.cx = planisphere.left - box.left + planisphere.width / 2;
      geometry.cy = planisphere.top - box.top + planisphere.height / 2;
    } else {
      const r = Math.round(Math.min(height * 0.36, width * 0.27));
      geometry.r = r;
      geometry.size = r * 2 + 96;
      geometry.cx = Math.round(width * 0.66);
      geometry.cy = Math.round(height * 0.52);
      hero.style.setProperty('--r', `${r}px`);
      hero.style.setProperty('--rw', `${r}px`);
    }
    hero.style.setProperty('--cx', `${geometry.cx}px`);
    hero.style.setProperty('--cy', `${geometry.cy}px`);
    drawRing();
    drawGraticule();
  }

  if (hero && ring) {
    layout();
    setMinutes(nowMinutes());
    setInterval(() => { if (following) setMinutes(nowMinutes()); else drawHands(); }, 30000);
    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { layout(); window.ScrollTrigger?.refresh(); }, 150); });

    const KEYS = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 60, PageDown: -60 };
    ring.addEventListener('keydown', event => {
      if (event.key in KEYS) { event.preventDefault(); setMinutes(minutes + KEYS[event.key], { user: true }); }
      else if (event.key === 'Home') { event.preventDefault(); setMinutes(0, { user: true }); }
      else if (event.key === 'End') { event.preventDefault(); setMinutes(1425, { user: true }); }
    });
    // Dragging anywhere on the ring's band turns it; five-minute steps.
    const valueFromPoint = event => {
      const box = ring.getBoundingClientRect();
      const x = event.clientX - box.left - box.width / 2;
      const y = event.clientY - box.top - box.height / 2;
      const angle = Math.atan2(x, -y);
      return Math.round((720 + (angle / (Math.PI * 2)) * 1440) / 5) * 5;
    };
    const onBand = event => {
      const box = ring.getBoundingClientRect();
      const scale = box.width / geometry.size;
      const distance = Math.hypot(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2) / scale;
      return distance > geometry.r - 24 && distance < geometry.r + 64;
    };
    // A touch on the band turns the ring; anywhere else it scrolls the page.
    ring.addEventListener('touchstart', event => { if (event.touches.length === 1 && onBand(event.touches[0])) event.preventDefault(); }, { passive: false });
    ring.addEventListener('pointerdown', event => {
      if (!onBand(event)) return;
      event.preventDefault();
      ring.setPointerCapture(event.pointerId);
      ring.focus({ preventScroll: true });
      setMinutes(valueFromPoint(event), { user: true });
      const move = next => setMinutes(valueFromPoint(next), { user: true });
      const up = () => { ring.removeEventListener('pointermove', move); ring.removeEventListener('pointerup', up); ring.removeEventListener('pointercancel', up); };
      ring.addEventListener('pointermove', move);
      ring.addEventListener('pointerup', up);
      ring.addEventListener('pointercancel', up);
    });
    nowButton.addEventListener('click', () => { following = true; setMinutes(nowMinutes()); ring.focus({ preventScroll: true }); });
  }

  /* ── Your sites, as constellations ───────────────────────────────
     The demo board's own folders, drawn as a star chart: each site a star,
     each folder the lines that join them. */
  const CONSTELLATIONS = [
    { name: 'Daily', folder: 0, label: [110, 118], stars: [['Gmail', 176, 208, 3.6], ['Drive', 262, 164, 2.8], ['YouTube', 352, 226, 3.9], ['Wikipedia', 318, 318, 2.6], ['Reddit', 214, 356, 2.9], ['Amazon', 132, 292, 2.4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
    { name: 'Work', folder: 2, label: [560, 92], stars: [['Notion', 590, 158, 3.2], ['Slack', 684, 116, 2.7], ['Figma', 772, 176, 2.9], ['Trello', 742, 272, 2.5], ['Linear', 646, 306, 2.6], ['GitHub', 548, 252, 3.7]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 5]] },
    { name: 'Social', folder: 3, label: [990, 104], stars: [['X', 1016, 184, 3.1], ['Discord', 1108, 144, 2.8], ['Telegram', 1190, 214, 2.7], ['LinkedIn', 1096, 286, 2.5]], lines: [[0, 1], [1, 2], [2, 3], [3, 0]] },
    { name: 'Watch & listen', folder: null, label: [1060, 430], stars: [['Netflix', 1150, 480, 3.3], ['Spotify', 1262, 540, 3.0], ['Twitch', 1154, 604, 2.6], ['Steam', 1270, 666, 2.4]], lines: [[0, 1], [1, 2], [2, 3]] }
  ];
  const chart = $('.constellations');
  if (chart) {
    const defs = make('defs');
    const glow = make('radialGradient', { id: 'star-glow' });
    glow.append(make('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.55 }), make('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 }));
    defs.append(glow);
    chart.append(defs);
    for (const group of CONSTELLATIONS) {
      const g = make('g', group.folder == null ? { class: 'constellation', 'data-away': '' } : { class: 'constellation', 'data-folder': group.folder });
      for (const [a, b] of group.lines) {
        const [, x1, y1] = group.stars[a];
        const [, x2, y2] = group.stars[b];
        g.append(make('line', { class: 'line', x1, y1, x2, y2, 'stroke-opacity': 1 }));
      }
      for (const [name, x, y, size] of group.stars) {
        g.append(make('circle', { class: 'glow', cx: x, cy: y, r: size * 4.2, 'data-site': name }));
        g.append(make('circle', { class: 'star', cx: x, cy: y, r: size, 'data-site': name }));
        g.append(make('text', { class: 'label', x: x + size + 8, y: y + 4, 'fill-opacity': 1 }, name));
      }
      g.append(make('text', { class: 'folder', x: group.label[0], y: group.label[1], 'fill-opacity': 1 }, group.name));
      chart.append(g);
    }
  }

  /* ── The index along the top ─────────────────────────────────────
     Plain over the opening, a solid strip once the page moves, and out of
     the way while the deck is on screen, so it never covers the demo. */
  const nav = $('#nav');
  const marker = document.createElement('div');
  marker.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none';
  document.body.prepend(marker);
  new IntersectionObserver(([entry]) => nav.classList.toggle('is-solid', !entry.isIntersecting)).observe(marker);
  // Its button turns lamp red once the opening's own has gone, so there is one at a time.
  const lamp = on => nav.classList.toggle('is-lit', on);
  new IntersectionObserver(([entry]) => lamp(!entry.isIntersecting)).observe($('.hero-act'));

  /* ── The deck: the real extension ────────────────────────────────── */
  const deck = $('#deck');
  const frame = $('#demo');
  const viewport = $('#viewport');
  const DESK = { w: 1440, h: 900 };
  let touched = false;

  const loadDemo = () => { if (!frame.getAttribute('src')) frame.src = frame.dataset.src; };
  if (!phone) {
    const soon = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(loadDemo, { timeout: 3000 }) : loadDemo()), 2500);
    if (document.readyState === 'complete') soon(); else window.addEventListener('load', soon, { once: true });
    const early = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { loadDemo(); early.disconnect(); } }, { rootMargin: '120% 0px' });
    early.observe($('#observe'));
  }
  $('#deck-open').addEventListener('click', () => { loadDemo(); deck.classList.add('is-open'); touched = true; });
  $('#deck-use').addEventListener('click', () => { loadDemo(); deck.classList.add('is-using'); touched = true; frame.focus(); });
  new IntersectionObserver(([entry]) => nav.classList.toggle('is-away', entry.isIntersecting && !narrow.matches), { threshold: 0.3 }).observe(deck);

  const fit = () => {
    if (narrow.matches) { viewport.style.removeProperty('--scale'); return; }
    viewport.style.setProperty('--scale', (viewport.clientWidth / DESK.w).toFixed(4));
  };
  new ResizeObserver(fit).observe(viewport);
  fit();

  const ready = new Promise(resolve => {
    const look = () => {
      try {
        const candidate = frame.contentWindow?.Nordlys;
        if (candidate?.config && candidate.grid) { resolve(candidate); return; }
      } catch (error) { /* not loaded yet */ }
      setTimeout(look, 150);
    };
    frame.addEventListener('load', look);
  });
  ready.then(demo => {
    deck.classList.add('is-live');
    // Its own sky runs only while the deck is on screen, and not while the page's stands in for it.
    new IntersectionObserver(([entry]) => {
      if (viewport.classList.contains('is-full')) return;
      if (entry.isIntersecting) demo.bgEngine?.start?.(); else demo.bgEngine?.stop?.();
    }).observe(deck);
  });

  const setScene = key => ready.then(demo => { demo.config.bgMode = key; demo.saveConfig(); demo.updateBackgroundMode(); });
  const setTheme = key => ready.then(demo => { demo.setTheme(key); demo.saveConfig?.(); });
  // Only an explicit try moves the keyboard into the demo; scrolling never does.
  const inDemo = (fn, { focus = false } = {}) => ready.then(demo => { if (focus) frame.contentWindow.focus(); return fn(demo, frame.contentDocument); });

  const actions = {
    settings: () => inDemo(demo => demo.settings.open(), { focus: true }),
    command: () => inDemo((demo, doc) => {
      deck.classList.add('is-using');
      const box = doc.getElementById('q');
      box.focus();
      box.value = '>';
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }, { focus: true }),
    // Two whole setups: the first time, a Home profile in its own look.
    profile: () => inDemo(async demo => {
      const sync = demo.sync;
      if (!sync) return;
      if (sync.list().length < 2) {
        const first = sync.list()[0];
        if (first) sync.rename(first.id, 'Work');
        await sync.create({ name: 'Home', from: 'copy' });
        demo.setTheme('gruvbox-dark');
        demo.config.bgMode = 'nacre';
        demo.saveConfig();
        demo.updateBackgroundMode();
        return;
      }
      const list = sync.list();
      const now = list.findIndex(entry => entry.id === sync.active()?.id);
      await sync.switchTo(list[(now + 1) % list.length].id);
    }),
    /* The dashboard with a day already in it, so there is something to see:
       the Planner layout, a few tasks, habits under way, a countdown. */
    dashboard: () => inDemo(async demo => {
      const dash = demo.dashboard;
      if (!dash || dash.on) return;
      if (!dash.widgets().length || !dash.seededDemo) {
        const K = frame.contentWindow.NordlysWidgetKit;
        dash.applyPreset('planner');
        await dash.render();
        const now = Date.now();
        for (const w of dash.widgets()) {
          const key = dash.dataKey(w);
          if (w.type === 'tasks') { const l = K.tasks.create(); for (const [x, o] of [['Write the release notes', { priority: true, due: K.dayOf(now) }], ['Reply to Anna', { due: K.tasks.shift(now, 1) }], ['Book the dentist', { due: K.tasks.shift(now, 3) }], ['Water the plants', {}]]) K.tasks.add(l, x, now, o); K.tasks.toggle(l, l.items[3].id, now); dash.persist(key, l); }
          if (w.type === 'focus') { const d = K.focus.create(); K.focus.set(d, 'Try the dashboard', now); dash.persist(key, d); }
          if (w.type === 'notes') dash.persist(key, { text: 'Drag a card by its title.\nStretch it by its corner.' });
          if (w.type === 'habits') { const h = K.habits.create(); for (const [name, days] of [['Read', [0, 1, 2, 4, 5]], ['Walk', [3, 5]], ['Stretch', [5]]]) { const x = K.habits.add(h, name); for (const i of days) K.habits.toggle(h, x.id, K.tasks.shift(now, i - 6)); } dash.persist(key, h); }
          if (w.type === 'countdown') dash.change(w.id, x => ({ ...x, settings: { title: 'the weekend', date: K.tasks.shift(now, 5) } }));
        }
        dash.seededDemo = true;
        dash.signature = '';
        await dash.render();
        frame.contentDocument.querySelectorAll('#toast-dock > *').forEach(node => node.remove());
      } else dash.setOn(true);
    })
  };

  const views = {
    board: () => inDemo(demo => { demo.focusMode?.hide?.(); if (demo.dashboard?.on) demo.dashboard.setOn(false); }),
    dashboard: () => inDemo(async demo => { demo.focusMode?.hide?.(); await actions.dashboard(); }),
    focus: () => inDemo(demo => demo.focusMode?.show())
  };
  const tabs = $$('[data-view]');
  const showTab = view => {
    for (const tab of tabs) { const on = tab.dataset.view === view; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; }
  };
  const syncDock = () => ready.then(demo => {
    $('#dock-sky').value = demo.config.bgMode;
    if ([...$('#dock-theme').options].some(option => option.value === demo.config.theme)) $('#dock-theme').value = demo.config.theme;
    const focusOpen = Boolean(frame.contentDocument.getElementById('focus-mode')?.classList.contains('is-open'));
    showTab(focusOpen ? 'focus' : demo.dashboard?.on ? 'dashboard' : 'board');
  });
  let dockTimer = 0;
  const syncSoon = () => { clearTimeout(dockTimer); dockTimer = setTimeout(syncDock, 350); };
  ready.then(() => { for (const type of ['click', 'keyup', 'change']) frame.contentDocument.addEventListener(type, syncSoon, true); });

  const pickView = view => { showTab(view); return Promise.resolve(views[view]?.()).then(syncSoon); };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { touched = true; pickView(tab.dataset.view); });
    tab.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      touched = true;
      pickView(next.dataset.view);
    });
  });
  showTab('board');
  $('#dock-sky').addEventListener('change', event => { touched = true; setScene(event.target.value); });
  $('#dock-theme').addEventListener('change', event => { touched = true; setTheme(event.target.value); });
  for (const button of $$('[data-try]')) button.addEventListener('click', () => { touched = true; Promise.resolve(actions[button.dataset.try]?.()).then(syncSoon); });

  // Each chapter's own button shows it in the deck.
  for (const button of $$('[data-show]')) {
    button.addEventListener('click', () => {
      touched = true;
      if (narrow.matches) { loadDemo(); deck.classList.add('is-open'); }
      const what = button.dataset.show;
      Promise.resolve(views[what] ? pickView(what) : actions[what]?.()).then(syncSoon);
      if (narrow.matches) deck.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /* Scrolling the chapters past the deck shows each one there, until the
     visitor takes the demo in hand; then it is theirs. */
  const chapters = $$('.chapter');
  const onChapter = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const chapter of chapters) chapter.setAttribute('aria-current', String(chapter === entry.target));
      // Profiles and commands are shown on the plain page; their own buttons do the rest.
      const view = { profile: 'board', command: 'board' }[entry.target.dataset.chapter] || entry.target.dataset.chapter;
      if (!touched && !still && !narrow.matches && views[view]) pickView(view);
    }
  }, { rootMargin: '-48% 0px -48% 0px' });
  chapters.forEach(chapter => onChapter.observe(chapter));

  /* ── The nine plates ─────────────────────────────────────────────
     Each plate puts its sky on the whole page, in its own colours. The rail
     and the keys 1 to 9 go straight to one, and the address follows. */
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const plates = $$('.plate');
  const links = $$('[data-plate-link]');
  const dip = $('.dip');
  let currentPlate = 1;
  let lenis = null;

  function paint(plate) {
    const [a, b, c] = plate.dataset.palette.split(' ');
    root.style.setProperty('--shader-1', a);
    root.style.setProperty('--shader-2', b);
    root.style.setProperty('--shader-3', c);
    if (engine) { engine.setMode(plate.dataset.scene); engine.refreshPalette(); }
  }

  function setPlate(n) {
    const plate = plates[n - 1];
    if (!plate || n === currentPlate) return;
    currentPlate = n;
    for (const link of links) link.setAttribute('aria-current', String(Number(link.dataset.plateLink) === n));
    const name = plate.querySelector('h3').lastChild.textContent.trim();
    for (const out of $$('[data-sky-name]')) out.textContent = name;
    $('.readout-plate .readout-key').textContent = `Plate ${ROMAN[n]}`;
    if (still || !window.gsap) { paint(plate); return; }
    // A dip to the plate's black, and the new sky out of it.
    window.gsap.timeline()
      .to(dip, { opacity: 0.9, duration: 0.22, ease: 'power2.in', onComplete: () => paint(plate) })
      .to(dip, { opacity: 0, duration: 0.7, ease: 'expo.out' });
  }

  function goToPlate(n) {
    const plate = plates[n - 1];
    if (!plate) return;
    setPlate(n);
    history.replaceState(null, '', `#plate-${n}`);
    if (lenis) lenis.scrollTo(plate, { duration: 1.1 });
    else plate.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  }

  const onPlate = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) setPlate(Number(entry.target.dataset.plate));
  }, { rootMargin: '-50% 0px -50% 0px' });
  plates.forEach(plate => onPlate.observe(plate));

  for (const link of links) link.addEventListener('click', event => { event.preventDefault(); goToPlate(Number(link.dataset.plateLink)); });
  const platesPart = $('#plates');
  let platesInView = false;
  new IntersectionObserver(([entry]) => { platesInView = entry.isIntersecting; }).observe(platesPart);
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || !/^[1-9]$/.test(event.key)) return;
    const active = document.activeElement;
    if (active && (active.matches('input, textarea, select, iframe, [contenteditable="true"]') || active === ring)) return;
    if (!platesInView && !platesPart.contains(active)) return;
    event.preventDefault();
    goToPlate(Number(event.key));
  });
  const fromAddress = /^#plate-([1-9])$/.exec(location.hash);
  if (fromAddress) setPlate(Number(fromAddress[1]));

  /* ── The stars become the new tab ────────────────────────────────
     On a computer, once the window has opened on the whole sky, the real new
     tab (the deck's own demo, brought to full screen) assembles in it: the
     clock, then the search box, then each folder as its stars fly into its
     sites. The page's sky stands in for the demo's own until the demo's
     section comes up, and then the new tab settles into its frame. */
  function assemble() {
    const gsap = window.gsap;
    // Where the demo draws each site's icon on its own 1440 x 900 page; read
    // again from the demo itself once it is running.
    const icons = {
      Gmail: [267, 438], Drive: [355, 438], YouTube: [443, 438], Wikipedia: [267, 551], Reddit: [355, 551], Amazon: [443, 551],
      Notion: [783, 438], Slack: [871, 438], Figma: [959, 438], Trello: [783, 551], Linear: [871, 551], GitHub: [959, 551],
      X: [1085, 438], Discord: [1173, 438], Telegram: [1085, 551], LinkedIn: [1173, 551]
    };
    const box = () => {
      const outer = deck.getBoundingClientRect();
      return { x: outer.left + viewport.offsetLeft, y: outer.top + viewport.offsetTop, w: viewport.offsetWidth, h: viewport.offsetHeight };
    };
    // 0: the new tab fills the screen; 1: it sits in its frame. The move keeps
    // pace with the change of size, so the frame closes on its place.
    // The scale at which the demo's 1440 x 900 page fits the screen, and where it then sits.
    const fitted = () => {
      const k = Math.min(window.innerWidth / DESK.w, window.innerHeight / DESK.h);
      return { k, x: (window.innerWidth - DESK.w * k) / 2, y: (window.innerHeight - DESK.h * k) / 2 };
    };
    const place = q => {
      const frameBox = box();
      const full = (fitted().k * DESK.w) / frameBox.w;
      const scale = full ** (1 - q);
      const done = full === 1 ? 1 : (full - scale) / (full - 1);
      const x = (window.innerWidth / 2 - (frameBox.x + frameBox.w / 2)) * (1 - done);
      const y = (window.innerHeight / 2 - (frameBox.y + frameBox.h / 2)) * (1 - done);
      viewport.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(5)})`;
      viewport.style.borderRadius = `${((14 * q) / scale).toFixed(2)}px`;
    };
    const isFull = () => viewport.classList.contains('is-full');
    const setFull = on => {
      viewport.classList.toggle('is-full', on);
      // The index steps aside while the new tab fills the screen, as it does for the deck.
      nav.classList.toggle('is-hush', on);
      if (!on) { viewport.style.transform = ''; viewport.style.borderRadius = ''; }
    };

    // How much of each part of the new tab shows; 1 is as the demo draws it.
    const show = { clock: 1, search: 1, f0: 1, f1: 1, f2: 1, f3: 1, rest: 1, sky: 1 };
    let parts = null;
    let resting = false;
    const paint = () => {
      if (!parts) return;
      const fade = (el, value, rise = 0) => {
        if (!el) return;
        el.style.opacity = value >= 1 ? '' : value.toFixed(3);
        el.style.translate = rise && value < 1 ? `0 ${((1 - value) * rise).toFixed(1)}px` : '';
      };
      fade(parts.clock, show.clock, 14);
      fade(parts.search, show.search, 14);
      parts.folders.forEach((el, i) => fade(el, show[`f${Math.min(i, 3)}`], 18));
      for (const el of parts.rest) fade(el, show.rest);
      fade(parts.sky, show.sky);
      const through = show.sky < 1;
      parts.doc.documentElement.style.background = through ? 'transparent' : '';
      parts.doc.body.style.background = through ? 'transparent' : '';
      if (show.sky <= 0 && !resting) { resting = true; parts.demo.bgEngine?.stop?.(); }
      else if (show.sky > 0 && resting) { resting = false; parts.demo.bgEngine?.start?.(); }
    };
    ready.then(demo => {
      const doc = frame.contentDocument;
      parts = {
        demo, doc,
        clock: doc.getElementById('hero'),
        search: doc.getElementById('searchwrap'),
        folders: [...doc.querySelectorAll('#board .board-line > .card')],
        rest: ['gear', 'fit-toggle', 'hiddenDock'].map(id => doc.getElementById(id)).filter(Boolean),
        sky: doc.getElementById('bg-container')
      };
      for (const tile of doc.querySelectorAll('.tile[data-group-idx]')) {
        const name = tile.textContent.trim();
        if (!(name in icons)) continue;
        const icon = (tile.querySelector('img, svg, .icon') || tile).getBoundingClientRect();
        icons[name] = [icon.x + icon.width / 2, icon.y + icon.height / 2];
      }
      paint();
      window.ScrollTrigger.refresh();
    });

    // A point of the demo's page, on screen while the demo fills it, then in
    // the chart's own drawing (which meets the chart's box, the screen while pinned).
    const inChart = ([x, y]) => {
      const { k, x: left, y: top } = fitted();
      const X = x * k + left;
      const Y = y * k + top;
      const area = chart.getBoundingClientRect();
      const m = Math.min(area.width / 1440, area.height / 900);
      return [(X - (area.width - 1440 * m) / 2) / m, (Y - (area.height - 900 * m) / 2) / m];
    };

    const pinned = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: '#chart', start: 'top top', end: '+=240%', scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        // On a jump the update comes before the entry, so the entry places the frame too.
        onEnter: () => { setFull(true); place(0); },
        onEnterBack: () => { setFull(true); place(0); },
        onLeaveBack: () => setFull(false),
        onUpdate: () => { if (isFull()) place(0); }
      }
    });
    pinned
      .set(show, { clock: 0, search: 0, f0: 0, f1: 0, f2: 0, f3: 0, rest: 0, sky: 0, immediateRender: false, onComplete: paint, onReverseComplete: paint }, 0.001)
      .to('.chart-copy', { autoAlpha: 0, y: -24, duration: 0.1 }, 0.18)
      // Fill and stroke fade, not opacity: the drawing above already animates opacity.
      .to('.constellations .label, .constellations .folder', { attr: { 'fill-opacity': 0 }, duration: 0.1 }, 0.16)
      .to('.constellations .line', { attr: { 'stroke-opacity': 0 }, duration: 0.1 }, 0.16)
      .to('.constellations [data-away] circle', { opacity: 0, duration: 0.1 }, 0.16)
      .to(show, { clock: 1, duration: 0.12, onUpdate: paint }, 0.26)
      .to(show, { search: 1, duration: 0.1, onUpdate: paint }, 0.36);
    // Each folder in turn: its stars fly into its sites, and the folder comes in around them.
    const WHEN = [0.44, 0.52, 0.58, 0.68];
    WHEN.forEach((at, i) => {
      const stars = $$(`.constellations [data-folder="${i}"] circle[data-site]`);
      if (stars.length) {
        pinned
          .to(stars, { attr: { cx: (_, el) => inChart(icons[el.dataset.site])[0], cy: (_, el) => inChart(icons[el.dataset.site])[1] }, duration: 0.17 }, at)
          .to(stars, { opacity: 0, duration: 0.06 }, at + 0.13);
      }
      pinned.to(show, { [`f${i}`]: 1, duration: 0.1, onUpdate: paint }, at + 0.09);
    });
    pinned.to(show, { rest: 1, duration: 0.06, onUpdate: paint }, 0.88).to({}, { duration: 0.04 }, 0.96);

    // The demo's section comes up: its own sky returns and the new tab settles into its frame.
    const hand = { q: 0 };
    gsap.timeline({
      scrollTrigger: {
        trigger: '#observe', start: 'top bottom', end: 'top 12%', scrub: 0.6, invalidateOnRefresh: true,
        onEnter: () => { setFull(true); place(hand.q); },
        onEnterBack: () => { setFull(true); place(hand.q); },
        onLeave: () => setFull(false)
      }
    })
      .fromTo(hand, { q: 0 }, { q: 1, duration: 1, ease: 'power2.inOut', immediateRender: false, onUpdate: () => { if (isFull()) place(hand.q); } }, 0)
      .fromTo(show, { sky: 0 }, { sky: 1, duration: 0.3, ease: 'none', immediateRender: false, onUpdate: paint }, 0)
      .set('.observe-head', { autoAlpha: 0, immediateRender: false }, 0.001)
      .to('.observe-head', { autoAlpha: 1, duration: 0.25, ease: 'power1.out' }, 0.6);

    return () => { setFull(false); Object.assign(show, { clock: 1, search: 1, f0: 1, f1: 1, f2: 1, f3: 1, rest: 1, sky: 1 }); paint(); };
  }

  /* Once a visit, the ring shows the other half of the day and comes back,
     so it is plain that it turns. Any touch of the page stops it. */
  function sweep() {
    try { if (sessionStorage.getItem('nordlys-site-swept')) return; sessionStorage.setItem('nordlys-site-swept', '1'); } catch { /* no storage here */ }
    if (!ring || !following || window.scrollY > 40 || location.hash) return;
    const gsap = window.gsap;
    const from = minutes;
    let to = from >= 360 && from < 1080 ? 0 : 720;
    if (to - from > 720) to -= 1440; else if (from - to > 720) to += 1440;
    const said = $('.readout-time');
    const dial = { value: from };
    const turn = () => setMinutes(dial.value, { preview: true });
    const done = () => { said.setAttribute('aria-live', 'polite'); if (following) setMinutes(nowMinutes()); };
    const run = gsap.timeline({ delay: 2.4, onStart: () => said.setAttribute('aria-live', 'off'), onComplete: done })
      .to(dial, { value: to, duration: 1.9, ease: 'power2.inOut', onUpdate: turn })
      .to(dial, { value: from, duration: 1.7, ease: 'power2.inOut', onUpdate: turn }, '+=0.5');
    let stopped = false;
    const stop = () => { if (stopped || run.progress() >= 1) return; stopped = true; run.kill(); done(); };
    ring.addEventListener('pointerdown', stop, { once: true });
    ring.addEventListener('keydown', stop, { once: true });
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    window.addEventListener('scroll', () => { if (window.scrollY > 40) stop(); }, { passive: true });
  }

  /* ── Motion ──────────────────────────────────────────────────────
     One opening, authored once: the window onto the sky opens as the page
     scrolls, and the sites come out as stars. Nothing else enters on its own
     but the colophon's last three lines. */
  if (still || !window.gsap || !window.ScrollTrigger) return;
  const gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);
  if (window.Lenis && !phone) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on('scroll', window.ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // On arrival the window opens on the sky and the ring's ticks come round.
  // Scrolling finishes the arrival at once, so the scroll's own moves take over.
  const arrival = gsap.timeline()
    .fromTo(hero, { '--rw': '0px' }, { '--rw': () => `${geometry.r}px`, duration: 1.8, ease: 'expo.out' }, 0.1)
    .from('.ring .tick, .ring text', { opacity: 0, duration: 0.5, stagger: { each: 0.006 }, ease: 'power2.out' }, 0.35)
    .from('.atlas-title, .atlas-line, .hero .lede, .hero-act, .readout', { opacity: 0, y: 14, duration: 1.1, stagger: 0.08, ease: 'expo.out' }, 0.2);
  const arrived = () => { if (arrival.progress() < 1) arrival.progress(1); };

  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    // Scrolling on, the window opens until the sky fills the page.
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: '+=85%', scrub: 0.6, pin: true, anticipatePin: 1, onUpdate: self => { arrived(); lamp(self.progress > 0.45); } } })
      .fromTo(hero, { '--rw': () => `${geometry.r}px` }, { '--rw': () => `${Math.hypot(window.innerWidth, window.innerHeight) * 1.05}px`, ease: 'power2.in', immediateRender: false }, 0)
      // From stated values: the arrival above is still animating these when this is built.
      .fromTo('.hero-copy, .hero-act, .readout', { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -28, ease: 'power1.in', duration: 0.45, immediateRender: false }, 0)
      .fromTo('.planisphere', { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.14, ease: 'power1.in', duration: 0.55, immediateRender: false }, 0)
      .fromTo('.graticule', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.6, immediateRender: false }, 0.2);
  });

  // The constellations draw themselves as the chart comes up.
  const lines = $$('.constellations .line');
  for (const line of lines) {
    const length = Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value);
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
  }
  // On a computer the stars go on to become the new tab, so they finish drawing as the chart stops.
  const assembly = !phone && Boolean(chart) && matchMedia('(min-width: 761px)').matches;
  const drawn = { trigger: '#chart', start: 'top 72%', end: assembly ? 'top top' : 'center 52%', scrub: 0.5 };
  gsap.to(lines, { strokeDashoffset: 0, ease: 'none', stagger: 0.05, scrollTrigger: drawn });
  gsap.from('.constellations .star, .constellations .glow', { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', stagger: 0.02, ease: 'back.out(2)', scrollTrigger: drawn });
  gsap.from('.constellations .label, .constellations .folder', { opacity: 0, stagger: 0.015, ease: 'none', scrollTrigger: drawn });

  if (assembly) mm.add('(min-width: 761px)', assemble);

  gsap.from('.colophon h2 span', { yPercent: 35, opacity: 0, duration: 1.2, stagger: 0.16, ease: 'expo.out', scrollTrigger: { trigger: '#get', start: 'top 62%' } });

  sweep();

  document.fonts?.ready?.then(() => window.ScrollTrigger.refresh());
  frame.addEventListener('load', () => window.ScrollTrigger.refresh());
})();
