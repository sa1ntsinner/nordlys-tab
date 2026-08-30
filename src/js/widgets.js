/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WIDGETS (CLOCK, DATE, GREETING, OMNI-SEARCH & CALCULATOR)
   ═══════════════════════════════════════════════════════════════════ */

const SEARCH_ENGINES = {
  google: {
    name: "Google",
    url: "https://www.google.com/search?q=",
    suggUrl: "https://suggestqueries.google.com/complete/search?client=chrome&q=",
    icon: `<svg viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>`
  },
  duckduckgo: {
    name: "DuckDuckGo",
    url: "https://duckduckgo.com/?q=",
    suggUrl: "https://duckduckgo.com/ac/?q=",
    icon: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.76 4.4c2.81 0 5.09 2.05 5.09 4.58 0 2.25-1.52 4.17-3.66 4.52.12.31.2.65.2 1 0 1.57-1.38 2.85-3.08 2.85-.46 0-.9-.1-1.29-.27-.88.67-2 1.07-3.22 1.07-2.67 0-4.88-1.91-5.18-4.43-.07-.59-.1-1.19-.1-1.81 0-4.14 3.74-7.5 8.35-7.5.96 0 1.88.14 2.75.41-.53-.26-1.13-.41-1.76-.41-1.74 0-3.21.99-3.87 2.41 1.08-.5 2.3-.78 3.6-.78.43 0 .84.03 1.25.1a3.54 3.54 0 0 0-.09-.72c-.2-.73-.62-1.35-1.2-1.79.88-.13 1.77-.2 2.68-.2zm-3.06 4.9a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1zm5.2 2.68c.67-.38 1.12-1.1 1.12-1.93 0-1.24-1.01-2.25-2.25-2.25-.43 0-.83.12-1.17.33.88.58 1.57 1.45 1.95 2.48.12.44.2.9.23 1.37h.12z"/></svg>`
  },
  bing: {
    name: "Bing",
    url: "https://www.bing.com/search?q=",
    suggUrl: "https://api.bing.com/osjson.aspx?query=",
    icon: `<svg viewBox="0 0 24 24"><path d="M5 3v18l5-2.5V8.5l6.5 2.5L13 13.5l3.5 4.5 4.5-2V7.5L5 3z"/></svg>`
  },
  brave: {
    name: "Brave",
    url: "https://search.brave.com/search?q=",
    suggUrl: "https://search.brave.com/api/suggest?q=",
    icon: `<svg viewBox="0 0 24 24"><path d="M12 2l8 4.5v6c0 5.5-3.5 10.5-8 12-4.5-1.5-8-6.5-8-12v-6L12 2zm0 3.2L6 8.5v4.2c0 4.2 2.6 8 6 9.3 3.4-1.3 6-5.1 6-9.3V8.5L12 5.2z"/></svg>`
  },
  ecosia: {
    name: "Ecosia",
    url: "https://www.ecosia.org/search?q=",
    suggUrl: "https://ac.ecosia.org/autocomplete?q=",
    icon: `<svg viewBox="0 0 24 24"><path d="M12 2C7.5 2 4 5.5 4 10c0 3.3 2 6.1 5 7.3V21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3.7c3-1.2 5-4 5-7.3 0-4.5-3.5-8-8-8zm1 14.9V20h-2v-3.1c-.33-.07-.66-.17-.97-.3l1.97-6.6 2 6.6c-.32.14-.66.24-1 .3zm3.88-2.67l-2.02-6.72c.74-.6 1.6-1.05 2.58-1.3a6.02 6.02 0 0 1-.56 8.02zM12 4c1.35 0 2.59.45 3.6 1.2-1.13.3-2.15.86-3 1.63a6.05 6.05 0 0 0-3-1.63C10.6 4.45 11.25 4 12 4zM7.56 6.21c.98.25 1.84.7 2.58 1.3l-2.02 6.72a6.02 6.02 0 0 1-.56-8.02z"/></svg>`
  },
  yandex: {
    name: "Yandex",
    url: "https://yandex.com/search/?text=",
    suggUrl: "https://suggest.yandex.com/suggest-ff.cgi?part=",
    icon: `<svg viewBox="0 0 24 24"><path d="M13.2 2H8.3C5.4 2 3.8 3.6 3.8 6.5c0 2.6 1.3 4.2 3.5 4.8L2 22h3.8l4.7-9.5H12V22h3.6V2h-2.4zm-1.2 7.5H8.5c-1.3 0-2-.7-2-1.9 0-1.2.7-1.9 2-1.9H12v3.8z"/></svg>`
  },
  youtube: {
    name: "YouTube",
    url: "https://www.youtube.com/results?search_query=",
    suggUrl: "https://suggestqueries.google.com/complete/search?client=chrome&ds=yt&q=",
    icon: `<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
  },
  github: {
    name: "GitHub",
    url: "https://github.com/search?q=",
    suggUrl: "https://suggestqueries.google.com/complete/search?client=chrome&q=",
    icon: `<svg viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`
  },
  reddit: {
    name: "Reddit",
    url: "https://www.reddit.com/search/?q=",
    suggUrl: "https://suggestqueries.google.com/complete/search?client=chrome&q=",
    icon: `<svg viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.248a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.308.736-.499 1.208-.499.955 0 1.73.774 1.73 1.73 0 .634-.344 1.187-.852 1.483.04.28.06.565.06.853 0 4.18-4.78 7.57-10.68 7.57S3.7 18.23 3.7 14.05c0-.288.02-.573.06-.853-.508-.296-.852-.849-.852-1.483 0-.956.775-1.73 1.73-1.73.472 0 .9.191 1.208.5 1.194-.856 2.85-1.418 4.674-1.488l.947-4.437a.377.377 0 0 1 .45-.296l3.08.647c.18-.387.573-.66 1.013-.66zm-7.618 6.78a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88zm5.216 0a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88zm-5.114 4.542a.37.37 0 0 0-.26.634c.77.77 2.14.97 2.768.97.63 0 1.998-.2 2.768-.97a.37.37 0 0 0-.52-.524c-.55.55-1.63.73-2.248.73-.62 0-1.698-.18-2.248-.73a.366.366 0 0 0-.26-.11z"/></svg>`
  },
  wikipedia: {
    name: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Special:Search?search=",
    suggUrl: "https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=",
    icon: `<svg viewBox="0 0 24 24"><path d="M12.09 13.34l-2.5-6.9H6.91L2 20.9h3.42l1.32-3.87h4.81l1.32 3.87h2.88l1.32-3.87h4.81l1.32 3.87H22L17.09 6.44h-2.68l-2.32 6.9zm-4.32 1.34l1.41-4.14 1.41 4.14H7.77zm7.45 0l1.41-4.14 1.41 4.14h-2.82z"/></svg>`
  }
};

const BANGS = {
  "!g": "https://www.google.com/search?q=",
  "!d": "https://duckduckgo.com/?q=",
  "!ddg": "https://duckduckgo.com/?q=",
  "!b": "https://www.bing.com/search?q=",
  "!bing": "https://www.bing.com/search?q=",
  "!br": "https://search.brave.com/search?q=",
  "!brave": "https://search.brave.com/search?q=",
  "!e": "https://www.ecosia.org/search?q=",
  "!eco": "https://www.ecosia.org/search?q=",
  "!ya": "https://yandex.com/search/?text=",
  "!yandex": "https://yandex.com/search/?text=",
  "!y": "https://www.youtube.com/results?search_query=",
  "!yt": "https://www.youtube.com/results?search_query=",
  "!gh": "https://github.com/search?q=",
  "!github": "https://github.com/search?q=",
  "!w": "https://en.wikipedia.org/wiki/Special:Search?search=",
  "!wiki": "https://en.wikipedia.org/wiki/Special:Search?search=",
  "!r": "https://www.reddit.com/search/?q=",
  "!reddit": "https://www.reddit.com/search/?q=",
  "!bsky": "https://bsky.app/search?q=",
  "!c": "https://chatgpt.com/?q=",
  "!p": "https://www.perplexity.ai/search?q=",
  "!a": "https://www.amazon.com/s?k="
};

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
  constructor(cfg) {
    this.cfg = cfg;
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

  /* Swap digit text with a soft blur-morph when the value changes */
  setDigit(el, value) {
    if (!el) return;
    if (el.textContent !== value) {
      el.textContent = value;
      if (!this.firstPaint) {
        el.classList.remove("digit-tick");
        void el.offsetWidth; // restart the animation
        el.classList.add("digit-tick");
      }
    }
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
    if (this.cfg.showSeconds) this.setDigit(this.elS, secs);
    else if (this.elS) this.elS.textContent = secs;

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
      this.elDate.textContent = now.toLocaleDateString(locale, opts).toUpperCase();
    }

    // Time-based greeting
    if (this.elGreet) {
      const curH = now.getHours();
      let salute = window.I18N ? window.I18N.t('greeting.day') : "Good day";
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
class SearchWidget {
  constructor(cfg, app) {
    this.cfg = cfg;
    this.app = app;
    this.input = document.getElementById("q");
    this.sugg = document.getElementById("sugg");
    this.engineBtn = document.getElementById("engine-selector");
    this.activeEngine = this.cfg.defaultEngine || "google";
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

    this.updateEngineIcon();

    this.engineBtn?.addEventListener("click", () => this.cycleEngine());

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

  setEngine(engineKey) {
    if (SEARCH_ENGINES[engineKey]) {
      this.activeEngine = engineKey;
      this.cfg.defaultEngine = engineKey;
      if (this.app) {
        this.app.config.defaultEngine = engineKey;
        this.app.saveConfig();
      }
      this.updateEngineIcon();
    }
  }

  cycleEngine() {
    const engines = Object.keys(SEARCH_ENGINES);
    const idx = engines.indexOf(this.activeEngine);
    const nextEngine = engines[(idx + 1) % engines.length];
    this.setEngine(nextEngine);

    const sel = document.getElementById("cfg-default-engine");
    if (sel) sel.value = nextEngine;
  }

  updateEngineIcon() {
    const engine = SEARCH_ENGINES[this.activeEngine] || SEARCH_ENGINES.google;
    if (this.engineBtn) {
      this.engineBtn.innerHTML = engine.icon;
      this.engineBtn.title = window.I18N ? window.I18N.t('search.engineTitle', { engine: engine.name }) : `Search with ${engine.name} (Click to switch)`;
    }
    if (this.input) {
      this.input.placeholder = window.I18N ? window.I18N.t('search.placeholder') : 'Search or enter URL';
    }
  }

  saveSearchHistory(query) {
    const q = (query || "").trim();
    if (!q || q.length < 2 || /^https?:\/\//i.test(q)) return;
    try {
      let history = JSON.parse(localStorage.getItem("aurora_search_history") || "[]");
      history = history.filter(item => item.toLowerCase() !== q.toLowerCase());
      history.unshift(q);
      if (history.length > 15) history = history.slice(0, 15);
      localStorage.setItem("aurora_search_history", JSON.stringify(history));
    } catch(e) {}
  }

  getSearchHistory(filter = "") {
    try {
      const history = JSON.parse(localStorage.getItem("aurora_search_history") || "[]");
      if (!filter) return history.slice(0, 5);
      const q = filter.toLowerCase();
      return history.filter(item => item.toLowerCase().includes(q) && item.toLowerCase() !== q).slice(0, 3);
    } catch(e) {
      return [];
    }
  }

  deleteHistoryItem(itemText) {
    try {
      let history = JSON.parse(localStorage.getItem("aurora_search_history") || "[]");
      history = history.filter(item => item !== itemText);
      localStorage.setItem("aurora_search_history", JSON.stringify(history));
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
      historyMatches: recent,
      webSuggestions: []
    });
  }

  onInput() {
    const val = this.input.value.trim();
    if (!val) {
      this.showRecentHistory();
      return;
    }

    clearTimeout(this.suggDebounce);
    this.suggDebounce = setTimeout(() => this.processQuery(val), 120);
  }

  tryCalculate(query) {
    const raw = query.trim();
    if (!raw) return null;

    // Handle "X% of Y" or "X% * Y" -> (X/100)*Y
    const pctMatch = raw.match(/^([\d\.]+)\s*%\s*(?:of|\*)\s*([\d\.]+)$/i);
    if (pctMatch) {
      const p = parseFloat(pctMatch[1]);
      const total = parseFloat(pctMatch[2]);
      if (!isNaN(p) && !isNaN(total)) {
        const ans = (p / 100) * total;
        const rounded = Math.round(ans * 1e10) / 1e10;
        return `${raw} = ${rounded}`;
      }
    }

    // Replace unicode / alternate math symbols
    let clean = raw
      .replace(/\s+/g, "")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/π/gi, "Math.PI")
      .replace(/(?<=[\d\)])x(?=[\d\(])/gi, "*");

    // Common scientific functions support
    const funcs = ["sin", "cos", "tan", "sqrt", "cbrt", "abs", "log", "log2", "log10", "floor", "ceil", "round"];
    for (const fn of funcs) {
      const reg = new RegExp(`(?<!Math\\.)${fn}\\(`, "gi");
      clean = clean.replace(reg, `Math.${fn}(`);
    }
    clean = clean.replace(/(?<!Math\.)pi\b/gi, "Math.PI");
    clean = clean.replace(/(?<!Math\.)e\b/gi, "Math.E");

    const expr = clean.replace(/\^/g, "**").replace(/%/g, "*0.01");
    const isMathString = /^([0-9\.\+\-\*\/\(\)\,\s]|Math\.(PI|E|sin|cos|tan|sqrt|cbrt|abs|log|log2|log10|floor|ceil|round)\()+$/.test(expr);

    if (isMathString && /[\+\-\*\/\%]|Math\./.test(expr) && /\d|Math\./.test(expr)) {
      try {
        const fn = new Function(`return (${expr})`);
        const res = fn();
        if (typeof res === "number" && !isNaN(res) && isFinite(res)) {
          const rounded = Math.round(res * 1e10) / 1e10;
          return `${raw} = ${rounded}`;
        }
      } catch (e) {}
    }

    return null;
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
    const token = ++this.queryToken;
    const calcResult = this.tryCalculate(query);
    const bookmarkMatches = this.findMatchingBookmarks(query);
    const historyMatches = this.getSearchHistory(query);

    let webSuggestions = [];
    if (this.cfg.showSuggestions !== false) {
      try {
        const engine = SEARCH_ENGINES[this.activeEngine] || SEARCH_ENGINES.google;
        const suggUrl = engine.suggUrl || SEARCH_ENGINES.google.suggUrl;
        const res = await fetch(suggUrl + encodeURIComponent(query));
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          // OpenSearch standard format: [query, [suggestions...]]
          webSuggestions = data[1].slice(0, 5).filter(s => typeof s === "string");
        } else if (Array.isArray(data) && data[0] && typeof data[0].phrase === "string") {
          // DuckDuckGo format: [{phrase}, ...]
          webSuggestions = data.slice(0, 5).map(item => item.phrase);
        } else if (Array.isArray(data) && typeof data[0] === "string") {
          webSuggestions = data.slice(0, 5);
        } else if (data && Array.isArray(data.suggestions)) {
          // Ecosia format: { suggestions: [...] }
          webSuggestions = data.suggestions.slice(0, 5).map(s => (typeof s === "string" ? s : s.title || s.phrase || "")).filter(Boolean);
        }
      } catch (e) {}
    }

    if (token !== this.queryToken) return;
    if (!this.input.value.trim()) {
      if (document.activeElement === this.input) {
        this.showRecentHistory();
      } else {
        this.closeSuggestions();
      }
      return;
    }

    this.renderSuggestions({
      query,
      calcResult,
      bookmarkMatches,
      historyMatches,
      webSuggestions
    });
  }

  renderSuggestions({ query, calcResult, bookmarkMatches, historyMatches, webSuggestions }) {
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
        <span class="sugg-badge sugg-calc-badge">Copy</span>
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
            <small class="bm-url" style="opacity:0.6;margin-left:6px;"></small>
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
          <button type="button" class="sugg-del-btn" title="Remove from history" aria-label="Remove">✕</button>
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

    // 4. Web Autocomplete Suggestions
    if (webSuggestions && webSuggestions.length > 0) {
      webSuggestions.forEach((item) => {
        const row = document.createElement("div");
        row.className = "sugg-item sugg-web";
        row.style.setProperty("--si", itemIndex++);
        row.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg> <span></span>`;
        row.querySelector("span").textContent = item;
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          this.input.value = item;
          this.executeSearch(item);
        });
        this.sugg.appendChild(row);
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
    const items = this.sugg ? Array.from(this.sugg.querySelectorAll(".sugg-item")) : [];

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
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
        if (span && !item.classList.contains("sugg-bookmark") && !item.classList.contains("sugg-calc")) {
          this.input.value = span.textContent;
        }
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

    // Check Bangs
    for (const b in BANGS) {
      if (query === b || query.startsWith(b + " ")) {
        const term = query.slice(b.length).trim();
        const dest = term ? BANGS[b] + encodeURIComponent(term) : BANGS[b].split("?")[0];
        if (this.app?.config?.openNewTab) {
          window.open(dest, "_blank", "noopener,noreferrer");
        } else {
          window.location.href = dest;
        }
        return;
      }
    }

    // Default engine search
    const engine = SEARCH_ENGINES[this.activeEngine] || SEARCH_ENGINES.google;
    const dest = engine.url + encodeURIComponent(query);
    if (this.app?.config?.openNewTab) {
      window.open(dest, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = dest;
    }
  }
}

class WidgetsController {
  constructor(app) {
    this.app = app;
    this.clock = new ClockWidget(app.config);
    this.search = new SearchWidget(app.config, app);
  }

  updateClock() {
    this.clock.cfg = this.app.config;
    this.clock.update();
  }

  updateEngineIcon() {
    this.search?.updateEngineIcon();
  }
}
