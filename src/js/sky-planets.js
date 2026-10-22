/* The bright planets, where they stand tonight.

   Venus, Mars, Jupiter and Saturn are the four a person can find without
   trying, and each is put where it is from its orbit: the mean elements and
   how they drift, from Paul Schlyter's "How to compute planetary positions",
   good to a minute of arc or two over this century. That is far finer than a
   dot on a new tab needs, and it costs a few dozen multiplications a minute.
   The bearing and height come out the same way as the sun's (sky-clock.js),
   so a planet sets behind the same horizon the sun does. */
(function (root) {
  "use strict";

  const RAD = Math.PI / 180;
  // Days since 0h on 31 December 1999, the moment the elements count from.
  const dayNumber = (date) => date.getTime() / 86400000 - 10956;
  const wrap = (degrees) => ((degrees % 360) + 360) % 360;

  /* Each orbit: the ascending node N, inclination i, argument of perihelion w,
     mean distance a (AU), eccentricity e and mean anomaly M, as [at the epoch,
     change a day]; with how bright it shines (a typical magnitude) and its
     colour, which is what a dot on a page can show of a planet. */
  const ORBITS = {
    venus: { N: [76.6799, 2.4659e-5], i: [3.3946, 2.75e-8], w: [54.891, 1.38374e-5], a: [0.72333, 0], e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244], mag: -4.2, rgb: [255, 246, 222] },
    mars: { N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8], w: [286.5016, 2.92961e-5], a: [1.523688, 0], e: [0.093405, 2.516e-9], M: [18.6021, 0.5240207766], mag: 0.6, rgb: [255, 172, 128] },
    jupiter: { N: [100.4542, 2.76854e-5], i: [1.303, -1.557e-7], w: [273.8777, 1.64505e-5], a: [5.20256, 0], e: [0.048498, 4.469e-9], M: [19.895, 0.0830853001], mag: -2.2, rgb: [255, 236, 210] },
    saturn: { N: [113.6634, 2.3898e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: [9.55475, 0], e: [0.055546, -9.499e-9], M: [316.967, 0.0334442282], mag: 0.7, rgb: [250, 226, 176] }
  };
  const EARTH = { w: [282.9404, 4.70935e-5], e: [0.016709, -1.151e-9], M: [356.047, 0.9856002585] };

  const at = ([base, rate], d) => base + rate * d;

  // Kepler's equation, solved by a few rounds of Newton: enough for these orbits.
  function eccentricAnomaly(M, e) {
    let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    for (let step = 0; step < 4; step++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
  }

  // A body's place in its orbit: its true anomaly and its distance.
  function inOrbit(M, e, a) {
    const E = eccentricAnomaly(M, e);
    const x = a * (Math.cos(E) - e);
    const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    return { v: Math.atan2(y, x), r: Math.hypot(x, y) };
  }

  // The sun as seen from the earth, in ecliptic x and y (AU).
  function sunFromEarth(d) {
    const w = RAD * at(EARTH.w, d);
    const { v, r } = inOrbit(RAD * wrap(at(EARTH.M, d)), at(EARTH.e, d), 1);
    return { x: r * Math.cos(v + w), y: r * Math.sin(v + w) };
  }

  /* One planet seen from the earth: right ascension and declination in
     degrees, its ecliptic longitude, and its distance in AU. */
  function geocentric(name, date) {
    const orbit = ORBITS[name];
    if (!orbit) return null;
    const d = dayNumber(date);
    const N = RAD * at(orbit.N, d), i = RAD * at(orbit.i, d), w = RAD * at(orbit.w, d);
    const { v, r } = inOrbit(RAD * wrap(at(orbit.M, d)), at(orbit.e, d), at(orbit.a, d));
    const u = v + w;
    const sun = sunFromEarth(d);
    const x = r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(i)) + sun.x;
    const y = r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(i)) + sun.y;
    const z = r * Math.sin(u) * Math.sin(i);
    const tilt = RAD * (23.4393 - 3.563e-7 * d);
    const ye = y * Math.cos(tilt) - z * Math.sin(tilt);
    const ze = y * Math.sin(tilt) + z * Math.cos(tilt);
    return {
      ascension: wrap(Math.atan2(ye, x) / RAD),
      declination: Math.atan2(ze, Math.hypot(x, ye)) / RAD,
      longitude: wrap(Math.atan2(y, x) / RAD),
      distance: Math.hypot(x, y, z)
    };
  }

  /* Every bright planet for someone at a place: its height above the horizon
     and bearing from north in degrees, with its brightness and colour. Below
     the horizon is included, so a caller can choose what to draw. */
  function planets(date, place) {
    const sky = root.NordlysSky;
    if (!sky) return [];
    const sidereal = sky.siderealAngle(date, place.lon);
    return Object.keys(ORBITS).map((name) => {
      const seen = geocentric(name, date);
      const { elevation, azimuth } = sky.horizontal(RAD * (sidereal - seen.ascension), RAD * seen.declination, place.lat);
      return { name, elevation, azimuth, mag: ORBITS[name].mag, rgb: ORBITS[name].rgb, longitude: seen.longitude };
    });
  }

  const api = { planets, geocentric, NAMES: Object.keys(ORBITS) };
  root.NordlysPlanets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
