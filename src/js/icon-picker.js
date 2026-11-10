/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE ICON DIALOG
   ═══════════════════════════════════════════════════════════════════

   One field. A name or a link goes in, icon-discovery.js looks for the
   mark, and the best one is put on the tile at once; the others it found
   sit in a row underneath, with the icon the tile had before, so a wrong
   guess is one click to change. Adjust moves and scales the picture on
   the tile's own shape. A file, or plain letters, are the two ways in
   that need no search. */
(function () {
  "use strict";

  const ICON_FIELDS = ["customImg", "iconSource", "icon", "monogram", "iconUrl"];
  const FILE_LIMIT = 5 * 1024 * 1024;
  const EXPORT = 384;

  const say = (key, fallback, params) => {
    const value = window.I18N?.t(key, params);
    return value && value !== key ? value : fallback;
  };
  const loadImage = async (src) => { const image = new Image(); image.src = src; await image.decode(); return image; };
  const webp = (canvas) => { const out = canvas.toDataURL("image/webp", 0.92); return out.startsWith("data:image/webp") ? out : canvas.toDataURL("image/png"); };

  class NordlysIconPicker {
    constructor({ dialogRoot, target, changed, closed }) {
      this.root = dialogRoot; this.target = target; this.changed = changed;
      this.held = new Set();
      const $ = (id) => dialogRoot.querySelector(`#${id}`);
      this.el = {
        title: $("icon-picker-title"), find: $("icon-view-find"), adjust: $("icon-view-adjust"), preview: $("icon-live-preview"),
        form: $("icon-find-form"), field: $("icon-find"), button: $("icon-find-btn"), status: $("icon-find-status"), site: $("icon-find-site"),
        choices: $("icon-choices"), adjustBtn: $("icon-adjust"), file: $("icon-file-input"), fileBtn: $("icon-file-btn"), letters: $("icon-letters"),
        box: $("icon-adjust-box"), canvas: $("icon-adjust-canvas"), zoom: $("icon-adjust-zoom"), fit: $("icon-adjust-fit"), fill: $("icon-adjust-fill"),
        back: $("icon-adjust-back"), done: $("icon-adjust-done")
      };
      dialogRoot.setAttribute("aria-labelledby", "icon-picker-title");
      this.dialog = new NordlysUI.DialogController(dialogRoot, { closeOnBackdrop: true, onClose: () => { this.stop(); closed?.(); } });
      $("modal-x")?.addEventListener("click", () => this.close());

      this.el.form.addEventListener("submit", (event) => { event.preventDefault(); this.search(this.el.field.value); });
      this.el.site.addEventListener("click", () => this.search(this.el.site.dataset.url));
      this.el.field.addEventListener("input", () => this.forewarn());
      this.el.choices.addEventListener("click", (event) => { const at = event.target.closest("button")?.dataset.at; if (at !== undefined) this.apply(this.shown[Number(at)]); });
      this.el.choices.addEventListener("keydown", (event) => this.walkChoices(event));
      this.el.fileBtn.addEventListener("click", () => this.el.file.click());
      this.el.file.addEventListener("change", () => { this.takeFile(this.el.file.files?.[0]); this.el.file.value = ""; });
      this.el.letters.addEventListener("click", () => this.useLetters());
      this.el.adjustBtn.addEventListener("click", () => this.openAdjust());
      // A picture pasted into the field, or dropped anywhere on the dialog, is a file like any other.
      this.el.field.addEventListener("paste", (event) => { const file = [...(event.clipboardData?.files || [])].find(item => item.type.startsWith("image/")); if (file) { event.preventDefault(); this.takeFile(file); } });
      dialogRoot.addEventListener("dragover", (event) => { if (event.dataTransfer?.types?.includes("Files")) event.preventDefault(); });
      dialogRoot.addEventListener("drop", (event) => { const file = event.dataTransfer?.files?.[0]; if (file) { event.preventDefault(); this.takeFile(file); } });
      this.initAdjust();
    }

    /* ── Opening and closing ─────────────────────────────────────── */

    open(link, opener) {
      this.stop();
      this.before = Object.fromEntries(ICON_FIELDS.filter(field => link[field] !== undefined).map(field => [field, link[field]]));
      this.shown = []; this.current = null; this.source = null;
      const name = link.name || "Bookmark";
      this.el.title.textContent = say("picker.titleFor", `Icon for “${name}”`, { name });
      this.el.field.value = link.name || "";
      this.say("");
      this.el.site.hidden = true;
      this.el.choices.hidden = true; this.el.choices.replaceChildren();
      this.show("find");
      this.paint();
      this.dialog.open(opener, this.el.field);
      const own = window.NordlysIconDiscovery.parseQuery(/^https?:\/\//i.test(link.url || "") ? link.url : "");
      this.hold(window.NordlysIconDiscovery.originsFor(own));
      queueMicrotask(() => this.el.field.select());
    }

    close() { this.dialog.close(); }

    stop() { this.searching?.abort(); this.searching = null; this.el.button.removeAttribute("aria-busy"); }

    show(view) {
      this.el.find.hidden = view !== "find";
      this.el.adjust.hidden = view !== "adjust";
    }

    say(text) { this.el.status.textContent = text; this.el.status.hidden = !text; }

    /* The tile as it is now, on the tile's own plate. */
    paint() {
      const link = this.target();
      if (!link) return;
      const box = this.el.preview.querySelector(".box"), label = this.el.preview.querySelector(".lbl");
      label.textContent = link.name || "";
      const metadata = resolveIcon(link.url, link.icon) || {};
      const presentation = NordlysIcons.resolvePresentation({ source: link, metadata, isLight: document.documentElement.classList.contains("light-ui") });
      box.replaceChildren(NordlysIcons.renderIcon(presentation));
      box.style.setProperty("--c", link.color || "var(--nl-accent)");
      NordlysIcons.applyIconContrast(box);
      this.el.adjustBtn.disabled = !link.customImg;
      for (const button of this.el.choices.querySelectorAll("button")) {
        const chosen = this.shown[Number(button.dataset.at)] === this.current;
        button.setAttribute("aria-checked", String(chosen)); button.tabIndex = chosen ? 0 : -1;
      }
      if (this.shown.length && !this.el.choices.querySelector('[tabindex="0"]')) this.el.choices.querySelector("button").tabIndex = 0;
    }

    /* ── Finding ─────────────────────────────────────────────────── */

    /* Leave to read a site is asked in the same turn as the press, which is
       the only moment a browser will show the question; already given, it
       answers at once with no question shown. */
    access(origins) {
      const permissions = typeof chrome !== "undefined" ? chrome.permissions : null;
      if (!origins.length || !permissions?.request) return Promise.resolve(true);
      return new Promise((resolve) => {
        try { permissions.request({ origins }, (granted) => { void chrome.runtime?.lastError; resolve(Boolean(granted)); }); }
        catch { resolve(false); }
      });
    }

    /* A link in the field means a site will be read. When the browser has not
       yet given leave for it, one sentence says the question is coming. */
    forewarn() {
      const finder = window.NordlysIconDiscovery;
      const query = finder.parseQuery(this.el.field.value);
      const origins = query.kind === "site" ? finder.originsFor(query) : [];
      const permissions = typeof chrome !== "undefined" ? chrome.permissions : null;
      this.el.site.hidden = true;
      if (!origins.length || !permissions?.contains) { this.say(""); return; }
      const typed = this.el.field.value;
      try {
        permissions.contains({ origins }, (held) => {
          void chrome.runtime?.lastError;
          if (this.el.field.value !== typed || this.searching) return;
          this.say(held ? "" : say("picker.willAsk", "To look on {host}, your browser will ask to let Nordlys read it.", { host: (query.host || "").replace(/^www\./, "") }));
        });
      } catch { this.say(""); }
    }

    async search(text) {
      const finder = window.NordlysIconDiscovery;
      const query = finder.parseQuery(text);
      if (query.kind === "empty") { this.el.field.focus(); return; }
      const link = this.target();
      // The bookmark's own site is a second place to look for a name.
      const own = finder.parseQuery(/^https?:\/\//i.test(link?.url || "") ? link.url : "");
      const page = query.kind === "name" && own.kind === "site" ? own.url : "";
      const host = own.kind === "site" ? own.host : "";
      const origins = finder.originsFor(page ? own : query);
      /* A site typed into the field is asked about now, while the press still
         counts. A picture is asked about only if its host will not hand it
         over, and the bookmark's own site only if the catalogues had nothing
         good — unless leave for it was given before, when it is read at once. */
      const lazy = query.kind === "image" || (page && !this.held.has(origins[0]));
      const access = lazy ? () => this.access(origins) : query.kind === "site" ? this.access(origins) : true;
      this.stop();
      const controller = this.searching = new AbortController();
      this.el.button.setAttribute("aria-busy", "true");
      this.el.site.hidden = true;
      this.say(say("picker.looking", "Looking…"));
      /* The first good icon is put on the tile the moment it arrives. After
         that the tile is left alone: what comes later joins the row. */
      let applied = null;
      const progress = (choices) => {
        if (this.searching !== controller || !choices.length) return;
        if (!applied && choices[0].score < finder.GOOD) return;
        const first = !applied;
        if (first) applied = choices[0];
        // What the person picked from the row meanwhile stays picked.
        const pinned = !first && this.current?.src ? this.current : applied;
        this.offer(choices, pinned);
        if (first) this.apply(this.shown.find(choice => choice.src === applied.src)); else this.paint();
      };
      let result;
      try { result = await finder.find(text, { access, signal: controller.signal, host, page, ground: this.ground(), onProgress: progress }); }
      catch { result = { query, choices: [], offline: false }; }
      if (this.searching !== controller) return;
      this.stop();
      if (lazy && !result.declined && origins[0]) this.hold(origins);
      if (!result.choices.length) {
        this.say(result.offline ? say("picker.offline", "No connection. The icon stays as it is.")
          : result.declined ? say("picker.declined", "Without leave to read {host}, Nordlys cannot look there.", { host: query.host || "" })
          : say("picker.nothing", "Nothing found for “{text}”.", { text: String(text).trim().slice(0, 60) }));
        // A name that no catalogue knows: the bookmark's own site is the next place to look.
        if (query.kind === "name" && host && /^https?:/i.test(link.url)) {
          this.el.site.dataset.url = link.url;
          this.el.site.textContent = say("picker.lookOnSite", "Look on {host}", { host: host.replace(/^www\./, "") });
          this.el.site.hidden = false;
        }
        return;
      }
      this.say(result.declined ? say("picker.declinedSome", "Not from {host} itself: Nordlys was not given leave to read it.", { host: query.host || "" }) : "");
      this.offer(result.choices, applied && this.current?.src ? this.current : applied);
      if (!applied) await this.apply(this.shown[0]); else this.paint();
    }

    /* How light the tile is that the icon is going to: what cannot be seen on it does not come first. */
    ground() {
      try { return NordlysIcons.plateLuminance(this.el.preview.querySelector(".box")); } catch { return undefined; }
    }

    /* Which sites the browser already lets Nordlys read, learnt before the
       press: asking the browser takes a moment the press does not have. */
    hold(origins) {
      const permissions = typeof chrome !== "undefined" ? chrome.permissions : null;
      if (!origins.length || !permissions?.contains) return;
      try { permissions.contains({ origins }, (held) => { void chrome.runtime?.lastError; if (held) this.held.add(origins[0]); else this.held.delete(origins[0]); }); } catch { /* not held */ }
    }

    /* The row under the field: what was found, then the icon from before.
       The one already on the tile keeps its place in the row's selection
       when better-ranked ones arrive after it. */
    offer(choices, pinned = null) {
      const kept = pinned && !choices.some(choice => choice.src === pinned.src) ? [pinned, ...choices].slice(0, Math.max(1, choices.length)) : choices;
      this.shown = [...kept, { before: true }];
      if (pinned) this.current = this.shown.find(choice => choice.src === pinned.src) || this.current;
      this.el.choices.replaceChildren(...this.shown.map((choice, at) => {
        const button = document.createElement("button");
        button.type = "button"; button.className = "icon-choice"; button.dataset.at = String(at);
        button.setAttribute("role", "radio"); button.setAttribute("aria-checked", "false"); button.tabIndex = -1;
        if (choice.before) {
          const label = say("picker.before", "The icon from before");
          button.title = label; button.setAttribute("aria-label", label); button.classList.add("is-before");
          const was = { ...this.target(), ...Object.fromEntries(ICON_FIELDS.map(field => [field, this.before[field]])) };
          const presentation = NordlysIcons.resolvePresentation({ source: was, metadata: resolveIcon(was.url, was.icon) || {}, isLight: document.documentElement.classList.contains("light-ui") });
          button.append(NordlysIcons.renderIcon(presentation));
        } else {
          button.title = choice.label || ""; button.setAttribute("aria-label", say("picker.choiceFrom", "Icon from {source}", { source: choice.label || "" }));
          const image = document.createElement("img"); image.src = choice.src; image.alt = ""; image.draggable = false;
          const wrap = document.createElement("span"); wrap.className = "nl-icon"; wrap.dataset.iconKind = "raster"; wrap.append(image);
          button.append(wrap);
        }
        return button;
      }));
      this.el.choices.hidden = false;
      // Single-colour marks are toned against the row, as they are on a tile.
      for (const button of this.el.choices.querySelectorAll("button")) NordlysIcons.applyIconContrast(button);
    }

    walkChoices(event) {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const buttons = [...this.el.choices.querySelectorAll("button")];
      const next = buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length];
      next.focus(); this.apply(this.shown[Number(next.dataset.at)]);
    }

    /* ── Putting an icon on the bookmark ─────────────────────────── */

    /* The picture as it is kept: its clear margins cut away so the mark fills
       the tile, a vector left a vector when it already does, a raster held
       to the size a tile can show. */
    async stored(choice) {
      const { x = 0, y = 0, w = 1, h = 1 } = choice.bounds || {};
      const vector = /^data:image\/svg\+xml/i.test(choice.src);
      const tight = w > 0.86 || h > 0.86;
      if (vector && tight && choice.src.length <= 150000) return choice.src;
      const image = await loadImage(choice.src);
      const width = image.naturalWidth || 256, height = image.naturalHeight || 256;
      if (!vector && tight && Math.max(width, height) <= EXPORT && choice.src.length < 200000) return choice.src;
      const region = tight ? { x: 0, y: 0, w: 1, h: 1 } : { x, y, w, h };
      const longest = Math.max(region.w * width, region.h * height);
      const side = vector ? EXPORT : Math.max(1, Math.min(EXPORT, Math.round(longest)));
      const scale = side / longest;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = side;
      const pen = canvas.getContext("2d");
      pen.imageSmoothingQuality = "high";
      const drawnWidth = width * scale, drawnHeight = height * scale;
      pen.drawImage(image, (side - region.w * drawnWidth) / 2 - region.x * drawnWidth, (side - region.h * drawnHeight) / 2 - region.y * drawnHeight, drawnWidth, drawnHeight);
      return webp(canvas);
    }

    async apply(choice) {
      const link = this.target();
      if (!link || !choice) return;
      const addresses = window.NordlysIconHistory;
      if (choice.before) {
        for (const field of ICON_FIELDS) { if (this.before[field] === undefined) delete link[field]; else link[field] = this.before[field]; }
        this.source = null;
      } else if (choice.letters) {
        for (const field of ["customImg", "iconSource", "icon"]) delete link[field];
        link.monogram = choice.letters;
        addresses?.leave(link);
        this.source = null;
      } else {
        let kept;
        try { kept = await this.stored(choice); } catch { this.say(say("picker.unreadable", "That picture could not be read.")); return; }
        link.customImg = kept;
        link.iconSource = String(choice.id || choice.from || "").slice(0, 120);
        delete link.icon; delete link.monogram;
        if (choice.address && addresses?.isAddress(choice.address)) addresses.remember(link, choice.address); else addresses?.leave(link);
        // Adjust starts from the picture as it was found, not from the trimmed copy.
        this.source = choice.src;
      }
      this.current = choice;
      this.changed();
      this.paint();
    }

    async takeFile(file) {
      if (!file) return;
      if (!file.type.startsWith("image/")) { this.say(say("modal.fileNotImage", "That file is not an image")); return; }
      if (file.size > FILE_LIMIT) { this.say(say("modal.fileTooLarge", "That file is over 5 MB")); return; }
      const src = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => resolve(""); reader.readAsDataURL(file); });
      let measured;
      try { measured = await window.NordlysIconDiscovery.measure(src); } catch { this.say(say("picker.unreadable", "That picture could not be read.")); return; }
      this.say("");
      await this.apply({ id: "file", from: "address", src, ...measured });
    }

    /* Letters: what is in the field when it is one to three characters,
       otherwise the first letter of the bookmark's name. */
    useLetters() {
      const typed = this.el.field.value.trim();
      const link = this.target();
      const letters = (typed.length >= 1 && typed.length <= 3 ? typed : (link?.name || "A").trim().charAt(0) || "A").toUpperCase();
      this.say("");
      this.apply({ letters });
    }

    /* ── Adjust ──────────────────────────────────────────────────── */

    initAdjust() {
      const { box, canvas, zoom } = this.el;
      this.pen = canvas.getContext("2d");
      this.view = { zoom: 1, x: 0, y: 0 };
      const pointers = new Map();
      let pinch = 0;
      // One canvas unit per CSS pixel of drag, whatever size the stage is drawn at.
      const unit = () => canvas.width / (canvas.getBoundingClientRect().width || canvas.width);
      box.addEventListener("pointerdown", (event) => {
        if (!this.image) return;
        box.setPointerCapture?.(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
        box.classList.add("is-moving");
      });
      box.addEventListener("pointermove", (event) => {
        const last = pointers.get(event.pointerId);
        if (!last) return;
        const now = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, now);
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const spread = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) this.setZoom(this.view.zoom * spread / pinch);
          pinch = spread;
        } else {
          this.view.x += (now.x - last.x) * unit(); this.view.y += (now.y - last.y) * unit();
          this.draw();
        }
      });
      const release = (event) => { pointers.delete(event.pointerId); pinch = 0; if (!pointers.size) box.classList.remove("is-moving"); };
      box.addEventListener("pointerup", release);
      box.addEventListener("pointercancel", release);
      box.addEventListener("wheel", (event) => {
        if (!this.image) return;
        event.preventDefault();
        // Towards the pointer: the point under it stays under it.
        const rect = canvas.getBoundingClientRect();
        this.setZoom(this.view.zoom * Math.exp(-event.deltaY * 0.0015), { x: (event.clientX - rect.left - rect.width / 2) * unit(), y: (event.clientY - rect.top - rect.height / 2) * unit() });
      }, { passive: false });
      box.addEventListener("dblclick", () => this.frame("fit"));
      box.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 24 : 6;
        const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (move) { this.view.x += move[0]; this.view.y += move[1]; this.draw(); }
        else if (event.key === "+" || event.key === "=") this.setZoom(this.view.zoom * 1.1);
        else if (event.key === "-") this.setZoom(this.view.zoom / 1.1);
        else if (event.key === "0") this.frame("fit");
        else return;
        event.preventDefault();
      });
      // The slider runs evenly over the scale: each step multiplies.
      zoom.addEventListener("input", () => this.setZoom(this.limits.min * Math.pow(this.limits.max / this.limits.min, Number(zoom.value) / 1000), null, false));
      this.el.fit.addEventListener("click", () => this.frame("fit"));
      this.el.fill.addEventListener("click", () => this.frame("fill"));
      this.el.back.addEventListener("click", () => { this.show("find"); this.el.adjustBtn.focus(); });
      this.el.done.addEventListener("click", () => this.finishAdjust());
    }

    async openAdjust() {
      const link = this.target();
      const src = this.source || link?.customImg;
      if (!src) return;
      try { this.image = await loadImage(src); } catch { this.say(say("picker.unreadable", "That picture could not be read.")); return; }
      this.size = { w: this.image.naturalWidth || 256, h: this.image.naturalHeight || 256 };
      const side = this.el.canvas.width;
      const fit = Math.min(side / this.size.w, side / this.size.h);
      this.limits = { fit, fill: Math.max(side / this.size.w, side / this.size.h), min: fit * 0.4, max: fit * 8 };
      this.el.box.style.setProperty("--c", link.color || "var(--nl-accent)");
      this.show("adjust");
      this.frame("fit");
      this.el.box.focus();
    }

    frame(how) {
      this.view.x = 0; this.view.y = 0;
      this.setZoom(how === "fill" ? this.limits.fill : this.limits.fit);
    }

    setZoom(value, anchor = null, moveSlider = true) {
      if (!this.image) return;
      const next = Math.min(this.limits.max, Math.max(this.limits.min, value));
      if (anchor) {
        const ratio = next / this.view.zoom;
        this.view.x = anchor.x - (anchor.x - this.view.x) * ratio;
        this.view.y = anchor.y - (anchor.y - this.view.y) * ratio;
      }
      this.view.zoom = next;
      if (moveSlider) this.el.zoom.value = String(Math.round(1000 * Math.log(next / this.limits.min) / Math.log(this.limits.max / this.limits.min)));
      this.draw();
    }

    draw(pen = this.pen) {
      const side = pen.canvas.width;
      pen.clearRect(0, 0, side, side);
      if (!this.image) return;
      pen.imageSmoothingQuality = "high";
      const width = this.size.w * this.view.zoom, height = this.size.h * this.view.zoom;
      pen.drawImage(this.image, side / 2 + this.view.x - width / 2, side / 2 + this.view.y - height / 2, width, height);
    }

    async finishAdjust() {
      const link = this.target();
      if (!link || !this.image) return;
      let picture;
      // A picture from an address that would not let itself be read cannot be redrawn.
      try { picture = webp(this.el.canvas); } catch { this.show("find"); this.say(say("picker.unreadable", "That picture could not be read.")); return; }
      link.customImg = picture;
      delete link.icon; delete link.monogram;
      this.current = null;
      this.changed();
      this.show("find");
      this.paint();
      this.el.adjustBtn.focus();
    }
  }
  window.NordlysIconPicker = NordlysIconPicker;
})();
