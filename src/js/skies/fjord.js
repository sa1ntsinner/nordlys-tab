/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE FJORD SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

NordlysSkies.paint("fjord", "renderFjord", {
  /* A low luminous horizon keeps the centre calm for the clock and search.
     Its movement is only a slow breath, making it the least animated scene. */
  renderFjord() {
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
});
