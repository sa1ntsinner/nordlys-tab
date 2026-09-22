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

  /* Top-level fields and the type each must have when present. Unknown fields
     are allowed through: a newer build may have added one, and refusing it
     would make every upgrade path a validation failure. */
  const FIELDS = {
    version: "string", theme: "string", colorMode: "string", bgMode: "string", bgPalette: "string",
    glassLevel: "string", headerStyle: "string", timeFormat: "string",
    userName: "string", customCss: "string", iconShape: "string",
    hoverEffect: "string", language: "string",
    bgBlur: "number", bgDim: "number", cardRadius: "number", tileSize: "number",
    cardGap: "number", cardGlow: "number", bgMotion: "number", bgIntensity: "number",
    showSeconds: "boolean", openNewTab: "boolean",
    groups: "list", customTheme: "object"
  };
  const NUMERIC_FIELDS = Object.entries(FIELDS)
    .filter(([, type]) => type === "number")
    .map(([field]) => field);
  const LINK_TEXT_FIELDS = ["name", "url", "icon", "color", "customImg", "monogram", "tone"];
  // The same bounds the grid enforces on its resize handle.
  const COLUMNS = { min: 1, max: 8 };

  /* A URL that runs code instead of opening a page is never a bookmark. The
     browser's parser strips tabs and newlines from a scheme before it looks at
     it, so "java\nscript:" is "javascript:" — the same folding happens here. */
  function isForbiddenUrl(url) {
    const folded = Array.from(String(url)).filter((char) => char.charCodeAt(0) > 0x20).join("");
    return /^(javascript|data|vbscript):/i.test(folded);
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
  function repairConfig(config) {
    if (!isObject(config)) return false;
    let repaired = false;
    if (!Array.isArray(config.groups)) { config.groups = []; repaired = true; }
    const groups = config.groups.filter(isObject);
    if (groups.length !== config.groups.length) { config.groups = groups; repaired = true; }
    for (const group of groups) {
      if (!Array.isArray(group.links)) { group.links = []; repaired = true; }
      const links = group.links.filter((link) => isObject(link) && typeof link.url === "string" && !isForbiddenUrl(link.url));
      if (links.length !== group.links.length) { group.links = links; repaired = true; }
    }
    return repaired;
  }

  const NordlysConfigSchema = { validateConfig, normalizeImportConfig, repairConfig, isForbiddenUrl, COLUMNS };
  if (typeof window !== "undefined") window.NordlysConfigSchema = NordlysConfigSchema;
  if (typeof module === "object" && module.exports) module.exports = NordlysConfigSchema;
})();
