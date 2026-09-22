/* The contrast instrument, shared by tools/qa-contrast.cjs (the full sweep) and
   tests/ui/contrast.spec.cjs (the gate), so the gate measures with exactly the
   instrument the sweep was calibrated with. See the tool for the method. */
const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..', '..');

// A theme is a block that names itself; Frosted Glass lives beside its material.
async function themeKeys() {
  const css = (await Promise.all(['themes.css', 'liquid-glass.css'].map(name => readFile(resolve(root, 'src/css', name), 'utf8')))).join('\n');
  return [...new Set([...css.matchAll(/\[data-theme="([a-z0-9-]+)"\][^{]*\{[^}]*--theme-name:/g)].map(match => match[1]))];
}

/* ── In-page: find every run of text a reader can see ─────────────────── */
function collectRuns(scope) {
  /* Settle the page the way the screenshot will: finite animations and
     transitions jump to their end, infinite ones go back to their start.
     Reading colours mid-transition measured the previous theme's ink. */
  for (const animation of document.getAnimations()) {
    try {
      if (animation.effect?.getComputedTiming().iterations === Infinity) animation.cancel();
      else animation.finish();
    } catch { /* an animation without an end cannot be finished; leave it */ }
  }
  const out = [];
  const within = scope ? document.querySelector(scope) : null;
  const viewport = { x: 0, y: 0, w: innerWidth, h: innerHeight };
  const intersect = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };
  // Clipped by any ancestor that clips: scroll boxes, sr-only boxes, masks.
  const clip = (rect, el) => {
    let box = intersect(rect, viewport);
    for (let node = el; node && box && node !== document.documentElement; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none' || cs.clip !== 'auto') {
        const r = node.getBoundingClientRect();
        box = intersect(box, { x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    return box;
  };
  const opacityOf = el => {
    let value = 1;
    for (let node = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  };
  /* Colours are read by painting them: computed values arrive as rgb(), but
     also as oklch() and color(srgb …) once a colour-mix is involved, and text
     in a colour the reader could not parse used to go unmeasured. */
  const well = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  well.canvas.width = well.canvas.height = 1;
  const parse = value => {
    if (!value) return null;
    well.clearRect(0, 0, 1, 1);
    well.fillStyle = '#000';
    well.fillStyle = value;
    well.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = well.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const describe = el => {
    const parts = [];
    for (let node = el; node && node !== document.body && parts.length < 3; node = node.parentElement) {
      if (node.id) { parts.unshift(`#${node.id}`); break; }
      const classes = [...node.classList].filter(name => !/^(active|on|open|sel|show|visible|is-|has-)/.test(name)).slice(0, 2);
      parts.unshift(node.tagName.toLowerCase() + (classes.length ? `.${classes.join('.')}` : ''));
    }
    return parts.join(' > ');
  };
  const onTop = (el, box) => {
    const hit = document.elementFromPoint(box.x + box.w / 2, box.y + box.h / 2);
    return !hit || hit === el || el.contains(hit) || hit.contains(el);
  };
  const push = (el, text, rects, color, kind) => {
    if (within && !within.contains(el)) return;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') return;
    const opacity = opacityOf(el);
    if (opacity < 0.05 || !color || color[3] === 0) return;
    const boxes = rects.map(rect => clip(rect, el)).filter(box => box && box.w >= 2 && box.h >= 4 && onTop(el, box));
    if (!boxes.length) return;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // Cut short by its own box or the one just above it: an ellipsis is text
    // the reader does not get to read, whatever its contrast.
    let truncated = false;
    for (let node = el, depth = 0; node && depth < 3 && !truncated; node = node.parentElement, depth++) {
      const style = getComputedStyle(node);
      if (style.overflowX !== 'visible' && node.scrollWidth > node.clientWidth + 1 && style.whiteSpace.includes('nowrap')) truncated = true;
    }
    out.push({
      where: describe(el),
      text: text.trim().replace(/\s+/g, ' ').slice(0, 48),
      kind,
      rects: boxes,
      color,
      opacity,
      size,
      weight,
      family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      disabled: Boolean(el.closest(':disabled, [aria-disabled="true"], .disabled')),
      truncated,
      shadow: cs.textShadow !== 'none'
    });
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest('script, style, template, noscript, select, option, textarea')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    const cs = getComputedStyle(el);
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
    const fill = parse(cs.webkitTextFillColor) || parse(cs.color);
    push(el, node.nodeValue, rects, fill, 'text');
  }

  // Placeholders, typed values and native selects render text the walk cannot see.
  const measure = document.createElement('canvas').getContext('2d');
  const contentRect = (el, text) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    measure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const left = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const inner = r.width - left - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const width = Math.min(inner, measure.measureText(text).width);
    const size = parseFloat(cs.fontSize);
    const x = cs.textAlign === 'center' ? r.left + left + (inner - width) / 2 : cs.textAlign === 'right' || cs.textAlign === 'end' ? r.left + left + inner - width : r.left + left;
    return [{ x, y: r.top + (r.height - size * 1.2) / 2, w: width, h: size * 1.2 }];
  };
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (!el.getClientRects().length) continue;
    if (el.matches('input[type=checkbox], input[type=radio], input[type=range], input[type=color], input[type=file], input[type=hidden]')) continue;
    if (el.tagName === 'SELECT') {
      const text = el.selectedOptions[0]?.textContent || '';
      if (text.trim()) push(el, text, contentRect(el, text), parse(getComputedStyle(el).color), 'select');
    } else if (el.value) {
      if (el.tagName !== 'TEXTAREA') push(el, el.value, contentRect(el, el.value), parse(getComputedStyle(el).color), 'value');
    } else if (el.placeholder) {
      push(el, el.placeholder, contentRect(el, el.placeholder), parse(getComputedStyle(el, '::placeholder').color), 'placeholder');
    }
  }
  return out;
}

/* ── In-page: compare the two photographs ─────────────────────────────── */
async function measureRuns({ runs, withText, withoutText }) {
  const load = data => new Promise((done, fail) => {
    const image = new Image();
    image.onload = () => done(image);
    image.onerror = fail;
    image.src = `data:image/png;base64,${data}`;
  });
  const [a, b] = await Promise.all([load(withText), load(withoutText)]);
  const w = b.naturalWidth, h = b.naturalHeight;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(a, 0, 0);
  const A = ctx.getImageData(0, 0, w, h).data;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(b, 0, 0);
  const B = ctx.getImageData(0, 0, w, h).data;

  const LUT = new Float64Array(256).map((unused, i) => {
    const v = i / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = (r, g, bl) => 0.2126 * LUT[r] + 0.7152 * LUT[g] + 0.0722 * LUT[bl];
  const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  const at = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : null;

  for (const run of runs) {
    const [tr, tg, tb, ta] = run.color;
    const alpha = ta * run.opacity;
    const nominal = [];
    const ink = [];
    const bgSum = [0, 0, 0];
    let bgCount = 0;
    for (const rect of run.rects) {
      const x0 = Math.max(0, Math.floor(rect.x)), y0 = Math.max(0, Math.floor(rect.y));
      const x1 = Math.min(w, Math.ceil(rect.x + rect.w)), y1 = Math.min(h, Math.ceil(rect.y + rect.h));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          const br = B[i], bg = B[i + 1], bb = B[i + 2];
          bgSum[0] += br; bgSum[1] += bg; bgSum[2] += bb; bgCount++;
          const lb = lum(br, bg, bb);
          const fr = Math.round(tr * alpha + br * (1 - alpha));
          const fg = Math.round(tg * alpha + bg * (1 - alpha));
          const fb = Math.round(tb * alpha + bb * (1 - alpha));
          nominal.push(ratio(lum(fr, fg, fb), lb));
          const moved = Math.abs(A[i] - br) + Math.abs(A[i + 1] - bg) + Math.abs(A[i + 2] - bb);
          if (moved > 18) ink.push([moved, ratio(lum(A[i], A[i + 1], A[i + 2]), lb)]);
        }
      }
    }
    nominal.sort((p, q) => p - q);
    run.nominal = at(nominal, 0.05);
    run.nominalMedian = at(nominal, 0.5);
    // Glyph cores: the fifth of the inked pixels that moved furthest.
    ink.sort((p, q) => q[0] - p[0]);
    const core = ink.slice(0, Math.max(1, Math.floor(ink.length * 0.2))).map(entry => entry[1]).sort((p, q) => p - q);
    run.rendered = ink.length ? at(core, 0.5) : null;
    run.background = bgCount ? bgSum.map(v => Math.round(v / bgCount)) : null;
    run.required = run.large ? 3 : 4.5;
  }
  return runs;
}

/* ── In-page: cut the evidence out of a photograph ─────────────────────── */
async function cropShot({ data, rect, pad, scale }) {
  const image = await new Promise((done, fail) => {
    const node = new Image();
    node.onload = () => done(node);
    node.onerror = fail;
    node.src = `data:image/png;base64,${data}`;
  });
  const x = Math.max(0, Math.floor(rect.x - pad)), y = Math.max(0, Math.floor(rect.y - pad));
  const w = Math.min(image.naturalWidth - x, Math.ceil(rect.w + pad * 2));
  const h = Math.min(image.naturalHeight - y, Math.ceil(rect.h + pad * 2));
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, w, h, 0, 0, w * scale, h * scale);
  ctx.strokeStyle = 'rgba(255, 45, 85, 0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect((rect.x - x) * scale - 2.5, (rect.y - y) * scale - 2.5, rect.w * scale + 5, rect.h * scale + 5);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

const HIDE_TEXT = `
  *, *::before, *::after { -webkit-text-fill-color: transparent !important; caret-color: transparent !important; }
  input, textarea, select { color: transparent !important; }
  ::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }
`;


/* Two photographs of the page as it stands — as it is, and with every glyph
   made transparent — and the runs measured between them. */
async function measurePage(page, scope = null) {
  const runs = await page.evaluate(collectRuns, scope);
  const shoot = () => page.screenshot({ animations: 'disabled', caret: 'hide' });
  const withText = await shoot();
  await page.addStyleTag({ content: HIDE_TEXT }).then(handle => handle.evaluate(node => node.setAttribute('data-qa-hide', '')));
  const withoutText = await shoot();
  await page.evaluate(() => document.querySelectorAll('style[data-qa-hide]').forEach(node => node.remove()));
  const measured = await page.evaluate(measureRuns, {
    runs, withText: withText.toString('base64'), withoutText: withoutText.toString('base64')
  });
  return { runs: measured, withText };
}

// A run fails when its nominal ratio is under the WCAG floor for its size.
const failing = runs => runs.filter(run => !run.disabled && run.nominal != null && run.nominal < run.required);

/* One look — theme, scene, mood, a moment of the scene and how bright it is —
   applied the way the settings apply it, then held still for the camera. */
/* `daylight` is a moment, as an ISO string, for a look with the sky following
   the sun — held at a fixed city so a sweep is the same sweep wherever it
   runs. Without one the sky is the mood as mixed. */
function setLook(page, { theme, scene, mood, phase, intensity = 1.5, daylight = null }) {
  return page.evaluate(async ({ theme, scene, mood, phase, intensity, daylight }) => {
    const app = window.Nordlys;
    app.config.theme = theme;
    delete app.config.customTheme;
    app.config.bgMode = scene;
    app.config.bgMotion = 0;
    app.config.bgIntensity = intensity;
    app.config.bgPalette = mood;
    app.config.bgDaylight = Boolean(daylight);
    const engine = app.bgEngine;
    if (engine) {
      engine.place = { lat: 52.5, lon: 13.4 };
      engine.now = daylight ? () => new Date(daylight) : () => new Date();
    }
    app.applyThemeTokens();
    await app.updateBackgroundMode();
    if (engine && daylight) engine.followSun();
    // The quiet zones read their inks once transitions settle; let them.
    await window.NordlysUI?.settled?.();
    app.sendQuietZones?.();
    if (engine && scene !== 'solid') { engine.t = phase; engine.quietSolvedAt = -Infinity; engine.render(0); }
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { theme, scene, mood, phase, intensity, daylight });
}

/* The hardest looks per theme in a full sweep: the two home scenarios whose
   tightest run came closest to — or went furthest under — its floor. The gate
   re-measures only these, so it can run in seconds and still bite where the
   sweep found the sky was hardest. */
function worstLooks(results, perTheme = 2) {
  const byTheme = new Map();
  for (const scenario of results) {
    if (scenario.surface !== 'home' || scenario.scene === 'solid') continue;
    const margins = scenario.runs.filter(run => !run.disabled && run.nominal != null).map(run => run.nominal / run.required);
    if (!margins.length) continue;
    const list = byTheme.get(scenario.theme) || [];
    list.push({ scene: scenario.scene, mood: scenario.mood, phase: scenario.phase, ...(scenario.daylight ? { daylight: scenario.daylight } : {}), margin: Math.min(...margins) });
    byTheme.set(scenario.theme, list);
  }
  const out = {};
  for (const [theme, list] of [...byTheme.entries()].sort()) {
    const picked = [];
    for (const look of list.sort((a, b) => a.margin - b.margin)) {
      if (picked.some(p => p.scene === look.scene && p.mood === look.mood)) continue;
      picked.push({ scene: look.scene, mood: look.mood, phase: look.phase, ...(look.daylight ? { daylight: look.daylight } : {}), margin: +look.margin.toFixed(3) });
      if (picked.length === perTheme) break;
    }
    out[theme] = picked;
  }
  return out;
}

module.exports = { themeKeys, collectRuns, measureRuns, cropShot, measurePage, failing, setLook, worstLooks, HIDE_TEXT };
