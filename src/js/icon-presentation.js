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
    wrapper.dataset.iconKind = presentation.kind;
    if (presentation.source.tone) wrapper.dataset.iconToneChoice = presentation.source.tone;
    wrapper.style.setProperty('--icon-optical-scale', presentation.opticalScale);
    wrapper.style.setProperty('--icon-accent', presentation.accent);
    // Remember what the art is, not what it currently renders as: once a tone is
    // applied the computed fill is our own output, and measuring that makes the
    // decision oscillate on every re-evaluation.
    wrapper.dataset.iconSource = presentation.accent;
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
          let total = 0, weight = 0, colourful = 0;
          for (let at = 0; at < data.length; at += 4) {
            const alpha = data[at + 3] / 255;
            if (alpha < .1) continue;
            const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
            total += luminanceOf(r, g, b) * alpha; weight += alpha;
            // Distance between the channels is what makes a mark "coloured".
            // A grey, black or white logo has almost none.
            if (Math.max(r, g, b) - Math.min(r, g, b) > 28) colourful += alpha;
          }
          resolve(weight ? { luminance: total / weight, colourRatio: colourful / weight } : null);
        } catch { resolve(null); }
      };
      probe.onerror = () => resolve(null);
      probe.src = src;
    }).then(value => { sampledLuminance.set(src, value); return value; });
    sampledLuminance.set(src, pending);
    return pending;
  }

  /* Reports what the icon actually renders as: how light it is, and whether it
     carries colour of its own. A single-colour mark may be re-toned — that is
     what its own brand guidance does across light and dark backgrounds — while
     a coloured logo never may, because the colour is the mark. */
  function iconAppearance(wrapper) {
    const image = wrapper.querySelector('img');
    if (image) return sampleImage(image.currentSrc || image.src);
    const vector = wrapper.querySelector('svg path, svg circle, svg rect');
    const declared = wrapper.dataset.iconSource;
    const painted = declared && declared !== 'var(--nl-text-primary)'
      ? declared
      : (vector ? getComputedStyle(vector).fill : getComputedStyle(wrapper).color);
    if (!painted || painted === 'none') return Promise.resolve(null);
    const [r, g, b] = paint(painted, '#000');
    return Promise.resolve({
      luminance: luminanceOf(r, g, b),
      colourRatio: Math.max(r, g, b) - Math.min(r, g, b) > 28 ? 1 : 0
    });
  }

  /* Plates stay identical on every tile. What changes, and only when it must, is
     the icon's own tone — and only for marks that carry no colour of their own.
     A black GitHub glyph on a black theme becomes light, exactly as GitHub's own
     guidance does it; YouTube's red is never touched, because the red is the mark.

     `tone` on the bookmark overrides the decision entirely: 'original' leaves the
     art alone, 'light'/'dark' force a direction, anything else re-decides. */
  const COLOURFUL_ENOUGH = 0.25;

  function wearTone(wrapper, tone) {
    if (tone) wrapper.dataset.iconTone = tone; else delete wrapper.dataset.iconTone;
  }

  async function applyIconContrast(plate, wrapper = plate?.querySelector('.nl-icon')) {
    if (!plate || !wrapper) return;
    const forced = wrapper.dataset.iconToneChoice;
    if (forced === 'original') { wearTone(wrapper, null); return; }
    if (forced === 'light' || forced === 'dark') { wearTone(wrapper, forced); return; }

    // Always measure on a settled frame. Callers build tiles detached and attach
    // them afterwards — getComputedStyle reports nothing for a detached element —
    // and a theme swap runs through a view transition, so the palette is not in
    // place the instant setTheme returns.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (!plate.isConnected) return;
    const icon = await iconAppearance(wrapper);
    if (!plate.isConnected) return;
    if (!icon) { wearTone(wrapper, null); return; }

    const surface = plateLuminance(plate);
    if (contrast(icon.luminance, surface) >= MIN_ICON_CONTRAST) { wearTone(wrapper, null); return; }
    // It is hard to see — but re-toning a coloured logo would destroy it, so that
    // case is left to the per-bookmark control rather than guessed at.
    if (icon.colourRatio > COLOURFUL_ENOUGH) { wearTone(wrapper, null); return; }
    wearTone(wrapper, surface > 0.5 ? 'dark' : 'light');
  }

  /* A tone is only correct for the surface it was measured against, so every
     theme change re-decides all of them. */
  function refreshIconContrast(root = document) {
    root.querySelectorAll('.nl-icon').forEach(wrapper => {
      if (wrapper.parentElement) applyIconContrast(wrapper.parentElement, wrapper);
    });
  }

  window.NordlysIcons = { classifyIcon, resolvePresentation, renderIcon, applyIconContrast, refreshIconContrast, MIN_ICON_CONTRAST };
})();
