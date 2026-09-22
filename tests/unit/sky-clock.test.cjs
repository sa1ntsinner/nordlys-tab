const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function sky() {
  const window = {};
  vm.runInContext(readFileSync('src/js/sky-clock.js', 'utf8'), vm.createContext({ window }));
  return window.NordlysSky;
}

// Distance around the month, so 0.98 and 0.01 are close.
const apart = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

/* Checked against moments the almanacs agree on. The mean month drifts from
   the real Moon by up to about half a day, a fiftieth of a month or so. */
test('the phase lands on known new and full moons', () => {
  const { moonPhase, phaseName } = sky();
  const eclipse = moonPhase(new Date(Date.UTC(2024, 3, 8, 18, 21))); // the total eclipse
  assert.ok(apart(eclipse.phase, 0) < 0.03, `new moon at ${eclipse.phase}`);
  assert.ok(eclipse.illumination < 0.02);
  assert.equal(phaseName(eclipse.phase), 'new');

  const hunter = moonPhase(new Date(Date.UTC(2024, 9, 17, 11, 26))); // a full supermoon
  assert.ok(apart(hunter.phase, 0.5) < 0.03, `full moon at ${hunter.phase}`);
  assert.ok(hunter.illumination > 0.98);
  assert.equal(phaseName(hunter.phase), 'full');
});

test('a quarter is half lit, and the waxing half of the month is waxing', () => {
  const { moonPhase, phaseName } = sky();
  const first = moonPhase(new Date(Date.UTC(2024, 3, 15, 19, 13))); // first quarter
  assert.ok(Math.abs(first.illumination - 0.5) < 0.08, `lit ${first.illumination}`);
  assert.equal(first.waxing, true);
  assert.equal(phaseName(first.phase), 'firstQuarter');
  const last = moonPhase(new Date(Date.UTC(2024, 4, 1, 11, 27))); // last quarter
  assert.equal(last.waxing, false);
  assert.equal(phaseName(last.phase), 'lastQuarter');
});

test('dates before the reference are as good as dates after it', () => {
  const { moonPhase } = sky();
  const full1999 = moonPhase(new Date(Date.UTC(1999, 11, 22, 17, 31))); // the full moon of 22 December 1999
  assert.ok(apart(full1999.phase, 0.5) < 0.03, `full moon at ${full1999.phase}`);
});

function sunlit() {
  const window = {};
  const context = vm.createContext({ window });
  for (const file of ['src/js/colour-tools.js', 'src/js/sky-zones.js', 'src/js/sky-clock.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  return window.NordlysSky;
}

/* Noon at the solstices, where the elevation is 90° − latitude ± the tilt of
   the axis, and a polar night where the sun never clears the horizon. */
test('the sun stands where the almanac puts it', () => {
  const { sunPosition } = sunlit();
  const berlin = sunPosition(new Date(Date.UTC(2024, 5, 20, 11, 10)), 52.52, 13.4);
  assert.ok(Math.abs(berlin.elevation - 60.9) < 0.6, `Berlin midsummer noon at ${berlin.elevation}`);
  assert.ok(Math.abs(berlin.azimuth - 180) < 6, `due south, not ${berlin.azimuth}`);
  const sydney = sunPosition(new Date(Date.UTC(2024, 11, 21, 1, 55)), -33.87, 151.21);
  assert.ok(Math.abs(sydney.elevation - 79.6) < 0.8, `Sydney midsummer noon at ${sydney.elevation}`);
  const tromso = sunPosition(new Date(Date.UTC(2024, 11, 21, 10, 45)), 69.65, 18.96);
  assert.ok(tromso.elevation < -2 && tromso.elevation > -4.5, `Tromsø polar noon at ${tromso.elevation}`);
  const midnight = sunPosition(new Date(Date.UTC(2024, 5, 20, 23, 10)), 52.52, 13.4);
  assert.ok(midnight.elevation < -10, 'midnight is dark in Berlin');
  const morning = sunPosition(new Date(Date.UTC(2024, 5, 20, 5, 0)), 52.52, 13.4);
  assert.equal(morning.rising, true);
  assert.equal(sunPosition(new Date(Date.UTC(2024, 5, 20, 17, 0)), 52.52, 13.4).rising, false);
});

test('a time zone gives a place without asking for one', () => {
  const { zonePlace } = sunlit();
  assert.deepEqual(JSON.parse(JSON.stringify(zonePlace('Europe/Berlin'))), { lat: 52.5, lon: 13.4, from: 'zone' });
  assert.equal(zonePlace('Asia/Calcutta').from, 'zone', 'the old names browsers still report resolve too');
  assert.equal(zonePlace('America/Argentina/Buenos_Aires').from, 'zone');
  const guessed = zonePlace('Etc/Nowhere');
  assert.equal(guessed.from, 'offset');
  assert.ok(Math.abs(guessed.lon) <= 180);
});

test('the day turns through its phases, and the weights blend rather than switch', () => {
  const { daylight } = sunlit();
  const berlin = { lat: 52.5, lon: 13.4 };
  const at = (h, m = 0) => daylight(new Date(Date.UTC(2024, 8, 22, h, m)), berlin);
  assert.equal(at(0).phase, 'night');
  // Solar noon in Berlin on the equinox is at about 10:59 UTC.
  assert.equal(at(9).phase, 'morning');
  assert.equal(at(14).phase, 'afternoon');
  assert.equal(at(0).night, 1);
  assert.equal(at(11).day, 1);
  // Sunset in Berlin on the equinox is at about 17:10 UTC.
  const sunset = at(17, 5);
  assert.equal(sunset.phase, 'sunset');
  assert.ok(sunset.golden > 0.8, `golden at sunset: ${sunset.golden}`);
  const dusk = at(17, 50);
  assert.equal(dusk.phase, 'dusk');
  assert.ok(dusk.blue > 0.5, `blue in the blue hour: ${dusk.blue}`);
  // Minute to minute nothing jumps.
  for (let minute = 0; minute < 24 * 60; minute += 5) {
    const a = daylight(new Date(Date.UTC(2024, 8, 22, 0, minute)), berlin);
    const b = daylight(new Date(Date.UTC(2024, 8, 22, 0, minute + 5)), berlin);
    for (const key of ['day', 'golden', 'blue', 'night']) assert.ok(Math.abs(a[key] - b[key]) < 0.2, `${key} jumped at minute ${minute}`);
  }
});

test('the light falls on a mood without making it another mood', () => {
  const sky = sunlit();
  const { toOklch, hexToRgb } = (() => { const window = {}; vm.runInContext(readFileSync('src/js/colour-tools.js', 'utf8'), vm.createContext({ window })); return window.NordlysColour; })();
  const berlin = { lat: 52.5, lon: 13.4 };
  const mood = ['#35d6c0', '#5b6cff', '#9d4edd'];
  const night = sky.lightMood(mood, sky.daylight(new Date(Date.UTC(2024, 8, 22, 0)), berlin));
  const noon = sky.lightMood(mood, sky.daylight(new Date(Date.UTC(2024, 8, 22, 11)), berlin));
  const sunset = sky.lightMood(mood, sky.daylight(new Date(Date.UTC(2024, 8, 22, 17, 5)), berlin));
  const L = hex => toOklch(hexToRgb(hex))[0];
  const C = hex => toOklch(hexToRgb(hex))[1];
  const H = hex => toOklch(hexToRgb(hex))[2];
  const turn = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
  for (let i = 0; i < 3; i++) {
    assert.ok(L(noon[i]) > L(night[i]), 'the day is lighter than the night');
    assert.ok(C(noon[i]) < C(night[i]), 'and paler');
    assert.ok(turn(H(sunset[i]), H(mood[i])) < 1.5, 'a sunset pulls the hue part of the way, never all of it');
  }
  // A teal is far from every sunset hue, so it stays teal instead of souring
  // into lime; a blue, nearer the rose of a dusk sky, leans towards it.
  assert.ok(turn(H(sunset[0]), H(mood[0])) < 8 * Math.PI / 180, 'teal keeps its hue at sunset');
  const rose = 318 * Math.PI / 180;
  assert.ok(turn(H(sunset[1]), rose) < turn(H(mood[1]), rose), 'blue leans rose at dusk');
  // A grey mood still sees the sunset.
  const grey = sky.lightMood(['#8a8a8a', '#bdbdbd', '#5c5c5c'], sky.daylight(new Date(Date.UTC(2024, 8, 22, 17, 5)), berlin));
  assert.ok(grey.every(hex => C(hex) > 0.02));
});
