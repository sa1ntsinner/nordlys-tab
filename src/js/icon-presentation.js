/* Source-aware icon sizing and contrast treatment shared by canvas and previews. */
(function () {
  function classifyIcon(source = {}) {
    if (source.monogram) return 'monogram';
    if (source.customImg) {
      const url = String(source.customImg);
      return /(?:_favicon|favicons\?|duckduckgo\.com\/ip3|apple-touch-icon)/i.test(url) ? 'favicon' : 'raster';
    }
    return source.icon ? 'builtin' : 'monogram';
  }
  function clampScale(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1.12, Math.max(.88, number)) : 1;
  }
  function resolvePresentation({ source = {}, key = source.icon, metadata = {}, isLight = false } = {}) {
    const kind = classifyIcon(source);
    const tone = metadata.monochrome ? (isLight ? 'dark' : 'light') : 'brand';
    return { kind, key, source, metadata, opticalScale: clampScale(metadata.opticalScale), tone, accent: source.color || 'var(--nl-text-primary)', def: metadata.p ? metadata : null };
  }
  function renderIcon(presentation) {
    const wrapper = document.createElement('span'); wrapper.className = 'nl-icon';
    wrapper.dataset.iconKind = presentation.kind; wrapper.dataset.iconTone = presentation.tone;
    wrapper.style.setProperty('--icon-optical-scale', presentation.opticalScale);
    wrapper.style.setProperty('--icon-accent', presentation.accent);
    if (presentation.kind === 'builtin' && presentation.def) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', presentation.def.vb || '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', presentation.def.p); svg.append(path); wrapper.append(svg);
    } else if (presentation.kind === 'favicon' || presentation.kind === 'raster') {
      const img = document.createElement('img'); img.src = presentation.source.customImg; img.alt = ''; img.loading = 'lazy'; img.draggable = false; wrapper.append(img);
    } else {
      const mono = document.createElement('span'); mono.className = 'mono'; mono.textContent = presentation.source.monogram || String(presentation.source.name || 'A').trim().charAt(0).toUpperCase(); wrapper.append(mono);
    }
    return wrapper;
  }
  /* ── Plate contrast guarantee ─────────────────────────────────────
     An icon carries colours we do not control: a black favicon on a black
     theme is invisible, and repainting it would destroy the brand mark. So
     the plate moves instead of the icon. We measure what the icon actually
     renders as, compare it with what the plate actually renders as, and if
     they do not separate we swap the plate for the opposite end of the same
     theme palette — never an absolute white or black. */
  /* Deliberately below the 3:1 WCAG asks of a lone graphical control. A tile is
     never the only carrier of its meaning — it sits above its own text label —
     and demanding 3:1 would move the plate under ordinary brand colours too
     (Spotify green reads 2.6:1 on white, Steam blue 1.9:1), turning the board
     patchy to fix something that was never hard to see. This threshold catches
     the failure that actually hurts: an icon that vanishes into its plate. */
  const MIN_ICON_CONTRAST = 1.8;
  const sampledLuminance = new Map();
  let scratch = null;
  function canvas2d() {
    if (!scratch) scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    return scratch;
  }
  function channel(value) { return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4); }
  function luminanceOf(r, g, b) { return 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255); }
  function contrast(a, b) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }

  /* Paint the colour to know it: computed values arrive as rgb(), color(srgb ...)
     or color-mix() output, and only the painted pixel reads back the same in all. */
  function paint(colour, base) {
    const context = canvas2d(); context.canvas.width = context.canvas.height = 1;
    context.clearRect(0, 0, 1, 1);
    if (base) { context.fillStyle = base; context.fillRect(0, 0, 1, 1); }
    context.fillStyle = colour; context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  }
  function colourLuminance(colour) { const [r, g, b] = paint(colour, '#000'); return luminanceOf(r, g, b); }

  /* Composite the plate over its ancestors until the stack is opaque, so a
     translucent plate is judged by what the eye receives, not by its own alpha. */
  function plateLuminance(node) {
    const layers = [];
    for (let current = node; current; current = current.parentElement) {
      const background = getComputedStyle(current).backgroundColor;
      if (paint(background)[3] === 0) continue;
      layers.unshift(background);
      if (paint(background)[3] > 250) break;
    }
    const context = canvas2d(); context.canvas.width = context.canvas.height = 1;
    context.clearRect(0, 0, 1, 1); context.fillStyle = '#000'; context.fillRect(0, 0, 1, 1);
    for (const layer of layers) { context.fillStyle = layer; context.fillRect(0, 0, 1, 1); }
    const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data];
    return luminanceOf(r, g, b);
  }

  /* Average the opaque pixels of a raster icon. Returns null when the source
     cannot be read — a cross-origin image taints the canvas — so the caller
     can fall back rather than guess wrong. */
  function sampleImage(src) {
    if (sampledLuminance.has(src)) return Promise.resolve(sampledLuminance.get(src));
    const pending = new Promise(resolve => {
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onload = () => {
        try {
          // Its own canvas: several icons sample at once, and the shared scratch
          // is resized by the synchronous colour helpers between awaits.
          const surface = document.createElement('canvas'); surface.width = surface.height = 16;
          const context = surface.getContext('2d', { willReadFrequently: true });
          context.clearRect(0, 0, 16, 16); context.drawImage(probe, 0, 0, 16, 16);
          const { data } = context.getImageData(0, 0, 16, 16);
          let total = 0, weight = 0;
          for (let at = 0; at < data.length; at += 4) {
            const alpha = data[at + 3] / 255;
            if (alpha < .1) continue;
            total += luminanceOf(data[at], data[at + 1], data[at + 2]) * alpha; weight += alpha;
          }
          resolve(weight ? total / weight : null);
        } catch { resolve(null); }
      };
      probe.onerror = () => resolve(null);
      probe.src = src;
    }).then(value => { sampledLuminance.set(src, value); return value; });
    sampledLuminance.set(src, pending);
    return pending;
  }

  function iconLuminance(wrapper) {
    const image = wrapper.querySelector('img');
    if (image) return sampleImage(image.currentSrc || image.src);
    const vector = wrapper.querySelector('svg path, svg circle, svg rect');
    const painted = vector ? getComputedStyle(vector).fill : getComputedStyle(wrapper).color;
    return Promise.resolve(painted && painted !== 'none' ? colourLuminance(painted) : null);
  }

  /* Keep every plate identical and give the icon its own separation instead.
     One background cannot rescue a board holding both black and white logos —
     any tone that saves one drowns the other — so the tile surface stays uniform
     and an icon that would vanish gains a rim traced from its own shape. The
     logo's colour is never touched. */
  function wearHalo(wrapper, tone) {
    if (tone) wrapper.dataset.iconHalo = tone; else delete wrapper.dataset.iconHalo;
  }

  async function applyIconContrast(plate, wrapper = plate?.querySelector('.nl-icon')) {
    if (!plate || !wrapper) return;
    // Always measure on a settled frame. Callers build tiles detached and attach
    // them afterwards — getComputedStyle reports nothing for a detached element —
    // and a theme swap runs through a view transition, so the palette is not in
    // place the instant setTheme returns.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (!plate.isConnected) return;
    const icon = await iconLuminance(wrapper);
    if (!plate.isConnected) return;
    const surface = plateLuminance(plate);
    // The rim always opposes the plate: that guarantees it reads against the
    // surface, and the icon only needs one when it does not.
    const tone = surface > 0.5 ? 'dark' : 'light';
    if (icon == null) { wearHalo(wrapper, tone); return; }
    wearHalo(wrapper, contrast(icon, surface) >= MIN_ICON_CONTRAST ? null : tone);
  }

  /* A halo is only correct for the surface it was measured against, so every
     theme change re-decides all of them. */
  function refreshIconContrast(root = document) {
    root.querySelectorAll('.nl-icon').forEach(wrapper => {
      if (wrapper.parentElement) applyIconContrast(wrapper.parentElement, wrapper);
    });
  }

  window.NordlysIcons = { classifyIcon, resolvePresentation, renderIcon, applyIconContrast, refreshIconContrast, MIN_ICON_CONTRAST };
})();
