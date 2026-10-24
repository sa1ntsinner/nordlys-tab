/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHICH BROWSER THIS IS, AND WHAT IT CAN DO
   ═══════════════════════════════════════════════════════════════════

   One package runs in Chrome, Edge, Firefox and Safari. What differs is
   answered here, once, rather than guessed at in each file:

     faviconCache   Chrome and Edge serve site icons from /_favicon/
     searchEngines  where the browser has no search API (Safari), the
                    person picks an engine; Nordlys never picks one for them */
(function (root) {
  "use strict";

  // Only the Safari build fills this in (search-engines.js).
  const ENGINES = root.NordlysSearchEngines || {};

  function detect({ protocol, userAgent } = {}) {
    const ua = String(userAgent || "");
    let name = "web";
    if (protocol === "moz-extension:") name = "firefox";
    else if (protocol === "safari-web-extension:") name = "safari";
    else if (protocol === "chrome-extension:") name = /\bEdg\//.test(ua) ? "edge" : "chrome";
    // Known to be missing only where it is: a plain page (tests, the demo)
    // behaves as Chrome does.
    return { name, faviconCache: name !== "firefox" && name !== "safari" };
  }

  /* Where a review of this copy goes: the store it came from. A Chromium
     store writes its update address into the installed manifest, so Brave,
     Opera or an Edge that took it from the Chrome Web Store go there, and an
     Edge copy from Edge's own store goes to its page there. Every Firefox
     family browser has AMO. Safari is not in the App Store yet, and a copy
     loaded by hand has no store: neither is asked. */
  const CHROME_STORE_ID = "fepiibfbbjhaoldgcfpfcikbonnjbfdc";
  function reviewUrl({ name, id, updateUrl } = {}) {
    const from = String(updateUrl || "");
    if (name === "firefox") return "https://addons.mozilla.org/firefox/addon/nordlys/reviews/";
    if (/^https:\/\/edge\.microsoft\.com\//.test(from) && /^[a-p]{32}$/.test(id || "")) return `https://microsoftedge.microsoft.com/addons/detail/${id}`;
    if (/^https:\/\/clients2\.google\.com\//.test(from)) return `https://chromewebstore.google.com/detail/${CHROME_STORE_ID}/reviews`;
    return null;
  }

  const searchUrl = (engine, text) => (ENGINES[engine] ? ENGINES[engine].url + encodeURIComponent(String(text)) : null);

  const here = typeof location !== "undefined" ? detect({ protocol: location.protocol, userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "" }) : detect();
  const api = { ENGINES, detect, searchUrl, reviewUrl, ...here };
  root.NordlysPlatform = api;
  if (typeof document !== "undefined") document.documentElement.dataset.browser = here.name;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
