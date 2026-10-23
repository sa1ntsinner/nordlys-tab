/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE SKIES, AS DATA
   ═══════════════════════════════════════════════════════════════════

   Every sky the page can show, in the order and the groups the picker shows
   them, with what the engine has to know about each before it paints one:

     rest    the moment a still one is held at, chosen by looking
     budget  the least time between paints it needs, in milliseconds
     clock   keeps time with the real sky even when held still
     night   a night thing, which steps back further by day
     ownSun  draws its own sun, and the light of it
     ownLight  paints its own day, so the engine does not dim it by day
     layers  a composed sky: the layers it starts from (skies/compose.js)
     readable  a picture whose pixels the page may read (its server allows CORS)

   The painting of each is a file of its own in src/js/skies, which names the
   method that paints it with paint() below. Nothing else in the product keeps
   a list of skies; adding one is a line here and a file there. */
(function (root) {
  "use strict";

  const CATEGORIES = [
    { id: "nordlys", key: "sky.cat.nordlys", name: "Nordlys" },
    { id: "weather", key: "sky.cat.weather", name: "Weather" },
    { id: "horizon", key: "sky.cat.horizon", name: "Horizon" },
    { id: "world", key: "sky.cat.world", name: "Picture of the day" },
    { id: "yours", key: "sky.cat.yours", name: "Yours" }
  ];

  /* A composed sky is five layers, each a choice. A sky of the Weather or
     Horizon group starts from a few of them; whatever the person changes is
     kept beside it (config.skyLayers) and wins. */
  const COMPOSE = {
    defaults: { light: "auto", stars: true, moon: true, planets: true, meteors: false, aurora: "live", weather: "clear", horizon: "none", style: "lit" },
    choices: {
      light: ["auto", "workday", "dawn", "day", "dusk", "night"],
      weather: ["clear", "clouds", "rain", "snow", "fog", "storm", "live", "day"],
      horizon: ["none", "mountains", "sea", "city", "forest", "steppe", "desert", "lighthouse", "yours"],
      style: ["lit", "poster", "engraving", "pixel"],
      // live: as it is at the sky's place now; north: as it is under the oval tonight, by the K index.
      aurora: ["off", "live", "north", "on"]
    },
    // The bodies of the sky, each on or off.
    bodies: ["stars", "moon", "planets", "meteors"]
  };

  // Each sky's message key is spelled out, so it can be found by searching for it.
  const canvas = (id, category, name, key, flags = {}) => ({ id, category, name, key, kind: "canvas", ...flags });
  // A composed sky: its own light and sun, painted by the composer, and the real hour kept when held.
  const composed = (id, category, name, key, layers) => canvas(id, category, name, key, { rest: 7.4, budget: 50, clock: true, ownSun: true, ownLight: true, painter: "renderCompose", layers });
  const SKIES = [
    canvas("aurora", "nordlys", "Aurora", "scene.aurora", { rest: 12, night: true }),
    canvas("polaris", "nordlys", "Polaris", "scene.polaris", { rest: 20, night: true }),
    canvas("halo", "nordlys", "Halo", "scene.halo", { rest: 7.4 }),
    canvas("starmap", "nordlys", "Star map", "scene.starmap", { rest: 7.4, budget: 100, clock: true, night: true }),
    canvas("meteors", "nordlys", "Meteors", "scene.meteors", { rest: 9, budget: 100, night: true }),
    canvas("silk", "nordlys", "Silk", "scene.silk", { rest: 31.7 }),
    canvas("midnightsun", "nordlys", "Midnight sun", "scene.midnightsun", { rest: 7.4, budget: 80, clock: true, ownSun: true }),
    canvas("contour", "nordlys", "Contour", "scene.contour", { rest: 7.4 }),
    canvas("fjord", "nordlys", "Fjord", "scene.fjord", { rest: 7.4 }),
    composed("outside", "weather", "Outside now", "scene.outside", { weather: "live" }),
    composed("yourday", "weather", "Your day", "scene.yourday", { weather: "day", light: "workday" }),
    composed("clouds", "weather", "Clouds", "scene.clouds", { weather: "clouds" }),
    composed("rain", "weather", "Rain", "scene.rain", { weather: "rain" }),
    composed("snow", "weather", "Snow", "scene.snow", { weather: "snow", horizon: "forest" }),
    composed("fog", "weather", "Fog", "scene.fog", { weather: "fog", horizon: "forest" }),
    composed("storm", "weather", "Thunder", "scene.storm", { weather: "storm", horizon: "steppe" }),
    composed("northern", "weather", "Space weather", "scene.northern", { aurora: "north", light: "night", horizon: "mountains" }),
    composed("yours-horizon", "horizon", "Your horizon", "scene.yoursHorizon", { horizon: "yours" }),
    composed("mountains", "horizon", "Mountains", "scene.mountains", { horizon: "mountains" }),
    composed("sea", "horizon", "Sea", "scene.sea", { horizon: "sea" }),
    composed("city", "horizon", "City", "scene.city", { horizon: "city" }),
    composed("forest", "horizon", "Forest", "scene.forest", { horizon: "forest" }),
    composed("steppe", "horizon", "Steppe", "scene.steppe", { horizon: "steppe" }),
    composed("desert", "horizon", "Desert", "scene.desert", { horizon: "desert" }),
    composed("lighthouse", "horizon", "Lighthouse", "scene.lighthouse", { horizon: "lighthouse" }),
    { id: "picture-wikimedia", category: "world", name: "Wikimedia Commons", key: "scene.pictureWikimedia", kind: "picture", source: "wikimedia", readable: true },
    { id: "picture-paintings", category: "world", name: "Masterpieces", key: "scene.picturePaintings", kind: "picture", source: "paintings", readable: true },
    { id: "picture-met", category: "world", name: "The Met", key: "scene.pictureMet", kind: "picture", source: "met" },
    { id: "picture-earth", category: "world", name: "The Earth today", key: "scene.pictureEarth", kind: "picture", source: "epic" },
    { id: "custom-image", category: "yours", name: "Wallpaper", key: "scene.wallpaper", kind: "media" },
    { id: "custom-video", category: "yours", name: "Video", key: "scene.video", kind: "media" },
    { id: "solid", category: "yours", name: "Solid", key: "scene.solid", kind: "solid" }
  ];

  const byId = new Map(SKIES.map((sky) => [sky.id, sky]));
  const painters = {};

  /* What a shuffle may choose for each layer: the looks that need nothing of
     the person. The light stays as it is, and so do the bodies. */
  const SHUFFLE = {
    weather: ["clear", "clouds", "rain", "snow", "fog", "storm"],
    horizon: ["mountains", "sea", "city", "forest", "steppe", "desert", "lighthouse"],
    style: ["lit", "poster", "engraving", "pixel"],
    aurora: ["off", "off", "live", "on"]
  };
  const one = (list, random) => list[Math.floor(random() * list.length) % list.length];

  const api = {
    CATEGORIES,
    SKIES,
    COMPOSE,
    SHUFFLE,
    get: (id) => byId.get(id) || null,
    inCategory: (category) => SKIES.filter((sky) => sky.category === category),
    canvasSkies: () => SKIES.filter((sky) => sky.kind === "canvas").map((sky) => sky.id),
    // { id: value } for every canvas sky that has the flag.
    table: (flag) => Object.fromEntries(SKIES.filter((sky) => sky.kind === "canvas" && sky[flag] !== undefined).map((sky) => [sky.id, sky[flag]])),
    /* A sky file hands over its methods, which join the engine's as if they
       were written in the class (background.js is loaded before any of
       them), and the name of the one that paints a frame. */
    paint(id, method, members = {}, statics = {}) {
      painters[id] = method;
      api.mix(members, statics);
    },
    // Methods several skies share, with no sky of their own.
    mix(members = {}, statics = {}) {
      Object.assign(NordlysBackgroundEngine.prototype, members);
      Object.assign(NordlysBackgroundEngine, statics);
    },
    painter: (id) => byId.get(id)?.painter || painters[id] || null,
    // The layers a composed sky draws: the catalogue's, under the person's.
    layersOf: (id, own) => ({ ...COMPOSE.defaults, ...(byId.get(id)?.layers || {}), ...(own || {}) }),
    // The person's layers with every one not locked chosen again; `random` answers 0 to 1.
    shuffle(own, locks = [], random = Math.random) {
      const layers = { ...(own || {}) };
      for (const [layer, options] of Object.entries(SHUFFLE)) if (!locks.includes(layer)) layers[layer] = one(options, random);
      return layers;
    },
    /* A sky for a rotation, from the pool the person chose: this sky with its
       unlocked layers shuffled, another of its group, any sky, or the sky of
       one of their saved looks. Never their own wallpaper or video. */
    pick({ bgMode, skyLayers, skyLocks, looks } = {}, pool = "layers", random = Math.random) {
      const current = byId.get(bgMode);
      const saved = (Array.isArray(looks) ? looks : []).map((entry) => entry?.look).filter((look) => byId.get(look?.bgMode)?.kind !== "media" && byId.has(look?.bgMode));
      if (pool === "looks" && saved.length) {
        const look = one(saved, random);
        return { bgMode: look.bgMode, skyLayers: look.skyLayers || null };
      }
      if (pool === "layers" && current?.layers) return { bgMode, skyLayers: api.shuffle(skyLayers, skyLocks || [], random) };
      const group = current && current.kind !== "media" && current.kind !== "solid" ? current.category : "nordlys";
      const choices = SKIES.filter((sky) => ["canvas", "picture"].includes(sky.kind) && (pool === "all" || sky.category === group));
      return { bgMode: one(choices, random).id, skyLayers: null };
    }
  };

  root.NordlysSkies = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
