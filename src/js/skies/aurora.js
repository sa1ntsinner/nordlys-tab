/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE AURORA SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

NordlysSkies.paint("aurora", "renderAurora", {
  renderAurora(dt) {
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
  },

  initNebulae() {
    // Very faint drifting colour fields behind the aurora
    this.nebulae = [
      { fx: 0.22, fy: 0.24, r: 0.42, color: "91, 108, 255", drift: 0.9 },
      { fx: 0.74, fy: 0.36, r: 0.38, color: "53, 214, 192", drift: 1.3 },
      { fx: 0.5, fy: 0.72, r: 0.46, color: "157, 78, 221", drift: 0.7 }
    ];
  },

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
  },

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
});
