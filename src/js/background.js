/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - BACKGROUND SCENES & VISUAL ENGINE
   Time-based (refresh-rate independent), light/dark aware, zero idle cost.
   ═══════════════════════════════════════════════════════════════════ */

/* The scenes the canvas draws itself. Named once, here: app.js decides whether
   to start the engine and settings.js decides which controls apply, and all
   three used to keep their own copy of this list — so adding a composition
   meant finding three places and the third one was always the one missed. */
const NORDLYS_GENERATIVE_SCENES = new Set(["aurora", "polaris", "halo", "pillars", "nacre", "silk", "baikal", "drift", "horizon"]);
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
const NORDLYS_REST_PHASE = { aurora: 12, polaris: 20, halo: 7.4, pillars: 9, nacre: 14, silk: 31.7, baikal: 6, drift: 7.4, horizon: 7.4 };
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
// The same passes as the GPU layer draws them: bands across one strip.
const NORDLYS_SILK_BANDS = NORDLYS_SILK_PASSES.map((pass) => [pass.width, pass.alpha]);
/* Polaris: how long the exposure has been open, as an angle of the sky's turn;
   how fast the sky turns, per unit of the scene clock; and each trail's two
   bands, a faint glow either side of a fine core. */
const NORDLYS_POLARIS = { length: 0.5, turn: 0.012, bands: [[3.4, 0.14], [1, 1]] };
// Where Pillars puts its horizon, as a share of the height.
const NORDLYS_HORIZON = 0.8;
/* How a light falls off from its centre, as [offset, share] stops: a soft
   glow; a column of light, held longer than a glint since it is a column;
   a streak of cloud, long and thin; the body of a cloud, full nearly to its edge. */
const NORDLYS_SOFT = [[0, 1], [0.32, 0.34], [1, 0]];
const NORDLYS_PILLAR = [[0, 1], [0.25, 0.86], [0.55, 0.52], [0.8, 0.2], [1, 0]];
const NORDLYS_STREAK = [[0, 1], [0.35, 0.6], [0.7, 0.18], [1, 0]];
const NORDLYS_LOBE = [[0, 1], [0.4, 0.72], [0.75, 0.26], [1, 0]];
// The scenes that are a night thing, and step back further by day.
const NORDLYS_NIGHT_SCENES = new Set(["aurora", "polaris", "pillars"]);

class NordlysBackgroundEngine {
  constructor() {
    this.canvas = document.getElementById("bg-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d", { alpha: true, desynchronized: true }) : null;
    /* The screen's own context. `ctx` is swapped for a small sample while the
       quiet zones are solved, and the GPU layer (skyGL) serves only this one.
       The layer itself is made when a scene first needs it: undefined until
       then, null where there is none. */
    this.screen = this.ctx;
    this.gl = undefined;
    /* The next frame is either a timer sleeping until shortly before it is
       due, or a vsync callback already asked for — never both (see animId). */
    this.frameRequest = null;
    this.frameTimer = null;
    this.frameWakeAt = 0;
    this.frameWakeBudget = 0;
    // The panel's refresh, measured from back-to-back callbacks; 60 Hz until then.
    this.refreshMs = 1000 / 60;
    this.chainedFrom = -Infinity;
    // How late the timer has lately woken, so the lead covers it.
    this.timerSlack = 0;
    this.stars = [];
    this.meteors = [];
    this.nebulae = [];
    this.t = NORDLYS_REST_PHASE.aurora;
    this.ink = 1;
    /* What the sky is scattered from. Zero is the authored composition every
       install starts with; "Shuffle this sky" stores another. The same seed at
       the same size is the same world, so a new tab no longer rearranges the
       stars and the ice. */
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
    this.polaris = [];
    this.pillars = [];
    this.dust = [];
    this.towns = [];
    this.nacre = [];
    this.baikal = null;
    // Baikal's ice, drawn once on the screen and laid down each frame.
    this.iceLayer = null;
    this.terrain = [];
    this.contours = null;
    this.quietZones = [];
    this.quietAlphas = [];
    this.quietSolvedAt = -Infinity;
    this.quietGround = [6, 10, 20];
    // True while the scene is repainted into the quiet sample, not the screen.
    this.solvingQuiet = false;
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
    const present = () => this.noteInput();
    for (const type of ["pointerdown", "keydown", "wheel"]) window.addEventListener(type, present, { passive: true });

    // Throttled High-Frequency Mouse Tracking (rAF-synced CSS vars + particle field)
    window.addEventListener("pointermove", (e) => {
      this.noteInput();
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
    this.initTerrain();
    this.initPolaris();
    this.initPillars();
    this.initNacre();
    this.initBaikal();
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
     scene changed its imitation fell behind: the old frost scene's kept showing
     a sunburst long after the scene had grown fronds. A rendering of the scene
     cannot drift from the scene.

     The composition is laid out on a virtual viewport three times the size of
     the thumbnail and scaled down, so a hairline stays a hairline instead of
     turning into a bar. Each canvas keeps its seeded world, so a new colour
     mood repaints the same stars and bubbles rather than a new scatter. */
  paintStill(canvas, scene, { width = canvas?.clientWidth, height = canvas?.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2), zoom = 3 } = {}) {
    if (!canvas || !NORDLYS_GENERATIVE_SCENES.has(scene)) return false;
    if (!width || !height) return false;
    let still = NORDLYS_STILLS.get(canvas);
    if (!still || still.mode !== scene || still.seed !== this.seed || still.w !== width * zoom || still.h !== height * zoom) {
      still = Object.assign(Object.create(NordlysBackgroundEngine.prototype), {
        canvas, ctx: canvas.getContext("2d"), w: width * zoom, h: height * zoom, mode: scene,
        t: NORDLYS_REST_PHASE[scene], ink: 1, motion: 0, intensity: 1, customPalettes: {}, seed: this.seed, rng: null,
        stars: [], meteors: [], nebulae: [], silk: [], polaris: [], pillars: [], dust: [], towns: [], nacre: [], baikal: null, terrain: [], quietZones: [],
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
    /* The GPU layer lives only as long as the scene that asked for it, so a
       scene without long lines keeps no surface the size of the window; and
       choosing a scene again is how a lost context gets another try. */
    if (changed) {
      this.gl?.release();
      this.gl = undefined;
      this.iceLayer = null;
    }
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
      this.frameRequest = null;
      if (!this.running) return;
      // A callback asked for from the one before lands one refresh later.
      const gap = now - this.chainedFrom;
      if (gap >= 4 && gap <= 50) this.refreshMs = gap;
      this.chainedFrom = -Infinity;
      /* A frame budget. The scenes move a few pixels a second, so painting at
         the panel's rate mostly repaints the same picture, and every painted
         frame makes each glass surface above the canvas blur what is behind it
         again. Thirty a second is smooth for motion this slow; after a minute
         with no input, fifteen. The pace is unchanged, because dt is still the
         real time elapsed. */
      if (now - this.lastFrame < this.frameBudget(now) - 2) {
        this.scheduleFrame(now, true);
        return;
      }
      // dt in 60fps units, capped so a long stall cannot jump the sky ahead.
      const dt = Math.min((now - this.lastFrame) / 16.666, 6);
      this.lastFrame = now;
      this.render(dt);
      /* Nothing in the scene advances at rest, so a second frame would paint
         the same pixels. Holding the last one costs nothing to keep and lets
         every backdrop-filter above it sample a layer that never invalidates. */
      if (this.atRest()) return;
      // Late wakes are remembered for a while, then forgotten, timer or none.
      this.timerSlack *= 0.97;
      this.scheduleFrame(now, true);
    };
    this.wake = () => {
      this.frameTimer = null;
      if (!this.running) return;
      const late = Math.max(0, performance.now() - this.frameWakeAt);
      this.timerSlack = Math.min(Math.max(late, this.timerSlack), 1000 / 30);
      this.frameRequest = requestAnimationFrame(this.loop);
    };
    this.frameRequest = requestAnimationFrame(this.loop);
  }

  frameBudget(now) {
    return now - this.lastInput > NORDLYS_IDLE_AFTER ? 1000 / 15 : 1000 / 30;
  }

  /* Waiting out the budget with a callback every vsync woke the page three
     times in four at 120 Hz to paint nothing. A timer sleeps until shortly
     before the paint is due, and only then is a vsync asked for. The budget
     check in the loop still picks the vsync that paints, so a timer that wakes
     early costs one empty callback; the lead, half a refresh plus however late
     timers have lately been, keeps one that wakes late from missing it. */
  scheduleFrame(now, fromFrame = false) {
    const budget = this.frameBudget(now);
    const wakeAt = this.lastFrame + budget - 2 - this.refreshMs / 2 - this.timerSlack;
    const delay = wakeAt - performance.now();
    if (delay < 1) {
      if (fromFrame) this.chainedFrom = now;
      this.frameRequest = requestAnimationFrame(this.loop);
      return;
    }
    this.frameWakeAt = wakeAt;
    this.frameWakeBudget = budget;
    this.frameTimer = setTimeout(this.wake, delay);
  }

  /* The frame on its way, whether it is still a timer or already a vsync
     callback; null when the scene is parked or stopped. */
  get animId() {
    return this.frameRequest ?? this.frameTimer ?? null;
  }

  /* Someone is here: the budget goes back up from its idle rate, and a frame
     the idle rate put to sleep is woken for the sooner one. */
  noteInput() {
    this.lastInput = performance.now();
    if (this.frameTimer === null || this.frameWakeBudget <= 1000 / 30) return;
    clearTimeout(this.frameTimer);
    this.frameTimer = null;
    this.scheduleFrame(this.lastInput);
  }

  /* A parked scene has no next frame coming, so anything that changes what the
     frame should look like has to ask for one. */
  repaint() {
    if (this.running && this.ctx && this.animId === null) this.render(0);
  }

  resumeIfMoving() {
    if (!this.running || this.animId !== null || this.atRest()) return;
    this.lastFrame = performance.now();
    this.frameRequest = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
    if (this.frameTimer !== null) clearTimeout(this.frameTimer);
    this.frameRequest = null;
    this.frameTimer = null;
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
    // By day the sky steps back, and the night skies most of all: aurora, stars, pillars of light.
    if (this.sky) this.ink *= 1 - this.sky.day * (NORDLYS_NIGHT_SCENES.has(this.mode) ? 0.45 : 0.18);
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
      case "polaris":
        this.renderPolaris(dt);
        break;
      case "pillars":
        this.renderPillars();
        break;
      case "nacre":
        this.renderNacre();
        break;
      case "baikal":
        this.renderBaikal();
        break;
      case "drift":
        this.renderDrift();
        break;
      case "horizon":
        this.renderHorizon();
        break;
    }
    if (this.sky) this.renderSunlight();
    if (this.quietZones.length && !this.solvingQuiet) this.quieten();
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
    /* Solving repaints a small CPU-backed sample, so it happens once a second
       while the sky moves and once, exactly, when it is held. */
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
    /* Reading pixels from the visible canvas forces Chromium to finish and
       copy its GPU surface back to the CPU. Paint the same scene directly at
       sample size in a CPU-backed canvas instead. A dt of zero leaves the
       phase, the meteors and every cache as they were, so this is the frame
       on screen at a lower resolution, and it takes no quiet zones of its own. */
    const mainCtx = this.ctx;
    try {
      this.ctx = sctx;
      this.solvingQuiet = true;
      sctx.setTransform(sw / this.w, 0, 0, sh / this.h, 0, 0);
      this.render(0);
    } finally {
      this.ctx = mainCtx;
      this.solvingQuiet = false;
    }
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
     ends than a rectangle with a gradient, and one fill either way.  is a
     palette index, or a colour of its own as [r, g, b]. */
  drawShaft(cx, cy, reach, sx, sy, tone, alpha) {
    const ctx = this.ctx;
    const colour = Array.isArray(tone) ? (a) => `rgba(${tone[0]}, ${tone[1]}, ${tone[2]}, ${a})` : (a) => this.rgba(tone, a);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    const shaft = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
    shaft.addColorStop(0, colour(alpha));
    shaft.addColorStop(0.32, colour(alpha * 0.34));
    shaft.addColorStop(1, colour(0));
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

  /* One thread's walk through the field: steps + 1 points into `out`,
     [x0, y0, x1, y1, ...], in CSS pixels. */
  walkSilk(thread, step, out) {
    let x = thread.x * this.w;
    let y = thread.y * this.h;
    out[0] = x;
    out[1] = y;
    for (let i = 0; i < thread.steps; i++) {
      const angle = this.silkAngle(x, y, thread.swirl);
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      out[2 * i + 2] = x;
      out[2 * i + 3] = y;
    }
    return thread.steps + 1;
  }

  /* The GPU line layer (sky-gl.js), for the screen only. A thumbnail and the
     quiet-zone sample are painted in 2D, which is quick at their size; so is
     everything where there is no WebGL2, or once the context is lost. */
  skyGL() {
    if (this.ctx !== this.screen || typeof NordlysSkyGL === "undefined") return null;
    if (this.gl === undefined) this.gl = NordlysSkyGL.create();
    if (this.gl?.lost) this.gl = null;
    return this.gl;
  }

  renderSilk() {
    const ctx = this.ctx;
    const light = this.lightMode;
    const unit = Math.min(this.w, this.h);
    const step = unit * 0.034;
    const shade = light ? 0.8 : 1;
    const gl = this.skyGL();

    ctx.save();
    if (gl) this.weaveSilk(gl, step, shade, light);
    else {
      ctx.globalCompositeOperation = light ? "multiply" : "screen";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const points = [];
      for (const thread of this.silk) {
        const n = this.walkSilk(thread, step, points);
        /* The colour travels along the strand rather than across the weave, and
           both ends fade to nothing: a thread with a visible start is a line
           somebody drew, a thread that arrives out of the dark is silk. */
        const strand = ctx.createLinearGradient(points[0], points[1], points[2 * n - 2], points[2 * n - 1]);
        const a = thread.alpha * shade;
        strand.addColorStop(0, this.rgba(thread.tone, 0));
        strand.addColorStop(0.22, this.rgba(thread.tone, a));
        strand.addColorStop(0.62, this.rgba(thread.tone + 1, a * 0.9));
        strand.addColorStop(1, this.rgba(thread.tone + 2, 0));
        ctx.strokeStyle = strand;
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < n * 2; i += 2) ctx.lineTo(points[i], points[i + 1]);
        // Bloom underneath, core on top: the same two passes the curtains use.
        for (const pass of NORDLYS_SILK_PASSES) {
          ctx.globalAlpha = pass.alpha * this.ink;
          ctx.lineWidth = thread.width * pass.width;
          ctx.stroke();
        }
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

  /* Silk's threads as one strip on the GPU layer: the same walk through the
     field, and each point given the colour the thread's gradient has there.
     The canvas gradient runs straight from a thread's first point to its
     last, so a point takes it where it falls along that line, stop for stop
     as the 2D strokes above are given it. The canvas is still clear when
     Silk paints, so the frame is laid on as it is. */
  weaveSilk(gl, step, shade, light) {
    const scale = this.dpr || 1;
    const counts = this.silk.map((thread) => thread.steps + 1);
    const room = NordlysSkyGL.room(counts) * NORDLYS_GL_FLOATS;
    if (!(this.silkStrip?.length >= room)) this.silkStrip = new Float32Array(room);
    const most = Math.max(0, ...counts) * 2;
    if (!(this.silkPoints?.length >= most)) this.silkPoints = new Float32Array(most);
    const points = this.silkPoints;
    const palette = this.paletteRgb.map((colour) => colour.map((value) => value / 255));
    let at = 0;
    for (const thread of this.silk) {
      const n = this.walkSilk(thread, step, points);
      const x0 = points[0];
      const y0 = points[1];
      const gx = points[2 * n - 2] - x0;
      const gy = points[2 * n - 1] - y0;
      const along = gx * gx + gy * gy || 1;
      const a = thread.alpha * shade;
      const [c0, c1, c2] = [0, 1, 2].map((k) => palette[(thread.tone + k) % palette.length]);
      at = NordlysSkyGL.strip(this.silkStrip, at, points, n, scale, thread.width * scale, 3 * thread.width * scale + 1, (i, rgba) => {
        const t = Math.max(0, Math.min(1, ((points[2 * i] - x0) * gx + (points[2 * i + 1] - y0) * gy) / along));
        let from = c0, to = c0, k = 0, alpha;
        if (t < 0.22) alpha = a * (t / 0.22);
        else if (t < 0.62) { k = (t - 0.22) / 0.4; to = c1; alpha = a * (1 - 0.1 * k); }
        else { k = (t - 0.62) / 0.38; from = c1; to = c2; alpha = a * 0.9 * (1 - k); }
        rgba[0] = from[0] + (to[0] - from[0]) * k;
        rgba[1] = from[1] + (to[1] - from[1]) * k;
        rgba[2] = from[2] + (to[2] - from[2]) * k;
        rgba[3] = alpha;
      });
    }
    gl.begin(this.canvas.width, this.canvas.height);
    gl.strips(gl.stream(this.silkStrip, at), { bands: NORDLYS_SILK_BANDS, blend: light ? "over" : "screen", light, ink: this.ink });
    gl.paint(this.ctx, "source-over");
  }

  /* A palette colour taken `k` of the way to white, as [r, g, b]. */
  pale(index, k = 0) {
    const [r, g, b] = this.paletteRgb[index % this.paletteRgb.length];
    return [Math.round(r + (255 - r) * k), Math.round(g + (255 - g) * k), Math.round(b + (255 - b) * k)];
  }

  /* A soft ellipse of light, rx by ry, turned by `angle`, its alpha falling off
     from the centre along `stops` ([offset, share] pairs). One radial gradient
     squashed to shape and one fill over its own box, like drawShaft, whatever
     the size: the cheapest light the canvas has. */
  glow(cx, cy, rx, ry, angle, rgb, alpha, stops = NORDLYS_SOFT) {
    if (!(alpha > 0.002) || !(rx > 0) || !(ry > 0)) return;
    const ctx = this.ctx;
    const colour = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
    ctx.save();
    ctx.translate(cx, cy);
    if (angle) ctx.rotate(angle);
    ctx.scale(rx / ry, 1);
    const light = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    for (const [offset, share] of stops) light.addColorStop(offset, `rgba(${colour}, ${Math.min(1, alpha * share)})`);
    ctx.fillStyle = light;
    ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
    ctx.restore();
  }

  /* ── Polaris: the turning sky ───────────────────────────────────────
     A long exposure. Every star has dragged an arc of its circle around the
     celestial pole, which sits high on the right where the page keeps nothing,
     and every arc is the same stretch of time — so the eye reads one sky
     turning rather than a scatter of lines. Each is faint where it began and
     brightest where the star is now, and the brightest stars carry a point of
     light at their heads. The stars are strewn over the whole disc the pole
     sweeps across the window, so however far the sky has turned the window is
     as full as it was.

     An arc never changes shape, only its angle. On the GPU the whole field is
     built once and turned by a matrix (sky-gl.js); in 2D — a still, the
     quiet-zone sample, a machine without WebGL2 — each arc is stroked round
     the pole with a conic gradient that fades it the same way. */
  initPolaris() {
    this.polaris = [];
    if (!this.w) return;
    // Its own stream, so the stars stay put whatever the other scenes scatter.
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x3c6ef372) >>> 0);
    const pole = this.polarisPole();
    const reach = Math.max(...[[0, 0], [this.w, 0], [0, this.h], [this.w, this.h]]
      .map(([x, y]) => Math.hypot(x - pole.x, y - pole.y)));
    // Even over the disc; about three hundred of them in the window at a time.
    const count = Math.round(Math.min(2400, Math.max(600, (Math.PI * reach * reach) / 5000)));
    for (let i = 0; i < count; i++) {
      const bright = random() < 0.05;
      this.polaris.push({
        r: reach * Math.sqrt(random()) + 3,
        at: random() * Math.PI * 2,
        tone: Math.floor(random() * 3),
        white: 0.3 + random() * 0.55,
        alpha: bright ? 0.55 + random() * 0.35 : 0.1 + Math.pow(random(), 1.7) * 0.42,
        width: bright ? 1.3 + random() * 0.7 : 0.55 + random() * 0.6,
        bright
      });
    }
  }

  polarisPole() {
    return { x: this.w * 0.83, y: this.h * 0.15 };
  }

  // How far the sky has turned: anticlockwise, as it turns about the north pole.
  polarisTurn() {
    return -this.t * NORDLYS_POLARIS.turn;
  }

  /* A star's light, 0 to 1: the mood's colour taken towards white on a dark
     sky; on a light one the colour as it is, since white would vanish. */
  starlight(star, light) {
    const rgb = this.pale(star.tone, light ? 0 : star.white);
    return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
  }

  /* The field as one strip, unturned: each arc from its head, where the star
     is now, back along its circle to its tail, fading as it goes. */
  polarisStrip() {
    const scale = this.dpr || 1;
    const light = this.lightMode;
    const pole = this.polarisPole();
    const { length } = NORDLYS_POLARIS;
    const steps = Math.ceil(length / 0.02);
    const n = steps + 1;
    const data = new Float32Array(NordlysSkyGL.room(this.polaris.map(() => n)) * NORDLYS_GL_FLOATS);
    const points = new Float32Array(n * 2);
    let at = 0;
    for (const star of this.polaris) {
      for (let i = 0; i < n; i++) {
        const angle = star.at + (length * i) / steps;
        points[2 * i] = pole.x + Math.cos(angle) * star.r;
        points[2 * i + 1] = pole.y + Math.sin(angle) * star.r;
      }
      const [r, g, b] = this.starlight(star, light);
      const alpha = star.alpha * (light ? 1.15 : 1);
      at = NordlysSkyGL.strip(data, at, points, n, scale, star.width * scale, 1.7 * star.width * scale + 1, (i, rgba) => {
        rgba[0] = r;
        rgba[1] = g;
        rgba[2] = b;
        rgba[3] = alpha * Math.pow(1 - i / steps, 1.6);
      });
    }
    return { data, count: at };
  }

  renderPolaris(dt) {
    const ctx = this.ctx;
    const light = this.lightMode;
    const pole = this.polarisPole();
    const turn = this.polarisTurn();
    const gl = this.skyGL();
    ctx.save();
    if (gl) {
      const scale = this.dpr || 1;
      const field = gl.layer("polaris", `${this.seed}:${this.w}x${this.h}:${scale}:${this.palette.join()}:${light}`, () => this.polarisStrip());
      gl.begin(this.canvas.width, this.canvas.height);
      gl.strips(field, { bands: NORDLYS_POLARIS.bands, blend: light ? "over" : "screen", light, ink: this.ink,
        matrix: NordlysSkyGL.turn(turn, pole.x * scale, pole.y * scale) });
      gl.paint(ctx, "source-over");
    } else this.tracePolaris(turn, light);

    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    // A town far off under the horizon, the only light the sky has.
    const low = ctx.createLinearGradient(0, this.h, 0, this.h * 0.55);
    low.addColorStop(0, this.rgba(2, light ? 0.06 : 0.09));
    low.addColorStop(1, this.rgba(2, 0));
    ctx.fillStyle = low;
    ctx.fillRect(0, this.h * 0.55, this.w, this.h * 0.45);
    // The pole star itself, which barely moves at all.
    const polar = this.pale(0, light ? 0 : 0.85);
    this.glow(pole.x, pole.y, 26, 26, 0, polar, light ? 0.14 : 0.2);
    this.glow(pole.x, pole.y, 3.2, 3.2, 0, polar, light ? 0.6 : 0.9);
    // Where the brightest stars are now: a point of light at each head.
    for (const star of this.polaris) {
      if (!star.bright) continue;
      const angle = star.at + turn;
      const x = pole.x + Math.cos(angle) * star.r;
      const y = pole.y + Math.sin(angle) * star.r;
      if (x < -12 || y < -12 || x > this.w + 12 || y > this.h + 12) continue;
      const rgb = this.pale(star.tone, light ? 0 : star.white);
      this.glow(x, y, 2.4 + star.width * 2.2, 2.4 + star.width * 2.2, 0, rgb, star.alpha * (light ? 0.35 : 0.5));
    }
    this.renderMeteors(0.0025, dt);
    ctx.restore();
  }

  /* The field in 2D: each arc that reaches the window, stroked round the pole
     with a conic gradient that fades from its head to its tail as the strip
     does. */
  tracePolaris(turn, light) {
    const ctx = this.ctx;
    const pole = this.polarisPole();
    const { length } = NORDLYS_POLARIS;
    const span = length / (Math.PI * 2);
    const margin = 6;
    const within = (angle, r) => {
      const x = pole.x + Math.cos(angle) * r;
      const y = pole.y + Math.sin(angle) * r;
      return x > -margin && y > -margin && x < this.w + margin && y < this.h + margin;
    };
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    ctx.lineCap = "round";
    /* The quiet-zone sample is about ninety pixels across, where a trail a
       pixel wide would come out a fifteenth of one and all but vanish: the
       solver would never see a bright trail behind the greeting. There each
       trail is at least one sample pixel wide, at its own brightness. */
    const least = this.solvingQuiet ? 1 / (ctx.getTransform?.().a || 1) : 0;
    for (const star of this.polaris) {
      const head = star.at + turn;
      if (!within(head, star.r) && !within(head + length / 2, star.r) && !within(head + length, star.r)) continue;
      const colour = this.pale(star.tone, light ? 0 : star.white).join(", ");
      const alpha = star.alpha * (light ? 1.15 : 1);
      const fade = ctx.createConicGradient(head, pole.x, pole.y);
      for (const f of [0, 0.25, 0.5, 0.75, 1]) fade.addColorStop(f * span, `rgba(${colour}, ${alpha * Math.pow(1 - f, 1.6)})`);
      fade.addColorStop(1, `rgba(${colour}, 0)`);
      ctx.strokeStyle = fade;
      ctx.lineWidth = Math.max(star.width, least);
      ctx.beginPath();
      ctx.arc(pole.x, pole.y, star.r, head, head + length);
      ctx.stroke();
    }
  }

  /* ── Pillars: light over the frost ──────────────────────────────────
     On a still night far below freezing, flat ice crystals settle level in the
     air, and every light of a distant town throws a column straight up off
     them into the sky. The columns stand over a low horizon in two or three
     clusters, brightest at their feet and mirrored faintly in the snow, and
     they breathe as the crystals drift. Nearer by, the crystals glint in the
     air themselves — diamond dust — each lit in the colour of the column
     nearest it. All of it is soft gradients, the cheapest thing the canvas
     draws; nothing is stroked. */
  initPillars() {
    this.pillars = [];
    this.dust = [];
    this.towns = [];
    if (!this.w) return;
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x1b873593) >>> 0);
    const towns = random() < 0.3 ? 2 : 3;
    for (let town = 0; town < towns; town++) {
      const centre = 0.08 + ((town + 0.2 + random() * 0.6) / towns) * 0.84;
      const spread = 0.05 + random() * 0.06;
      this.towns.push({ x: centre, spread, tone: Math.floor(random() * 3) });
      const lights = 3 + Math.floor(random() * 3);
      for (let i = 0; i < lights; i++) {
        this.pillars.push({
          x: centre + (random() - 0.5) * spread * 2,
          height: 0.38 + random() * 0.36,
          width: 1 + random() * 1.4,
          alpha: 0.26 + random() * 0.2,
          tone: Math.floor(random() * 3),
          white: 0.5 + random() * 0.38,
          phase: random() * Math.PI * 2,
          rate: 0.5 + random() * 0.7
        });
      }
    }
    const count = Math.round(Math.min(170, Math.max(60, (this.w * this.h) / 11000)));
    for (let i = 0; i < count; i++) {
      this.dust.push({ x: random(), y: random(), z: 0.35 + random() * 0.65, sway: random() * Math.PI * 2, glint: random() * Math.PI * 2, rate: 0.6 + random() * 1.2 });
    }
  }

  renderPillars() {
    const ctx = this.ctx;
    const light = this.lightMode;
    if (!this.pillars.length) return;
    const unit = Math.min(this.w, this.h);
    const horizon = this.h * NORDLYS_HORIZON;
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";

    // The cold air over the horizon, lit from below by the town.
    const air = ctx.createLinearGradient(0, horizon, 0, horizon - this.h * 0.55);
    air.addColorStop(0, this.rgba(1, light ? 0.07 : 0.1));
    air.addColorStop(1, this.rgba(1, 0));
    ctx.fillStyle = air;
    ctx.fillRect(0, horizon - this.h * 0.55, this.w, this.h * 0.55);
    // The snow under it, paler than the sky where the town lights it.
    const snow = ctx.createLinearGradient(0, horizon, 0, this.h);
    snow.addColorStop(0, this.rgba(1, light ? 0.07 : 0.09));
    snow.addColorStop(1, this.rgba(2, light ? 0.015 : 0.02));
    ctx.fillStyle = snow;
    ctx.fillRect(0, horizon, this.w, this.h - horizon);
    // Each town a low band of light along the horizon.
    for (const town of this.towns) {
      this.glow(town.x * this.w, horizon, town.spread * this.w * 1.6, unit * 0.02, 0, this.pale(town.tone, light ? 0 : 0.6), light ? 0.16 : 0.24);
    }

    const columns = this.pillars.map((pillar) => ({
      pillar,
      x: pillar.x * this.w,
      breath: 0.8 + 0.2 * Math.sin(this.t * 0.42 * pillar.rate + pillar.phase),
      height: pillar.height * this.h * (0.95 + 0.05 * Math.sin(this.t * 0.23 * pillar.rate + pillar.phase * 1.7)),
      half: unit * 0.0055 * pillar.width,
      rgb: this.pale(pillar.tone, light ? 0 : pillar.white)
    }));

    /* Above the horizon: a thin spread of stars, then the columns — a wide haze,
       a softer glow, and the column itself. */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, horizon);
    ctx.clip();
    this.renderStars({ share: 0.35 });
    for (const column of columns) {
      const alpha = column.pillar.alpha * column.breath;
      this.glow(column.x, horizon, column.half * 12, column.height * 0.7, 0, column.rgb, alpha * 0.14, NORDLYS_PILLAR);
      this.glow(column.x, horizon, column.half * 3.2, column.height * 0.9, 0, column.rgb, alpha * 0.42, NORDLYS_PILLAR);
      this.glow(column.x, horizon, column.half, column.height, 0, column.rgb, alpha, NORDLYS_PILLAR);
    }
    ctx.restore();

    // Below it, each column again in the snow, short and dim.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, this.w, this.h - horizon);
    ctx.clip();
    for (const column of columns) {
      const alpha = column.pillar.alpha * column.breath;
      this.glow(column.x, horizon, column.half * 3, column.height * 0.2, 0, column.rgb, alpha * 0.22, NORDLYS_PILLAR);
      this.glow(column.x, horizon, column.half * 1.1, column.height * 0.14, 0, column.rgb, alpha * 0.4, NORDLYS_PILLAR);
    }
    ctx.restore();

    // The lights themselves, on the horizon.
    for (const column of columns) {
      this.glow(column.x, horizon, column.half * 7, column.half * 2.4, 0, column.rgb, column.pillar.alpha * column.breath * 2.2);
    }

    // Diamond dust: falling slowly, swaying, glinting, lit by the nearest column.
    for (const dust of this.dust) {
      const fall = (dust.y + this.t * 0.01 * dust.rate) % 1;
      const x = ((((dust.x + Math.sin(this.t * 0.15 * dust.rate + dust.sway) * 0.01) % 1) + 1) % 1) * this.w;
      const y = this.h * (0.06 + fall * 0.9);
      let near = columns[0];
      let gap = Infinity;
      for (const column of columns) {
        const away = Math.abs(column.x - x);
        if (away < gap) { gap = away; near = column; }
      }
      const lit = Math.max(0, 1 - gap / (unit * 0.3)) * near.breath;
      const glint = Math.pow(Math.max(0, Math.sin(this.t * 1.6 * dust.rate + dust.glint)), 16);
      const alpha = dust.z * Math.sin(Math.PI * fall) * (0.14 + 0.7 * lit) * (0.4 + 0.6 * glint);
      if (alpha < 0.015) continue;
      const rgb = light ? near.rgb : this.pale(near.pillar.tone, 0.75);
      const size = 0.7 + dust.z * 1.2;
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.min(1, alpha).toFixed(3)})`;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      if (glint > 0.5 && lit > 0.25) {
        const reach = 3 + glint * 6 * dust.z;
        this.drawShaft(x, y, reach, 1, 0.1, rgb, alpha * 0.8);
        this.drawShaft(x, y, reach, 0.1, 1, rgb, alpha * 0.8);
      }
    }
    ctx.restore();
  }

  /* ── Nacre: mother-of-pearl cloud ───────────────────────────────────
     Nacreous clouds form high in the stratosphere over the Arctic in the
     depth of winter, and just after sunset they shine with the colours of
     mother-of-pearl: smooth lenses, banded like a film of oil. Each cloud here
     is lenses one inside the next, each a step further round the mood, so the
     colour runs in rings from its thin edge to its thick middle; soft lobes
     break the outline, and long thin streaks give it a grain. The colours
     drift slowly round the mood, the way the real ones shift as the sun goes
     down. Soft gradients only. */
  initNacre() {
    this.nacre = [];
    if (!this.w) return;
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x2545f491) >>> 0);
    const clouds = 4 + Math.floor(random() * 2);
    for (let i = 0; i < clouds; i++) {
      const cloud = {
        x: ((i + 0.2 + random() * 0.6) / clouds) * 1.6,
        y: 0.1 + ((i % 3) * 0.12) + random() * 0.2,
        length: 0.26 + random() * 0.3,
        thick: 0.16 + random() * 0.12,
        tilt: (random() - 0.5) * 0.18,
        drift: 0.6 + random() * 0.8,
        phase: random(),
        lobes: [],
        streaks: []
      };
      /* The body: a few soft lobes along the lens, largest in the middle, so
         the cloud has a thickness that varies like a real one. */
      const lobes = 6 + Math.floor(random() * 5);
      for (let j = 0; j < lobes; j++) {
        const along = (j / (lobes - 1) - 0.5) * 1.5 + (random() - 0.5) * 0.12;
        cloud.lobes.push({
          along,
          u: (random() - 0.5) * 0.7,
          length: (0.28 + random() * 0.22) * (1 - Math.abs(along) * 0.35),
          thick: (0.35 + random() * 0.45) * (1 - Math.abs(along) * 0.45),
          alpha: 0.6 + random() * 0.4
        });
      }
      // The grain: long thin streaks over it.
      const streaks = 16 + Math.floor(random() * 12);
      for (let j = 0; j < streaks; j++) {
        const u = random() * 2 - 1;
        cloud.streaks.push({
          u,
          along: (random() - 0.5) * 1.2 * (1 - Math.abs(u) * 0.5),
          length: (1 - u * u * 0.7) * (0.3 + random() * 0.4),
          thick: 0.05 + random() * 0.1,
          band: random() * 0.2,
          alpha: 0.45 + random() * 0.55,
          wave: random() * Math.PI * 2
        });
      }
      this.nacre.push(cloud);
    }
  }

  /* Mother-of-pearl: a colour that walks round the mood's three smoothly and
     comes back — `k` is where on that walk, `white` how pale. */
  iridescent(k, white) {
    const f = (((k % 1) + 1) % 1) * 3;
    const i = Math.floor(f) % 3;
    const m = f - Math.floor(f);
    const s = m * m * (3 - 2 * m);
    const a = this.paletteRgb[i];
    const b = this.paletteRgb[(i + 1) % 3];
    return [0, 1, 2].map((c) => {
      const v = a[c] + (b[c] - a[c]) * s;
      return Math.round(v + (255 - v) * white);
    });
  }

  renderNacre() {
    const ctx = this.ctx;
    const light = this.lightMode;
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    /* The twilight they shine in: the sun just under the horizon, warm at the
       bottom of the sky and cooling upward into the night. */
    const dusk = ctx.createLinearGradient(0, this.h, 0, this.h * 0.2);
    dusk.addColorStop(0, this.rgba(0, light ? 0.1 : 0.17));
    dusk.addColorStop(0.35, this.rgba(1, light ? 0.05 : 0.08));
    dusk.addColorStop(1, this.rgba(2, 0));
    ctx.fillStyle = dusk;
    ctx.fillRect(0, this.h * 0.2, this.w, this.h * 0.8);
    const shift = this.t * 0.01;
    const pale = light ? 0 : 1;
    for (const cloud of this.nacre) {
      const span = 1.6;
      const along = ((((cloud.x + this.t * 0.0035 * cloud.drift) % span) + span) % span) - 0.3;
      const length = cloud.length * this.w * 0.5;
      const thick = Math.max(8, cloud.thick * this.h * 0.5);
      ctx.save();
      ctx.translate(along * this.w, cloud.y * this.h);
      ctx.rotate(cloud.tilt);
      /* The bands: lenses one inside the next, each a step further round the
         mood and a little paler, and each lifted a touch, so the colour runs in
         rings from the thin edge to the thick middle as it does in a film of
         oil — the thing that makes the cloud read as nacre, not as mist. */
      for (let band = 0; band < 5; band++) {
        const size = 1 - band * 0.17;
        const colour = this.iridescent(cloud.phase + shift + band * 0.17, (0.12 + band * 0.05) * pale);
        this.glow(0, -band * thick * 0.06, length * size, thick * (0.35 + 0.65 * size), 0, colour, (light ? 0.1 : 0.16) + band * 0.02, NORDLYS_LOBE);
      }
      // The lobes give it an edge that is not a perfect lens.
      for (const lobe of cloud.lobes) {
        const colour = this.iridescent(cloud.phase + shift + lobe.along * 0.22, 0.28 * pale);
        this.glow(lobe.along * length, lobe.u * thick, length * lobe.length, thick * lobe.thick, 0, colour, lobe.alpha * (light ? 0.14 : 0.2), NORDLYS_LOBE);
      }
      // The streaks, finer and paler, are the grain of it.
      for (const streak of cloud.streaks) {
        const y = (streak.u + Math.sin(this.t * 0.16 + streak.wave) * 0.05) * thick * 0.8;
        const colour = this.iridescent(cloud.phase + shift + streak.along * 0.22 + streak.u * 0.12 + streak.band, 0.3 * pale);
        const alpha = streak.alpha * (light ? 0.16 : 0.26) * (1 - streak.u * streak.u * 0.6);
        this.glow(streak.along * length, y, length * streak.length, thick * streak.thick, 0, colour, alpha, NORDLYS_STREAK);
      }
      // And a bright core down the middle, where the lens is thickest.
      this.glow(0, 0, length * 0.62, thick * 0.12, 0, this.pale(0, 0.85 * pale), light ? 0.1 : 0.15, NORDLYS_STREAK);
      ctx.restore();
    }
    /* The words sit on clear sky: a cloud thins out as it passes behind the
       clock and the search field, as the ice clears there in Baikal. A bright
       lens behind a pale glass field is the one thing here a reader loses. */
    ctx.globalCompositeOperation = "destination-out";
    this.glow(this.w * 0.5, this.h * 0.25, this.w * 0.3, this.h * 0.2, 0, [0, 0, 0], 0.5, NORDLYS_LOBE);
    ctx.restore();
  }

  /* ── Baikal: black ice ──────────────────────────────────────────────
     In late winter the ice on Lake Baikal is clear enough to see a metre
     down, and it holds what the lake breathed out as it froze: flat white
     bubbles of gas, stacked one under the next in columns, each smaller and
     dimmer with depth; and the long cracks the ice splits along as it moves.
     Nothing in it moves but the light — a low sun sweeping slowly over the
     ice, picking out the bubbles and the cracks it passes, and the water
     glowing faintly underneath.

     Because the ice holds still, on the screen it is drawn once into a layer
     of its own and laid down each frame in one drawImage; the moving light
     goes on top of it. A still and the quiet-zone sample draw it directly. */
  initBaikal() {
    this.baikal = { bubbles: [], cracks: [] };
    if (!this.w) return;
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x68e31da4) >>> 0);
    const unit = Math.min(this.w, this.h);
    const columns = Math.round(Math.max(9, Math.min(20, (this.w * this.h) / 80000)));
    for (let c = 0; c < columns; c++) {
      let x = random();
      const y = random();
      // The clock, the date and the search field sit top centre; the ice there is clear.
      if (y < 0.46 && Math.abs(x - 0.5) < 0.2) x += x < 0.5 ? -0.24 : 0.24;
      const top = unit * (0.012 + random() * 0.022);
      const depth = 2 + Math.floor(random() * 4);
      /* A column goes down into the ice, so seen from above each bubble lies a
         little further along one way than the one over it, like a stack of
         coins leaning — close, not a chain. */
      const heading = random() * Math.PI * 2;
      const spacing = top * (0.28 + random() * 0.3);
      const squash = 0.36 + random() * 0.3;
      const tilt = (random() - 0.5) * 0.6;
      // Deepest first, so the nearest bubble is drawn over the rest.
      for (let k = depth - 1; k >= 0; k--) {
        this.baikal.bubbles.push({
          x: x * this.w + Math.cos(heading) * spacing * k,
          y: y * this.h + Math.sin(heading) * spacing * k,
          r: top * Math.pow(0.86, k) * (0.85 + random() * 0.3),
          squash: squash * (0.9 + random() * 0.2),
          tilt: tilt + (random() - 0.5) * 0.25,
          alpha: Math.pow(0.62, k),
          glint: random() * Math.PI * 2
        });
      }
    }
    // Loose bubbles, small and alone.
    for (let i = 0; i < 30; i++) {
      this.baikal.bubbles.push({
        x: random() * this.w, y: random() * this.h, r: unit * (0.003 + random() * 0.006),
        squash: 0.55 + random() * 0.35, tilt: random() * Math.PI, alpha: 0.4 + random() * 0.4, glint: random() * Math.PI * 2
      });
    }
    const cracks = 4 + Math.floor(random() * 3);
    for (let i = 0; i < cracks; i++) this.growCrack(random, unit, null);
  }

  /* A crack runs in from an edge, jagged but keeping a direction, and now and
     then splits off a short branch. */
  growCrack(random, unit, from) {
    const branch = Boolean(from);
    let x, y, heading;
    if (branch) ({ x, y, heading } = from);
    else {
      const side = Math.floor(random() * 4);
      const along = 0.1 + random() * 0.8;
      [x, y] = [[along * this.w, -4], [this.w + 4, along * this.h], [along * this.w, this.h + 4], [-4, along * this.h]][side];
      heading = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][side] + (random() - 0.5) * 1.1;
    }
    /* Ice splits in long, nearly straight runs with a sudden kink now and
       then; a wander at every step reads as a root or a vein, not a crack. */
    const steps = branch ? 4 + Math.floor(random() * 7) : 24 + Math.floor(random() * 22);
    const stride = unit * (branch ? 0.018 : 0.03);
    const points = [x, y];
    for (let i = 0; i < steps; i++) {
      heading += (random() - 0.5) * 0.12 + (random() < 0.12 ? (random() - 0.5) * 0.9 : 0);
      x += Math.cos(heading) * stride * (0.7 + random() * 0.6);
      y += Math.sin(heading) * stride * (0.7 + random() * 0.6);
      points.push(x, y);
      if (x < -20 || y < -20 || x > this.w + 20 || y > this.h + 20) break;
      if (!branch && i > 2 && random() < 0.08) {
        this.growCrack(random, unit, { x, y, heading: heading + (random() < 0.5 ? -1 : 1) * (0.6 + random() * 0.6) });
      }
    }
    // Here and there a crack is a sheet turned to the light, and shines along its length.
    this.baikal.cracks.push({ points, weight: branch ? 0.5 : 1, sheet: !branch && random() < 0.5 });
  }

  /* Everything in the ice that holds still: the cracks, a faint sheet of light
     either side of a fine bright line, and the bubbles, each a disc of white
     with a brighter rim. */
  drawIce(ctx, light) {
    const white = (light ? this.pale(1, 0) : this.pale(0, 0.8)).join(", ");
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const crack of this.baikal.cracks) {
      ctx.beginPath();
      ctx.moveTo(crack.points[0], crack.points[1]);
      for (let i = 2; i < crack.points.length; i += 2) ctx.lineTo(crack.points[i], crack.points[i + 1]);
      if (crack.sheet) {
        ctx.strokeStyle = `rgba(${white}, ${light ? 0.035 : 0.05})`;
        ctx.lineWidth = 14;
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${white}, ${(light ? 0.05 : 0.08) * crack.weight})`;
      ctx.lineWidth = 4 * crack.weight;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${white}, ${(light ? 0.34 : 0.45) * crack.weight})`;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    /* A bubble is a flat disc of gas: white, brightest just inside its edge
       where the ice curves round it, a little clearer in the middle. */
    for (const bubble of this.baikal.bubbles) {
      ctx.save();
      ctx.translate(bubble.x, bubble.y);
      ctx.rotate(bubble.tilt);
      ctx.scale(1, bubble.squash);
      const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, bubble.r);
      disc.addColorStop(0, `rgba(${white}, ${(light ? 0.18 : 0.3) * bubble.alpha})`);
      disc.addColorStop(0.8, `rgba(${white}, ${(light ? 0.3 : 0.5) * bubble.alpha})`);
      disc.addColorStop(1, `rgba(${white}, ${(light ? 0.14 : 0.22) * bubble.alpha})`);
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(0, 0, bubble.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${white}, ${(light ? 0.45 : 0.7) * bubble.alpha})`;
      ctx.lineWidth = Math.max(0.7, bubble.r * 0.05);
      ctx.stroke();
      ctx.restore();
    }
    /* The ice is clear where the clock, the date and the search field sit: a
       crack through a word reads as a strike-through, whatever the contrast. */
    ctx.globalCompositeOperation = "destination-out";
    const clear = this.w * 0.27;
    ctx.save();
    ctx.translate(this.w * 0.5, this.h * 0.22);
    ctx.scale(1, (this.h * 0.25) / clear);
    const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, clear);
    hole.addColorStop(0, "rgba(0, 0, 0, 0.88)");
    hole.addColorStop(0.6, "rgba(0, 0, 0, 0.6)");
    hole.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = hole;
    ctx.fillRect(-clear, -clear, clear * 2, clear * 2);
    ctx.restore();
    ctx.restore();
  }

  renderBaikal() {
    const ctx = this.ctx;
    const light = this.lightMode;
    if (!this.baikal) return;
    const unit = Math.min(this.w, this.h);
    ctx.save();
    if (ctx === this.screen && this.canvas && typeof document.createElement === "function") {
      const key = `${this.seed}:${this.w}x${this.h}:${this.dpr}:${this.palette.join()}:${light}`;
      if (this.iceLayer?.key !== key) {
        const layer = document.createElement("canvas");
        layer.width = this.canvas.width;
        layer.height = this.canvas.height;
        const paint = layer.getContext("2d");
        paint.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
        this.drawIce(paint, light);
        this.iceLayer = { key, canvas: layer };
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.iceLayer.canvas, 0, 0);
      ctx.restore();
    } else this.drawIce(ctx, light);

    // The low sun, sweeping over the ice: "atop", so it lands only on what is in it.
    const sweep = ((this.t * 0.03) % 1.6) - 0.3;
    const x = this.w * sweep;
    const sun = ctx.createLinearGradient(x - unit * 0.6, this.h, x + unit * 0.6, 0);
    sun.addColorStop(0, "rgba(255, 255, 255, 0)");
    sun.addColorStop(0.5, light ? this.rgba(0, 0.35) : "rgba(236, 246, 255, 0.5)");
    sun.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, this.w, this.h);

    // A few bubbles catch it, one glint at a time.
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    const sparkle = this.pale(0, light ? 0 : 0.9);
    for (const bubble of this.baikal.bubbles) {
      if (bubble.r < unit * 0.012) continue;
      const glint = Math.pow(Math.max(0, Math.sin(this.t * 0.8 + bubble.glint)), 8);
      if (glint < 0.08) continue;
      const angle = bubble.tilt - 2.3;
      const gx = bubble.x + Math.cos(angle) * bubble.r * 0.7;
      const gy = bubble.y + Math.sin(angle) * bubble.r * 0.7 * bubble.squash;
      const reach = bubble.r * (0.35 + glint * 0.5);
      this.drawShaft(gx, gy, reach, 1, 0.12, sparkle, glint * 0.5 * bubble.alpha);
      this.drawShaft(gx, gy, reach, 0.12, 1, sparkle, glint * 0.5 * bubble.alpha);
    }

    // The water under the ice, laid behind everything.
    ctx.globalCompositeOperation = "destination-over";
    for (let i = 0; i < 3; i++) {
      const cx = this.w * (0.2 + i * 0.3 + Math.sin(this.t * 0.05 + i * 2.1) * 0.05);
      const cy = this.h * (0.35 + (i % 2) * 0.3 + Math.cos(this.t * 0.04 + i) * 0.04);
      const r = Math.max(this.w, this.h) * 0.55;
      const deep = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      deep.addColorStop(0, this.rgba(1 + (i % 2), light ? 0.06 : 0.12));
      deep.addColorStop(1, this.rgba(1 + (i % 2), 0));
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, this.w, this.h);
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

  /* The contour lines of the ground at time t, by marching squares over a grid
     about ninety cells across: for each level, its segments as a flat list,
     [x1, y1, x2, y2, ...], for the GPU layer or a Path2D to draw. */
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
      const lines = [];
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
          const segment = (a, b) => { lines.push(a[0], a[1], b[0], b[1]); };
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
      levels.push({ level, v, lines });
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
      // Numbered, so the GPU layer builds its lines again exactly when these change.
      const serial = (this.contours?.serial || 0) + 1;
      this.contours = { serial, t: this.t, w: this.w, h: this.h, terrain: this.terrain, ...this.traceTerrain(this.t) };
    }
    const { levels, low, high, hills } = this.contours;
    const [c1] = this.paletteRgb;
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
    const gl = this.skyGL();
    if (gl) {
      const scale = this.dpr || 1;
      const version = `${this.contours.serial}:${this.palette.join()}:${light}:${scale}`;
      const field = gl.layer("drift", version, () => this.contourStrip(levels, low, high, light, scale));
      gl.begin(this.canvas.width, this.canvas.height);
      gl.strips(field, { bands: [[1, 1]], blend: "max", light, ink: this.ink });
      gl.paint(ctx, light ? "multiply" : "screen");
    } else {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const entry of levels) {
        if (!entry.path) {
          entry.path = new Path2D();
          const { lines } = entry;
          for (let i = 0; i < lines.length; i += 4) {
            entry.path.moveTo(lines[i], lines[i + 1]);
            entry.path.lineTo(lines[i + 2], lines[i + 3]);
          }
        }
        const { rgb, width, alpha } = this.contourInk(entry, low, high, light);
        ctx.strokeStyle = `rgb(${rgb.join(", ")})`;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha * this.ink;
        ctx.stroke(entry.path);
      }
    }
    ctx.restore();
  }

  /* A contour line's ink: the mood's colours by elevation, low ground in the
     third and the peaks in the first; every fifth line an index contour,
     heavier and brighter, so height reads at a glance. */
  contourInk({ level, v }, low, high, light) {
    const [c1, c2, c3] = this.paletteRgb;
    const mix = (a, b, k) => a.map((value, index) => Math.round(value + (b[index] - value) * k));
    const height = (v - low) / (high - low || 1);
    const index = level % 5 === 0;
    return {
      rgb: height < 0.5 ? mix(c3, c2, height * 2) : mix(c2, c1, (height - 0.5) * 2),
      width: index ? 1.6 : 1,
      alpha: index ? (light ? 0.3 : 0.5) : (light ? 0.15 : 0.26)
    };
  }

  /* Every contour line as pieces of one strip on the GPU layer. A piece of
     marching squares is two points with square ends, so two pieces of one line
     overlap where they meet, and the layer's "max" makes one line of them
     where brightening would string it with beads. */
  contourStrip(levels, low, high, light, scale) {
    const pieces = levels.reduce((sum, entry) => sum + entry.lines.length / 4, 0);
    const room = pieces * 6 * NORDLYS_GL_FLOATS;
    if (!(this.contourData?.length >= room)) this.contourData = new Float32Array(room);
    const data = this.contourData;
    const pair = new Float32Array(4);
    let at = 0;
    for (const entry of levels) {
      const { rgb, width, alpha } = this.contourInk(entry, low, high, light);
      const [r, g, b] = rgb.map((value) => value / 255);
      const core = width * scale;
      const tint = (i, rgba) => { rgba[0] = r; rgba[1] = g; rgba[2] = b; rgba[3] = alpha; };
      const { lines } = entry;
      for (let i = 0; i < lines.length; i += 4) {
        pair[0] = lines[i];
        pair[1] = lines[i + 1];
        pair[2] = lines[i + 2];
        pair[3] = lines[i + 3];
        at = NordlysSkyGL.strip(data, at, pair, 2, scale, core, core / 2 + 1, tint, core / 2);
      }
    }
    return { data, count: at };
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

    /* Below this edge the gradient is fully transparent, and the wave never
       reaches it. Closing the curtain there instead of at the foot of the
       screen leaves every painted pixel as it was, and stops six curtains a
       frame from blending the whole lower sky with nothing. */
    const fadeY = cy + 160 * spread;
    this.ctx.beginPath();
    this.ctx.moveTo(0, fadeY);

    const step = 24;
    const limit = this.w + step;
    for (let x = 0; x <= limit; x += step) {
      const wave1 = Math.sin((x * 0.002 * freq) + (this.t * speed)) * 50 * spread;
      const wave2 = Math.cos((x * 0.004 * freq) - (this.t * speed * 0.7)) * 25 * spread;
      const wave3 = Math.sin((x * 0.011 * freq) + (this.t * speed * 1.6)) * 6;
      const y = cy + wave1 + wave2 + wave3;
      this.ctx.lineTo(x, y);
    }

    this.ctx.lineTo(this.w, fadeY);
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
