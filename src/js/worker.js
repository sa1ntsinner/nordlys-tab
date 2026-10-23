/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE ADDRESS BAR AND THE RIGHT-CLICK MENU
   ═══════════════════════════════════════════════════════════════════

   "nl" and a space in the address bar hands what follows to Nordlys. The
   person's keywords and the bookmarks on the board answer there as they do
   in the search box (search-sources.js), and anything else is searched with
   the browser's own engine. The browser shows whose answers they are, so
   they carry no words that would need translating.

   "Save to Nordlys" on a page or a link puts it in nordlys_inbox, where the
   next new tab in view takes it onto the board (app.js, takeInbox); the
   page names these menu items in the person's language. This worker reads
   the saved config when asked and writes nothing but the inbox. */
/* global NordlysSearchSources, importScripts */
// A worker in Chrome and Edge; Firefox loads the two scripts beside this one.
if (typeof importScripts === "function") importScripts("commands.js", "search-sources.js");

(function () {
  "use strict";

  // Chrome and Edge style the text with a little XML; Firefox shows it as it is.
  const MARKUP = !chrome.runtime.getURL("").startsWith("moz-extension:");
  const xml = (text) => String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  const tag = (name, text) => (MARKUP ? `<${name}>${xml(text)}</${name}>` : String(text));
  const plain = (text) => (MARKUP ? xml(text) : String(text));

  const config = () => new Promise((resolve) => chrome.storage.local.get("nordlys_config", (items) => resolve(items?.nordlys_config || {})));

  // What the words lead to: a keyword first, then the bookmarks on the board.
  async function answers(text) {
    const saved = await config();
    const sources = NordlysSearchSources;
    const out = [];
    const golink = sources.keyword(saved.golinks, text);
    if (golink) out.push({ content: golink.url, description: `${tag("match", golink.key)} ${plain(golink.words || sources.hostOf(golink.url))} ${tag("url", golink.url)}` });
    for (const link of sources.board(saved.groups, text, 5)) {
      if (!link.url || out.some((answer) => answer.content === link.url)) continue;
      out.push({ content: link.url, description: `${plain(link.name || sources.hostOf(link.url))} ${tag("dim", link.groupLabel)} ${tag("url", link.url)}` });
    }
    return out;
  }

  function go(url, disposition) {
    if (disposition === "currentTab") chrome.tabs.update({ url });
    else chrome.tabs.create({ url, active: disposition !== "newBackgroundTab" });
  }

  // The first answer is what Enter does, so it stands where the typed text would.
  /* ── Save to Nordlys ────────────────────────────────────────── */
  chrome.runtime.onInstalled?.addListener(() => {
    chrome.contextMenus?.create({ id: "nordlys-save-page", title: "Save to Nordlys", contexts: ["page"] }, () => void chrome.runtime.lastError);
    chrome.contextMenus?.create({ id: "nordlys-save-link", title: "Save link to Nordlys", contexts: ["link"] }, () => void chrome.runtime.lastError);
  });
  chrome.contextMenus?.onClicked.addListener((info, tab) => {
    const url = info.menuItemId === "nordlys-save-link" ? info.linkUrl : info.pageUrl;
    if (!/^https?:\/\//i.test(url || "")) return;
    const name = info.menuItemId === "nordlys-save-link" ? info.selectionText || "" : tab?.title || "";
    chrome.storage.local.get("nordlys_inbox", (items) => {
      const waiting = Array.isArray(items?.nordlys_inbox) ? items.nordlys_inbox : [];
      chrome.storage.local.set({ nordlys_inbox: [...waiting, { url, name: name.slice(0, 120), folder: null, at: Date.now() }] });
    });
  });

  /* ── Sites kept shut while a focus runs ───────────────────────
     The sites a focus timer card lists (its settings, in the saved config)
     stay shut while a focus runs: a tab that goes to one is sent to a quiet
     page (blocked.html) that goes on to the site once no focus runs. A tab's
     address reaches this worker only with the "tabs" leave, asked for when
     the list is set; without it, nothing here ever hears one. */
  const focusTimer = () => new Promise((resolve) => chrome.storage.local.get("nordlys_dash.focus-timer", (items) => resolve(items?.["nordlys_dash.focus-timer"] || null)));
  // When the focus that runs ends (a count-up one, never), or 0 when none runs; blocked.js reads it the same way.
  const focusEnds = (timer, now) => (!timer?.running || timer.phase !== "focus" ? 0 : timer.mode === "countup" ? Infinity : timer.endsAt > now ? timer.endsAt : 0);
  const siteOf = (line) => {
    try { return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(line) ? line : `https://${line}`).hostname.replace(/^www\./, ""); } catch (error) { return ""; }
  };
  const shutSites = (saved) => (saved.dashboard?.widgets || []).filter((widget) => widget?.type === "timer")
    .flatMap((widget) => String(widget.settings?.shut || "").split(/[\s,]+/)).map(siteOf).filter(Boolean);
  chrome.tabs?.onUpdated?.addListener(async (tabId, change) => {
    if (!/^https?:\/\//i.test(change.url || "")) return;
    const [saved, timer] = await Promise.all([config(), focusTimer()]);
    if (!focusEnds(timer, Date.now())) return;
    const host = new URL(change.url).hostname.replace(/^www\./, "");
    if (!shutSites(saved).some((site) => host === site || host.endsWith(`.${site}`))) return;
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`blocked.html?u=${encodeURIComponent(change.url)}`) });
  });

  /* ── nl in the address bar ─────────────────────────────────── */
  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const found = await answers(text);
    chrome.omnibox.setDefaultSuggestion({ description: found[0]?.description || tag("match", text) });
    suggest(found.slice(1));
  });

  chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
    // A chosen suggestion arrives as its address.
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(text)) return go(text, disposition);
    const [first] = await answers(text);
    if (first) return go(first.content, disposition);
    chrome.search?.query({ text, disposition: disposition === "currentTab" ? "CURRENT_TAB" : "NEW_TAB" })?.catch?.(() => {});
  });

})();
