/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE MIDNIGHT SUN SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

/* Midnight sun: the horizon, the zenith and the bearing the sun keeps to, as
   shares of the page. */
const NORDLYS_MIDNIGHT_SUN = { horizon: 0.78, zenith: 0.08, x: 0.79 };

NordlysSkies.paint("midnightsun", "renderMidnightSun", {
  /* ── Midnight sun ───────────────────────────────────────────────────
     The sun where it really is for the person now (sky-clock.js), over a
     flat sea with a low coast: as high above the horizon as it stands, a
     small disc, white by day and turning gold and then red as it sinks, and
     flattened at the horizon by the air it is seen through. The sky takes
     its light from how high the sun is — the blue of day, the gold hour, the
     rose and violet just after it sets, the blue hour, then night and its
     stars — the mood colouring the sky the light falls on and the warm light
     its own, never mixed with it. North of the Arctic Circle in June it
     circles all night without setting; anywhere else it does what it does
     there, which is the point of it.

     The view turns with the sun, so the disc keeps to the clear strip right
     of the board, and once the sun's light has gone it turns, over the half
     hour of dusk, to the moon, if the moon is up: in winter it is night most
     evenings, and a night sea with nothing in its sky says nothing. Which
     way the view looks is told by the coast, laid round the compass from the
     seed, which the sun travels along through the day. The only motion a
     glance can see is the light on the water. */
  initCoast() {
    this.coast = [];
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x1b873593) >>> 0);
    const hills = 4 + Math.floor(random() * 3);
    for (let i = 0; i < hills; i++) {
      const steps = 14;
      const knolls = 1 + random() * 2.5;
      const phase = random() * Math.PI * 2;
      const back = [];
      // A low rise with a knoll or two along its back, never a box.
      for (let k = 0; k <= steps; k++) {
        const along = k / steps;
        back.push(Math.pow(Math.sin(Math.PI * along), 0.85) * (0.82 + 0.18 * Math.sin(along * knolls * Math.PI * 2 + phase)));
      }
      this.coast.push({
        // Round the compass, unevenly, so some bearings look out to open sea.
        bearing: ((i + random() * 0.6) / hills) * 360,
        span: 12 + random() * 26,
        height: 0.006 + random() * 0.018,
        back
      });
    }
  },

  // The sun now; an evening's sun at the gold hour where there is no sky to read.
  sunNow() {
    if (!window.NordlysSky?.daylight) return { elevation: 5, azimuth: 290, day: 0.4, golden: 0.8, blue: 0, night: 0, rising: false };
    return window.NordlysSky.daylight(this.now(), this.whereNow());
  },

  /* The moon now: where it stands and how much of it is lit — tonight's,
     or a full one when the real moon is turned off, as in Halo. */
  moonNow() {
    if (!window.NordlysSky?.moonPosition) return null;
    const place = this.whereNow();
    const lit = this.realSky === false ? { phase: 0.5, illumination: 1 } : window.NordlysSky.moonPhase(this.now());
    return { ...window.NordlysSky.moonPosition(this.now(), place.lat, place.lon), ...lit, south: place.lat < 0 };
  },

  renderMidnightSun() {
    const ctx = this.ctx;
    const light = this.lightMode;
    const sun = this.sunNow();
    const moon = this.moonNow();
    const horizon = this.h * NORDLYS_MIDNIGHT_SUN.horizon;
    const scale = (horizon - this.h * NORDLYS_MIDNIGHT_SUN.zenith) / 2;
    const x = this.w * NORDLYS_MIDNIGHT_SUN.x;
    const unit = Math.min(this.w, this.h);
    const disc = Math.max(5, unit * 0.0085);
    const mix = (a, b, k) => a.map((value, i) => Math.round(value + (b[i] - value) * k));
    const rgba = ([r, g, b], alpha) => `rgba(${r}, ${g}, ${b}, ${Math.max(0, alpha).toFixed(3)})`;
    const smooth = (from, to, value) => {
      const k = Math.min(1, Math.max(0, (value - from) / (to - from)));
      return k * k * (3 - 2 * k);
    };
    const turn = (to, from) => ((to - from + 540) % 360) - 180;
    // Facing the sun, and the moon once dusk is over and it has risen.
    const toMoon = moon ? smooth(-4, -10, sun.elevation) * smooth(-3, 2, moon.elevation) : 0;
    const facing = sun.azimuth + (moon ? turn(moon.azimuth, sun.azimuth) : 0) * toMoon;
    // A bearing and a height onto the page, as the stereographic view has them: a degree is about six pixels at the horizon.
    const across = (bearing) => x + scale * 2 * Math.tan((Math.max(-170, Math.min(170, turn(bearing, facing))) * Math.PI) / 360);
    const above = (elevation) => horizon - scale * 2 * Math.tan((Math.max(-10, elevation) * Math.PI) / 360);
    const [c1, c2, c3] = this.paletteRgb;
    const e = sun.elevation;
    const sx = across(sun.azimuth);
    const sy = above(e);
    // The sun's own light: white high up, gold low down, red at the horizon.
    const tone = e > 14 ? mix([255, 238, 200], [255, 251, 242], smooth(14, 40, e))
      : e > 2 ? mix([255, 176, 92], [255, 238, 200], smooth(2, 14, e))
      : mix([248, 112, 70], [255, 176, 92], smooth(-2, 2, e));
    // How much of the disc is up.
    const up = smooth(-1.2, 0.8, e);
    const day = sun.day;

    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    /* The sky, top to horizon: the mood at night, drawn towards the blue of
       day by daylight — a deep blue overhead, where the clock is, paling to
       the horizon, as a clear day's sky does. */
    const top = light ? mix(c2, [130, 175, 235], 0.7 * day) : mix(c3, [36, 104, 214], 0.72 * day);
    const low = light ? mix(c1, [190, 215, 248], 0.75 * day) : mix(c2, [150, 205, 255], 0.78 * day);
    const lowAlpha = (light ? 0.06 : 0.05) + (light ? 0.13 : 0.32) * day + 0.08 * sun.blue;
    const air = ctx.createLinearGradient(0, 0, 0, horizon);
    air.addColorStop(0, rgba(top, (light ? 0.05 : 0.035) + (light ? 0.1 : 0.1) * day + 0.04 * sun.blue));
    air.addColorStop(0.55, rgba(mix(top, low, 0.45), (light ? 0.05 : 0.04) + (light ? 0.11 : 0.17) * day + 0.06 * sun.blue));
    air.addColorStop(1, rgba(low, lowAlpha));
    ctx.fillStyle = air;
    ctx.fillRect(0, 0, this.w, horizon);
    // The blue hour: twilight blue rising off the whole horizon.
    if (sun.blue > 0.02) {
      const band = ctx.createLinearGradient(0, horizon, 0, horizon * 0.35);
      const blue = mix(light ? [120, 140, 205] : [70, 110, 225], c2, 0.25);
      band.addColorStop(0, rgba(blue, sun.blue * (light ? 0.12 : 0.2)));
      band.addColorStop(1, rgba(blue, 0));
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, this.w, horizon);
    }
    /* The gold hour and the minutes after the sun has gone: gold where it
       is, coral round it, a violet haze above, along the horizon on its side. */
    if (sun.golden > 0.02) {
      const stops = light
        ? (sun.rising ? [[255, 214, 186], [255, 198, 208], [214, 202, 240]] : [[255, 206, 166], [255, 186, 176], [222, 192, 232]])
        : (sun.rising ? [[255, 186, 118], [255, 118, 146], [128, 108, 222]] : [[255, 162, 78], [255, 96, 82], [150, 78, 190]]);
      const strength = sun.golden * (light ? 0.3 : 0.5);
      const reach = Math.max(this.w, this.h) * 0.9;
      const glow = ctx.createRadialGradient(sx, horizon, 0, sx, horizon, reach);
      glow.addColorStop(0, rgba(stops[0], strength));
      glow.addColorStop(0.22, rgba(stops[1], strength * 0.5));
      glow.addColorStop(0.55, rgba(stops[2], strength * 0.16));
      glow.addColorStop(1, rgba(stops[2], 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.w, horizon);
    }
    /* Night: the faint glow of the air itself along the horizon, so the coast
       still stands against something, and the stars above it. */
    const night = Math.max(sun.night, sun.blue * 0.45);
    if (night > 0.05) {
      const glow = ctx.createLinearGradient(0, horizon, 0, horizon - this.h * 0.16);
      glow.addColorStop(0, rgba(mix(c1, c2, 0.5), night * (light ? 0.08 : 0.1)));
      glow.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, horizon - this.h * 0.16, this.w, this.h * 0.16);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.w, horizon);
      ctx.clip();
      this.renderStars({ share: 0.6, night });
      ctx.restore();
    }
    /* The sun: by day the sky round it turns white, far wider than the disc,
       which is what says sun rather than moon; then the disc, cut by the
       horizon as it goes down. */
    if (e > -3) {
      const aureole = unit * (0.15 + 0.26 * day);
      // On a light page white light cannot show; there the aureole is the sun's own warm tint.
      this.glow(sx, sy, aureole, aureole, 0, light ? mix(tone, [255, 200, 130], 0.4) : mix(tone, [255, 255, 255], 0.4 * day), (light ? 0.24 : 0.22 + 0.24 * day) * up);
      this.glow(sx, sy, disc * 4, disc * 4, 0, tone, (light ? 0.35 : 0.6) * up);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.w, horizon);
      ctx.clip();
      // Within a few degrees of the horizon the air flattens the disc.
      ctx.translate(sx, sy);
      ctx.scale(1, 1 - 0.16 * (1 - smooth(-0.5, 4, e)));
      ctx.beginPath();
      ctx.arc(0, 0, disc, 0, Math.PI * 2);
      ctx.fillStyle = rgba(light ? mix(tone, [214, 120, 40], 0.45) : tone, light ? 0.7 : 0.95);
      ctx.fill();
      ctx.restore();
    }
    // The moon, when it is up: its phase as tonight's, faint by day, bright by night.
    let lamp = { x: sx, tone, shine: Math.max(up * (0.4 + 0.35 * sun.golden + 0.25 * day), sun.golden * 0.4, sun.blue * 0.1) };
    if (moon && moon.elevation > -1) {
      const mx = across(moon.azimuth);
      const my = above(moon.elevation);
      const seen = (0.3 + 0.7 * moon.illumination) * (1 - 0.75 * day) * smooth(-1, 1.5, moon.elevation);
      const silver = light ? mix([96, 106, 134], c2, 0.2) : [236, 242, 255];
      if (mx > -disc * 20 && mx < this.w + disc * 20 && seen > 0.02) {
        this.glow(mx, my, unit * 0.1, unit * 0.1, 0, silver, (light ? 0.1 : 0.16) * seen);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.w, horizon);
        ctx.clip();
        // Earthshine, the dark of the disc just visible, so a crescent is a moon.
        ctx.beginPath();
        ctx.arc(mx, my, disc * 0.96, 0, Math.PI * 2);
        ctx.fillStyle = rgba(silver, (light ? 0.1 : 0.08) * seen);
        ctx.fill();
        ctx.fillStyle = rgba(silver, (light ? 0.55 : 0.92) * seen);
        this.traceMoon(mx, my, disc, moon);
        ctx.fill();
        ctx.restore();
      }
      // Once the sun's light is gone the water shines with the moon's.
      const glade = moon.illumination * night * smooth(-1, 2, moon.elevation) * 0.55;
      if (glade > lamp.shine) lamp = { x: mx, tone: silver, shine: glade };
    }
    this.paintSea({ horizon, disc, light, low, lowAlpha, lamp, golden: sun.golden, mix, rgba });
    this.paintCoast({ horizon, across, light, rgba });
    ctx.restore();
  },

  /* The sea: the sky's light thrown back, darker the nearer it is; under the
     sun — or the moon, at night — a column of reflected light, and across it
     fine glints that widen towards the viewer and come and go as the water
     moves. */
  paintSea({ horizon, disc, light, low, lowAlpha, lamp, golden, mix, rgba }) {
    const ctx = this.ctx;
    const [c1, , c3] = this.paletteRgb;
    const away = this.h - horizon;
    const water = ctx.createLinearGradient(0, horizon, 0, this.h);
    water.addColorStop(0, rgba(low, lowAlpha * 0.55));
    water.addColorStop(0.45, rgba(mix(low, c3, 0.5), lowAlpha * 0.25));
    water.addColorStop(1, rgba(c3, light ? 0.04 : 0.02));
    ctx.fillStyle = water;
    ctx.fillRect(0, horizon, this.w, away);
    // The horizon itself: a fine line, brightest under the light.
    const line = ctx.createLinearGradient(0, 0, this.w, 0);
    const at = Math.max(0, Math.min(1, lamp.x / this.w));
    line.addColorStop(0, rgba(c1, light ? 0.06 : 0.04));
    line.addColorStop(at, rgba(mix(c1, lamp.tone, 0.6), (light ? 0.14 : 0.2) + (light ? 0.1 : 0.14) * Math.min(1, lamp.shine * 2)));
    line.addColorStop(1, rgba(c1, 0.04));
    ctx.fillStyle = line;
    ctx.fillRect(0, horizon - 0.5, this.w, 1);
    if (lamp.shine < 0.02 || lamp.x < -this.w * 0.2 || lamp.x > this.w * 1.2) return;
    const glints = light ? mix(lamp.tone, [190, 110, 50], 0.5) : lamp.tone;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon + 0.5, this.w, away);
    ctx.clip();
    // The column: the light laid on the water, longest when it is low.
    this.glow(lamp.x, horizon, disc * 2.4 + this.w * 0.03, away * (0.5 + 0.5 * golden), 0, glints, lamp.shine * (light ? 0.22 : 0.32));
    // Lighter water where the light lands: on a light theme, taken back towards the page.
    if (light) ctx.globalCompositeOperation = "destination-out";
    const rows = 30;
    for (let i = 0; i < rows; i++) {
      const depth = (i + 0.6) / rows;
      const row = horizon + away * depth ** 1.7;
      const spread = disc * 1.2 + this.w * 0.07 * depth;
      for (let j = 0; j < 4; j++) {
        const flicker = 0.5 + 0.5 * Math.sin(this.t * (2.4 + j * 0.8) + i * 1.7 + j * 2.1);
        const offset = Math.sin(i * 12.9898 + j * 78.233) * spread;
        const near = Math.pow(1 - Math.min(1, Math.abs(offset) / spread), 1.4);
        const length = spread * (0.12 + 0.3 * flicker) * (0.6 + 0.4 * near);
        const alpha = lamp.shine * flicker * near * (1 - depth * 0.5) * (light ? 0.55 : 0.8);
        if (alpha < 0.015) continue;
        ctx.fillStyle = light ? `rgba(0, 0, 0, ${alpha.toFixed(3)})` : rgba(glints, alpha);
        ctx.fillRect(lamp.x + offset - length / 2, row, length, 0.6 + depth * 1.2);
      }
    }
    ctx.restore();
  },

  /* The coast: low hills and islands on the horizon, each at its bearing,
     where the view would see them. On a dark sky they are where the sky's
     light stops; on a light one, a soft grey. */
  paintCoast({ horizon, across, light, rgba }) {
    const ctx = this.ctx;
    const shade = this.pale(2, 0.35);
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "destination-out";
    ctx.fillStyle = light ? rgba(shade, 0.3) : "rgba(0, 0, 0, 0.85)";
    for (const hill of this.coast) {
      const points = [];
      hill.back.forEach((rise, k) => {
        const x = across(hill.bearing + (k / (hill.back.length - 1) - 0.5) * hill.span);
        if (x > -this.w * 0.5 && x < this.w * 1.5) points.push([x, horizon - rise * hill.height * this.h]);
      });
      if (points.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(points[0][0], horizon + 0.5);
      for (const [px, py] of points) ctx.lineTo(px, py);
      ctx.lineTo(points[points.length - 1][0], horizon + 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
});
