/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SEARCH ENGINES, FOR A BROWSER WITHOUT A SEARCH API
   ═══════════════════════════════════════════════════════════════════

   Safari gives extensions no way to search with the engine set in the
   browser, so there the person picks one in Settings → General. Chrome,
   Edge and Firefox search through the browser, and their builds carry
   this file empty (tools/build-ports.cjs): they offer no choice at all. */
(function (root) {
  "use strict";
  const ENGINES = {
    google: { name: "Google", url: "https://www.google.com/search?q=" },
    duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
    bing: { name: "Bing", url: "https://www.bing.com/search?q=" },
    ecosia: { name: "Ecosia", url: "https://www.ecosia.org/search?q=" },
    brave: { name: "Brave Search", url: "https://search.brave.com/search?q=" },
    startpage: { name: "Startpage", url: "https://www.startpage.com/do/search?q=" },
    kagi: { name: "Kagi", url: "https://kagi.com/search?q=" },
    yandex: { name: "Yandex", url: "https://yandex.com/search/?text=" }
  };
  root.NordlysSearchEngines = ENGINES;
  if (typeof module !== "undefined" && module.exports) module.exports = ENGINES;
})(typeof globalThis !== "undefined" ? globalThis : this);
