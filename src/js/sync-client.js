/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - PROFILES AND SYNC, WIRED INTO THE PAGE
   ═══════════════════════════════════════════════════════════════════

   profiles.js keeps the setups, sync-engine.js trades them with the other
   devices (through the browser's sync, or with a code through the relay);
   this is where the page meets both. The page keeps saving one config as it
   always has. After a save the client waits a moment (a slider drag saves
   on every step) and hands every profile to the engine; when another device
   writes, the engine answers with the new boards and the client puts them on
   the page. Nothing here runs against either until sync is turned on. */
(function () {
  "use strict";

  const PUSH_DELAY = 2500;
  const PULL_DELAY = 800;
  /* The relay cannot say that something changed, so it is asked: when a tab
     opens or comes back into view, and now and then while it stays in view.
     Every tab shares one clock, so ten open tabs ask as often as one. */
  const RELAY_EVERY = 120000;
  const RELAY_REST = 20000;
  const RELAY_ASKED = "nordlys_relay_asked";
  /* Set the moment an edit is saved and cleared once it reached the other
     devices. A tab closed inside the push delay used to drop the edit, and the
     next tab's pull laid the stored copy, without it, over the board; a send
     that failed waited for the next edit. Whichever tab opens next sends first. */
  const UNSENT = "nordlys_sync_dirty";
  const unsent = () => { try { return localStorage.getItem(UNSENT); } catch (error) { return null; } };
  // The look and layout, for "keep this look on this device only".
  const LOOK = ["theme", "colorMode", "lastLightTheme", "lastDarkTheme", "customTheme", "bgMode", "bgPalette", "bgSeed", "bgMotion",
    "bgIntensity", "glassLevel", "headerStyle", "typography", "hoverEffect", "iconShape", "cardRadius", "cardGlow", "bgBlur", "bgDim",
    "skyRotate", "skyPool", "photoTone", "pictureColours", "pageLayout"];

  /* An icon picture is kept inside the bookmark (customImg) and is far too
     large for the sync items, which stopped it at the door: the other device
     got the bookmark without it and fell back to a letter or a glyph. With a
     code, each picture travels on its own through the relay (sync-relay.js),
     and the bookmark carries only its id (iconRef): the SHA-256 of the
     picture, so any device can tell whether the picture it holds is that one. */
  const PICTURE = /^data:image\/(png|webp|jpeg|gif|svg\+xml)[;,]/i;
  const PICTURE_LIMIT = 120000;
  const PICTURE_SIDE = 384;
  const PICTURES_KEY = "nordlys_sync_pictures";
  // The relay forgets what nobody has written for 400 days; a picture is sent again well before.
  const PICTURE_RESEND = 180 * 86400000;
  const PICTURE_RETRY = 600000;
  const isPicture = (value) => typeof value === "string" && PICTURE.test(value);
  const isRef = (value) => typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
  async function pictureRef(picture) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(picture));
    return [...new Uint8Array(digest)].slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  /* A picture kept from before the icon dialog held pictures to the size a
     tile shows can be a megabyte; it is drawn again at that size to travel. */
  async function smaller(picture) {
    const image = new Image();
    image.src = picture;
    await image.decode();
    const width = image.naturalWidth || PICTURE_SIDE, height = image.naturalHeight || PICTURE_SIDE;
    for (const side of [PICTURE_SIDE, 256, 160]) {
      const scale = Math.min(1, side / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const pen = canvas.getContext("2d");
      pen.imageSmoothingQuality = "high";
      pen.drawImage(image, 0, 0, canvas.width, canvas.height);
      const webp = canvas.toDataURL("image/webp", 0.92);
      const out = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
      if (out.length <= PICTURE_LIMIT) return out;
    }
    throw new Error("The picture is too large to send.");
  }
  const linksOf = (config) => (Array.isArray(config?.groups) ? config.groups : []).flatMap((group) => (Array.isArray(group?.links) ? group.links : [])).filter((link) => link && typeof link === "object");

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
    const browser = brands.find((brand) => /Edge|Opera|Brave|Vivaldi|Helium/.test(brand))
      || (/Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrom(e|ium)\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Chrome");
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
      /* Safari has the storage.sync area and keeps it on the device, so it is
         not offered there. The relay needs a place to keep its code, which a
         plain page (the demo) does not have. */
      if (window.NordlysPlatform?.name === "safari") this.cloud = null;
      const relay = window.NordlysSyncRelay && storage?.local && window.crypto?.subtle ? window.NordlysSyncRelay : null;
      this.relay = relay ? (code) => relay.create(code) : null;
      this.pictureQueue = Promise.resolve();
      this.pictureMisses = new Map();
      this.engine = (this.cloud || this.relay) && window.NordlysSyncEngine
        ? new window.NordlysSyncEngine({ local: this.local, sync: this.cloud, relay: this.relay, deviceName: deviceName() }) : null;
      this.ready = (this.engine ? this.engine.load().then(() => this.refreshOverrides()) : Promise.resolve()).catch(() => {});
      this.ready.then(async () => {
        // Left on from a build that offered a sync this browser never carried anywhere.
        if (this.syncing() && !this.withCode() && !this.cloud) return this.engine.disable().then(() => this.emit());
        if (unsent()) await this.pushNow();
        // The browser tells only the tabs open when a change lands, so a new tab looks for itself.
        if (this.withCode()) this.askRelay(); else this.schedulePull();
        /* Pictures that came in first, then this device's own: a board synced
           before pictures travelled sends them now, without waiting for an edit. */
        this.takePictures();
        this.sendPictures().then((changed) => { if (changed) this.schedulePush(); });
      }).catch(() => {});
      this.wrapSave();
      this.watch();
    }

    // ── What the rest of the page asks ────────────────────────────
    available() { return Boolean(this.engine); }
    syncing() { return Boolean(this.engine?.enabled()); }
    // The two ways there are, and the one in use.
    browserSync() { return Boolean(this.engine && this.cloud); }
    codeSync() { return Boolean(this.engine && this.relay); }
    withCode() { return Boolean(this.syncing() && this.engine.state?.relay?.code); }
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
      try { localStorage.setItem(UNSENT, String(Math.random())); } catch (error) { /* the timer still sends it */ }
      clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(() => this.pushNow(), PUSH_DELAY);
    }

    async pushNow() {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
      if (!this.syncing()) return;
      const mark = unsent();
      // Folders and bookmarks need ids of their own before they can travel.
      if (window.NordlysSyncModel.normalize(this.app.config)) this.saveQuietly();
      await this.sendPictures();
      try {
        await this.engine.push(await this.profiles.snapshot(this.app.config));
      } catch (error) { /* the engine records the failure in its status */ }
      // Kept when the send failed, or when another edit came in while it was on its way.
      try { if (this.engine.state?.status?.state === "ready" && unsent() === mark) localStorage.removeItem(UNSENT); } catch (error) { /* sent again next time */ }
      this.emit();
    }

    schedulePull() {
      if (!this.syncing() || document.hidden) return;
      clearTimeout(this.pullTimer);
      this.pullTimer = setTimeout(() => this.pullNow(), PULL_DELAY);
    }

    async pullNow() {
      if (!this.syncing()) return;
      /* A change made here and still waiting to be sent goes into the model
         first: pulled before it, the board that came back did not have it,
         and the push that followed sent the board without it. */
      if (this.pushTimer || unsent()) await this.pushNow();
      try {
        const view = await this.engine.pull();
        if (view) await this.adoptView(view);
      } catch (error) { /* recorded in the status */ }
      this.takePictures();
      this.emit();
    }

    watch() {
      window.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
        if (area === "sync" && Object.keys(changes).some((key) => key.startsWith(window.NordlysSyncModel.PREFIX))) this.schedulePull();
        if (area === "local" && changes.nordlys_sync && this.engine?.state) {
          // Never under a call in progress: it reads the stored state again when it starts, and writes its own.
          if (changes.nordlys_sync.newValue && !this.engine.busy) this.engine.state = changes.nordlys_sync.newValue;
          this.refreshOverrides().then(() => this.emit());
        }
      });
      // Another tab renamed, added or switched a profile.
      window.addEventListener("storage", (event) => {
        if (event.key === "nordlys_profiles") { this.profiles.reload(); this.emit(); }
      });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (this.withCode()) this.askRelay(); else this.schedulePull(); } });
      setInterval(() => this.askRelay(), RELAY_EVERY);
      // Started as the tab goes; whatever does not finish, the mark sends from the next tab.
      window.addEventListener("pagehide", () => { if (this.pushTimer) this.pushNow(); });
    }

    // A pull from the relay, unless a tab asked a moment ago.
    askRelay() {
      if (!this.withCode() || document.hidden) return;
      try {
        if (Date.now() - Number(localStorage.getItem(RELAY_ASKED) || 0) < RELAY_REST) return;
        localStorage.setItem(RELAY_ASKED, String(Date.now()));
      } catch (error) { /* no clock to share: ask */ }
      this.schedulePull();
    }

    /* Puts a board that came from elsewhere on the page, through the same
       repairs a load makes, without sending it straight back. */
    adoptLive(live) {
      const next = Object.assign({}, this.app.defaultConfig, live);
      window.NordlysConfigSchema?.repairConfig(next, this.app.defaultConfig);
      // A profile saved by an older build, here or on another device, may name a retired sky or theme.
      this.app.normalizeStoredConfig?.(next);
      // Through the same door as another tab's board: drags let go, editors follow, identities kept.
      if (this.app.adoptConfig) this.app.adoptConfig(next); else this.app.config = next;
      this.applying = true;
      try { this.saveQuietly(); } finally { this.applying = false; }
      if (next.language && window.I18N && window.I18N.currentLang !== next.language) window.I18N.setLanguage(next.language);
      this.app.applyLoadedConfig();
      this.takePictures();
    }

    // ── Icon pictures, beside the items ───────────────────────────
    /* One picture job at a time, so a picture being fetched is never taken
       for this device's own while it is on its way. */
    pictures(task) {
      const next = this.pictureQueue.then(() => (this.withCode() ? task(this.pictureRelay()) : null)).catch(() => null).finally(() => this.working(null));
      this.pictureQueue = next;
      return next;
    }

    /* Pictures on their way, for the status line under the switch: a board
       is "Synced" before its pictures are, and saying so while thirty are
       still uploading was not true. Null when none are. */
    working(kind, done = 0, total = 0) {
      const next = kind && total ? { kind, done, total } : null;
      if (JSON.stringify(next) === JSON.stringify(this.pictureWork || null)) return;
      this.pictureWork = next;
      this.emit();
    }

    pictureRelay() {
      const code = this.engine.state.relay.code;
      if (this.relayForPictures?.code !== code) this.relayForPictures = { code, relay: this.relay(code) };
      return this.relayForPictures.relay;
    }

    async picturesSent() { return (await this.local.get(PICTURES_KEY))[PICTURES_KEY] || {}; }

    async markSent(refs) {
      if (!refs.length) return;
      const sent = await this.picturesSent();
      const now = Date.now();
      for (const ref of refs) sent[ref] = now;
      await this.local.set({ [PICTURES_KEY]: sent });
    }

    /* Before the items leave: every picture on the board is sent, once, and
       its bookmark is given the picture's id. A bookmark whose picture could
       not be sent loses an id that named an earlier picture, so no device
       fetches that one back over it. */
    sendPictures() {
      return this.pictures(async (relay) => {
        const sent = await this.picturesSent();
        const now = Date.now();
        const refs = new Map();
        const done = [];
        const due = [];
        for (const link of linksOf(this.app.config)) {
          const original = link.customImg;
          if (!isPicture(original) || refs.has(original) || due.some((item) => item.original === original)) continue;
          const item = { original, picture: original, ref: null };
          try {
            if (item.picture.length > PICTURE_LIMIT) item.picture = await smaller(item.picture);
            item.ref = await pictureRef(item.picture);
          } catch (error) { /* not sendable: its bookmark loses an old id below */ }
          if (item.ref && !(now - (sent[item.ref] || 0) < PICTURE_RESEND)) due.push(item);
          else refs.set(original, item);
        }
        for (const [index, item] of due.entries()) {
          this.working("send", index, due.length);
          try { await relay.putPicture(item.ref, item.picture); sent[item.ref] = now; done.push(item.ref); }
          catch (error) {
            // Asked to wait: the rest go with a later push, and each bookmark keeps the id it had.
            if (error?.status === 429) break;
            item.ref = null;
          }
          refs.set(item.original, item);
        }
        await this.markSent(done);
        // Applied to the board as it is now: it may have changed while the pictures were on their way.
        let changed = false;
        for (const link of linksOf(this.app.config)) {
          const found = refs.get(link.customImg);
          if (!found) continue;
          if (found.ref && found.picture !== link.customImg) { link.customImg = found.picture; changed = true; }
          if (found.ref && link.iconRef !== found.ref) { link.iconRef = found.ref; changed = true; }
          if (!found.ref && link.iconRef !== undefined) { delete link.iconRef; changed = true; }
        }
        if (changed) this.saveQuietly();
        return changed;
      });
    }

    /* After a board came in: a bookmark that names a picture this device does
       not hold gets it from the relay. One it holds an older picture for
       shows its fallback until the new one is here, so the old one is never
       sent back as if it were this device's own choice. */
    takePictures() {
      return this.pictures(async (relay) => {
        const wanted = new Set();
        for (const link of linksOf(this.app.config)) {
          if (!isRef(link.iconRef)) continue;
          if (isPicture(link.customImg) && await pictureRef(link.customImg) === link.iconRef) continue;
          wanted.add(link.iconRef);
        }
        if (!wanted.size) return;
        let changed = false;
        for (const link of linksOf(this.app.config)) {
          if (wanted.has(link.iconRef) && link.customImg !== undefined) { delete link.customImg; changed = true; }
        }
        if (changed) this.keepPictures();
        const now = Date.now();
        const got = new Map();
        const asking = [...wanted].filter((ref) => !(now - (this.pictureMisses.get(ref) || 0) < PICTURE_RETRY));
        for (const [index, ref] of asking.entries()) {
          this.working("get", index, asking.length);
          let picture = null;
          try { picture = await relay.getPicture(ref); } catch (error) { /* asked again later */ }
          if (isPicture(picture) && picture.length <= PICTURE_LIMIT && await pictureRef(picture) === ref) got.set(ref, picture);
          else this.pictureMisses.set(ref, now);
        }
        if (!got.size) return;
        await this.markSent([...got.keys()]);
        changed = false;
        for (const link of linksOf(this.app.config)) {
          const picture = got.get(link.iconRef);
          if (picture && link.customImg !== picture) { link.customImg = picture; changed = true; }
        }
        if (changed) this.keepPictures();
      });
    }

    /* Saved like an edit, so the model holds the picture as this device's
       own reading (it never leaves) and the next board that comes in keeps it. */
    keepPictures() {
      this.app.saveConfig();
      this.app.grid?.render();
    }

    async adoptView(view) {
      const { live, switched } = await this.profiles.adopt(view, this.app.config);
      await this.refreshOverrides();
      this.adoptLive(live);
      if (switched && typeof toast === "function") toast(say("profiles.removedElsewhere", "That space was deleted on another device, so this one is open now."), "info", 5000);
      this.emit();
    }

    // ── Profiles ──────────────────────────────────────────────────
    /* One switch at a time, each from where the last one left the page: two
       quick picks used to overlap, and the second put the first's board into
       a slot that was not its own. */
    switchTo(id, options) {
      const run = (this.switching || Promise.resolve()).then(() => this.switchNow(id, options));
      this.switching = run.catch(() => false);
      return run;
    }

    async switchNow(id, { undo = true } = {}) {
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
      window.NordlysUI?.announce?.(say("profiles.switched", `Space: ${name}`, { name }));
      if (undo) {
        window.NordlysUI?.showUndoToast?.({
          message: say("profiles.switched", `Space: ${name}`, { name }),
          onAction: () => this.switchTo(before.id, { undo: false })
        });
      }
      return true;
    }

    async create({ name, from = "empty" }) {
      const defaults = { ...JSON.parse(JSON.stringify(this.app.defaultConfig)), groups: [] };
      // A note still being typed is written first: a copy takes what the cards hold from storage.
      if (from === "copy") this.app.dashboard?.flush?.();
      const id = await this.profiles.create({ name, from, live: this.app.config, defaults });
      await this.switchTo(id, { undo: false });
      return id;
    }

    // A name, a colour and the order are part of the setup: an earlier version is kept of them too.
    rename(id, name) { this.profiles.rename(id, name); this.app.scheduleAutosave?.(); this.schedulePush(); this.emit(); }
    recolor(id, color) { this.profiles.recolor(id, color); this.app.scheduleAutosave?.(); this.schedulePush(); this.emit(); }
    move(id, index) { this.profiles.move(id, index); this.app.scheduleAutosave?.(); this.schedulePush(); this.emit(); }

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

    /* Whether other devices already keep a setup there: in the browser's
       sync, or under a code. A relay that does not answer is the caller's to
       report, so with a code this throws. */
    async cloudHasData(code) {
      if (code ? !this.relay : !this.cloud) return false;
      try {
        const all = await (code ? this.relay(code) : this.cloud).get(null);
        const own = `${window.NordlysSyncModel.PREFIX}${this.engine?.state?.device?.id}.`;
        return Object.keys(all).some((key) => key.startsWith(window.NordlysSyncModel.PREFIX) && !key.startsWith(own));
      } catch (error) { if (code) throw error; return false; }
    }

    newCode() { return window.NordlysSyncRelay.newCode(); }
    readCode(text) { return window.NordlysSyncRelay.readCode(text); }
    showCode(code) { return window.NordlysSyncRelay.showCode(code); }

    async enable(mode, code) {
      if (!this.engine) return;
      await this.ready;
      if (window.NordlysSyncModel.normalize(this.app.config)) this.saveQuietly();
      const view = await this.engine.enable({ snapshot: await this.profiles.snapshot(this.app.config), mode, code: code || null });
      await this.adoptView(view);
      // The pictures can only travel once there is a code to seal them with.
      await this.pushNow();
    }

    async disable() {
      if (!this.engine) return;
      clearTimeout(this.pushTimer);
      try { localStorage.removeItem(UNSENT); } catch (error) { /* nothing to send it with anyway */ }
      const left = await this.engine.disable();
      /* The pictures are shared by every device on the code, so they go only
         when no other device is left; otherwise the relay drops each one 400
         days after a device last sent it. Best effort, like the piece. */
      if (left?.alone && this.relay) {
        const relay = this.relay(left.code);
        for (const ref of Object.keys(await this.picturesSent())) {
          try { await relay.removePicture(ref); } catch (error) { break; }
        }
      }
      // Turned on again, with this code or another, every picture is sent afresh.
      await this.local.remove(PICTURES_KEY);
      this.app.grid?.render();
      this.emit();
    }

    async renameDevice(name) { await this.engine?.rename(name); this.emit(); }
    async forget(deviceId) { await this.engine?.forget(deviceId); this.emit(); }
    async syncNow() { await this.pushNow(); await this.pullNow(); }
  }

  window.NordlysSyncClient = NordlysSyncClient;
})();
