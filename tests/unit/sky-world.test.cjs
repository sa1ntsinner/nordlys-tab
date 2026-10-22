const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The sky's own clock and what it reads from the world: the planets from
   their orbits, the weather, the aurora and the horizon from the services'
   answers. Loaded as the page loads them, with window as the global. */
function world() {
  const context = vm.createContext({});
  context.window = context;
  for (const file of ['sky-zones.js', 'sky-clock.js', 'sky-planets.js', 'sky-data.js']) vm.runInContext(readFileSync(`src/js/${file}`, 'utf8'), context);
  return context;
}
const apart = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

/* At opposition a planet stands opposite the sun, and at inferior conjunction
   Venus stands in front of it: moments the almanacs give to the hour. */
test('the planets stand where the almanacs put them', () => {
  const { NordlysPlanets, NordlysSky } = world();
  const sunAt = date => NordlysSky.sunPosition(date, 0, 0).longitude;
  for (const [name, iso] of [['jupiter', '2024-12-07T21:00:00Z'], ['saturn', '2024-09-08T04:00:00Z'], ['mars', '2025-01-16T02:00:00Z']]) {
    const date = new Date(iso);
    const seen = NordlysPlanets.geocentric(name, date);
    assert.ok(apart(seen.longitude, sunAt(date) + 180) < 2, `${name} is ${apart(seen.longitude, sunAt(date) + 180).toFixed(2)}° off opposition`);
  }
  const conjunction = new Date('2025-03-23T01:00:00Z');
  assert.ok(apart(NordlysPlanets.geocentric('venus', conjunction).longitude, sunAt(conjunction)) < 2, 'Venus passes in front of the sun');
});

test('a planet is placed in the local sky, below the horizon included', () => {
  const { NordlysPlanets } = world();
  const night = NordlysPlanets.planets(new Date('2024-12-07T23:00:00Z'), { lat: 51.5, lon: 7.5 });
  assert.deepEqual(Array.from(night, planet => planet.name), ['venus', 'mars', 'jupiter', 'saturn']);
  // Jupiter at opposition is high in the south around midnight.
  const jupiter = night.find(planet => planet.name === 'jupiter');
  assert.ok(jupiter.elevation > 50, `Jupiter at ${jupiter.elevation.toFixed(1)}°`);
  assert.ok(apart(jupiter.azimuth, 180) < 30, `Jupiter bearing ${jupiter.azimuth.toFixed(1)}°`);
});

test('the weather now becomes amounts of cloud, rain, snow and fog', () => {
  const { NordlysSkyData: D } = world();
  const now = current => D.weatherFrom({ current: { cloud_cover: 20, visibility: 30000, wind_speed_10m: 10, wind_direction_10m: 250, ...current } });
  const clear = now({ weather_code: 0 });
  assert.equal(clear.rain, 0);
  assert.equal(clear.snow, 0);
  assert.equal(clear.storm, 0);
  assert.equal(clear.clouds, 0.2);
  const rain = now({ weather_code: 63, rain: 2 });
  assert.equal(rain.rain, 0.5);
  assert.ok(rain.clouds >= 0.75, 'rain falls from cloud');
  assert.ok(now({ weather_code: 51, rain: 0.1 }).rain > 0.2, 'drizzle shows');
  assert.ok(now({ weather_code: 73, snowfall: 0.6 }).snow >= 0.35);
  assert.equal(now({ weather_code: 95 }).storm, 1);
  assert.equal(now({ weather_code: 45 }).fog, 0.85);
  assert.equal(D.weatherFrom({}), null);
  assert.equal(D.weatherFrom(null), null);
});

test('the aurora is seen at high latitudes, and further south when the K index is high', () => {
  const { NordlysSkyData: D } = world();
  assert.equal(D.kpFrom([{ estimated_kp: 1.33 }, { estimated_kp: 4.67 }]), 4.67);
  assert.equal(D.kpFrom([]), null);
  assert.equal(D.auroraAt(69.6, 2), 1, 'Tromsø on a quiet night');
  assert.equal(D.auroraAt(51.5, 2), 0, 'the Ruhr on a quiet night');
  assert.ok(D.auroraAt(51.5, 7) > 0.4, 'the Ruhr in a strong storm');
  assert.equal(D.auroraAt(-69.6, 2), 1, 'the south too');
});

test('the horizon is the highest angle along each bearing, less the curve of the earth', () => {
  const { NordlysSkyData: D } = world();
  const place = { lat: 47.3, lon: 11.4 };
  const points = D.horizonPoints(place);
  assert.equal(points.length, 1 + D.BEARINGS.length * D.DISTANCES.length);
  // One kilometre-high peak, twelve kilometres due south.
  const heights = points.map(() => 100);
  const south = D.BEARINGS.indexOf(0), twelve = D.DISTANCES.indexOf(12);
  heights[1 + south * D.DISTANCES.length + twelve] = 1100;
  const horizon = D.horizonFrom(heights);
  const expected = (Math.atan(998 / 12000) - 12 / (2 * 6371)) * 180 / Math.PI;
  assert.ok(Math.abs(horizon.far[south] - expected) < 0.01, `${horizon.far[south]} vs ${expected}`);
  assert.ok(horizon.near[south] < 0, 'the peak is beyond the near profile');
  assert.ok(horizon.far[0] < 0, 'flat ground sinks below the eye');
  assert.equal(D.horizonFrom([1, 2, 3]), null);
  // A step along a bearing lands where it should.
  const east = D.destination({ lat: 0, lon: 0 }, 90, 111.195);
  assert.ok(Math.abs(east.lat) < 1e-6 && Math.abs(east.lon - 1) < 1e-3);
});

test('the sky is placed where the person said, else at the weather card, else in the time zone', () => {
  const { NordlysSkyData: D } = world();
  assert.equal(D.placeOf({ skyPlace: { lat: 1, lon: 2, name: 'A' } }).name, 'A');
  const card = { type: 'weather', settings: { place: { lat: 3, lon: 4, name: 'B' } } };
  assert.equal(D.placeOf({ dashboard: { widgets: [card] } }).name, 'B');
  const zone = D.placeOf({});
  assert.ok(Number.isFinite(zone.lat) && Number.isFinite(zone.lon));
});
