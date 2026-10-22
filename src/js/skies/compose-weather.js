/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE WEATHER OF THE COMPOSED SKIES
   ═══════════════════════════════════════════════════════════════════

   The weather layer of a composed sky (compose.js): how much cloud, rain,
   snow and fog there is, each from 0 to 1. It comes from a preset, from the
   weather outside now (sky-data.js), or from the day in the calendar, where a
   day of meetings is an overcast one and a free day is clear.

   Clouds are painted once into a strip as wide as the page (cloudStrip) and
   slid across the sky with the wind, laid down twice so it never runs out. Rain,
   snow and lightning are drawn each frame. Held still, the clouds stay where
   they are, the rain hangs, and no lightning comes; a thumbnail of the
   thunder shows one bolt, so it can be told from the rain. */
(function () {
  "use strict";

  const mix = (a, b, k) => a.map((value, index) => Math.round(value + (b[index] - value) * k));
  const css = ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  // Each weather as amounts; anything not named is none.
  const CALM = { clouds: 0, rain: 0, snow: 0, fog: 0, storm: 0, wind: 0, windFrom: 270 };
  const PRESETS = {
    clear: { clouds: 0, wind: 0.12 },
    clouds: { clouds: 0.55, wind: 0.3 },
    rain: { clouds: 0.92, rain: 0.6, wind: 0.35 },
    snow: { clouds: 0.8, snow: 0.6, wind: 0.12 },
    fog: { clouds: 0.35, fog: 0.85, wind: 0.04 },
    storm: { clouds: 0.98, rain: 0.85, storm: 1, wind: 0.6 }
  };

  NordlysSkies.mix({
    composeWeather(layers, state) {
      if (layers.weather === "live") return { ...CALM, ...(this.composeRead(state, layers).live || PRESETS.clear) };
      if (layers.weather === "day") {
        const load = clamp01(Number(this.dayLoad) || 0);
        return { ...CALM, clouds: load * 0.9, wind: 0.1 + load * 0.25 };
      }
      return { ...CALM, ...(PRESETS[layers.weather] || PRESETS.clear) };
    },

    /* Which way the wind carries things across the page, and how fast: the
       part of it that crosses the view, never quite nothing, so a wind
       blowing straight at the person still moves the clouds a little. */
    composeWind(weather) {
      const facing = this.whereNow().lat < 0 ? 0 : 180;
      const across = Math.sin(((weather.windFrom + 180 - facing) * Math.PI) / 180);
      const side = across < 0 ? -1 : 1;
      return side * Math.max(0.3, Math.abs(across)) * (0.06 + weather.wind * 0.7);
    },

    composeClouds(state, layers, sun, colours, weather, land, dt) {
      if (weather.clouds < 0.04) return;
      state.cloud ||= this.cloudStrip(state, layers, sun, colours, weather, land);
      state.moved = true;
      if (!this.atRest()) state.drift = (((state.drift || 0) + dt * this.composeWind(weather) * (this.motion ?? 1)) % this.w + this.w) % this.w;
      const x = state.drift || 0;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = this.ink;
      ctx.drawImage(state.cloud, x, 0, this.w, land.skyline);
      ctx.drawImage(state.cloud, x - this.w, 0, this.w, land.skyline);
      ctx.restore();
    },

    // The colours of a cloud in this light: its lit top and its shaded base.
    cloudColours(sun, colours, weather) {
      const light = this.lightMode;
      const lit = light ? [255, 255, 255] : mix(colours[2], [214, 222, 236], 0.4);
      const dark = light ? mix(colours[1], [168, 174, 192], 0.5) : mix(colours[1], [70, 78, 98], 0.55);
      // A storm, and a sky closing over, darken the whole cloud, not only its base.
      const heavy = Math.min(1, weather.storm * 0.5 + Math.max(0, weather.clouds - 0.8) * 1.2);
      const top = mix(mix(dark, lit, clamp01(sun.day + sun.golden * 0.6 + sun.blue * 0.2)), light ? [120, 126, 140] : [40, 44, 54], heavy * 0.6);
      let base = mix(top, light ? [140, 148, 168] : [18, 22, 32], 0.2 + weather.clouds * 0.35 + weather.storm * 0.25);
      if (sun.golden > 0.05) base = mix(base, sun.rising ? [255, 176, 150] : [255, 150, 100], sun.golden * (light ? 0.45 : 0.55));
      return { top, base };
    },

    /* The clouds, painted once into a strip: a field of noise, the same for a
       size and a scatter, cut at the level that leaves as much sky as the
       weather does. Each point is lit by how much cloud lies above it, so a
       heap has a bright top and a shaded base, and towards the horizon the
       field is squeezed flat, as a layer of cloud is seen from below. The
       noise repeats across the strip, so the strip joins up with itself.
       Poster takes two flat inks and a hard edge; engraving, paper with an
       inked outline and lines under the shaded parts. */
    cloudStrip(state, layers, sun, colours, weather, land) {
      const style = layers.style;
      const inked = style === "poster" || style === "engraving";
      // Soft clouds lose nothing at a quarter of the page's pixels; inked edges keep half.
      const canvas = state.cloudCanvas = this.composeCanvas(state.cloudCanvas, 0, land.skyline, inked ? 0.5 : 0.25);
      const { width, height } = canvas;
      // Fewer octaves for ink: an engraver draws the shape of a cloud, not its every wisp.
      // The light is read this far above each point; the field reaches that far above the strip.
      const reach = Math.max(1, Math.round(height * 0.04));
      const { values: field, sorted, spread } = this.cloudField(state, width, height, reach, style === "engraving" ? 3 : inked ? 4 : 5);
      const { top, base } = this.cloudColours(sun, colours, weather);
      const ink = state.ink;
      // The level that leaves as much sky as the weather says: cloud is the share of the field above it.
      const level = sorted[Math.min(sorted.length - 1, Math.floor((1 - weather.clouds) * sorted.length))];
      const soft = spread * 0.22;
      const edge = level + soft / 2;
      // A heavy sky is a thick one: less of the sky behind shows through.
      const most = Math.min(0.97, (this.lightMode ? 0.92 : 0.8) + Math.max(0, weather.clouds - 0.85) * 1.2);
      const ctx = canvas.getContext("2d");
      const image = ctx.createImageData(width, height);
      const data = image.data;
      for (let y = 0; y < height; y++) {
        const haze = 1 - 0.4 * (y / height) ** 4;
        for (let x = 0; x < width; x++) {
          const i = (y + reach) * width + x;
          const f = field[i];
          if (f <= level) continue;
          const t = Math.min(1, (f - level) / soft);
          const cover = t * t * (3 - 2 * t);
          const lit = clamp01(0.55 + ((f - field[i - reach * width]) / spread) * 1.6);
          let r, g, b, alpha;
          if (ink) {
            if (f <= edge) continue;
            const rim = (x > 0 && field[i - 1] <= edge) || (x < width - 1 && field[i + 1] <= edge)
              || field[i - width] <= edge || (y < height - 1 && field[i + width] <= edge);
            [r, g, b] = rim || (lit < 0.45 && y % 3 === 0) ? ink.ink : ink.paper;
            alpha = 1;
          } else if (style === "poster") {
            if (f <= edge) continue;
            [r, g, b] = lit > 0.5 ? top : base;
            alpha = most;
          } else {
            r = base[0] + (top[0] - base[0]) * lit;
            g = base[1] + (top[1] - base[1]) * lit;
            b = base[2] + (top[2] - base[2]) * lit;
            alpha = cover * most * haze;
          }
          const o = (y * width + x) * 4;
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = alpha * 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      return canvas;
    },

    /* The noise under the clouds, kept for a size and a scatter: the weather
       and the light only recolour it. Value noise in octaves, each repeating
       across the strip; seven heaps across at the coarsest. */
    cloudField(state, width, height, above, octaves) {
      const key = `${width}|${height}|${above}|${this.seed}|${octaves}`;
      if (state.cloudField?.key === key) return state.cloudField;
      const seed = (this.seed ^ 0x2c1b3c6d) | 0;
      const hash = (ix, iy) => {
        let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      };
      const noise = (x, y, period) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const fx = x - xi, fy = y - yi;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const x0 = xi % period, x1 = (x0 + 1) % period;
        const a = hash(x0, yi), b = hash(x1, yi), c = hash(x0, yi + 1), d = hash(x1, yi + 1);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      };
      const cells = 7;
      const cell = width / cells;
      const values = new Float32Array(width * (height + above));
      for (let y = -above; y < height; y++) {
        /* A cell is six tenths as tall as it is wide overhead and two tenths
           at the horizon; v is the number of cells down to this row. */
        const share = y / height;
        const v = (height / cell) * 2.5 * Math.log(0.6 / (0.6 - 0.4 * share));
        for (let x = 0; x < width; x++) {
          const u = (x / width) * cells;
          let sum = 0, amp = 0.5, scale = 1, norm = 0;
          for (let o = 0; o < octaves; o++) {
            sum += amp * noise(u * scale, v * scale + o * 17, cells * scale);
            norm += amp;
            amp *= 0.5;
            scale *= 2;
          }
          values[(y + above) * width + x] = sum / norm;
        }
      }
      // A fifth of the values in order: the level for any share of cloud, and how widely they spread.
      const sorted = Float32Array.from({ length: Math.ceil(values.length / 5) }, (_, k) => values[k * 5]).sort();
      const spread = Math.max(0.01, sorted[Math.floor(sorted.length * 0.95)] - sorted[Math.floor(sorted.length * 0.05)]);
      state.cloudField = { key, values, sorted, spread };
      return state.cloudField;
    },

    /* What falls: rain as slanting streaks and snow as drifting flakes, each
       in one stroke or one fill for the whole sky, and now and then in a
       storm a bolt and the sky lit by it. */
    composeFalling(state, layers, weather, colours, land, dt) {
      const ctx = this.ctx;
      const still = this.atRest();
      const pixel = layers.style === "pixel";
      const wind = this.composeWind(weather);
      const pace = still ? 0 : dt * (this.motion ?? 1);
      if (weather.rain > 0.02 || weather.snow > 0.02 || weather.storm > 0) state.moved = true;
      if (weather.rain > 0.02) {
        const drops = this.composeParticles(state, "rain", Math.round(weather.rain * Math.min(420, (this.w * this.h) / 4500)));
        const slant = wind * 1.6;
        for (const drop of drops) {
          drop.y += drop.speed * pace * this.h * 0.012;
          drop.x += slant * drop.speed * pace * 4;
          if (drop.y > this.h) { drop.y -= this.h + drop.length * this.h * 0.03; drop.x = Math.random() * this.w; }
          if (drop.x < 0) drop.x += this.w; else if (drop.x > this.w) drop.x -= this.w;
        }
        ctx.save();
        ctx.strokeStyle = state.ink ? css(state.ink.ink, 0.6 * this.ink) : this.lightMode ? css([64, 78, 104], 0.4 * this.ink) : css([176, 194, 220], 0.36 * this.ink);
        /* One device pixel: the streaks are one path across the whole window,
           and a wider line is rasterised over its whole box on the CPU. */
        ctx.lineWidth = pixel ? 5 : 1 / (this.dpr || 1);
        ctx.beginPath();
        for (const drop of drops) {
          const length = drop.length * this.h * 0.03;
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + slant * length * 0.35, drop.y + length);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (weather.snow > 0.02) {
        const flakes = this.composeParticles(state, "snow", Math.round(weather.snow * Math.min(320, (this.w * this.h) / 6000)));
        for (const flake of flakes) {
          flake.y += flake.speed * pace * this.h * 0.0016;
          flake.x += (wind * 2 + Math.sin(this.t * 3 + flake.phase) * 0.35) * pace * flake.speed;
          if (flake.y > this.h) { flake.y -= this.h + 4; flake.x = Math.random() * this.w; }
          if (flake.x < 0) flake.x += this.w; else if (flake.x > this.w) flake.x -= this.w;
        }
        ctx.save();
        ctx.fillStyle = state.ink ? css(state.ink.ink, 0.8 * this.ink) : this.lightMode ? css([255, 255, 255], 0.9 * this.ink) : css([236, 242, 252], 0.78 * this.ink);
        ctx.beginPath();
        for (const flake of flakes) {
          const r = pixel ? 3 + flake.length * 2 : (0.8 + flake.length * 1.6) * Math.max(1, this.h / 900);
          ctx.moveTo(flake.x + r, flake.y);
          ctx.arc(flake.x, flake.y, r, 0, Math.PI * 2);
        }
        ctx.fill();
        if (this.lightMode && !state.ink) {
          // White on a pale sky needs an edge to be seen.
          ctx.strokeStyle = css([120, 132, 156], 0.35 * this.ink);
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        ctx.restore();
      }
      if (weather.storm > 0) this.composeLightning(state, layers, land, dt);
    },

    /* Rain and snow as numbers kept from frame to frame: where each is, how
       long and how fast, the near ones longer and faster. Seeded, so a
       thumbnail falls the same way every time. */
    composeParticles(state, kind, count) {
      const key = `${kind}|${count}|${this.w}|${this.h}`;
      state.particles ||= {};
      const kept = state.particles[kind];
      if (kept && kept.key === key) return kept.list;
      const random = NordlysBackgroundEngine.stream((this.seed ^ (kind === "rain" ? 0x7f4a7c15 : 0x1b873593)) >>> 0);
      const list = Array.from({ length: count }, () => {
        const near = random();
        return { x: random() * this.w, y: random() * this.h, length: 0.4 + near * 0.6, speed: 0.6 + near * 0.8, phase: random() * Math.PI * 2 };
      });
      state.particles[kind] = { key, list };
      return list;
    },

    /* Now and then a bolt from the cloud to the land, and the whole sky lit
       for a moment: one flash at a time, seconds apart, and none at all
       while the sky is held still. */
    composeLightning(state, layers, land, dt) {
      if (this.still) {
        if (!state.bolt) state.bolt = this.composeBolt(land, NordlysBackgroundEngine.stream(this.seed ^ 0x6a09e667));
        this.paintBolt(state, state.bolt, 0.85);
        return;
      }
      if (this.atRest()) return;
      state.flash = Math.max(0, (state.flash || 0) - dt * 0.07);
      if (state.flash === 0 && Math.random() < dt * 0.0022) {
        state.flash = 1;
        state.bolt = this.composeBolt(land, Math.random);
      }
      if (state.flash <= 0) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = this.lightMode ? "source-over" : "screen";
      ctx.fillStyle = css(this.lightMode ? [255, 255, 255] : [190, 200, 236], (this.lightMode ? 0.22 : 0.16) * state.flash * this.ink);
      ctx.fillRect(0, 0, this.w, land.skyline);
      ctx.restore();
      if (state.flash > 0.45) this.paintBolt(state, state.bolt, state.flash);
    },

    // A bolt: a jagged line from the cloud base down to the skyline, with a fork.
    composeBolt(land, random) {
      const x0 = this.w * (0.12 + random() * 0.76);
      const top = land.skyline * (0.18 + random() * 0.15);
      const points = [[x0, top]];
      let x = x0;
      for (let y = top; y < land.skyline; ) {
        y += (land.skyline - top) * (0.06 + random() * 0.08);
        x += (random() - 0.5) * this.w * 0.035;
        points.push([x, Math.min(y, land.skyline)]);
      }
      const from = points[Math.floor(points.length * 0.35)];
      const fork = [from, [from[0] + this.w * 0.03, from[1] + (land.skyline - top) * 0.15], [from[0] + this.w * 0.05, from[1] + (land.skyline - top) * 0.3]];
      return { points, fork };
    },

    paintBolt(state, bolt, strength) {
      const ctx = this.ctx;
      const colour = state.ink ? state.ink.ink : this.lightMode ? [92, 84, 160] : [236, 238, 255];
      ctx.save();
      ctx.lineCap = "round";
      // A stroke a segment: a wide line is cheap over a small box, never over the bolt's whole height.
      for (const [width, alpha] of [[Math.max(4, this.h / 160), 0.12], [Math.max(1.2, this.h / 700), 0.95]]) {
        ctx.strokeStyle = css(colour, alpha * strength * this.ink);
        ctx.lineWidth = width;
        for (const line of [bolt.points, bolt.fork]) {
          for (let i = 1; i < line.length; i++) {
            ctx.beginPath();
            ctx.moveTo(line[i - 1][0], line[i - 1][1]);
            ctx.lineTo(line[i][0], line[i][1]);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  });
})();
