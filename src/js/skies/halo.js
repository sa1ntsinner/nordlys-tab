/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE HALO SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class. */

NordlysSkies.paint("halo", "renderHalo", {
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
  },

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
  },

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
  },

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
}, {
  southern() {
    let zone;
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return false; }
    return /^(Australia|Antarctica)\/|^America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Punta_Arenas)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka|Maseru|Mbabane|Blantyre|Lubumbashi)|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Noumea|Efate)|^Indian\/(Mauritius|Reunion|Antananarivo)|^Atlantic\/Stanley/.test(zone);
  }
});
