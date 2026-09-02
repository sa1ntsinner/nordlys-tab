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
    this.clock = new ClockWidget(app.config);
    this.search = new SearchWidget(app.config, app);
  }

  updateClock() {
    this.clock.cfg = this.app.config;
    this.clock.update();
  }

  refreshLabels() {
    this.search?.refreshLabels();
  }
}
