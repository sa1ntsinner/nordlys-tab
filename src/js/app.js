/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - MAIN ORCHESTRATOR & APPLICATION BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════ */

/* The widths the board may run to. Standard is the width it always had. */
const BOARD_WIDTHS = { narrow: 1080, standard: 1400, wide: 1760 };
const DEFAULT_CONFIG = {
  version: "2.2.3",
  theme: "aurora-void",
  colorMode: "dark",
  bgMode: "aurora",
  bgPalette: "theme",
  /* What the sky is scattered from. Zero is the authored composition; the
     shuffle button stores any other whole number, and a backup carries it. */
  bgSeed: 0,
  // Solid glass, a quieter sky, stronger text; the system can ask for it too.
  highLegibility: false,
  /* The light of every atmosphere follows the sun where the person is,
     worked out from the time zone. Off until somebody turns it on. */
  bgDaylight: false,
  // Halo draws tonight's moon, worked out from the date alone.
  bgRealSky: true,
  bgPalettes: [],
  bgMotion: 1,
  bgIntensity: 1,
  glassLevel: "full",
  headerStyle: "full",
  bgBlur: 0,
  bgDim: 0,
  timeFormat: "24h",
  showSeconds: false,
  userName: "",
  openNewTab: false,
  cardRadius: 18,
  tileSize: 78,
  cardGap: 12,
  /* How folders share a row: "natural" keeps each at its own size, "fitted"
     runs every row edge to edge with folders of one height. Which folders
     share a row is each folder's own `row`, absent until somebody arranges. */
  boardLayout: "natural",
  /* How wide the board may run ("narrow", "standard", "wide") and whether
     the bookmarks carry their names. The space between folders follows the
     space between bookmarks until somebody sets it (boardGap, absent). */
  boardWidth: "standard",
  tileLabels: true,
  cardGlow: 40,
  hoverEffect: "lift",
  iconShape: "squircle",
  customCss: "",
  /* Empty, and it has to stay empty.

     Until 2.2.4 this shipped the author's own board — five folders, twenty-two
     links, two of them the student portals of one German university — so every
     install anywhere opened on a stranger's day and had to be cleared before it
     could be used. The product's promise is that it shows nothing you did not
     put there; the first ninety seconds were the one place it broke that
     promise, and a sample link behind a button would break it just the same.

     What a new user meets instead is the board's own empty state
     (GridController.createEmptyState), which names the two ways in: make a
     folder, or bring the bookmarks you already have.

     This only ever reaches someone with nothing in storage. loadConfig() merges
     it under whatever is stored, so an existing board keeps every folder it
     had — tests/ui/first-run.spec.cjs holds both halves of that.
     tests/unit/default-config.test.cjs fails the build if a URL comes back. */
  groups: []
};

/* Inline CSS custom properties a custom theme may set — cleared on preset switch */
const THEME_INLINE_TOKENS = [
  "--void", "--void-gradient", "--glass", "--glass-border", "--frost",
  "--card-tint", "--card-tint-deep",
  "--accent", "--accent-ink", "--accent-glow", "--nl-on-accent", "--ink", "--dim", "--faint",
  "--font-main", "--font-display",
  "--shader-1", "--shader-2", "--shader-3",
  // Legacy aliases kept for older user Custom CSS
  "--bg-void", "--card-bg", "--card-border", "--font-family"
];

/* Single source of truth for storage keys and theme classification */
/* The product is called Nordlys and so is everything it writes. It was not
   always: the first storage key was "aurora_tab_config", the second
   "aether_tab_config", and the class names, the global, the event names and
   the IndexedDB database all carried the earlier name too. Three names for one
   thing is the surest sign that three different hands built it. Every key an
   older build wrote is listed here and moved under the new name on first run,
   so nobody's setup is lost to a rename. */
const STORAGE_KEY = "nordlys_config";
const LEGACY_STORAGE_KEYS = ["aether_tab_config", "aurora_tab_config"];
const LEGACY_LOCAL_KEYS = {
  "aether_tab_config": STORAGE_KEY,
  "aurora_tab_config": STORAGE_KEY,
  "aurora_search_history": "nordlys_search_history",
  "aurora_language": "nordlys_language",
  "aurora_drawer_width": "nordlys_drawer_width",
  "aurora_custom_themes": "nordlys_custom_themes"
};

/* Runs before anything reads storage. A new key that already exists wins; an
   old key is copied only into an empty new one, then removed, so the move
   happens exactly once and a fresh install never sees it at all. */
function adoptLegacyLocalStorage() {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_LOCAL_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  } catch (error) { /* storage unavailable: nothing to move, nothing to lose */ }
}
/* Two recovery slots, two questions, one level deep.

   RESTORE_POINT_KEY answers "what was here before Nordlys changed it" — a
   migration on load, or an import. UNDO_POINT_KEY answers "what was here before
   I replaced everything" — a reset, or a restore. They are separate because
   neither may quietly spend the other: reset used to clear the restore point,
   which is how the most destructive action in the product came to delete its
   own safety net.

   Taking a step back consumes the undo slot and writes nothing new, so there is
   no chain of snapshots growing behind a person who keeps pressing undo, and
   never more than two copies of a config in storage. */
const RESTORE_POINT_KEY = "nordlys_restore_point";
const UNDO_POINT_KEY = "nordlys_undo_point";
/* A wallpaper is far too large to sit inside a snapshot, so a reset moves it to
   this one slot in the media vault instead of deleting it. One slot, overwritten
   by the next reset. */
const UNDO_MEDIA_ID = "nordlys_undo_bg";

/* Durable state that lives beside the config rather than inside it. A snapshot
   of "everything a reset removes" is only true if it holds these too. */
const SIDE_STORAGE = {
  customThemes: { key: "nordlys_custom_themes", json: true },
  drawerWidth: { key: "nordlys_drawer_width", json: false },
  language: { key: "nordlys_language", json: false },
  searchHistory: { key: "nordlys_search_history", json: true }
};

/* Everything this build writes, and everything any earlier build wrote — the
   list a reset clears. The two recovery slots are deliberately not in it. */
const OWNED_LOCAL_KEYS = [
  STORAGE_KEY, ...Object.values(SIDE_STORAGE).map((entry) => entry.key),
  "aether_tab_config", "aurora_tab_config", "aurora_custom_themes",
  "aurora_drawer_width", "aurora_language", "aurora_search_history"
];
const LIGHT_THEMES = [
  "porcelain-light", "warm-ivory", "sage-light", "sakura-daylight",
  "solarized-light", "nordic-snow", "lavender-mist", "gruvbox-light",
  "peach-sunset", "mint-breeze"
];
/* Old saved theme keys from previous releases → current keys */
/* Backgrounds that no longer exist, and the closest thing that does. Cosmos was
   Aurora without its ribbons. Particles drew almost nothing — 0.08 of 255 away
   from a plain colour, measured. The four gradient compositions were a choice
   between arrangements that sat 4.5 to 8.7 of 255 apart and were never seen
   side by side, so the difference being chosen between could not be perceived
   by the person choosing.

   All four land on Aurora, and the ones that were still stay still: what people
   used a gradient FOR is a coloured field that does not move, which is now the
   aurora with its motion at zero. One scene and a slider, rather than a second
   scene carrying a catalogue. */
const BACKGROUND_MIGRATIONS = {
  "cosmos": "aurora",
  "particles": "aurora",
  "mesh-gradient": "aurora",
  "gradient": "aurora"
};
const STILL_MIGRATIONS = new Set(["particles", "mesh-gradient", "gradient"]);

const THEME_MIGRATIONS = {
  "liquid-glass": "frosted-glass",
  "liquid-tahoe": "frosted-glass",
  "sakura-blossom": "sakura-daylight",
  "amethyst-twilight": "dracula-velvet",
  "sage-garden": "sage-light",
  "boreal": "boreal-emerald"
};

/* Reuses the objects of `before` for the same folders and bookmarks in
   `after`: a folder by its id, or else by name and place; a bookmark by its
   address, in order. Returns `after`'s list, made of the old objects wherever
   one matched, each updated to exactly what `after` says. */
function keepIdentity(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after)) return after;
  const becomes = (target, source) => {
    for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
    return Object.assign(target, source);
  };
  const claimed = new Set();
  const free = (old) => old && !claimed.has(old);
  const urls = (group) => new Set((group?.links || []).map((link) => link?.url));
  const folderFor = (group, index) => {
    if (!group) return null;
    // Its id; else its name where it stood; else its name anywhere (a folder
    // added in front moves every one after it); else where it stood, if
    // enough of its bookmarks are the same (renamed in the other tab).
    const byId = group.id ? before.find((old) => free(old) && old.id === group.id) : null;
    if (byId) return byId;
    if (free(before[index]) && before[index].label === group.label) return before[index];
    const byName = before.find((old) => free(old) && old.label === group.label);
    if (byName) return byName;
    const there = before[index];
    if (free(there)) {
      const theirs = urls(there), ours = [...urls(group)];
      if (ours.length && ours.filter((url) => theirs.has(url)).length * 2 >= ours.length) return there;
    }
    return null;
  };
  return after.map((group, index) => {
    const old = folderFor(group, index);
    if (!old || !group || typeof group !== "object") return group;
    claimed.add(old);
    const spare = new Map();
    for (const link of Array.isArray(old.links) ? old.links : []) {
      if (!link || typeof link.url !== "string") continue;
      if (!spare.has(link.url)) spare.set(link.url, []);
      spare.get(link.url).push(link);
    }
    const links = (Array.isArray(group.links) ? group.links : []).map((link) => {
      const same = link && spare.get(link.url)?.shift();
      return same ? becomes(same, link) : link;
    });
    return becomes(old, { ...group, links });
  });
}

class NordlysApp {
  constructor() {
    adoptLegacyLocalStorage();
    this.defaultConfig = DEFAULT_CONFIG;
    this.config = this.loadConfig();
    this.mediaObjectUrl = null;
    this.init();
  }

  /* The board is the point of the page; the header is how much context sits
     above it. Kept on <body> so Custom CSS can still see the choice. */
  /* One material at three levels. Someone arriving with the four old numbers
     keeps roughly what they had: whether they had turned the blur off is the
     only distinction the levels can honestly preserve. */
  /* Linked folders are refreshed on load and whenever the browser's bookmarks
     change. Nothing here runs, or asks for anything, until a folder is linked. */
  async followBrowserFolders() {
    const sync = window.NordlysBookmarks;
    if (!sync) return;
    const linked = (this.config.groups || []).some((group) => group.source?.folderId);
    if (!linked) { this.stopFollowingBrowser(); return; }

    const pull = async () => {
      if (await sync.refresh(this.config)) {
        this.saveConfig();
        this.grid?.render();
        this.settings?.renderBookmarksManager?.();
      }
    };
    await pull();
    /* Called again whenever a folder is linked or unlinked, so the first folder
       linked in a session is watched from that moment rather than from the next
       open — which is when it used to start. One watch is enough for any
       number of folders. */
    if (this.unwatchBrowser) return;
    // Debounced: a drag inside the browser's manager fires a burst of events.
    let pending = null;
    this.unwatchBrowser = sync.watch(() => {
      clearTimeout(pending);
      pending = setTimeout(pull, 250);
    });
  }

  stopFollowingBrowser() {
    this.unwatchBrowser?.();
    this.unwatchBrowser = null;
  }

  applyGlassLevel() {
    document.documentElement.dataset.glass = this.config.glassLevel || "full";
  }

  /* High legibility is on when the person switches it on, or when the system
     asks for more contrast; the system's asking is followed live. */
  get highLegibility() {
    return Boolean(this.config.highLegibility) || Boolean(this.contrastQuery?.matches);
  }

  applyLegibility() {
    if (!this.contrastQuery && window.matchMedia) {
      this.contrastQuery = window.matchMedia("(prefers-contrast: more)");
      this.contrastQuery.addEventListener?.("change", () => {
        this.applyLegibility();
        if (this.bgEngine) this.updateBackgroundMode();
      });
    }
    document.documentElement.dataset.legibility = this.highLegibility ? "high" : "standard";
    this.queueQuietZones?.();
  }

  applyHeaderStyle() {
    document.body.dataset.header = this.config.headerStyle || "full";
    this.queueQuietZones?.();
  }

  /* ── Quiet zones ──────────────────────────────────────────────────
     The engine keeps the sky readable under the text that sits straight on
     it (see setQuietZones in background.js). This side says where that text
     is and what colour it is, measured from the live page — so a compact
     header, a wrapped date, a narrow window or a new font all send what is
     actually there. Colours are read only once transitions have settled: a
     theme change read one frame in reports the old theme's ink. */
  initQuietZones() {
    const settled = () => window.NordlysUI?.settled?.() ?? Promise.resolve();
    this.queueQuietZones = () => {
      if (this.quietQueued) return;
      this.quietQueued = true;
      requestAnimationFrame(() => settled().then(() => {
        this.quietQueued = false;
        this.sendQuietZones();
      }));
    };
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => this.queueQuietZones());
      for (const id of ["hero", "searchwrap"]) {
        const node = document.getElementById(id);
        if (node) observer.observe(node);
      }
    }
    document.fonts?.ready.then(() => this.queueQuietZones());
    this.queueQuietZones();
  }

  sendQuietZones() {
    const engine = this.bgEngine;
    if (!engine?.setQuietZones) return;
    // A wallpaper hides the canvas; it is measured instead of quietened.
    if (this.config.bgMode === "custom-image" || this.config.bgMode === "custom-video") {
      this.measureWallpaper();
      return;
    }
    const zones = this.textZones();
    const signature = JSON.stringify(zones.map((zone) => [Math.round(zone.x), Math.round(zone.y), Math.round(zone.w), Math.round(zone.h), zone.inks, zone.cover, zone.ground]));
    if (signature === this.quietSignature) return;
    this.quietSignature = signature;
    engine.setQuietZones(zones);
  }

  /* Where text sits over the background and what colour it is: the hero, the
     search field, and — for a wallpaper, which sits behind the folders too —
     every folder, with the glass between it and the picture. */
  textZones({ cards = false } = {}) {
    /* Read by painting: computed colours arrive as rgb(), but also as oklch()
       and color(srgb …) once a colour-mix is involved, and a parser that knew
       only rgb() dropped those zones without a word. */
    const well = this.quietWell || (this.quietWell = document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
    const rgba = (value) => {
      if (!value || value === "transparent") return null;
      well.canvas.width = well.canvas.height = 1;
      well.clearRect(0, 0, 1, 1);
      well.fillStyle = "#000";
      well.fillStyle = value;
      well.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = well.getImageData(0, 0, 1, 1).data;
      return a ? [r, g, b, a / 255] : null;
    };
    const shown = (node) => node && node.getClientRects().length && getComputedStyle(node).visibility !== "hidden";
    const range = document.createRange();
    const zones = [];
    // The clock is large text and needs 3:1; the date and greeting need 4.5.
    // Each target carries a margin, because the solver sees a downscaled sky.
    // High legibility holds them to AAA instead: 4.5 and 7.
    const high = document.documentElement.dataset.legibility === "high";
    const [large, body] = high ? [4.8, 7.3] : [3.3, 4.8];
    for (const [id, target] of [["clock", large], ["date", body], ["greet", body]]) {
      const node = document.getElementById(id);
      if (!shown(node)) continue;
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      const ink = rgba(getComputedStyle(node).color);
      if (!box.width || !box.height || !ink) continue;
      const inks = [[ink.slice(0, 3), target, ink[3]]];
      // The colon is set quieter than the digits and gives out first.
      const colon = node.querySelector(".colon");
      if (colon) inks.push([ink.slice(0, 3), target, ink[3] * Number(getComputedStyle(colon).opacity)]);
      const pad = Math.min(24, box.height * 0.3);
      zones.push({ id, x: box.left - pad, y: box.top - pad / 2, w: box.width + pad * 2, h: box.height + pad, inks });
    }
    const search = document.getElementById("search");
    const field = document.getElementById("q");
    if (shown(search) && field) {
      const box = search.getBoundingClientRect();
      const hint = rgba(getComputedStyle(field, "::placeholder").color);
      const cover = rgba(getComputedStyle(search).backgroundColor);
      if (hint) zones.push({ id: "search", x: box.left, y: box.top, w: box.width, h: box.height, inks: [[hint.slice(0, 3), body, hint[3]]], cover: cover && cover[3] > 0 ? cover : null });
    }
    /* The page under each zone, as the theme paints it: the flat --void was
       darker than most themes' own glows, so the text was judged against a
       page that is not there. Five points of the zone, and the one that is
       hardest on its ink — the lightest under light text, the darkest under
       dark — so a glow's edge crossing the zone is not averaged away. */
    const page = getComputedStyle(document.body);
    const lum = window.NordlysColour?.luminance;
    for (const zone of zones) {
      if (!window.NordlysColour?.backgroundAt || !lum) break;
      const points = [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]].map(([fx, fy]) =>
        window.NordlysColour.backgroundAt(page.backgroundImage, page.backgroundColor, zone.x + zone.w * fx, zone.y + zone.h * fy, innerWidth, innerHeight));
      const ink = lum(zone.inks[0][0]);
      const sorted = points.sort((a, b) => lum(a) - lum(b));
      zone.ground = ink > lum(sorted[2]) ? sorted[sorted.length - 1] : sorted[0];
    }
    if (cards) {
      for (const card of document.querySelectorAll("#board .card")) {
        const box = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        const glass = window.NordlysIcons?.gradientAverage?.(style.backgroundImage) || style.backgroundColor;
        const label = card.querySelector(".lbl");
        const ink = label ? rgba(getComputedStyle(label).color) : null;
        const cover = rgba(glass);
        if (ink) zones.push({ card, x: box.left, y: box.top, w: box.width, h: box.height, inks: [[ink.slice(0, 3), body, ink[3]]], cover: cover && cover[3] > 0 ? cover : null });
      }
    }
    return zones;
  }

  /* ── Clear sky for a wallpaper ──────────────────────────────────────
     A photo is not something the engine paints, so the quiet zones cannot
     reach it — but it can be measured all the same. The picture is sampled as
     the stylesheet shows it, and each place text sits gets exactly what it
     needs and no more: a soft shade behind the clock, the date, the greeting
     and the search field, and a more solid glass on a folder whose patch of
     the picture is bright or busy. Everywhere else the photo is left as it
     is — dimming the whole picture to rescue the words made a snowfield grey.
     The Dim slider still dims the whole of it, as a choice. */
  measureWallpaper() {
    const image = document.getElementById("bg-media");
    const video = document.getElementById("bg-video");
    const source = image?.classList.contains("active") && image.complete && image.naturalWidth ? image
      : (video?.classList.contains("active") && video.readyState >= 2 ? video : null);
    const width = source ? (source.naturalWidth || source.videoWidth) : 0;
    const height = source ? (source.naturalHeight || source.videoHeight) : 0;
    const layer = this.scrimLayer();
    if (!source || !width || !height) {
      layer.replaceChildren();
      for (const card of document.querySelectorAll("#board .card")) card.style.removeProperty("--card-solid");
      document.getElementById("search")?.style.removeProperty("--search-solid");
      return;
    }
    // object-fit: cover — the part of the picture the viewport actually shows.
    const scale = Math.max(innerWidth / width, innerHeight / height);
    const sw = 96, sh = Math.max(24, Math.round((96 * innerHeight) / innerWidth));
    const well = this.wallpaperWell || (this.wallpaperWell = document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
    well.canvas.width = sw;
    well.canvas.height = sh;
    try {
      well.drawImage(source, (width - innerWidth / scale) / 2, (height - innerHeight / scale) / 2, innerWidth / scale, innerHeight / scale, 0, 0, sw, sh);
    } catch {
      return;
    }
    const { data } = well.getImageData(0, 0, sw, sh);
    // The picture as it is on screen, after the dim the person chose.
    const chosen = Math.max(0, Math.min(0.8, (this.config.bgDim || 0) / 100));
    const paint = (value) => {
      well.canvas.width = well.canvas.height = 1;
      well.fillStyle = value;
      well.fillRect(0, 0, 1, 1);
      return [...well.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const shade = paint(getComputedStyle(document.getElementById("bg-dimmer") || document.body).backgroundColor || "#02040a");
    const pixelsIn = (zone) => {
      const pixels = [];
      const x0 = Math.max(0, Math.floor((zone.x / innerWidth) * sw)), x1 = Math.min(sw, Math.ceil(((zone.x + zone.w) / innerWidth) * sw));
      const y0 = Math.max(0, Math.floor((zone.y / innerHeight) * sh)), y1 = Math.min(sh, Math.ceil(((zone.y + zone.h) / innerHeight) * sh));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * sw + x) * 4;
        pixels.push([0, 1, 2].map((c) => data[i + c] * (1 - chosen) + shade[c] * chosen).concat(1));
      }
      return pixels;
    };
    const zones = this.textZones({ cards: true });
    const scrims = [];
    /* The clock, the date and the greeting are one shade, not three: three
       read as smudges. It is as strong as the hardest of them needs. */
    const hero = zones.filter((zone) => ["clock", "date", "greet"].includes(zone.id));
    const alone = zones.filter((zone) => zone.id === "search");
    if (hero.length) {
      const need = Math.max(...hero.map((zone) => NordlysBackgroundEngine.quietAlpha(pixelsIn(zone), shade, { ...zone, most: 0.85 })));
      const left = Math.min(...hero.map((zone) => zone.x)), top = Math.min(...hero.map((zone) => zone.y));
      const right = Math.max(...hero.map((zone) => zone.x + zone.w)), bottom = Math.max(...hero.map((zone) => zone.y + zone.h));
      if (need > 0.01) scrims.push({ zone: { x: left, y: top, w: right - left, h: bottom - top }, need });
    }
    this.paintScrims(layer, scrims, shade);
    /* A folder's glass, made as solid as its patch of the picture needs. Its
       words get more headroom than the rest: the icon plates cast shadows on
       the top of every name, and the vignette above the board darkens the
       edges of a light theme — neither of which the solver sees. */
    const headroom = this.isLightTheme() ? 1.5 : 0.8;
    for (const zone of zones.filter((entry) => entry.card)) {
      const tint = paint(getComputedStyle(document.documentElement).getPropertyValue("--card-tint").trim() || "#0f1c32");
      const inks = zone.inks.map(([colour, target, alpha]) => [colour, target + headroom, alpha]);
      const need = NordlysBackgroundEngine.quietAlpha(pixelsIn(zone), tint, { inks, most: 0.97 });
      if (need > 0.01) zone.card.style.setProperty("--card-solid", need.toFixed(3));
      else zone.card.style.removeProperty("--card-solid");
    }
    // The search field is glass, like a folder: it gets more solid, not a shade.
    const search = document.getElementById("search");
    const deep = paint(getComputedStyle(document.documentElement).getPropertyValue("--card-tint-deep").trim() || "#070d18");
    for (const zone of alone) {
      const inks = zone.inks.map(([colour, target, alpha]) => [colour, target + headroom * 0.6, alpha]);
      const need = NordlysBackgroundEngine.quietAlpha(pixelsIn(zone), deep, { inks, most: 0.97 });
      if (need > 0.01) search?.style.setProperty("--search-solid", need.toFixed(3));
      else search?.style.removeProperty("--search-solid");
    }
  }

  scrimLayer() {
    let layer = document.getElementById("wallpaper-scrims");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "wallpaper-scrims";
      layer.setAttribute("aria-hidden", "true");
      document.getElementById("bg-container")?.append(layer);
    }
    return layer;
  }

  /* The shade for the hero is the one a lock screen uses: the whole width of
     the picture, full strength from the top down to just past the words, then
     gone over a short fall. An ellipse or a blob around the words read as
     a smudge on the photo; a band from the top reads as evening. */
  paintScrims(layer, scrims, [r, g, b]) {
    layer.replaceChildren(...scrims.map(({ zone, need }) => {
      const scrim = document.createElement("span");
      const solid = Math.round(zone.y + zone.h + 12);
      const fade = solid + 220;
      const colour = `rgba(${r}, ${g}, ${b}, ${need.toFixed(3)})`;
      scrim.className = "wallpaper-scrim";
      scrim.style.cssText = `left:0;top:0;width:100%;height:${fade}px;background:linear-gradient(to bottom, ${colour} 0, ${colour} ${solid}px, rgba(${r}, ${g}, ${b}, 0) ${fade}px)`;
      return scrim;
    }));
  }

  normalizeStoredConfig(config) {
    let changed = false;
    if (THEME_MIGRATIONS[config.theme]) { config.theme = THEME_MIGRATIONS[config.theme]; changed = true; }
    /* Keyed on the presence of an old value, not the absence of the new one.
       The defaults are merged before this runs, so "glassLevel is missing" can
       never be true — it is in DEFAULT_CONFIG. glassBlur no longer is, so its
       presence means it came from something the user actually saved. */
    if (config.glassBlur !== undefined) {
      const blur = config.glassBlur;
      config.glassLevel = blur === 0 ? "off" : (blur != null && blur <= 14 ? "subtle" : "full");
      for (const dead of ["glassBlur", "glassSaturate", "glassOpacity", "glassSheen"]) delete config[dead];
      changed = true;
    }
    if (BACKGROUND_MIGRATIONS[config.bgMode]) {
      // Whatever held still keeps holding still.
      if (STILL_MIGRATIONS.has(config.bgMode)) config.bgMotion = 0;
      config.bgMode = BACKGROUND_MIGRATIONS[config.bgMode];
      changed = true;
    }
    if (config.gradient !== undefined) { delete config.gradient; changed = true; }
    /* Search goes through Chrome's own default engine now, so a stored engine
       choice has nothing to drive. Dropped rather than kept as dead weight. */
    for (const dead of ["defaultEngine", "customEngineUrl", "showSuggestions"]) {
      if (config[dead] !== undefined) { delete config[dead]; changed = true; }
    }
    if (Number(config.tileSize) >= 50 && Number(config.tileSize) < 56) { config.tileSize = 56; changed = true; }
    /* An icon taken from a web address before addresses were kept, and
       stored as that address because the picture could not be fetched, still
       says where it came from: it becomes the first entry of its history.
       A favicon from the Website icon sources is not an address anyone typed. */
    const FAVICON = /(?:_favicon|favicons\?|duckduckgo\.com\/ip3|apple-touch-icon)/i;
    for (const group of Array.isArray(config.groups) ? config.groups : []) {
      for (const link of Array.isArray(group?.links) ? group.links : []) {
        const image = link?.customImg;
        if (typeof image !== "string" || !/^https?:\/\/\S+$/i.test(image) || image.length > 2048 || FAVICON.test(image)) continue;
        if (link.iconUrl !== undefined || link.iconUrls !== undefined) continue;
        link.iconUrl = image;
        link.iconUrls = [{ url: image, thumb: "", at: 0 }];
        changed = true;
      }
    }
    return changed;
  }

  /* Across every product in this category, the complaint that turns a five-star
     user into an uninstall in one event is losing their setup — and the most
     common cause is not a crash but an upgrade that migrated something wrongly.
     Nothing here can promise a migration is correct. It can promise the
     previous state still exists afterwards. */
  snapshotBeforeMigration(previous, cause = "migration") {
    /* A snapshot that cannot be written must never stop the app loading, so the
       answer is reported rather than thrown. The callers that are about to
       destroy something on purpose check it; the load path does not. */
    return this.writeSnapshot(RESTORE_POINT_KEY, {
      savedAt: new Date().toISOString(),
      cause,
      version: previous.version || "unknown",
      config: previous
    });
  }

  /* Everything a reset removes, in one object: the config, and the stores that
     live beside it. Deep-copied, because the caller is about to change the
     originals. */
  captureRecoveryBundle(cause) {
    const bundle = {
      savedAt: new Date().toISOString(),
      cause,
      version: this.config?.version || "unknown",
      config: JSON.parse(JSON.stringify(this.config || {}))
    };
    for (const [field, entry] of Object.entries(SIDE_STORAGE)) {
      try {
        const raw = localStorage.getItem(entry.key);
        if (raw === null) continue;
        bundle[field] = entry.json ? JSON.parse(raw) : raw;
      } catch (error) { /* an unreadable store is one this snapshot cannot promise */ }
    }
    return bundle;
  }

  writeSnapshot(key, bundle) {
    try {
      localStorage.setItem(key, JSON.stringify(bundle));
      return true;
    } catch (error) {
      return false;
    }
  }

  readSnapshot(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  clearSnapshot(key) {
    try { localStorage.removeItem(key); } catch (error) { /* nothing to clear */ }
  }

  restorePoint() { return this.readSnapshot(RESTORE_POINT_KEY); }
  undoPoint() { return this.readSnapshot(UNDO_POINT_KEY); }

  /* Puts a bundle back: the config, then every store it carries. A field the
     bundle does not carry is removed rather than left behind, because "put it
     back the way it was" is a whole answer or it is a misleading one. */
  applyRecoveryBundle(bundle) {
    if (!bundle || !bundle.config) return false;
    const previous = this.config;
    this.config = Object.assign({}, DEFAULT_CONFIG, bundle.config);
    window.NordlysConfigSchema?.repairConfig(this.config, DEFAULT_CONFIG);
    /* If it will not persist, nothing has happened: the page keeps the config
       it had rather than showing one that the next reload will contradict. */
    if (!this.saveConfig()) { this.config = previous; return false; }
    this.loadedFromStore = true;
    for (const [field, entry] of Object.entries(SIDE_STORAGE)) {
      try {
        if (bundle[field] === undefined) { localStorage.removeItem(entry.key); continue; }
        localStorage.setItem(entry.key, entry.json ? JSON.stringify(bundle[field]) : String(bundle[field]));
      } catch (error) { /* the config landed; a side store that will not take is not worth failing for */ }
    }
    const language = this.config.language || bundle.language;
    if (language && window.I18N && window.I18N.currentLang !== language) window.I18N.setLanguage(language);
    this.applyLoadedConfig();
    this.settings?.adoptRestoredStores?.();
    return true;
  }

  /* Everything on the page that reads the config, repainted where it stands.
     Used when a config arrives after the first paint — from the browser-storage
     mirror, and from a restore. A reload would do the same job, and is what
     restore used to do, but it also throws away the seconds in which somebody
     can say "no, put that back". */
  applyLoadedConfig() {
    this.applyThemeTokens();
    this.applyGeometryTokens();
    this.applyHeaderStyle();
    this.applyGlassLevel();
    this.injectCustomCSS(this.config.customCss || "");
    this.updateBackgroundMode();
    this.grid?.render();
    this.widgets?.updateClock();
    const cssEditor = document.getElementById("css-editor");
    if (cssEditor) cssEditor.value = this.config.customCss || "";
    this.settings?.syncFormValues?.();
    this.settings?.renderBookmarksManager?.();
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // What was stored, kept exactly as it was in case anything below changes it.
        const original = JSON.parse(stored);
        const aged = Boolean(window.NordlysConfigSchema?.migrateRaw(parsed));
        const cfg = Object.assign({}, DEFAULT_CONFIG, parsed);
        /* Remembered for the mirror: only a config this instance loaded or
           adopted from a store may ever be written there. The defaults it
           starts on when nothing is stored must not be. */
        this.loadedFromStore = true;
        /* Shapes that would crash the page — groups that is not a list — are
           coerced first, so the migrations below never meet them. Whatever was
           stored is kept before it is written over. */
        const repaired = Boolean(window.NordlysConfigSchema?.repairConfig(cfg, DEFAULT_CONFIG));
        if (this.normalizeStoredConfig(cfg) || repaired || aged) {
          // Keep what the user had, exactly as it was, before writing over it.
          this.snapshotBeforeMigration(original);
          /* Its own try, and this is the whole reason for it. A board carrying
             embedded icons runs to megabytes; with a snapshot of the same size
             beside it, the rewrite is what meets the quota. When that throw
             reached the outer catch, this method returned DEFAULT_CONFIG — an
             empty board — while the real one sat untouched in storage one line
             away. The migrated shape is held in memory either way; storage
             simply keeps the older shape until there is room for the new one. */
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            if (typeof chrome !== "undefined") chrome.storage?.local?.set?.({ [STORAGE_KEY]: cfg });
          } catch (error) { /* held in memory; storage keeps what it already had */ }
        }
        return cfg;
      }
    } catch (e) {}
    this.loadedFromStore = false;
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  /* Answers whether the write landed. Almost every caller is an edit small
     enough that it always does and ignores the answer; the paths that are about
     to reload the page, or to destroy something, check it — a swallowed
     QuotaExceededError followed by a reload looks exactly like "nothing
     happened", which is the worst way for a product to lose something. */
  saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: this.config }, () => {
          if (chrome.runtime?.lastError) this.reportSaveFailure();
        });
      }
      return true;
    } catch (e) {
      this.reportSaveFailure();
      return false;
    }
  }

  /* A change that is not saved is gone on the next new tab, and nearly every
     caller of saveConfig carries on as if it had worked. So a failure is said
     once — not once per keystroke — with the way out attached: a backup file
     does not depend on the storage that has just refused. */
  reportSaveFailure() {
    const now = Date.now();
    if (now - (this.lastSaveWarning || 0) < 60000) return;
    this.lastSaveWarning = now;
    const say = (key, fallback) => {
      const value = window.I18N?.t(key);
      return value && value !== key ? value : fallback;
    };
    window.NordlysUI?.showUndoToast?.({
      message: say("toast.saveFailed", "There is not enough room in storage to save that."),
      actionLabel: say("toast.exportBackup", "Export a backup"),
      duration: 12000,
      onAction: () => document.getElementById("cfg-export")?.click()
    });
  }

  /* chrome.storage is the page's backup copy, and the only copy left when Chrome
     clears site data. This is the one place that reads it.

     The rule is about this instance, not about the stores. If this page started
     on defaults because nothing was stored, then anything real that exists by
     the time the answer arrives is adopted — from localStorage first, since a
     second tab may have restored and written it while this request was in
     flight, and from the mirror otherwise. And the mirror is only ever written
     with a config that was loaded or adopted from a store. Two earlier versions
     of this method broke that rule in two ways. One tidied the mirror from a
     separate call while the live config was still defaults, and wrote defaults
     over the only copy. The next keyed the adopt decision on whether
     localStorage was empty at callback time: with two tabs opening at once — an
     extension update reloads every open new-tab page together — the second
     tab's callback found localStorage already filled by the first, skipped the
     adopt, and published its own defaults to the mirror. Both were reproduced
     in a real Chromium before they shipped. */
  restoreFromChromeStorage() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    try {
      chrome.storage.local.get([STORAGE_KEY, ...LEGACY_STORAGE_KEYS], (data) => {
        if (!data) return;
        const legacyPresent = LEGACY_STORAGE_KEYS.some((key) => data[key] !== undefined);
        let migrated = false;

        if (!this.loadedFromStore) {
          let source = null;
          let fromMirror = false;
          try {
            const written = localStorage.getItem(STORAGE_KEY);
            if (written) source = JSON.parse(written);
          } catch (e) {}
          if (!source) {
            source = data[STORAGE_KEY] || LEGACY_STORAGE_KEYS.map((key) => data[key]).find(Boolean);
            fromMirror = Boolean(source);
          }
          if (source && source.groups) {
            const original = JSON.parse(JSON.stringify(source));
            const aged = Boolean(window.NordlysConfigSchema?.migrateRaw(source));
            this.config = Object.assign({}, DEFAULT_CONFIG, source);
            const repaired = Boolean(window.NordlysConfigSchema?.repairConfig(this.config, DEFAULT_CONFIG));
            migrated = this.normalizeStoredConfig(this.config) || repaired || aged;
            source = original;
            if (migrated) this.snapshotBeforeMigration(source);
            this.loadedFromStore = true;
            /* Same reason as loadConfig: a write that will not fit must not
               take the repaint down with it and leave a blank board in front
               of a config that is perfectly intact. */
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config)); }
            catch (error) { /* held in memory; the mirror below still has it */ }
            this.applyLoadedConfig();
            if (fromMirror && typeof toast === "function") {
              toast(window.I18N ? window.I18N.t("toast.restored") : "Settings restored from browser storage", "success");
            }
          }
        }

        /* Never with defaults. Rewritten when the mirror carried an old key, and
           when what came in needed a migration — otherwise the backup keeps a
           shape the code no longer reads and restores it un-migrated next time. */
        if (!this.loadedFromStore) return;
        if (legacyPresent || migrated) chrome.storage.local.set({ [STORAGE_KEY]: this.config });
        if (legacyPresent) chrome.storage.local.remove(LEGACY_STORAGE_KEYS);
      });
    } catch (e) {}
  }

  init() {
    // Where the last press was, so a theme chosen by it can grow from there.
    window.addEventListener("pointerdown", (event) => {
      this.lastPress = { x: event.clientX, y: event.clientY, at: performance.now() };
    }, { capture: true, passive: true });
    // Initialize I18N (config -> saved pick -> browser language)
    const savedLang = localStorage.getItem("nordlys_language");
    const supported = window.I18N ? Object.keys(window.I18N.translations) : ["en"];
    const navLang = (navigator.language || "en").slice(0, 2).toLowerCase();
    const lang = this.config.language || savedLang || (supported.includes(navLang) ? navLang : "en");
    this.config.language = lang;
    if (window.I18N) window.I18N.setLanguage(lang);

    window.addEventListener("nordlys:languagechange", () => {
      this.widgets?.refreshLabels();
      this.widgets?.updateClock();
      this.grid?.render();
      this.settings?.renderBookmarksManager();
      this.settings?.renderThemeCards();
    });

    // Typography left the theme; carry any font a custom theme still stores.
    if (window.NordlysType?.migrate(this.config)) this.saveConfig();

    // 1. Apply Active Theme, Geometry & Custom CSS
    this.applyThemeTokens();
    this.applyGeometryTokens();
    this.applyHeaderStyle();
    this.applyGlassLevel();
    this.applyLegibility();
    this.followBrowserFolders();
    if (this.config.customCss) {
      this.injectCustomCSS(this.config.customCss);
    }

    // 2. Initialize background engine
    this.bgEngine = new NordlysBackgroundEngine();
    this.updateBackgroundMode();

    // 3. Initialize widgets
    this.widgets = new WidgetsController(this);
    this.grid = new GridController(this);
    this.settings = new SettingsController(this);

    // 4. Render Grid
    this.grid.render();
    this.initQuietZones();

    // 5. Global Keyboard Shortcuts & Lifecycle
    this.initGlobalShortcuts();
    this.initVisibilityListener();
    this.initColorModeListener();
    this.watchOtherTabs();
    this.restoreFromChromeStorage();
  }

  /* Every open new tab holds its own copy of the config, and a save writes
     the whole of it. A tab left open kept the board as it was when it opened,
     so a bookmark added in another tab was written over the moment anything
     was changed here. When another tab saves, this one takes what it saved —
     through the same repairs a load makes — and redraws. */
  watchOtherTabs() {
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      let parsed;
      try { parsed = JSON.parse(event.newValue); } catch { return; }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      window.NordlysConfigSchema?.migrateRaw(parsed);
      const next = Object.assign({}, DEFAULT_CONFIG, parsed);
      window.NordlysConfigSchema?.repairConfig(next, DEFAULT_CONFIG);
      this.normalizeStoredConfig(next);
      /* Another tab changing its clock or its sky leaves this board as it
         is, and whatever is open over it stays open. Only a different board
         lets go of the old one. */
      const sameBoard = JSON.stringify(next.groups) === JSON.stringify(this.config.groups);
      this.letGoOfTheOldBoard({ entirely: !sameBoard });
      // The data is taken at once — that is what keeps it from being written
      // over. Drawing it waits: one redraw a frame, however fast the other tab
      // saves (a slider drag saves on every step), and none while hidden.
      /* Folders and bookmarks this tab already holds are updated in place
         rather than replaced, so everything still pointing at them — a list
         row mid-rename, an open editor — writes into the live config instead
         of an orphan that the next save would leave behind. */
      next.groups = keepIdentity(this.config.groups, next.groups);
      this.config = next;
      this.loadedFromStore = true;
      this.retargetEditors();
      // Arrange, still open over the same board, starts its steps back from
      // this one: the ones it had hold the folders just replaced.
      const arrange = this.grid?.arrange;
      if (sameBoard && arrange?.active) {
        arrange.history = [];
        arrange.entry = arrange.snapshot();
        arrange.refresh();
      }
      this.redrawAdopted();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.adoptedPending) this.redrawAdopted();
    });
  }

  redrawAdopted() {
    this.adoptedPending = true;
    if (document.hidden || this.adoptedFrame) return;
    /* Someone typing in a field of their own — a folder's name, the CSS
       editor — keeps what they are typing: the redraw would rebuild the field
       under them. It waits until they leave it. */
    const typing = document.activeElement?.closest?.("input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable=\"true\"]");
    if (typing && !typing.closest("#board")) {
      typing.addEventListener("blur", () => { if (this.adoptedPending) this.redrawAdopted(); }, { once: true });
      return;
    }
    this.adoptedFrame = requestAnimationFrame(() => {
      this.adoptedFrame = null;
      this.adoptedPending = false;
      const next = this.config;
      if (window.I18N && next.language && next.language !== window.I18N.currentLang) window.I18N.setLanguage(next.language);
      this.applyLegibility();
      this.bgEngine?.setPalettes?.(Array.isArray(next.bgPalettes) ? next.bgPalettes : []);
      this.applyLoadedConfig();
      this.settings?.renderThemeCards?.();
    });
  }

  /* What holds on to the board being replaced: a drag in flight, Arrange's
     steps back (they point at folders that are no longer these), and the two
     dialogs that name a bookmark by its position. */
  letGoOfTheOldBoard({ entirely = true } = {}) {
    this.grid?.drag?.cancel?.();
    // A command being previewed holds a copy of the whole config to put back,
    // and to start from on Enter; that copy is the old one now.
    if (this.widgets?.search?.commandSnapshot) {
      this.widgets.search.endCommandMode();
      // Its rows name folders by where they were; the next key draws new ones.
      this.widgets.search.closeSuggestions();
    }
    if (!entirely) return;
    const arrange = this.grid?.arrange;
    if (arrange?.active) {
      arrange.history = [];
      arrange.entry = null;
      arrange.exit();
    }
  }

  /* The icon picker and the bookmark editor remember their bookmark by where
     it was. After another tab's board comes in, that place may hold another
     bookmark, so each is pointed at where its own bookmark is now, and it
     closes only if that bookmark is gone. */
  retargetEditors() {
    const groups = this.config.groups || [];
    const find = (link) => {
      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const lIdx = (groups[gIdx]?.links || []).indexOf(link);
        if (lIdx >= 0) return { gIdx, lIdx };
      }
      return null;
    };
    const settings = this.settings;
    if (settings?.activeIconTarget && settings.activeIconLink) {
      const place = find(settings.activeIconLink);
      if (place) settings.activeIconTarget = place;
      else settings.closeIconModal?.();
    }
    const grid = this.grid;
    /* A menu open on a bookmark or a folder, and the folder editor, act on
       what they were opened for — or not at all once it is gone. */
    const tileMenuOpen = grid?.tileCtxMenu && !grid.tileCtxMenu.hidden;
    if (tileMenuOpen && grid.activeTileLink) {
      const place = find(grid.activeTileLink);
      if (place) grid.activeTileTarget = place; else grid.closeContextMenus?.();
    }
    const folderOpen = (grid?.folderCtxMenu && !grid.folderCtxMenu.hidden) || grid?.quickFolderDialog?.isOpen;
    if (folderOpen && grid.activeFolderGroup) {
      const at = groups.indexOf(grid.activeFolderGroup);
      if (at >= 0) grid.activeFolderTarget = at;
      else { grid.closeContextMenus?.(); grid.closeQuickFolderModal?.(); }
    }
    if (grid?.quickDialog?.isOpen && grid.activeTileLink) {
      const place = find(grid.activeTileLink);
      if (!place) { grid.closeQuickEditModal?.(); return; }
      // The folder chosen in its list, by the folder rather than its place.
      const select = document.getElementById("quick-folder-select");
      const chosen = grid.quickFolderChoices?.[Number(select?.value)];
      grid.activeTileTarget = place;
      grid.fillQuickFolders?.(groups.includes(chosen) ? chosen : groups[place.gIdx]);
    }
  }

  /* ── Theme Token Engine ─────────────────────────────────────────── */

  /* Is a given (or the active) theme intrinsically light? The UI chrome
     (.light-ui) always follows the THEME — never a mismatched overlay. */
  isLightTheme(themeKey = this.config.theme) {
    if (themeKey === "custom" && this.config.customTheme) {
      return relativeLuminance(this.config.customTheme.bg) > 0.6;
    }
    return LIGHT_THEMES.includes(themeKey);
  }

  /* Switch theme with a soft cross-fade (View Transitions API when available). */
  setTheme(themeKey, customTheme = null) {
    if (customTheme) {
      this.config.theme = "custom";
      this.config.customTheme = customTheme;
    } else {
      this.config.theme = themeKey;
      delete this.config.customTheme;
      // Remember the last explicit pick per family so Dark/Light/Auto can flip back
      if (LIGHT_THEMES.includes(themeKey)) {
        this.config.lastLightTheme = themeKey;
      } else {
        this.config.lastDarkTheme = themeKey;
      }
    }
    // Keep the segmented switcher truthful (Auto stays Auto)
    if (this.config.colorMode !== "auto") {
      this.config.colorMode = this.isLightTheme() ? "light" : "dark";
    }
    this.saveConfig();

    const apply = () => {
      this.applyThemeTokens();
      this.settings?.renderThemeCards();
      this.settings?.syncColorModeSwitcher?.();
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduceMotion) {
      /* Chosen by a click, the new theme spreads across the page from the
         point that chose it (motion.css); changed any other way — Auto at
         dusk, a command — it crossfades. The circle's radius reaches the
         farthest corner of the window from that point. */
      const root = document.documentElement;
      const point = this.lastPress && performance.now() - this.lastPress.at < 1500 ? this.lastPress : null;
      if (point) {
        const radius = Math.hypot(Math.max(point.x, innerWidth - point.x), Math.max(point.y, innerHeight - point.y));
        root.style.setProperty("--reveal-x", `${point.x}px`);
        root.style.setProperty("--reveal-y", `${point.y}px`);
        root.style.setProperty("--reveal-r", `${Math.ceil(radius)}px`);
        root.classList.add("theme-reveal");
      }
      const transition = document.startViewTransition(apply);
      /* Choosing another theme before the first transition settles aborts it,
         and the rejected promise surfaces as an uncaught error in the console.
         The abort is the correct outcome here, not a failure. */
      transition.ready?.catch(() => {});
      transition.finished?.catch(() => {}).finally(() => root.classList.remove("theme-reveal"));
    } else {
      apply();
    }
  }

  /* Dark / Light / Auto segmented control. Dark and Light swap to the last
     theme of that family; Auto follows the OS and keeps following it live. */
  setColorMode(mode) {
    this.config.colorMode = mode;
    let targetTheme = this.config.theme;

    if (mode === "dark" && this.isLightTheme()) {
      targetTheme = this.config.lastDarkTheme || "aurora-void";
    } else if (mode === "light" && !this.isLightTheme()) {
      targetTheme = this.config.lastLightTheme || "porcelain-light";
    } else if (mode === "auto") {
      targetTheme = this.resolveAutoTheme();
    }

    if (targetTheme !== this.config.theme) {
      this.setTheme(targetTheme);
    } else {
      this.saveConfig();
      this.applyThemeTokens();
      this.settings?.renderThemeCards();
      this.settings?.syncColorModeSwitcher?.();
    }
  }

  resolveAutoTheme() {
    const osIsLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    if (osIsLight) {
      return this.isLightTheme() ? this.config.theme : (this.config.lastLightTheme || "porcelain-light");
    }
    return this.isLightTheme() ? (this.config.lastDarkTheme || "aurora-void") : this.config.theme;
  }

  applyThemeTokens() {
    const root = document.documentElement;
    const isLight = this.isLightTheme();

    if (this.config.theme === "custom" && this.config.customTheme) {
      root.dataset.theme = "custom";
      this.applyCustomTokens(this.config.customTheme, isLight);
    } else {
      THEME_INLINE_TOKENS.forEach((token) => root.style.removeProperty(token));
      let theme = this.config.theme || "aurora-void";
      if (THEME_MIGRATIONS[theme]) theme = THEME_MIGRATIONS[theme];
      root.dataset.theme = theme;
      root.classList.toggle("light-ui", isLight);
    }
    root.dataset.colorMode = this.config.colorMode || "dark";

    // The canvas engine repaints its aurora / orbs / dust in theme colors
    this.bgEngine?.refreshPalette();

    // Fonts ride the same path as the palette so one call settles the whole look.
    window.NordlysType?.apply(this.config, root);
    // A new face can cut a name short, or give it back its room.
    requestAnimationFrame(() => this.grid?.relayout?.());

    // Icon plates are chosen against the theme they were measured on, so a new
    // palette invalidates every one of them.
    window.NordlysIcons?.refreshIconContrast();

    // New inks for the text the engine keeps readable.
    this.queueQuietZones?.();
  }

  initColorModeListener() {
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      mq.addEventListener("change", () => {
        if (this.config.colorMode === "auto") {
          const target = this.resolveAutoTheme();
          if (target !== this.config.theme) {
            this.setTheme(target);
            this.config.colorMode = "auto"; // setTheme keeps auto, but be explicit
            this.saveConfig();
            this.settings?.syncColorModeSwitcher?.();
          }
        }
      });
    }
  }

  /* Derive & apply the full token set from a custom theme's 7 colors + font.
     Also used by the Theme Studio for its live preview (no save involved). */
  applyCustomTokens(ct, isLightOverride = false) {
    const root = document.documentElement;
    THEME_INLINE_TOKENS.forEach((token) => root.style.removeProperty(token));

    const set = (token, value) => value && root.style.setProperty(token, value);
    const rgba = (hex, a) => {
      const c = hexToRgb(hex);
      return c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${a})` : null;
    };
    const shade = (hex, factor) => {
      const c = hexToRgb(hex);
      if (!c) return null;
      const f = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
      return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
    };

    set("--void", ct.bg);
    set("--void-gradient", `radial-gradient(130% 100% at 50% -10%, ${shade(ct.bg, 1.45) || ct.bg} 0%, ${ct.bg} 55%, ${shade(ct.bg, 0.6) || ct.bg} 100%)`);
    set("--glass", rgba(ct.card, 0.5));
    set("--glass-border", rgba(ct.border, 0.55));
    set("--frost", rgba(ct.accent, 0.18));
    set("--card-tint", ct.card);
    set("--card-tint-deep", shade(ct.card, 0.55));
    set("--accent", ct.accent);
    set("--accent-glow", rgba(ct.glow || ct.accent, 0.4));
    const accentLuminance = relativeLuminance(ct.accent);
    const blackContrast = (accentLuminance + 0.05) / 0.05;
    const whiteContrast = 1.05 / (accentLuminance + 0.05);
    set("--nl-on-accent", blackContrast >= whiteContrast ? "#000000" : "#ffffff");
    /* The accent as ink, for the places it is a word rather than a fill: taken
       toward the theme's own text colour until it reads on the page and on the
       card. A mid-tone accent is a fine fill and an unreadable word. */
    const contrast = (a, b) => {
      const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const toward = (from, to, t) => {
      const a = hexToRgb(from), b = hexToRgb(to);
      if (!a || !b) return from;
      const mix = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
      return `#${mix(a.r, b.r)}${mix(a.g, b.g)}${mix(a.b, b.b)}`;
    };
    let accentInk = ct.accent;
    for (let step = 1; step <= 20 && Math.min(contrast(accentInk, ct.bg), contrast(accentInk, ct.card)) < 4.5; step++) {
      accentInk = toward(ct.accent, ct.text, step / 20);
    }
    set("--accent-ink", accentInk);
    set("--ink", ct.text);
    set("--dim", ct.dim);
    set("--faint", ct.dim);
    set("--font-main", ct.font);
    set("--font-display", ct.font);

    // Canvas shader palette derived from the custom accent pair
    set("--shader-1", ct.accent);
    set("--shader-2", ct.glow || ct.accent);
    set("--shader-3", ct.dim);

    // Legacy aliases so older user Custom CSS keeps working
    set("--bg-void", ct.bg);
    set("--card-bg", ct.card);
    set("--card-border", ct.border);
    set("--font-family", ct.font);

    root.classList.toggle("light-ui", isLightOverride || relativeLuminance(ct.bg) > 0.6);
    this.bgEngine?.refreshPalette();
  }

  applyGeometryTokens() {
    const root = document.documentElement.style;
    const cfg = this.config;

    /* The glass level owns these now. Writing them inline here put them beyond
       the reach of every selector, which is why a control that looked wired up
       changed nothing at all. */
    if (cfg.cardRadius != null) root.setProperty("--card-radius", `${cfg.cardRadius}px`);
    // Preserve a usable 56px floor; narrow layouts reflow instead of collapsing controls.
    if (cfg.tileSize != null) root.setProperty("--tw", `clamp(56px, 12vw, ${Math.max(56, cfg.tileSize)}px)`);
    if (cfg.cardGap != null) root.setProperty("--grid-gap", `${cfg.cardGap}px`);
    if (Number.isFinite(cfg.boardGap)) root.setProperty("--board-gap-set", `${cfg.boardGap}px`);
    else root.removeProperty("--board-gap-set");
    root.setProperty("--board-max", `${BOARD_WIDTHS[cfg.boardWidth] || BOARD_WIDTHS.standard}px`);
    document.body.classList.toggle("tile-names-hidden", cfg.tileLabels === false);
    if (cfg.cardGlow != null) root.setProperty("--card-glow-intensity", `${cfg.cardGlow / 100}`);

    // Icon Shape
    if (cfg.iconShape === "circle") {
      root.setProperty("--tile-radius", "50%");
    } else if (cfg.iconShape === "rounded") {
      root.setProperty("--tile-radius", "8px");
    } else {
      root.setProperty("--tile-radius", "calc(var(--tw) * 0.25)");
    }

    // Dynamic Hover Class on document.body
    const body = document.body;
    body.classList.remove("hover-lift", "hover-glow", "hover-scale", "hover-none");
    body.classList.add(`hover-${cfg.hoverEffect || "lift"}`);

    document.body.classList.toggle("seconds", !!cfg.showSeconds);
    this.applyWallpaperEffects();
  }

  applyWallpaperEffects() {
    const root = document.documentElement.style;
    const blur = Math.max(0, this.config.bgBlur || 0);
    const dim = Math.max(0, Math.min(0.8, (this.config.bgDim || 0) / 100));
    root.setProperty("--bg-blur", `${blur}px`);
    root.setProperty("--bg-blur-px", blur);
    root.setProperty("--bg-dim", dim);
  }

  initGlobalShortcuts() {
    window.addEventListener("keydown", (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const isCmd = isMac ? e.metaKey : e.ctrlKey;
      const activeTag = document.activeElement ? document.activeElement.tagName : "";
      const isInput = activeTag === "INPUT" || activeTag === "TEXTAREA";

      // 1. Cmd+K / Ctrl+K -> Focus Search
      if (isCmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("q");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // 2. Cmd+, / Ctrl+, -> Toggle Settings Drawer
      if (isCmd && e.key === ",") {
        e.preventDefault();
        if (this.settings?.drawer?.classList.contains("open")) {
          this.settings.close();
        } else {
          this.settings?.open();
        }
        return;
      }

      // 3. Alt+1 .. Alt+9 -> the first nine tiles on the board, in reading order
      if (e.altKey && !e.ctrlKey && !e.metaKey && !isInput && e.code.startsWith("Digit")) {
        const digit = parseInt(e.code.replace("Digit", ""), 10);
        const tile = digit >= 1 && digit <= 9 ? document.querySelector(`#board .tile[data-shortcut="${digit}"]`) : null;
        if (tile) {
          e.preventDefault();
          this.showShortcutNumbers(false);
          // The tile's own click, so the chord opens exactly what a click would.
          tile.click();
        }
      }
    });

    /* Hold Alt for a moment and the numbers appear on the tiles they open. The
       moment is there so that Alt+Tab and every other chord never flash them. */
    let altTimer = null;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Alt" || e.repeat) return;
      clearTimeout(altTimer);
      altTimer = setTimeout(() => this.showShortcutNumbers(true), 350);
    });
    const release = () => { clearTimeout(altTimer); this.showShortcutNumbers(false); };
    document.addEventListener("keyup", (e) => { if (e.key === "Alt") release(); });
    window.addEventListener("blur", release);
  }

  showShortcutNumbers(show) {
    document.body.classList.toggle("alt-held", Boolean(show));
  }

  initVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
      const video = document.getElementById("bg-video");
      if (document.hidden) {
        this.bgEngine?.pause();
        if (video && !video.paused) video.pause();
      } else {
        this.bgEngine?.resume();
        if (video && video.classList.contains("active")) {
          video.play().catch(() => {});
        }
      }
    });
  }

  injectCustomCSS(css) {
    let styleEl = document.getElementById("user-custom-css");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "user-custom-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  async updateBackgroundMode() {
    const bgMode = this.config.bgMode || "aurora";
    const canvas = document.getElementById("bg-canvas");
    const media = document.getElementById("bg-media");
    const video = document.getElementById("bg-video");

    const clearMedia = () => {
      clearInterval(this.wallpaperTimer);
      this.scrimLayer().replaceChildren();
      for (const card of document.querySelectorAll("#board .card")) card.style.removeProperty("--card-solid");
      document.getElementById("search")?.style.removeProperty("--search-solid");
      if (media) {
        media.classList.remove("active");
        media.removeAttribute("src");
      }
      if (video) {
        video.classList.remove("active");
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      if (this.mediaObjectUrl) {
        URL.revokeObjectURL(this.mediaObjectUrl);
        this.mediaObjectUrl = null;
      }
    };

    this.applyWallpaperEffects();

    // The chosen background, for the rules that need to know which one it is.
    document.documentElement.dataset.bg = bgMode;

    if (NORDLYS_GENERATIVE_SCENES.has(bgMode)) {
      if (canvas) canvas.style.display = "block";
      clearMedia();
      // Before the mood, or a mood the user mixed themselves is a name the
      // engine has never heard of and quietly declines.
      this.bgEngine.setPalettes(this.config.bgPalettes);
      this.bgEngine.setSeed(this.config.bgSeed ?? 0);
      this.bgEngine.realSky = this.config.bgRealSky !== false;
      this.bgEngine.moonCache = null;
      if (this.bgEngine.daylight !== Boolean(this.config.bgDaylight)) this.bgEngine.setDaylight(this.config.bgDaylight);
      this.bgEngine.setAtmosphere({
        motion: this.config.bgMotion ?? 1,
        // High legibility keeps the sky at a whisper, whatever the slider says.
        intensity: this.highLegibility ? Math.min(0.6, this.config.bgIntensity ?? 1) : (this.config.bgIntensity ?? 1),
        palette: this.config.bgPalette || "theme"
      });
      this.bgEngine.setMode(bgMode);
    } else if (bgMode === "custom-image" || bgMode === "custom-video") {
      this.bgEngine.setMode(bgMode);
      clearMedia();

      try {
        const blob = await MediaVault.getMedia("custom_bg");
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        this.mediaObjectUrl = url;

        const isVideo = bgMode === "custom-video" || (blob.type || "").startsWith("video/");
        const measure = () => this.queueQuietZones?.();
        if (isVideo && video) {
          video.src = url;
          video.classList.add("active");
          video.addEventListener("loadeddata", measure, { once: true });
          video.play().catch(() => {});
          // A video's picture moves; it is looked at again every few seconds.
          clearInterval(this.wallpaperTimer);
          this.wallpaperTimer = setInterval(() => { if (!document.hidden) this.measureWallpaper(); }, 6000);
        } else if (media) {
          media.addEventListener("load", measure, { once: true });
          media.src = url;
          media.classList.add("active");
        }
      } catch (e) {
        console.warn("Could not load custom wallpaper:", e);
      }
    } else {
      clearMedia();
      this.bgEngine.setMode("solid");
    }
  }
}

// Bootstrap immediately with zero event-loop delay
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.Nordlys = new NordlysApp();
  });
} else {
  window.Nordlys = new NordlysApp();
}
