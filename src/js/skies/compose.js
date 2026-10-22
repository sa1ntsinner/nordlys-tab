/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE COMPOSED SKIES
   ═══════════════════════════════════════════════════════════════════

   The skies of the Weather and Horizon groups are one painter and five
   layers, named with what each can be in sky-catalog.js:

     light    where the sun is: the real one, an hour held still, or the
              working day standing in for the day
     bodies   the stars, the moon in its real phase, the planets where they
              are tonight, meteors, and the aurora when NOAA says it is out
     weather  clear, cloud, rain, snow, fog or thunder; the weather outside
              now, or the calendar's day as cloud (compose-weather.js)
     horizon  the land at the foot of the page (compose-land.js)
     style    lit, poster, engraving or pixel

   What does not move — the colour of the sky, the sun and the moon, the land,
   the lit windows — is painted into two backdrops, the sky and the land, and
   laid down every frame; only what moves is drawn each time. The backdrops are
   painted again when something they show changes: the size, the scatter, a
   layer, the colours, or the sun by half a degree. A thumbnail keeps nothing:
   it paints once and lets go. */
(function () {
  "use strict";

  const hex = (value) => { const n = parseInt(String(value).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => a.map((value, index) => Math.round(value + (b[index] - value) * k));
  const css = ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  /* The sky from the zenith, through the middle, to the horizon, at heights of
     the sun, for a dark page and for a light one. A dark page keeps the sky as
     it looks through a window at dusk even at noon, so light text stays
     readable on it; a light page has the same sky washed pale. Between two
     heights the colours are mixed. */
  const COLOURS = {
    dark: [
      [-18, ["#04060d", "#070b18", "#0d1428"]],
      [-9, ["#060a1c", "#0d1633", "#1b2650"]],
      [-4, ["#0b1430", "#1a2a5c", "#3a3f78"]],
      [0, ["#13204a", "#3b3a73", "#a9553d"]],
      [6, ["#1a3164", "#4a5a8f", "#bd7a4a"]],
      [20, ["#1b3a6b", "#2f5a8e", "#5f86ad"]],
      [50, ["#173562", "#2a5487", "#557ca3"]]
    ],
    light: [
      [-18, ["#c4c9dc", "#d2d6e5", "#dfe2ec"]],
      [-4, ["#c3cbe8", "#d3d8f0", "#e4e2f2"]],
      [0, ["#cfd6ef", "#e8dbe6", "#f7d2b8"]],
      [6, ["#cddcf2", "#e3e6f2", "#f6dcc0"]],
      [20, ["#bcd6f2", "#d6e6f6", "#eaf2fa"]],
      [50, ["#b3d1f2", "#d2e4f6", "#e8f1fa"]]
    ]
  };
  for (const frames of Object.values(COLOURS)) frames.forEach((frame) => { frame[1] = frame[1].map(hex); });

  /* An hour held still: the sun's height, its bearing seen from the north
     (facing south; mirrored south of the equator) and whether it is rising.
     The bearings keep the sun to the sides of the page, away from the clock. */
  const HOURS = { dawn: [3, 112, true], day: [30, 220, false], dusk: [1.5, 248, false], night: [-28, 0, false] };
  // Pixel style draws the sky this many times smaller and lays it down large.
  const PIXEL = 5;

  NordlysSkies.mix({
    renderCompose(dt = 1) {
      const layers = NordlysSkies.layersOf(this.mode, this.skyLayers);
      const state = this.still ? {} : (this.composer ||= {});
      const layersKey = JSON.stringify(layers);
      if (state.layersKey !== layersKey) { state.layersKey = layersKey; state.readAt = 0; }
      const sun = this.composeSun(layers);
      const weather = this.composeWeather(layers, state);
      const land = this.composeLandShape(state, layers);
      const colours = this.composeColours(sun.elevation);
      const key = [this.w, this.h, this.dpr || 1, this.seed, this.lightMode, layersKey, Math.round(sun.elevation * 2), this.palette.join(),
        land.key, Math.round(weather.clouds * 10), Math.round(weather.fog * 10), weather.snow > 0, this.focusing].join("|");
      if (state.key !== key) {
        state.key = key;
        state.ink = this.composeInk(layers);
        this.composeSkyBackdrop(state, layers, sun, colours, weather, land);
        this.composeLandBackdrop(state, layers, sun, colours, weather, land);
        state.cloud = null;
        state.bolt = null;
        // A new picture under the clock: how much to quieten it is asked again.
        this.quietSolvedAt = -Infinity;
      }
      // Whatever moves in this frame says so; a frame where nothing does is held.
      state.moved = false;
      const screen = this.ctx;
      const pixel = layers.style === "pixel" ? this.composePixel(state) : null;
      if (pixel) this.ctx = pixel;
      try {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = this.ink;
        ctx.drawImage(state.sky, 0, 0, this.w, state.skyBottom);
        ctx.restore();
        this.composeBodies(state, layers, sun, weather, dt);
        this.composeClouds(state, layers, sun, colours, weather, land, dt);
        ctx.save();
        ctx.globalAlpha = this.ink;
        ctx.drawImage(state.land, 0, state.landTop, this.w, this.h - state.landTop);
        ctx.restore();
        this.composeLandMotion(state, layers, sun, colours, land, dt);
        this.composeFalling(state, layers, weather, colours, land, dt);
      } finally {
        this.ctx = screen;
      }
      if (pixel) {
        screen.save();
        screen.globalAlpha = 1;
        screen.imageSmoothingEnabled = false;
        screen.drawImage(pixel.canvas, 0, 0, this.w, this.h);
        screen.restore();
      }
      this.held = !state.moved;
    },

    /* Where the sun is for this sky: the real one at the person's place, an
       hour held still, or the working day standing in for the day. */
    composeSun(layers) {
      const Sky = window.NordlysSky;
      const place = this.whereNow();
      if (layers.light === "auto" && Sky?.daylight) return Sky.daylight(this.now(), place);
      let held = layers.light === "workday" ? this.workdaySun() : null;
      if (!held) {
        const [elevation, azimuth, rising] = HOURS[layers.light] || HOURS.day;
        held = { elevation, azimuth, rising };
      }
      const azimuth = place.lat < 0 ? (540 - held.azimuth) % 360 : held.azimuth;
      const weights = Sky?.lightAt ? Sky.lightAt(held.elevation, held.rising) : { day: 1, golden: 0, blue: 0, night: 0 };
      return { ...held, azimuth, ...weights };
    },

    /* The working day as a day: dawn in the hour and a half before it starts,
       the sun highest halfway through, dusk in the hour and a half after it
       ends, and night the rest of the time. */
    workdaySun() {
      const start = Number.isFinite(this.workday?.start) ? this.workday.start : 9;
      const end = Number.isFinite(this.workday?.end) && this.workday.end > start ? this.workday.end : start + 9;
      const now = this.now();
      const hour = now.getHours() + now.getMinutes() / 60;
      let elevation, part;
      if (hour < start - 1.5 || hour > end + 1.5) { elevation = -26; part = hour < start ? 0 : 1; }
      else if (hour < start) { part = 0; elevation = -12 + ((hour - (start - 1.5)) / 1.5) * 15; }
      else if (hour > end) { part = 1; elevation = 3 - ((hour - end) / 1.5) * 15; }
      else { part = (hour - start) / (end - start); elevation = 3 + 47 * Math.sin(Math.PI * part); }
      return { elevation, azimuth: 108 + 144 * part, rising: part < 0.5 };
    },

    // The three colours of the sky for a height of the sun, a breath of the mood in them.
    composeColours(elevation) {
      const frames = COLOURS[this.lightMode ? "light" : "dark"];
      let index = 0;
      while (index < frames.length - 2 && elevation > frames[index + 1][0]) index++;
      const [from, low] = frames[index];
      const [to, high] = frames[index + 1];
      const k = clamp01((elevation - from) / (to - from));
      const mood = this.paletteRgb || [];
      return low.map((rgb, at) => {
        const sky = mix(rgb, high[at], k);
        const tint = mood[[1, 2, 0][at]];
        return tint ? mix(sky, tint, 0.08) : sky;
      });
    },

    // The colour of the sky at a share of the way from the zenith to the horizon.
    composeAt(colours, share) {
      return share < 0.55 ? mix(colours[0], colours[1], share / 0.55) : mix(colours[1], colours[2], (share - 0.55) / 0.45);
    },

    /* A point of the sky on the page: the bearing across it (the page looks at
       150 degrees of horizon, facing the equator) and the height above the
       skyline, the zenith a little below the top edge. */
    composePoint(azimuth, elevation, skyline) {
      const facing = this.whereNow().lat < 0 ? 0 : 180;
      const across = ((azimuth - facing) % 360 + 540) % 360 - 180;
      return { x: this.w * (0.5 + across / 150), y: skyline - (Math.max(-12, elevation) / 62) * (skyline - this.h * 0.07) };
    },

    // The two colours of engraving: the ink and the paper it is on.
    composeInk(layers) {
      if (layers.style !== "engraving") return null;
      return this.lightMode
        ? { ink: [43, 47, 58], paper: [243, 238, 227] }
        : { ink: [200, 212, 230], paper: [12, 16, 28] };
    },

    /* A canvas for a backdrop: the band of the page from top to bottom, in
       device pixels unless a scale is given, drawn on in page coordinates. A
       backdrop covers only the band it can be seen in, so the land and the
       sky together cost little more than one page of pixels. Kept and
       cleared if it is already that size. */
    composeCanvas(existing, top = 0, bottom = this.h, scale = this.dpr || 1) {
      const w = Math.max(1, Math.round(this.w * scale));
      const h = Math.max(1, Math.round((bottom - top) * scale));
      const canvas = existing && existing.width === w && existing.height === h ? existing : document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").setTransform(scale, 0, 0, scale, 0, -top * scale);
      return canvas;
    },

    // Pixel style: the frame is drawn into a small canvas, then laid down large.
    composePixel(state) {
      const width = Math.max(1, Math.ceil(this.w / PIXEL));
      const height = Math.max(1, Math.ceil(this.h / PIXEL));
      const canvas = state.pixel && state.pixel.width === width && state.pixel.height === height ? state.pixel : document.createElement("canvas");
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      state.pixel = canvas;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.setTransform(width / this.w, 0, 0, height / this.h, 0, 0);
      return ctx;
    },

    /* A gradient from the zenith to the skyline; a poster's comes in bands of
       one colour each, the way a screen print lays its inks. */
    composeGradient(ctx, colours, top, bottom, bands = 0) {
      const gradient = ctx.createLinearGradient(0, top, 0, bottom);
      if (!bands) {
        gradient.addColorStop(0, css(colours[0]));
        gradient.addColorStop(0.55, css(colours[1]));
        gradient.addColorStop(1, css(colours[2]));
        return gradient;
      }
      for (let band = 0; band < bands; band++) {
        const colour = css(this.composeAt(colours, (band + 0.5) / bands));
        gradient.addColorStop(band / bands, colour);
        gradient.addColorStop((band + 1) / bands, colour);
      }
      return gradient;
    },

    composeSkyBackdrop(state, layers, sun, colours, weather, land) {
      // Below the foot of the farthest land, or the sea, no sky shows.
      const ground = land.water ? land.water.top : land.layers?.length ? Math.max(...land.layers[0].top.map((point) => point[1])) : this.h;
      state.skyBottom = Math.min(this.h, Math.ceil(ground) + 2);
      // Gradients need no more pixels than the page has; engraved lines do.
      const canvas = state.sky = this.composeCanvas(state.sky, 0, state.skyBottom, state.ink ? this.dpr || 1 : 1);
      const ctx = canvas.getContext("2d");
      const { w, h } = this;
      const skyline = land.skyline;
      const style = layers.style;
      if (state.ink) this.engraveSky(ctx, colours, skyline, state.ink);
      else {
        ctx.fillStyle = this.composeGradient(ctx, colours, 0, skyline, style === "poster" ? 7 : 0);
        ctx.fillRect(0, 0, w, h);
      }
      const at = this.composePoint(sun.azimuth, sun.elevation, skyline);
      // The glow of a low sun, on its own side of the sky.
      if (sun.golden > 0.02 && !state.ink) {
        const warm = sun.rising ? [255, 172, 128] : [255, 148, 88];
        const strength = sun.golden * (this.lightMode ? 0.42 : 0.6) * (1 - weather.clouds * 0.6);
        // A poster's glow is three rings of flat ink, and rings that size would fill the page.
        const reach = Math.max(w, h) * (style === "poster" ? 0.3 : 0.6);
        const glow = ctx.createRadialGradient(at.x, skyline, 0, at.x, skyline, reach);
        if (style === "poster") {
          glow.addColorStop(0, css(warm, strength));
          glow.addColorStop(0.3, css(warm, strength));
          glow.addColorStop(0.3, css(warm, strength * 0.45));
          glow.addColorStop(0.62, css(warm, strength * 0.45));
          glow.addColorStop(0.62, css(warm, 0));
        } else {
          glow.addColorStop(0, css(warm, strength));
          glow.addColorStop(0.35, css(mix(warm, colours[1], 0.5), strength * 0.35));
          glow.addColorStop(1, css(colours[1], 0));
        }
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, skyline);
      }
      if (sun.elevation > -1.5 && weather.clouds < 0.92) this.composeSunDisc(ctx, at, sun, style, state.ink, 1 - weather.clouds * 0.7);
      if (layers.moon) this.composeMoon(ctx, skyline, sun, weather, style, state.ink);
      if (layers.planets) this.composePlanets(ctx, skyline, sun, weather, style, state.ink);
      // An overcast sky is a lid of grey drawn over the colour.
      if (weather.clouds > 0.65) {
        const grey = this.lightMode ? [204, 208, 218] : [36, 42, 54];
        ctx.fillStyle = css(state.ink ? state.ink.paper : mix(colours[1], grey, 0.65), Math.min(0.62, (weather.clouds - 0.65) * 1.8) * (state.ink ? 0.5 : 1));
        ctx.fillRect(0, 0, w, h);
      }
    },

    /* Engraving: paper, and lines across the sky set closer where the lit sky
       would be darker on a light page, or brighter on a dark one, so the
       picture is the same picture drawn in ink. */
    engraveSky(ctx, colours, skyline, { ink, paper }) {
      const { w, h } = this;
      const light = this.lightMode;
      ctx.fillStyle = css(paper);
      ctx.fillRect(0, 0, w, h);
      const gap = Math.max(2.5, h / 240);
      ctx.strokeStyle = css(ink);
      ctx.lineWidth = Math.max(0.6, gap * 0.3);
      for (let y = gap / 2; y < skyline; y += gap) {
        const [r, g, b] = this.composeAt(colours, y / skyline);
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const weight = light ? 1 - lum : lum * 1.4;
        if (weight < 0.05) continue;
        ctx.globalAlpha = Math.min(0.9, 0.12 + weight);
        ctx.setLineDash([Math.max(1, 16 * weight), Math.max(1.5, 9 * (1 - Math.min(1, weight)))]);
        ctx.lineDashOffset = (y * 7.3) % 23;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },

    composeSunDisc(ctx, at, sun, style, ink, through) {
      const r = Math.min(this.w, this.h) * 0.024;
      const low = clamp01(1 - sun.elevation / 12);
      const light = this.lightMode;
      if (ink) {
        ctx.save();
        ctx.strokeStyle = css(ink.ink, 0.9 * through);
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath();
        ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let ray = 0; ray < 16; ray++) {
          const angle = (ray / 16) * Math.PI * 2;
          const from = r * 1.35, to = r * (ray % 2 ? 1.75 : 2.15);
          ctx.beginPath();
          ctx.moveTo(at.x + Math.cos(angle) * from, at.y + Math.sin(angle) * from);
          ctx.lineTo(at.x + Math.cos(angle) * to, at.y + Math.sin(angle) * to);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      const core = light ? mix([255, 206, 140], [236, 128, 72], low) : mix([255, 247, 228], [255, 170, 104], low);
      if (style !== "poster") {
        const halo = ctx.createRadialGradient(at.x, at.y, r * 0.5, at.x, at.y, r * 7);
        halo.addColorStop(0, css(core, (light ? 0.5 : 0.34) * through));
        halo.addColorStop(1, css(core, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(at.x - r * 7, at.y - r * 7, r * 14, r * 14);
      } else {
        ctx.fillStyle = css(core, 0.28 * through);
        ctx.beginPath();
        ctx.arc(at.x, at.y, r * 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = css(core, (light ? 0.95 : 0.92) * through);
      ctx.beginPath();
      ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
      ctx.fill();
    },

    // The moon where it is, in tonight's phase; pale by day, as it is.
    composeMoon(ctx, skyline, sun, weather, style, ink) {
      const Sky = window.NordlysSky;
      if (!Sky?.moonPosition || !Sky.moonPhase) return;
      const place = this.whereNow();
      const where = Sky.moonPosition(this.now(), place.lat, place.lon);
      if (where.elevation < -1) return;
      const { phase } = Sky.moonPhase(this.now());
      const at = this.composePoint(where.azimuth, where.elevation, skyline);
      const r = Math.min(this.w, this.h) * 0.017;
      const shine = clamp01(0.3 + sun.night * 0.7 + sun.blue * 0.4) * (1 - weather.clouds * 0.75);
      if (shine < 0.05) return;
      const colour = ink ? ink.ink : this.lightMode ? [92, 104, 132] : [232, 238, 248];
      const screen = this.ctx;
      this.ctx = ctx;
      try {
        if (style === "lit") this.glow(at.x, at.y, r * 6, r * 6, 0, colour, 0.16 * shine * (sun.night + 0.2), NORDLYS_SOFT, ctx);
        ctx.fillStyle = css(colour, 0.08 * shine);
        ctx.beginPath();
        ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(colour, (this.lightMode ? 0.78 : 0.92) * shine);
        this.traceMoon(at.x, at.y, r, { phase, south: place.lat < 0 });
        ctx.fill();
        if (ink) {
          ctx.strokeStyle = css(ink.ink, 0.8 * shine);
          ctx.lineWidth = Math.max(0.8, r * 0.07);
          ctx.beginPath();
          ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      } finally {
        this.ctx = screen;
      }
    },

    // Venus, Mars, Jupiter and Saturn where they stand tonight, once it is dark enough.
    composePlanets(ctx, skyline, sun, weather, style, ink) {
      const dark = clamp01(sun.night + sun.blue * 0.5) * (1 - weather.clouds * 0.9);
      if (dark < 0.08 || !globalThis.NordlysPlanets) return;
      for (const planet of globalThis.NordlysPlanets.planets(this.now(), this.whereNow())) {
        if (planet.elevation < 1) continue;
        const at = this.composePoint(planet.azimuth, planet.elevation, skyline);
        const r = Math.max(1, 1.1 + Math.max(0, -planet.mag) * 0.45) * Math.max(1, this.h / 900);
        const colour = ink ? ink.ink : this.lightMode ? [70, 80, 110] : planet.rgb;
        if (style === "lit") this.glow(at.x, at.y, r * 5, r * 5, 0, colour, 0.32 * dark, NORDLYS_SOFT, ctx);
        ctx.fillStyle = css(colour, 0.95 * dark);
        ctx.beginPath();
        ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // What moves in the sky itself: the stars' twinkle, the aurora, meteors.
    composeBodies(state, layers, sun, weather, dt) {
      const dark = clamp01(sun.night + sun.blue * 0.55) * (1 - weather.clouds * 0.92);
      if (layers.stars && dark > 0.06) {
        this.renderStars({ night: dark });
        state.moved = true;
      }
      const Data = globalThis.NordlysSkyData;
      const kp = layers.aurora === "live" || layers.aurora === "north" ? this.composeRead(state, layers).kp : null;
      /* On; as bright as the K index makes it under the oval, a quiet night
         still showing a little; or only as much as reaches the sky's place. */
      const aurora = layers.aurora === "on" ? 1
        : layers.aurora === "north" ? 0.25 + 0.75 * Math.min(1, (kp ?? 3) / 7)
        : layers.aurora === "live" && Data ? Data.auroraAt(this.whereNow().lat, kp) : 0;
      const curtain = aurora * clamp01(sun.night + sun.blue * 0.4) * (1 - weather.clouds * 0.85);
      if (curtain > 0.03) {
        const [green, teal, violet] = this.lightMode ? ["#1f8a5a", "#1b7f8a", "#6a4cc0"] : ["#56f0a4", "#38d8c6", "#b07cff"];
        this.drawRibbon(0.22, green, 0.11 * curtain, 1.1, 0.4, 1.6);
        this.drawRibbon(0.22, green, 0.19 * curtain, 1.1, 0.4, 1);
        this.drawRibbon(0.32, teal, 0.12 * curtain, 0.8, 0.55, 1.3);
        this.drawRibbon(0.13, violet, 0.08 * curtain, 1.4, 0.7, 1.1);
        state.moved = true;
      }
      if (layers.meteors && dark > 0.3) {
        this.renderMeteors(0.0035 * dark, dt);
        state.moved = true;
      }
    },

    /* What the sky reads from the world, at most once a minute: the weather
       now, the K index, the horizon. A thumbnail reads only what is kept and
       never asks; the sky on screen asks when what is kept is old. */
    composeRead(state, layers) {
      const now = Date.now();
      if (state.read && now - state.readAt < 60000) return state.read;
      state.readAt = now;
      const Data = globalThis.NordlysSkyData;
      const place = this.whereNow();
      const fresh = () => this.composeFresh();
      const options = { ask: !this.still };
      state.read = {
        live: layers.weather === "live" && Data ? Data.weather(place, fresh, options) : null,
        kp: (layers.aurora === "live" || layers.aurora === "north") && Data ? Data.kp(fresh, options) : null,
        horizon: layers.horizon === "yours" && Data ? Data.horizon(place, fresh, options) : null
      };
      return state.read;
    },

    // A new answer from the world: read it, and paint what it changes.
    composeFresh() {
      if (this.composer) {
        this.composer.readAt = 0;
        this.composer.key = null;
        this.composer.shapeKey = null;
      }
      this.repaint();
    }
  });
})();
