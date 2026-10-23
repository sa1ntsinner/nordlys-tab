/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - "nl" IN THE ADDRESS BAR
   ═══════════════════════════════════════════════════════════════════

   "nl" and a space in the address bar hands what follows to Nordlys. The
   person's keywords and the bookmarks on the board answer there as they do
   in the search box (search-sources.js), and anything else is searched with
   the browser's own engine. It reads the saved config when asked and keeps
   nothing of its own; the browser shows whose answers they are, so they
   carry no words that would need translating. */
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
