/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - KEEPING THE MODEL, AND TRADING IT WITH CHROME SYNC
   ═══════════════════════════════════════════════════════════════════

   The model (sync-model.js) lives here in chrome.storage.local together with
   what belongs to this device alone: its id and name, and its overrides, the
   fields that read differently here than everywhere else. Every call goes
   through one queue, so two tabs can never interleave a read and a write.

   A failed cloud write never undoes anything here: the edit is already in the
   model, and the next push tries again. Nothing is sent that would not fit
   whole, so the other devices never receive a board cut short. */
(function (root) {
  "use strict";

  const M = () => root.NordlysSyncModel;
  const KEY = "nordlys_sync";
  const BACKUPS = "nordlys_sync_backups";
  const TOTAL_LIMIT = 102400;
  const ITEMS_LIMIT = 512;
  const SEEN_EVERY = 3600000;
  const bytes = (text) => new TextEncoder().encode(text).length;
  const itemBytes = (key, value) => bytes(key) + bytes(JSON.stringify(value));
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

  class NordlysSyncEngine {
    constructor({ local, sync, deviceName = "This device", now = () => Date.now() }) {
      this.local = local;
      this.sync = sync;
      this.deviceName = deviceName;
      this.now = now;
      this.queue = Promise.resolve();
      this.state = null;
    }

    /* Every tab has its own engine over the same stored state, so each call
       starts from what is stored, never from what this tab remembers. */
    run(task) {
      const next = this.queue.then(async () => { await this.fresh(); return task(); });
      this.queue = next.catch(() => {});
      return next;
    }

    async fresh() {
      if (!this.state) return;
      const stored = (await this.local.get(KEY))[KEY];
      if (stored && stored.version === 1 && stored.model?.records) this.state = stored;
    }

    load() {
      return this.run(async () => {
        const data = await this.local.get(KEY);
        const stored = data[KEY];
        if (stored && stored.version === 1 && stored.model?.records) { this.state = stored; return; }
        const id = (root.crypto?.randomUUID ? root.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, "");
        this.state = {
          version: 1, enabled: false,
          device: { id, name: this.deviceName },
          model: M().create(id), overrides: {},
          status: { state: "off", error: null, bytes: 0, lastSync: null }
        };
        /* Not saved yet: a page that has done nothing writes nothing. It is
           stored the first time anything happens to it. */
      });
    }

    async save() { await this.local.set({ [KEY]: this.state }); }

    enabled() { return Boolean(this.state?.enabled); }

    status() {
      return this.run(async () => ({
        enabled: this.state.enabled,
        ...clone(this.state.status),
        device: clone(this.state.device),
        devices: M().devices(this.state.model)
      }));
    }

    /* The board the page should show: the model, with this device's own
       readings laid over it. An override whose record is gone goes too. */
    compose() {
      const view = M().materialize(this.state.model);
      const all = M().values(this.state.model);
      let dropped = false;
      for (const entity of Object.keys(this.state.overrides)) {
        const alive = entity.startsWith("c/") ? all[`p/${entity.slice(2)}`]?._alive === true : all[entity]?._alive === true;
        if (!alive) { delete this.state.overrides[entity]; dropped = true; }
      }
      for (const [entity, fields] of Object.entries(this.state.overrides)) {
        const target = this.locate(view, entity);
        if (target) Object.assign(target, clone(fields));
      }
      return { view, dropped };
    }

    locate(snapshot, entity) {
      const [kind, id] = [entity.slice(0, 1), entity.slice(2)];
      for (const profile of snapshot.profiles || []) {
        if (kind === "c" && profile.id === id) return profile.config;
        for (const group of profile.config?.groups || []) {
          if (kind === "g" && group.id === id) return group;
          if (kind === "l") { const link = (group.links || []).find((entry) => entry.id === id); if (link) return link; }
        }
      }
      return null;
    }

    view() {
      return this.run(async () => {
        const { view, dropped } = this.compose();
        if (dropped) await this.save();
        return view;
      });
    }

    /* What the page holds, turned back into shared values: a field that reads
       differently here keeps its local value in the override and leaves the
       shared one as it was. */
    prepare(snapshot) {
      const next = clone(snapshot);
      M().normalizeSnapshot(next);
      const shared = M().values(this.state.model);
      for (const [entity, fields] of Object.entries(this.state.overrides)) {
        const target = this.locate(next, entity);
        if (!target) continue;
        for (const field of Object.keys(fields)) {
          if (target[field] !== undefined) fields[field] = clone(target[field]);
          if (shared[entity] && shared[entity][field] !== undefined) target[field] = clone(shared[entity][field]);
          else delete target[field];
        }
      }
      return next;
    }

    stampDevice() {
      const record = this.state.model.records[`d/${this.state.device.id}`];
      const changes = [];
      if (record?.name?.v !== this.state.device.name) changes.push([`d/${this.state.device.id}`, "name", this.state.device.name]);
      if (!record?._seenAt || this.now() - record._seenAt.v > SEEN_EVERY) changes.push([`d/${this.state.device.id}`, "_seenAt", this.now()]);
      M().apply(this.state.model, changes);
    }

    async backup(snapshot, reason) {
      const data = await this.local.get(BACKUPS);
      const list = [{ at: this.now(), reason, snapshot: clone(snapshot) }, ...(data[BACKUPS] || [])].slice(0, 3);
      await this.local.set({ [BACKUPS]: list });
    }

    backups() {
      return this.run(async () => (await this.local.get(BACKUPS))[BACKUPS] || []);
    }

    /* Turns sync on. With nothing in sync yet every mode is the same: this
       board goes up. Otherwise:
         use-sync       this device takes what sync has
         merge          both are kept, field by field
         replace-sync   this board wins everywhere */
    enable({ snapshot, mode = "merge" }) {
      return this.run(async () => {
        await this.backup(snapshot, "enable");
        const remote = await this.sync.get(null);
        const has = Object.keys(remote).some((key) => key.startsWith(M().PREFIX));
        this.state.model = M().create(this.state.device.id);
        this.state.overrides = {};
        try {
          if (has && mode === "use-sync") M().merge(this.state.model, remote);
          else if (has && mode === "replace-sync") { M().merge(this.state.model, remote); M().update(this.state.model, this.prepare(snapshot)); }
          else { M().update(this.state.model, this.prepare(snapshot)); if (has) M().merge(this.state.model, remote); }
        } catch (error) {
          this.state.model = M().create(this.state.device.id);
          M().update(this.state.model, this.prepare(snapshot));
          this.fail("error", error);
          await this.save();
          return this.compose().view;
        }
        this.state.enabled = true;
        await this.send();
        return this.compose().view;
      });
    }

    disable() {
      return this.run(async () => {
        this.state.enabled = false;
        this.state.status = { ...this.state.status, state: "off", error: null };
        await this.save();
      });
    }

    push(snapshot) {
      return this.run(async () => {
        M().update(this.state.model, this.prepare(snapshot));
        if (!this.state.enabled) { await this.save(); return; }
        await this.send();
      });
    }

    /* Takes what the other devices wrote. Answers the new board, or null
       when nothing changed, so the page redraws only when it must. */
    pull() {
      return this.run(async () => {
        if (!this.state.enabled) return null;
        let changed;
        const before = JSON.stringify(this.compose().view);
        try {
          const draft = clone(this.state.model);
          changed = M().merge(draft, await this.sync.get(null));
          if (changed) this.state.model = draft;
        } catch (error) {
          this.fail("error", error);
          await this.save();
          return null;
        }
        if (!changed) return null;
        const { view } = this.compose();
        this.state.status = { ...this.state.status, state: "ready", error: null, lastSync: this.now() };
        await this.save();
        // A device saying hello is not a new board.
        return JSON.stringify(view) === before ? null : view;
      });
    }

    override(entity, fields) {
      return this.run(async () => {
        if (fields === null) delete this.state.overrides[entity];
        else this.state.overrides[entity] = { ...(this.state.overrides[entity] || {}), ...clone(fields) };
        const { view } = this.compose();
        await this.save();
        return view;
      });
    }

    overrides() { return this.run(async () => clone(this.state.overrides)); }

    keepLookHere(profileId, look) { return this.override(`c/${profileId}`, look); }

    rename(name) {
      return this.run(async () => {
        const value = String(name || "").trim().slice(0, 40);
        if (!value) throw new Error("A device needs a name.");
        this.state.device.name = value;
        if (this.state.enabled) await this.send(); else await this.save();
      });
    }

    /* Frees the space an old device's items take. Its values stay in every
       board that already took them. */
    forget(deviceId) {
      return this.run(async () => {
        if (deviceId === this.state.device.id) throw new Error("This device cannot forget itself.");
        const remote = await this.sync.get(null);
        const keys = Object.keys(remote).filter((key) => key.startsWith(`${M().PREFIX}${deviceId}.`));
        if (keys.length) await this.sync.remove(keys);
        M().apply(this.state.model, [[`d/${deviceId}`, "_alive", false]]);
        await this.save();
      });
    }

    fail(state, error) {
      this.state.status = { ...this.state.status, state, error: String(error?.message || error) };
    }

    async send() {
      this.stampDevice();
      this.state.status = { ...this.state.status, state: "syncing" };
      await this.save();
      try {
        const remote = await this.sync.get(null);
        const ownPrefix = `${M().PREFIX}${this.state.device.id}.`;
        const chunks = M().exportChunks(this.state.model);
        const writes = {};
        for (const [key, value] of Object.entries(chunks)) {
          if (itemBytes(key, value) > M().ITEM_LIMIT) throw new Error("A sync item came out larger than 8 KB. Your changes are saved here.");
          if (JSON.stringify(remote[key]) !== JSON.stringify(value)) writes[key] = value;
        }
        const removals = Object.keys(remote).filter((key) => key.startsWith(ownPrefix) && !chunks[key]);
        const after = { ...remote, ...writes };
        for (const key of removals) delete after[key];
        const used = Object.entries(after).reduce((sum, [key, value]) => sum + itemBytes(key, value), 0);
        this.state.status.bytes = used;
        if (used > TOTAL_LIMIT || Object.keys(after).length > ITEMS_LIMIT) {
          this.fail("full", new Error("Chrome sync is full (100 KB). Delete a profile you don't use, or use smaller icons. Your changes are saved here."));
          await this.save();
          return;
        }
        if (Object.keys(writes).length) await this.sync.set(writes);
        if (removals.length) await this.sync.remove(removals);
        this.state.status = { ...this.state.status, state: "ready", error: null, lastSync: this.now() };
      } catch (error) {
        this.fail("error", error);
      }
      await this.save();
    }
  }

  root.NordlysSyncEngine = NordlysSyncEngine;
  if (typeof module !== "undefined" && module.exports) module.exports = NordlysSyncEngine;
})(typeof globalThis !== "undefined" ? globalThis : this);
