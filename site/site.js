/* The page around the live demo. The hero is the extension's own new tab
   (demo/index.html, built by tools/site-build.cjs) in an iframe; the controls
   under it call the same app object the extension's settings call. The
   closing section runs the extension's sky (sky/background.js) on its own. */
(function () {
  document.documentElement.classList.add('js');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Getting it: each store's page from a meta tag (empty means not there
     yet), and the visitor's own browser picked out, so the main button says
     "Add to Edge" in Edge and goes to the right place. */
  const stores = Object.fromEntries(['chrome', 'edge', 'firefox', 'safari'].map(key => [key, document.querySelector(`meta[name="nordlys-store-${key}"]`)?.content.trim() || '']));
  const ua = navigator.userAgent;
  const phone = /Android|iPhone|iPad|Mobile/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Safari\//.test(ua) && !/Chrome\/|Chromium\//.test(ua) ? 'safari' : 'chrome';
  const NAMES = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari' };
  // Edge also installs from the Chrome Web Store, until its own listing is up.
  const target = stores[browser] || (browser === 'edge' ? stores.chrome : '');
  for (const tile of document.querySelectorAll('[data-store]')) {
    const url = stores[tile.dataset.store];
    if (url) tile.href = url; else { tile.classList.add('is-soon'); tile.removeAttribute('href'); tile.setAttribute('aria-disabled', 'true'); }
    tile.classList.toggle('is-yours', tile.dataset.store === browser && !phone);
  }
  const label = document.querySelector('[data-get-label]');
  const note = document.querySelector('[data-get-note]');
  if (phone) {
    if (label) label.textContent = 'Try it here';
    for (const link of document.querySelectorAll('[data-primary]')) link.href = '#try';
    if (note) note.textContent = 'Nordlys is for the browser on your computer. You can try it right here.';
  } else if (target) {
    if (label) label.textContent = `Add to ${NAMES[browser]}, it's free`;
    for (const link of document.querySelectorAll('[data-get]')) link.href = target;
    if (note && browser === 'edge' && !stores.edge) note.textContent = 'In Edge, it installs from the Chrome Web Store.';
  } else {
    if (label) label.textContent = `Coming soon to ${NAMES[browser]}`;
    if (note) note.textContent = `The ${NAMES[browser]} version is waiting for the store's review. You can try it here meanwhile, or use it in Chrome or Edge.`;
    for (const link of document.querySelectorAll('[data-primary]')) link.href = '#try';
  }

  // The island gains its glass once the page moves under it.
  const nav = document.getElementById('nav');
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:24px;width:1px';
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => nav.classList.toggle('scrolled', !entry.isIntersecting)).observe(sentinel);

  // Sections rise in as they arrive.
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !still) {
    const seen = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('shown'); seen.unobserve(entry.target); }
    }, { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(node => seen.observe(node));
  } else {
    reveals.forEach(node => node.classList.add('shown'));
  }

  // The headline, a letter at a time (words kept whole for line breaks).
  for (const title of document.querySelectorAll('.split')) {
    if (still) break;
    const words = title.textContent.trim().split(/\s+/);
    let n = 0;
    title.setAttribute('aria-label', title.textContent.trim());
    title.replaceChildren(...words.flatMap((word, w) => {
      const box = document.createElement('span');
      box.style.whiteSpace = 'nowrap';
      box.setAttribute('aria-hidden', 'true');
      for (const letter of word) {
        const ch = document.createElement('span');
        ch.className = 'ch';
        ch.style.setProperty('--n', String(n++));
        ch.textContent = letter;
        box.append(ch);
      }
      if (w === words.length - 1) return [box];
      const gap = document.createElement('span');
      gap.className = 'sp';
      gap.setAttribute('aria-hidden', 'true');
      gap.textContent = ' ';
      return [box, gap];
    }));
  }

  // Numbers count up the first time they are seen.
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !still) {
    const seenCount = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seenCount.unobserve(entry.target);
        const target = Number(entry.target.dataset.count);
        const start = performance.now();
        const step = now => {
          const t = Math.min(1, (now - start) / 1200);
          entry.target.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(step);
        };
        entry.target.textContent = '0';
        requestAnimationFrame(step);
      }
    }, { threshold: 0.6 });
    counters.forEach(node => seenCount.observe(node));
  }

  // A light that follows the pointer across the hero, and buttons that lean toward it.
  const heroSection = document.getElementById('top');
  if (!still && matchMedia('(hover: hover)').matches) {
    heroSection.addEventListener('pointermove', event => {
      const box = heroSection.getBoundingClientRect();
      heroSection.style.setProperty('--hx', `${event.clientX - box.left}px`);
      heroSection.style.setProperty('--hy', `${event.clientY - box.top}px`);
    });
    for (const pill of document.querySelectorAll('.pill')) {
      pill.addEventListener('pointermove', event => {
        const box = pill.getBoundingClientRect();
        pill.style.setProperty('--mx-pull', `${((event.clientX - box.left) / box.width - 0.5) * 8}px`);
        pill.style.setProperty('--my-pull', `${((event.clientY - box.top) / box.height - 0.5) * 6}px`);
      });
      pill.addEventListener('pointerleave', () => { pill.style.removeProperty('--mx-pull'); pill.style.removeProperty('--my-pull'); });
    }
  }

  // ── The live demo ────────────────────────────────────────────
  const stage = document.getElementById('try');
  const viewport = document.getElementById('viewport');
  const frame = document.getElementById('demo');
  const DESK = { w: 1440, h: 900 };

  /* The demo is laid out at a desktop size and scaled to fit the frame, so a
     visitor sees the page the way it looks on a real screen. Below a width
     where that would be too small to use, the still picture stands in. */
  const fit = () => {
    const width = viewport.clientWidth;
    const scale = width / DESK.w;
    viewport.style.setProperty('--scale', scale.toFixed(4));
    viewport.style.height = `${Math.round(DESK.h * scale)}px`;
    stage.classList.toggle('compact', width < 620);
  };
  new ResizeObserver(fit).observe(viewport);
  fit();

  const ready = new Promise(resolve => {
    const look = () => {
      try {
        const candidate = frame.contentWindow?.Nordlys;
        if (candidate?.config && candidate.grid) { resolve(candidate); return; }
      } catch (error) { /* not loaded yet */ }
      setTimeout(look, 120);
    };
    frame.addEventListener('load', look);
    look();
  });
  ready.then(() => stage.classList.add('live'));

  const setScene = key => ready.then(demo => {
    demo.config.bgMode = key;
    demo.saveConfig();
    demo.updateBackgroundMode();
  });
  const setTheme = key => ready.then(demo => { demo.setTheme(key); demo.saveConfig?.(); });

  // One radio group per kind, walked with the arrow keys.
  const radioGroup = (buttons, attr, onPick) => {
    const pick = (value, { focus = false } = {}) => {
      for (const button of buttons) {
        const on = button.dataset[attr] === value;
        if (button.getAttribute('role') === 'radio') {
          button.setAttribute('aria-checked', String(on));
          button.tabIndex = on ? 0 : -1;
          if (on && focus) button.focus();
        } else button.classList.toggle('on', on);
      }
      onPick(value);
    };
    const radios = buttons.filter(button => button.getAttribute('role') === 'radio');
    radios.forEach((button, index) => {
      button.tabIndex = button.getAttribute('aria-checked') === 'true' ? 0 : -1;
      button.addEventListener('keydown', event => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        pick(radios[(index + step + radios.length) % radios.length].dataset[attr], { focus: true });
      });
    });
    buttons.forEach(button => button.addEventListener('click', () => pick(button.dataset[attr])));
    return pick;
  };

  /* The controls show what the demo shows, however it got there: a command
     typed in it, its own settings, or a profile with a look of its own. */
  const mark = (selector, attr, value) => {
    for (const button of document.querySelectorAll(selector)) {
      const on = button.dataset[attr] === value;
      if (button.getAttribute("role") === "radio") { button.setAttribute("aria-checked", String(on)); button.tabIndex = on ? 0 : -1; }
      else button.classList.toggle("on", on);
    }
  };
  const syncDock = () => ready.then(demo => {
    mark("[data-scene]", "scene", demo.config.bgMode);
    mark("[data-theme]", "theme", demo.config.theme);
    document.querySelector("[data-try=\"arrange\"]")?.setAttribute("aria-pressed", String(Boolean(demo.grid.arrange?.active)));
    document.querySelector("[data-try=\"daylight\"]")?.setAttribute("aria-pressed", String(Boolean(demo.config.bgDaylight)));
    const focusOpen = Boolean(frame.contentDocument.getElementById('focus-mode')?.classList.contains('is-open'));
    showTab(focusOpen ? 'focus' : demo.dashboard?.on ? 'dashboard' : 'board');
  });
  const tabs = [...document.querySelectorAll('[data-view]')];
  const showTab = view => {
    for (const tab of tabs) { const on = tab.dataset.view === view; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; }
  };
  let dockTimer = 0;
  const syncSoon = () => { clearTimeout(dockTimer); dockTimer = setTimeout(syncDock, 350); };
  ready.then(() => {
    for (const type of ["click", "keyup", "change"]) frame.contentDocument.addEventListener(type, syncSoon, true);
  });

  const sceneButtons = [...document.querySelectorAll('[data-scene]')];
  const pickScene = radioGroup(sceneButtons, 'scene', setScene);
  // A sky in the gallery below puts it on the demo and brings the demo into view.
  for (const card of document.querySelectorAll('.sky[data-scene]')) {
    card.addEventListener('click', () => {
      pickScene(card.dataset.scene);
      stage.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    });
  }
  radioGroup([...document.querySelectorAll('[data-theme]')], 'theme', setTheme);

  const inDemo = fn => ready.then(demo => { frame.contentWindow.focus(); return fn(demo, frame.contentDocument); });
  const actions = {
    arrange: () => inDemo(demo => (demo.grid.arrange?.active ? demo.grid.arrange.exit() : demo.grid.arrange?.enter())),
    settings: () => inDemo(demo => demo.settings.open()),
    command: () => inDemo((demo, doc) => {
      const box = doc.getElementById('q');
      box.focus();
      box.value = '>';
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }),
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
      if (!dash) return;
      if (dash.on) { dash.setOn(false); return; }
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
    }),
    focus: () => inDemo(demo => demo.focusMode?.show()),
    daylight: () => inDemo(demo => {
      demo.config.bgDaylight = !demo.config.bgDaylight;
      demo.saveConfig();
      demo.updateBackgroundMode();
    })
  };
  for (const button of document.querySelectorAll('[data-try]')) {
    button.addEventListener('click', () => Promise.resolve(actions[button.dataset.try]?.(button)).then(syncSoon));
  }

  /* The three views: the plain board, the dashboard with a day in it, and
     focus mode. Picking one leaves the others. */
  const views = {
    board: () => inDemo(demo => { demo.focusMode?.hide?.(); if (demo.dashboard?.on) demo.dashboard.setOn(false); }),
    dashboard: () => inDemo(async demo => { demo.focusMode?.hide?.(); if (!demo.dashboard?.on) await actions.dashboard(); }),
    focus: () => inDemo(demo => demo.focusMode?.show())
  };
  const pickView = view => { showTab(view); return Promise.resolve(views[view]?.()).then(syncSoon); };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => pickView(tab.dataset.view));
    tab.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      pickView(next.dataset.view);
    });
  });
  showTab('board');

  // "Try it above": to the demo, and that view in it.
  for (const button of document.querySelectorAll('[data-show]')) {
    button.addEventListener('click', () => {
      stage.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => pickView(button.dataset.show), still ? 0 : 600);
    });
  }

  // The glow under the frame takes the demo's accent.
  ready.then(() => {
    const tint = () => {
      const accent = getComputedStyle(frame.contentDocument.documentElement).getPropertyValue('--accent').trim();
      if (accent) stage.style.setProperty('--demo-accent', accent);
    };
    new MutationObserver(tint).observe(frame.contentDocument.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
    tint();
  });

  // ── The closing sky ──────────────────────────────────────────
  if (typeof NordlysBackgroundEngine !== 'function') return;
  const install = document.getElementById('get');
  let engine = null;
  new IntersectionObserver(([entry]) => {
    document.body.classList.toggle("sky-on", entry.isIntersecting);
    if (entry.isIntersecting) {
      if (!engine) { engine = new NordlysBackgroundEngine(); engine.setMode('aurora'); }
      engine.start();
      engine.resumeIfMoving?.();
    } else engine?.stop();
  }, { threshold: 0.25 }).observe(install);
})();
