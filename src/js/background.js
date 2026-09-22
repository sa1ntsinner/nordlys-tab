/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - BACKGROUND SCENES & VISUAL ENGINE
   Time-based (refresh-rate independent), light/dark aware, zero idle cost.
   ═══════════════════════════════════════════════════════════════════ */

/* The scenes the canvas draws itself. Named once, here: app.js decides whether
   to start the engine and settings.js decides which controls apply, and all
   three used to keep their own copy of this list — so adding a composition
   meant finding three places and the third one was always the one missed. */
const NORDLYS_GENERATIVE_SCENES = new Set(["aurora", "halo", "silk", "frost", "drift", "horizon"]);
const NORDLYS_BACKGROUND_PALETTES = {
  polar: ["#68e1d1", "#6ea8fe", "#9d8cff"],
  violet: ["#8be9fd", "#8b7cff", "#cf78ff"],
  ember: ["#ffd166", "#f48c6b", "#b86bff"],
  mono: ["#dbeafe", "#94a3b8", "#64748b"]
};

/* The moment each scene is held at when it is still — motion at zero, reduced
   motion, the settings thumbnails — and the moment a moving one starts from.
   Chosen by looking, scene by scene, so a still sky is the best frame of it
   rather than whichever frame the clock happened to be on. */
const NORDLYS_REST_PHASE = { aurora: 12, halo: 7.4, silk: 31.7, frost: 7.4, drift: 7.4, horizon: 7.4 };
const NORDLYS_STILLS = new WeakMap();
// A minute without input and the sky paints at its idle rate.
const NORDLYS_IDLE_AFTER = 60000;

/* Silk strokes each thread three times, wide and faint first: the bloom gives a
   strand air, the core gives it an edge, and neither alone reads as fibre. */
const NORDLYS_SILK_PASSES = [
  { width: 6, alpha: 0.22 },
  { width: 2.4, alpha: 0.5 },
  { width: 1, alpha: 1 }
];

class NordlysBackgroundEngine {
  constructor() {
    this.canvas = document.getElementById("bg-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d", { alpha: true, desynchronized: true }) : null;
    this.animId = null;
    this.stars = [];
    this.meteors = [];
    this.nebulae = [];
    this.t = NORDLYS_REST_PHASE.aurora;
    this.ink = 1;
    /* What the sky is scattered from. Zero is the authored composition every
       install starts with; "Shuffle this sky" stores another. The same seed at
       the same size is the same world, so a new tab no longer rearranges the
       stars and the frost. */
    this.seed = 0;
    this.rng = null;
    /* The date the sky is drawn for, and whether it follows the real one. The
       clock is a field so a test, or a still, can hold it at a moment. */
    this.now = () => new Date();
    this.realSky = true;
    /* Whether the light follows the sun where the person is, and what the sun
       is doing if it does. Everything that reads `sky` treats null as the
       mood exactly as it was mixed. */
    this.daylight = false;
    this.sky = null;
    this.place = null;
    this.lastFrame = 0;
    this.running = false;
    this.lastInput = performance.now();
    /* Atmospheres are different compositions, not particle-count variants.
       Every one shares the same small set of controls and can become a still
       image at zero motion, which keeps the system expressive without turning
       the settings panel into a shader editor. */
    this.mode = "aurora";
    this.motion = 1;
    this.intensity = 1;
    this.paletteName = "theme";
    /* Moods somebody mixed themselves. They arrive from the stored config
       rather than from this file, so the engine holds them beside the built-in
       four and resolves a name through both. */
    this.customPalettes = {};
    this.silk = [];
    this.frost = [];
    this.frostTips = [];
    this.frostPatches = [];
    this.terrain = [];
    this.contours = null;
    this.quietZones = [];
    this.quietAlphas = [];
    this.quietSolvedAt = -Infinity;
    this.quietGround = [6, 10, 20];
    this.isMousePending = false;
    this.mouseX = 50;
    this.mouseY = 50;
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Per-theme shader palette (filled from CSS --shader-1..3 tokens by default)
    this.palette = ["#35d6c0", "#5b6cff", "#9d4edd"];
    this.paletteRgb = [[53, 214, 192], [91, 108, 255], [157, 78, 221]];

    this.init();
    this.refreshPalette();
  }

  /* Reads the active theme's --shader-1..3 tokens, unless the user chose one
     of the deliberately small colour moods shared by every atmosphere. */
  refreshPalette() {
    const styles = getComputedStyle(document.documentElement);
    // The page colour under the canvas, which the quiet zones solve against.
    const ground = /^#([0-9a-f]{6})$/i.exec(styles.getPropertyValue("--void").trim());
    if (ground) {
      const n = parseInt(ground[1], 16);
      this.quietGround = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const fallback = ["#35d6c0", "#5b6cff", "#9d4edd"];
    const preset = NORDLYS_BACKGROUND_PALETTES[this.paletteName] || this.customPalettes[this.paletteName];
    const colors = preset || [1, 2, 3].map((i, idx) => {
        const v = styles.getPropertyValue(`--shader-${i}`).trim();
        return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback[idx];
      });
    this.applyPalette(this.lit(colors));
  }

  /* A mood as the light of the moment falls on it, when the sky follows the
     sun; the mood as mixed otherwise. */
  lit(colors) {
    return this.sky && window.NordlysSky?.lightMood ? window.NordlysSky.lightMood(colors, this.sky, { light: this.lightMode }) : colors;
  }

  /* ── The time of day ──────────────────────────────────────────────
     One switch for every atmosphere (NordlysSky.daylight): the mood graded by
     the sun, a warm glow where it rises and sets, a pale light from above by
     day, a cool band in the blue hour, and stars that come out only after
     dark. The place is the time zone's city — no permission, no network.
     Read once a minute, which is a quarter of a degree of sun, and again
     whenever the page comes back into view after being away. */
  setDaylight(on) {
    this.daylight = Boolean(on) && Boolean(window.NordlysSky?.daylight);
    clearInterval(this.skyTimer);
    if (this.daylight) {
      this.skyTimer = setInterval(() => this.followSun(), 60000);
      if (!this.skyWatch) {
        this.skyWatch = () => { if (!document.hidden && this.daylight) this.followSun(); };
        document.addEventListener("visibilitychange", this.skyWatch);
      }
    }
    this.followSun();
  }

  followSun() {
    this.sky = this.daylight ? this.readSky(this.now()) : null;
    this.quietSolvedAt = -Infinity;
    this.refreshPalette();
  }

  readSky(date) {
    if (!this.place) {
      let zone;
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { zone = ""; }
      this.place = window.NordlysSky.zonePlace(zone || "", date);
    }
    return window.NordlysSky.daylight(date, this.place);
  }

  /* The sun itself, off the edge of the page. Facing the equator, east is on
     the left, so the glow keeps to its own side of the sky through the year;
     south of the equator the other way round. */
  renderSunlight() {
    const sky = this.sky;
    const ctx = this.ctx;
    const light = this.lightMode;
    const mix = (a, b, t) => a.map((value, index) => Math.round(value + (b[index] - value) * t));
    const rgba = ([r, g, b], alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    ctx.globalAlpha = this.intensity ?? 1;
    if (sky.golden > 0.02) {
      /* A sunset is a gradient, not a colour: gold at the horizon, coral above
         it, a violet haze fading into the sky. Its own colours, never mixed
         with the mood — a warm light averaged with a cool mood is brown. Dawn
         is the rosier of the two. */
      const stops = light
        ? (sky.rising ? [[255, 214, 186], [255, 198, 208], [214, 202, 240]] : [[255, 206, 166], [255, 186, 176], [222, 192, 232]])
        : (sky.rising ? [[255, 186, 118], [255, 118, 146], [128, 108, 222]] : [[255, 162, 78], [255, 96, 82], [150, 78, 190]]);
      const alpha = sky.golden * (light ? 0.24 : 0.42);
      const band = ctx.createLinearGradient(0, this.h, 0, this.h * 0.35);
      band.addColorStop(0, rgba(stops[0], alpha));
      band.addColorStop(0.3, rgba(stops[1], alpha * 0.55));
      band.addColorStop(0.65, rgba(stops[2], alpha * 0.2));
      band.addColorStop(1, rgba(stops[2], 0));
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, this.w, this.h);
      // Brightest where the sun is.
      const facing = (this.place?.lat ?? 1) < 0 ? -1 : 1;
      const across = Math.sin(((sky.azimuth ?? 180) - 180) * Math.PI / 180) * facing;
      const x = this.w * (0.5 + 0.38 * Math.max(-1, Math.min(1, across)));
      const reach = Math.max(this.w, this.h) * 0.45;
      const sun = ctx.createRadialGradient(x, this.h * 1.02, 0, x, this.h * 1.02, reach);
      sun.addColorStop(0, rgba(stops[0], alpha * 0.9));
      sun.addColorStop(0.5, rgba(stops[1], alpha * 0.25));
      sun.addColorStop(1, rgba(stops[1], 0));
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (sky.blue > 0.02) {
      const tone = mix(light ? [120, 140, 205] : [70, 110, 225], this.paletteRgb[1], 0.25);
      const band = ctx.createLinearGradient(0, this.h, 0, this.h * 0.4);
      band.addColorStop(0, rgba(tone, sky.blue * (light ? 0.1 : 0.16)));
      band.addColorStop(1, rgba(tone, 0));
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (sky.day > 0.02 && !light) {
      const tone = mix([205, 222, 255], this.paletteRgb[1], 0.3);
      const wash = ctx.createLinearGradient(0, 0, 0, this.h * 0.7);
      wash.addColorStop(0, rgba(tone, 0.07 * sky.day));
      wash.addColorStop(1, rgba(tone, 0));
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.restore();
  }

  applyPalette(colors) {
    this.palette = colors;
    this.paletteRgb = colors.map((hex) => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });

    // Re-tint the animated fields in place
    this.nebulae.forEach((n, i) => {
      n.color = this.paletteRgb[i % 3].join(", ");
    });
    this.quietSolvedAt = -Infinity;
    this.repaint();
    /* Anything else drawn from the palette — the scene thumbnails — follows the
       sky from this one announcement rather than from a copy of the colours. */
    window.dispatchEvent(new CustomEvent("nordlys:palette", { detail: { colors } }));
  }

  /* Colours being tried on rather than chosen. The stored name is left alone,
     so closing the editor without saving is a re-resolve and not an undo — and
     while it is open the sky itself is the swatch. */
  previewPalette(colors) {
    const valid = NordlysBackgroundEngine.paletteColors({ colors });
    if (!valid) return false;
    this.applyPalette(this.lit(valid));
    return true;
  }

  init() {
    if (!this.canvas) return;
    this.resize();

    // Throttled Resize (re-seeds fields so new area is fully populated)
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.resize();
        this.seedFields();
        this.refreshPalette();
      }, 120);
    }, { passive: true });

    // Someone is here: the frame budget goes back up from its idle rate.
    const present = () => { this.lastInput = performance.now(); };
    for (const type of ["pointerdown", "keydown", "wheel"]) window.addEventListener(type, present, { passive: true });

    // Throttled High-Frequency Mouse Tracking (rAF-synced CSS vars + particle field)
    window.addEventListener("pointermove", (e) => {
      this.lastInput = performance.now();
      if (this.motionQuery.matches) return;
      this.mouseX = (e.clientX / window.innerWidth) * 100;
      this.mouseY = (e.clientY / window.innerHeight) * 100;

      if (!this.isMousePending) {
        this.isMousePending = true;
        requestAnimationFrame(() => {
          document.documentElement.style.setProperty("--mouse-x", `${this.mouseX}%`);
          document.documentElement.style.setProperty("--mouse-y", `${this.mouseY}%`);
          this.isMousePending = false;
        });
      }
    }, { passive: true });

    this.motionQuery.addEventListener?.("change", (event) => {
      if (event.matches) {
        // The loop parks itself on its next frame; the picture stays.
        document.documentElement.style.removeProperty("--mouse-x");
        document.documentElement.style.removeProperty("--mouse-y");
      } else if (NORDLYS_GENERATIVE_SCENES.has(this.mode)) {
        this.start();
        this.resumeIfMoving();
      }
    });

    // Page Visibility API - zero CPU/GPU waste when tab is in background
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stop();
      } else if (NORDLYS_GENERATIVE_SCENES.has(this.mode)) {
        this.start();
      }
    });

    this.seedFields();
  }

  /* Every scene that scatters something seeds it once per size rather than per
     frame, so a held still frame and a moving one show the same world. */
  seedFields() {
    // A stream per seeding, so the world depends on the seed and the size only.
    this.rng = NordlysBackgroundEngine.stream((this.seed ^ 0x5bd1e995) >>> 0);
    this.initStars();
    this.initNebulae();
    this.initSilk();
    this.initFrost();
    this.initTerrain();
    this.rng = null;
  }

  /* Seeding draws from here rather than from Math.random directly, so the sky
     and its thumbnails can be seeded from a number and come out the same. */
  random() {
    return this.rng ? this.rng() : Math.random();
  }

  // mulberry32: small, fast, and plenty for scattering stars.
  static stream(seed) {
    let state = seed | 0;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  setSeed(seed) {
    const next = Number.isInteger(seed) && seed >= 0 ? seed >>> 0 : 0;
    if (next === this.seed) return;
    this.seed = next;
    this.seedFields();
    // Seeding resets the nebulae to their default tints; give them the palette.
    this.applyPalette(this.palette);
  }

  /* A still of one scene at any size, painted by the same code that paints the
     sky. The settings thumbnails used to be CSS imitations, and each time a
     scene changed its imitation fell behind: Frost's kept showing a sunburst
     long after the scene had grown fronds. A rendering of the scene cannot
     drift from the scene.

     The composition is laid out on a virtual viewport three times the size of
     the thumbnail and scaled down, so a hairline stays a hairline instead of
     turning into a bar. Each canvas keeps its seeded world, so a new colour
     mood repaints the same stars and fronds rather than a new scatter. */
  paintStill(canvas, scene, { width = canvas?.clientWidth, height = canvas?.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2), zoom = 3 } = {}) {
    if (!canvas || !NORDLYS_GENERATIVE_SCENES.has(scene)) return false;
    if (!width || !height) return false;
    let still = NORDLYS_STILLS.get(canvas);
    if (!still || still.mode !== scene || still.seed !== this.seed || still.w !== width * zoom || still.h !== height * zoom) {
      still = Object.assign(Object.create(NordlysBackgroundEngine.prototype), {
        canvas, ctx: canvas.getContext("2d"), w: width * zoom, h: height * zoom, mode: scene,
        t: NORDLYS_REST_PHASE[scene], ink: 1, motion: 0, intensity: 1, customPalettes: {}, seed: this.seed, rng: null,
        stars: [], meteors: [], nebulae: [], silk: [], frost: [], frostTips: [], frostPatches: [], terrain: [], quietZones: [],
        // A still is at rest by definition: nothing in it is mid-fall.
        atRest: () => true
      });
      still.seedFields();
      NORDLYS_STILLS.set(canvas, still);
    }
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    still.ctx.setTransform(dpr / zoom, 0, 0, dpr / zoom, 0, 0);
    still.palette = this.palette;
    still.paletteRgb = this.paletteRgb;
    // A thumbnail shows the sky as it is now, sun and all.
    still.sky = this.sky;
    still.place = this.place;
    still.nebulae.forEach((nebula, index) => { nebula.color = this.paletteRgb[index % 3].join(", "); });
    still.render(0);
    return true;
  }

  /* True when a light theme drives the UI — canvas switches palette/blend. */
  get lightMode() {
    return document.documentElement.classList.contains("light-ui");
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    // Resizing clears the buffer, and a held frame will not redraw itself.
    this.repaint();
  }

  initStars() {
    this.stars = [];
    const count = Math.min(Math.floor((this.w * this.h) / 9000), 160);
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: this.random() * this.w,
        y: this.random() * (this.h * 0.85),
        r: this.random() * 1.2 + 0.3,
        alpha: this.random() * 0.6 + 0.2,
        phase: this.random() * Math.PI * 2,
        // A few "hero" stars twinkle brighter with a soft halo
        hero: this.random() < 0.06
      });
    }
  }



  initNebulae() {
    // Very faint drifting colour fields behind the aurora
    this.nebulae = [
      { fx: 0.22, fy: 0.24, r: 0.42, color: "91, 108, 255", drift: 0.9 },
      { fx: 0.74, fy: 0.36, r: 0.38, color: "53, 214, 192", drift: 1.3 },
      { fx: 0.5, fy: 0.72, r: 0.46, color: "157, 78, 221", drift: 0.7 }
    ];
  }

  setMode(mode) {
    const changed = mode !== this.mode;
    this.mode = mode;
    this.quietSolvedAt = -Infinity;
    if (changed && NORDLYS_REST_PHASE[mode] !== undefined) this.t = NORDLYS_REST_PHASE[mode];
    if (NORDLYS_GENERATIVE_SCENES.has(mode)) {
      if (this.canvas) this.canvas.style.display = "block";
      this.start();
      /* A still or reduced-motion scene has deliberately parked its animation
         loop. Switching composition must paint immediately instead of waiting
         for a frame that will never arrive. */
      if (changed) this.repaint();
    } else {
      if (this.canvas) this.canvas.style.display = "none";
      this.stop();
    }
  }

  /* At rest the scene is painted once and held. Two things ask for that: the
     motion slider at zero, and the system telling us the user wants less
     movement. The second used to mean the loop never started at all, so a
     reduced-motion user who kept the default background got a blank canvas
     over their theme — the product's signature simply absent, for the people
     least able to opt back into it. "Reduce motion" is not "remove the
     picture". */
  atRest() {
    return this.motionQuery.matches || (this.motion ?? 1) === 0;
  }

  start() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.loop = (now) => {
      if (!this.running) return;
      /* A frame budget. The scenes move a few pixels a second, so painting at
         the panel's rate mostly repaints the same picture, and every painted
         frame makes each glass surface above the canvas blur what is behind it
         again. Thirty a second is smooth for motion this slow; after a minute
         with no input, fifteen. The pace is unchanged, because dt is still the
         real time elapsed. */
      const budget = now - this.lastInput > NORDLYS_IDLE_AFTER ? 1000 / 15 : 1000 / 30;
      if (now - this.lastFrame < budget - 2) {
        this.animId = requestAnimationFrame(this.loop);
        return;
      }
      // dt in 60fps units, capped so a long stall cannot jump the sky ahead.
      const dt = Math.min((now - this.lastFrame) / 16.666, 6);
      this.lastFrame = now;
      this.render(dt);
      /* Nothing in the scene advances at rest, so a second frame would paint
         the same pixels. Holding the last one costs nothing to keep and lets
         every backdrop-filter above it sample a layer that never invalidates. */
      if (this.atRest()) { this.animId = null; return; }
      this.animId = requestAnimationFrame(this.loop);
    };
    this.animId = requestAnimationFrame(this.loop);
  }

  /* A parked scene has no next frame coming, so anything that changes what the
     frame should look like has to ask for one. */
  repaint() {
    if (this.running && this.ctx && this.animId === null) this.render(0);
  }

  resumeIfMoving() {
    if (!this.running || this.animId !== null || this.atRest()) return;
    this.lastFrame = performance.now();
    this.animId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  pause() {
    this.stop();
  }

  resume() {
    if (NORDLYS_GENERATIVE_SCENES.has(this.mode)) {
      this.start();
    }
  }

  /* Two knobs the settings expose, applied once for every scene rather than per
     effect: how fast the world advances, and how present it is. Before this the
     modes differed only in which particles they drew, so switching between them
     read as no change at all. */
  setAtmosphere({ motion, intensity, palette } = {}) {
    if (Number.isFinite(motion)) this.motion = Math.max(0, Math.min(1.5, motion));
    if (Number.isFinite(intensity)) this.intensity = Math.max(0.15, Math.min(1.5, intensity));
    this.quietSolvedAt = -Infinity;
    if (typeof palette === "string" && this.knowsPalette(palette)) {
      this.paletteName = palette;
      this.refreshPalette();
    }
    this.resumeIfMoving();
    this.repaint();
  }

  knowsPalette(name) {
    return name === "theme"
      || Boolean(NORDLYS_BACKGROUND_PALETTES[name])
      || Boolean(this.customPalettes[name]);
  }

  /* The moods somebody mixed themselves, handed over whole. A mood that is
     deleted while it is the one in use falls back to the theme rather than
     leaving the canvas on colours nothing can name any more. */
  setPalettes(list) {
    const next = {};
    for (const entry of Array.isArray(list) ? list : []) {
      const colors = NordlysBackgroundEngine.paletteColors(entry);
      if (colors && typeof entry.id === "string" && entry.id) next[entry.id] = colors;
    }
    this.customPalettes = next;
    if (!this.knowsPalette(this.paletteName)) this.paletteName = "theme";
    this.refreshPalette();
  }

  /* Three hex colours or nothing. A mood is hand-edited in the settings and can
     arrive from an imported file, so a malformed one is refused here once
     instead of reaching a gradient stop and painting transparent. */
  static paletteColors(entry) {
    const raw = entry && Array.isArray(entry.colors) ? entry.colors : null;
    if (!raw || raw.length !== 3) return null;
    const colors = raw.map((value) => {
      const hex = String(value == null ? "" : value).trim().toLowerCase();
      return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
    });
    return colors.every(Boolean) ? colors : null;
  }

  /* A palette colour at an alpha, without building "#rrggbb" + "40" strings
     whose two hex digits nobody can read as an opacity. */
  rgba(index, alpha) {
    const [r, g, b] = this.paletteRgb[index % this.paletteRgb.length];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  render(dt = 1) {
    if (!this.ctx) return;
    this.t += 0.005 * dt * (this.motion ?? 1);
    this.ctx.clearRect(0, 0, this.w, this.h);
    /* Scenes paint with their own alphas; scaling them all by one number keeps
       a composition's internal balance while still letting the user dial the
       atmosphere down. It cannot be done with globalAlpha alone, because a
       scene that sets globalAlpha per stroke overwrites it — so the scenes
       multiply by `ink` instead, and the canvas default covers the rest. */
    this.ink = this.intensity ?? 1;
    // By day the sky steps back, the aurora most of all: it is a night thing.
    if (this.sky) this.ink *= 1 - this.sky.day * (this.mode === "aurora" ? 0.45 : 0.18);
    this.ctx.globalAlpha = this.ink;

    switch (this.mode) {
      case "aurora": {
        this.renderNebulae(0.05);
        this.renderStars();
        this.renderMeteors(0.003, dt);
        // Theme-tinted curtains: wide soft glow pass underneath, sharper curtain on top
        const [c1, c2, c3] = this.palette;
        this.drawRibbon(0.35, c1, 0.05, 1.2, 0.4, 2.1);
        this.drawRibbon(0.35, c1, 0.09, 1.2, 0.4, 1);
        this.drawRibbon(0.48, c2, 0.06, 0.9, 0.6, 2.2);
        this.drawRibbon(0.48, c2, 0.11, 0.9, 0.6, 1);
        this.drawRibbon(0.62, c3, 0.045, 1.5, 0.8, 2.4);
        this.drawRibbon(0.62, c3, 0.08, 1.5, 0.8, 1);
        break;
      }
      case "halo":
        this.renderHalo();
        break;
      case "silk":
        this.renderSilk();
        break;
      case "frost":
        this.renderFrost();
        break;
      case "drift":
        this.renderDrift();
        break;
      case "horizon":
        this.renderHorizon();
        break;
    }
    if (this.sky) this.renderSunlight();
    if (this.quietZones.length) this.quieten();
    this.ctx.globalAlpha = 1;
  }

  /* ── Quiet zones ────────────────────────────────────────────────────
     The rects where text sits straight on the sky — the clock, the date, the
     greeting, the search field — are handed to the engine, and after a scene
     paints, the engine takes back exactly as much of the sky under each one as
     that text needs to stay readable. Not a scrim: on a dark evening it takes
     nothing, and when a bright curtain or a halo drifts behind the clock it
     takes just enough, feathered so nobody sees a box. It lives in the engine
     rather than in any scene, so a scene added next year is kept readable
     without knowing this exists.

     Each zone is { x, y, w, h, inks: [[rgb, target, alpha?]], cover? }: the
     text colours that sit in it with the ratio each must reach, and the
     translucent surface, if any, between the sky and the text. */
  setQuietZones(zones) {
    this.quietZones = Array.isArray(zones) ? zones.filter(zone => zone && zone.w > 0 && zone.h > 0 && zone.inks?.length) : [];
    this.quietAlphas = [];
    this.quietSolvedAt = -Infinity;
    this.repaint();
  }

  quieten() {
    const now = performance.now();
    /* Solving reads the canvas back, which stalls the GPU, so it happens once
       a second while the sky moves and once, exactly, when it is held. */
    if (now - this.quietSolvedAt > 1000) {
      this.quietAlphas = this.solveQuiet();
      this.quietSolvedAt = now;
    }
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    this.quietZones.forEach((zone, index) => {
      const alpha = this.quietAlphas[index] || 0;
      if (alpha < 0.01) return;
      /* A soft rounded rect is a blurred shadow. The rect itself is drawn off
         the canvas and only its shadow lands on the zone. Shadow offsets and
         blur ignore the transform, so both are given in device pixels. */
      const feather = Math.max(24, Math.min(zone.h, 96) * 0.75);
      const away = this.w + feather * 4;
      /* The rect reaches a feather past the zone on every side. A blur wider
         than a line of text is — the date is twenty pixels tall — would
         otherwise leave the words under a fraction of the attenuation the
         solver asked for, the peak of a bell that never reaches its top. */
      const reach = feather;
      ctx.shadowColor = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
      ctx.shadowBlur = feather * dpr;
      ctx.shadowOffsetX = away * dpr;
      ctx.fillRect(zone.x - away - reach, zone.y - reach, zone.w + reach * 2, zone.h + reach * 2);
    });
    ctx.restore();
  }

  /* How much sky to take back from each zone: the least attenuation at which
     nine in ten of the zone's pixels give every one of its inks its ratio. */
  solveQuiet() {
    if (!this.canvas || !this.w) return [];
    const sw = 96;
    const sh = Math.max(24, Math.round((sw * this.h) / this.w));
    const scratch = this.quietScratch || (this.quietScratch = document.createElement("canvas"));
    if (scratch.width !== sw || scratch.height !== sh) {
      scratch.width = sw;
      scratch.height = sh;
    }
    const sctx = scratch.getContext("2d", { willReadFrequently: true });
    sctx.clearRect(0, 0, sw, sh);
    sctx.drawImage(this.canvas, 0, 0, sw, sh);
    const data = sctx.getImageData(0, 0, sw, sh).data;
    const sx = sw / this.w;
    const sy = sh / this.h;
    return this.quietZones.map(zone => {
      const pixels = [];
      const x0 = Math.max(0, Math.floor(zone.x * sx)), x1 = Math.min(sw, Math.ceil((zone.x + zone.w) * sx));
      const y0 = Math.max(0, Math.floor(zone.y * sy)), y1 = Math.min(sh, Math.ceil((zone.y + zone.h) * sy));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * sw + x) * 4;
          pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3] / 255]);
        }
      }
      // The page under the zone, as the theme's own gradients paint it there.
      return NordlysBackgroundEngine.quietAlpha(pixels, zone.ground || this.quietGround, zone);
    });
  }

  /* Pure, so it can be tested without a canvas: pixels are the scene's own
     [r, g, b, a], ground is the page colour the canvas is composited over. */
  static quietAlpha(pixels, ground, zone) {
    if (!pixels.length) return 0;
    const channel = value => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const over = (top, alpha, under) => top.map((value, index) => value * alpha + under[index] * (1 - alpha));
    const cover = zone.cover && zone.cover[3] > 0 ? zone.cover : null;
    const passes = cut => {
      for (const [ink, target, inkAlpha = 1] of zone.inks) {
        let failing = 0;
        for (const [r, g, b, a] of pixels) {
          const kept = a * (1 - cut);
          let seen = over([r, g, b], kept, ground);
          if (cover) seen = over(cover, cover[3], seen);
          const text = over(ink, inkAlpha, seen);
          const [x, y] = [luminance(text), luminance(seen)];
          if ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) < target) failing++;
        }
        if (failing > pixels.length * 0.1) return false;
      }
      return true;
    };
    const most = zone.most ?? 0.9;
    if (passes(0)) return 0;
    if (!passes(most)) return most;
    let low = 0, high = most;
    for (let step = 0; step < 9; step++) {
      const mid = (low + high) / 2;
      if (passes(mid)) high = mid; else low = mid;
    }
    return high;
  }

  renderNebulae(baseAlpha) {
    const light = this.lightMode;
    this.ctx.save();
    this.ctx.globalCompositeOperation = light ? "multiply" : "screen";
    for (const n of this.nebulae) {
      const cx = this.w * (n.fx + Math.sin(this.t * 0.35 * n.drift) * 0.03);
      const cy = this.h * (n.fy + Math.cos(this.t * 0.28 * n.drift) * 0.025);
      const r = Math.max(this.w, this.h) * n.r;
      const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const a = baseAlpha * (light ? 0.85 : 1);
      grad.addColorStop(0, `rgba(${n.color}, ${a})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    this.ctx.restore();
  }

  /* `share` thins the field and `glare` is a bright body that washes out the
     stars around it — a moon behind cloud leaves a dark disc of sky starless,
     and a halo scene that ignored that would look pasted together. */
  renderStars({ share = 1, glare = null } = {}) {
    const light = this.lightMode;
    // Following the sun, the stars are out at night and in the blue hour only.
    const out = this.sky ? 0.15 + 0.85 * Math.max(this.sky.night, this.sky.blue * 0.55) : 1;
    if (out < 0.2) return;
    this.ctx.fillStyle = light ? "rgba(60, 80, 130, 0.75)" : "rgba(225, 240, 255, 0.75)";
    const stride = Math.max(1, Math.round(1 / share));
    for (let index = 0; index < this.stars.length; index += stride) {
      const s = this.stars[index];
      let a = s.alpha + Math.sin(this.t * 1.8 + s.phase) * 0.2;
      if (glare) a *= Math.min(1, Math.max(0, Math.hypot(s.x - glare.x, s.y - glare.y) / glare.r - 1));
      if (a <= 0.02) continue;
      this.ctx.globalAlpha = Math.max(0.05, Math.min(0.85, a)) * this.ink * out;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      this.ctx.fill();
      if (s.hero && a > 0.6) {
        // Soft halo bloom on the brightest twinkle peaks
        this.ctx.globalAlpha = (a - 0.6) * (light ? 0.3 : 0.5) * this.ink * out;
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, s.r * (light ? 2.4 : 3.2), 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = this.ink;
  }

  renderMeteors(chance = 0.003, dt = 1) {
    /* A meteor is motion and nothing else. Held still it reads as a scratch on
       the picture, so at rest there are none rather than one stopped mid-fall.
       They also used to ignore the motion setting entirely, taking dt straight,
       which is why turning motion down to zero still left them falling. */
    if (this.atRest()) { this.meteors.length = 0; return; }
    /* Scaled by motion like everything else in the scene. Guarding only the
       zero case fixed the slider's endpoint and left every other position
       wrong: at 10% the ribbons and stars crawled while the meteors went on
       streaking at full speed and full frequency, which is the one thing in
       the frame that draws the eye. */
    const pace = this.motion ?? 1;
    if (Math.random() < chance * dt * pace && this.meteors.length < 3) {
      this.meteors.push({
        x: Math.random() * (this.w * 0.85),
        y: Math.random() * (this.h * 0.35),
        len: Math.random() * 80 + 50,
        speed: Math.random() * 8 + 10,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.25,
        life: 1
      });
    }

    const light = this.lightMode;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += Math.cos(m.angle) * m.speed * dt * pace;
      m.y += Math.sin(m.angle) * m.speed * dt * pace;
      m.life -= 0.028 * dt * pace;

      if (m.life <= 0 || m.x > this.w || m.y > this.h) {
        this.meteors.splice(i, 1);
        continue;
      }

      const grad = this.ctx.createLinearGradient(
        m.x, m.y,
        m.x - Math.cos(m.angle) * m.len,
        m.y - Math.sin(m.angle) * m.len
      );
      if (light) {
        grad.addColorStop(0, `rgba(60, 80, 140, ${m.life})`);
        grad.addColorStop(0.3, `rgba(90, 110, 180, ${m.life * 0.6})`);
        grad.addColorStop(1, "rgba(90, 110, 180, 0)");
      } else {
        grad.addColorStop(0, `rgba(255, 255, 255, ${m.life})`);
        grad.addColorStop(0.3, `rgba(148, 190, 255, ${m.life * 0.7})`);
        grad.addColorStop(1, "rgba(148, 190, 255, 0)");
      }

      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = 1.6;
      this.ctx.beginPath();
      this.ctx.moveTo(m.x, m.y);
      this.ctx.lineTo(m.x - Math.cos(m.angle) * m.len, m.y - Math.sin(m.angle) * m.len);
      this.ctx.stroke();
    }
  }

  /* Nordlys is named for one thing the sky does with ice; this is the other.
     A 22-degree halo has a hard inner rim and a diffuse outer falloff, so the
     ring is one arc stroked with a radial gradient rather than the three
     concentric outlines that used to stand here — those read as an interface
     element, not as weather. Moondogs sit level with the moon, a pillar rises
     through it, and the 46-degree ring is here for scale even though most of it
     never reaches the screen. */
  renderHalo() {
    const ctx = this.ctx;
    const light = this.lightMode;
    const unit = Math.min(this.w, this.h);
    /* High and to the right, where the page keeps nothing. The clock owns the
       top centre and the board owns the middle band; a moon that lands on
       either stops reading as sky and starts reading as a control. */
    const cx = this.w * 0.775 + Math.sin(this.t * 0.16) * unit * 0.009;
    const cy = this.h * 0.24 + Math.cos(this.t * 0.13) * unit * 0.007;
    /* The ring breathes by half a percent: enough that a long look never
       settles, small enough that a glance never catches it moving. */
    const radius = unit * (0.19 + Math.sin(this.t * 0.09) * 0.003);
    const band = unit * 0.034;
    /* Tonight's moon. A halo is moonlight refracted, so a thin crescent makes a
       fainter one; it keeps a floor, because this is still the Halo sky. */
    const moonNow = this.moonTonight();
    const glare = (light ? 0.55 : 1) * (0.55 + 0.45 * moonNow.illumination);

    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";

    // Moonlit sky, tight enough that the rest of the page stays dark.
    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.8);
    wash.addColorStop(0, this.rgba(1, 0.12 * glare));
    wash.addColorStop(0.4, this.rgba(2, 0.04 * glare));
    wash.addColorStop(1, this.rgba(2, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, this.w, this.h);

    // The brightest stars show through thin cloud; none survive near the moon.
    this.renderStars({ share: 0.5, glare: { x: cx, y: cy, r: radius * 1.5 } });

    /* A halo needs a veil of cirrostratus to form in, and the veil is what the
       moonlight is actually lighting: a few long, flat streaks drifting slowly
       across the display. Without them the rings hang in empty space. */
    for (let i = 0; i < 5; i++) {
      // Wraps well outside the frame at both ends, so no streak ever pops in.
      const drift = ((this.t * 0.012 * (1 + i * 0.3) + i * 0.41) % 2.1) - 0.55;
      this.drawShaft(this.w * drift + (cx - this.w * 0.5) * 0.4, cy + (i - 2) * radius * 0.62,
        radius * (2.2 + (i % 3) * 0.5), 1, 0.14 + (i % 2) * 0.06, 1 + (i % 2), (0.075 - Math.abs(i - 2) * 0.012) * glare);
    }

    // The 46-degree ring: mostly off-frame, and the reason the sky feels big.
    this.strokeHaloRing(cx, cy, radius * 2.06, band * 1.3, 2, 0.06 * glare);

    // The 22-degree ring itself.
    this.strokeHaloRing(cx, cy, radius, band, 0, 0.36 * glare);

    /* The upper tangent arc — brighter, and the one part of the halo that is
       not a circle. Without it the composition is a ring; with it, it is a
       specific evening. */
    ctx.lineCap = "round";
    for (const arc of [{ r: 1.012, w: 0.5, a: 0.24 }, { r: 1.055, w: 0.22, a: 0.1 }]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * arc.r, -Math.PI * 0.74, -Math.PI * 0.26);
      ctx.strokeStyle = this.rgba(0, arc.a * glare);
      ctx.lineWidth = band * arc.w;
      ctx.stroke();
    }
    ctx.lineCap = "butt";

    /* Moondogs: level with the moon, just outside the ring, always exactly two.
       Each is dispersed — its own colour on the side facing the moon, the next
       one out — and trails a tail away from the moon along the parhelic
       circle. A tail through the moon itself would cross the ring and turn the
       display into a gunsight; the tails only ever point outward. */
    for (const side of [-1, 1]) {
      const dog = cx + side * radius * 1.04;
      /* The tail facing the page centre is kept short, because the clock and
         the greeting sit level with the moon on that side. */
      const tail = radius * (side * (this.w * 0.5 - cx) > 0 ? 0.34 : 0.72);
      this.drawShaft(dog + side * tail * 0.86, cy, tail, 1, 0.045 * (radius * 0.72 / tail), 1, 0.15 * glare);
      this.drawShaft(dog, cy, band * 1.7, 0.62, 1, 0, 0.42 * glare);
      this.drawShaft(dog + side * band * 0.9, cy, band * 1.9, 0.7, 0.9, 2, 0.2 * glare);
    }

    // A short, soft column over the moon, not a line through it.
    this.drawShaft(cx, cy, radius * 0.75, 0.2, 1, 0, 0.1 * glare);

    // The moon: a bloom with a core, never a disc with an edge.
    const moon = unit * 0.015;
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, moon * 11);
    bloom.addColorStop(0, this.rgba(0, 0.4 * glare));
    bloom.addColorStop(0.14, this.rgba(0, 0.13 * glare));
    bloom.addColorStop(1, this.rgba(1, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - moon * 11, cy - moon * 11, moon * 22, moon * 22);
    const core = light ? this.paletteRgb[2] : [242, 248, 255];
    // Earthshine: the dark of the disc, just visible, so a crescent is a moon.
    ctx.beginPath();
    ctx.arc(cx, cy, moon * 0.96, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${core.join(", ")}, ${light ? 0.12 : 0.1})`;
    ctx.fill();
    const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, moon);
    disc.addColorStop(0, `rgba(${core.join(", ")}, ${light ? 0.6 : 0.9})`);
    disc.addColorStop(0.8, `rgba(${core.join(", ")}, ${light ? 0.48 : 0.72})`);
    disc.addColorStop(1, `rgba(${core.join(", ")}, ${light ? 0.2 : 0.3})`);
    ctx.fillStyle = disc;
    this.traceMoon(cx, cy, moon, moonNow);
    ctx.fill();

    ctx.restore();
  }

  /* The moon as the sky has it tonight, or held full when the real sky is off.
     The southern hemisphere sees the lit side mirrored; the time zone is the
     only hint of which half someone is in, and it is the only one asked for. */
  moonTonight() {
    if (!this.realSky || !window.NordlysSky) return { phase: 0.5, illumination: 1, waxing: false, south: false };
    const minute = Math.floor(this.now().getTime() / 60000);
    if (this.moonCache?.minute !== minute) {
      this.moonCache = { minute, ...window.NordlysSky.moonPhase(this.now()), south: NordlysBackgroundEngine.southern() };
    }
    return this.moonCache;
  }

  static southern() {
    let zone;
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return false; }
    return /^(Australia|Antarctica)\/|^America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Punta_Arenas)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka|Maseru|Mbabane|Blantyre|Lubumbashi)|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Noumea|Efate)|^Indian\/(Mauritius|Reunion|Antananarivo)|^Atlantic\/Stanley/.test(zone);
  }

  /* The lit part of the disc: the bright limb as a half circle, closed by the
     terminator, a half ellipse as wide as the cosine of the phase — bulging
     towards the limb for a crescent and away from it for a gibbous moon. */
  traceMoon(cx, cy, r, { phase, south }) {
    const ctx = this.ctx;
    const k = Math.cos(2 * Math.PI * phase);
    // Seen from the north, the waxing moon is lit on the right.
    const right = (phase < 0.5) !== Boolean(south);
    const crescent = k > 0;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !right);
    ctx.ellipse(cx, cy, Math.max(0.001, Math.abs(k) * r), r, 0, Math.PI / 2, -Math.PI / 2, right === crescent);
    ctx.closePath();
  }

  /* A shaft of light: a radial gradient squashed on one axis. Softer at both
     ends than a rectangle with a gradient, and one fill either way. */
  drawShaft(cx, cy, reach, sx, sy, tone, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    const shaft = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
    shaft.addColorStop(0, this.rgba(tone, alpha));
    shaft.addColorStop(0.32, this.rgba(tone, alpha * 0.34));
    shaft.addColorStop(1, this.rgba(tone, 0));
    ctx.fillStyle = shaft;
    ctx.fillRect(-reach, -reach, reach * 2, reach * 2);
    ctx.restore();
  }

  /* One halo ring. The gradient is what makes it read as ice rather than as a
     drawn circle: it peaks on the inner edge and trails outward, which is the
     way refraction through hexagonal crystals actually falls off, and it walks
     through the palette on the way so the rim is dispersed rather than flat. */
  strokeHaloRing(cx, cy, radius, band, tone, alpha) {
    const ctx = this.ctx;
    const ring = ctx.createRadialGradient(cx, cy, Math.max(0, radius - band), cx, cy, radius + band * 2);
    ring.addColorStop(0, this.rgba(tone, 0));
    ring.addColorStop(0.28, this.rgba(tone, alpha));
    ring.addColorStop(0.42, this.rgba(tone + 1, alpha * 0.62));
    ring.addColorStop(0.62, this.rgba(tone + 2, alpha * 0.26));
    ring.addColorStop(1, this.rgba(tone + 2, 0));
    ctx.strokeStyle = ring;
    ctx.lineWidth = band * 2.8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* Filaments traced through a slow vector field. Every other scene here is
     drawn from an equation of x; this one is drawn by walking, so the shapes
     bend back on themselves in ways a sine wave cannot, and the field turns
     under them rather than sliding past. */
  initSilk() {
    this.silk = [];
    if (!this.w) return;
    const columns = 6;
    const rows = Math.max(6, Math.min(11, Math.round(this.h / 96)));
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        // One thread in seven is a lead: wider and brighter, so the weave has
        // a few strands the eye can follow instead of an even hatching.
        const lead = this.random() < 0.15;
        this.silk.push({
          // Seeded from beyond the left edge, so filaments arrive from outside
          // the frame instead of starting in the middle of it.
          x: -0.2 + (column / (columns - 1)) * 1.15 + (this.random() - 0.5) * 0.1,
          y: (row + 0.5) / rows + (this.random() - 0.5) * 0.06,
          steps: 34 + Math.floor(this.random() * 24),
          width: lead ? 1.9 + this.random() * 0.9 : 0.7 + this.random() * 1.1,
          alpha: lead ? 0.3 + this.random() * 0.08 : 0.1 + this.random() * 0.12,
          tone: Math.floor(this.random() * 3),
          swirl: this.random() * Math.PI * 2
        });
      }
    }
  }

  /* Three sine terms, not noise: a gradient-noise field would need a table and
     an interpolation per step, and at this scale nobody can tell the two apart
     — but everybody can tell a dropped frame. */
  silkAngle(x, y, swirl) {
    const nx = x / this.w;
    const ny = y / this.h;
    return (Math.sin(nx * 2.7 + this.t * 0.26 + swirl * 0.08) * 1.15
      + Math.cos(ny * 3.4 - this.t * 0.19) * 0.95
      + Math.sin((nx * 1.7 - ny * 2.2) * 2.1 + this.t * 0.12) * 0.55) * 0.62;
  }

  renderSilk() {
    const ctx = this.ctx;
    const light = this.lightMode;
    const unit = Math.min(this.w, this.h);
    const step = unit * 0.034;

    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const shade = light ? 0.8 : 1;
    const points = [];
    for (const thread of this.silk) {
      let x = thread.x * this.w;
      let y = thread.y * this.h;
      points.length = 0;
      points.push(x, y);
      for (let i = 0; i < thread.steps; i++) {
        const angle = this.silkAngle(x, y, thread.swirl);
        x += Math.cos(angle) * step;
        y += Math.sin(angle) * step;
        points.push(x, y);
      }
      /* The colour travels along the strand rather than across the weave, and
         both ends fade to nothing: a thread with a visible start is a line
         somebody drew, a thread that arrives out of the dark is silk. */
      const strand = ctx.createLinearGradient(points[0], points[1], x, y);
      const a = thread.alpha * shade;
      strand.addColorStop(0, this.rgba(thread.tone, 0));
      strand.addColorStop(0.22, this.rgba(thread.tone, a));
      strand.addColorStop(0.62, this.rgba(thread.tone + 1, a * 0.9));
      strand.addColorStop(1, this.rgba(thread.tone + 2, 0));
      ctx.strokeStyle = strand;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      // Bloom underneath, core on top: the same two passes the curtains use.
      for (const pass of NORDLYS_SILK_PASSES) {
        ctx.globalAlpha = pass.alpha * this.ink;
        ctx.lineWidth = thread.width * pass.width;
        ctx.stroke();
      }
    }

    /* The sheen: a broad band of light sweeping slowly across the cloth. It is
       painted "atop", so it lands only where there is already thread — which
       is what fabric does, and what a gradient over the whole page cannot. */
    const sweep = ((this.t * 0.05) % 1.8) - 0.4;
    const bx = this.w * sweep;
    const sheen = ctx.createLinearGradient(bx - unit * 0.55, 0, bx + unit * 0.55, this.h * 0.35);
    const lit = light ? this.rgba(0, 0.5) : "rgba(244, 249, 255, 0.55)";
    sheen.addColorStop(0, this.rgba(0, 0));
    sheen.addColorStop(0.5, lit);
    sheen.addColorStop(1, this.rgba(0, 0));
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = this.ink;
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, this.w, this.h);

    // The field the weave hangs in front of, lit from one corner, laid behind.
    const depth = ctx.createLinearGradient(0, this.h, this.w, 0);
    depth.addColorStop(0, this.rgba(2, light ? 0.07 : 0.12));
    depth.addColorStop(0.5, this.rgba(1, light ? 0.035 : 0.06));
    depth.addColorStop(1, this.rgba(0, light ? 0.02 : 0.035));
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  /* Rime on the inside of a window. It is anchored to the edges and grows
     inward, so the middle of the page — where the clock and the board live —
     stays clear of it by construction rather than by luck. */
  initFrost() {
    this.frost = [];
    this.frostTips = [];
    this.frostPatches = [];
    if (!this.w) return;
    const up = -Math.PI / 2;
    const down = Math.PI / 2;
    const quarter = Math.PI / 4;
    /* Corners first and largest, because that is where glass is coldest and
       where frost actually starts; then smaller growths along the edges. The
       top centre is left bare on purpose: that is where the clock sits. */
    const anchors = [
      { x: 0, y: 0, a: quarter, s: 1.15, fronds: 3 }, { x: 1, y: 0, a: Math.PI - quarter, s: 1, fronds: 3 },
      { x: 0, y: 1, a: -quarter, s: 1.25, fronds: 3 }, { x: 1, y: 1, a: -Math.PI + quarter, s: 1.15, fronds: 3 },
      { x: 0.21, y: 0, a: down, s: 0.6, fronds: 2 }, { x: 0.79, y: 0, a: down, s: 0.56, fronds: 2 },
      { x: 0.32, y: 1, a: up, s: 0.78, fronds: 2 }, { x: 0.53, y: 1, a: up, s: 0.64, fronds: 2 }, { x: 0.73, y: 1, a: up, s: 0.74, fronds: 2 },
      { x: 0, y: 0.47, a: 0, s: 0.7, fronds: 2 }, { x: 1, y: 0.53, a: Math.PI, s: 0.68, fronds: 2 }
    ];
    const unit = Math.min(this.w, this.h);
    for (const anchor of anchors) {
      const crystal = this.frostPatches.length;
      const x = anchor.x * this.w;
      const y = anchor.y * this.h;
      const reach = unit * 0.3 * anchor.s;
      // Fronds fan out from one root, the longest down the middle.
      for (let frond = 0; frond < anchor.fronds; frond++) {
        const spread = anchor.fronds === 1 ? 0 : (frond / (anchor.fronds - 1) - 0.5) * 1.05;
        const length = reach * (1 - Math.abs(spread) * 0.42) * (0.82 + this.random() * 0.3);
        // Each frond leans one way; a straight one reads as a stick.
        const bend = (spread === 0 ? (this.random() < 0.5 ? -1 : 1) : Math.sign(spread)) * (0.006 + this.random() * 0.012);
        this.growFrost(x, y, anchor.a + spread + (this.random() - 0.5) * 0.18, length, 0, 0, bend, crystal);
      }
      this.frostPatches.push({ x, y, r: reach * 1.1, phase: crystal * 0.83 });
    }
  }

  /* One frond, grown the way fern frost grows: a stem with short barbs leaning
     forward off both sides, the barbs shortening towards the tip, and now and
     then a smaller frond branching off to do the same. Dense short barbs are
     what separates a frost feather from a web; long sparse branches were the
     first attempt, and they read as cobweb.

     `order` records how far along the growth a segment sits, which lets the
     render soften the growing edge without rebuilding anything per frame, and
     `weight` tapers the stroke from the root to the tip. */
  growFrost(x, y, angle, length, depth, order, bend, crystal) {
    if (depth > 1 || length < 14) return;
    const nodes = depth === 0 ? 24 : 13;
    const stride = length / nodes;
    const stem = depth === 0 ? 1 : 0.55;
    const barbReach = length * (depth === 0 ? 0.13 : 0.18);
    // Side fronds leave the main stem at a few nodes, alternating sides.
    const offshoots = depth === 0 ? new Map([[6, -1], [10, 1], [14, -1], [17, 1]]) : new Map();
    let px = x;
    let py = y;
    let heading = angle;
    for (let node = 0; node < nodes; node++) {
      heading += bend + (this.random() - 0.5) * 0.05;
      const nx = px + Math.cos(heading) * stride;
      const ny = py + Math.sin(heading) * stride;
      const along = (node + 1) / nodes;
      const at = Math.min(1, order + along * (depth === 0 ? 1 : 0.3));
      this.frost.push({ x1: px, y1: py, x2: nx, y2: ny, order: at, weight: (1 - along * 0.7) * stem, crystal });
      if (node > 1) {
        const barb = barbReach * Math.pow(1 - along, 0.65) * (0.75 + this.random() * 0.5);
        for (const side of [-1, 1]) {
          const lean = heading + side * (0.92 + (this.random() - 0.5) * 0.12);
          const bx = nx + Math.cos(lean) * barb;
          const by = ny + Math.sin(lean) * barb;
          this.frost.push({ x1: nx, y1: ny, x2: bx, y2: by, order: at, weight: 0.2 * (1 - along * 0.5) * stem, crystal });
          if (depth === 0 && node % 5 === 3 && side === 1) {
            this.frostTips.push({ x: bx, y: by, order: at, crystal, phase: this.frostTips.length * 2.39 });
          }
        }
      }
      const side = offshoots.get(node);
      if (side) this.growFrost(nx, ny, heading + side * 0.95, length * 0.46 * (1 - along * 0.6), depth + 1, at, bend * 0.8, crystal);
      px = nx;
      py = ny;
    }
  }

  renderFrost() {
    const ctx = this.ctx;
    const light = this.lightMode;
    const unit = Math.min(this.w, this.h);

    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    ctx.lineCap = "round";

    // Cold gathering at the edges, where the crystals are.
    const chill = ctx.createRadialGradient(
      this.w * 0.5, this.h * 0.5, unit * 0.34,
      this.w * 0.5, this.h * 0.5, unit * 1.08);
    chill.addColorStop(0, this.rgba(1, 0));
    chill.addColorStop(1, this.rgba(1, light ? 0.07 : 0.12));
    ctx.fillStyle = chill;
    ctx.fillRect(0, 0, this.w, this.h);

    /* Each crystal grows out of a patch of fogged glass, and the patch is what
       makes the needles read as ice on a pane instead of lines on a page. */
    for (const patch of this.frostPatches) {
      const fog = ctx.createRadialGradient(patch.x, patch.y, 0, patch.x, patch.y, patch.r);
      fog.addColorStop(0, this.rgba(1, light ? 0.06 : 0.1));
      fog.addColorStop(0.55, this.rgba(2, light ? 0.025 : 0.04));
      fog.addColorStop(1, this.rgba(2, 0));
      ctx.fillStyle = fog;
      ctx.fillRect(patch.x - patch.r, patch.y - patch.r, patch.r * 2, patch.r * 2);
    }

    /* Every crystal breathes at its outer edge rather than appearing and
       vanishing: at rest this frame has to be a whole picture, not a half-drawn
       one. */
    const grown = this.frostPatches.map(patch => 0.9 + Math.sin(this.t * 0.17 + patch.phase) * 0.1);

    /* Segments are stroked in batches that share a width and an alpha — four
       weights by four stages of growth. Sixteen paths a frame instead of one
       per segment, which is roughly three thousand. */
    const batches = Array.from({ length: 16 }, () => []);
    for (const segment of this.frost) {
      const reach = (grown[segment.crystal] - segment.order) / 0.16;
      if (reach <= 0) continue;
      const stage = Math.min(3, Math.floor(Math.min(1, reach) * 4));
      const weight = segment.weight > 0.62 ? 0 : segment.weight > 0.34 ? 1 : segment.weight > 0.17 ? 2 : 3;
      batches[weight * 4 + stage].push(segment);
    }
    /* Ice is pale. On a dark pane the stems are the palette's first colour
       taken most of the way to white, so a warm mood still reads as frost and
       not as a drawing in orange; the finest barbs keep more of the hue. On a
       light pane white would vanish, so there the palette stands as it is. */
    const inks = [0.62, 0.45, 0.3, 0.18].map((pale, weight) => {
      const [r, g, b] = this.paletteRgb[weight === 0 ? 0 : weight === 3 ? 2 : 1];
      const lift = light ? 0 : pale;
      return `rgb(${Math.round(r + (255 - r) * lift)}, ${Math.round(g + (255 - g) * lift)}, ${Math.round(b + (255 - b) * lift)})`;
    });
    for (let slot = 0; slot < batches.length; slot++) {
      const group = batches[slot];
      if (!group.length) continue;
      const weight = Math.floor(slot / 4);
      const stage = slot % 4;
      ctx.beginPath();
      for (const segment of group) {
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(segment.x2, segment.y2);
      }
      ctx.strokeStyle = inks[weight];
      const alpha = (light ? 0.26 : 0.36) * ((stage + 1) / 4) * (1 - weight * 0.12) * this.ink;
      // The two heaviest weights carry a soft bloom, which is the cold glow.
      if (weight < 2) {
        ctx.globalAlpha = alpha * 0.22;
        ctx.lineWidth = [7, 4.5][weight];
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = [2, 1.35, 0.9, 0.65][weight];
      ctx.stroke();
    }

    /* Glints where a barb catches the light: a four-point sparkle, never a
       round drop — round drops on fine lines were the other half of what made
       the first attempt read as dew on a web. Each on its own slow phase, so
       the pane sparkles here and there instead of all over. */
    ctx.globalAlpha = this.ink;
    for (const tip of this.frostTips) {
      if (grown[tip.crystal] < tip.order) continue;
      const shine = Math.max(0, Math.sin(this.t * 1.1 + tip.phase)) ** 4;
      if (shine < 0.06) continue;
      const reach = 3 + shine * 7;
      this.drawShaft(tip.x, tip.y, reach, 1, 0.12, 0, (light ? 0.3 : 0.55) * shine);
      this.drawShaft(tip.x, tip.y, reach, 0.12, 1, 0, (light ? 0.3 : 0.55) * shine);
    }
    ctx.restore();
  }

  /* Slow contour cloth. The parallel paths read as material rather than as a
     cloud of decorative particles, and are cheap enough to redraw at 60fps. */
  /* ── Contour: a topographic map ─────────────────────────────────────
     A few hills and hollows scattered from the seed, each wandering a slow
     small circle, and the contour lines of the ground they make: closed rings
     tightening towards every summit, the way a survey map draws a fjord's
     mountains. Every fifth line is an index contour, heavier and brighter, so
     the eye reads height at a glance; the lines take the mood's colours by
     elevation, low ground in its third colour and the peaks in its first.

     It used to be nine sine waves across the page at an eighth of an opacity —
     a paler Silk that all but vanished on a dark theme. A map is a different
     kind of picture from threads: closed lines instead of open ones, height
     instead of flow. */
  initTerrain() {
    this.terrain = [];
    this.contours = null;
    // Its own stream from the seed: the map is the same map wherever it is
    // first drawn, and the stars and threads scattered before it stay put.
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x27d4eb2d) >>> 0);
    for (let i = 0; i < 7; i++) {
      let x = random();
      const y = random();
      // Summits keep out from behind the clock, where rings would crowd the words.
      if (Math.abs(x - 0.5) < 0.2 && y < 0.36) x += x < 0.5 ? -0.24 : 0.24;
      this.terrain.push({
        x, y,
        r: 0.13 + random() * 0.2,
        h: (random() < 0.3 ? -0.65 : 1) * (0.6 + random() * 0.55),
        orbit: 0.015 + random() * 0.035,
        speed: 0.14 + random() * 0.22,
        phase: random() * Math.PI * 2
      });
    }
  }

  /* The contour lines of the ground at time t, one Path2D per level, by
     marching squares over a grid about ninety cells across. */
  traceTerrain(t) {
    const size = Math.max(this.w, this.h);
    const hills = this.terrain.map((hill) => ({
      x: (hill.x + Math.cos(t * hill.speed + hill.phase) * hill.orbit) * this.w,
      y: (hill.y + Math.sin(t * hill.speed * 0.8 + hill.phase) * hill.orbit) * this.h,
      k: 1 / (hill.r * size) ** 2,
      h: hill.h
    }));
    const cell = Math.max(8, Math.round(Math.sqrt((this.w * this.h) / 9000)));
    const cols = Math.ceil(this.w / cell) + 3;
    const rows = Math.ceil(this.h / cell) + 3;
    const field = new Float32Array(cols * rows);
    let low = Infinity, high = -Infinity;
    for (let j = 0; j < rows; j++) {
      const py = (j - 1) * cell;
      for (let i = 0; i < cols; i++) {
        const px = (i - 1) * cell;
        let z = 0.16 * Math.sin((px / size) * 5.1 + t * 0.06) * Math.cos((py / size) * 4.3 - t * 0.045);
        for (const hill of hills) {
          const dx = px - hill.x, dy = py - hill.y;
          z += hill.h * Math.exp(-(dx * dx + dy * dy) * hill.k);
        }
        field[j * cols + i] = z;
        if (z < low) low = z;
        if (z > high) high = z;
      }
    }
    const step = 0.085;
    const levels = [];
    for (let level = Math.ceil(low / step); level <= Math.floor(high / step); level++) {
      const v = level * step;
      const path = new Path2D();
      const at = (a, b) => (v - a) / (b - a || 1e-6);
      for (let j = 0; j < rows - 1; j++) {
        const y0 = (j - 1) * cell;
        for (let i = 0; i < cols - 1; i++) {
          const tl = field[j * cols + i], tr = field[j * cols + i + 1];
          const bl = field[(j + 1) * cols + i], br = field[(j + 1) * cols + i + 1];
          const code = (tl > v ? 8 : 0) | (tr > v ? 4 : 0) | (br > v ? 2 : 0) | (bl > v ? 1 : 0);
          if (code === 0 || code === 15) continue;
          const x0 = (i - 1) * cell;
          const T = () => [x0 + cell * at(tl, tr), y0];
          const R = () => [x0 + cell, y0 + cell * at(tr, br)];
          const B = () => [x0 + cell * at(bl, br), y0 + cell];
          const L = () => [x0, y0 + cell * at(tl, bl)];
          const segment = (a, b) => { path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]); };
          switch (code) {
            case 1: case 14: segment(L(), B()); break;
            case 2: case 13: segment(B(), R()); break;
            case 3: case 12: segment(L(), R()); break;
            case 4: case 11: segment(T(), R()); break;
            case 6: case 9: segment(T(), B()); break;
            case 7: case 8: segment(T(), L()); break;
            case 5: case 10: {
              // A saddle: which pair of corners the middle belongs with.
              const middle = (tl + tr + br + bl) / 4 > v;
              if ((code === 5) === middle) { segment(T(), L()); segment(B(), R()); }
              else { segment(T(), R()); segment(L(), B()); }
              break;
            }
          }
        }
      }
      levels.push({ level, v, path });
    }
    return { levels, low, high, hills };
  }

  renderDrift() {
    const light = this.lightMode;
    const ctx = this.ctx;
    if (!this.terrain?.length) this.initTerrain();
    if (!this.w || !this.h) return;
    // The ground moves slowly; its lines are traced again only as it does.
    if (!this.contours || Math.abs(this.contours.t - this.t) > 0.03 || this.contours.w !== this.w || this.contours.h !== this.h || this.contours.terrain !== this.terrain) {
      this.contours = { t: this.t, w: this.w, h: this.h, terrain: this.terrain, ...this.traceTerrain(this.t) };
    }
    const { levels, low, high, hills } = this.contours;
    const [c1, c2, c3] = this.paletteRgb;
    const mix = (a, b, k) => a.map((value, index) => Math.round(value + (b[index] - value) * k));
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    // A faint light on each summit, so the rings have something to rise to.
    const size = Math.max(this.w, this.h);
    this.terrain.forEach((hill, index) => {
      if (hill.h <= 0) return;
      const at = hills[index];
      const reach = hill.r * size * 1.1;
      const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, reach);
      glow.addColorStop(0, `rgba(${c1.join(", ")}, ${(light ? 0.05 : 0.08) * hill.h})`);
      glow.addColorStop(1, `rgba(${c1.join(", ")}, 0)`);
      ctx.fillStyle = glow;
      ctx.globalAlpha = this.ink;
      ctx.fillRect(at.x - reach, at.y - reach, reach * 2, reach * 2);
    });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const { level, v, path } of levels) {
      const height = (v - low) / (high - low || 1);
      const tone = height < 0.5 ? mix(c3, c2, height * 2) : mix(c2, c1, (height - 0.5) * 2);
      const index = level % 5 === 0;
      ctx.strokeStyle = `rgb(${tone.join(", ")})`;
      ctx.lineWidth = index ? 1.6 : 1;
      ctx.globalAlpha = (index ? (light ? 0.3 : 0.5) : (light ? 0.15 : 0.26)) * this.ink;
      ctx.stroke(path);
    }
    ctx.restore();
  }

  /* A low luminous horizon keeps the centre calm for the clock and search.
     Its movement is only a slow breath, making it the least animated scene. */
  renderHorizon() {
    const light = this.lightMode;
    const [c1, c2, c3] = this.palette;
    const y = this.h * (0.8 + Math.sin(this.t * 0.22) * 0.012);
    this.ctx.save();
    this.ctx.globalCompositeOperation = light ? "multiply" : "screen";
    const glow = this.ctx.createRadialGradient(this.w * 0.5, y, 0, this.w * 0.5, y, Math.max(this.w, this.h) * 0.72);
    glow.addColorStop(0, `${c1}${light ? "2b" : "40"}`);
    glow.addColorStop(0.28, `${c2}${light ? "1c" : "2c"}`);
    glow.addColorStop(0.62, `${c3}${light ? "0d" : "15"}`);
    glow.addColorStop(1, `${c3}00`);
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, this.w, this.h);
    const line = this.ctx.createLinearGradient(0, 0, this.w, 0);
    line.addColorStop(0, `${c3}00`);
    line.addColorStop(0.5, `${c1}${light ? "25" : "45"}`);
    line.addColorStop(1, `${c2}00`);
    this.ctx.strokeStyle = line;
    this.ctx.globalAlpha = 0.55 * this.ink;
    this.ctx.beginPath();
    this.ctx.moveTo(this.w * 0.08, y);
    this.ctx.lineTo(this.w * 0.92, y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawRibbon(baseYFactor, colorHex, baseAlpha, freq, speed, spread = 1) {
    const light = this.lightMode;
    const cy = this.h * baseYFactor;
    this.ctx.save();
    this.ctx.globalCompositeOperation = light ? "multiply" : "screen";

    const grad = this.ctx.createLinearGradient(0, cy - 130 * spread, 0, cy + 160 * spread);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.35, colorHex);
    grad.addColorStop(0.65, colorHex);
    grad.addColorStop(1, "transparent");

    this.ctx.fillStyle = grad;
    // Curtains gently "breathe" so the sky never feels static
    const alphaMultiplier = light ? 0.8 : 1;
    this.ctx.globalAlpha = baseAlpha * alphaMultiplier * (0.85 + Math.sin(this.t * 0.9 + baseYFactor * 8) * 0.15) * this.ink;

    this.ctx.beginPath();
    this.ctx.moveTo(0, this.h);

    const step = 24;
    const limit = this.w + step;
    for (let x = 0; x <= limit; x += step) {
      const wave1 = Math.sin((x * 0.002 * freq) + (this.t * speed)) * 50 * spread;
      const wave2 = Math.cos((x * 0.004 * freq) - (this.t * speed * 0.7)) * 25 * spread;
      const wave3 = Math.sin((x * 0.011 * freq) + (this.t * speed * 1.6)) * 6;
      const y = cy + wave1 + wave2 + wave3;
      this.ctx.lineTo(x, y);
    }

    this.ctx.lineTo(this.w, this.h);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }


}

/* ── IndexedDB Media Vault ─────────────────────────────────────── */
const MediaVault = {
  DB_NAME: "Nordlys_MediaVault",
  LEGACY_DB_NAME: "AuroraTab_MediaVault",
  STORE: "wallpapers",

  /* A database cannot be renamed, only copied. The first open after the rename
     looks for the old one, moves every record across and deletes it, so a
     wallpaper someone chose under the previous build is still theirs. Memoised,
     because open() is called from several places at startup and the move must
     happen once. */
  adoptLegacy() {
    if (this._adopting) return this._adopting;
    this._adopting = (async () => {
      try {
        if (typeof indexedDB.databases !== "function") return;
        const names = (await indexedDB.databases()).map((entry) => entry.name);
        if (!names.includes(this.LEGACY_DB_NAME)) return;
        const legacy = await this.openNamed(this.LEGACY_DB_NAME);
        const records = await new Promise((resolve, reject) => {
          if (!legacy.objectStoreNames.contains(this.STORE)) return resolve([]);
          const request = legacy.transaction(this.STORE, "readonly").objectStore(this.STORE).getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });
        legacy.close();
        if (records.length) {
          const db = await this.openNamed(this.DB_NAME);
          await new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE, "readwrite");
            const store = tx.objectStore(this.STORE);
            for (const record of records) {
              /* add(), not put(). If a first attempt at this move failed part
                 way and the user has since chosen a wallpaper, the new database
                 holds the newer record and the old one must lose. add() refuses
                 a duplicate key; the refusal is swallowed per record so the
                 transaction carries on with the rest. */
              const request = store.add(record);
              request.onerror = (event) => { event.preventDefault(); event.stopPropagation(); };
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          db.close();
        }
        await new Promise((resolve) => {
          const request = indexedDB.deleteDatabase(this.LEGACY_DB_NAME);
          request.onsuccess = request.onerror = request.onblocked = () => resolve();
        });
      } catch (error) {
        /* The old database stays where it was; the new one starts empty. */
      }
    })();
    return this._adopting;
  },

  async open() {
    await this.adoptLegacy();
    return this.openNamed(this.DB_NAME);
  },

  openNamed(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveMedia(id, blob, type) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readwrite");
      tx.objectStore(this.STORE).put({ id, blob, type, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getMedia(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readonly");
      const req = tx.objectStore(this.STORE).get(id);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteMedia(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, "readwrite");
      tx.objectStore(this.STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
