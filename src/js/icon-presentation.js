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
  window.NordlysIcons = { classifyIcon, resolvePresentation, renderIcon };
})();
