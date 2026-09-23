/* The site runs the extension's own sky (sky/background.js, copied from
   src/js by tools/site-build.cjs) behind the hero, and lets a visitor switch
   its scene and light it by their time of day, the way the settings do. */
(function () {
  document.documentElement.classList.add('js');

  // Install: straight to the store once there is a store page.
  const store = document.querySelector('meta[name="nordlys-store"]')?.content.trim();
  if (store) {
    for (const link of document.querySelectorAll('[data-install]')) { link.href = store; link.textContent = 'Add to Chrome'; }
    const button = document.querySelector('[data-store]');
    if (button) { button.href = store; button.hidden = false; }
  }

  // The bar gains its glass once the page moves under it.
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Sections rise in as they arrive.
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('shown'); seen.unobserve(entry.target); }
    }, { rootMargin: '0px 0px -12% 0px' });
    reveals.forEach(node => seen.observe(node));
  } else {
    reveals.forEach(node => node.classList.add('shown'));
  }

  if (typeof NordlysBackgroundEngine !== 'function') return;
  const engine = new NordlysBackgroundEngine();
  engine.setMode('aurora');

  /* The hero text, told to the engine the way the new tab tells it about the
     clock: where it is and what colour, so the sky behind it is quietened
     just enough to keep it readable. */
  const hero = document.getElementById('top');
  const ink = node => (getComputedStyle(node).color.match(/\d+(\.\d+)?/g) || [233, 239, 251]).slice(0, 3).map(Number);
  const zones = () => {
    const list = [];
    for (const [id, target] of [['hero-title', 3.3], ['hero-lede', 4.8], ['sky-label', 4.8]]) {
      const node = document.getElementById(id);
      const box = node?.getBoundingClientRect();
      if (!box || box.bottom < 0 || box.top > window.innerHeight) continue;
      const pad = Math.min(24, box.height * 0.3);
      list.push({ id, x: box.left - pad, y: box.top - pad / 2, w: box.width + pad * 2, h: box.height + pad, inks: [[ink(node), target, 1]] });
    }
    return list;
  };
  let queued = false;
  const sendZones = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; engine.setQuietZones?.(zones()); });
  };
  window.addEventListener('scroll', sendZones, { passive: true });
  window.addEventListener('resize', sendZones);
  document.fonts?.ready.then(sendZones);
  sendZones();

  // Nothing to draw while neither the hero nor the closing section shows it.
  const install = document.getElementById('install');
  if ('IntersectionObserver' in window) {
    const showing = new Set();
    const watch = new IntersectionObserver(entries => {
      for (const entry of entries) entry.isIntersecting ? showing.add(entry.target) : showing.delete(entry.target);
      if (showing.size) { engine.start(); engine.resumeIfMoving(); } else engine.stop();
    });
    watch.observe(hero);
    if (install) watch.observe(install);
  }

  // Scenes: a radio group, walked with the arrow keys.
  const scenes = [...document.querySelectorAll('[data-scene]')];
  const choose = button => {
    for (const other of scenes) {
      const on = other === button;
      other.setAttribute('aria-checked', String(on));
      other.tabIndex = on ? 0 : -1;
    }
    engine.setMode(button.dataset.scene);
    sendZones();
  };
  scenes.forEach((button, index) => {
    button.addEventListener('click', () => choose(button));
    button.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = scenes[(index + step + scenes.length) % scenes.length];
      next.focus();
      choose(next);
    });
  });

  // Time of day: the visitor's own, from their time zone.
  const toggle = document.getElementById('daylight');
  const now = document.getElementById('daylight-now');
  if (!window.NordlysSky?.daylight) { toggle.hidden = true; return; }
  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(on));
    engine.setDaylight(on);
    now.textContent = on && engine.sky?.phase ? `Now: ${engine.sky.phase}` : '';
  });
})();
