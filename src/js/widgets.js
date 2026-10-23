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
// The mark beside a row that goes somewhere.
const ROW_ICONS = {
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>',
  tab: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h8V5"/></svg>',
  page: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  setting: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  capture: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  golink: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6"/></svg>',
  usual: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};
// The mark beside an answer, by what kind of answer it is.
const ANSWER_ICONS = {
  calc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 2h5v2h-5V5zm-7 0h5v2H6V5zm0 4h5v2H6V9zm7 0h5v2h-5V9zm-7 4h5v2H6v-2zm7 0h5v2h-5v-2zm-7 4h5v2H6v-2zm7 0h5v2h-5v-2z"/></svg>',
  units: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7.5 11.5 2 2M10.5 8.5l2 2M13.5 5.5l2 2"/></svg>',
  time: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  money: '<svg class="stroke" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>'
};
/* Each command's aliases and its line in the help, spelled out so every
   message key can be found by searching for it. */
const COMMAND_KEYS = {
  theme: ["command.verb.theme", "command.help.theme"],
  sky: ["command.verb.sky", "command.help.sky"],
  mood: ["command.verb.mood", "command.help.mood"],
  shuffle: ["command.verb.shuffle", "command.help.shuffle"],
  arrange: ["command.verb.arrange", "command.help.arrange"],
  page: ["command.verb.page", "command.help.page"],
  size: ["command.verb.size", "command.help.size"],
  newFolder: ["command.verb.newFolder", "command.help.newFolder"],
  rename: ["command.verb.rename", "command.help.rename"],
  hide: ["command.verb.hide", "command.help.hide"],
  show: ["command.verb.show", "command.help.show"],
  move: ["command.verb.move", "command.help.move"],
  settings: ["command.verb.settings", "command.help.settings"],
  profile: ["command.verb.profile", "command.help.profile"],
  dashboard: ["command.verb.dashboard", "command.help.dashboard"],
  task: ["command.verb.task", "command.help.task"],
  timer: ["command.verb.timer", "command.help.timer"],
  focusMode: ["command.verb.focusMode", "command.help.focusMode"]
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
          delete document.body.dataset.searchPeek;
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
        this.reveal();
        this.input.focus();
        this.input.select();
      } else if (e.key === "Escape" && document.body.classList.contains("searching")) {
        this.input.blur();
        document.body.classList.remove("searching");
        this.closeSuggestions();
      }
    });
  }

  // A hidden search box shows while it is in use (the shortcuts, a command).
  reveal() {
    if (document.body.dataset.search === "off") document.body.dataset.searchPeek = "";
  }

  remembers() { return this.app?.config?.rememberSearches !== false; }

  refreshLabels() {
    if (this.input) {
      this.input.placeholder = window.I18N ? window.I18N.t("search.placeholder") : "Search or enter URL";
    }
  }

  saveSearchHistory(query) {
    if (!this.remembers()) return;
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
    if (!this.remembers()) return [];
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

  /* What is opened from the board, and at what hour, so the empty box can
     offer what is usually opened now (search-sources.js). Kept on this
     device only, and not at all when that is turned off. */
  suggestsUsual() { return this.app?.config?.suggestUsual !== false; }

  noteOpen(url) {
    if (!this.suggestsUsual() || !/^https?:\/\//i.test(url || "")) return;
    try {
      const rhythm = window.NordlysSearchSources?.noteOpen(JSON.parse(localStorage.getItem("nordlys_rhythm") || "null"), url);
      if (rhythm) localStorage.setItem("nordlys_rhythm", JSON.stringify(rhythm));
    } catch (error) { /* not kept, then */ }
  }

  usualNow() {
    if (!this.suggestsUsual()) return [];
    try { return window.NordlysSearchSources?.usual(this.app?.config?.groups, JSON.parse(localStorage.getItem("nordlys_rhythm") || "null")) || []; }
    catch (error) { return []; }
  }

  showRecentHistory() {
    const recent = this.getSearchHistory();
    const usual = this.usualNow();
    if (!recent.length && !usual.length) {
      this.closeSuggestions();
      return;
    }
    this.renderSuggestions({
      query: "",
      calcResult: null,
      bookmarkMatches: [],
      usual,
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

  // The bookmarks on the board, best first (search-sources.js).
  findMatchingBookmarks(query) {
    return window.NordlysSearchSources?.board(this.app?.config?.groups, query) || [];
  }

  /* Open tabs, the browser's bookmarks and history, each only when it is
     turned on in Settings → General and the browser gave its leave. A page
     already shown higher up is not shown again lower down. */
  async browserMatches(query) {
    const sources = window.NordlysSearchSources;
    const on = Array.isArray(this.app?.config?.searchFrom) ? this.app.config.searchFrom : [];
    if (!sources || !on.length || query.length < 2) return { tabs: [], bookmarks: [], history: [] };
    const board = new Set((this.app.config.groups || []).flatMap((group) => (group.links || []).map((link) => link.url)));
    const [tabs, bookmarks] = await Promise.all([
      on.includes("tabs") ? sources.tabs(query, { self: location.origin }) : [],
      on.includes("bookmarks") ? sources.bookmarks(query, { exclude: board }) : []
    ]);
    const shown = new Set([...board, ...tabs.map((tab) => tab.url), ...bookmarks.map((mark) => mark.url)]);
    const history = on.includes("history") ? await sources.history(query, { exclude: shown }) : [];
    return { tabs, bookmarks, history };
  }

  // A keyword from Settings → General and where it goes (search-sources.js).
  keywordOf(query) {
    return window.NordlysSearchSources?.keyword(this.app?.config?.golinks, query) || null;
  }

  // "+ call mum tomorrow" is a task for the dashboard, read as the task card reads it.
  captureOf(query) {
    const text = /^\+\s*(\S.*)$/.exec(query)?.[1];
    return text && this.app?.dashboard ? text : null;
  }

  async capture(text) {
    this.input.value = "";
    this.input.blur();
    document.body.classList.remove("searching");
    this.closeSuggestions();
    if (await this.app.dashboard.addTask(text) && typeof toast === "function") toast(this.say("search.captured", "Added to your tasks"), "success", 1800);
  }

  openUrl(url) {
    if (this.app?.config?.openNewTab) window.open(url, "_blank", "noopener,noreferrer");
    else window.location.href = url;
  }

  /* Over to an open tab, its window to the front; a new tab that was only
     the way there closes behind it, as the address bar's does. */
  switchToTab(tab) {
    const api = typeof chrome !== "undefined" ? chrome : null;
    if (!api?.tabs?.update) return this.openUrl(tab.url);
    api.tabs.update(tab.id, { active: true }, () => void api.runtime?.lastError);
    api.windows?.update?.(tab.windowId, { focused: true }, () => void api.runtime?.lastError);
    if (window.history.length <= 1) api.tabs.getCurrent?.((current) => { if (current && current.id !== tab.id) api.tabs.remove(current.id, () => void api.runtime?.lastError); });
  }

  // A place in Settings, open and in view, its control ready for the keyboard.
  revealSetting(place) {
    this.input.value = "";
    this.input.blur();
    document.body.classList.remove("searching");
    this.closeSuggestions();
    this.app?.settings?.open(place.tab);
    requestAnimationFrame(() => {
      place.node.scrollIntoView({ block: "center" });
      place.node.classList.add("setting-found");
      setTimeout(() => place.node.classList.remove("setting-found"), 2000);
      place.node.querySelector("input:not([type=hidden]), select:not([hidden]), button, [tabindex='0']")?.focus({ preventScroll: true });
    });
  }

  async processQuery(query) {
    if (query.startsWith(">")) {
      this.processCommand(query.slice(1));
      return;
    }
    this.endCommandMode();
    const token = ++this.queryToken;
    // Units, times and money (convert.js) are read in at the first question the box is asked.
    if (!window.NordlysConvert) await loadScript("src/js/convert.js");
    if (token !== this.queryToken) return;
    const golink = this.keywordOf(query);
    const calcResult = this.tryCalculate(query) || this.convert(query);
    const capture = this.captureOf(query);
    const bookmarkMatches = this.findMatchingBookmarks(query);
    const settingsMatches = window.NordlysSearchSources?.settings(document.getElementById("cfg"), query) || [];
    const historyMatches = this.getSearchHistory(query);
    const found = await this.browserMatches(query);

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
    const lists = { query, golink, calcResult, capture, bookmarkMatches, found, settingsMatches, historyMatches };
    this.renderSuggestions(lists);
    // An amount of money waits for the day's rates, and the list is drawn again when they come.
    const money = !calcResult && window.NordlysConvert?.money(query);
    if (!money) return;
    const answer = this.exchange(money, await this.rates());
    if (answer && token === this.queryToken && this.input.value.trim() === query) this.renderSuggestions({ ...lists, calcResult: answer });
  }

  /* A quantity in other units, the time elsewhere, or money at rates already
     kept today (convert.js). */
  convert(query) {
    const convert = window.NordlysConvert;
    if (!convert) return null;
    const lang = LOCALE_MAP[window.I18N?.currentLang] || "en-US";
    const format = this.app?.config?.timeFormat;
    const units = convert.units(query, lang);
    if (units) return { ...units, kind: "units" };
    const time = convert.time(query, { lang, hour12: format === "12h" ? true : format === "24h" ? false : undefined });
    if (time) return { ...time, kind: "time" };
    const money = convert.money(query);
    return money ? this.exchange(money, this.keptRates()) : null;
  }

  exchange(money, table) {
    const lang = LOCALE_MAP[window.I18N?.currentLang] || "en-US";
    const answer = table && window.NordlysConvert.exchange(money, table, lang);
    if (!answer) return null;
    const date = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(new Date(table.updated));
    return { ...answer, kind: "money", note: this.say("search.ratesNote", `Rates by ExchangeRate-API, ${date}`, { date }) };
  }

  /* The day's exchange rates, from open.er-api.com: asked for only once an
     amount of money has been typed, kept for the day, and the last ones
     kept still answer while the network does not. */
  keptRates(day = new Date().toISOString().slice(0, 10)) {
    try {
      const kept = JSON.parse(localStorage.getItem("nordlys_rates") || "null");
      return kept?.rates && (!day || kept.day === day) ? kept : null;
    } catch (error) { return null; }
  }

  rates() {
    const today = new Date().toISOString().slice(0, 10);
    const kept = this.keptRates(today);
    if (kept) return Promise.resolve(kept);
    this.ratesAsked ||= fetch("https://open.er-api.com/v6/latest/USD", { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout?.(6000) })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.result !== "success" || !body.rates) return this.keptRates(null);
        const fresh = { day: today, updated: (body.time_last_update_unix || Date.now() / 1000) * 1000, rates: body.rates };
        try { localStorage.setItem("nordlys_rates", JSON.stringify(fresh)); } catch (error) { /* answered, not kept */ }
        return fresh;
      })
      .catch(() => this.keptRates(null))
      .finally(() => { this.ratesAsked = null; });
    return this.ratesAsked;
  }

  renderSuggestions({ golink, calcResult, capture, bookmarkMatches, usual, found, settingsMatches, historyMatches }) {
    if (!this.sugg) return;
    this.sugg.replaceChildren();
    this.selIdx = -1;
    let itemIndex = 0;
    /* A row with a mark, a name, a quieter line and a badge. Ten rows at
       most: past that the list is longer than the reason to read it. */
    const addRow = (kind, icon, name, detail, badge, act) => {
      if (itemIndex >= 10) return;
      const row = document.createElement("div");
      row.className = `sugg-item ${kind}`;
      row.style.setProperty("--si", itemIndex++);
      row.innerHTML = `${icon}<span class="bm-info"><strong class="bm-name"></strong><small class="bm-url"></small></span><span class="sugg-badge sugg-folder-badge"></span>`;
      row.querySelector(".bm-name").textContent = name;
      row.querySelector(".bm-url").textContent = detail || "";
      const tag = row.querySelector(".sugg-badge");
      if (badge) tag.textContent = badge;
      else tag.remove();
      row.addEventListener("mousedown", (e) => { e.preventDefault(); act(); });
      this.sugg.appendChild(row);
    };
    const host = (url) => window.NordlysSearchSources?.hostOf(url) || url;

    // 0. A keyword of the person's own goes first: it is what they set it up for.
    if (golink) addRow("sugg-golink", ROW_ICONS.golink, golink.words || host(golink.url), golink.url.replace(/^https?:\/\/(www\.)?/, ""), golink.key, () => this.openUrl(golink.url));

    // 1. The answer: a sum, a conversion, the time elsewhere or money.
    if (calcResult) {
      const result = typeof calcResult === "string" ? { text: calcResult, kind: "calc" } : calcResult;
      const calcRow = document.createElement("div");
      calcRow.className = `sugg-item sugg-calc sugg-${result.kind}`;
      calcRow.style.setProperty("--si", itemIndex++);
      calcRow.innerHTML = `
        ${ANSWER_ICONS[result.kind]}
        <span class="calc-val"></span>
        <small class="calc-note"></small>
        <span class="sugg-badge sugg-calc-badge">${this.say("search.copyAnswer", "Copy")}</span>
      `;
      calcRow.querySelector(".calc-val").textContent = result.text;
      const note = calcRow.querySelector(".calc-note");
      if (result.note) note.textContent = result.note;
      else note.remove();
      calcRow.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const parts = result.text.split("=");
        const answer = result.answer || (parts.length > 1 ? parts[1].trim() : result.text);
        this.input.value = answer;
        this.closeSuggestions();
        /* Copied is said only once it is so. A refused clipboard left a
           rejection nobody caught and a notice that said otherwise; the
           answer is in the box either way. */
        navigator.clipboard?.writeText(answer).then(() => {
          if (typeof toast === "function") toast(window.I18N ? window.I18N.t("toast.copied") : "Copied to clipboard", "success", 1600);
        }, () => {});
      });
      this.sugg.appendChild(calcRow);
    }

    // 2. A task to add, the bookmarks on the board, then what the browser has.
    if (capture) addRow("sugg-capture", ROW_ICONS.capture, this.say("search.capture", `Add a task: ${capture}`, { text: capture }), "", "", () => this.capture(capture));
    for (const bm of usual || []) addRow("sugg-bookmark sugg-usual", ROW_ICONS.usual, bm.name || host(bm.url), host(bm.url), this.say("search.usualNow", "Usually now"), () => this.openUrl(bm.url));
    for (const bm of bookmarkMatches || []) addRow("sugg-bookmark", ROW_ICONS.bookmark, bm.name || "Bookmark", bm.url || "", bm.groupLabel || "Folder", () => this.openUrl(bm.url));
    for (const tab of found?.tabs || []) addRow("sugg-tab", ROW_ICONS.tab, tab.name, host(tab.url), this.say("search.switchTab", "Switch to tab"), () => this.switchToTab(tab));
    for (const mark of found?.bookmarks || []) addRow("sugg-browser-bookmark", ROW_ICONS.bookmark, mark.name, host(mark.url), mark.folder || this.say("search.fromBookmarks", "Bookmarks"), () => this.openUrl(mark.url));
    for (const page of found?.history || []) addRow("sugg-page", ROW_ICONS.page, page.name, host(page.url), this.say("search.fromHistory", "History"), () => this.openUrl(page.url));
    for (const place of settingsMatches || []) addRow("sugg-setting", ROW_ICONS.setting, place.name, place.tabName, this.say("settings.title", "Settings"), () => this.revealSetting(place));

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
      // Every sky but the person's own picture and video, which a word cannot conjure.
      scenes: (window.NordlysSkies?.SKIES || []).filter((sky) => sky.kind !== "media").map((sky) => ({ key: sky.id, name: this.say(sky.key, sky.name) })),
      moods: [...document.querySelectorAll("#bg-palette-grid [data-palette]")].map((chip) => ({ key: chip.dataset.palette, name: text(chip.querySelector("span")) || chip.dataset.palette })),
      pages: [...document.querySelectorAll(".page-layout-option[data-page-layout]")].map((option) => ({ key: option.dataset.pageLayout, name: text(option.querySelector(".board-layout-name")) || option.dataset.pageLayout })),
      folders: groups.map((group, index) => ({ key: index, name: group.label || "", hidden: Boolean(group.hidden) })),
      bookmarks: groups.flatMap((group, g) => (group.links || []).map((link, l) => ({ key: `${g}:${l}`, name: link.name || link.url || "", folder: g }))),
      tabs: [...document.querySelectorAll(".ctabs .ctab[data-tab]")].map((tab) => ({ key: tab.dataset.tab, name: text(tab) })),
      profiles: (app.sync?.list() || []).map((profile) => ({ key: profile.id, name: profile.name }))
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
      case "page": return this.say("command.doPage", `Page: ${name}`, { name });
      case "size": return this.say("command.doSize", "Size & spacing");
      case "newFolder": return this.say("command.doNewFolder", `New folder: ${candidate.name}`, { name: candidate.name });
      case "rename": return candidate.name ? this.say("command.doRename", `Rename ${name} to ${candidate.name}`, { name, to: candidate.name }) : this.say("command.renameHow", `Rename ${name} to …`, { name });
      case "hide": return this.say("command.doHide", `Hide ${name}`, { name });
      case "show": return this.say("command.doShow", `Show ${name}`, { name });
      case "move": return this.say("command.doMove", `Move ${name} to ${candidate.folder.name}`, { name, folder: candidate.folder.name });
      case "profile": return this.say("command.doProfile", `Space: ${name}`, { name });
      case "dashboard": return this.app.dashboard?.on ? this.say("command.doDashboardOff", "Turn the dashboard off") : this.say("command.doDashboardOn", "Turn the dashboard on");
      case "task": return this.say("command.doTask", `Add a task: ${candidate.name}`, { name: candidate.name });
      case "timer": return this.say("command.doTimer", "Start or pause the focus timer");
      case "focusMode": return this.say("command.doFocusMode", "Open focus mode");
      case "settings": return name ? this.say("command.doSettingsTab", `Open settings: ${name}`, { name }) : this.say("command.doSettings", "Open settings");
      default: return "";
    }
  }

  // Every verb, with an example of it, for a bare ">".
  commandHelp() {
    return [
      ["theme", "theme nord"], ["sky", "sky polaris"], ["mood", "mood ember"], ["shuffle", "shuffle"],
      ["page", "page columns"], ["arrange", "arrange"], ["size", "size"], ["newFolder", "new folder Reading"], ["rename", "rename Daily to Morning"], ["hide", "hide Shopping"],
      ["show", "show Shopping"], ["move", "move YouTube to Daily"], ["settings", "settings background"],
      ["dashboard", "dashboard"], ["task", "task Call the dentist"], ["timer", "timer"], ["focusMode", "focus"],
      // Only worth offering once there is a second profile to go to.
      ...((this.app.sync?.list().length || 0) > 1 ? [["profile", "profile Home"]] : [])
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
    this.app.applyPageLayout();
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
      case "sky": look((config) => { config.bgMode = candidate.target.key; delete config.skyLayers; }); break;
      case "mood": look((config) => { config.bgPalette = candidate.target.key; }); break;
      case "page": look((config) => { config.pageLayout = candidate.target.key; }); break;
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
      case "sky": config.bgMode = candidate.target.key; delete config.skyLayers; break;
      case "mood": config.bgPalette = candidate.target.key; break;
      case "page":
        config.pageLayout = candidate.target.key;
        // Today is the dashboard's layout; Undo puts the dashboard back as it was.
        if (candidate.target.key === "today" && this.app.dashboard && !this.app.dashboard.on) this.app.dashboard.setOn(true);
        break;
      case "shuffle": config.bgSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1; break;
      case "newFolder": groups.push({ label: candidate.name, cols: 4, hidden: false, links: [] }); break;
      case "rename": if (candidate.name) groups[candidate.target.key].label = candidate.name; else done = false; break;
      case "hide": groups[candidate.target.key].hidden = true; break;
      case "show": groups[candidate.target.key].hidden = false; break;
      case "move": {
        const [g, l] = candidate.target.key.split(":").map(Number);
        const from = groups[g], to = groups[candidate.folder.key];
        if (from?.source || to?.source) { done = false; break; }
        const [link] = from.links.splice(l, 1);
        (to.links ||= []).push(link);
        break;
      }
      case "profile": {
        this.endCommandMode();
        this.input.value = "";
        this.input.blur();
        document.body.classList.remove("searching");
        this.closeSuggestions();
        this.app.sync?.switchTo(candidate.target.key);
        return;
      }
      case "settings": {
        this.endCommandMode();
        this.input.value = "";
        this.input.blur();
        this.app.settings?.open(candidate.target?.key || null);
        return;
      }
      // The dashboard keeps its own Undo: a removed card, a cleared list.
      case "focusMode": {
        this.endCommandMode();
        this.input.value = "";
        this.input.blur();
        document.body.classList.remove("searching");
        this.closeSuggestions();
        this.app.focusMode?.show();
        return;
      }
      case "dashboard":
      case "task":
      case "timer": {
        this.endCommandMode();
        this.input.value = "";
        this.input.blur();
        document.body.classList.remove("searching");
        this.closeSuggestions();
        const dash = this.app.dashboard;
        if (!dash) return;
        if (candidate.kind === "dashboard") dash.setOn(!dash.on);
        else if (candidate.kind === "task") dash.addTask(candidate.name);
        else dash.toggleTimer();
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
      // A box that is hidden in Settings goes away again.
      if ("searchPeek" in document.body.dataset) this.input.blur();
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
      } else if (this.keywordOf(this.input.value.trim())) {
        // A keyword goes where it was set to go.
        this.openUrl(this.keywordOf(this.input.value.trim()).url);
      } else if (this.captureOf(this.input.value.trim())) {
        // So does a task, even before its row has come up.
        this.capture(this.captureOf(this.input.value.trim()));
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
        /* Under One page fit the list scrolls inside itself, so the arrow
           keys bring the chosen row into it. The ordinary list never
           overflows, and nothing on it moves. */
        if (document.documentElement.dataset.pageFit === "on" && this.sugg && this.sugg.scrollHeight > this.sugg.clientHeight) {
          item.scrollIntoView({ block: "nearest" });
        }
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

  /* chrome.search.query hands the text to the engine set in the browser's own
     settings, in this tab or a new one (Chrome, Edge and Firefox all have it).
     There is deliberately no hard-coded fallback: a page that quietly sends
     people to Google when the API is missing has made the very choice it is
     not supposed to make. Where it is missing (Safari), the person picks. */
  searchWithBrowser(text) {
    const api = (typeof chrome !== "undefined" && chrome.search) ? chrome.search : null;
    if (!api) {
      /* A browser without a search API (Safari): the engine the person
         picked in Settings → General, and if none yet, the place to pick. */
      const url = window.NordlysPlatform?.searchUrl(this.app?.config?.searchEngine, text);
      if (url) {
        if (this.app?.config?.openNewTab) window.open(url, "_blank", "noopener,noreferrer");
        else window.location.href = url;
        return;
      }
      NordlysUI.announce(window.I18N ? window.I18N.t("search.chooseEngine") : "Choose a search engine first");
      if (typeof toast === "function") toast(window.I18N ? window.I18N.t("search.chooseEngine") : "Choose a search engine first", "info", 4000);
      this.app?.settings?.open("general");
      setTimeout(() => document.querySelector("#cfg-search-engine + .nl-select, #cfg-search-engine")?.focus(), 400);
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
