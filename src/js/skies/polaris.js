/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE POLARIS SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

/* Polaris: how long the exposure has been open, as an angle of the sky's turn;
   how fast the sky turns, per unit of the scene clock; and each trail's two
   bands, a faint glow either side of a fine core. */
const NORDLYS_POLARIS = { length: 0.5, turn: 0.012, bands: [[3.4, 0.14], [1, 1]] };

NordlysSkies.paint("polaris", "renderPolaris", {
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
  },

  polarisPole() {
    return { x: this.w * 0.83, y: this.h * 0.15 };
  },

  // How far the sky has turned: anticlockwise, as it turns about the north pole.
  polarisTurn() {
    return -this.t * NORDLYS_POLARIS.turn;
  },

  /* A star's light, 0 to 1: the mood's colour taken towards white on a dark
     sky; on a light one the colour as it is, since white would vanish. */
  starlight(star, light) {
    const rgb = this.pale(star.tone, light ? 0 : star.white);
    return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
  },

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
  },

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
  },

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
});
