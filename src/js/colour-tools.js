/* Colour arithmetic shared by the icons, the moods and anything else that has
   to move a colour without making it a different colour. OKLCH throughout: a
   step in its lightness looks like the same step whatever the hue, which is not
   true of HSL, and a hue turned in it stays as vivid as it was. */
(function () {
  const lin = value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const gamma = value => { const c = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };

  function hexToRgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbToHex = rgb => `#${rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

  // WCAG relative luminance, and the ratio between two of them.
  const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  function toOklab([r, g, b]) {
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ];
  }
  function toOklch(rgb) {
    const [L, A, B] = toOklab(rgb);
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function fromOklch([L, C, H]) {
    const A = C * Math.cos(H), B = C * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return { rgb: rgb.map(gamma), inGamut: rgb.every(v => v >= -0.001 && v <= 1.001) };
  }
  // The same lightness and hue with as much of the chroma as the screen can show.
  function displayable(L, C, H) {
    let chroma = C, out;
    do { out = fromOklch([L, chroma, H]); chroma *= 0.96; } while (!out.inGamut && chroma > 0.002);
    return out.rgb;
  }

  /* Three colours that belong together, from one. Neighbours turn the hue a
     little each way; a three-way split turns it a third of the circle. The
     lightness moves a touch as well, so the three never sit flat. */
  function harmony(hex, kind) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const [L, C, H] = toOklch(rgb);
    const chroma = Math.max(C, 0.09);
    const turn = kind === 'split' ? (2 * Math.PI) / 3 : Math.PI / 7;
    return [[L, 0], [Math.min(0.92, L + 0.06), turn], [Math.max(0.45, L - 0.06), -turn]]
      .map(([lightness, delta]) => rgbToHex(displayable(lightness, chroma, H + delta)));
  }

  /* The three colours a picture is mostly made of: k-means in OKLab, seeded
     from the picture's own lightness so the same picture always gives the same
     three. Returned brightest first and lifted into the range a sky can glow
     in, because a near-black mood would paint nothing on a dark theme. */
  function paletteFromPixels(pixels, k = 3) {
    const points = pixels.filter(p => p && p.length >= 3).map(p => toOklab(p));
    if (points.length < k) return null;
    const sorted = [...points].sort((a, b) => a[0] - b[0]);
    let centres = Array.from({ length: k }, (unused, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)].slice());
    for (let round = 0; round < 14; round++) {
      const sums = centres.map(() => [0, 0, 0, 0]);
      for (const point of points) {
        let best = 0, bestDistance = Infinity;
        centres.forEach((centre, index) => {
          const d = (point[0] - centre[0]) ** 2 + (point[1] - centre[1]) ** 2 + (point[2] - centre[2]) ** 2;
          if (d < bestDistance) { bestDistance = d; best = index; }
        });
        sums[best][0] += point[0]; sums[best][1] += point[1]; sums[best][2] += point[2]; sums[best][3]++;
      }
      centres = centres.map((centre, index) => (sums[index][3] ? sums[index].slice(0, 3).map(v => v / sums[index][3]) : centre));
    }
    // Sorted by the colours as they come out, after rounding, so the order is
    // true of what is returned rather than of what was aimed at.
    return centres
      .map(([L, A, B]) => rgbToHex(displayable(Math.min(0.9, Math.max(0.62, L)), Math.max(0.06, Math.hypot(A, B)), Math.atan2(B, A))))
      .map(hex => [hex, toOklab(hexToRgb(hex))[0]])
      .sort((a, b) => b[1] - a[1])
      .map(([hex]) => hex);
  }

  /* ── The page behind the sky ──────────────────────────────────────
     What colour the page itself is at one point, under everything painted on
     it: the body's background colour with its gradients laid over it, read
     from the computed style. The quiet zones used to assume the flat --void,
     and most themes lay a glow or a lighter base over it near the top — so the
     solver measured text against a darker page than the one on screen.

     Only the forms the themes use are understood — an ellipse "W% H% at X% Y%"
     and a line at an angle or "to" a side — and a layer in any other form is
     left out rather than guessed at. Stops interpolate premultiplied, the way
     CSS paints them. */
  const colourOf = text => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(String(text || ''));
    if (!m) return null;
    const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
  };
  function splitTop(text) {
    const parts = [];
    let depth = 0, current = '';
    for (const char of text) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; } else current += char;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }
  function gradientAt(layer, x, y, width, height) {
    const match = /^(radial|linear)-gradient\(([\s\S]*)\)$/.exec(layer.trim());
    if (!match) return null;
    const parts = splitTop(match[2]);
    let t;
    if (match[1] === 'radial') {
      const shape = /^([\d.]+)%\s+([\d.]+)%\s+at\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/.exec(parts[0] || '');
      if (!shape) return null;
      parts.shift();
      const rx = width * Number(shape[1]) / 100, ry = height * Number(shape[2]) / 100;
      t = Math.hypot((x - width * Number(shape[3]) / 100) / rx, (y - height * Number(shape[4]) / 100) / ry);
    } else {
      let angle = 180;
      const degrees = /^(-?[\d.]+)deg$/.exec(parts[0] || '');
      const side = /^to\s+(top|bottom|left|right)$/.exec(parts[0] || '');
      if (degrees) { angle = Number(degrees[1]); parts.shift(); }
      else if (side) { angle = { top: 0, right: 90, bottom: 180, left: 270 }[side[1]]; parts.shift(); }
      const a = angle * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
      const length = Math.abs(width * dx) + Math.abs(height * dy) || 1;
      t = ((x - width / 2) * dx + (y - height / 2) * dy) / length + 0.5;
    }
    const stops = parts.map(part => {
      const colour = colourOf(part);
      const at = /(-?[\d.]+)%\s*$/.exec(part.replace(/rgba?\([^)]*\)/, ''));
      return colour ? { colour, at: at ? Number(at[1]) / 100 : null } : null;
    });
    if (!stops.length || stops.some(stop => !stop)) return null;
    if (stops[0].at == null) stops[0].at = 0;
    if (stops[stops.length - 1].at == null) stops[stops.length - 1].at = 1;
    for (let i = 1; i < stops.length - 1; i++) {
      if (stops[i].at != null) continue;
      let next = i + 1;
      while (stops[next].at == null) next++;
      stops[i].at = stops[i - 1].at + (stops[next].at - stops[i - 1].at) / (next - i + 1);
    }
    if (t <= stops[0].at) return stops[0].colour;
    const last = stops[stops.length - 1];
    if (t >= last.at) return last.colour;
    const index = stops.findIndex(stop => stop.at >= t);
    const [from, to] = [stops[index - 1], stops[index]];
    const k = to.at === from.at ? 1 : (t - from.at) / (to.at - from.at);
    const alpha = from.colour[3] + (to.colour[3] - from.colour[3]) * k;
    if (alpha <= 0) return [0, 0, 0, 0];
    const mix = channel => (from.colour[channel] * from.colour[3] + (to.colour[channel] * to.colour[3] - from.colour[channel] * from.colour[3]) * k) / alpha;
    return [mix(0), mix(1), mix(2), alpha];
  }
  function backgroundAt(image, color, x, y, width, height) {
    let ground = (colourOf(color) || [0, 0, 0, 1]).slice(0, 3);
    const layers = image && image !== 'none' ? splitTop(image) : [];
    // The first layer listed is painted on top, so they are laid bottom first.
    for (let i = layers.length - 1; i >= 0; i--) {
      const colour = gradientAt(layers[i], x, y, width, height);
      if (!colour) continue;
      ground = ground.map((value, channel) => colour[channel] * colour[3] + value * (1 - colour[3]));
    }
    return ground.map(Math.round);
  }

  window.NordlysColour = { hexToRgb, rgbToHex, luminance, contrast, toOklch, fromOklch, displayable, harmony, paletteFromPixels, backgroundAt };
})();
