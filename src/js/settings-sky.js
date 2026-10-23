/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - CHOOSING THE SKY (Settings → Background)
   ═══════════════════════════════════════════════════════════════════

   The kinds of sky and the gallery of each, the layers of a composed sky,
   where the sky is and the working hours it knows, the skies someone saved,
   the rotation, the night light and the colours from a picture. All of it is
   built from the catalogue (sky-catalog.js): a sky added there arrives here
   with its card, its name and the controls that belong to it. The colour
   moods, the time of day and the sliders are settings.js's. */
(function () {
  "use strict";

  const Skies = () => window.NordlysSkies;
  // As many as the colour moods: a row of chips that is still a row.
  const LOOK_LIMIT = 12;

  /* A control that belongs to some skies only says which with
     data-scene-only; each name is a question asked of the sky's entry. */
  const BELONGS = {
    procedural: (sky) => sky.kind === "canvas",
    nordlys: (sky) => sky.category === "nordlys",
    composed: (sky) => Boolean(sky.layers),
    halo: (sky) => sky.id === "halo",
    upload: (sky) => sky.kind === "media",
    media: (sky) => sky.kind === "media" || sky.kind === "picture",
    image: (sky) => sky.id === "custom-image" || sky.kind === "picture",
    readable: (sky) => sky.id === "custom-image" || Boolean(sky.readable),
    // A sky a rotation can come back to: not a wallpaper, not a plain colour.
    savable: (sky) => sky.kind === "canvas" || sky.kind === "picture"
  };

  /* What a sky drawn from the world says under the gallery: what it shows and
     where that comes from. Spelled out so every key can be found by searching. */
  const NOTES = {
    starmap: ["scene.starmapNote", "The bright stars and their constellations as they stand in your sky right now."],
    meteors: ["scene.meteorsNote", "A calm night sky with a shooting star now and then, and more on the nights of the big meteor showers."],
    midnightsun: ["scene.midnightsunNote", "The sun where it is in your sky right now, over a calm sea."],
    outside: ["scene.outsideNote", "The weather where the sky is, asked of Open-Meteo at most every half hour."],
    yourday: ["scene.yourdayNote", "Today's meetings as cloud: the fuller your working hours, the more of it. Read from your calendar cards; nothing is sent."],
    northern: ["scene.northernNote", "The aurora as strong as it is under the oval tonight, from NOAA's K index."],
    "yours-horizon": ["scene.yoursHorizonNote", "The hills around the place the sky is, from Open-Meteo's elevation model, asked once for each place."],
    "picture-wikimedia": ["scene.pictureWikimediaNote", "Wikimedia Commons' picture of the day, with its caption."],
    "picture-paintings": ["scene.picturePaintingsNote", "A painting from the featured pictures on Wikimedia Commons, a different one each day."],
    "picture-met": ["scene.pictureMetNote", "A painting from the Met's highlights, a different one each day."],
    "picture-earth": ["scene.pictureEarthNote", "The Earth from a million miles out, as NASA's EPIC camera saw it on its latest day."]
  };
  const KIND_NOTES = {
    nordlys: ["sky.cat.nordlysNote", "Skies of the north, drawn on this computer. Nothing is sent anywhere."],
    weather: ["sky.cat.weatherNote", "Skies with weather in them: the weather outside, your day as cloud, or the weather you choose."],
    horizon: ["sky.cat.horizonNote", "A sky over a landscape, lit for the hour it is where the sky is."],
    world: ["sky.cat.worldNote", "A new picture every day. Only the date and your language are sent, and only while one of these is the sky."],
    yours: ["sky.cat.yoursNote", "Your own picture or video, kept on this computer, or a plain colour."]
  };
  const SHOWER_NAMES = {
    quadrantids: ["shower.quadrantids", "the Quadrantids"], lyrids: ["shower.lyrids", "the Lyrids"],
    etaAquariids: ["shower.etaAquariids", "the Eta Aquariids"], perseids: ["shower.perseids", "the Perseids"],
    orionids: ["shower.orionids", "the Orionids"], leonids: ["shower.leonids", "the Leonids"], geminids: ["shower.geminids", "the Geminids"]
  };
  /* The words of the composer by message key, in English: a layer is
     layer.<name>, its choices layer.<name>.<choice>, a body layer.<body>. */
  const WORDS = {
    "layer.light": "Light", "layer.light.auto": "The real sun", "layer.light.workday": "My working day",
    "layer.light.dawn": "Dawn", "layer.light.day": "Day", "layer.light.dusk": "Dusk", "layer.light.night": "Night",
    "layer.weather": "Weather", "layer.weather.clear": "Clear", "layer.weather.clouds": "Clouds", "layer.weather.rain": "Rain",
    "layer.weather.snow": "Snow", "layer.weather.fog": "Fog", "layer.weather.storm": "Thunder",
    "layer.weather.live": "As it is outside", "layer.weather.day": "My day, as cloud",
    "layer.horizon": "Horizon", "layer.horizon.none": "Open sky", "layer.horizon.mountains": "Mountains", "layer.horizon.sea": "Sea",
    "layer.horizon.city": "City", "layer.horizon.forest": "Forest", "layer.horizon.steppe": "Steppe", "layer.horizon.desert": "Desert",
    "layer.horizon.lighthouse": "Lighthouse", "layer.horizon.yours": "The real one",
    "layer.style": "Style", "layer.style.lit": "Lit", "layer.style.poster": "Poster", "layer.style.engraving": "Engraving", "layer.style.pixel": "Pixel",
    "layer.aurora": "Aurora", "layer.aurora.off": "None", "layer.aurora.live": "As seen from here",
    "layer.aurora.north": "As under the oval", "layer.aurora.on": "Always",
    "layer.weather.keep": "Keep the weather when shuffling", "layer.horizon.keep": "Keep the horizon when shuffling",
    "layer.style.keep": "Keep the style when shuffling", "layer.aurora.keep": "Keep the aurora when shuffling",
    "layer.stars": "Stars", "layer.moon": "Moon", "layer.planets": "Planets", "layer.meteors": "Meteors"
  };

  const hhmm = (hours) => `${String(Math.floor(hours)).padStart(2, "0")}:${String(Math.round((hours % 1) * 60)).padStart(2, "0")}`;
  const hoursOf = (value) => {
    const [h, m] = String(value || "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : NaN;
  };

  class NordlysSkySettings {
    constructor(app, settings) {
      this.app = app;
      this.settings = settings;
      this.select = document.getElementById("cfg-bg-mode");
      this.grid = document.getElementById("bg-scene-grid");
      this.kinds = document.getElementById("bg-kinds");
      if (!this.select || !this.grid || !this.kinds || !Skies()) return;
      for (const sky of Skies().SKIES) this.select.append(new Option(sky.name, sky.id));
      this.kind = Skies().get(app.config.bgMode)?.category || "nordlys";
      this.buildGallery();
      this.buildComposer();
      this.wire();
    }

    text(key, fallback, params) {
      const value = window.I18N?.t(key, params || {});
      return value && value !== key ? value : fallback;
    }
    word(key) { return this.text(key, WORDS[key] || key); }
    config() { return this.app.config; }
    sky() { return Skies().get(this.select.value) || Skies().get("aurora"); }
    // The layers the chosen sky draws: the catalogue's, under the person's.
    layers() { return Skies().layersOf(this.select.value, this.config().skyLayers); }
    // What a composed sky starts from, so only what the person changed is kept.
    base() { return Skies().layersOf(this.select.value, null); }
    choose(id) {
      this.select.value = id;
      this.select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // Every change of the sky goes the one way: kept, drawn, and the panel following.
    commit() {
      this.app.saveConfig();
      this.app.updateBackgroundMode();
      this.settings?.syncBackgroundControls?.();
    }

    // ── The gallery ─────────────────────────────────────────────────
    /* The cards are built once: a still keeps its seeded world on its own
       canvas, so a new mood repaints the same stars rather than a new
       scatter. Only the kind on show is drawn. */
    buildGallery() {
      for (const category of Skies().CATEGORIES) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sky-kind";
        chip.dataset.kind = category.id;
        chip.dataset.i18n = category.key;
        chip.textContent = this.text(category.key, category.name);
        chip.addEventListener("click", () => { this.kind = category.id; this.paint(); });
        this.kinds.append(chip);
      }
      for (const sky of Skies().SKIES) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "scene-card";
        card.dataset.scene = sky.id;
        card.setAttribute("role", "radio");
        const preview = document.createElement("span");
        preview.className = "scene-preview";
        preview.dataset.scene = sky.id;
        preview.dataset.kind = sky.kind;
        preview.setAttribute("aria-hidden", "true");
        if (sky.kind === "canvas") {
          const still = document.createElement("canvas");
          still.className = "scene-still";
          still.dataset.scene = sky.id;
          preview.append(still);
        }
        const name = document.createElement("span");
        name.className = "scene-name";
        name.dataset.i18n = sky.key;
        name.textContent = this.text(sky.key, sky.name);
        card.append(preview, name);
        card.addEventListener("click", () => this.choose(sky.id));
        this.grid.append(card);
      }
      if (typeof ResizeObserver === "function") new ResizeObserver(() => this.queueStills()).observe(this.grid);
      window.addEventListener("nordlys:palette", () => this.queueStills());
    }

    paint() {
      const chosen = this.select.value;
      for (const chip of this.kinds.children) chip.setAttribute("aria-pressed", String(chip.dataset.kind === this.kind));
      for (const card of this.grid.children) {
        const sky = Skies().get(card.dataset.scene);
        card.hidden = sky.category !== this.kind;
        card.setAttribute("aria-checked", String(sky.id === chosen));
        if (sky.kind === "picture" && !card.hidden) this.showKeptPicture(card.firstChild, sky);
      }
      const note = KIND_NOTES[this.kind];
      const kindNote = document.getElementById("bg-kind-note");
      if (kindNote) kindNote.textContent = note ? this.text(note[0], note[1]) : "";
      this.queueStills();
    }

    /* A picture card shows the picture kept from the last time that sky was
       on screen, from the browser's cache; one never shown has nothing to
       show and asks for nothing. */
    showKeptPicture(preview, sky) {
      const picture = window.NordlysWorldPicture?.today(sky.source, null, { ask: false, lang: window.I18N?.currentLang || "en" });
      let image = preview.querySelector("img");
      if (!picture) { image?.remove(); return; }
      if (!image) {
        image = document.createElement("img");
        image.alt = "";
        image.decoding = "async";
        image.loading = "lazy";
        preview.append(image);
      }
      if (picture.cors) image.crossOrigin = "anonymous";
      if (image.getAttribute("src") !== picture.url) image.src = picture.url;
      image.classList.toggle("is-dark", picture.fit === "dark");
    }

    queueStills() {
      if (this.stillsQueued) return;
      this.stillsQueued = true;
      requestAnimationFrame(() => {
        this.stillsQueued = false;
        const engine = this.app.bgEngine;
        if (!engine || !this.grid.offsetParent) return;
        for (const still of this.grid.querySelectorAll(".scene-card:not([hidden]) canvas.scene-still")) {
          if (engine.paintStill(still, still.dataset.scene)) still.parentElement.classList.add("is-live");
        }
      });
    }

    /* Offering an Upload button while Aurora runs, or a blur slider with
       nothing to blur, is noise to read and dismiss: each control declares
       the skies it belongs to and the rest step aside. */
    showRelevant() {
      const sky = this.sky();
      for (const node of document.querySelectorAll("#sec-background [data-scene-only]")) {
        node.hidden = !BELONGS[node.dataset.sceneOnly]?.(sky);
      }
      const layers = this.layers();
      const workday = document.getElementById("bg-workday-row");
      if (workday) workday.hidden = !(layers.light === "workday" || layers.weather === "day");
    }

    sayScene() {
      const sceneNote = document.getElementById("bg-scene-note");
      if (!sceneNote) return;
      const note = NOTES[this.select.value];
      sceneNote.hidden = !note;
      if (!note) return;
      const lines = [this.text(note[0], note[1])];
      // A shower counts from a third of the way up to its peak, which is a day or two either side of it.
      const clock = this.app.bgEngine?.now?.() || new Date();
      const shower = this.select.value === "meteors" && (window.NordlysSky?.meteorShowers?.(clock) || [])
        .filter((candidate) => candidate.activity > 0.3 && SHOWER_NAMES[candidate.name])
        .sort((a, b) => b.activity * b.rate - a.activity * a.rate)[0];
      if (shower) {
        const [key, english] = SHOWER_NAMES[shower.name];
        const name = this.text(key, english);
        lines.push(this.text("background.showerTonight", `Tonight: ${name}`, { shower: name }));
      }
      sceneNote.textContent = lines.join(" ");
    }

    // The whole panel after the sky changed, here or anywhere else; the gallery shows the chosen sky's kind.
    sync() {
      if (!Skies()) return;
      this.kind = this.sky().category;
      this.paint();
      this.showRelevant();
      this.sayScene();
      this.paintComposer();
      this.paintLooks();
      this.paintPlace();
      this.paintRhythm();
    }

    // ── The layers of a composed sky ────────────────────────────────
    buildComposer() {
      const rows = document.getElementById("bg-layers");
      const bodies = document.getElementById("bg-bodies");
      const { COMPOSE, SHUFFLE } = Skies();
      for (const [layer, options] of Object.entries(COMPOSE.choices)) {
        const row = document.createElement("div");
        row.className = "row setting-row sky-layer";
        const label = document.createElement("span");
        label.id = `bg-layer-${layer}-label`;
        label.dataset.i18n = `layer.${layer}`;
        label.textContent = this.word(`layer.${layer}`);
        const pick = document.createElement("span");
        pick.className = "sky-layer-pick";
        const select = document.createElement("select");
        select.className = "ipt";
        select.dataset.layer = layer;
        select.setAttribute("aria-labelledby", label.id);
        for (const value of options) {
          const option = new Option(this.word(`layer.${layer}.${value}`), value);
          option.dataset.i18n = `layer.${layer}.${value}`;
          select.append(option);
        }
        select.addEventListener("change", () => this.setLayer(layer, select.value));
        pick.append(select);
        // A layer a shuffle chooses can be kept as it is: a padlock, shut when kept.
        if (SHUFFLE[layer]) {
          const lock = document.createElement("button");
          lock.type = "button";
          lock.className = "sky-lock";
          lock.dataset.lock = layer;
          lock.dataset.i18nAria = `layer.${layer}.keep`;
          lock.setAttribute("aria-label", this.word(`layer.${layer}.keep`));
          lock.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path class="sky-lock-shackle" d="M5 7V5a3 3 0 0 1 6 0v2"/><rect x="3.5" y="7" width="9" height="7" rx="1.5"/></svg>';
          lock.addEventListener("click", () => this.toggleLock(layer));
          pick.append(lock);
        }
        row.append(label, pick);
        rows?.append(row);
      }
      for (const body of COMPOSE.bodies) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "palette-chip sky-body";
        chip.dataset.body = body;
        chip.dataset.i18n = `layer.${body}`;
        chip.textContent = this.word(`layer.${body}`);
        chip.addEventListener("click", () => this.setLayer(body, chip.getAttribute("aria-pressed") !== "true"));
        bodies?.append(chip);
      }
    }

    paintComposer() {
      if (!this.sky().layers) return;
      const layers = this.layers();
      const locks = this.config().skyLocks || [];
      for (const select of document.querySelectorAll("#bg-layers select[data-layer]")) select.value = layers[select.dataset.layer];
      for (const lock of document.querySelectorAll("#bg-layers [data-lock]")) lock.setAttribute("aria-pressed", String(locks.includes(lock.dataset.lock)));
      for (const chip of document.querySelectorAll("#bg-bodies [data-body]")) chip.setAttribute("aria-pressed", String(layers[chip.dataset.body] !== false));
      window.NordlysUI?.refreshSelects?.();
    }

    // Only what differs from the sky as it comes is kept; nothing different, nothing kept.
    keepLayers(layers) {
      const base = this.base();
      const own = Object.fromEntries(Object.entries(layers).filter(([layer, value]) => base[layer] !== value));
      if (Object.keys(own).length) this.config().skyLayers = own;
      else delete this.config().skyLayers;
    }

    setLayer(layer, value) {
      this.keepLayers({ ...this.layers(), [layer]: value });
      this.commit();
    }

    toggleLock(layer) {
      const locks = new Set(this.config().skyLocks || []);
      if (locks.has(layer)) locks.delete(layer); else locks.add(layer);
      this.config().skyLocks = [...locks];
      this.app.saveConfig();
      this.paintComposer();
    }

    /* A composed sky shuffles the layers not kept; any other sky gets a new
       scatter of itself. Either is one undo away from the last. */
    shuffle() {
      const config = this.config();
      const say = (key, english) => this.text(key, english);
      if (this.sky().layers) {
        const before = config.skyLayers ? { ...config.skyLayers } : null;
        this.keepLayers(Skies().shuffle(this.layers(), config.skyLocks || []));
        this.commit();
        window.NordlysUI?.showUndoToast?.({
          message: say("background.shuffled", "A new sky"),
          onAction: () => {
            if (before) config.skyLayers = before; else delete config.skyLayers;
            this.commit();
            window.NordlysUI?.announce?.(say("background.unshuffled", "The previous sky is back"));
          }
        });
        return;
      }
      const previous = config.bgSeed ?? 0;
      const sow = (seed) => {
        config.bgSeed = seed;
        this.app.bgEngine?.setSeed(seed);
        this.app.saveConfig();
      };
      sow(crypto.getRandomValues(new Uint32Array(1))[0] || 1);
      window.NordlysUI?.showUndoToast?.({
        message: say("background.shuffled", "A new sky"),
        onAction: () => {
          sow(previous);
          window.NordlysUI?.announce?.(say("background.unshuffled", "The previous sky is back"));
        }
      });
    }

    // ── Saved skies ─────────────────────────────────────────────────
    looks() { return Array.isArray(this.config().looks) ? this.config().looks : []; }
    lookNow() {
      const look = { bgMode: this.select.value };
      if (this.config().skyLayers) look.skyLayers = { ...this.config().skyLayers };
      return look;
    }
    // The sky's name and what was changed in it: "Mountains · Snow · Poster".
    lookName(look) {
      const sky = Skies().get(look.bgMode);
      // A body is named when it was added, not when it was taken away.
      const words = Object.entries(look.skyLayers || {}).map(([layer, value]) => (typeof value === "string"
        ? this.word(`layer.${layer}.${value}`) : value ? this.word(`layer.${layer}`) : null)).filter(Boolean);
      return [this.text(sky.key, sky.name), ...words.slice(0, 2)].join(" · ");
    }

    saveLook() {
      const look = this.lookNow();
      const same = this.looks().find((entry) => JSON.stringify(entry.look) === JSON.stringify(look));
      if (same) { window.NordlysUI?.announce?.(this.text("background.lookKept", `${same.name} is saved already`, { name: same.name })); return; }
      if (this.looks().length >= LOOK_LIMIT) {
        if (typeof toast === "function") toast(this.text("background.lookLimit", `You can keep ${LOOK_LIMIT} skies. Remove one to save another.`, { count: LOOK_LIMIT }), "info");
        return;
      }
      const entry = { id: `look_${Date.now().toString(36)}`, name: this.lookName(look), look };
      this.config().looks = [...this.looks(), entry];
      this.app.saveConfig();
      this.paintLooks();
      window.NordlysUI?.announce?.(this.text("background.lookSaved", `${entry.name} saved`, { name: entry.name }));
    }

    paintLooks() {
      const block = document.getElementById("bg-looks-block");
      const list = document.getElementById("bg-looks");
      if (!block || !list) return;
      const now = JSON.stringify(this.lookNow());
      block.hidden = !this.looks().length;
      list.replaceChildren(...this.looks().map((entry) => {
        const wear = document.createElement("button");
        wear.type = "button";
        wear.className = "palette-chip sky-look";
        wear.textContent = entry.name;
        wear.setAttribute("aria-pressed", String(JSON.stringify(entry.look) === now));
        wear.addEventListener("click", () => {
          const config = this.config();
          config.bgMode = entry.look.bgMode;
          if (entry.look.skyLayers) config.skyLayers = { ...entry.look.skyLayers }; else delete config.skyLayers;
          this.commit();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "sky-look-remove";
        remove.textContent = "×";
        remove.setAttribute("aria-label", this.text("background.lookRemove", `Remove ${entry.name}`, { name: entry.name }));
        remove.addEventListener("click", () => {
          const before = this.looks();
          this.config().looks = before.filter((other) => other !== entry);
          this.app.saveConfig();
          this.paintLooks();
          window.NordlysUI?.showUndoToast?.({
            message: this.text("background.lookRemoved", `${entry.name} removed`, { name: entry.name }),
            onAction: () => { this.config().looks = before; this.app.saveConfig(); this.paintLooks(); }
          });
        });
        const pair = document.createElement("span");
        pair.className = "sky-look-pair";
        pair.append(wear, remove);
        return pair;
      }));
    }

    // ── Where the sky is ────────────────────────────────────────────
    paintPlace() {
      const name = document.getElementById("bg-place-name");
      if (!name || !window.NordlysSkyData) return;
      const own = this.config().skyPlace;
      const place = window.NordlysSkyData.placeOf(this.config());
      name.textContent = own ? own.name || `${own.lat}, ${own.lon}`
        : this.text("background.placeZoneNow", `From your time zone: ${place.name}`, { name: place.name });
    }

    setPlace(place) {
      if (place) this.config().skyPlace = place; else delete this.config().skyPlace;
      this.app.saveConfig();
      this.app.applyNightMode?.({ redraw: false });
      this.app.updateBackgroundMode();
      this.paintPlace();
      this.closePlaceSearch();
      document.getElementById("bg-place-change")?.focus();
    }

    closePlaceSearch() {
      const search = document.getElementById("bg-place-search");
      if (search) search.hidden = true;
      document.getElementById("bg-place-change")?.setAttribute("aria-expanded", "false");
      this.placeAsk?.abort();
    }

    /* The place search asks Open-Meteo with what was typed, a moment after
       the typing stops, and keeps only the place chosen. */
    findPlace(typed) {
      const results = document.getElementById("bg-place-results");
      clearTimeout(this.placeTimer);
      this.placeAsk?.abort();
      if (!results) return;
      if (typed.trim().length < 2) { results.replaceChildren(); return; }
      this.placeTimer = setTimeout(async () => {
        const control = (this.placeAsk = new AbortController());
        const say = (key, english) => { const line = document.createElement("p"); line.className = "daylight-note"; line.textContent = this.text(key, english); return line; };
        try {
          const answer = await fetch(window.NordlysWidgetKit.weather.searchUrl(typed.trim(), window.I18N?.currentLang || "en"), { signal: control.signal }).then((reply) => {
            if (!reply.ok) throw new Error(`HTTP ${reply.status}`);
            return reply.json();
          });
          const found = (answer.results || []).filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
          results.replaceChildren(...(found.length ? found.map((r) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "palette-action sky-place-result";
            button.textContent = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
            button.addEventListener("click", () => this.setPlace({
              name: [r.name, r.country].filter(Boolean).join(", ").slice(0, 80),
              lat: Math.round(r.latitude * 1000) / 1000,
              lon: Math.round(r.longitude * 1000) / 1000
            }));
            return button;
          }) : [say("background.placeNone", "No place by that name.")]));
        } catch (error) {
          if (error.name !== "AbortError") results.replaceChildren(say("background.placeOffline", "The place search could not be reached."));
        }
      }, 350);
    }

    // ── Working hours, the rotation, the night light, picture colours ──
    paintRhythm() {
      const config = this.config();
      const workday = config.workday || {};
      const start = document.getElementById("cfg-workday-start");
      const end = document.getElementById("cfg-workday-end");
      if (start) start.value = hhmm(Number.isFinite(workday.start) ? workday.start : 9);
      if (end) end.value = hhmm(Number.isFinite(workday.end) ? workday.end : 18);
      const rotate = document.getElementById("cfg-sky-rotate");
      const pool = document.getElementById("cfg-sky-pool");
      if (rotate) rotate.value = config.skyRotate || "off";
      if (pool) pool.value = config.skyPool || "layers";
      const poolRow = document.getElementById("bg-pool-row");
      if (poolRow) poolRow.hidden = !config.skyRotate || config.skyRotate === "off";
      const night = document.getElementById("cfg-night-mode");
      if (night) night.value = config.nightMode || "off";
      const colours = document.getElementById("cfg-picture-colours");
      if (colours) colours.checked = config.pictureColours === true;
      window.NordlysUI?.refreshSelects?.();
    }

    wire() {
      // A sky chosen is chosen as it comes: the layers changed on another are not carried over.
      this.select.addEventListener("change", () => { delete this.config().skyLayers; });
      document.getElementById("bg-shuffle")?.addEventListener("click", () => this.shuffle());
      document.getElementById("bg-look-save")?.addEventListener("click", () => this.saveLook());

      const change = document.getElementById("bg-place-change");
      const search = document.getElementById("bg-place-search");
      const input = document.getElementById("bg-place-input");
      change?.addEventListener("click", () => {
        if (!search) return;
        if (!search.hidden) { this.closePlaceSearch(); return; }
        search.hidden = false;
        change.setAttribute("aria-expanded", "true");
        input?.focus();
      });
      input?.addEventListener("input", () => this.findPlace(input.value));
      search?.addEventListener("keydown", (event) => {
        // The drawer closes on Escape too, and the search is the nearer layer.
        if (event.key !== "Escape") return;
        event.stopPropagation();
        this.closePlaceSearch();
        change?.focus();
      });
      document.getElementById("bg-place-zone")?.addEventListener("click", () => this.setPlace(null));

      const start = document.getElementById("cfg-workday-start");
      const end = document.getElementById("cfg-workday-end");
      const setWorkday = () => {
        const from = hoursOf(start?.value), to = hoursOf(end?.value);
        if (!(from >= 0 && to <= 24 && from < to)) return;
        this.config().workday = { start: from, end: to };
        this.app.saveConfig();
        this.app.tellSkyTheWorld?.();
      };
      start?.addEventListener("change", setWorkday);
      end?.addEventListener("change", setWorkday);

      const rotate = document.getElementById("cfg-sky-rotate");
      const pool = document.getElementById("cfg-sky-pool");
      const setRotation = () => {
        this.config().skyRotate = rotate?.value || "off";
        this.config().skyPool = pool?.value || "layers";
        this.app.saveConfig();
        this.app.rotateSky?.();
        this.app.updateBackgroundMode();
        this.paintRhythm();
      };
      rotate?.addEventListener("change", setRotation);
      pool?.addEventListener("change", setRotation);

      document.getElementById("cfg-night-mode")?.addEventListener("change", (event) => {
        this.config().nightMode = event.target.value;
        this.app.saveConfig();
        this.app.applyNightMode?.();
      });
      document.getElementById("cfg-picture-colours")?.addEventListener("change", (event) => {
        this.config().pictureColours = event.target.checked;
        this.app.saveConfig();
        this.app.applyPictureColours?.();
      });

      window.addEventListener("nordlys:languagechange", () => {
        this.sayScene();
        this.paint();
        this.paintPlace();
      });
    }
  }

  window.NordlysSkySettings = NordlysSkySettings;
})();
