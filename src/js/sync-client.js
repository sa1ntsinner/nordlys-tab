/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - PROFILES AND SYNC, WIRED INTO THE PAGE
   ═══════════════════════════════════════════════════════════════════

   profiles.js keeps the setups, sync-engine.js trades them with Chrome sync;
   this is where the page meets both. The page keeps saving one config as it
   always has. After a save the client waits a moment (a slider drag saves
   on every step) and hands every profile to the engine; when another device
   writes, the engine answers with the new boards and the client puts them on
   the page. Nothing here runs against Chrome sync until sync is turned on. */
(function () {
  "use strict";

  const PUSH_DELAY = 2500;
  const PULL_DELAY = 800;
  // The look and layout, for "keep this look on this device only".
  const LOOK = ["theme", "colorMode", "lastLightTheme", "lastDarkTheme", "customTheme", "bgMode", "bgPalette", "bgSeed", "bgMotion",
    "bgIntensity", "bgDaylight", "bgRealSky", "glassLevel", "headerStyle", "typography", "hoverEffect", "iconShape", "cardRadius", "cardGlow", "bgBlur", "bgDim"];

  const say = (key, fallback, params) => {
    const value = window.I18N?.t(key, params || {});
    return value && value !== key ? value : fallback;
  };

  // chrome.storage areas, as promises; answers with Chrome's own error.
  function promised(area) {
    if (!area) return null;
    const settle = (resolve, reject, value) => {
      const error = window.chrome?.runtime?.lastError;
      if (error) reject(new Error(error.message)); else resolve(value);
    };
    return {
      get: (keys) => new Promise((resolve, reject) => { try { area.get(keys ?? null, (value) => settle(resolve, reject, value || {})); } catch (error) { reject(error); } }),
      set: (items) => new Promise((resolve, reject) => { try { area.set(items, () => settle(resolve, reject)); } catch (error) { reject(error); } }),
      remove: (keys) => new Promise((resolve, reject) => { try { area.remove(keys, () => settle(resolve, reject)); } catch (error) { reject(error); } })
    };
  }

  function memory() {
    const data = new Map();
    return {
      get: async (key) => (key == null ? Object.fromEntries(data) : { [key]: data.get(key) }),
      set: async (items) => { for (const [key, value] of Object.entries(items)) data.set(key, JSON.parse(JSON.stringify(value))); },
      remove: async (keys) => { for (const key of [].concat(keys)) data.delete(key); }
    };
  }

  // "Windows · Chrome": enough to tell two machines apart in a list.
  function deviceName() {
    const ua = navigator.userAgent || "";
    const platform = navigator.userAgentData?.platform || (/Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "");
    const brands = (navigator.userAgentData?.brands || []).map((entry) => entry.brand);
    const browser = brands.find((brand) => /Edge|Opera|Brave|Vivaldi/.test(brand)) || (/Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : "Chrome");
    const name = [platform, browser.replace("Microsoft ", "")].filter(Boolean).join(" · ");
    return name || say("sync.thisDevice", "This device");
  }

  class NordlysSyncClient {
    constructor(app) {
      this.app = app;
      const storage = window.chrome?.storage;
      this.local = promised(storage?.local) || memory();
      this.cloud = promised(storage?.sync);
      this.listeners = new Set();
      this.overrideCache = {};
      this.applying = false;
      this.profiles = new window.NordlysProfiles({ meta: localStorage, local: this.local }).init(say("profiles.firstName", "Main"));
      this.engine = this.cloud && window.NordlysSyncEngine ? new window.NordlysSyncEngine({ local: this.local, sync: this.cloud, deviceName: deviceName() }) : null;
      this.ready = (this.engine ? this.engine.load().then(() => this.refreshOverrides()) : Promise.resolve()).catch(() => {});
      this.wrapSave();
      this.watch();
    }

    // ── What the rest of the page asks ────────────────────────────
    available() { return Boolean(this.engine); }
    syncing() { return Boolean(this.engine?.enabled()); }
    list() { return this.profiles.list(); }
    active() { return this.profiles.active(); }
    deleted() { return this.profiles.deleted(); }
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit() { for (const fn of this.listeners) { try { fn(); } catch (error) { /* a listener's failure is its own */ } } }

    isHereOnly(item) { return item?.local === true; }
    isDifferentHere(entity) { return Boolean(this.overrideCache[entity]); }
    lookHere() { return Boolean(this.overrideCache[`c/${this.active().id}`]); }

    async refreshOverrides() {
      if (this.engine) this.overrideCache = await this.engine.overrides();
    }

    // ── Saving and listening ──────────────────────────────────────
    wrapSave() {
      const original = this.app.saveConfig.bind(this.app);
      this.saveQuietly = original;
      this.app.saveConfig = (...args) => {
        const ok = original(...args);
        if (ok && !this.applying) this.schedulePush();
        return ok;
      };
    }

    schedulePush() {
      if (!this.syncing()) return;
      clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(() => this.pushNow(), PUSH_DELAY);
    }

    async pushNow() {
      clearTimeout(this.pushTimer);
      if (!this.syncing()) return;
      // Folders and bookmarks need ids of their own before they can travel.
      if (window.NordlysSyncModel.normalize(this.app.config)) this.saveQuietly();
      try {
        await this.engine.push(await this.profiles.snapshot(this.app.config));
      } catch (error) { /* the engine records the failure in its status */ }
      this.emit();
    }

    schedulePull() {
      if (!this.syncing() || document.hidden) return;
      clearTimeout(this.pullTimer);
      this.pullTimer = setTimeout(() => this.pullNow(), PULL_DELAY);
    }

    async pullNow() {
      if (!this.syncing()) return;
      try {
        const view = await this.engine.pull();
        if (view) await this.adoptView(view);
      } catch (error) { /* recorded in the status */ }
      this.emit();
    }

    watch() {
      window.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
        if (area === "sync" && Object.keys(changes).some((key) => key.startsWith(window.NordlysSyncModel.PREFIX))) this.schedulePull();
        if (area === "local" && changes.nordlys_sync && this.engine?.state) {
          if (changes.nordlys_sync.newValue) this.engine.state = changes.nordlys_sync.newValue;
          this.refreshOverrides().then(() => this.emit());
        }
      });
      // Another tab renamed, added or switched a profile.
      window.addEventListener("storage", (event) => {
        if (event.key === "nordlys_profiles") { this.profiles.reload(); this.emit(); }
      });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.schedulePull(); });
    }

    /* Puts a board that came from elsewhere on the page, through the same
       repairs a load makes, without sending it straight back. */
    adoptLive(live) {
      const next = Object.assign({}, this.app.defaultConfig, live);
      window.NordlysConfigSchema?.repairConfig(next, this.app.defaultConfig);
      this.app.config = next;
      this.applying = true;
      try { this.saveQuietly(); } finally { this.applying = false; }
      if (next.language && window.I18N && window.I18N.currentLang !== next.language) window.I18N.setLanguage(next.language);
      this.app.applyLoadedConfig();
    }

    async adoptView(view) {
      const { live, switched } = await this.profiles.adopt(view, this.app.config);
      await this.refreshOverrides();
      this.adoptLive(live);
      if (switched && typeof toast === "function") toast(say("profiles.removedElsewhere", "That profile was deleted on another device, so this one is open now."), "info", 5000);
      this.emit();
    }

    // ── Profiles ──────────────────────────────────────────────────
    async switchTo(id, { undo = true } = {}) {
      const before = this.active();
      if (!before || before.id === id || !this.profiles.has(id)) return false;
      const board = document.getElementById("board");
      const still = window.NordlysUI?.motion?.reduced?.() || matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!still) { document.body.classList.add("profile-leaving"); await new Promise((resolve) => setTimeout(resolve, 120)); }
      const next = await this.profiles.switchTo(id, this.app.config);
      this.adoptLive(next);
      if (!still) {
        document.body.classList.remove("profile-leaving");
        document.body.classList.add("profile-arriving");
        board?.getBoundingClientRect();
        requestAnimationFrame(() => {
          document.body.classList.add("profile-settling");
          document.body.classList.remove("profile-arriving");
          setTimeout(() => document.body.classList.remove("profile-settling"), 260);
        });
      }
      this.schedulePush();
      this.emit();
      const name = this.active().name;
      window.NordlysUI?.announce?.(say("profiles.switched", `Profile: ${name}`, { name }));
      if (undo) {
        window.NordlysUI?.showUndoToast?.({
          message: say("profiles.switched", `Profile: ${name}`, { name }),
          onAction: () => this.switchTo(before.id, { undo: false })
        });
      }
      return true;
    }

    async create({ name, from = "empty" }) {
      const defaults = { ...JSON.parse(JSON.stringify(this.app.defaultConfig)), groups: [] };
      const id = await this.profiles.create({ name, from, live: this.app.config, defaults });
      await this.switchTo(id, { undo: false });
      return id;
    }

    rename(id, name) { this.profiles.rename(id, name); this.schedulePush(); this.emit(); }
    recolor(id, color) { this.profiles.recolor(id, color); this.schedulePush(); this.emit(); }
    move(id, index) { this.profiles.move(id, index); this.schedulePush(); this.emit(); }

    async remove(id) {
      const profile = await this.profiles.remove(id, this.app.config);
      this.schedulePush();
      this.emit();
      if (profile) {
        window.NordlysUI?.showUndoToast?.({
          message: say("profiles.deleted", `Deleted ${profile.name}`, { name: profile.name }),
          onAction: () => this.restore(id)
        });
      }
    }

    async restore(id) {
      await this.profiles.restore(id);
      this.schedulePush();
      this.emit();
    }

    // ── This device ───────────────────────────────────────────────
    setHereOnly(item, on) {
      if (!item) return;
      if (on) item.local = true; else delete item.local;
      this.app.saveConfig();
      this.app.grid?.render();
      this.app.settings?.renderBookmarksManager?.();
      this.emit();
    }

    async setDifferentHere(entity, fields) {
      if (!this.engine) return;
      await this.pushNow();
      const view = await this.engine.override(entity, fields);
      await this.adoptView(view);
    }

    async setLookHere(on) {
      if (!this.engine) return;
      await this.pushNow();
      const look = {};
      for (const key of LOOK) if (this.app.config[key] !== undefined) look[key] = JSON.parse(JSON.stringify(this.app.config[key]));
      const view = await this.engine.keepLookHere(this.active().id, on ? look : null);
      await this.adoptView(view);
    }

    /* A small mark on things that read differently here, shown in Arrange
       mode and on hover, so the board itself stays quiet. */
    decorate(element, item, kind) {
      if (!element || !item || !this.syncing()) return;
      const entity = `${kind}/${item.id}`;
      const here = this.isHereOnly(item);
      const different = !here && this.isDifferentHere(entity);
      if (!here && !different) return;
      element.classList.add(here ? "is-here-only" : "is-different-here");
      const mark = document.createElement("span");
      mark.className = "device-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 5h16v10H4zM9 19h6M12 15v4"/></svg>';
      element.append(mark);
      const note = here ? say("device.hereOnlyNote", "Only on this device") : say("device.differentNote", "Different on this device");
      element.title = element.title ? `${element.title} · ${note}` : note;
    }

    // ── Sync ──────────────────────────────────────────────────────
    async status() {
      if (!this.engine) return { available: false, enabled: false };
      await this.ready;
      return { available: true, ...(await this.engine.status()) };
    }

    async cloudHasData() {
      if (!this.cloud) return false;
      try {
        const all = await this.cloud.get(null);
        const own = `${window.NordlysSyncModel.PREFIX}${this.engine?.state?.device?.id}.`;
        return Object.keys(all).some((key) => key.startsWith(window.NordlysSyncModel.PREFIX) && !key.startsWith(own));
      } catch (error) { return false; }
    }

    async enable(mode) {
      if (!this.engine) return;
      await this.ready;
      if (window.NordlysSyncModel.normalize(this.app.config)) this.saveQuietly();
      const view = await this.engine.enable({ snapshot: await this.profiles.snapshot(this.app.config), mode });
      await this.adoptView(view);
    }

    async disable() {
      if (!this.engine) return;
      clearTimeout(this.pushTimer);
      await this.engine.disable();
      this.app.grid?.render();
      this.emit();
    }

    async renameDevice(name) { await this.engine?.rename(name); this.emit(); }
    async forget(deviceId) { await this.engine?.forget(deviceId); this.emit(); }
    async syncNow() { await this.pushNow(); await this.pullNow(); }
  }

  window.NordlysSyncClient = NordlysSyncClient;
})();
