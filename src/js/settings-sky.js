/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - CHOOSING THE SKY (Settings → Background)
   ═══════════════════════════════════════════════════════════════════

   The kinds of sky and the gallery of each, where the sky is, the skies
   someone saved, the rotation, the night light, the colours of a photograph
   and the colours from a picture. All of it is built from the catalogue
   (sky-catalog.js): a sky added there arrives here with its card, its name
   and the controls that belong to it. The colour moods, the time of day and
   the sliders are settings.js's. */
(function () {
  "use strict";

  const Skies = () => window.NordlysSkies;
  // As many as the colour moods: a row of chips that is still a row.
  const LOOK_LIMIT = 12;

  /* A control that belongs to some skies only says which with
     data-scene-only; each name is a question asked of the sky's entry, and
     of the person's config where the answer depends on it. */
  const toned = (sky, config) => Boolean(sky.toned) && config.photoTone !== false;
  const BELONGS = {
    procedural: (sky) => sky.kind === "canvas",
    nordlys: (sky) => sky.category === "nordlys",
    // The colour moods colour a drawn sky, and a photograph in the mood's colours.
    moody: (sky, config) => sky.kind === "canvas" || toned(sky, config),
    toned: (sky) => Boolean(sky.toned),
    place: (sky) => Boolean(sky.place),
    // Another scatter of a drawn sky, another photograph of a subject.
    shufflable: (sky) => sky.kind === "canvas" || Boolean(sky.toned),
    upload: (sky) => sky.kind === "media",
    media: (sky) => sky.kind === "media" || sky.kind === "picture",
    image: (sky) => sky.id === "custom-image" || sky.kind === "picture",
    // A picture in its own colours, whose pixels the page may read.
    readable: (sky, config) => (sky.id === "custom-image" || Boolean(sky.readable)) && !toned(sky, config),
    // A sky a rotation can come back to: not a wallpaper, not a plain colour.
    savable: (sky) => sky.kind === "canvas" || sky.kind === "picture"
  };

  /* What a sky drawn from the world says under the gallery: what it shows and
     where that comes from. Spelled out so every key can be found by searching. */
  const NOTES = {
    starmap: ["scene.starmapNote", "The bright stars and their constellations as they stand in your sky right now."],
    meteors: ["scene.meteorsNote", "A calm night sky with a shooting star now and then, and more on the nights of the big meteor showers."],
    blackhole: ["scene.blackholeNote", "Light bent as a black hole bends it: its shadow, the thin ring of light that went round it, and a disk brighter on the side coming towards you."],
    "picture-wikimedia": ["scene.pictureWikimediaNote", "Wikimedia Commons' picture of the day, with its caption."],
    "picture-paintings": ["scene.picturePaintingsNote", "A painting from the featured pictures on Wikimedia Commons, a different one each day."],
    "picture-met": ["scene.pictureMetNote", "A painting from the Met's highlights, a different one each day."],
    "picture-earth": ["scene.pictureEarthNote", "The Earth from a million miles out, as NASA's EPIC camera saw it on its latest day."]
  };
  const KIND_NOTES = {
    nordlys: ["sky.cat.nordlysNote", "Skies of the north, drawn on this computer. Nothing is sent anywhere."],
    photos: ["sky.cat.photosNote", "Photographs the Wikimedia Commons community chose as its finest, a new one each day, in the colours of your mood. Only the date and the subject are sent, and only while one of these is the sky."],
    world: ["sky.cat.worldNote", "A new picture every day. Only the date and your language are sent, and only while one of these is the sky."],
    yours: ["sky.cat.yoursNote", "Your own picture or video, kept on this computer, or a plain colour."]
  };
  const SHOWER_NAMES = {
    quadrantids: ["shower.quadrantids", "the Quadrantids"], lyrids: ["shower.lyrids", "the Lyrids"],
    etaAquariids: ["shower.etaAquariids", "the Eta Aquariids"], perseids: ["shower.perseids", "the Perseids"],
    orionids: ["shower.orionids", "the Orionids"], leonids: ["shower.leonids", "the Leonids"], geminids: ["shower.geminids", "the Geminids"]
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
      this.wire();
    }

    text(key, fallback, params) {
      const value = window.I18N?.t(key, params || {});
      return value && value !== key ? value : fallback;
    }
    config() { return this.app.config; }
    sky() { return Skies().get(this.select.value) || Skies().get("aurora"); }
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
       on screen, from the browser's cache, toned as the sky would be; one
       never shown has nothing to show and asks for nothing. */
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
      image.classList.toggle("is-toned", toned(sky, this.config()));
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
        node.hidden = !BELONGS[node.dataset.sceneOnly]?.(sky, this.config());
      }
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
      this.paintLooks();
      this.paintPlace();
      this.paintRhythm();
    }

    /* A drawn sky gets a new scatter of itself, a photograph is another of
       its subject: both are a new seed, one undo away from the last. */
    shuffle() {
      const config = this.config();
      const say = (key, english) => this.text(key, english);
      const previous = config.bgSeed ?? 0;
      const sow = (seed) => {
        config.bgSeed = seed;
        this.commit();
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
    /* A drawn sky is saved with its scatter, so the one that was shuffled
       for comes back as it was; a photograph is saved as its subject. */
    looks() { return Array.isArray(this.config().looks) ? this.config().looks : []; }
    lookNow() {
      const look = { bgMode: this.select.value };
      if (this.sky().kind === "canvas") look.bgSeed = this.config().bgSeed ?? 0;
      return look;
    }

    saveLook() {
      const look = this.lookNow();
      const same = this.looks().find((entry) => JSON.stringify(entry.look) === JSON.stringify(look));
      if (same) { window.NordlysUI?.announce?.(this.text("background.lookKept", `${same.name} is saved already`, { name: same.name })); return; }
      if (this.looks().length >= LOOK_LIMIT) {
        if (typeof toast === "function") toast(this.text("background.lookLimit", `You can keep ${LOOK_LIMIT} skies. Remove one to save another.`, { count: LOOK_LIMIT }), "info");
        return;
      }
      // The same sky saved again, shuffled another way, is told apart by a number.
      const sky = this.sky();
      const before = this.looks().filter((entry) => entry.look?.bgMode === look.bgMode).length;
      const name = `${this.text(sky.key, sky.name)}${before ? ` ${before + 1}` : ""}`;
      const entry = { id: `look_${Date.now().toString(36)}`, name, look };
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
          if (Number.isInteger(entry.look.bgSeed)) config.bgSeed = entry.look.bgSeed;
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
      if (!name || !window.NordlysSky?.placeOf) return;
      const own = this.config().skyPlace;
      const place = window.NordlysSky.placeOf(this.config());
      name.textContent = own ? own.name || `${own.lat}, ${own.lon}`
        : this.text("background.placeZoneNow", `From your time zone: ${place.name}`, { name: place.name });
    }

    setPlace(place) {
      if (place) this.config().skyPlace = place; else delete this.config().skyPlace;
      this.app.saveConfig();
      this.app.applyNightMode?.({ redraw: false });
      this.app.tellSkyTheWorld?.();
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

    // ── The rotation, the night light, a photograph's colours ───────
    paintRhythm() {
      const config = this.config();
      const rotate = document.getElementById("cfg-sky-rotate");
      const pool = document.getElementById("cfg-sky-pool");
      if (rotate) rotate.value = config.skyRotate || "off";
      if (pool) pool.value = config.skyPool || "this";
      const poolRow = document.getElementById("bg-pool-row");
      if (poolRow) poolRow.hidden = !config.skyRotate || config.skyRotate === "off";
      const night = document.getElementById("cfg-night-mode");
      if (night) night.value = config.nightMode || "off";
      const tone = document.getElementById("cfg-photo-tone");
      if (tone) tone.checked = config.photoTone !== false;
      const colours = document.getElementById("cfg-picture-colours");
      if (colours) colours.checked = config.pictureColours === true;
      window.NordlysUI?.refreshSelects?.();
    }

    wire() {
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

      const rotate = document.getElementById("cfg-sky-rotate");
      const pool = document.getElementById("cfg-sky-pool");
      const setRotation = () => {
        this.config().skyRotate = rotate?.value || "off";
        this.config().skyPool = pool?.value || "this";
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
      // A photograph in its own colours has its own colours to give the accent, and no mood.
      document.getElementById("cfg-photo-tone")?.addEventListener("change", (event) => {
        this.config().photoTone = event.target.checked;
        this.commit();
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
