/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHAT TRAVELS BETWEEN DEVICES, AND HOW TWO COPIES MERGE
   ═══════════════════════════════════════════════════════════════════

   Pure: no storage, no page. The setup is kept as records, one per thing:

     c            the person (language, time format, name in the greeting)
     p/<id>       a profile: its name, colour and place in the list
     c/<id>       that profile's look and layout
     g/<id>       a folder, with the profile it belongs to
     l/<id>       a bookmark, with the folder it sits in
     d/<id>       a device that syncs, by the name it goes by

   Every field of a record is a register holding the value, a logical counter
   and the device that wrote it. Two copies merge field by field: the higher
   counter wins, the device id breaks a tie, so every device ends on the same
   board whatever order the changes reach it in, and an edit to one field
   never undoes an edit to another. Deletion is a field too (_alive), so an
   offline rename cannot bring a deleted bookmark back.

   Each device writes only its own sync items, packed into chunks that stay
   under Chrome's 8 KB item limit, so two devices writing at once never
   overwrite each other. */
(function (root) {
  "use strict";

  const PREFIX = "nl.sync.2.";
  const VERSION = 2;
  const ITEM_LIMIT = 8192;
  const CHUNK_BUDGET = 7600;
  const VALUE_LIMIT = 4000;
  const DELETED_PROFILE_DAYS = 30;
  // About the person, not the board, so every profile shares them.
  const PERSON = new Set(["language", "timeFormat", "userName", "openNewTab", "showSeconds"]);
  // Kept on the device that has them: too big, or meaningless anywhere else.
  const LOCAL_LOOK = new Set(["version", "customCss"]);

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
  const safeName = (key) => typeof key === "string" && /^[a-zA-Z_][a-zA-Z0-9_]{0,80}$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key);
  const newId = () => (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`).replace(/[^a-zA-Z0-9_-]/g, "");
  const newer = (next, current) => !current || next.n > current.n || (next.n === current.n && next.a > current.a);
  const validEntity = (entity) => entity === "c" || (typeof entity === "string" && /^(c|p|g|l|d)\/[a-zA-Z0-9_-]{1,80}$/.test(entity));
  const unsafeUrl = (value) => /^(javascript|data|vbscript):/i.test(Array.from(String(value)).filter((c) => c.charCodeAt(0) > 32).join(""));

  /* Stable ids for folders and bookmarks, given once and kept. Answers
     whether anything was given, so the caller knows to save. */
  function normalize(config) {
    let changed = false;
    if (!config || !Array.isArray(config.groups)) return false;
    const seen = new Set();
    const give = (item) => {
      if (!validId(item.id) || seen.has(item.id)) { item.id = newId(); changed = true; }
      seen.add(item.id);
    };
    for (const group of config.groups) {
      if (!group || typeof group !== "object") continue;
      give(group);
      if (!Array.isArray(group.links)) { group.links = []; changed = true; }
      for (const link of group.links) if (link && typeof link === "object") give(link);
    }
    return changed;
  }

  function normalizeSnapshot(snapshot) {
    let changed = false;
    const seen = new Set();
    for (const profile of snapshot.profiles || []) {
      if (!validId(profile.id) || seen.has(profile.id)) { profile.id = newId(); changed = true; }
      seen.add(profile.id);
      if (normalize(profile.config)) changed = true;
    }
    return changed;
  }

  function create(device) {
    if (!validId(device)) throw new Error("A device needs a valid id.");
    return { version: VERSION, device, clock: 0, records: {} };
  }

  function flatten(snapshot) {
    const out = {};
    const put = (entity, field, value) => {
      if (!safeName(field) || value === undefined) return;
      (out[entity] ||= {})[field] = clone(value);
    };
    for (const [key, value] of Object.entries(snapshot.person || {})) if (PERSON.has(key)) put("c", key, value);
    (snapshot.profiles || []).forEach((profile, index) => {
      const p = `p/${profile.id}`;
      put(p, "_alive", true);
      put(p, "_order", index);
      put(p, "name", profile.name || "");
      put(p, "color", profile.color || "");
      for (const [key, value] of Object.entries(profile.config || {})) {
        if (key === "groups" || PERSON.has(key)) continue;
        put(`c/${profile.id}`, key, value);
      }
      (profile.config?.groups || []).forEach((group, groupIndex) => {
        const g = `g/${group.id}`;
        put(g, "_alive", true);
        put(g, "_order", groupIndex);
        put(g, "_profile", profile.id);
        for (const [key, value] of Object.entries(group)) if (key !== "links" && key !== "id" && !key.startsWith("_")) put(g, key, value);
        (group.links || []).forEach((link, linkIndex) => {
          const l = `l/${link.id}`;
          put(l, "_alive", true);
          put(l, "_order", linkIndex);
          put(l, "_parent", group.id);
          for (const [key, value] of Object.entries(link)) if (key !== "id" && !key.startsWith("_")) put(l, key, value);
        });
      });
    });
    return out;
  }

  function values(state) {
    const out = {};
    for (const [entity, fields] of Object.entries(state.records)) {
      out[entity] = {};
      for (const [key, register] of Object.entries(fields)) if (own(register, "v")) out[entity][key] = register.v;
    }
    return out;
  }

  function apply(state, changes) {
    if (!changes.length) return false;
    const n = ++state.clock;
    for (const [entity, field, ...value] of changes) {
      if (!validEntity(entity) || !safeName(field)) throw new Error("Invalid board change.");
      const register = { n, a: state.device };
      if (value.length) register.v = clone(value[0]);
      (state.records[entity] ||= {})[field] = register;
    }
    return true;
  }

  /* Takes what the page holds now and records what changed since the model
     last saw it. A profile that is gone is marked deleted, but its folders are
     left as they were, so restoring it brings them back. */
  function update(state, snapshot) {
    const next = flatten(snapshot);
    const now = values(state);
    const changes = [];
    const goneProfiles = new Set(Object.keys(now)
      .filter((entity) => entity.startsWith("p/") && now[entity]._alive === true && !next[entity])
      .map((entity) => entity.slice(2)));
    const inGoneProfile = (entity) => {
      if (entity.startsWith("g/")) return goneProfiles.has(now[entity]._profile);
      if (entity.startsWith("l/")) return goneProfiles.has(now[`g/${now[entity]._parent}`]?._profile);
      return false;
    };
    for (const entity of new Set([...Object.keys(now), ...Object.keys(next)])) {
      const before = now[entity] || {};
      const after = next[entity];
      if (!after) {
        if (entity === "c" || entity.startsWith("c/") || entity.startsWith("d/")) continue;
        if (before._alive !== true || inGoneProfile(entity)) continue;
        changes.push([entity, "_alive", false]);
        if (entity.startsWith("p/")) changes.push([entity, "_deletedAt", Date.now()]);
        continue;
      }
      // Coming back from "only on this device" is a fresh arrival everywhere.
      if (before.local === true && after.local !== true) changes.push([entity, "_alive", true]);
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (key === "_deletedAt") continue;
        if (equal(before[key], after[key])) continue;
        changes.push(own(after, key) ? [entity, key, after[key]] : [entity, key]);
      }
    }
    return apply(state, changes);
  }

  function materialize(state) {
    const all = values(state);
    const plain = (fields, entity) => {
      const out = { id: entity.slice(2) };
      for (const [key, value] of Object.entries(fields)) if (!key.startsWith("_")) out[key] = clone(value);
      return out;
    };
    const ordered = (prefix, keep) => Object.entries(all)
      .filter(([entity, fields]) => entity.startsWith(prefix) && fields._alive === true && keep(fields))
      .sort(([ea, a], [eb, b]) => (a._order || 0) - (b._order || 0) || ea.localeCompare(eb));
    const profiles = ordered("p/", () => true).map(([entity, fields]) => {
      const id = entity.slice(2);
      const config = { ...clone(all[`c/${id}`] || {}), groups: [] };
      for (const [groupEntity, groupFields] of ordered("g/", (fields) => fields._profile === id)) {
        const group = plain(groupFields, groupEntity);
        group.links = ordered("l/", (fields) => fields._parent === group.id).map(([linkEntity, linkFields]) => plain(linkFields, linkEntity));
        config.groups.push(group);
      }
      return { id, name: fields.name || "", color: fields.color || "", config };
    });
    const person = {};
    for (const [key, value] of Object.entries(all.c || {})) if (PERSON.has(key)) person[key] = clone(value);
    return { person, profiles };
  }

  function deletedProfiles(state, now = Date.now()) {
    const all = values(state);
    return Object.entries(all)
      .filter(([entity, fields]) => entity.startsWith("p/") && fields._alive === false
        && (!fields._deletedAt || now - fields._deletedAt < DELETED_PROFILE_DAYS * 86400000))
      .map(([entity, fields]) => ({ id: entity.slice(2), name: fields.name || "", color: fields.color || "", deletedAt: fields._deletedAt || null }));
  }

  function restoreProfile(state, id) {
    if (!state.records[`p/${id}`]) return false;
    return apply(state, [[`p/${id}`, "_alive", true], [`p/${id}`, "_deletedAt"]]);
  }

  /* The devices this setup has been on, by name, for the settings list. */
  function devices(state) {
    return Object.entries(values(state))
      .filter(([entity, fields]) => entity.startsWith("d/") && fields._alive !== false)
      .map(([entity, fields]) => ({ id: entity.slice(2), name: fields.name || "", seenAt: fields._seenAt || null }))
      .sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
  }

  function portable(entity, field, value) {
    if (field === "local") return false;
    if (entity === "c" && !PERSON.has(field)) return false;
    if (entity.startsWith("c/") && (LOCAL_LOOK.has(field) || PERSON.has(field))) return false;
    if (entity.startsWith("g/") && field === "source") return false;
    if (value === undefined) return true;
    if (entity.startsWith("c/") && field === "bgMode" && /^custom-/.test(String(value))) return false;
    const text = JSON.stringify(value);
    if (text.length > VALUE_LIMIT) return false;
    if (/(data:|blob:|chrome-extension:)/i.test(text)) return false;
    return true;
  }

  /* This device's registers, in chunks under the item limit. A folder linked
     to Chrome's own bookmarks never leaves; a thing kept "only on this device"
     leaves as a deletion, so the other devices stop showing it. */
  function exportChunks(state) {
    const records = state.records;
    const localAt = (entity) => {
      const register = records[entity]?.local;
      if (register?.v === true) return register;
      if (entity.startsWith("l/")) {
        const parent = records[entity]?._parent?.v;
        const groupRegister = parent && records[`g/${parent}`]?.local;
        if (groupRegister?.v === true) return groupRegister;
      }
      return null;
    };
    const linked = (entity) => {
      const group = entity.startsWith("g/") ? entity : entity.startsWith("l/") ? `g/${records[entity]?._parent?.v}` : null;
      return Boolean(group && records[group]?.source?.v?.folderId);
    };
    const pairs = [];
    for (const entity of Object.keys(records).sort()) {
      if (linked(entity)) continue;
      const local = localAt(entity);
      if (local) {
        if (local.a === state.device) pairs.push([entity, "_alive", [Math.max(local.n, records[entity]._alive?.n || 0), false]]);
        continue;
      }
      for (const [field, register] of Object.entries(records[entity])) {
        if (register.a !== state.device || !portable(entity, field, register.v)) continue;
        pairs.push([entity, field, own(register, "v") ? [register.n, register.v] : [register.n]]);
      }
    }
    const out = {};
    let index = 0;
    let chunk = null;
    let size = 0;
    const open = () => { chunk = { v: VERSION, a: state.device, i: index, e: {} }; size = 64; };
    open();
    for (const [entity, field, register] of pairs) {
      const cost = JSON.stringify(entity).length + JSON.stringify(field).length + JSON.stringify(register).length + 8;
      if (size + cost > CHUNK_BUDGET && Object.keys(chunk.e).length) {
        out[`${PREFIX}${state.device}.${index}`] = chunk;
        index++;
        open();
      }
      (chunk.e[entity] ||= {})[field] = register;
      size += cost;
    }
    if (Object.keys(chunk.e).length) out[`${PREFIX}${state.device}.${index}`] = chunk;
    return out;
  }

  function checkValue(field, value) {
    const text = JSON.stringify(value);
    if (text === undefined || text.length > VALUE_LIMIT) throw new Error(`Sync value for ${field} is too large.`);
    if (field === "_alive" && typeof value !== "boolean") throw new Error("Invalid deletion marker in sync data.");
    if ((field === "_order" || field === "_deletedAt" || field === "_seenAt") && !(Number.isFinite(value) && value >= 0)) throw new Error("Invalid order in sync data.");
    if ((field === "_parent" || field === "_profile") && !validId(value)) throw new Error("Invalid folder identity in sync data.");
    if (field === "url" && (typeof value !== "string" || unsafeUrl(value))) throw new Error("Unsafe bookmark address in sync data.");
    if ((field === "name" || field === "label") && typeof value !== "string") throw new Error("Invalid name in sync data.");
    if (field === "cols" && !(Number.isInteger(value) && value >= 1 && value <= 8)) throw new Error("Invalid column count in sync data.");
  }

  /* The whole batch is checked before anything changes, so damaged data can
     never leave a board half merged. Chunks of other formats are left alone. */
  function validateChunks(entries) {
    const accepted = [];
    for (const [key, chunk] of Object.entries(entries || {})) {
      if (!key.startsWith(PREFIX)) continue;
      if (!chunk || typeof chunk !== "object" || chunk.v !== VERSION || !validId(chunk.a) || !Number.isInteger(chunk.i) || chunk.i < 0
        || key !== `${PREFIX}${chunk.a}.${chunk.i}` || !chunk.e || typeof chunk.e !== "object" || Array.isArray(chunk.e)) {
        throw new Error("Damaged sync data. Your board here was kept.");
      }
      for (const [entity, fields] of Object.entries(chunk.e)) {
        if (!validEntity(entity) || !fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error("Invalid sync record. Your board here was kept.");
        for (const [field, register] of Object.entries(fields)) {
          if (!safeName(field) || !Array.isArray(register) || register.length < 1 || register.length > 2
            || !Number.isSafeInteger(register[0]) || register[0] < 1 || register[0] > Number.MAX_SAFE_INTEGER - 1e6) {
            throw new Error("Invalid sync field. Your board here was kept.");
          }
          if (register.length === 2) checkValue(field, register[1]);
        }
      }
      accepted.push(chunk);
    }
    return accepted;
  }

  function merge(state, entries) {
    const chunks = validateChunks(entries);
    let changed = false;
    for (const chunk of chunks) {
      if (chunk.a === state.device) continue;
      for (const [entity, fields] of Object.entries(chunk.e)) {
        for (const [field, register] of Object.entries(fields)) {
          if (!portable(entity, field, register[1])) continue;
          const next = { n: register[0], a: chunk.a };
          if (register.length === 2) next.v = clone(register[1]);
          state.clock = Math.max(state.clock, next.n);
          if (newer(next, state.records[entity]?.[field])) {
            (state.records[entity] ||= {})[field] = next;
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  const api = {
    PREFIX, VERSION, ITEM_LIMIT, PERSON,
    clone, normalize, normalizeSnapshot, create, update, apply, materialize,
    deletedProfiles, restoreProfile, devices, values, portable, exportChunks, validateChunks, merge
  };
  root.NordlysSyncModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
