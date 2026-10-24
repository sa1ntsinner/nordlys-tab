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
  // Days since noon UTC on 1 January 2000, the moment the formulae count from.
  const sinceEpoch = (date) => date.getTime() / DAY - 10957.5;

  /* The local sidereal time, as an angle: the right ascension standing on the
     meridian at a longitude at that moment, in degrees. A point of the sky's
     hour angle is this less its right ascension. */
  function siderealAngle(date, lon) {
    const sidereal = ((18.697374558 + 24.06570982441908 * sinceEpoch(date)) % 24 + 24) % 24;
    return ((sidereal * 15 + lon) % 360 + 360) % 360;
  }

  /* A point of the sky as it stands for someone at a latitude: its height
     above the horizon and its bearing from north, in degrees, from its hour
     angle and declination in radians. The sun is one such point, and so is
     every star of the Star map and the radiant of every meteor shower. */
  function horizontal(hour, declination, lat) {
    const phi = RAD * lat;
    const elevation = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hour)) / RAD;
    const azimuth = ((Math.atan2(-Math.sin(hour), Math.tan(declination) * Math.cos(phi) - Math.sin(phi) * Math.cos(hour)) / RAD) + 360) % 360;
    return { elevation, azimuth };
  }

  function sunPosition(date, lat, lon) {
    const days = sinceEpoch(date);
    const anomaly = RAD * (((357.529 + 0.98560028 * days) % 360) + 360);
    const mean = (280.459 + 0.98564736 * days) % 360;
    const ecliptic = RAD * (mean + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly));
    const tilt = RAD * (23.439 - 0.00000036 * days);
    const ascension = Math.atan2(Math.cos(tilt) * Math.sin(ecliptic), Math.cos(ecliptic));
    const declination = Math.asin(Math.sin(tilt) * Math.sin(ecliptic));
    const hour = RAD * siderealAngle(date, lon) - ascension;
    const { elevation, azimuth } = horizontal(hour, declination, lat);
    // The hour angle, folded into ±180°: negative before the sun's highest point.
    const angle = ((hour / RAD) % 360 + 540) % 360 - 180;
    // Where the sun is on the ecliptic, which is what the calendar of meteor showers is kept in.
    const longitude = ((ecliptic / RAD) % 360 + 360) % 360;
    return { elevation, azimuth, declination: declination / RAD, longitude, angle, rising: angle < 0 };
  }

  /* The moon's place in the sky, from the same Almanac's low-precision
     formulae: its longitude to a third of a degree, its latitude a little
     better, and the parallax of a body this near — up to a degree low on the
     horizon — left out. Enough to put it over the right stretch of sea. */
  function moonPosition(date, lat, lon) {
    const days = sinceEpoch(date);
    const anomaly = RAD * (134.963 + 13.064993 * days);
    const node = RAD * (93.272 + 13.22935 * days);
    const longitude = RAD * (218.316 + 13.176396 * days) + RAD * 6.289 * Math.sin(anomaly);
    const latitude = RAD * 5.128 * Math.sin(node);
    const tilt = RAD * (23.439 - 0.00000036 * days);
    const ascension = Math.atan2(Math.sin(longitude) * Math.cos(tilt) - Math.tan(latitude) * Math.sin(tilt), Math.cos(longitude));
    const declination = Math.asin(Math.sin(latitude) * Math.cos(tilt) + Math.cos(latitude) * Math.sin(tilt) * Math.sin(longitude));
    return horizontal(RAD * siderealAngle(date, lon) - ascension, declination, lat);
  }

  /* ── Meteor showers ─────────────────────────────────────────────
     The seven big showers of the year, as the International Meteor
     Organization lists them: where the sun stands on the ecliptic at the peak
     (which keeps a shower on the same night each year, a leap day aside), the
     zenithal hourly rate at the peak, the radiant in degrees of right
     ascension and declination, and how many days the shower takes to rise and
     to fall. The radiant creeps a degree or so a day; it is held where it
     stands at the peak, which nobody watching a new tab could tell apart. */
  const SHOWERS = [
    // name, solar longitude at the peak, rate, radiant, days either side
    ["quadrantids", 283.15, 110, 230, 49, 0.8],
    ["lyrids", 32.32, 18, 271, 34, 1.3],
    ["etaAquariids", 45.5, 50, 338, -1, 4],
    ["perseids", 140, 100, 48, 58, 2.5],
    ["orionids", 208, 20, 95, 16, 3.5],
    ["leonids", 235.27, 15, 152, 22, 1.5],
    ["geminids", 262.2, 150, 112, 33, 1.8]
  ];

  /* The showers under way at a moment, each with how far it is from its peak
     in days and its activity: a bell around the peak, 1 at it, nearly
     nothing three spreads away. */
  function meteorShowers(date = new Date()) {
    const sun = sunPosition(date, 0, 0).longitude;
    return SHOWERS.map(([name, peak, rate, ascension, declination, spread]) => {
      // The sun moves a little under a degree a day.
      const days = (((sun - peak) % 360 + 540) % 360 - 180) / 0.9856;
      return { name, rate, ascension, declination, days, activity: Math.exp(-((days / spread) ** 2) / 2) };
    }).filter((shower) => shower.activity > 0.01);
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
    return { ...sun, ...lightAt(sun.elevation, sun.rising) };
  }

  /* The same weights for a sun at any height, real or not: the composed skies
     hold an hour still, or let the working day stand in for the day. */
  function lightAt(e, rising) {
    // Each ramp spans several degrees: near the equator the sun crosses one
    // in four minutes, and five minutes should never look like a switch.
    const day = smooth(-1, 15, e);
    const golden = smooth(-8, 1, e) * (1 - smooth(4, 16, e));
    const blue = smooth(-15, -7, e) * (1 - smooth(-5, 1, e));
    const night = 1 - smooth(-17, -9, e);
    const phase = e >= 6 ? (rising ? "morning" : "afternoon")
      : e >= -4 ? (rising ? "sunrise" : "sunset")
      : e >= -12 ? (rising ? "dawn" : "dusk")
      : "night";
    return { day, golden, blue, night, phase };
  }

  /* The Time of day mood: the colours of the sky itself for where the sun is,
     three at a time (a light, a middle, a depth). Kept as moments by the
     sun's height, one run for the morning and one for the afternoon, since a
     sky at ten degrees is rose at dawn and amber at dusk: the night deep blue
     and indigo, dawn rose and lilac, sunrise gold and coral, the morning a
     fresh clear blue, the high day the palest and brightest, the afternoon
     warmer, the golden hour amber and pink, dusk violet, midnight deepest.
     Between two moments the colours are blended in OKLab, straight across
     rather than round the hue circle, so gold going to blue passes through a
     pale haze and not through green; the morning and afternoon runs are
     blended across noon and midnight, so the sky turns and never switches. */
  const NIGHT = [[-90, ["#5b6fe0", "#2d2c8c", "#1b1450"]], [-28, ["#5b6fe0", "#2d2c8c", "#1b1450"]], [-12, ["#7d95ff", "#4b45b5", "#2a2068"]]];
  const HIGH = [[40, ["#eefaff", "#86d0ff", "#3c8af2"]], [90, ["#eefaff", "#86d0ff", "#3c8af2"]]];
  const DAY_MOMENTS = {
    morning: [...NIGHT,
      [-6, ["#8fb0ff", "#6f5fd6", "#3b2f86"]],
      [-2, ["#ffb0c8", "#b48cf0", "#4b4aa8"]],
      [2, ["#ffc27a", "#ff7d92", "#7a5cd0"]],
      [8, ["#ffe2a6", "#ffa88a", "#5d8fe8"]],
      [18, ["#c9ecff", "#74b8ff", "#4a74e0"]],
      ...HIGH],
    afternoon: [...NIGHT,
      [-6, ["#9d8dff", "#6a4fcf", "#33246f"]],
      [-2, ["#ff98b0", "#c06ad0", "#4c3aa0"]],
      [2, ["#ffa25e", "#ff5f7a", "#7e3fb8"]],
      [8, ["#ffd27c", "#ff8c5e", "#8a5ccc"]],
      [18, ["#ffe2ad", "#9cc0ff", "#5a70cf"]],
      ...HIGH]
  };

  function dayColours(sky) {
    const colour = window.NordlysColour;
    const lab = (hex) => { const [L, C, H] = colour.toOklch(colour.hexToRgb(hex)); return [L, C * Math.cos(H), C * Math.sin(H)]; };
    const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
    const at = (moments) => {
      const e = Math.max(-90, Math.min(90, sky.elevation));
      let i = 0;
      while (e > moments[i + 1][0]) i++;
      const [from, a] = moments[i];
      const [to, b] = moments[i + 1];
      return a.map((hex, k) => mix(lab(hex), lab(b[k]), (e - from) / (to - from)));
    };
    // All morning before noon and all afternoon after it, half and half at noon and at midnight.
    const morning = 0.5 + 0.5 * Math.max(-1, Math.min(1, -2.5 * Math.sin((sky.angle ?? (sky.rising ? -90 : 90)) * RAD)));
    const am = at(DAY_MOMENTS.morning);
    const pm = at(DAY_MOMENTS.afternoon);
    return am.map((c, k) => {
      const [L, A, B] = mix(pm[k], c, morning);
      return colour.rgbToHex(colour.displayable(L, Math.hypot(A, B), Math.atan2(B, A)));
    });
  }

  /* Where the sky is: the place the person gave the sky, else the weather
     card's, else the principal city of the time zone. */
  function placeOf(config) {
    const own = config && config.skyPlace;
    if (own && Number.isFinite(own.lat) && Number.isFinite(own.lon)) return own;
    for (const widget of config?.dashboard?.widgets || []) {
      const place = widget && widget.type === "weather" && widget.settings && widget.settings.place;
      if (place && Number.isFinite(place.lat) && Number.isFinite(place.lon)) return place;
    }
    let zone = "";
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (error) { /* the offset will do */ }
    const found = zonePlace(zone);
    return found ? { ...found, name: zone.split("/").pop().replace(/_/g, " ") } : { lat: 52.5, lon: 13.4, name: "" };
  }

  window.NordlysSky = { moonPhase, phaseName, SYNODIC_DAYS, sunPosition, moonPosition, siderealAngle, horizontal, meteorShowers, zonePlace, placeOf, daylight, lightAt, dayColours };
})();
