/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHAT THE SKY IS LIKE OUTSIDE
   ═══════════════════════════════════════════════════════════════════

   Three things the Weather and Horizon skies can take from the world, each
   asked of a free service that wants no account and no key, and each kept so
   a new tab asks again only when the answer could have changed:

     the weather now   Open-Meteo, at most every half hour
     the aurora        NOAA's planetary K index, at most every half hour
     the horizon       Open-Meteo's elevation model, once for each place

   Only the place goes out, and it is a city: the one the person typed, the
   one the weather card has, or the principal city of the time zone, rounded
   to a hundredth of a degree. Nothing is asked until a sky that draws from it
   is the one on screen. The answers are kept in localStorage, so the first
   frame of a new tab already has them. */
(function (root) {
  "use strict";

  const KEY = "nordlys_sky_data";
  const HALF_HOUR = 30 * 60000;
  const EARTH_KM = 6371;
  const RAD = Math.PI / 180;

  // ── The answers, turned into what a sky draws ───────────────────
  /* Open-Meteo's current conditions as the weather layer reads them: how much
     cloud, rain, snow and fog there is from 0 to 1, whether there is thunder,
     and the wind. The WMO weather code decides what is falling; the amounts
     only say how much. */
  function weatherFrom(answer) {
    const now = answer && answer.current;
    if (!now || !Number.isFinite(Number(now.weather_code))) return null;
    const code = Number(now.weather_code);
    const storm = code >= 95 && code <= 99;
    const fog = code === 45 || code === 48;
    const snowy = (code >= 71 && code <= 77) || code === 85 || code === 86;
    const drizzle = code >= 51 && code <= 57;
    const rainy = drizzle || (code >= 61 && code <= 67) || (code >= 80 && code <= 82) || storm;
    const clamp = (value) => Math.min(1, Math.max(0, value));
    const rain = rainy ? clamp(Math.max(drizzle ? 0.22 : 0.45, (Number(now.rain ?? now.precipitation) || 0) / 4)) : 0;
    const snow = snowy ? clamp(Math.max(0.35, (Number(now.snowfall) || 0) / 1.5)) : 0;
    const cover = clamp((Number(now.cloud_cover) || 0) / 100);
    return {
      // Whatever falls, falls from cloud.
      clouds: Math.max(cover, rain || snow ? 0.75 : 0, storm ? 0.95 : 0),
      rain, snow,
      fog: fog ? 0.85 : clamp((10000 - (Number(now.visibility) || 10000)) / 9000) * 0.7,
      storm: storm ? 1 : 0,
      wind: clamp((Number(now.wind_speed_10m) || 0) / 50),
      windFrom: Number(now.wind_direction_10m) || 270,
      code
    };
  }

  /* NOAA's estimated planetary K index, minute by minute: the latest one. */
  function kpFrom(rows) {
    if (!Array.isArray(rows) || !rows.length) return null;
    const last = rows[rows.length - 1];
    const kp = Number(last && (last.estimated_kp ?? last.kp_index ?? last.Kp));
    return Number.isFinite(kp) ? Math.min(9, Math.max(0, kp)) : null;
  }

  /* How much aurora someone can see at a latitude for a K index, from 0 to 1.
     The oval's edge comes towards the equator about two and a half degrees of
     geomagnetic latitude for each step of Kp, from about 66 degrees at Kp 0;
     the geographic latitude stands in for the magnetic one, which near Europe
     is a few degrees off and near North America a few the other way. */
  function auroraAt(lat, kp) {
    if (!Number.isFinite(kp)) return 0;
    const edge = 66 - 2.5 * kp;
    return Math.min(1, Math.max(0, (Math.abs(lat) - edge + 3) / 9));
  }

  // ── The horizon ─────────────────────────────────────────────────
  /* Facing the equator, as every sky here does: across 160 degrees either
     side, at distances that reach the far hills of a plain and the near wall
     of a valley. */
  const BEARINGS = Array.from({ length: 33 }, (_, index) => -80 + index * 5);
  const DISTANCES = [1, 2, 4, 7, 12, 20, 32, 50];
  const NEAR_KM = 4;

  // The point a distance away along a bearing, on a sphere.
  function destination(place, bearing, km) {
    const delta = km / EARTH_KM;
    const theta = bearing * RAD;
    const phi = place.lat * RAD;
    const lat = Math.asin(Math.sin(phi) * Math.cos(delta) + Math.cos(phi) * Math.sin(delta) * Math.cos(theta));
    const lon = place.lon * RAD + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi), Math.cos(delta) - Math.sin(phi) * Math.sin(lat));
    return { lat: lat / RAD, lon: (((lon / RAD) + 540) % 360) - 180 };
  }

  // Every point the profile needs, the place itself first.
  function horizonPoints(place) {
    const facing = place.lat < 0 ? 0 : 180;
    const points = [{ lat: place.lat, lon: place.lon }];
    for (const offset of BEARINGS) for (const km of DISTANCES) points.push(destination(place, facing + offset, km));
    return points;
  }

  /* The horizon from the heights of those points: for each bearing, the
     highest angle any of them stands above the eye, less the earth's curve
     (which at fifty kilometres hides two hundred metres). The far profile is
     everything; the near one only what is within a few kilometres, so a valley
     wall can be drawn in front of the hills beyond it. */
  function horizonFrom(heights) {
    if (!Array.isArray(heights) || heights.length !== 1 + BEARINGS.length * DISTANCES.length) return null;
    const eye = heights[0] + 2;
    const far = [], near = [];
    BEARINGS.forEach((_, b) => {
      let best = -2, close = -2;
      DISTANCES.forEach((km, k) => {
        const height = heights[1 + b * DISTANCES.length + k];
        if (!Number.isFinite(height)) return;
        const angle = (Math.atan((height - eye) / (km * 1000)) - km / (2 * EARTH_KM)) / RAD;
        best = Math.max(best, angle);
        if (km <= NEAR_KM) close = Math.max(close, angle);
      });
      far.push(Math.round(best * 100) / 100);
      near.push(Math.round(close * 100) / 100);
    });
    return { bearings: BEARINGS, far, near, height: heights[0] };
  }

  // ── Asking ──────────────────────────────────────────────────────
  const round = (value) => Math.round(value * 100) / 100;
  const placeKey = (place) => `${round(place.lat)},${round(place.lon)}`;

  function read() {
    try { return JSON.parse(root.localStorage.getItem(KEY) || "{}") || {}; } catch (error) { return {}; }
  }
  function write(data) {
    try { root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (error) { /* full or refused: asked again next time */ }
  }

  async function getJSON(url) {
    const control = typeof AbortController === "function" ? new AbortController() : null;
    const timer = control ? setTimeout(() => control.abort(), 9000) : null;
    try {
      const answer = await fetch(url, control ? { signal: control.signal } : undefined);
      if (!answer.ok) throw Object.assign(new Error(`HTTP ${answer.status}`), { status: answer.status });
      return await answer.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const asking = {};
  /* One kind of answer: the kept one now, and a fresh one asked for in the
     background when the kept one is too old or for another place. `fresh`
     hears about the new answer, once, if it is a different one. With
     `ask: false` (a thumbnail) only what is kept is read. */
  function kept(kind, key, maxAge, ask, fresh, { ask: allowed = true } = {}) {
    const data = read();
    const entry = data[kind];
    const usable = entry && entry.key === key ? entry.value : null;
    const stale = !entry || entry.key !== key || (maxAge && Date.now() - entry.at > maxAge);
    if (stale && allowed && !asking[kind] && root.navigator?.onLine !== false) {
      asking[kind] = ask().then((value) => {
        if (value === null || value === undefined) return;
        const latest = read();
        latest[kind] = { key, at: Date.now(), value };
        write(latest);
        if (JSON.stringify(value) !== JSON.stringify(usable)) fresh?.(value);
      }).catch(() => {
        // Not asked again for a while: a service that is down is not hammered.
        const latest = read();
        if (latest[kind] && latest[kind].key === key) { latest[kind].at = Date.now() - maxAge + 5 * 60000; write(latest); }
      }).finally(() => { delete asking[kind]; });
    }
    return usable;
  }

  function weather(place, fresh, options) {
    const key = placeKey(place);
    return kept("weather", key, HALF_HOUR, async () => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(round(place.lat)));
      url.searchParams.set("longitude", String(round(place.lon)));
      url.searchParams.set("current", "weather_code,cloud_cover,precipitation,rain,snowfall,wind_speed_10m,wind_direction_10m,visibility");
      return weatherFrom(await getJSON(url.href));
    }, fresh, options);
  }

  function kp(fresh, options) {
    return kept("kp", "world", HALF_HOUR, async () => kpFrom(await getJSON("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json")), fresh, options);
  }

  function horizon(place, fresh, options) {
    const key = placeKey(place);
    return kept("horizon", key, 0, async () => {
      const points = horizonPoints({ lat: round(place.lat), lon: round(place.lon) });
      const heights = [];
      // The elevation service takes a hundred points a question.
      for (let at = 0; at < points.length; at += 100) {
        const slice = points.slice(at, at + 100);
        const url = new URL("https://api.open-meteo.com/v1/elevation");
        url.searchParams.set("latitude", slice.map((point) => point.lat.toFixed(4)).join(","));
        url.searchParams.set("longitude", slice.map((point) => point.lon.toFixed(4)).join(","));
        const answer = await getJSON(url.href);
        heights.push(...(answer.elevation || []));
      }
      return horizonFrom(heights);
    }, fresh, options);
  }

  /* How full today's working hours are with meetings, from 0 to 1: the time
     taken by today's timed events inside the working day, an overlap counted
     once. The Your day sky draws it as cloud. */
  function dayLoad(events, workday, now = new Date()) {
    const start = Number.isFinite(workday?.start) ? workday.start : 9;
    const end = Number.isFinite(workday?.end) && workday.end > start ? workday.end : start + 9;
    const midnight = new Date(now).setHours(0, 0, 0, 0);
    const from = midnight + start * 3600000;
    const to = midnight + end * 3600000;
    const spans = (Array.isArray(events) ? events : [])
      .filter((event) => event && !event.allDay)
      .map((event) => [Math.max(from, Date.parse(event.start)), Math.min(to, Date.parse(event.end || event.start))])
      .filter(([a, b]) => b > a)
      .sort((x, y) => x[0] - y[0]);
    let busy = 0;
    let reached = from;
    for (const [a, b] of spans) {
      if (b <= reached) continue;
      busy += b - Math.max(a, reached);
      reached = b;
    }
    return Math.min(1, busy / (to - from));
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
    const found = root.NordlysSky?.zonePlace?.(zone);
    return found ? { ...found, name: zone.split("/").pop().replace(/_/g, " ") } : { lat: 52.5, lon: 13.4, name: "" };
  }

  const api = { weatherFrom, kpFrom, auroraAt, destination, horizonPoints, horizonFrom, weather, kp, horizon, placeOf, dayLoad, BEARINGS, DISTANCES, KEY };
  root.NordlysSkyData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
