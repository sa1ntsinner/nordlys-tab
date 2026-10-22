/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE SILK SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

/* Silk strokes each thread three times, wide and faint first: the bloom gives a
   strand air, the core gives it an edge, and neither alone reads as fibre. */
const NORDLYS_SILK_PASSES = [
  { width: 6, alpha: 0.22 },
  { width: 2.4, alpha: 0.5 },
  { width: 1, alpha: 1 }
];
// The same passes as the GPU layer draws them: bands across one strip.
const NORDLYS_SILK_BANDS = NORDLYS_SILK_PASSES.map((pass) => [pass.width, pass.alpha]);

NordlysSkies.paint("silk", "renderSilk", {
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
  },

  /* Three sine terms, not noise: a gradient-noise field would need a table and
     an interpolation per step, and at this scale nobody can tell the two apart
     — but everybody can tell a dropped frame. */
  silkAngle(x, y, swirl) {
    const nx = x / this.w;
    const ny = y / this.h;
    return (Math.sin(nx * 2.7 + this.t * 0.26 + swirl * 0.08) * 1.15
      + Math.cos(ny * 3.4 - this.t * 0.19) * 0.95
      + Math.sin((nx * 1.7 - ny * 2.2) * 2.1 + this.t * 0.12) * 0.55) * 0.62;
  },

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
  },

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
  },

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
});
