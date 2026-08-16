/* ═══════════════════════════════════════════════════════════════════
   AURORA TAB 2.1 - MULTI-SHADER BACKGROUND & VISUAL ENGINE
   Time-based (refresh-rate independent), light/dark aware, zero idle cost.
   ═══════════════════════════════════════════════════════════════════ */

class AuroraBackgroundEngine {
  constructor() {
    this.canvas = document.getElementById("bg-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d", { alpha: true, desynchronized: true }) : null;
    this.animId = null;
    this.stars = [];
    this.meteors = [];
    this.particles = [];
    this.meshOrbs = [];
    this.nebulae = [];
    this.t = 0;
    this.lastFrame = 0;
    this.running = false;
    this.mode = "aurora"; // 'aurora', 'cosmos', 'mesh-gradient', 'particles', 'custom-image', 'custom-video', 'solid'
    this.isMousePending = false;
    this.mouseX = 50;
    this.mouseY = 50;

    // Per-theme shader palette (filled from CSS --shader-1..3 tokens)
    this.palette = ["#35d6c0", "#5b6cff", "#9d4edd"];
    this.paletteRgb = [[53, 214, 192], [91, 108, 255], [157, 78, 221]];

    this.init();
    this.refreshPalette();
  }

  /* Reads the active theme's --shader-1..3 tokens so every theme paints
     its own aurora / nebulae / orbs / particles instead of one fixed set. */
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
    this.meshOrbs.forEach((orb, i) => {
      orb.color = this.palette[i % 3];
    });
    this.particles.forEach((p, i) => {
      p.color = this.palette[i % 3];
      p.lightColor = this.palette[i % 3];
    });
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
        this.initParticles();
        this.initMeshOrbs();
        this.initNebulae();
        this.refreshPalette();
      }, 120);
    }, { passive: true });

    // Throttled High-Frequency Mouse Tracking (rAF-synced CSS vars + particle field)
    window.addEventListener("pointermove", (e) => {
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

    // Page Visibility API - zero CPU/GPU waste when tab is in background
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stop();
      } else if (["aurora", "cosmos", "mesh-gradient", "particles"].includes(this.mode)) {
        this.start();
      }
    });

    this.initStars();
    this.initParticles();
    this.initMeshOrbs();
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

  initParticles() {
    this.particles = [];
    const count = 45;
    const darkColors = ["#7c9cff", "#35d6c0", "#f472b6", "#a855f7"];
    const lightColors = ["#4361ee", "#0d9488", "#db2777", "#7c3aed"];
    for (let i = 0; i < count; i++) {
      const colorIdx = Math.floor(Math.random() * 4);
      this.particles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 3 + 1,
        color: darkColors[colorIdx],
        lightColor: lightColors[colorIdx],
        alpha: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  initMeshOrbs() {
    this.meshOrbs = [
      { x: this.w * 0.2, y: this.h * 0.3, r: 280, color: "#3b82f6", vx: 0.3, vy: 0.2 },
      { x: this.w * 0.8, y: this.h * 0.4, r: 320, color: "#8b5cf6", vx: -0.2, vy: 0.3 },
      { x: this.w * 0.5, y: this.h * 0.7, r: 300, color: "#ec4899", vx: 0.25, vy: -0.2 }
    ];
  }

  initNebulae() {
    // Very faint drifting color fields behind the aurora / cosmos scenes
    this.nebulae = [
      { fx: 0.22, fy: 0.24, r: 0.42, color: "91, 108, 255", drift: 0.9 },
      { fx: 0.74, fy: 0.36, r: 0.38, color: "53, 214, 192", drift: 1.3 },
      { fx: 0.5, fy: 0.72, r: 0.46, color: "157, 78, 221", drift: 0.7 }
    ];
  }

  setMode(mode) {
    this.mode = mode;
    if (["aurora", "cosmos", "mesh-gradient", "particles"].includes(mode)) {
      if (this.canvas) this.canvas.style.display = "block";
      this.start();
    } else {
      if (this.canvas) this.canvas.style.display = "none";
      this.stop();
    }
  }

  start() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      // dt normalized to 60fps units so speed is identical on 60/120/144Hz panels
      const dt = Math.min((now - this.lastFrame) / 16.666, 3);
      this.lastFrame = now;
      this.render(dt);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
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
    if (["aurora", "cosmos", "mesh-gradient", "particles"].includes(this.mode)) {
      this.start();
    }
  }

  render(dt = 1) {
    if (!this.ctx) return;
    this.t += 0.005 * dt;
    this.ctx.clearRect(0, 0, this.w, this.h);

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
      case "cosmos":
        this.renderNebulae(0.07);
        this.renderStars();
        this.renderMeteors(0.008, dt); // Higher frequency meteors in deep space
        break;
      case "mesh-gradient":
        this.renderMeshGradients(dt);
        break;
      case "particles":
        this.renderParticles(dt);
        break;
    }
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
    if (Math.random() < chance * dt && this.meteors.length < 3) {
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
      m.x += Math.cos(m.angle) * m.speed * dt;
      m.y += Math.sin(m.angle) * m.speed * dt;
      m.life -= 0.028 * dt;

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

  renderMeshGradients(dt = 1) {
    const light = this.lightMode;
    this.ctx.save();
    this.ctx.globalCompositeOperation = light ? "multiply" : "screen";
    this.meshOrbs.forEach((orb) => {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (orb.x < 0 || orb.x > this.w) orb.vx *= -1;
      if (orb.y < 0 || orb.y > this.h) orb.vy *= -1;

      const grad = this.ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
      grad.addColorStop(0, orb.color);
      grad.addColorStop(0.6, `${orb.color}33`);
      grad.addColorStop(1, "transparent");

      this.ctx.fillStyle = grad;
      this.ctx.globalAlpha = light ? 0.20 : 0.35;
      this.ctx.beginPath();
      this.ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.restore();
  }

  renderParticles(dt = 1) {
    const light = this.lightMode;
    // Interactive bokeh: dust drifts freely and is softly attracted to the pointer
    const px = (this.mouseX / 100) * this.w;
    const py = (this.mouseY / 100) * this.h;
    const pullRadius = Math.min(this.w, this.h) * 0.28;

    this.ctx.save();
    this.ctx.globalCompositeOperation = light ? "multiply" : "screen";

    this.particles.forEach((p) => {
      const dx = px - p.x;
      const dy = py - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < pullRadius) {
        const force = (1 - dist / pullRadius) * 0.012 * dt;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      // Speed cap keeps the swarm dreamy instead of frantic
      const speed = Math.hypot(p.vx, p.vy);
      const maxSpeed = 0.9;
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) p.x = this.w;
      if (p.x > this.w) p.x = 0;
      if (p.y < 0) p.y = this.h;
      if (p.y > this.h) p.y = 0;

      const breathe = 0.85 + Math.sin(this.t * 2 + p.phase) * 0.15;
      this.ctx.fillStyle = light ? (p.lightColor || p.color) : p.color;
      this.ctx.globalAlpha = (light ? p.alpha * 0.75 : p.alpha) * breathe;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r * breathe, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }
}

/* ── IndexedDB Media Vault ─────────────────────────────────────── */
const MediaVault = {
  DB_NAME: "AuroraTab_MediaVault",
  STORE: "wallpapers",

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
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
