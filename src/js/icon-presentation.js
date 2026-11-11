/* Source-aware icon sizing and contrast treatment shared by canvas and previews. */
(function () {
  /* What kind of art the tile shows. An icon the resolver found from the
     bookmark's address is as built-in as one written on the bookmark: imported
     and browser-mirrored bookmarks never carry a key, and they used to fall to
     a monogram while the vector for their site sat unused. */
  function classifyIcon(source = {}, metadata = null) {
    if (source.monogram) return 'monogram';
    if (source.customImg) {
      const url = String(source.customImg);
      return /(?:_favicon|favicons\?|duckduckgo\.com\/ip3|apple-touch-icon)/i.test(url) ? 'favicon' : 'raster';
    }
    return (source.icon || metadata?.p) ? 'builtin' : 'monogram';
  }
  function clampScale(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1.12, Math.max(.88, number)) : 1;
  }
  function resolvePresentation({ source = {}, key = source.icon, metadata = {}, isLight = false } = {}) {
    const kind = classifyIcon(source, metadata);
    const tone = metadata.monochrome ? (isLight ? 'dark' : 'light') : 'brand';
    return { kind, key, source, metadata, opticalScale: clampScale(metadata.opticalScale), tone, accent: source.color || 'var(--nl-text-primary)', def: metadata.p ? metadata : null };
  }
  function renderIcon(presentation) {
    const wrapper = document.createElement('span'); wrapper.className = 'nl-icon';
    wrapper.dataset.iconKind = presentation.kind;
    if (presentation.key) wrapper.dataset.iconKey = presentation.key;
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
  /* Every tile of a folder asks about the same few colours, and reading a
     pixel back is the slow part, so each answer is kept. */
  const painted = new Map();
  function paint(colour, base) {
    const key = `${base || ''}|${colour}`;
    const known = painted.get(key);
    if (known) return [...known];
    const context = canvas2d(); context.canvas.width = context.canvas.height = 1;
    context.clearRect(0, 0, 1, 1);
    if (base) { context.fillStyle = base; context.fillRect(0, 0, 1, 1); }
    context.fillStyle = colour; context.fillRect(0, 0, 1, 1);
    const pixel = [...context.getImageData(0, 0, 1, 1).data];
    if (painted.size > 500) painted.clear();
    painted.set(key, pixel);
    return [...pixel];
  }

  /* Composite the plate over its ancestors until the stack is opaque, so a
     translucent plate is judged by what the eye receives, not by its own alpha. */
  /* A gradient is judged by the average of its stops. Light themes paint their
     plates entirely with gradients, over a transparent background colour, and
     reading only the colour judged every one of them by whatever sat behind. */
  const COLOUR_TOKEN = /rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b/gi;
  function gradientAverage(image) {
    const stops = (image && image !== 'none' ? image.match(COLOUR_TOKEN) : null) || [];
    if (!stops.length) return null;
    const sum = [0, 0, 0, 0];
    for (const stop of stops) {
      const [r, g, b, a] = paint(stop);
      sum[0] += r * a; sum[1] += g * a; sum[2] += b * a; sum[3] += a;
    }
    if (!sum[3]) return null;
    const alpha = sum[3] / stops.length / 255;
    return `rgba(${Math.round(sum[0] / sum[3])}, ${Math.round(sum[1] / sum[3])}, ${Math.round(sum[2] / sum[3])}, ${alpha.toFixed(3)})`;
  }

  const stacked = new Map();
  function plateLuminance(node) {
    const layers = [];
    for (let current = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      const painted = [gradientAverage(style.backgroundImage), style.backgroundColor].filter(layer => layer && paint(layer)[3] > 0);
      if (!painted.length) continue;
      // The image sits over the colour, so it is the later of the two to paint.
      layers.unshift(...painted.reverse());
      if (painted.some(layer => paint(layer)[3] > 250)) break;
    }
    // The same stack of layers is the same plate: most tiles share one.
    const key = layers.join('>');
    if (stacked.has(key)) return stacked.get(key);
    const context = canvas2d(); context.canvas.width = context.canvas.height = 1;
    context.clearRect(0, 0, 1, 1); context.fillStyle = '#000'; context.fillRect(0, 0, 1, 1);
    for (const layer of layers) { context.fillStyle = layer; context.fillRect(0, 0, 1, 1); }
    const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data];
    if (stacked.size > 200) stacked.clear();
    stacked.set(key, luminanceOf(r, g, b));
    return stacked.get(key);
  }

  /* Average the opaque pixels of a raster icon. Returns null when the source
     cannot be read — a cross-origin image taints the canvas — so the caller
     can fall back rather than guess wrong. */
  function sampleImage(src) {
    if (sampledLuminance.has(src)) return Promise.resolve(sampledLuminance.get(src));
    // Keyed by the source, which can be a whole data: URL: bounded like the caches beside it.
    if (sampledLuminance.size > 300) sampledLuminance.clear();
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
          let total = 0, weight = 0, colourful = 0, covered = 0, grey = 0, greyLight = 0;
          const sum = [0, 0, 0];
          for (let at = 0; at < data.length; at += 4) {
            const alpha = data[at + 3] / 255;
            if (alpha < .1) continue;
            covered++;
            const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
            total += luminanceOf(r, g, b) * alpha; weight += alpha;
            sum[0] += r * alpha; sum[1] += g * alpha; sum[2] += b * alpha;
            // Distance between the channels is what makes a mark "coloured".
            // A grey, black or white logo has almost none.
            if (Math.max(r, g, b) - Math.min(r, g, b) > 28) colourful += alpha;
            // The rest is black, white or grey: the part of a mark that may change sides.
            else { grey += alpha; greyLight += luminanceOf(r, g, b) * alpha; }
          }
          /* One colour throughout, whatever the colour: a navy mark is as much a
             single-colour mark as a black one. Nearly every pixel sits by the
             average of them all, and the corners are clear. A plate is not a mark,
             and a rounded one has clear corners too: it is told by how much of the
             box it fills, more than a full circle does (0.79). */
          let near = 0;
          for (let at = 0; weight && at < data.length; at += 4) {
            if (data[at + 3] / 255 < .1) continue;
            if (Math.abs(data[at] - sum[0] / weight) + Math.abs(data[at + 1] - sum[1] / weight) + Math.abs(data[at + 2] - sum[2] / weight) < 72) near += data[at + 3] / 255;
          }
          const clear = [3, 63, 963, 1023].filter(at => data[at] < 26).length >= 3;
          const mark = clear && covered / 256 < 0.86;
          resolve(weight ? {
            luminance: total / weight, colourRatio: colourful / weight, flat: mark && near / weight > 0.9,
            /* A mark in black or white with a colour of its own beside it (a black
               letter over an orange stroke): how much of it is the black or white,
               and how light that part is. */
            mark, greyShare: grey / weight, greyLuminance: grey ? greyLight / grey : 0
          } : null);
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
    // The picture as it was given, not the redrawn one a tone may have put in its place.
    if (image) return sampleImage(image.dataset.iconArt || image.currentSrc || image.src);
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
     art alone, 'light'/'dark' force a direction, 'inverted' turns it to the
     other side from the one it was found on, anything else re-decides. */
  const COLOURFUL_ENOUGH = 0.25;
  /* Inverting is only right for a picture with no colour in it at all: black
     becomes white and nothing else moves. With any colour in it (a white
     letter over an orange stroke) inversion would paint the orange blue, so
     such a mark is drawn as its shape instead. */
  const GREY_ENOUGH = 0.02;

  // Glyphs from the library, which carry the bookmark's own colour.
  const GENERIC_GLYPHS = new Set(['school', 'keyboard', 'terminal', 'globe', 'brain', 'tag', 'crosshair', 'flag', 'steering', 'bag']);
  const GLYPH_CONTRAST = 3;

  /* The chosen colour if it already reads on the plate; otherwise the nearest
     colour of the same hue that does, or null if even black or white would not. */
  function readableAgainst(rgb, surface, target) {
    const [r, g, b] = rgb;
    if (contrast(luminanceOf(r, g, b), surface) >= target) return null;
    const lighter = surface < 0.18;
    const { toOklch, displayable } = window.NordlysColour;
    let [L, C, H] = toOklch([r, g, b]);
    for (let step = 0; step < 200; step++) {
      L += lighter ? 0.005 : -0.005;
      if (L <= 0 || L >= 1) break;
      const [x, y, z] = displayable(L, C, H);
      if (contrast(luminanceOf(x, y, z), surface) >= target) return `rgb(${x}, ${y}, ${z})`;
    }
    return null;
  }

  /* The black, white or grey is the mark itself, with a colour beside it, when
     it is most of what is drawn. Less than that and it is a sign on a coloured
     ground (the white in Steam's blue circle), which reads wherever the
     ground does and is never turned over. */
  const GREY_PART = 0.5;
  const inParts = (art) => Boolean(art && art.mark && art.colourRatio > GREY_ENOUGH && art.greyShare >= GREY_PART);

  /* The picture with its black, white and grey turned over and every colour
     left as it is: Amazon's black letter becomes white, its orange stays
     orange. No filter can do that to one part of a picture, so it is drawn
     once and kept. Null when the picture cannot be read. */
  const turned = new Map();
  function turnedOver(src) {
    if (turned.has(src)) return turned.get(src);
    if (turned.size > 120) turned.clear();
    const pending = new Promise(resolve => {
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onload = () => {
        try {
          const wide = probe.naturalWidth || 256, high = probe.naturalHeight || 256;
          // A vector has no size of its own worth keeping; a raster keeps its own, up to what a tile shows.
          const scale = /^data:image\/svg\+xml/i.test(src) ? 256 / Math.max(wide, high) : Math.min(1, 256 / Math.max(wide, high));
          const surface = document.createElement('canvas');
          surface.width = Math.max(1, Math.round(wide * scale)); surface.height = Math.max(1, Math.round(high * scale));
          const context = surface.getContext('2d', { willReadFrequently: true });
          context.drawImage(probe, 0, 0, surface.width, surface.height);
          const pixels = context.getImageData(0, 0, surface.width, surface.height);
          const { data } = pixels;
          for (let at = 0; at < data.length; at += 4) {
            if (!data[at + 3] || Math.max(data[at], data[at + 1], data[at + 2]) - Math.min(data[at], data[at + 1], data[at + 2]) > 28) continue;
            data[at] = 255 - data[at]; data[at + 1] = 255 - data[at + 1]; data[at + 2] = 255 - data[at + 2];
          }
          context.putImageData(pixels, 0, 0);
          resolve(surface.toDataURL('image/png'));
        } catch { resolve(null); }
      };
      probe.onerror = () => resolve(null);
      probe.src = src;
    });
    turned.set(src, pending);
    return pending;
  }

  /* How a tone is worn. `how` is 'flat' for a mark drawn as its shape, 'parts'
     for one whose black or white is turned over beside a colour that stays,
     and nothing for a plain inversion. */
  function wearTone(wrapper, tone, how = null) {
    if (tone) wrapper.dataset.iconTone = tone; else delete wrapper.dataset.iconTone;
    if (tone && (how === 'flat' || how === true)) wrapper.dataset.iconFlat = ''; else delete wrapper.dataset.iconFlat;
    const image = wrapper.querySelector('img');
    if (tone && how === 'parts' && image) {
      const art = image.dataset.iconArt || image.currentSrc || image.src;
      wrapper.dataset.iconParts = '';
      turnedOver(art).then((drawn) => {
        // Decided again since, or the picture could not be read: nothing to put in.
        if (!drawn || !('iconParts' in wrapper.dataset)) { if (!drawn) { delete wrapper.dataset.iconParts; delete wrapper.dataset.iconTone; } return; }
        image.dataset.iconArt = art;
        if (image.src !== drawn) image.src = drawn;
      });
      return;
    }
    delete wrapper.dataset.iconParts;
    if (image?.dataset.iconArt) { image.src = image.dataset.iconArt; delete image.dataset.iconArt; }
  }

  async function applyIconContrast(plate, wrapper = plate?.querySelector('.nl-icon')) {
    if (!plate || !wrapper) return;
    const forced = wrapper.dataset.iconToneChoice;
    if (forced === 'original') { wearTone(wrapper, null); return; }
    if (forced === 'light' || forced === 'dark' || forced === 'inverted') {
      /* Asked for by hand. Light and Dark name the side the mark should be on;
         Inverted is the other side from the one it was found on. A picture in
         several colours with no black or white in it has no other side, and
         is left as it is. */
      const art = wrapper.querySelector('img') ? await iconAppearance(wrapper) : null;
      if (!art) {
        // A library mark or letters: drawn in a colour, which a tone replaces.
        const own = forced === 'inverted' ? await iconAppearance(wrapper) : null;
        wearTone(wrapper, forced === 'inverted' ? (own && own.luminance > 0.4 ? 'dark' : 'light') : forced);
        return;
      }
      const side = (light) => (light > 0.4 ? 'dark' : 'light');
      if (inParts(art)) {
        const want = forced === 'inverted' ? side(art.greyLuminance) : forced;
        // Already on the side asked for: the picture as it is.
        if (want === side(art.greyLuminance)) wearTone(wrapper, want, 'parts'); else wearTone(wrapper, null);
      } else if (art.colourRatio > COLOURFUL_ENOUGH && !art.flat) wearTone(wrapper, null);
      else wearTone(wrapper, forced === 'inverted' ? side(art.luminance) : forced, art.colourRatio > GREY_ENOUGH ? 'flat' : null);
      return;
    }

    // Always measure on a settled frame. Callers build tiles detached and attach
    // them afterwards — getComputedStyle reports nothing for a detached element —
    // and a theme swap runs through a view transition and then a colour
    // transition, so the palette is not in place the instant setTheme returns.
    // One frame used to be the whole wait, which measured the plate halfway
    // between two themes and toned marks for the one being left.
    await new Promise(resolve => requestAnimationFrame(resolve));
    // And after that frame is drawn: the first new-tab frame never waits for it.
    await new Promise(resolve => setTimeout(resolve, 0));
    await window.NordlysUI?.settled?.();
    if (!plate.isConnected) return;
    const surface = plateLuminance(plate);

    /* A library glyph — a bag, a school, a flag — wears the colour the person
       gave the bookmark, not a brand's, so its displayed colour may move: same
       hue, same chroma, lightness walked away from the plate until it reads at
       3:1. What is stored stays exactly what they chose. */
    if (GENERIC_GLYPHS.has(wrapper.dataset.iconKey)) {
      const chosen = wrapper.dataset.iconSource;
      const shown = chosen && chosen !== 'var(--nl-text-primary)' ? readableAgainst(paint(chosen, '#000'), surface, GLYPH_CONTRAST) : null;
      if (shown) wrapper.style.setProperty('--icon-accent', shown); else if (chosen) wrapper.style.setProperty('--icon-accent', chosen);
      wearTone(wrapper, null);
      return;
    }

    const icon = await iconAppearance(wrapper);
    if (!plate.isConnected) return;
    if (!icon) { wearTone(wrapper, null); return; }

    /* Black or white beside a colour: the two are judged apart. The orange
       stroke carries the average over the line while the black letter above
       it is lost on a dark tile; only the letter changes sides. */
    if (inParts(icon)) {
      if (contrast(icon.greyLuminance, surface) >= MIN_ICON_CONTRAST) wearTone(wrapper, null);
      else wearTone(wrapper, surface > 0.5 ? 'dark' : 'light', 'parts');
      return;
    }
    if (contrast(icon.luminance, surface) >= MIN_ICON_CONTRAST) { wearTone(wrapper, null); return; }
    // It is hard to see — but re-toning a coloured logo would destroy it, so that
    // case is left to the per-bookmark control rather than guessed at.
    /* A mark drawn in one colour throughout is the exception: dark navy on a
       dark tile is as lost as black, and its shape is the mark. It is shown in
       the tile's own light or dark instead, and goes back to its colour on a
       theme where that colour reads. */
    if (icon.colourRatio > COLOURFUL_ENOUGH && !icon.flat) { wearTone(wrapper, null); return; }
    wearTone(wrapper, surface > 0.5 ? 'dark' : 'light', icon.colourRatio > GREY_ENOUGH ? 'flat' : null);
  }

  /* A tone is only correct for the surface it was measured against, so every
     theme change re-decides all of them. */
  /* Toning waits for the theme to settle and then changes each mark, with
     its own short transition — so "the theme has settled" is not yet "the
     icons have". toned() answers the latest pass, for anything that has to
     look at the finished board. */
  let toning = Promise.resolve();
  function refreshIconContrast(root = document) {
    toning = Promise.all([...root.querySelectorAll('.nl-icon')]
      .filter(wrapper => wrapper.parentElement)
      .map(wrapper => applyIconContrast(wrapper.parentElement, wrapper)));
    return toning;
  }
  const toned = () => toning;

  /* Whether turning the icon over would change anything: a picture in several
     colours with no black or white in it has no other side. */
  async function invertible(wrapper) {
    if (!wrapper) return false;
    if (!wrapper.querySelector('img')) return true;
    const art = await iconAppearance(wrapper);
    return Boolean(art && (inParts(art) || !(art.colourRatio > COLOURFUL_ENOUGH && !art.flat)));
  }

  window.NordlysIcons = { classifyIcon, resolvePresentation, renderIcon, plateLuminance, applyIconContrast, refreshIconContrast, toned, invertible, readableAgainst, gradientAverage, MIN_ICON_CONTRAST };
})();
