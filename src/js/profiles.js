/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - PROFILES: SEVERAL WHOLE SETUPS, ONE OF THEM IN USE
   ═══════════════════════════════════════════════════════════════════

   A profile is a whole setup: folders, bookmarks, look and layout. The one in
   use is the page's config as it always was (nordlys_config), so nothing else
   in the product needs to know profiles exist. The others wait in
   chrome.storage.local, which has room for boards with embedded icons; the
   small list of names is kept in localStorage so the first paint can show it.

   The person fields (language, time format, the name in the greeting, how
   links open) are about the person, not the board, so they follow along
   whichever profile is in use. Works with sync off; the sync engine only
   mirrors what this keeps. */
(function (root) {
  "use strict";

  const META_KEY = "nordlys_profiles";
  const SLOT = "nordlys_profile.";
  const PERSON = ["language", "timeFormat", "userName", "openNewTab", "showSeconds"];
  const COLORS = ["teal", "amber", "violet", "rose", "sky", "lime"];
  const KEEP_DELETED_MS = 30 * 86400000;
  const NAME_LIMIT = 40;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const newId = () => (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`).replace(/[^a-zA-Z0-9_-]/g, "");
  const cleanName = (name) => {
    const value = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, NAME_LIMIT);
    if (!value) throw new Error("A profile needs a name.");
    return value;
  };
  const withoutPerson = (config) => {
    const out = clone(config);
    for (const key of PERSON) delete out[key];
    return out;
  };
  const withPerson = (config, from) => {
    const out = clone(config);
    for (const key of PERSON) if (from && from[key] !== undefined) out[key] = clone(from[key]); else delete out[key];
    return out;
  };
  // A copy is a new board: its folders and bookmarks get ids of their own.
  const freshIds = (config) => {
    for (const group of config.groups || []) {
      group.id = newId();
      for (const link of group.links || []) link.id = newId();
    }
    return config;
  };

  class NordlysProfiles {
    constructor({ meta, local }) {
      this.meta = meta;
      this.local = local;
      this.state = null;
    }

    read() {
      try {
        const parsed = JSON.parse(this.meta.getItem(META_KEY) || "null");
        if (parsed && parsed.version === 1 && Array.isArray(parsed.list) && parsed.list.length) return parsed;
      } catch (error) { /* a damaged list starts again from the board in use */ }
      return null;
    }

    write() {
      this.meta.setItem(META_KEY, JSON.stringify(this.state));
    }

    init(firstName = "Main") {
      this.state = this.read();
      if (!this.state) {
        const id = newId();
        // Written the first time anything changes; until then it is only the board in use.
        this.state = { version: 1, active: id, list: [{ id, name: cleanName(firstName), color: COLORS[0] }], deleted: [] };
      }
      if (!this.state.list.some((profile) => profile.id === this.state.active)) this.state.active = this.state.list[0].id;
      const now = Date.now();
      this.state.deleted = (this.state.deleted || []).filter((profile) => now - profile.deletedAt < KEEP_DELETED_MS);
      return this;
    }

    /* Another tab changed the list; this one follows. */
    reload() {
      const next = this.read();
      if (next) this.state = next;
      return this;
    }

    list() { return clone(this.state.list); }
    active() { return clone(this.state.list.find((profile) => profile.id === this.state.active)); }
    deleted() { return clone(this.state.deleted); }
    has(id) { return this.state.list.some((profile) => profile.id === id); }
    find(query) {
      const wanted = String(query || "").trim().toLowerCase();
      return clone(this.state.list.find((profile) => profile.name.toLowerCase() === wanted)
        || this.state.list.find((profile) => profile.name.toLowerCase().startsWith(wanted)) || null);
    }

    async stored(id) {
      const data = await this.local.get(SLOT + id);
      return data[SLOT + id] || null;
    }

    /* The board of any profile: the live config for the one in use. */
    async configOf(id, live) {
      if (id === this.state.active) return clone(live);
      const stored = await this.stored(id);
      return stored ? withPerson(stored, live) : null;
    }

    async create({ name, color, from = "empty", live, defaults }) {
      const id = newId();
      const base = from === "copy" ? freshIds(clone(live)) : { ...clone(defaults || {}), groups: [] };
      await this.local.set({ [SLOT + id]: withoutPerson(base) });
      this.state.list.push({ id, name: cleanName(name), color: COLORS.includes(color) ? color : COLORS[this.state.list.length % COLORS.length] });
      this.write();
      return id;
    }

    /* Puts the live board away and hands back the one to show. */
    async switchTo(id, live) {
      if (!this.has(id)) throw new Error("That profile does not exist any more.");
      if (id === this.state.active) return clone(live);
      const target = await this.stored(id);
      await this.local.set({ [SLOT + this.state.active]: withoutPerson(live) });
      this.state.active = id;
      this.write();
      return withPerson(target || { groups: [] }, live);
    }

    rename(id, name) {
      const profile = this.state.list.find((entry) => entry.id === id);
      if (!profile) throw new Error("That profile does not exist any more.");
      profile.name = cleanName(name);
      this.write();
    }

    recolor(id, color) {
      const profile = this.state.list.find((entry) => entry.id === id);
      if (!profile || !COLORS.includes(color)) return;
      profile.color = color;
      this.write();
    }

    move(id, index) {
      const from = this.state.list.findIndex((entry) => entry.id === id);
      if (from < 0) return;
      const [profile] = this.state.list.splice(from, 1);
      this.state.list.splice(Math.max(0, Math.min(index, this.state.list.length)), 0, profile);
      this.write();
    }

    async remove(id, live) {
      if (this.state.list.length <= 1) throw new Error("The last profile cannot be deleted.");
      if (id === this.state.active) throw new Error("Switch to another profile before deleting the one in use.");
      const index = this.state.list.findIndex((entry) => entry.id === id);
      if (index < 0) return;
      const [profile] = this.state.list.splice(index, 1);
      this.state.deleted = [{ ...profile, deletedAt: Date.now(), index }, ...this.state.deleted.filter((entry) => entry.id !== id)];
      this.write();
      return profile;
    }

    async restore(id) {
      const entry = this.state.deleted.find((profile) => profile.id === id);
      if (!entry) return false;
      this.state.deleted = this.state.deleted.filter((profile) => profile.id !== id);
      const { id: restoredId, name, color, index } = entry;
      this.state.list.splice(Math.min(index ?? this.state.list.length, this.state.list.length), 0, { id: restoredId, name, color });
      this.write();
      return true;
    }

    /* Every profile, for the sync engine: the person once, the boards each. */
    async snapshot(live) {
      // What is about to travel must keep its ids from now on.
      if (!this.read()) this.write();
      const person = {};
      for (const key of PERSON) if (live[key] !== undefined) person[key] = clone(live[key]);
      const profiles = [];
      for (const profile of this.state.list) {
        const config = profile.id === this.state.active ? live : await this.stored(profile.id);
        profiles.push({ id: profile.id, name: profile.name, color: profile.color, config: withoutPerson(config || { groups: [] }) });
      }
      return { person, profiles };
    }

    /* Takes a setup that arrived from another device. Answers the board to
       show now, and whether the profile in use had to change because it was
       deleted elsewhere. */
    async adopt(remote, live) {
      const before = new Map(this.state.list.map((profile) => [profile.id, profile]));
      const writes = {};
      for (const profile of remote.profiles) {
        if (profile.id !== this.state.active) writes[SLOT + profile.id] = withoutPerson(profile.config);
      }
      if (Object.keys(writes).length) await this.local.set(writes);
      const now = Date.now();
      for (const [id, profile] of before) {
        if (!remote.profiles.some((entry) => entry.id === id)) this.state.deleted = [{ ...profile, deletedAt: now }, ...this.state.deleted.filter((entry) => entry.id !== id)];
      }
      this.state.list = remote.profiles.map(({ id, name, color }) => ({ id, name: name || "Profile", color: COLORS.includes(color) ? color : COLORS[0] }));
      if (!this.state.list.length) return { live: clone(live), switched: false };
      const person = { ...live, ...(remote.person || {}) };
      let switched = false;
      let current = remote.profiles.find((profile) => profile.id === this.state.active);
      if (!current) {
        current = remote.profiles[0];
        this.state.active = current.id;
        switched = true;
      }
      this.write();
      return { live: withPerson(current.config, person), switched };
    }
  }

  NordlysProfiles.PERSON = PERSON;
  NordlysProfiles.COLORS = COLORS;
  root.NordlysProfiles = NordlysProfiles;
  if (typeof module !== "undefined" && module.exports) module.exports = NordlysProfiles;
})(typeof globalThis !== "undefined" ? globalThis : this);
