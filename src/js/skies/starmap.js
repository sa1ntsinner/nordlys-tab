/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE STAR MAP SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

NordlysSkies.paint("starmap", "renderStarmap", {
  /* A star as the eye sees it: on a dark sky white, leaning blue or orange
     by its colour and never as strongly as a photograph shows it; on a light
     one the dark of printed ink, leaning the same way. */
  starColour(warmth, light) {
    const base = light ? [30, 40, 70] : [244, 247, 255];
    const tint = warmth < 0 ? (light ? [26, 64, 160] : [190, 210, 255]) : (light ? [150, 66, 28] : [255, 205, 150]);
    const k = Math.min(1, Math.abs(warmth)) * 0.9;
    return base.map((value, i) => Math.round(value + (tint[i] - value) * k));
  },

  /* ── Star map: the sky as it is ─────────────────────────────────────
     The bright stars over the person's place at this moment and the stick
     figures of the constellations among them, the way a chart draws them: a
     dot for each star, larger by its magnitude and coloured by its colour
     index — Betelgeuse orange, Rigel blue-white — and a hairline in the
     mood's colour from star to star of a figure, stopping short of each.
     Below the horizon nothing is drawn, and near it the stars dim, through
     the extra air. The sky turns at its real rate, a quarter of a degree a
     minute: sped up, it would be the sky of some other hour within a minute,
     and the point of it is that it is this one. So nothing moves to the eye,
     and a tab left open shows Orion further round an hour later. The
     brightest stars twinkle, more the lower they stand, which is all that
     moves — and why the scene asks for a frame a tenth of a second at most.

     Everything but the twinkle is drawn into a layer and laid down in one
     drawImage; the layer is drawn again when the sky has turned a third of a
     pixel, every ten seconds, and where the words sit it has no lines: a
     line through the date reads as a strike-through. A still and the
     quiet-zone sample draw the chart directly. */
  initChart() {
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x68e31da4) >>> 0);
    // Seed zero faces the equator; a shuffle turns to face anywhere.
    this.chart = { turn: this.seed ? random() * 360 : 0 };
  },

  renderStarmap() {
    const ctx = this.ctx;
    const light = this.lightMode;
    const view = this.skyView();
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    this.paintHorizon(view, light);
    // With the light following the sun the chart pales by day, and stays: a chart still says where the stars are.
    const seen = this.sky ? 0.28 + 0.72 * Math.max(this.sky.night, this.sky.blue * 0.8) : 1;
    let bright;
    if (ctx === this.screen && this.canvas && typeof document.createElement === "function") {
      const zones = this.quietZones.map((zone) => [zone.x, zone.y, zone.w, zone.h].map(Math.round).join()).join(";");
      const key = `${this.seed}:${this.w}x${this.h}:${this.dpr}:${this.palette.join()}:${light}:${zones}:${view.place.lat},${view.place.lon}:${Math.floor(this.now().getTime() / 10000)}`;
      if (this.chartLayer?.key !== key) {
        const layer = this.chartLayer?.canvas || document.createElement("canvas");
        if (layer.width !== this.canvas.width) layer.width = this.canvas.width;
        if (layer.height !== this.canvas.height) layer.height = this.canvas.height;
        const paint = layer.getContext("2d");
        paint.setTransform(1, 0, 0, 1, 0, 0);
        paint.clearRect(0, 0, layer.width, layer.height);
        paint.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
        this.chartLayer = { key, canvas: layer, bright: this.drawChart(paint, view, light, true) };
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = this.ink * seen;
      ctx.drawImage(this.chartLayer.canvas, 0, 0);
      ctx.restore();
      bright = this.chartLayer.bright;
    } else {
      ctx.globalAlpha = this.ink * seen;
      bright = this.drawChart(ctx, view, light, false);
    }
    // The brightest stars, painted each frame: scintillation, two slow beats, deeper in the thicker air low down.
    for (const star of bright) {
      const depth = 0.08 + 0.34 * (1 - star.up) ** 3;
      const beat = 0.6 * Math.sin(this.t * star.rate + star.phase) + 0.4 * Math.sin(this.t * star.rate * 1.9 + star.phase * 2.3);
      const alpha = Math.min(1, star.alpha * (1 + depth * beat)) * seen;
      // A soft bloom, the more the brighter the star; ink on a light page has none.
      if (!light) this.glow(star.x, star.y, star.r * 4.6, star.r * 4.6, 0, star.rgb, alpha * Math.min(0.32, 0.1 + 0.07 * (1.6 - star.m)));
      ctx.fillStyle = `rgba(${star.rgb[0]}, ${star.rgb[1]}, ${star.rgb[2]}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  /* The air just over the horizon, lit faintly from below by places out of
     sight, and nothing under it: no stars below the line is what makes it
     the ground. */
  paintHorizon(view, light) {
    const ctx = this.ctx;
    const air = ctx.createLinearGradient(0, view.horizon, 0, view.horizon - this.h * 0.34);
    air.addColorStop(0, this.rgba(2, light ? 0.08 : 0.12));
    air.addColorStop(0.35, this.rgba(1, light ? 0.03 : 0.045));
    air.addColorStop(1, this.rgba(1, 0));
    ctx.fillStyle = air;
    ctx.fillRect(0, view.horizon - this.h * 0.34, this.w, this.h * 0.34);
    const line = ctx.createLinearGradient(0, 0, this.w, 0);
    line.addColorStop(0, this.rgba(0, 0));
    line.addColorStop(0.5, this.rgba(0, light ? 0.16 : 0.22));
    line.addColorStop(1, this.rgba(0, 0));
    ctx.fillStyle = line;
    ctx.fillRect(0, view.horizon, this.w, 1);
  },

  /* The chart onto a context: the figures, the words cleared of them, then
     the stars, all but the brightest, which are handed back to be painted
     each frame with their twinkle. */
  drawChart(ctx, view, light, onLayer) {
    const stars = NordlysBackgroundEngine.catalogue();
    if (!stars) return [];
    const margin = 8;
    const page = new Float32Array(stars.count * 3);
    for (let i = 0; i < stars.count; i++) {
      const [e, n, u] = this.skyPoint(stars.ascension[i], stars.sinDec[i], stars.cosDec[i], view);
      const at = this.toPage(e, n, u, view);
      // x, y, and how high it stands: below zero is under the horizon.
      page[i * 3] = at ? at[0] : NaN;
      page[i * 3 + 1] = at ? at[1] : NaN;
      page[i * 3 + 2] = u;
    }
    const unit = Math.max(0.8, Math.min(this.w, this.h) / 900);
    const size = (m) => (0.55 + 0.55 * Math.max(0, 4.6 - m)) * unit;
    // Dimmed close to the horizon, as the extra air does; gone under it.
    const air = (u) => Math.max(0, Math.min(1, u / 0.28)) ** 0.7;
    const scale = ctx.getTransform?.()?.a || 1;
    // Off the screen the band goes behind what is already drawn, so the words' clearing leaves it whole.
    if (!onLayer) this.drawMilkyWay(ctx, view, light);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, view.horizon);
    ctx.clip();
    /* The figures: one hairline path, a device pixel wide, which the GPU
       draws as it is however far it runs. Each line stops short of its stars. */
    const figures = new Path2D();
    for (const run of stars.figures) {
      for (let k = 1; k < run.length; k++) {
        const a = run[k - 1] * 3;
        const b = run[k] * 3;
        if (!(page[a + 2] > -0.05 && page[b + 2] > -0.05) || Number.isNaN(page[a]) || Number.isNaN(page[b])) continue;
        const dx = page[b] - page[a];
        const dy = page[b + 1] - page[a + 1];
        const length = Math.hypot(dx, dy);
        const gapA = size(stars.magnitude[run[k - 1]]) + 3.5;
        const gapB = size(stars.magnitude[run[k]]) + 3.5;
        if (length <= gapA + gapB + 2) continue;
        figures.moveTo(page[a] + (dx * gapA) / length, page[a + 1] + (dy * gapA) / length);
        figures.lineTo(page[b] - (dx * gapB) / length, page[b + 1] - (dy * gapB) / length);
      }
    }
    ctx.strokeStyle = this.rgba(0, light ? 0.32 : 0.28);
    ctx.lineWidth = 1 / scale;
    ctx.stroke(figures);
    ctx.restore();

    const bright = [];
    for (let i = 0; i < stars.count; i++) {
      const x = page[i * 3];
      const y = page[i * 3 + 1];
      const u = page[i * 3 + 2];
      if (!(u > 0) || Number.isNaN(x) || x < -margin || x > this.w + margin || y < -margin || y > view.horizon) continue;
      const m = stars.magnitude[i];
      const r = size(m);
      const alpha = Math.min(1, 0.32 + 0.2 * (4.6 - m)) * air(u);
      if (alpha < 0.02) continue;
      const rgb = this.starColour(stars.warmth[i], light);
      if (m < 1.6) {
        // A star under the words would read as a full stop.
        if (!this.nearWords(x, y, r + 6)) bright.push({ x, y, r, m, rgb, alpha, up: u, rate: 8 + ((i * 7.31) % 6), phase: i * 2.399 });
        continue;
      }
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Outside the clip: the rect that casts the clearing shadow lies off the page, and a clip culls it.
    this.clearWords(ctx);
    if (onLayer) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      this.drawMilkyWay(ctx, view, light);
      ctx.restore();
    }
    return bright;
  },

  /* The Milky Way where it really runs: soft light along the galactic
     equator, turned into the sky from galactic longitude (the north galactic
     pole at 192.86°, 27.13° for J2000), brightest towards the centre in
     Sagittarius and through Cygnus, faint towards Auriga on the far side, and
     a little wider where it is brightest. A haze, a few hundredths of an
     alpha, in the mood's middle colour. */
  drawMilkyWay(ctx, view, light) {
    const RAD = Math.PI / 180;
    const poleRa = 192.85948 * RAD;
    const poleDec = 27.12825 * RAD;
    const node = 122.93192 * RAD;
    const point = (l, b) => {
      const dec = Math.asin(Math.sin(poleDec) * Math.sin(b) + Math.cos(poleDec) * Math.cos(b) * Math.cos(node - l));
      const ra = poleRa + Math.atan2(Math.cos(b) * Math.sin(node - l), Math.cos(poleDec) * Math.sin(b) - Math.sin(poleDec) * Math.cos(b) * Math.cos(node - l));
      const [e, n, u] = this.skyPoint(ra, Math.sin(dec), Math.cos(dec), view);
      return u > -0.08 ? this.toPage(e, n, u, view) : null;
    };
    const rgb = this.pale(1, light ? 0 : 0.35);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, view.horizon);
    ctx.clip();
    for (let degrees = 0; degrees < 360; degrees += 3) {
      const l = degrees * RAD;
      const at = point(l, 0);
      if (!at || at[0] < -200 || at[0] > this.w + 200 || at[1] < -200) continue;
      const centre = Math.pow(0.5 + 0.5 * Math.cos(l), 1.6);
      const cygnus = Math.exp(-(((degrees - 75) / 22) ** 2));
      const strength = 0.25 + 0.6 * centre + 0.3 * cygnus;
      const edge = point(l, (7 + 6 * centre) * RAD);
      const reach = edge ? Math.max(24, Math.hypot(edge[0] - at[0], edge[1] - at[1])) : 60;
      this.glow(at[0], at[1], reach, reach, 0, rgb, strength * (light ? 0.035 : 0.045), NORDLYS_SOFT, ctx);
    }
    ctx.restore();
  }
}, {
  /* The bright stars of sky-stars.js, unpacked once for every engine: right
     ascension, the sine and cosine of the declination, the magnitude, and how
     warm the colour is, from -1 for the hottest blue-white to 1 for the
     coolest orange (the colour index runs from about -0.3 to 2, and the
     sun is 0.65). */
  catalogue() {
    const source = typeof window !== "undefined" ? window.NORDLYS_STARS : null;
    const cached = NordlysBackgroundEngine.starCache;
    if (cached && cached.source === source) return cached;
    if (!Array.isArray(source?.stars) || !source.stars.length) return null;
    const count = Math.floor(source.stars.length / 4);
    const stars = {
      source, count, ascension: new Float32Array(count), sinDec: new Float32Array(count), cosDec: new Float32Array(count),
      magnitude: new Float32Array(count), warmth: new Float32Array(count),
      figures: Object.values(source.figures || {}).flat().filter(Array.isArray)
    };
    for (let i = 0; i < count; i++) {
      const [ra, dec, magnitude, colour] = source.stars.slice(i * 4, i * 4 + 4).map((value) => value / 100);
      stars.ascension[i] = ra * Math.PI / 180;
      stars.sinDec[i] = Math.sin(dec * Math.PI / 180);
      stars.cosDec[i] = Math.cos(dec * Math.PI / 180);
      stars.magnitude[i] = magnitude;
      stars.warmth[i] = Math.max(-1, Math.min(1, colour < 0.65 ? (colour - 0.65) / 0.9 : (colour - 0.65) / 1.1));
    }
    NordlysBackgroundEngine.starCache = stars;
    return stars;
  }
});
