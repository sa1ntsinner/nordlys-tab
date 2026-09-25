/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHAT A SETTINGS OBJECT IS ALLOWED TO LOOK LIKE
   ═══════════════════════════════════════════════════════════════════

   Two questions, asked at two different moments.

   validateConfig() is asked of a file the user is about to import. The file is
   untrusted — a typo, a different product's export, a hand edit — and the
   answer is a list of what is wrong, in words a person can act on. Nothing is
   written until the list is empty. The import used to accept any object that
   had a "groups" or a "theme" key; {"groups": {}} passed, was saved, and the
   page then failed on every open because groups was not a list.

   repairConfig() is asked of a config that was already stored. It has been
   trusted once, so it is not refused; shapes that would crash the page are
   coerced to something the page can hold, and the caller keeps the original in
   a restore point because something has changed. */
(function () {
  "use strict";

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const kindOf = (value) => Array.isArray(value) ? "list" : value === null ? "null" : typeof value;
  // The sky's seed is an unsigned 32-bit whole number, the width of its stream.
  const isSeed = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

  /* Top-level fields and the type each must have when present. Unknown fields
     are allowed through: a newer build may have added one, and refusing it
     would make every upgrade path a validation failure. */
  const FIELDS = {
    version: "string", theme: "string", colorMode: "string", bgMode: "string", bgPalette: "string", boardLayout: "string", boardWidth: "string",
    glassLevel: "string", headerStyle: "string", timeFormat: "string",
    userName: "string", customCss: "string", iconShape: "string",
    hoverEffect: "string", language: "string",
    bgBlur: "number", bgDim: "number", cardRadius: "number", tileSize: "number",
    cardGap: "number", boardGap: "number", cardGlow: "number", bgMotion: "number", bgIntensity: "number", bgSeed: "number",
    showSeconds: "boolean", openNewTab: "boolean", highLegibility: "boolean", bgRealSky: "boolean", bgDaylight: "boolean", tileLabels: "boolean", onePageFit: "boolean",
    groups: "list", bgPalettes: "list", customTheme: "object"
  };
  const NUMERIC_FIELDS = Object.entries(FIELDS)
    .filter(([, type]) => type === "number")
    .map(([field]) => field);
  const LINK_TEXT_FIELDS = ["name", "url", "icon", "iconSource", "color", "customImg", "monogram", "tone", "iconUrl", "browserId"];
  // The same bounds the grid enforces on its resize handle.
  const COLUMNS = { min: 1, max: 8 };
  // The same bound board-layout.js keeps rows inside.
  const ROWS = { max: 99 };

  /* A URL that runs code instead of opening a page is never a bookmark. The
     browser's parser strips tabs and newlines from a scheme before it looks at
     it, so "java\nscript:" is "javascript:" — the same folding happens here. */
  function isForbiddenUrl(url) {
    const folded = Array.from(String(url)).filter((char) => char.charCodeAt(0) > 0x20).join("");
    return /^(javascript|data|vbscript):/i.test(folded);
  }

  /* The addresses an icon came from (icon-history.js). Only web addresses,
     and only small raster pictures beside them; anything else is dropped
     rather than refused, since the icon itself does not depend on them. */
  const ICON_ADDRESS = /^https?:\/\/[^\s]+$/i;
  const ICON_THUMB = /^data:image\/(png|webp|jpeg|gif);base64,/i;
  function repairIconAddresses(link) {
    let repaired = false;
    if (link.iconUrl !== undefined && !(typeof link.iconUrl === "string" && ICON_ADDRESS.test(link.iconUrl) && link.iconUrl.length <= 2048)) {
      delete link.iconUrl; repaired = true;
    }
    if (link.iconUrls === undefined) return repaired;
    const kept = (Array.isArray(link.iconUrls) ? link.iconUrls : [])
      .filter((entry) => isObject(entry) && typeof entry.url === "string" && ICON_ADDRESS.test(entry.url) && entry.url.length <= 2048)
      .slice(0, 6)
      .map((entry) => ({
        url: entry.url,
        thumb: typeof entry.thumb === "string" && ICON_THUMB.test(entry.thumb) && entry.thumb.length <= 40000 ? entry.thumb : "",
        at: Number.isFinite(entry.at) ? entry.at : 0
      }));
    const same = Array.isArray(link.iconUrls) && kept.length === link.iconUrls.length
      && kept.every((entry, index) => entry.thumb === link.iconUrls[index].thumb && entry.at === link.iconUrls[index].at);
    if (!kept.length) { delete link.iconUrls; return true; }
    if (!same) { link.iconUrls = kept; repaired = true; }
    return repaired;
  }

  function validateGroup(group, index, errors) {
    const where = `folder ${index + 1}`;
    if (!isObject(group)) { errors.push(`${where} is not a folder object`); return; }
    if (group.label !== undefined && typeof group.label !== "string") errors.push(`${where}: label should be text`);
    if (group.hidden !== undefined && typeof group.hidden !== "boolean") errors.push(`${where}: hidden should be true or false`);
    if (group.cols !== undefined && !(Number.isInteger(group.cols) && group.cols >= COLUMNS.min && group.cols <= COLUMNS.max)) {
      errors.push(`${where}: cols should be a whole number from ${COLUMNS.min} to ${COLUMNS.max}`);
    }
    if (group.source !== undefined && !isObject(group.source)) errors.push(`${where}: source should be an object`);
    if (group.row !== undefined && !(Number.isInteger(group.row) && group.row >= 0 && group.row <= ROWS.max)) {
      errors.push(`${where}: row should be a whole number from 0 to ${ROWS.max}`);
    }
    if (group.links === undefined) return;
    if (!Array.isArray(group.links)) { errors.push(`${where}: links should be a list`); return; }
    group.links.forEach((link, linkIndex) => {
      const at = `${where}, bookmark ${linkIndex + 1}`;
      if (!isObject(link)) { errors.push(`${at} is not a bookmark object`); return; }
      if (typeof link.url !== "string") errors.push(`${at}: url should be text`);
      else if (isForbiddenUrl(link.url)) errors.push(`${at}: url must open a page, not run code`);
      for (const field of LINK_TEXT_FIELDS) {
        if (link[field] !== undefined && typeof link[field] !== "string") errors.push(`${at}: ${field} should be text`);
      }
      if (link.iconUrls !== undefined && !Array.isArray(link.iconUrls)) errors.push(`${at}: iconUrls should be a list`);
    });
  }

  /* A colour mood somebody mixed. Three hex colours, a name, and an id — the
     same shape the canvas resolves, checked here so a hand-edited file is
     refused with a reason instead of painting a gradient stop transparent. */
  function validatePalette(palette, index, errors) {
    const where = `colour mood ${index + 1}`;
    if (!isObject(palette)) { errors.push(`${where} is not a colour mood object`); return; }
    if (typeof palette.id !== "string" || !palette.id.trim()) errors.push(`${where}: id should be text`);
    if (palette.name !== undefined && typeof palette.name !== "string") errors.push(`${where}: name should be text`);
    if (!Array.isArray(palette.colors) || palette.colors.length !== 3) {
      errors.push(`${where}: colors should be a list of three colours`);
      return;
    }
    palette.colors.forEach((colour, at) => {
      if (typeof colour !== "string" || !/^#[0-9a-f]{6}$/i.test(colour.trim())) {
        errors.push(`${where}, colour ${at + 1}: should be a hex colour such as #68e1d1`);
      }
    });
  }

  /* Everything wrong with a candidate, or nothing. */
  function validateConfig(candidate) {
    if (!isObject(candidate)) return { ok: false, errors: ["the file does not contain a settings object"] };
    const errors = [];
    for (const [field, type] of Object.entries(FIELDS)) {
      const value = candidate[field];
      if (value === undefined) continue;
      const actual = kindOf(value);
      if (actual !== type) errors.push(`${field} should be a ${type === "list" ? "list" : type}, not ${actual}`);
    }
    if (Array.isArray(candidate.groups)) candidate.groups.forEach((group, index) => validateGroup(group, index, errors));
    if (Array.isArray(candidate.bgPalettes)) candidate.bgPalettes.forEach((palette, index) => validatePalette(palette, index, errors));
    if (typeof candidate.bgSeed === "number" && !isSeed(candidate.bgSeed)) errors.push("bgSeed should be a whole number from 0 to 4294967295");
    if (typeof candidate.boardLayout === "string" && !["natural", "fitted"].includes(candidate.boardLayout)) errors.push('boardLayout should be "natural" or "fitted"');
    if (typeof candidate.boardWidth === "string" && !["narrow", "standard", "wide"].includes(candidate.boardWidth)) errors.push('boardWidth should be "narrow", "standard" or "wide"');
    return { ok: errors.length === 0, errors };
  }

  /* Versions up to 2.0 wrote range values exactly as the DOM exposed them:
     numeric strings. They are valid Nordlys backups, not hand-edited damaged
     files. Canonicalise only complete, finite numbers before validation so a
     value such as "22px" is still refused instead of being guessed at. */
  function normalizeImportConfig(candidate) {
    if (!isObject(candidate)) return candidate;
    for (const field of NUMERIC_FIELDS) {
      const value = candidate[field];
      if (typeof value !== "string" || value.trim() === "") continue;
      const numeric = Number(value);
      if (Number.isFinite(numeric)) candidate[field] = numeric;
    }
    return candidate;
  }

  /* Coerces a stored config into something the page can hold. Returns true when
     anything was changed, so the caller knows to keep the original. */
  function repairConfig(config, defaults = {}) {
    if (!isObject(config)) return false;
    let repaired = false;
    /* A setting of the wrong kind — a hover style that is an object, a size
       that is text — took the page down where it was used: one class name
       built from an object stopped the page from starting. It goes back to
       its default, or away when there is none. */
    for (const [field, type] of Object.entries(FIELDS)) {
      const value = config[field];
      if (value === undefined || type === "list") continue;
      const fits = type === "object" ? isObject(value) : type === "number" ? Number.isFinite(value) : typeof value === type;
      if (fits) continue;
      if (defaults[field] !== undefined) config[field] = JSON.parse(JSON.stringify(defaults[field]));
      else delete config[field];
      repaired = true;
    }
    if (config.bgSeed !== undefined && !isSeed(config.bgSeed)) { config.bgSeed = 0; repaired = true; }
    if (config.boardLayout !== undefined && !["natural", "fitted"].includes(config.boardLayout)) { config.boardLayout = "natural"; repaired = true; }
    if (config.boardWidth !== undefined && !["narrow", "standard", "wide"].includes(config.boardWidth)) { config.boardWidth = "standard"; repaired = true; }
    if (config.boardGap !== undefined && !(Number.isFinite(config.boardGap) && config.boardGap >= 6 && config.boardGap <= 48)) { delete config.boardGap; repaired = true; }
    if (!Array.isArray(config.groups)) { config.groups = []; repaired = true; }
    const groups = config.groups.filter(isObject);
    if (groups.length !== config.groups.length) { config.groups = groups; repaired = true; }
    /* A mood that cannot be resolved is dropped rather than kept: the canvas
       would fall back to the theme anyway, and a chip that does nothing when
       pressed is worse than one that is not there. */
    if (config.bgPalettes !== undefined) {
      const moods = Array.isArray(config.bgPalettes) ? config.bgPalettes : [];
      const kept = moods.filter((palette) => isObject(palette)
        && typeof palette.id === "string" && palette.id.trim()
        && Array.isArray(palette.colors) && palette.colors.length === 3
        && palette.colors.every((colour) => typeof colour === "string" && /^#[0-9a-f]{6}$/i.test(colour.trim())));
      if (!Array.isArray(config.bgPalettes) || kept.length !== config.bgPalettes.length) {
        config.bgPalettes = kept;
        repaired = true;
      }
    }
    for (const group of groups) {
      if (!Array.isArray(group.links)) { group.links = []; repaired = true; }
      const links = group.links.filter((link) => isObject(link) && typeof link.url === "string" && !isForbiddenUrl(link.url));
      if (links.length !== group.links.length) { group.links = links; repaired = true; }
      // A folder's own fields of the wrong kind go; each has a fallback.
      if (group.label !== undefined && typeof group.label !== "string") { delete group.label; repaired = true; }
      if (group.hidden !== undefined && typeof group.hidden !== "boolean") { delete group.hidden; repaired = true; }
      if (group.cols !== undefined && !(Number.isInteger(group.cols) && group.cols >= COLUMNS.min && group.cols <= COLUMNS.max)) { delete group.cols; repaired = true; }
      if (group.source !== undefined && !isObject(group.source)) { delete group.source; repaired = true; }
      for (const link of links) {
        // A name that is not text took the whole board down as it was drawn.
        for (const field of LINK_TEXT_FIELDS) {
          if (field !== "url" && link[field] !== undefined && typeof link[field] !== "string") { delete link[field]; repaired = true; }
        }
        if (repairIconAddresses(link)) repaired = true;
      }
    }
    return repaired;
  }

  /* ── What a backup FILE is, as opposed to a config ────────────────
     Every release since 2.0 wrote the config object at the top level of the
     file, so that is where it stays: a file this build writes still opens in an
     older one, and every file an older one wrote still opens here.

     Some durable state was never part of the config — the themes someone
     authored, the width they dragged the drawer to — and a "backup" that loses
     them is a backup in name only. It travels in one namespaced envelope beside
     the config, which an older build ignores as an unknown field and this one
     lifts out before the config is validated, so it never lands in settings.

     Not carried, on purpose: wallpaper and video files, which live in IndexedDB
     and run to tens of megabytes — embedding one would produce a file no
     storage would take back. Search history is not carried either; a settings
     file people mail themselves has no business holding a list of what they
     looked for. Both exclusions are stated in the export panel. */
  const BACKUP_EXTRAS_KEY = "nordlysBackup";
  const BACKUP_FORMAT_VERSION = 1;

  function buildBackupFile(config, extras = {}) {
    const envelope = { formatVersion: BACKUP_FORMAT_VERSION, savedAt: new Date().toISOString() };
    if (Array.isArray(extras.customThemes)) envelope.customThemes = extras.customThemes;
    if (typeof extras.drawerWidth === "string" && extras.drawerWidth) envelope.drawerWidth = extras.drawerWidth;
    return Object.assign({}, config, { [BACKUP_EXTRAS_KEY]: envelope });
  }

  /* The inverse, and the only reader that knows the envelope exists. A file
     without one reads as itself with nothing invented; a damaged one is dropped
     rather than allowed to sink an otherwise sound import. */
  function readBackupFile(parsed) {
    if (!isObject(parsed)) return { config: parsed, extras: {} };
    const envelope = parsed[BACKUP_EXTRAS_KEY];
    const config = Object.assign({}, parsed);
    delete config[BACKUP_EXTRAS_KEY];
    const extras = {};
    if (isObject(envelope)) {
      if (Array.isArray(envelope.customThemes)) extras.customThemes = envelope.customThemes;
      if (typeof envelope.drawerWidth === "string" && envelope.drawerWidth) extras.drawerWidth = envelope.drawerWidth;
    }
    return { config, extras };
  }

  /* ── Settings that meant something different when they were saved ──
     Asked of a config as it was stored or exported, before the defaults are
     merged under it — the only moment its own age is still visible.

     Until the board learned rows and layouts, the folder corner slider was
     drawn over by a fixed 18px radius: whatever it held, folders showed 18.
     boardLayout arrived in the same release as the fix, so a config without
     one predates it, and its untouched default of 24 becomes the 18 it always
     looked like. Fixing the slider changes nobody's board; a value somebody
     actually chose is finally theirs to see. */
  function migrateRaw(raw) {
    if (!isObject(raw)) return false;
    if (raw.boardLayout === undefined && Number(raw.cardRadius) === 24) {
      raw.cardRadius = 18;
      return true;
    }
    return false;
  }

  const NordlysConfigSchema = {
    validateConfig, normalizeImportConfig, repairConfig, migrateRaw, isForbiddenUrl, COLUMNS,
    buildBackupFile, readBackupFile, BACKUP_EXTRAS_KEY, BACKUP_FORMAT_VERSION
  };
  if (typeof window !== "undefined") window.NordlysConfigSchema = NordlysConfigSchema;
  if (typeof module === "object" && module.exports) module.exports = NordlysConfigSchema;
})();
