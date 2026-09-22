/* The real sky, computed here and nowhere else: no location permission, no
   network, nothing but the date and the time zone. A moon that matches the one
   outside the window, a sky that turns gold when the sun sets where the person
   is — small things, and exactly the kind of thing a sky should get right.

   The phase uses the mean synodic month from a known new moon. The real Moon
   runs up to about half a day either side of the mean, which moves a thin
   crescent a sliver and nothing anyone looking at a new tab would see. */
(function () {
  const SYNODIC_DAYS = 29.530588853;
  // The new moon of 6 January 2000, 18:14 UTC.
  const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const DAY = 86400000;

  /* phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
     illumination: the lit fraction of the disc, 0 to 1. */
  function moonPhase(date = new Date()) {
    const days = (date.getTime() - REFERENCE_NEW_MOON) / DAY;
    const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
    const phase = age / SYNODIC_DAYS;
    const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    return { age, phase, illumination, waxing: phase < 0.5 };
  }

  /* The eight names, each owning the stretch of the month around its moment,
     so "full" means within a day or so of full rather than an instant. */
  const NAMES = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];
  function phaseName(phase) {
    return NAMES[Math.round(((phase % 1) + 1) % 1 * 8) % 8];
  }

  /* ── The sun ────────────────────────────────────────────────────
     Where it stands, from the date and a place: the low-precision formulae of
     the Astronomical Almanac, good to a fraction of a degree for decades
     either side of 2000 — a sky's colour needs far less. */
  const RAD = Math.PI / 180;
  function sunPosition(date, lat, lon) {
    const days = date.getTime() / DAY - 10957.5; // since noon UTC, 1 January 2000
    const anomaly = RAD * (((357.529 + 0.98560028 * days) % 360) + 360);
    const mean = (280.459 + 0.98564736 * days) % 360;
    const ecliptic = RAD * (mean + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly));
    const tilt = RAD * (23.439 - 0.00000036 * days);
    const ascension = Math.atan2(Math.cos(tilt) * Math.sin(ecliptic), Math.cos(ecliptic));
    const declination = Math.asin(Math.sin(tilt) * Math.sin(ecliptic));
    const sidereal = ((18.697374558 + 24.06570982441908 * days) % 24 + 24) % 24;
    const hour = RAD * (sidereal * 15 + lon) - ascension;
    const phi = RAD * lat;
    const elevation = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hour)) / RAD;
    const azimuth = ((Math.atan2(-Math.sin(hour), Math.tan(declination) * Math.cos(phi) - Math.sin(phi) * Math.cos(hour)) / RAD) + 360) % 360;
    // The hour angle, folded into ±180°: negative before the sun's highest point.
    const angle = ((hour / RAD) % 360 + 540) % 360 - 180;
    return { elevation, azimuth, declination: declination / RAD, rising: angle < 0 };
  }

  /* Where the person roughly is, from nothing but their time zone — the
     principal city of the zone (sky-zones.js). Without a match, the standard
     offset from UTC gives a longitude and the hemisphere a latitude. */
  function zonePlace(zone, date = new Date()) {
    const [region, ...rest] = String(zone || "").split("/");
    const found = window.NORDLYS_ZONES?.[region]?.[rest.join("/")];
    if (found) return { lat: found[0] / 10, lon: found[1] / 10, from: "zone" };
    const year = date.getFullYear();
    // The smaller of winter's and summer's offset is the zone's standard time.
    const offset = Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset());
    return { lat: 40, lon: -offset / 4, from: "offset" };
  }

  const smooth = (from, to, value) => {
    const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };

  /* The light of the moment as a handful of weights the sky mixes with: how
     much of the day there is, of the golden hour around sunrise and sunset, of
     the blue hour either side of it, and of the night. They overlap and blend,
     so the sky never switches, it turns. */
  function daylight(date, place) {
    const sun = sunPosition(date, place.lat, place.lon);
    const e = sun.elevation;
    // Each ramp spans several degrees: near the equator the sun crosses one
    // in four minutes, and five minutes should never look like a switch.
    const day = smooth(-1, 15, e);
    const golden = smooth(-8, 1, e) * (1 - smooth(4, 16, e));
    const blue = smooth(-15, -7, e) * (1 - smooth(-5, 1, e));
    const night = 1 - smooth(-17, -9, e);
    const phase = e >= 6 ? (sun.rising ? "morning" : "afternoon")
      : e >= -4 ? (sun.rising ? "sunrise" : "sunset")
      : e >= -12 ? (sun.rising ? "dawn" : "dusk")
      : "night";
    return { ...sun, day, golden, blue, night, phase };
  }

  /* The three colours of a mood as that light falls on them. The mood stays
     itself: a hue is only ever drawn a little way towards the light, and only
     as far as it is already near it — a blue leans violet at sunset and an
     orange leans gold, while a teal, far from both, stays teal instead of
     souring into lime. The warmth of a sunset comes mostly from the glow
     drawn over the sky (renderSunlight), which is where it looks like light.
     The blue hour and the night draw hues towards twilight blue; the day
     pales and lifts them. A grey mood is given a trace of the light's colour,
     or it would never see a sunset at all. */
  function lightMood(colors, sky, { light = false } = {}) {
    const colour = window.NordlysColour;
    if (!colour || !sky) return colors;
    // Squared, so a hue a third of the circle away barely stirs.
    const lean = (hue, target, strength) => {
      const delta = Math.atan2(Math.sin(target - hue), Math.cos(target - hue));
      const near = Math.max(0, 1 - Math.abs(delta) / Math.PI);
      return hue + delta * strength * near * near;
    };
    const gold = (sky.rising ? 36 : 46) * RAD;
    const rose = (sky.rising ? 332 : 318) * RAD;
    const twilight = 252 * RAD;
    return colors.map((hex) => {
      const rgb = colour.hexToRgb(hex);
      if (!rgb) return hex;
      let [L, C, H] = colour.toOklch(rgb);
      if (C < 0.02) { H = sky.golden >= sky.blue ? gold : twilight; C += 0.035 * Math.max(sky.golden, sky.blue); }
      const warm = Math.abs(Math.atan2(Math.sin(gold - H), Math.cos(gold - H))) < Math.abs(Math.atan2(Math.sin(rose - H), Math.cos(rose - H))) ? gold : rose;
      H = lean(H, warm, 0.5 * sky.golden);
      H = lean(H, twilight, 0.4 * sky.blue + 0.15 * sky.night);
      C *= 1 - 0.3 * sky.day + 0.12 * sky.golden;
      L += light ? 0.015 * sky.day : 0.05 * sky.day - 0.025 * sky.night;
      return colour.rgbToHex(colour.displayable(Math.min(0.95, Math.max(0.2, L)), Math.max(0, C), H));
    });
  }

  window.NordlysSky = { moonPhase, phaseName, SYNODIC_DAYS, sunPosition, zonePlace, daylight, lightMood };
})();
