/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE CONTOUR SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

NordlysSkies.paint("contour", "renderContour", {
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
  },

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
  },

  renderContour() {
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
      const field = gl.layer("contour", version, () => this.contourStrip(levels, low, high, light, scale));
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
  },

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
  },

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
});
