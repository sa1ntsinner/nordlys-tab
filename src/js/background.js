/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - BACKGROUND SCENES & VISUAL ENGINE
   Time-based (refresh-rate independent), light/dark aware, zero idle cost.
   ═══════════════════════════════════════════════════════════════════ */

class NordlysBackgroundEngine {
  constructor() {
    this.canvas = document.getElementById("bg-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d", { alpha: true, desynchronized: true }) : null;
    this.animId = null;
    this.stars = [];
    this.meteors = [];
    this.nebulae = [];
    this.t = 0;
    this.lastFrame = 0;
    this.running = false;
    /* One living scene. Cosmos was Aurora with the aurora removed — the same
       nebulae, stars and meteors, minus the ribbons that give the thing its
       name — and Particles measured 0.08 of 255 different from a plain colour,
       while both held a full animation loop open to draw it. Stillness is not a
       scene at all now: it is this one with its motion at zero, painted once
       and held, which costs nothing to keep and lets the glass above it stop
       re-blurring every frame. */
    this.mode = "aurora"; // 'aurora', 'custom-image', 'custom-video', 'solid'
    this.motion = 1;
    this.intensity = 1;
    this.isMousePending = false;
    this.mouseX = 50;
    this.mouseY = 50;
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Per-theme shader palette (filled from CSS --shader-1..3 tokens)
    this.palette = ["#35d6c0", "#5b6cff", "#9d4edd"];
    this.paletteRgb = [[53, 214, 192], [91, 108, 255], [157, 78, 221]];

    this.init();
    this.refreshPalette();
  }

  /* Reads the active theme's --shader-1..3 tokens so every theme paints
     its own aurora and nebulae instead of one fixed set. */
  refreshPalette() {
    const styles = getComputedStyle(document.documentElement);
    const fallback = ["#35d6c0", "#5b6cff", "#9d4edd"];
    const colors = [1, 2, 3].map((i, idx) => {
      const v = styles.getPropertyValue(`--shader-${i}`).trim();
      return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback[idx];
    });
    this.palette = colors;
    this.paletteRgb = colors.map((hex) => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });

    // Re-tint the animated fields in place
    this.nebulae.forEach((n, i) => {
      n.color = this.paletteRgb[i % 3].join(", ");
    });
    this.repaint();
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
        this.initStars();
        this.initNebulae();
        this.refreshPalette();
      }, 120);
    }, { passive: true });

    // Throttled High-Frequency Mouse Tracking (rAF-synced CSS vars + particle field)
    window.addEventListener("pointermove", (e) => {
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
      } else if (this.mode === "aurora") {
        this.start();
        this.resumeIfMoving();
      }
    });

    // Page Visibility API - zero CPU/GPU waste when tab is in background
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stop();
      } else if (this.mode === "aurora") {
        this.start();
      }
    });

    this.initStars();
    this.initNebulae();
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
        x: Math.random() * this.w,
        y: Math.random() * (this.h * 0.85),
        r: Math.random() * 1.2 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        // A few "hero" stars twinkle brighter with a soft halo
        hero: Math.random() < 0.06
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
    this.mode = mode;
    if (mode === "aurora") {
      if (this.canvas) this.canvas.style.display = "block";
      this.start();
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
      // dt normalized to 60fps units so speed is identical on 60/120/144Hz panels
      const dt = Math.min((now - this.lastFrame) / 16.666, 3);
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
    if (this.mode === "aurora") {
      this.start();
    }
  }

  /* Two knobs the settings expose, applied once for every scene rather than per
     effect: how fast the world advances, and how present it is. Before this the
     modes differed only in which particles they drew, so switching between them
     read as no change at all. */
  setAtmosphere({ motion, intensity } = {}) {
    if (Number.isFinite(motion)) this.motion = Math.max(0, Math.min(1.5, motion));
    if (Number.isFinite(intensity)) this.intensity = Math.max(0.15, Math.min(1.5, intensity));
    this.resumeIfMoving();
    this.repaint();
  }

  render(dt = 1) {
    if (!this.ctx) return;
    this.t += 0.005 * dt * (this.motion ?? 1);
    this.ctx.clearRect(0, 0, this.w, this.h);
    // Scenes paint with their own alphas; scaling the whole canvas keeps their
    // internal balance while still letting the user dial the atmosphere down.
    const presence = this.intensity ?? 1;
    if (presence < 1) this.ctx.globalAlpha = presence;

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
    }
    this.ctx.globalAlpha = 1;
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

  renderStars() {
    const light = this.lightMode;
    this.ctx.fillStyle = light ? "rgba(60, 80, 130, 0.75)" : "rgba(225, 240, 255, 0.75)";
    for (let s of this.stars) {
      const a = s.alpha + Math.sin(this.t * 1.8 + s.phase) * 0.2;
      this.ctx.globalAlpha = Math.max(0.05, Math.min(0.85, a));
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      this.ctx.fill();
      if (s.hero && a > 0.6) {
        // Soft halo bloom on the brightest twinkle peaks
        this.ctx.globalAlpha = (a - 0.6) * (light ? 0.3 : 0.5);
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, s.r * (light ? 2.4 : 3.2), 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1;
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
      let m = this.meteors[i];
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
    this.ctx.globalAlpha = baseAlpha * alphaMultiplier * (0.85 + Math.sin(this.t * 0.9 + baseYFactor * 8) * 0.15);

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
