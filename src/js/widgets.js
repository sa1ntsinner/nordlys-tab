/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WIDGETS (CLOCK, DATE, GREETING, OMNI-SEARCH & CALCULATOR)
   ═══════════════════════════════════════════════════════════════════ */


/* Search goes to whichever engine the user has already chosen in Chrome, through
   the browser's own API. The page does not know which engine that is and does
   not need to. It used to carry its own table of ten, a bang syntax to switch
   between them per query, and a template for a custom one — and the store's
   reviewers read all of that as a second product bolted onto the first: a new
   tab page that also changes search settings. They are right that it was two
   things. Choosing a search engine is Chrome's job, and Chrome has a setting
   for it that this page now honours instead of duplicating. */

const LOCALE_MAP = {
  en: "en-US",
  ru: "ru-RU",
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR",
  ja: "ja-JP",
  zh: "zh-CN",
  tr: "tr-TR"
};

/* ── Hero Clock & Date Controller ──────────────────────────────── */
class ClockWidget {
  /* The config is read through the app each time, never kept: an import, a
     restore or another tab's save replaces the object, and a clock holding
     the first one kept its format, its seconds and its greeting from then on. */
  constructor(cfg, app = null) {
    this.app = app;
    this.startCfg = cfg;
    this.elH = document.getElementById("hh");
    this.elM = document.getElementById("mm");
    this.elS = document.getElementById("ss");
    this.elAmpm = document.getElementById("ampm");
    this.elDate = document.getElementById("date");
    this.elGreet = document.getElementById("greet");
    this.firstPaint = true;

    this.update();
    this.firstPaint = false;
    setInterval(() => this.update(), 1000);
  }

  get cfg() { return this.app?.config || this.startCfg; }

  /* Each figure is its own box, and only the one that changed turns over:
     the old figure rises and blurs away while the new one comes up into its
     place (motion.css). Nine minutes past becoming ten moves one digit, not
     the whole minute. A figure leaving is hidden from assistive technology,
     which reads the time once, as it now is. */
  setDigit(el, value, { still = false } = {}) {
    if (!el) return;
    const current = [...el.querySelectorAll(":scope > .digit")].map((digit) => digit.dataset.value).join("");
    if (current === value && el.childElementCount === value.length) return;
    const digits = [...el.querySelectorAll(":scope > .digit")];
    if (digits.length !== value.length) {
      el.replaceChildren(...[...value].map((figure) => this.makeDigit(figure)));
      return;
    }
    [...value].forEach((figure, index) => {
      const digit = digits[index];
      if (digit.dataset.value === figure) return;
      const leaving = digit.querySelector(".digit-in")?.textContent || "";
      digit.dataset.value = figure;
      if (this.firstPaint || still) { digit.replaceChildren(this.figure(figure, "digit-in")); return; }
      const out = this.figure(leaving, "digit-out");
      out.setAttribute("aria-hidden", "true");
      digit.replaceChildren(this.figure(figure, "digit-in"), out);
      digit.classList.remove("rolling");
      void digit.offsetWidth; // play again even if the last turn has not finished
      digit.classList.add("rolling");
      out.addEventListener("animationend", () => out.remove(), { once: true });
    });
  }

  makeDigit(figure) {
    const digit = document.createElement("span");
    digit.className = "digit";
    digit.dataset.value = figure;
    digit.append(this.figure(figure, "digit-in"));
    return digit;
  }

  figure(text, className) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  }

  update() {
    const now = new Date();
    let hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");

    const is12h = this.cfg.timeFormat === "12h";
    let ampmText = "";
    if (is12h) {
      ampmText = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
    }
    // 12h clocks read "2:30 PM", never "02:30 PM"
    const hStr = is12h ? String(hours) : String(hours).padStart(2, "0");

    this.setDigit(this.elH, hStr);
    this.setDigit(this.elM, mins);
    // Seconds that are not shown still keep time, without turning over unseen.
    this.setDigit(this.elS, secs, { still: !this.cfg.showSeconds });

    // AM/PM Indicator
    if (this.elAmpm) {
      if (is12h) {
        this.elAmpm.textContent = ampmText;
        this.elAmpm.style.display = "inline-block";
      } else {
        this.elAmpm.textContent = "";
        this.elAmpm.style.display = "none";
      }
    }

    // Date formatting across all 8 languages
    if (this.elDate) {
      const opts = { weekday: "long", month: "short", day: "numeric" };
      const currentLang = window.I18N ? window.I18N.currentLang : "en";
      const locale = LOCALE_MAP[currentLang] || currentLang || "en-US";
    this.elDate.textContent = now.toLocaleDateString(locale, opts);
    }

    // Time-based greeting
    if (this.elGreet) {
      const curH = now.getHours();
      let salute;
      if (curH >= 5 && curH < 12) salute = window.I18N ? window.I18N.t('greeting.morning') : "Good morning";
      else if (curH >= 12 && curH < 17) salute = window.I18N ? window.I18N.t('greeting.afternoon') : "Good afternoon";
      else if (curH >= 17 && curH < 22) salute = window.I18N ? window.I18N.t('greeting.evening') : "Good evening";
      else salute = window.I18N ? window.I18N.t('greeting.night') : "Good night";

      const name = this.cfg.userName ? `, ${this.cfg.userName}` : "";
      this.elGreet.textContent = `${salute}${name}`;
    }
  }
}

/* ── Omni-Search Bar & Smart Suggestion Controller ─────────────── */
/* Each command's aliases and its line in the help, spelled out so every
   message key can be found by searching for it. */
const COMMAND_KEYS = {
  theme: ["command.verb.theme", "command.help.theme"],
  sky: ["command.verb.sky", "command.help.sky"],
  mood: ["command.verb.mood", "command.help.mood"],
  shuffle: ["command.verb.shuffle", "command.help.shuffle"],
  arrange: ["command.verb.arrange", "command.help.arrange"],
  size: ["command.verb.size", "command.help.size"],
  newFolder: ["command.verb.newFolder", "command.help.newFolder"],
  rename: ["command.verb.rename", "command.help.rename"],
  hide: ["command.verb.hide", "command.help.hide"],
  show: ["command.verb.show", "command.help.show"],
  move: ["command.verb.move", "command.help.move"],
  settings: ["command.verb.settings", "command.help.settings"]
};

class SearchWidget {
  constructor(cfg, app) {
    this.app = app;
    this.input = document.getElementById("q");
    this.sugg = document.getElementById("sugg");
    this.suggDebounce = null;
    this.selIdx = -1;
    this.queryToken = 0; // guards against out-of-order async suggestion responses

    this.init();
  }

  init() {
    if (!this.input) return;

    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-autocomplete", "list");
    this.input.setAttribute("aria-controls", "sugg");
    this.input.setAttribute("aria-expanded", "false");
    this.sugg?.setAttribute("role", "listbox");

    this.refreshLabels();

    // Input events
    this.input.addEventListener("input", () => this.onInput());
    this.input.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.input.addEventListener("focus", () => {
      document.body.classList.add("searching");
      const val = this.input.value.trim();
      if (val) {
        this.onInput();
      } else {
        this.showRecentHistory();
      }
    });
    this.input.addEventListener("blur", () => {
      setTimeout(() => {
        if (!document.activeElement || !document.activeElement.closest("#searchwrap")) {
          document.body.classList.remove("searching");
          this.endCommandMode();
          this.closeSuggestions();
        }
      }, 180);
    });

    const dim = document.getElementById("dim");
    dim?.addEventListener("click", () => {
      if (document.body.classList.contains("searching")) {
        this.input.blur();
        document.body.classList.remove("searching");
        this.closeSuggestions();
      }
    });

    // Global shortcut '/' to focus search
    window.addEventListener("keydown", (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : "";
      if (e.key === "/" && activeTag !== "INPUT" && activeTag !== "TEXTAREA") {
        e.preventDefault();
        this.input.focus();
        this.input.select();
      } else if (e.key === "Escape" && document.body.classList.contains("searching")) {
        this.input.blur();
        document.body.classList.remove("searching");
        this.closeSuggestions();
      }
    });
  }

  refreshLabels() {
    if (this.input) {
      this.input.placeholder = window.I18N ? window.I18N.t("search.placeholder") : "Search or enter URL";
    }
  }

  saveSearchHistory(query) {
    const q = (query || "").trim();
    if (!q || q.length < 2 || /^https?:\/\//i.test(q)) return;
    try {
      let history = JSON.parse(localStorage.getItem("nordlys_search_history") || "[]");
      history = history.filter(item => item.toLowerCase() !== q.toLowerCase());
      history.unshift(q);
      if (history.length > 15) history = history.slice(0, 15);
      localStorage.setItem("nordlys_search_history", JSON.stringify(history));
    } catch(e) {}
  }

  getSearchHistory(filter = "") {
    try {
      const history = JSON.parse(localStorage.getItem("nordlys_search_history") || "[]");
      if (!filter) return history.slice(0, 5);
      const q = filter.toLowerCase();
      return history.filter(item => item.toLowerCase().includes(q) && item.toLowerCase() !== q).slice(0, 3);
    } catch(e) {
      return [];
    }
  }

  deleteHistoryItem(itemText) {
    try {
      let history = JSON.parse(localStorage.getItem("nordlys_search_history") || "[]");
      history = history.filter(item => item !== itemText);
      localStorage.setItem("nordlys_search_history", JSON.stringify(history));
      if (!this.input.value.trim()) {
        this.showRecentHistory();
      } else {
        this.onInput();
      }
    } catch(e) {}
  }

  showRecentHistory() {
    const recent = this.getSearchHistory();
    if (!recent || recent.length === 0) {
      this.closeSuggestions();
      return;
    }
    this.renderSuggestions({
      query: "",
      calcResult: null,
      bookmarkMatches: [],
      historyMatches: recent
    });
  }

  onInput() {
    const val = this.input.value.trim();
    if (!val) {
      this.showRecentHistory();
      return;
    }

    clearTimeout(this.suggDebounce);
    this.suggPending = val;
    this.suggDebounce = setTimeout(() => { this.suggPending = null; this.processQuery(val); }, 120);
  }

  /* Arithmetic lives in calc.js, a hand-written evaluator. The version that
     used to be here constructed a function from the typed string, which the
     extension's CSP forbids; it worked in the test fixture and did nothing in
     the real product. */
  tryCalculate(query) {
    return window.NordlysCalc ? window.NordlysCalc.describe(query) : null;
  }

  findMatchingBookmarks(query) {
    const q = query.toLowerCase();
    const matches = [];
    if (!this.app || !this.app.config || !this.app.config.groups) return matches;

    for (const group of this.app.config.groups) {
      if (!group.links) continue;
      for (const link of group.links) {
        if ((link.name && link.name.toLowerCase().includes(q)) || (link.url && link.url.toLowerCase().includes(q))) {
          matches.push({ ...link, groupLabel: group.label });
          if (matches.length >= 4) break;
        }
      }
      if (matches.length >= 4) break;
    }
    return matches;
  }

  async processQuery(query) {
    if (query.startsWith(">")) {
      this.processCommand(query.slice(1));
      return;
    }
    this.endCommandMode();
    const token = ++this.queryToken;
    const calcResult = this.tryCalculate(query);
    const bookmarkMatches = this.findMatchingBookmarks(query);
    const historyMatches = this.getSearchHistory(query);

    if (token !== this.queryToken) return;
    if (!this.input.value.trim()) {
      if (document.activeElement === this.input) {
        this.showRecentHistory();
      } else {
        this.closeSuggestions();
      }
      return;
    }

    /* Calculator, the user's own tiles, and what they searched before — all of
       it local. There used to be a fourth source, live suggestions fetched from
       the chosen engine as you typed. The page no longer knows the engine, and
       sending every keystroke to a third party was the one thing the privacy
       page had to add a caveat about. */
    this.renderSuggestions({ query, calcResult, bookmarkMatches, historyMatches });
  }

  renderSuggestions({ query, calcResult, bookmarkMatches, historyMatches }) {
    if (!this.sugg) return;
    this.sugg.replaceChildren();
    this.selIdx = -1;
    let itemIndex = 0;

    // 1. Calculator Row
    if (calcResult) {
      const calcRow = document.createElement("div");
      calcRow.className = "sugg-item sugg-calc";
      calcRow.style.setProperty("--si", itemIndex++);
      calcRow.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 2h5v2h-5V5zm-7 0h5v2H6V5zm0 4h5v2H6V9zm7 0h5v2h-5V9zm-7 4h5v2H6v-2zm7 0h5v2h-5v-2zm-7 4h5v2H6v-2zm7 0h5v2h-5v-2z"/></svg>
        <span class="calc-val"></span>
        <span class="sugg-badge sugg-calc-badge">${this.say("search.copyAnswer", "Copy")}</span>
      `;
      calcRow.querySelector(".calc-val").textContent = calcResult;
      calcRow.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const parts = calcResult.split("=");
        const answer = parts.length > 1 ? parts[1].trim() : calcResult;
        navigator.clipboard?.writeText(answer);
        this.input.value = answer;
        this.closeSuggestions();
        if (typeof toast === "function") {
          toast(window.I18N ? window.I18N.t("toast.copied") : "Copied to clipboard", "success", 1600);
        }
      });
      this.sugg.appendChild(calcRow);
    }

    // 2. Matching Bookmarks
    if (bookmarkMatches && bookmarkMatches.length > 0) {
      bookmarkMatches.forEach((bm) => {
        const bmRow = document.createElement("div");
        bmRow.className = "sugg-item sugg-bookmark";
        bmRow.style.setProperty("--si", itemIndex++);
        bmRow.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
          <span class="bm-info">
            <strong class="bm-name"></strong>
            <small class="bm-url"></small>
          </span>
          <span class="sugg-badge sugg-folder-badge"></span>
        `;
        bmRow.querySelector(".bm-name").textContent = bm.name || "Bookmark";
        bmRow.querySelector(".bm-url").textContent = bm.url || "";
        bmRow.querySelector(".sugg-folder-badge").textContent = bm.groupLabel || "Folder";
        bmRow.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (this.app?.config?.openNewTab) {
            window.open(bm.url, "_blank", "noopener,noreferrer");
          } else {
            window.location.href = bm.url;
          }
        });
        this.sugg.appendChild(bmRow);
      });
    }

    // 3. Search History Items
    if (historyMatches && historyMatches.length > 0) {
      historyMatches.forEach((histItem) => {
        const histRow = document.createElement("div");
        histRow.className = "sugg-item sugg-history";
        histRow.dataset.historyItem = histItem;
        histRow.style.setProperty("--si", itemIndex++);
        histRow.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
          <span class="hist-text"></span>
          <button type="button" class="sugg-del-btn" title="${this.say("search.removeFromHistory", "Remove from history")}" aria-label="${this.say("search.removeFromHistory", "Remove from history")}">✕</button>
        `;
        histRow.querySelector(".hist-text").textContent = histItem;
        histRow.querySelector(".sugg-del-btn").addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.deleteHistoryItem(histItem);
        });
        histRow.addEventListener("mousedown", (e) => {
          if (e.target.closest(".sugg-del-btn")) return;
          e.preventDefault();
          this.input.value = histItem;
          this.executeSearch(histItem);
        });
        this.sugg.appendChild(histRow);
      });
    }

    if (itemIndex > 0) {
      this.sugg.querySelectorAll(".sugg-item").forEach((item, index) => {
        item.id = `search-option-${index}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", "false");
      });
      this.sugg.classList.add("on");
      this.input.setAttribute("aria-expanded", "true");
    } else {
      this.closeSuggestions();
    }
  }

  /* ── The board as a command line ─────────────────────────────────
     A leading ">" reads the rest as an instruction (commands.js). The
     candidate under the cursor is shown before it is chosen — a theme, a sky
     or a mood on the page itself, a folder or a bookmark lifted on the board —
     Enter keeps it, with one undo, and Escape puts everything back. */
  commandWorld() {
    const app = this.app;
    const text = (node) => node?.textContent.trim() || "";
    const groups = app.config.groups || [];
    return {
      themes: [...document.querySelectorAll(".theme-card[data-theme]")].map((card) => ({ key: card.dataset.theme, name: text(card.querySelector("b")) || card.dataset.theme })),
      scenes: [...document.querySelectorAll("#bg-scene-picker .scene-card[data-scene]")].filter((card) => card.dataset.scene !== "custom-image" && card.dataset.scene !== "custom-video").map((card) => ({ key: card.dataset.scene, name: text(card.querySelector(".scene-name")) || card.dataset.scene })),
      moods: [...document.querySelectorAll("#bg-palette-grid [data-palette]")].map((chip) => ({ key: chip.dataset.palette, name: text(chip.querySelector("span")) || chip.dataset.palette })),
      folders: groups.map((group, index) => ({ key: index, name: group.label || "", hidden: Boolean(group.hidden) })),
      bookmarks: groups.flatMap((group, g) => (group.links || []).map((link, l) => ({ key: `${g}:${l}`, name: link.name || link.url || "", folder: g }))),
      tabs: [...document.querySelectorAll(".ctabs .ctab[data-tab]")].map((tab) => ({ key: tab.dataset.tab, name: text(tab) }))
    };
  }

  commandLocale() {
    const t = (key) => {
      const value = window.I18N?.t(key);
      return value && value !== key ? value.split("|").map((part) => part.trim()).filter(Boolean) : [];
    };
    const verbs = {};
    for (const [verb, [aliases]] of Object.entries(COMMAND_KEYS)) verbs[verb] = t(aliases);
    return { verbs, joiners: t("command.joiners") };
  }

  say(key, fallback, params) {
    const value = window.I18N?.t(key, params || {});
    return value && value !== key ? value : fallback;
  }

  // What a candidate would do, in a line.
  describeCommand(candidate) {
    const name = candidate.target?.name;
    switch (candidate.kind) {
      case "theme": return this.say("command.doTheme", `Theme: ${name}`, { name });
      case "sky": return this.say("command.doSky", `Sky: ${name}`, { name });
      case "mood": return this.say("command.doMood", `Colour mood: ${name}`, { name });
      case "shuffle": return this.say("command.doShuffle", "Shuffle this sky");
      case "arrange": return this.say("command.doArrange", "Arrange folders");
      case "size": return this.say("command.doSize", "Size & spacing");
      case "newFolder": return this.say("command.doNewFolder", `New folder: ${candidate.name}`, { name: candidate.name });
      case "rename": return candidate.name ? this.say("command.doRename", `Rename ${name} to ${candidate.name}`, { name, to: candidate.name }) : this.say("command.renameHow", `Rename ${name} to …`, { name });
      case "hide": return this.say("command.doHide", `Hide ${name}`, { name });
      case "show": return this.say("command.doShow", `Show ${name}`, { name });
      case "move": return this.say("command.doMove", `Move ${name} to ${candidate.folder.name}`, { name, folder: candidate.folder.name });
      case "settings": return name ? this.say("command.doSettingsTab", `Open settings: ${name}`, { name }) : this.say("command.doSettings", "Open settings");
      default: return "";
    }
  }

  // Every verb, with an example of it, for a bare ">".
  commandHelp() {
    return [
      ["theme", "theme nord"], ["sky", "sky frost"], ["mood", "mood ember"], ["shuffle", "shuffle"],
      ["arrange", "arrange"], ["size", "size"], ["newFolder", "new folder Reading"], ["rename", "rename Daily to Morning"], ["hide", "hide Shopping"],
      ["show", "show Shopping"], ["move", "move YouTube to Daily"], ["settings", "settings background"]
    ].map(([verb, example]) => ({ kind: "verb", verb, example }));
  }

  processCommand(text) {
    if (!this.commandSnapshot) this.commandSnapshot = JSON.stringify(this.app.config);
    document.body.classList.add("commanding");
    const { candidates, help } = window.NordlysCommands?.parse(text, this.commandWorld(), this.commandLocale()) || { candidates: [] };
    this.commandCandidates = help ? this.commandHelp() : candidates.map((candidate) => candidate.kind === "verb" ? this.commandHelp().find((row) => row.verb === candidate.verb) : candidate).filter(Boolean);
    this.renderCommands();
    // The best reading is shown at once; arrowing shows the others.
    this.previewCommand(this.commandCandidates.find((candidate) => candidate.kind !== "verb"));
  }

  renderCommands() {
    if (!this.sugg) return;
    this.sugg.replaceChildren();
    this.selIdx = -1;
    this.commandCandidates.forEach((candidate, index) => {
      const row = document.createElement("div");
      row.className = `sugg-item sugg-command${candidate.kind === "verb" ? " sugg-command-help" : ""}`;
      row.dataset.command = String(index);
      row.style.setProperty("--si", index);
      const mark = document.createElement("span");
      mark.className = "sugg-command-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = ">";
      const words = document.createElement("span");
      words.className = "sugg-command-text";
      if (candidate.kind === "verb") {
        const example = document.createElement("strong");
        example.textContent = candidate.example;
        const meaning = document.createElement("small");
        meaning.textContent = this.say(COMMAND_KEYS[candidate.verb][1], "");
        words.append(example, meaning);
      } else {
        words.textContent = this.describeCommand(candidate);
      }
      row.append(mark, words);
      if (candidate.kind !== "verb") {
        const key = document.createElement("span");
        key.className = "sugg-badge";
        key.textContent = "Enter";
        row.append(key);
      }
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        if (candidate.kind === "verb") {
          // A verb from the list becomes the start of the command.
          this.input.value = `>${candidate.example.split(" ").slice(0, candidate.verb === "newFolder" ? 2 : 1).join(" ")} `;
          this.input.focus();
          this.onInput();
          return;
        }
        this.runCommand(candidate);
      });
      this.sugg.append(row);
    });
    if (this.commandCandidates.length) {
      this.sugg.querySelectorAll(".sugg-item").forEach((item, index) => {
        item.id = `search-option-${index}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", "false");
      });
      this.sugg.classList.add("on");
      this.input.setAttribute("aria-expanded", "true");
    } else {
      this.closeSuggestions();
    }
  }

  // Put the page back to how it was before the first ">".
  restoreCommandPreview() {
    document.querySelectorAll(".command-target").forEach((node) => node.classList.remove("command-target"));
    document.getElementById("board")?.classList.remove("command-preview");
    if (!this.commandPreviewing) return;
    this.commandPreviewing = false;
    this.app.config = JSON.parse(this.commandSnapshot);
    this.refreshLook();
  }

  refreshLook() {
    this.app.applyThemeTokens();
    this.app.updateBackgroundMode();
    this.app.settings?.renderThemeCards?.();
  }

  previewCommand(candidate) {
    this.restoreCommandPreview();
    if (!candidate) return;
    const board = document.getElementById("board");
    const lift = (selector) => {
      const node = board?.querySelector(selector);
      if (!node) return;
      board.classList.add("command-preview");
      node.classList.add("command-target");
    };
    const look = (change) => {
      change(this.app.config);
      this.commandPreviewing = true;
      this.refreshLook();
    };
    switch (candidate.kind) {
      case "theme": look((config) => { config.theme = candidate.target.key; delete config.customTheme; }); break;
      case "sky": look((config) => { config.bgMode = candidate.target.key; }); break;
      case "mood": look((config) => { config.bgPalette = candidate.target.key; }); break;
      case "hide": case "rename": lift(`.card[data-group-idx="${candidate.target.key}"]`); break;
      case "move": {
        const [g, l] = candidate.target.key.split(":");
        lift(`.tile[data-group-idx="${g}"][data-link-idx="${l}"]`);
        board?.querySelector(`.card[data-group-idx="${candidate.folder.key}"]`)?.classList.add("command-target");
        break;
      }
      default: break;
    }
  }

  runCommand(candidate) {
    const before = this.commandSnapshot || JSON.stringify(this.app.config);
    // A look being previewed is already on the page: keeping it is saving it.
    this.commandPreviewing = false;
    this.app.config = JSON.parse(before);
    const config = this.app.config;
    const groups = config.groups || [];
    let done = true;
    switch (candidate.kind) {
      case "theme": config.theme = candidate.target.key; delete config.customTheme; break;
      case "sky": config.bgMode = candidate.target.key; break;
      case "mood": config.bgPalette = candidate.target.key; break;
      case "shuffle": config.bgSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1; break;
      case "newFolder": groups.push({ label: candidate.name, cols: 4, hidden: false, links: [] }); break;
      case "rename": if (candidate.name) groups[candidate.target.key].label = candidate.name; else done = false; break;
      case "hide": groups[candidate.target.key].hidden = true; break;
      case "show": groups[candidate.target.key].hidden = false; break;
      case "move": {
        const [g, l] = candidate.target.key.split(":").map(Number);
        const from = groups[g], to = groups[candidate.folder.key];
        if (from?.source?.folderId || to?.source?.folderId) { done = false; break; }
        const [link] = from.links.splice(l, 1);
        (to.links ||= []).push(link);
        break;
      }
      case "settings": {
        this.endCommandMode();
        this.input.value = "";
        this.input.blur();
        this.app.settings?.open(candidate.target?.key || null);
        return;
      }
      /* Arranging is a place to go, not a change to undo: the arrangement
         keeps its own Undo, and says so when it is done. */
      case "arrange":
      case "size": {
        this.endCommandMode();
        this.input.value = "";
        this.input.blur();
        document.body.classList.remove("searching");
        this.closeSuggestions();
        const arrange = this.app.grid?.arrange;
        arrange?.enter();
        // Size and spacing are set where the board is arranged.
        if (candidate.kind === "size" && arrange?.active) arrange.showSize(true);
        return;
      }
      default: done = false;
    }
    if (!done) return;
    this.endCommandMode({ keep: true });
    this.app.saveConfig();
    this.refreshLook();
    this.app.grid?.render();
    const said = this.describeCommand(candidate);
    this.input.value = "";
    this.input.blur();
    document.body.classList.remove("searching");
    this.closeSuggestions();
    window.NordlysUI?.showUndoToast?.({
      message: said,
      onAction: () => {
        this.app.config = JSON.parse(before);
        this.app.saveConfig();
        this.refreshLook();
        this.app.grid?.render();
      }
    });
  }

  endCommandMode({ keep = false } = {}) {
    if (!keep) this.restoreCommandPreview();
    else {
      document.querySelectorAll(".command-target").forEach((node) => node.classList.remove("command-target"));
      document.getElementById("board")?.classList.remove("command-preview");
    }
    this.commandPreviewing = false;
    this.commandSnapshot = null;
    this.commandCandidates = null;
    document.body.classList.remove("commanding");
  }

  closeSuggestions() {
    if (this.sugg) {
      this.sugg.classList.remove("on");
      this.sugg.replaceChildren();
      this.selIdx = -1;
    }
    this.input?.setAttribute("aria-expanded", "false");
    this.input?.removeAttribute("aria-activedescendant");
  }

  onKeyDown(e) {
    /* A command typed and entered faster than the list redraws used to find
       no list (nothing happened) or the list for what was typed before (the
       wrong thing happened). What is in the field is read now. */
    if (e.key === "Enter" && this.suggPending != null && this.input.value.trim().startsWith(">")) {
      clearTimeout(this.suggDebounce);
      this.suggPending = null;
      this.processCommand(this.input.value.trim().slice(1));
    }
    const items = this.sugg ? Array.from(this.sugg.querySelectorAll(".sugg-item")) : [];

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.endCommandMode();
      if (this.navigationValue !== undefined) this.input.value = this.navigationValue;
      this.navigationValue = undefined;
      document.body.classList.remove("searching");
      this.closeSuggestions();
      NordlysUI.announce(window.I18N ? window.I18N.t("search.suggestionsClosed") : "Search suggestions closed");
      return;
    }

    if (e.key === "Delete" && this.selIdx >= 0 && items[this.selIdx]?.classList.contains("sugg-history")) {
      e.preventDefault(); e.stopPropagation();
      const item = items[this.selIdx].dataset.historyItem;
      if (this.navigationValue !== undefined) this.input.value = this.navigationValue;
      this.navigationValue = undefined; this.deleteHistoryItem(item);
      NordlysUI.announce(window.I18N ? window.I18N.t("search.historyRemoved", { query: item }) : `Removed ${item} from history`);
      return;
    }

    if (e.key === "ArrowDown" && items.length > 0) {
      e.preventDefault();
      if (this.selIdx < 0) this.navigationValue = this.input.value;
      this.selIdx = (this.selIdx + 1) % items.length;
      this.highlightItem(items);
    } else if (e.key === "ArrowUp" && items.length > 0) {
      e.preventDefault();
      if (this.selIdx < 0) this.navigationValue = this.input.value;
      this.selIdx = (this.selIdx - 1 + items.length) % items.length;
      this.highlightItem(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this.selIdx >= 0 && items[this.selIdx]) {
        items[this.selIdx].dispatchEvent(new MouseEvent("mousedown"));
      } else if (this.input.value.trim().startsWith(">")) {
        // A command with nothing highlighted runs the best reading of it.
        items.find((item) => item.classList.contains("sugg-command"))?.dispatchEvent(new MouseEvent("mousedown"));
      } else {
        this.executeSearch(this.input.value.trim());
      }
    }
  }

  highlightItem(items) {
    items.forEach((item, idx) => {
      if (idx === this.selIdx) {
        item.classList.add("sel");
        item.setAttribute("aria-selected", "true");
        this.input.setAttribute("aria-activedescendant", item.id);
        const span = item.querySelector("span");
        if (span && !item.classList.contains("sugg-bookmark") && !item.classList.contains("sugg-calc") && !item.classList.contains("sugg-command")) {
          this.input.value = span.textContent;
        }
        if (item.classList.contains("sugg-command")) this.previewCommand(this.commandCandidates?.[Number(item.dataset.command)]);
      } else {
        item.classList.remove("sel");
        item.setAttribute("aria-selected", "false");
      }
    });
  }

  executeSearch(query) {
    if (!query) return;

    this.saveSearchHistory(query);

    // Check for direct URL navigation
    if (/^https?:\/\//i.test(query) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(query) && !query.includes(" "))) {
      const targetUrl = /^https?:\/\//i.test(query) ? query : `https://${query}`;
      if (this.app?.config?.openNewTab) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = targetUrl;
      }
      return;
    }

    this.searchWithBrowser(query);
  }

  /* chrome.search.query hands the text to the engine set in Chrome's own
     settings, in this tab or a new one. There is deliberately no fallback to a
     hard-coded engine: a page that quietly sends people to Google when the API
     is missing has made the very choice it is not supposed to make. The API is
     missing only where the "search" permission is, which is nowhere a user
     will ever run this. */
  searchWithBrowser(text) {
    const api = (typeof chrome !== "undefined" && chrome.search) ? chrome.search : null;
    if (!api) {
      NordlysUI.announce(window.I18N ? window.I18N.t("search.unavailable") : "Search is not available here");
      return;
    }
    const disposition = this.app?.config?.openNewTab ? "NEW_TAB" : "CURRENT_TAB";
    try {
      const pending = api.query({ text, disposition });
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    } catch (error) {
      /* Refused, and the page is still here to try again. */
    }
  }
}

class WidgetsController {
  constructor(app) {
    this.app = app;
    this.clock = new ClockWidget(app.config, app);
    this.search = new SearchWidget(app.config, app);
  }

  updateClock() {
    this.clock.update();
  }

  refreshLabels() {
    this.search?.refreshLabels();
  }
}
