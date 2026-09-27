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

  const searchUrl = (engine, text) => (ENGINES[engine] ? ENGINES[engine].url + encodeURIComponent(String(text)) : null);

  const here = typeof location !== "undefined" ? detect({ protocol: location.protocol, userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "" }) : detect();
  const api = { ENGINES, detect, searchUrl, ...here };
  root.NordlysPlatform = api;
  if (typeof document !== "undefined") document.documentElement.dataset.browser = here.name;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
