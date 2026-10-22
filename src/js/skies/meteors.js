/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE METEORS SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

/* Meteors: one in this many seconds outside the showers, and at the peak of
   the strongest, at full motion — far livelier than the real sky, which
   manages one a minute at a good peak, and still calm. The scene clock is
   cut into slots of a second, each rolling its own dice. */
const NORDLYS_METEORS = { sporadic: 45, peak: 5, slot: 0.3 };

NordlysSkies.paint("meteors", "renderShowers", {
  /* ── Meteors ────────────────────────────────────────────────────────
     A calm field of faint stars and, now and then, a meteor: a short bright
     streak with a fading tail, gone in under a second. On most nights they
     are sporadic, one a minute or so, each from a direction of its own. On
     the nights of the big showers (sky-clock.js) they come more often and
     all from one point of the sky, the shower's radiant, from wherever it
     stands for the person now — and only while it is above their horizon,
     the higher the more. Even at the peak of the Geminids it is one every
     few seconds, where the real sky manages one a minute.

     Every meteor is a pure function of the scene clock and the seed. The
     clock is cut into slots, and each slot's dice say whether one starts in
     it, when, for how long, where and how bright; so a meteor is the same
     at any frame rate, and the engine knows when the next is due. Between
     meteors only the brighter stars twinkle, and the scene asks for a frame
     a tenth of a second at most; for a meteor it takes the full rate. */
  initField() {
    this.field = [];
    if (!this.w) return;
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x2545f491) >>> 0);
    const count = Math.round(Math.min(420, Math.max(150, (this.w * this.h) / 3400)));
    for (let i = 0; i < count; i++) {
      const bright = random() < 0.06;
      this.field.push({
        x: random(),
        y: random() * 0.95,
        r: bright ? 0.85 + random() * 0.7 : 0.3 + random() * 0.55,
        alpha: bright ? 0.5 + random() * 0.35 : 0.1 + Math.pow(random(), 1.6) * 0.45,
        tone: Math.floor(random() * 3),
        white: 0.55 + random() * 0.4,
        phase: random() * Math.PI * 2,
        rate: 6 + random() * 8,
        bright
      });
    }
  },

  renderShowers() {
    const ctx = this.ctx;
    const light = this.lightMode;
    const view = this.skyView();
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    // The night sky's own faint light, gathering towards the horizon.
    const low = ctx.createLinearGradient(0, this.h, 0, this.h * 0.3);
    low.addColorStop(0, this.rgba(1, light ? 0.07 : 0.1));
    low.addColorStop(0.5, this.rgba(2, light ? 0.025 : 0.035));
    low.addColorStop(1, this.rgba(2, 0));
    ctx.fillStyle = low;
    ctx.fillRect(0, this.h * 0.3, this.w, this.h * 0.7);
    /* The field, all but its brighter stars, cleared from under the words: a
       layer on the screen, drawn directly elsewhere. */
    if (ctx === this.screen && this.canvas && typeof document.createElement === "function") {
      const zones = this.quietZones.map((zone) => [zone.x, zone.y, zone.w, zone.h].map(Math.round).join()).join(";");
      const key = `${this.seed}:${this.w}x${this.h}:${this.dpr}:${this.palette.join()}:${light}:${zones}`;
      if (this.fieldLayer?.key !== key) {
        const layer = document.createElement("canvas");
        layer.width = this.canvas.width;
        layer.height = this.canvas.height;
        const paint = layer.getContext("2d");
        paint.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
        this.drawField(paint, light);
        this.clearWords(paint);
        this.fieldLayer = { key, canvas: layer };
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.fieldLayer.canvas, 0, 0);
      ctx.restore();
    } else {
      this.drawField(ctx, light);
      this.clearWords(ctx);
    }
    for (const star of this.field) {
      if (!star.bright || this.nearWords(star.x * this.w, star.y * this.h, star.r + 6)) continue;
      const alpha = star.alpha * (0.78 + 0.22 * Math.sin(this.t * star.rate + star.phase));
      const rgb = this.pale(star.tone, light ? 0 : star.white);
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x * this.w, star.y * this.h, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    /* A meteor is motion: held still, the sky keeps a few at their
       brightest, the way a long exposure catches them. */
    const falling = this.atRest() ? this.stillMeteors(view) : this.meteorsAt(this.t, view);
    for (const meteor of falling) this.drawMeteor(meteor, light);
    ctx.restore();
  },

  drawField(ctx, light) {
    for (const star of this.field) {
      if (star.bright) continue;
      const rgb = this.pale(star.tone, light ? 0 : star.white);
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(star.alpha * (light ? 0.8 : 1)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x * this.w, star.y * this.h, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /* How often meteors fall now, per second at full motion: the sporadic
     ones, and each shower under way by its activity and its rate — a strong
     shower's peak far livelier than a weak one's, but by the square root,
     so the Lyrids still show — and by how high its radiant stands: one on
     the horizon sends almost none, one below it none. Worked out once a
     minute; the radiant turns with the sky a quarter of a degree in that. */
  meteorRates(view) {
    const minute = Math.floor(this.now().getTime() / 60000);
    const where = `${minute}:${view.place.lat}:${view.place.lon}`;
    if (this.showerRates?.where === where) return this.showerRates;
    const showers = (window.NordlysSky?.meteorShowers?.(this.now()) || []).map((shower) => {
      const dec = shower.declination * Math.PI / 180;
      const point = this.skyPoint(shower.ascension * Math.PI / 180, Math.sin(dec), Math.cos(dec), view);
      const rate = (Math.max(0, point[2]) * shower.activity * Math.sqrt(shower.rate / 150)) / NORDLYS_METEORS.peak;
      return { name: shower.name, point, rate };
    }).filter((shower) => shower.rate > 0.0005);
    const total = 1 / NORDLYS_METEORS.sporadic + showers.reduce((sum, shower) => sum + shower.rate, 0);
    this.showerRates = { where, showers, total };
    return this.showerRates;
  },

  // A slot's dice: the same for the same seed and slot, whoever rolls them.
  slotDice(slot) {
    return NordlysBackgroundEngine.stream((Math.imul(slot | 0, 0x9e3779b1) ^ this.seed ^ 0x7f4a7c15) >>> 0);
  },

  /* The meteor that starts in a slot of the scene clock, if one does: when,
     for how long, and from which shower, if any. Its path is worked out only
     when it is drawn, from the same dice. */
  meteorIn(slot, rates) {
    const dice = this.slotDice(slot);
    // A slot is a second at full motion, so the rate per second is the chance per slot.
    if (dice() >= rates.total * (NORDLYS_METEORS.slot / 0.3)) return null;
    let pick = dice() * rates.total;
    let shower = null;
    for (const candidate of rates.showers) {
      if (pick < candidate.rate) { shower = candidate; break; }
      pick -= candidate.rate;
    }
    const start = (slot + dice()) * NORDLYS_METEORS.slot;
    return { dice, shower, start, life: 0.16 + dice() * 0.12 };
  },

  // The meteors alight at a moment of the scene clock, with how far through its life each is.
  meteorsAt(t, view) {
    const rates = this.meteorRates(view);
    const { slot } = NORDLYS_METEORS;
    const out = [];
    for (let k = Math.floor((t - 0.3) / slot); k <= Math.floor(t / slot); k++) {
      const meteor = this.meteorIn(k, rates);
      if (!meteor || t < meteor.start || t > meteor.start + meteor.life) continue;
      const path = this.meteorPath(meteor, view);
      if (path) out.push({ ...path, age: (t - meteor.start) / meteor.life });
    }
    return out;
  },

  /* Where a meteor runs: from a point of the sky — anywhere but behind the
     clock and the search field — away from its radiant along the great
     circle through both, so a shower's meteors all point back to one place
     even when it is off the page. Near the radiant they come almost towards
     the viewer and are short; far from it, long. A sporadic meteor has a
     radiant of its own, anywhere on the sky. */
  meteorPath({ dice, shower }, view) {
    let x = this.w * (0.05 + 0.9 * dice());
    const y = view.horizon * (0.05 + 0.72 * dice());
    if (y < this.h * 0.36 && Math.abs(x - this.w / 2) < this.w * 0.2) x += (x < this.w / 2 ? -1 : 1) * this.w * 0.3;
    const from = this.fromPage(x, y, view);
    const z = dice() * 2 - 1;
    const turn = dice() * Math.PI * 2;
    const radiant = shower?.point || [Math.sqrt(1 - z * z) * Math.cos(turn), Math.sqrt(1 - z * z) * Math.sin(turn), z];
    const along = from[0] * radiant[0] + from[1] * radiant[1] + from[2] * radiant[2];
    const away = [0, 1, 2].map((i) => from[i] * along - radiant[i]);
    const span = Math.hypot(away[0], away[1], away[2]);
    if (span < 0.02) return null;
    const length = (0.1 + 0.2 * dice()) * Math.max(0.3, span);
    const to = [0, 1, 2].map((i) => from[i] * Math.cos(length) + (away[i] / span) * Math.sin(length));
    let end = this.toPage(to[0], to[1], to[2], view);
    if (!end) return null;
    /* Far from the radiant a great circle bends in a view this wide, and
       streaks that bend do not point back to one place. So the streak runs
       straight out from where the radiant stands on the page, as a
       perspective view would draw it, as long as the sphere makes it; only a
       radiant behind the viewer is left to the sphere. */
    const centre = this.toPage(radiant[0], radiant[1], radiant[2], view);
    const out = centre ? Math.hypot(x - centre[0], y - centre[1]) : 0;
    if (out > 1) {
      const reach = Math.hypot(end[0] - x, end[1] - y);
      end = [x + ((x - centre[0]) / out) * reach, y + ((y - centre[1]) / out) * reach];
    }
    const bright = 0.5 + 0.5 * dice() ** 2;
    return { x0: x, y0: y, x1: end[0], y1: end[1], bright, width: 0.9 + bright * 0.8 };
  },

  /* The still: a long exposure's worth, up to three of the meteors the seed
     proposes — long enough to read at a thumbnail's size, clear of the board
     and of each other — all from the radiant of the strongest shower that is
     up, if one is. */
  stillMeteors(view) {
    const rates = this.meteorRates(view);
    const shower = rates.showers.reduce((best, candidate) => (!best || candidate.rate > best.rate ? candidate : best), null);
    const unit = Math.min(this.w, this.h);
    // A thumbnail lays the sky out three times its size; its streaks are drawn bolder to stay streaks.
    const bold = Math.max(1, Math.pow(1440 / Math.max(1, this.w), 0.75));
    const kept = [];
    for (let attempt = 0; attempt < 48 && kept.length < 3; attempt++) {
      const dice = NordlysBackgroundEngine.stream((this.seed ^ 0x6c8e9cf5 ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0);
      const path = this.meteorPath({ dice, shower }, view);
      if (!path) continue;
      const length = Math.hypot(path.x1 - path.x0, path.y1 - path.y0);
      const mid = [(path.x0 + path.x1) / 2, (path.y0 + path.y1) / 2];
      // An exposure keeps the whole of each trail, longer than the eye catches one.
      const trail = { ...path, x1: path.x0 + (path.x1 - path.x0) * 1.6, y1: path.y0 + (path.y1 - path.y0) * 1.6 };
      const open = Math.max(trail.y0, trail.y1) < this.h * 0.62 && (Math.abs(mid[0] - this.w / 2) > this.w * 0.24 || mid[1] < this.h * 0.3);
      const apart = kept.every((other) => Math.hypot(mid[0] - other.mid[0], mid[1] - other.mid[1]) > unit * 0.22);
      if (!open || !apart || length * 1.6 < unit * (kept.length ? 0.16 : 0.24)) continue;
      kept.push({ ...trail, mid, bright: kept.length ? 0.72 : 0.95, width: (kept.length ? 1.7 : 2.3) * bold, still: true });
    }
    return kept;
  },

  /* A meteor at a point of its life: the head travels the path, quickest at
     the start; it flares to its brightest early and burns out; behind it the
     tail is what it has just come through, fading to nothing. A streak and
     nothing else — no glow round the head. */
  drawMeteor({ x0, y0, x1, y1, bright, width, age = 0, still = false }, light) {
    const ctx = this.ctx;
    // Held still it is the whole trail an exposure keeps, bright at its end.
    const flare = still ? 1 : age < 0.15 ? age / 0.15 : Math.pow(1 - (age - 0.15) / 0.85, 1.4);
    const alpha = bright * flare * (light ? 0.75 : 1);
    if (alpha < 0.02) return;
    const travelled = still ? 1 : Math.pow(age, 0.8);
    const hx = x0 + (x1 - x0) * travelled;
    const hy = y0 + (y1 - y0) * travelled;
    const back = still ? 0.85 : Math.min(travelled, 0.38);
    const tx = hx - (x1 - x0) * back;
    const ty = hy - (y1 - y0) * back;
    if (Math.hypot(hx - tx, hy - ty) < 1) return;
    const head = light ? [28, 38, 72] : [255, 255, 255];
    const tint = light ? this.paletteRgb[1] : this.pale(0, 0.55);
    const trail = ctx.createLinearGradient(hx, hy, tx, ty);
    trail.addColorStop(0, `rgba(${head.join(", ")}, ${alpha.toFixed(3)})`);
    trail.addColorStop(0.3, `rgba(${tint.join(", ")}, ${(alpha * 0.55).toFixed(3)})`);
    trail.addColorStop(1, `rgba(${tint.join(", ")}, 0)`);
    ctx.strokeStyle = trail;
    ctx.lineWidth = width;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  },

  /* How long the next paint can wait in Meteors: a meteor in flight, or due
     within the budget, takes the full rate; otherwise the twinkle's. */
  meteorDue(budget) {
    if (!this.w) return budget;
    const view = this.skyView();
    const rates = this.meteorRates(view);
    // Scene time per millisecond at this motion.
    const pace = (0.005 * (this.motion ?? 1)) / 16.666;
    if (!(pace > 0)) return budget;
    const ahead = this.t + budget * pace;
    const { slot } = NORDLYS_METEORS;
    for (let k = Math.floor((this.t - 0.3) / slot); k <= Math.floor(ahead / slot); k++) {
      const meteor = this.meteorIn(k, rates);
      if (!meteor || meteor.start + meteor.life < this.t) continue;
      if (meteor.start <= ahead) return Math.max(0, (meteor.start - this.t) / pace);
    }
    return budget;
  }
});
