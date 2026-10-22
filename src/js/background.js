/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - BACKGROUND SCENES & VISUAL ENGINE
   Time-based (refresh-rate independent), light/dark aware, zero idle cost.
   ═══════════════════════════════════════════════════════════════════ */

/* The scenes the canvas draws itself, read from the catalogue (sky-catalog.js):
   app.js decides whether to start the engine and settings.js decides which
   controls apply, and all three used to keep their own copy of this list — so
   adding a composition meant finding three places and the third one was always
   the one missed. Each one's painting is a file in src/js/skies. */
const NORDLYS_GENERATIVE_SCENES = new Set(NordlysSkies.canvasSkies());
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
const NORDLYS_REST_PHASE = NordlysSkies.table("rest");
const NORDLYS_STILLS = new WeakMap();
// A minute without input and the sky paints at its idle rate.
const NORDLYS_IDLE_AFTER = 60000;
/* The least time between paints some scenes need, in milliseconds. The real
   sky turns a quarter of a degree a minute, so the Star map paints for its
   twinkle alone, and the Midnight sun for the light on the water; Meteors
   wait at this between meteors and take the full rate for one (meteorDue). */
const NORDLYS_SCENE_BUDGET = NordlysSkies.table("budget");
// The scenes that keep time with the real sky even when held still.
const NORDLYS_CLOCK_SCENES = new Set(Object.keys(NordlysSkies.table("clock")));

// How a light falls off from its centre, as [offset, share] stops: a soft glow.
const NORDLYS_SOFT = [[0, 1], [0.32, 0.34], [1, 0]];
/* The Star map and Meteors look out over a horizon low on the page with the
   zenith at the top, both as shares of the height (skyView). */
const NORDLYS_SKY_VIEW = { horizon: 0.9, zenith: 0.03 };
// The scenes that are a night thing, and step back further by day.
const NORDLYS_NIGHT_SCENES = new Set(Object.keys(NordlysSkies.table("night")));

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
    /* What the composed skies read from the rest of the page (setWorld): the
       person's own layers, the working day, how full today's calendar is, and
       whether a focus session is on; and what they keep between frames. */
    this.skyLayers = null;
    this.workday = null;
    this.dayLoad = 0;
    this.focusing = false;
    this.composer = null;
    /* Set by a sky whose frame has nothing moving in it, a clear day over the
       hills: the frame is held as if at rest, and the minute keeps time. */
    this.held = false;
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
    /* The real sky's scenes: the Star map's view and its layer of stars and
       figures; the Meteors' field, its layer, and the showers of the minute;
       the Midnight sun's coast. Each layer is drawn on the screen once and
       laid down every frame. */
    this.chart = null;
    this.chartLayer = null;
    this.field = [];
    this.fieldLayer = null;
    this.showerRates = null;
    this.coast = [];
    // The minute timer a held real-sky scene keeps time by (keepTime).
    this.timeKeeper = null;
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
    /* The watchdog. The first painted frames of a moving sky are timed; a
       sky that costs this computer too much (no GPU, a remote desktop, a
       blocklisted driver) is held still, said once by the page, and
       remembered for this device. `heavy` is that hold; `keepMoving` is the
       person saying no to it. */
    this.heavy = false;
    this.watch = null;
    this.onBattery = false;
    globalThis.navigator?.getBattery?.().then((battery) => {
      const read = () => { this.onBattery = !battery.charging; };
      read();
      battery.addEventListener?.("chargingchange", read);
    }).catch(() => {});

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
    return window.NordlysSky.daylight(date, this.whereNow());
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
    this.initChart();
    this.initField();
    this.initCoast();
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
     mood repaints the same stars and threads rather than a new scatter. */
  paintStill(canvas, scene, { width = canvas?.clientWidth, height = canvas?.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2), zoom = 3 } = {}) {
    if (!canvas || !NORDLYS_GENERATIVE_SCENES.has(scene)) return false;
    if (!width || !height) return false;
    let still = NORDLYS_STILLS.get(canvas);
    if (!still || still.mode !== scene || still.seed !== this.seed || still.w !== width * zoom || still.h !== height * zoom) {
      still = Object.assign(Object.create(NordlysBackgroundEngine.prototype), {
        canvas, ctx: canvas.getContext("2d"), w: width * zoom, h: height * zoom, mode: scene, still: true,
        t: NORDLYS_REST_PHASE[scene], ink: 1, motion: 0, intensity: 1, customPalettes: {}, seed: this.seed, rng: null,
        stars: [], meteors: [], nebulae: [], silk: [], polaris: [], chart: null, field: [], coast: [], terrain: [], quietZones: [],
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
    still.now = this.now;
    still.skyLayers = this.skyLayers;
    still.workday = this.workday;
    still.dayLoad = this.dayLoad;
    still.focusing = this.focusing;
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
      this.chartLayer = null;
      this.fieldLayer = null;
      // A composed sky's backdrops go with it.
      this.composer = null;
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
    this.keepTime();
  }

  /* A held Star map or Midnight sun still keeps time with the sky: nothing
     in it moves, but once a minute the frame is painted again where the sky
     has got to. One frame a minute, and none while the page is hidden. */
  keepTime() {
    const keeps = NORDLYS_CLOCK_SCENES.has(this.mode);
    if (keeps === Boolean(this.timeKeeper)) return;
    clearInterval(this.timeKeeper);
    this.timeKeeper = keeps ? setInterval(() => { if (!document.hidden) this.repaint(); }, 60000) : null;
  }

  /* At rest the scene is painted once and held. Two things ask for that: the
     motion slider at zero, and the system telling us the user wants less
     movement. The second used to mean the loop never started at all, so a
     reduced-motion user who kept the default background got a blank canvas
     over their theme — the product's signature simply absent, for the people
     least able to opt back into it. "Reduce motion" is not "remove the
     picture". */
  atRest() {
    return this.heavy || this.motionQuery.matches || (this.motion ?? 1) === 0;
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
      const budget = this.frameBudget(now);
      if (now - this.lastFrame < budget - 2) {
        this.scheduleFrame(now, true);
        return;
      }
      /* dt in 60fps units, capped so a long stall cannot jump the sky ahead:
         at a tenth of a second for the budget everyone has, and at half as
         much again as a slower scene's own, which would otherwise lose time. */
      const dt = Math.min((now - this.lastFrame) / 16.666, Math.max(6, (budget * 1.5) / 16.666));
      this.lastFrame = now;
      const began = performance.now();
      this.render(dt);
      this.timeFrame(now, performance.now() - began);
      /* Nothing in the scene advances at rest, so a second frame would paint
         the same pixels. Holding the last one costs nothing to keep and lets
         every backdrop-filter above it sample a layer that never invalidates. */
      if (this.atRest() || this.held) return;
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

  /* The first 24 painted frames of a moving sky, from the second on (the
     first pays for setting the scene up). Too heavy is a median frame that
     takes over 12 ms of the page's own time: at thirty frames a second that
     is more than a third of it, and the board's own clicks and scrolling
     compete with the sky. Only the frame's own cost is judged, never how late
     frames arrive, which a busy computer does to every page. Measured with
     software drawing: Aurora about 3 ms, Polaris and Silk about 28. */
  watchFrames(mode) {
    this.watch = { mode, costs: [], skip: 1 };
  }

  timeFrame(now, cost) {
    const watch = this.watch;
    if (!watch || watch.mode !== this.mode) return;
    if (watch.skip > 0) { watch.skip--; return; }
    watch.costs.push(cost);
    if (watch.costs.length < 24) return;
    this.watch = null;
    if (!NordlysBackgroundEngine.tooHeavy(watch.costs)) return;
    this.heavy = true;
    window.dispatchEvent(new CustomEvent("nordlys:skyheavy", { detail: { mode: this.mode } }));
  }

  static tooHeavy(costs) {
    const sorted = [...costs].sort((a, b) => a - b);
    return sorted.length > 0 && sorted[Math.floor(sorted.length / 2)] > 12;
  }

  // Held still for being too heavy, or let move again.
  setHeavy(heavy) {
    this.heavy = Boolean(heavy);
    this.watch = null;
    if (this.heavy) this.repaint();
    else this.resumeIfMoving();
  }

  frameBudget(now) {
    // On battery, the idle pace all the time: half the frames, the same sky.
    const base = this.onBattery || now - this.lastInput > NORDLYS_IDLE_AFTER ? 1000 / 15 : 1000 / 30;
    const own = NORDLYS_SCENE_BUDGET[this.mode];
    if (!own) return base;
    return Math.max(base, this.mode === "meteors" ? this.meteorDue(own) : own);
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
     the idle rate put to sleep is woken for the sooner one. A scene that
     paints less often anyway has nothing sooner to wake for. */
  noteInput() {
    this.lastInput = performance.now();
    if (this.frameTimer === null || this.frameWakeBudget <= 1000 / 30) return;
    if (this.frameBudget(this.lastInput) >= this.frameWakeBudget) return;
    clearTimeout(this.frameTimer);
    this.frameTimer = null;
    this.scheduleFrame(this.lastInput);
  }

  /* A parked scene has no next frame coming, so anything that changes what the
     frame should look like has to ask for one. */
  repaint() {
    if (!this.running || !this.ctx || this.animId !== null) return;
    this.render(0);
    // A sky that held itself still may have something moving in it again.
    if (!this.held) this.resumeIfMoving();
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

  /* What the composed skies read from the rest of the page, any of: the
     person's layers, the working day { start, end } in hours, how full today's
     calendar is from 0 to 1, whether a focus session is on, and the place the
     sky is for. The land is worked out again only for a new place. */
  setWorld(world = {}) {
    if ("layers" in world) this.skyLayers = world.layers || null;
    if ("workday" in world) this.workday = world.workday || null;
    if ("dayLoad" in world) this.dayLoad = Number(world.dayLoad) || 0;
    if ("focusing" in world) this.focusing = Boolean(world.focusing);
    const moved = world.place && Number.isFinite(world.place.lat) && Number.isFinite(world.place.lon)
      && (world.place.lat !== this.place?.lat || world.place.lon !== this.place?.lon);
    if (moved) {
      this.place = { lat: world.place.lat, lon: world.place.lon };
      if (this.daylight) this.followSun();
    }
    if (this.composer) {
      this.composer.key = null;
      this.composer.readAt = 0;
      if (moved) this.composer.shapeKey = null;
    }
    this.quietSolvedAt = -Infinity;
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
    const entry = NordlysSkies.get(this.mode);
    // By day the sky steps back, and the night skies most of all: aurora, the stars, meteors.
    if (this.sky && !entry?.ownLight) this.ink *= 1 - this.sky.day * (NORDLYS_NIGHT_SCENES.has(this.mode) ? 0.45 : 0.18);
    this.ctx.globalAlpha = this.ink;
    this.held = false;

    // Each sky paints from its own file (src/js/skies), by the name it gave.
    const painter = NordlysSkies.painter(this.mode);
    if (painter) this[painter](dt);
    // A sky that draws its own sun draws the light of it too.
    if (this.sky && !entry?.ownSun) this.renderSunlight();
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

  /* `share` thins the field and `glare` is a bright body that washes out the
     stars around it — a moon behind cloud leaves a dark disc of sky starless,
     and a halo scene that ignored that would look pasted together. */
  renderStars({ share = 1, glare = null, night = null } = {}) {
    const light = this.lightMode;
    /* Following the sun, the stars are out at night and in the blue hour
       only. A scene with a sun of its own says how much night there is. */
    const dark = night ?? (this.sky ? Math.max(this.sky.night, this.sky.blue * 0.55) : null);
    const out = dark === null ? 1 : 0.15 + 0.85 * dark;
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

  /* The GPU line layer (sky-gl.js), for the screen only. A thumbnail and the
     quiet-zone sample are painted in 2D, which is quick at their size; so is
     everything where there is no WebGL2, or once the context is lost. */
  skyGL() {
    if (this.ctx !== this.screen || typeof NordlysSkyGL === "undefined") return null;
    if (this.gl === undefined) this.gl = NordlysSkyGL.create();
    if (this.gl?.lost) this.gl = null;
    return this.gl;
  }

  /* A palette colour taken `k` of the way to white, as [r, g, b]. */
  pale(index, k = 0) {
    const [r, g, b] = this.paletteRgb[index % this.paletteRgb.length];
    return [Math.round(r + (255 - r) * k), Math.round(g + (255 - g) * k), Math.round(b + (255 - b) * k)];
  }

  /* A soft ellipse of light, rx by ry, turned by `angle`, its alpha falling off
     from the centre along `stops` ([offset, share] pairs). One radial gradient
     squashed to shape and one fill over its own box, like drawShaft, whatever
     the size: the cheapest light the canvas has. On the scene's own context
     unless given a layer's. */
  glow(cx, cy, rx, ry, angle, rgb, alpha, stops = NORDLYS_SOFT, ctx = this.ctx) {
    if (!(alpha > 0.002) || !(rx > 0) || !(ry > 0)) return;
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

  /* ── The real sky ───────────────────────────────────────────────────
     Three scenes are drawn from the sky as it is for the person now: the
     Star map, Meteors and the Midnight sun. Where they are is the time
     zone's city (sky-zones.js), as it is for the daylight: no permission and
     no network. When is the engine's clock, which a test can hold and
     "Watch a day go by" runs through a day. */
  whereNow() {
    if (!this.place && window.NordlysSky?.zonePlace) {
      let zone;
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { zone = ""; }
      this.place = window.NordlysSky.zonePlace(zone || "", this.now());
    }
    return this.place || { lat: 52.5, lon: 13.4 };
  }

  /* What the Star map and Meteors look out on: a stereographic view centred
     on the horizon, which keeps a constellation its own shape wherever it
     stands, with the horizon a straight line low on the page and the zenith
     at the top. It faces the equator, where the sky does most of its
     turning; a shuffled sky faces another way. */
  skyView() {
    const place = this.whereNow();
    const facing = ((place.lat < 0 ? 0 : 180) + (this.chart?.turn || 0)) * Math.PI / 180;
    const horizon = this.h * NORDLYS_SKY_VIEW.horizon;
    const lat = place.lat * Math.PI / 180;
    return {
      place, horizon, cx: this.w / 2, scale: (horizon - this.h * NORDLYS_SKY_VIEW.zenith) / 2,
      sin: Math.sin(facing), cos: Math.cos(facing), sinLat: Math.sin(lat), cosLat: Math.cos(lat),
      // The local sidereal time in radians: the right ascension on the meridian now.
      sidereal: (window.NordlysSky?.siderealAngle?.(this.now(), place.lon) ?? 0) * Math.PI / 180
    };
  }

  /* A point of the sky by its right ascension and declination, as a
     direction east, north and up from where the person stands. */
  skyPoint(ascension, sinDec, cosDec, view) {
    const hour = view.sidereal - ascension;
    const cosHour = Math.cos(hour);
    return [-cosDec * Math.sin(hour), sinDec * view.cosLat - cosDec * cosHour * view.sinLat, sinDec * view.sinLat + cosDec * cosHour * view.cosLat];
  }

  // A direction in the sky onto the page, or null when it is behind the viewer.
  toPage(e, n, u, view) {
    const ahead = e * view.sin + n * view.cos;
    if (ahead < -0.5) return null;
    const k = (2 * view.scale) / (1 + ahead);
    return [view.cx + (e * view.cos - n * view.sin) * k, view.horizon - u * k];
  }

  // And back: the direction in the sky behind a point of the page.
  fromPage(x, y, view) {
    const px = (x - view.cx) / view.scale;
    const py = (view.horizon - y) / view.scale;
    const q = px * px + py * py;
    const ahead = (4 - q) / (4 + q);
    const right = (4 * px) / (4 + q);
    return [ahead * view.sin + right * view.cos, ahead * view.cos - right * view.sin, (4 * py) / (4 + q)];
  }

  // Whether a point of the page is under, or close to, the words on the sky.
  nearWords(x, y, pad = 0) {
    return this.quietZones.some((zone) => x > zone.x - pad && x < zone.x + zone.w + pad && y > zone.y - pad && y < zone.y + zone.h + pad);
  }

  /* Takes the sky back from under the words the page puts on it, feathered
     as the quiet zones are, so a figure fades out before the clock rather
     than running through it and no star sits in the date like a full stop. */
  clearWords(ctx) {
    if (!this.quietZones.length) return;
    const dpr = ctx.getTransform?.()?.a || 1;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    for (const zone of this.quietZones) {
      const feather = 18;
      const away = this.w + feather * 4;
      ctx.shadowColor = "rgba(0, 0, 0, 1)";
      ctx.shadowBlur = feather * dpr;
      ctx.shadowOffsetX = away * dpr;
      ctx.fillRect(zone.x - away - 10, zone.y - 10, zone.w + 20, zone.h + 20);
    }
    ctx.restore();
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

  /* Some WebKit sessions (a Safari private window among them) refuse to keep
     a Blob in IndexedDB. The file is then kept as its bytes and its type, and
     getMedia hands back the same Blob either way. */
  async saveMedia(id, blob, type) {
    const db = await this.open();
    const write = (record) => new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(this.STORE, "readwrite");
        tx.objectStore(this.STORE).put(record);
      } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const timestamp = Date.now();
    try {
      await write({ id, blob, type, timestamp });
    } catch (error) {
      await write({ id, bytes: await blob.arrayBuffer(), blobType: blob.type || type || "", type, timestamp });
    } finally {
      // Each call opens its own connection; one left open would block the next upgrade of the store.
      db.close();
    }
  },

  async getMedia(id) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, "readonly");
        const req = tx.objectStore(this.STORE).get(id);
        req.onsuccess = () => {
          const record = req.result;
          if (!record) resolve(null);
          else if (record.blob) resolve(record.blob);
          else resolve(record.bytes ? new Blob([record.bytes], { type: record.blobType || "" }) : null);
        };
        req.onerror = () => reject(req.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      // Closing waits for the transaction to finish; it only lets go of the connection.
      db.close();
    }
  },

  async deleteMedia(id) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, "readwrite");
        tx.objectStore(this.STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
};
