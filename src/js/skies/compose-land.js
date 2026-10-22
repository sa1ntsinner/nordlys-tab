/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE LAND UNDER THE COMPOSED SKIES
   ═══════════════════════════════════════════════════════════════════

   The horizon layer of a composed sky (compose.js): the shape of the land,
   worked out once for a size, a scatter and a kind, and painted into the
   land backdrop in the light of the sky above it. Far land takes on the
   colour of the sky at the horizon and near land the dark of the ground, so a
   ridge reads as distance without being told. Only the sea's glitter and the
   lighthouse's beam move, and they are drawn each frame over the backdrop.

   Each kind is a skyline (where the sun sets behind it) and layers far to
   near; some carry more: water, lit windows, a tower, grass. "Your horizon"
   is the real one around the sky's place (sky-data.js), at two and a half
   times its true height, which is how a panorama is remembered. */
(function () {
  "use strict";

  const RAD = Math.PI / 180;
  const mix = (a, b, k) => a.map((value, index) => Math.round(value + (b[index] - value) * k));
  const css = ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const hash = (text) => {
    let value = 2166136261;
    for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
  };

  /* A ridge by midpoint displacement: n + 1 heights between 0 and 1. The
     roughness is how much each halving keeps; mountains want a little over a
     half, rolling ground a little under. */
  function ridge(random, n, roughness) {
    const points = new Array(n + 1).fill(0);
    points[0] = random();
    points[n] = random();
    for (let step = n, scale = 1; step > 1; step /= 2, scale *= roughness) {
      const half = step / 2;
      for (let i = half; i < n; i += step) points[i] = (points[i - half] + points[i + half]) / 2 + (random() * 2 - 1) * scale;
    }
    const low = Math.min(...points), high = Math.max(...points);
    return points.map((value) => (value - low) / (high - low || 1));
  }

  // The colour of the ground itself, for a dark page and a light one.
  const GROUND = {
    dark: { rock: [7, 10, 17], tree: [5, 12, 11], sand: [32, 22, 15], grass: [8, 13, 10], town: [8, 10, 16] },
    light: { rock: [100, 110, 132], tree: [86, 108, 98], sand: [184, 146, 104], grass: [112, 128, 98], town: [96, 104, 124] }
  };

  NordlysSkies.mix({
    // The shape of the land for this sky, kept until the size, scatter or kind changes.
    composeLandShape(state, layers) {
      const kind = layers.horizon;
      const profile = kind === "yours" ? this.composeRead(state, layers).horizon : null;
      const key = [this.w, this.h, this.seed, kind, profile ? profile.far.join(",") : ""].join("|");
      if (state.shape && state.shapeKey === key) return state.shape;
      const random = NordlysBackgroundEngine.stream((this.seed ^ hash(kind)) >>> 0);
      state.shapeKey = key;
      state.shape = { key, layers: [], ...this.landShape(kind, random, profile) };
      return state.shape;
    },

    landShape(kind, random, profile) {
      const { w, h } = this;
      const unit = h / 900;
      const across = (values, base, amp) => values.map((value, i) => [(i / (values.length - 1)) * w, base - value * amp]);
      const hills = (base, amp, roughness, n = 64) => across(ridge(random, n, roughness), base, amp);
      switch (kind) {
        case "mountains": return {
          skyline: h * 0.7,
          snow: true,
          layers: [
            { top: across(ridge(random, 128, 0.56), h * 0.7, h * 0.24), depth: 0.15, ground: "rock", peak: h * 0.7 - h * 0.24 * 0.6 },
            { top: across(ridge(random, 128, 0.5), h * 0.78, h * 0.16), depth: 0.55, ground: "rock" },
            { top: across(ridge(random, 64, 0.46), h * 0.88, h * 0.09), depth: 0.95, ground: "rock" }
          ]
        };
        case "sea": return { skyline: h * 0.72, water: { top: h * 0.72 } };
        case "lighthouse": {
          const rough = ridge(random, 64, 0.5);
          const top = [];
          for (let i = 0; i <= 64; i++) {
            const t = i / 64;
            const lift = Math.sin(Math.min(1, t * 1.7) * Math.PI / 2);
            top.push([w * (0.58 + 0.42 * t), h * 0.722 - lift * h * 0.12 - rough[i] * h * 0.022]);
          }
          const foot = top[Math.round(64 * (0.22 / 0.42))];
          const width = Math.max(10, h * 0.024);
          return {
            skyline: h * 0.72,
            water: { top: h * 0.72 },
            layers: [{ top, depth: 0.88, ground: "rock" }],
            tower: { x: foot[0], base: foot[1] + width * 0.3, height: h * 0.13, width }
          };
        }
        case "city": {
          const windows = [];
          const block = (base, minW, maxW, minH, maxH, depth) => {
            const top = [];
            let x = -random() * maxW * unit;
            while (x < w) {
              const width = (minW + random() * (maxW - minW)) * unit;
              let height = (minH + random() * (maxH - minH)) * h;
              if (random() < 0.12) height *= 1.55;
              const y = base - height;
              top.push([x, base], [x, y], [x + width, y], [x + width, base]);
              // A few windows of every block lit, on a grid.
              const cell = 6 * unit, pane = [3 * unit, 4 * unit];
              for (let wy = y + cell; wy < base - cell; wy += cell) {
                for (let wx = x + cell * 0.7; wx < x + width - cell * 0.7; wx += cell) {
                  if (random() < 0.16) windows.push([wx, wy, pane[0], pane[1], depth]);
                }
              }
              x += width + (random() < 0.25 ? random() * minW * unit * 0.6 : 0);
            }
            return { top, depth, ground: "town" };
          };
          return { skyline: h * 0.8, windows, layers: [block(h * 0.8, 18, 44, 0.05, 0.15, 0.35), block(h * 0.9, 30, 80, 0.07, 0.21, 0.9)] };
        }
        case "forest": {
          const trees = (base, amp, minH, maxH, minW, maxW, depth) => {
            const ground = ridge(random, 64, 0.45);
            // Trees grow in stands: taller together in places, lower and thinner between.
            const stands = ridge(random, 16, 0.62);
            const along = (values, x) => {
              const f = Math.min(values.length - 1.001, Math.max(0, (x / w) * (values.length - 1)));
              const i = Math.floor(f);
              return values[i] + (values[i + 1] - values[i]) * (f - i);
            };
            const at = (x) => base - along(ground, x) * amp;
            const top = [[0, at(0)]];
            for (let x = 0; x < w;) {
              const width = (minW + random() * (maxW - minW)) * unit;
              const stand = along(stands, x);
              // A clearing now and then where the stand thins out.
              if (random() < 0.12 * (1 - stand)) { x += width * (1 + random() * 2); continue; }
              const height = (minH + random() * (maxH - minH)) * h * (0.45 + 0.75 * stand);
              const foot = at(x + width / 2);
              top.push([x, at(x)], [x + width * 0.3, foot - height * 0.42], [x + width * 0.22, foot - height * 0.44], [x + width * 0.5, foot - height], [x + width * 0.78, foot - height * 0.44], [x + width * 0.7, foot - height * 0.42], [x + width, at(x + width)]);
              x += width * (0.55 + random() * 0.4);
            }
            return { top, depth, ground: "tree" };
          };
          return { skyline: h * 0.74, mist: true, layers: [trees(h * 0.74, h * 0.03, 0.025, 0.05, 7, 13, 0.3), trees(h * 0.87, h * 0.035, 0.05, 0.11, 12, 24, 0.92)] };
        }
        case "steppe": {
          const near = hills(h * 0.87, h * 0.03, 0.42);
          return { skyline: h * 0.8, grass: this.grass(near, random, unit), layers: [{ top: hills(h * 0.8, h * 0.025, 0.42), depth: 0.35, ground: "grass" }, { top: near, depth: 0.92, ground: "grass" }] };
        }
        case "desert": {
          const dunes = (base, amp, depth) => {
            const k = (Math.PI * 2) / (w * (0.35 + random() * 0.25));
            const phase = random() * Math.PI * 2, second = random() * Math.PI * 2;
            const top = [];
            for (let x = 0; x <= w; x += Math.max(4, w / 240)) top.push([x, base - amp * (0.5 + 0.35 * Math.sin(x * k + phase) + 0.15 * Math.sin(x * k * 2.7 + second))]);
            return { top, depth, ground: "sand" };
          };
          return { skyline: h * 0.76, layers: [dunes(h * 0.76, h * 0.05, 0.3), dunes(h * 0.83, h * 0.06, 0.6), dunes(h * 0.9, h * 0.05, 0.92)] };
        }
        case "yours": {
          if (!profile) return { ...this.landShape("steppe", random, null), pending: true };
          // A degree is as wide as the page shows it, and two and a half times as tall.
          const scale = (w / 150) * 2.5;
          const base = h * 0.78;
          const line = (angles) => profile.bearings.map((bearing, i) => [w * (0.5 + bearing / 150), base - Math.min(h * 0.36, Math.max(-h * 0.02, angles[i] * scale))]);
          return { skyline: base, layers: [{ top: line(profile.far), depth: 0.3, ground: "rock", smooth: true }, { top: line(profile.near), depth: 0.9, ground: "grass", smooth: true }] };
        }
        default: return { skyline: h * 0.94 };
      }
    },

    // Blades of grass along the top of the near ground: short, leaning, many.
    grass(top, random, unit) {
      const blades = [];
      for (let i = 0; i < top.length - 1; i++) {
        const [x0, y0] = top[i], [x1, y1] = top[i + 1];
        for (let x = x0; x < x1; x += (2 + random() * 4) * unit) {
          const y = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
          blades.push([x, y + 1, (3 + random() * 8) * unit, (random() - 0.5) * 0.8]);
        }
      }
      return blades;
    },

    // The colour of the land at a depth: the sky at the horizon far off, the ground near.
    landColour(ground, depth, colours, sun) {
      const own = GROUND[this.lightMode ? "light" : "dark"];
      let rgb = mix(colours[2], own[ground] || own.rock, 0.4 + 0.55 * depth);
      // A low sun warms what faces it, the far land most.
      if (sun.golden > 0.05) rgb = mix(rgb, sun.rising ? [255, 170, 130] : [255, 150, 96], sun.golden * 0.14 * (1 - depth));
      return rgb;
    },

    // The outline of a layer of land, down to the foot of the page.
    traceLand(ctx, layer) {
      const top = layer.top;
      ctx.beginPath();
      ctx.moveTo(top[0][0], this.h + 1);
      ctx.lineTo(top[0][0], top[0][1]);
      if (layer.smooth) {
        for (let i = 1; i < top.length - 1; i++) {
          const mx = (top[i][0] + top[i + 1][0]) / 2, my = (top[i][1] + top[i + 1][1]) / 2;
          ctx.quadraticCurveTo(top[i][0], top[i][1], mx, my);
        }
        ctx.lineTo(top[top.length - 1][0], top[top.length - 1][1]);
      } else {
        for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
      }
      ctx.lineTo(top[top.length - 1][0], this.h + 1);
      ctx.closePath();
    },

    composeLandBackdrop(state, layers, sun, colours, weather, land) {
      // The land's canvas starts at its highest point: a peak, the lighthouse's roof, a fog bank.
      const tops = [land.skyline];
      for (const layer of land.layers || []) for (const point of layer.top) tops.push(point[1]);
      if (land.tower) tops.push(land.tower.base - land.tower.height - land.tower.width);
      if (weather.fog > 0.05) tops.push(land.skyline - this.h * 0.16);
      state.landTop = Math.max(0, Math.floor(Math.min(...tops)) - 12);
      const canvas = state.land = this.composeCanvas(state.land, state.landTop);
      const ctx = canvas.getContext("2d");
      const ink = state.ink;
      const poster = layers.style === "poster";
      if (land.water) this.paintWater(ctx, land, colours, sun, ink);
      (land.layers || []).forEach((layer, index) => {
        const colour = this.landColour(layer.ground, layer.depth, colours, sun);
        this.traceLand(ctx, layer);
        if (ink) {
          ctx.fillStyle = css(ink.paper);
          ctx.fill();
          this.hatch(ctx, layer.depth, ink);
          this.traceLand(ctx, layer);
          ctx.strokeStyle = css(ink.ink, 0.9);
          ctx.lineWidth = Math.max(0.8, this.h / 900);
          ctx.stroke();
        } else if (poster) {
          ctx.fillStyle = css(colour);
          ctx.fill();
        } else {
          const ridgeTop = Math.min(...layer.top.map((point) => point[1]));
          const fill = ctx.createLinearGradient(0, ridgeTop, 0, this.h);
          fill.addColorStop(0, css(mix(colour, colours[2], 0.12)));
          fill.addColorStop(1, css(mix(colour, [0, 0, 0], this.lightMode ? 0.12 : 0.3)));
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (land.snow && index === 0 && (this.composeWinter() || weather.snow > 0)) this.paintSnow(ctx, layer, ink);
        // Mist lies in the valleys between the layers.
        if ((land.mist || weather.fog > 0.05) && index < land.layers.length - 1 && !ink) {
          const base = Math.max(...layer.top.map((point) => point[1]));
          const mist = ctx.createLinearGradient(0, base - this.h * 0.05, 0, base + this.h * 0.03);
          const tone = this.lightMode ? [248, 249, 252] : mix(colours[2], [170, 182, 200], 0.3);
          const strength = 0.22 + weather.fog * 0.5;
          mist.addColorStop(0, css(tone, 0));
          mist.addColorStop(0.7, css(tone, strength));
          mist.addColorStop(1, css(tone, strength * 0.4));
          ctx.fillStyle = mist;
          ctx.fillRect(0, base - this.h * 0.05, this.w, this.h * 0.08);
        }
      });
      if (land.windows) this.paintWindows(ctx, land.windows, sun, ink);
      if (land.grass) this.paintGrass(ctx, land, colours, sun, ink);
      if (land.tower) this.paintTower(ctx, land.tower, colours, sun, ink);
      // A fog bank over everything low, thickest at the horizon.
      if (weather.fog > 0.05) {
        const tone = ink ? ink.paper : this.lightMode ? [244, 246, 250] : mix(colours[2], [176, 186, 202], 0.35);
        const bank = ctx.createLinearGradient(0, land.skyline - this.h * 0.16, 0, this.h);
        bank.addColorStop(0, css(tone, 0));
        bank.addColorStop(0.3, css(tone, 0.72 * weather.fog));
        bank.addColorStop(1, css(tone, 0.4 * weather.fog));
        ctx.fillStyle = bank;
        ctx.fillRect(0, land.skyline - this.h * 0.16, this.w, this.h);
      }
    },

    // Winter where the sky is: snow stays on the high peaks.
    composeWinter() {
      const month = this.now().getMonth();
      return this.whereNow().lat < 0 ? month >= 5 && month <= 8 : month <= 2 || month === 11;
    },

    paintSnow(ctx, layer, ink) {
      ctx.save();
      this.traceLand(ctx, layer);
      ctx.clip();
      const top = Math.min(...layer.top.map((point) => point[1]));
      const snow = ctx.createLinearGradient(0, top, 0, layer.peak);
      const white = ink ? ink.paper : this.lightMode ? [255, 255, 255] : [206, 218, 236];
      snow.addColorStop(0, css(white, ink ? 1 : 0.88));
      snow.addColorStop(0.75, css(white, ink ? 1 : 0.6));
      snow.addColorStop(1, css(white, 0));
      ctx.fillStyle = snow;
      ctx.fillRect(0, top, this.w, layer.peak - top);
      ctx.restore();
    },

    // Engraving: diagonal lines in the land, closer and crossed for near land.
    hatch(ctx, depth, ink) {
      ctx.save();
      ctx.clip();
      const gap = Math.max(2.2, (7.5 - depth * 5) * Math.max(1, this.h / 900));
      ctx.strokeStyle = css(ink.ink, 0.45 + depth * 0.4);
      ctx.lineWidth = Math.max(0.6, this.h / 1500);
      ctx.beginPath();
      for (let x = -this.h; x < this.w; x += gap) {
        ctx.moveTo(x, this.h);
        ctx.lineTo(x + this.h, 0);
      }
      if (depth > 0.8) {
        for (let x = 0; x < this.w + this.h; x += gap * 1.6) {
          ctx.moveTo(x, this.h);
          ctx.lineTo(x - this.h, 0);
        }
      }
      ctx.stroke();
      ctx.restore();
    },

    paintWater(ctx, land, colours, sun, ink) {
      const top = land.water.top;
      const { w, h } = this;
      const random = NordlysBackgroundEngine.stream((this.seed ^ 0x51ed270b) >>> 0);
      if (ink) {
        ctx.fillStyle = css(ink.paper);
        ctx.fillRect(0, top, w, h - top);
      } else {
        const deep = this.lightMode ? [118, 138, 168] : [3, 8, 18];
        const sea = ctx.createLinearGradient(0, top, 0, h);
        sea.addColorStop(0, css(mix(colours[2], deep, 0.25)));
        sea.addColorStop(0.25, css(mix(colours[1], deep, 0.55)));
        sea.addColorStop(1, css(mix(colours[0], deep, 0.8)));
        ctx.fillStyle = sea;
        ctx.fillRect(0, top, w, h - top);
        // A thread of light where the sea meets the sky.
        ctx.fillStyle = css(mix(colours[2], [255, 255, 255], 0.2), 0.4);
        ctx.fillRect(0, top - 0.5, w, 1);
      }
      // The swell: faint strokes, closer together towards the horizon.
      ctx.strokeStyle = ink ? css(ink.ink, 0.7) : css(mix(colours[2], [255, 255, 255], this.lightMode ? 0.45 : 0.12), this.lightMode ? 0.2 : 0.09);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let row = 1; row <= 36; row++) {
        const y = top + (h - top) * (row / 36) ** 1.8;
        for (let x = random() * 40; x < w; x += 26 + random() * 90) {
          const length = 6 + random() * 40 * (row / 36 + 0.2);
          ctx.moveTo(x, y);
          ctx.lineTo(x + length, y);
        }
      }
      ctx.stroke();
    },

    // Windows lit at night: a few in every block.
    paintWindows(ctx, windows, sun, ink) {
      const lit = clamp01((sun.night + sun.blue * 0.6 - 0.2) * 1.6);
      if (lit < 0.05) return;
      ctx.fillStyle = ink ? css(ink.ink, 0.8 * lit) : this.lightMode ? css([186, 122, 18], 0.85 * lit) : css([255, 212, 140], 0.78 * lit);
      for (const [x, y, w, h, depth] of windows) {
        if (depth < 0.5) ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      }
    },

    paintGrass(ctx, land, colours, sun, ink) {
      const near = land.layers[land.layers.length - 1];
      ctx.strokeStyle = ink ? css(ink.ink, 0.85) : css(this.landColour(near.ground, near.depth, colours, sun));
      ctx.lineWidth = Math.max(0.8, this.h / 900);
      ctx.beginPath();
      for (const [x, y, length, lean] of land.grass) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + lean * length, y - length);
      }
      ctx.stroke();
    },

    // The lighthouse on its headland; the lamp is drawn each frame (composeBeam).
    paintTower(ctx, tower, colours, sun, ink) {
      const { x, base, height, width } = tower;
      const top = base - height;
      const body = ink ? ink.paper : this.landColour("rock", 0.97, colours, sun);
      const band = ink ? ink.ink : mix(body, this.lightMode ? [255, 255, 255] : [180, 70, 70], this.lightMode ? 0.35 : 0.18);
      ctx.fillStyle = css(body);
      ctx.beginPath();
      ctx.moveTo(x - width / 2, base);
      ctx.lineTo(x - width * 0.36, top);
      ctx.lineTo(x + width * 0.36, top);
      ctx.lineTo(x + width / 2, base);
      ctx.closePath();
      ctx.fill();
      if (ink) { ctx.strokeStyle = css(ink.ink); ctx.lineWidth = 1; ctx.stroke(); }
      // Two bands, as lighthouses wear them.
      ctx.save();
      ctx.clip();
      ctx.fillStyle = css(band, ink ? 0.6 : 1);
      for (const at of [0.28, 0.62]) ctx.fillRect(x - width, top + height * at, width * 2, height * 0.14);
      ctx.restore();
      // Gallery, lantern room and roof.
      ctx.fillStyle = css(body);
      ctx.fillRect(x - width * 0.52, top - width * 0.14, width * 1.04, width * 0.14);
      ctx.fillStyle = css(ink ? ink.paper : mix(body, [0, 0, 0], 0.2));
      ctx.fillRect(x - width * 0.27, top - width * 0.66, width * 0.54, width * 0.52);
      ctx.fillStyle = css(body);
      ctx.beginPath();
      ctx.moveTo(x - width * 0.36, top - width * 0.66);
      ctx.lineTo(x, top - width * 0.98);
      ctx.lineTo(x + width * 0.36, top - width * 0.66);
      ctx.closePath();
      ctx.fill();
      tower.lamp = { x, y: top - width * 0.4, r: width * 0.22 };
    },

    // What moves on the land: light on the water, the lighthouse's beam.
    composeLandMotion(state, layers, sun, colours, land, dt) {
      if (land.water) this.composeGlitter(state, land, sun, layers);
      if (land.tower?.lamp) this.composeBeam(state, land, sun, dt);
    },

    /* The path of light on the water under a low sun or the moon: short
       strokes that come and go, narrow at the horizon and wider near. */
    composeGlitter(state, land, sun, layers) {
      const Sky = window.NordlysSky;
      let body = null;
      if (sun.elevation > -1 && sun.elevation < 35) body = { azimuth: sun.azimuth, warm: true, strength: 0.5 * (1 - sun.elevation / 40) };
      else if (layers.moon && Sky?.moonPosition && sun.night > 0.3) {
        const place = this.whereNow();
        const moon = Sky.moonPosition(this.now(), place.lat, place.lon);
        if (moon.elevation > 0) body = { azimuth: moon.azimuth, warm: false, strength: 0.35 * Sky.moonPhase(this.now()).illumination };
      }
      if (!body || body.strength < 0.03) return;
      const { x } = this.composePoint(body.azimuth, 5, land.skyline);
      if (x < -this.w * 0.2 || x > this.w * 1.2) return;
      state.moved = true;
      const top = land.water.top;
      const ctx = this.ctx;
      const tone = body.warm ? (this.lightMode ? [214, 120, 60] : [255, 196, 140]) : (this.lightMode ? [90, 102, 130] : [214, 226, 244]);
      const still = this.atRest();
      ctx.save();
      ctx.strokeStyle = css(tone);
      ctx.lineWidth = Math.max(1, this.h / 700);
      for (let row = 0; row < 26; row++) {
        const y = top + (this.h - top) * ((row + 1) / 27) ** 1.6;
        const spread = 3 + (row / 26) * this.w * 0.05;
        for (let k = 0; k < 3; k++) {
          const seed = Math.sin(row * 12.9898 + k * 78.233) * 43758.5453;
          const offset = (seed - Math.floor(seed) - 0.5) * 2 * spread;
          const shimmer = still ? 0.7 : 0.45 + 0.55 * Math.sin(this.t * 9 + row * 1.3 + k * 2.1);
          ctx.globalAlpha = Math.max(0, shimmer) * body.strength * this.ink;
          ctx.beginPath();
          ctx.moveTo(x + offset - spread * 0.25, y);
          ctx.lineTo(x + offset + spread * 0.25, y);
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    /* The lighthouse is lit at dusk and through the night, and during a focus
       session at any hour: a lamp in the lantern room and a beam that turns
       slowly, bright towards whoever is looking. Held still, it holds. */
    composeBeam(state, land, sun, dt) {
      const lit = Math.max(clamp01((sun.night + sun.blue * 0.6 - 0.2) * 1.8), this.focusing ? 0.85 : 0);
      if (lit < 0.05) return;
      state.moved = true;
      const { x, y, r } = land.tower.lamp;
      const ctx = this.ctx;
      const still = this.atRest();
      state.beam = still ? 0.9 : (state.beam || 0) + dt * 0.012 * (this.motion ?? 1);
      const toward = Math.cos(state.beam), side = Math.sin(state.beam);
      const warm = this.lightMode ? [214, 150, 60] : [255, 232, 176];
      ctx.save();
      ctx.globalCompositeOperation = this.lightMode ? "multiply" : "screen";
      const reach = this.w * 0.6 * Math.pow(Math.abs(side), 0.6);
      if (reach > 4) {
        const end = x + Math.sign(side) * reach;
        const spread = this.h * (0.01 + 0.03 * Math.abs(toward));
        const beam = ctx.createLinearGradient(x, y, end, y);
        beam.addColorStop(0, css(warm, 0.42 * lit * this.ink));
        beam.addColorStop(1, css(warm, 0));
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.6);
        ctx.lineTo(end, y - spread);
        ctx.lineTo(end, y + spread);
        ctx.lineTo(x, y + r * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      const flare = r * (3 + 6 * Math.max(0, toward));
      const glow = ctx.createRadialGradient(x, y, 0, x, y, flare);
      glow.addColorStop(0, css(warm, Math.min(1, (0.75 + 0.25 * Math.max(0, toward)) * lit * this.ink)));
      glow.addColorStop(1, css(warm, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - flare, y - flare, flare * 2, flare * 2);
      ctx.restore();
    }
  });

  // For the unit tests of the shapes.
  if (typeof module !== "undefined" && module.exports) module.exports = { ridge, hash };
  void RAD;
})();
