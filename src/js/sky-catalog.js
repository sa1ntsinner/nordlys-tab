/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE SKIES, AS DATA
   ═══════════════════════════════════════════════════════════════════

   Every sky the page can show, in the order and the groups the picker shows
   them, with what the engine has to know about each before it paints one:

     rest    the moment a still one is held at, chosen by looking
     budget  the least time between paints it needs, in milliseconds
     clock   keeps time with the real sky even when held still
     night   a night thing, which steps back further by day
     place   drawn for the place the sky is (Settings → Background)
     readable  a picture whose pixels the page may read (its server allows CORS)
     toned   a photograph shown in the colours of the mood, unless asked not to

   The painting of each is a file of its own in src/js/skies, which names the
   method that paints it with paint() below. Nothing else in the product keeps
   a list of skies; adding one is a line here and a file there. */
(function (root) {
  "use strict";

  const CATEGORIES = [
    { id: "nordlys", key: "sky.cat.nordlys", name: "Nordlys" },
    { id: "photos", key: "sky.cat.photos", name: "Photos" },
    { id: "world", key: "sky.cat.world", name: "Picture of the day" },
    { id: "yours", key: "sky.cat.yours", name: "Yours" }
  ];

  // Each sky's message key is spelled out, so it can be found by searching for it.
  const canvas = (id, category, name, key, flags = {}) => ({ id, category, name, key, kind: "canvas", ...flags });
  // A photograph of a subject from Wikimedia Commons, a new one each day (world-picture.js).
  const photo = (topic, name, key) => ({ id: `photo-${topic}`, category: "photos", name, key, kind: "picture", source: `photo-${topic}`, readable: true, toned: true });
  const SKIES = [
    canvas("aurora", "nordlys", "Aurora", "scene.aurora", { rest: 12, night: true }),
    canvas("polaris", "nordlys", "Polaris", "scene.polaris", { rest: 20, night: true }),
    canvas("starmap", "nordlys", "Star map", "scene.starmap", { rest: 7.4, budget: 100, clock: true, night: true, place: true }),
    canvas("meteors", "nordlys", "Meteors", "scene.meteors", { rest: 9, budget: 100, night: true, place: true }),
    canvas("silk", "nordlys", "Silk", "scene.silk", { rest: 31.7 }),
    canvas("blackhole", "nordlys", "Black hole", "scene.blackhole", { rest: 7.4, budget: 50, night: true }),
    canvas("contour", "nordlys", "Contour", "scene.contour", { rest: 7.4 }),
    canvas("fjord", "nordlys", "Fjord", "scene.fjord", { rest: 7.4 }),
    photo("nature", "Nature", "scene.photoNature"),
    photo("weather", "Weather", "scene.photoWeather"),
    photo("horizon", "Horizon", "scene.photoHorizon"),
    photo("space", "Space", "scene.photoSpace"),
    photo("scifi", "Sci-fi", "scene.photoScifi"),
    photo("tech", "Tech", "scene.photoTech"),
    photo("cities", "Cities", "scene.photoCities"),
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
  const one = (list, random) => list[Math.floor(random() * list.length) % list.length];
  // A drawn sky's scatter, or a photograph of the day: any whole number will do.
  const seedFrom = (random) => Math.floor(random() * 0xffffffff) >>> 0;

  const api = {
    CATEGORIES,
    SKIES,
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
      Object.assign(NordlysBackgroundEngine.prototype, members);
      Object.assign(NordlysBackgroundEngine, statics);
    },
    painter: (id) => painters[id] || null,
    /* A sky for a rotation, from the pool the person chose: this sky shuffled
       (another scatter, another photograph), another of its group, any sky,
       or one of their saved skies. Never their own wallpaper or video. */
    pick({ bgMode, looks } = {}, pool = "this", random = Math.random) {
      const current = byId.get(bgMode);
      const saved = (Array.isArray(looks) ? looks : []).map((entry) => entry?.look).filter((look) => byId.get(look?.bgMode)?.kind !== "media" && byId.has(look?.bgMode));
      if (pool === "looks" && saved.length) {
        const look = one(saved, random);
        return { bgMode: look.bgMode, seed: Number.isInteger(look.bgSeed) ? look.bgSeed : seedFrom(random) };
      }
      if (pool === "this" && current && ["canvas", "picture"].includes(current.kind)) return { bgMode, seed: seedFrom(random) };
      const group = current && current.kind !== "media" && current.kind !== "solid" ? current.category : "nordlys";
      const choices = SKIES.filter((sky) => ["canvas", "picture"].includes(sky.kind) && (pool === "all" || sky.category === group));
      return { bgMode: one(choices, random).id, seed: seedFrom(random) };
    }
  };

  root.NordlysSkies = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
