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

   The painting of each is a file of its own in src/js/skies, which names the
   method that paints it with paint() below. Nothing else in the product keeps
   a list of skies; adding one is a line here and a file there. */
(function (root) {
  "use strict";

  const CATEGORIES = [
    { id: "nordlys", key: "sky.cat.nordlys", name: "Nordlys" },
    { id: "yours", key: "sky.cat.yours", name: "Yours" },
    { id: "plain", key: "sky.cat.plain", name: "Plain" }
  ];

  const canvas = (id, category, name, flags = {}) => ({ id, category, name, key: `scene.${id}`, kind: "canvas", ...flags });
  const SKIES = [
    canvas("aurora", "nordlys", "Aurora", { rest: 12, night: true }),
    canvas("polaris", "nordlys", "Polaris", { rest: 20, night: true }),
    canvas("halo", "nordlys", "Halo", { rest: 7.4 }),
    canvas("starmap", "nordlys", "Star map", { rest: 7.4, budget: 100, clock: true, night: true }),
    canvas("meteors", "nordlys", "Meteors", { rest: 9, budget: 100, night: true }),
    canvas("silk", "nordlys", "Silk", { rest: 31.7 }),
    canvas("midnightsun", "nordlys", "Midnight sun", { rest: 7.4, budget: 80, clock: true, ownSun: true }),
    canvas("contour", "nordlys", "Contour", { rest: 7.4 }),
    canvas("fjord", "nordlys", "Fjord", { rest: 7.4 }),
    { id: "custom-image", category: "yours", name: "Wallpaper", key: "scene.wallpaper", kind: "media" },
    { id: "custom-video", category: "yours", name: "Video", key: "scene.video", kind: "media" },
    { id: "solid", category: "plain", name: "Solid", key: "scene.solid", kind: "solid" }
  ];

  const byId = new Map(SKIES.map((sky) => [sky.id, sky]));
  const painters = {};

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
    painter: (id) => painters[id] || null
  };

  root.NordlysSkies = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
