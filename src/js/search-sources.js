/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHERE THE SEARCH BOX LOOKS
   ═══════════════════════════════════════════════════════════════════

   Besides its answers (calc.js, convert.js) and the searches made before,
   the search box finds the bookmarks on the board and the place in Settings
   that does a thing. Where the person turned them on in Settings → General,
   and the browser gave its leave, it also finds open tabs, the browser's own
   bookmarks and pages from its history.

   All of it is read on the device, from the page and from the browser's own
   lists through the browser's own APIs; none of it goes anywhere. Every
   finder is ranked by commands.js's score, the same reading the commands
   get, so "git" finds GitHub here as it does after ">". */
(function () {
  "use strict";

  // commands.js's reading of a query against a name.
  const score = (query, name) => globalThis.NordlysCommands.score(query, name);
  const SOURCES = ["tabs", "bookmarks", "history"];
  // What each source needs the browser's leave for.
  const PERMISSION = { tabs: "tabs", bookmarks: "bookmarks", history: "history" };

  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (error) { return ""; }
  };

  /* The items whose best field answers the query, best first and otherwise
     in the order they came. A field is weighed below 1 when it matters less
     than the name. */
  function rank(query, items, fields, limit) {
    const q = String(query || "").trim();
    if (!q) return [];
    return items
      .map((item, index) => ({ item, index, score: Math.max(0, ...fields.map(([field, weight]) => score(q, field(item)) * weight)) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, limit)
      .map((entry) => entry.item);
  }

  // The bookmarks on the board, by name, then address, then folder.
  function board(groups, query, limit = 4) {
    const links = (groups || []).flatMap((group) => (group.links || []).map((link) => ({ ...link, groupLabel: group.label || "" })));
    return rank(query, links, [[(link) => link.name, 1], [(link) => hostOf(link.url), 0.9], [(link) => link.groupLabel, 0.5]], limit);
  }

  /* ── What is usually opened at this hour ─────────────────────
     How often each bookmark was opened in each hour of the day: { day,
     urls: { address: [24 counts] } }, kept on this device (widgets.js). Each
     day that passes takes a twentieth off every count, so a habit given up
     fades in a few weeks; past 300 pages the least opened are forgotten. */
  const DAY = 864e5;
  function noteOpen(rhythm, url, now = Date.now()) {
    const kept = rhythm && typeof rhythm.urls === "object" && rhythm.urls ? rhythm : { day: 0, urls: {} };
    const day = Math.floor(now / DAY);
    if (kept.day && day > kept.day) {
      const fade = 0.95 ** (day - kept.day);
      for (const [address, hours] of Object.entries(kept.urls)) {
        const left = hours.map((count) => Math.round(count * fade * 100) / 100);
        if (left.some((count) => count >= 0.5)) kept.urls[address] = left; else delete kept.urls[address];
      }
    }
    kept.day = Math.max(kept.day || 0, day);
    (kept.urls[url] ||= Array(24).fill(0))[new Date(now).getHours()] += 1;
    const total = (address) => kept.urls[address].reduce((sum, count) => sum + count, 0);
    const pages = Object.keys(kept.urls);
    if (pages.length > 300) pages.sort((a, b) => total(a) - total(b)).slice(0, pages.length - 300).forEach((address) => delete kept.urls[address]);
    return kept;
  }

  // The bookmarks on the board opened most around this hour, about three times lately at least, best first.
  function usual(groups, rhythm, now = Date.now(), limit = 3) {
    const hour = new Date(now).getHours();
    const near = (hours) => (hours[hour] || 0) + ((hours[(hour + 23) % 24] || 0) + (hours[(hour + 1) % 24] || 0)) / 2;
    const seen = new Set();
    return (groups || []).flatMap((group) => (group.links || []).map((link) => ({ ...link, groupLabel: group.label || "" })))
      .map((link) => ({ link, score: near(rhythm?.urls?.[link.url] || []) }))
      .filter(({ link, score }) => score >= 2.5 && !seen.has(link.url) && seen.add(link.url))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ link }) => link);
  }

  /* ── Keywords ──────────────────────────────────────────────── */
  /* A keyword the person set up in Settings → General: "gh" alone opens its
     site, "gh nordlys" puts the rest where its address has %s. An address
     without %s takes no words after its keyword, so "gh is down" stays a
     search when gh is only a bookmark. */
  const KEYWORD = /^[\p{L}\p{N}._-]{1,24}$/u;
  function keyword(golinks, query) {
    const [, key, rest = ""] = /^(\S+)(?:\s+(.*))?$/su.exec(String(query || "").trim()) || [];
    const link = key && (Array.isArray(golinks) ? golinks : []).find((entry) => typeof entry?.url === "string" && String(entry.key).toLowerCase() === key.toLowerCase());
    if (!link) return null;
    const words = rest.trim();
    const template = link.url.includes("%s");
    if (words && !template) return null;
    try {
      const url = new URL(!template ? link.url : words ? link.url.split("%s").join(encodeURIComponent(words)) : new URL(link.url.split("%s").join("")).origin);
      return /^https?:$/.test(url.protocol) ? { key: link.key, url: url.href, words } : null;
    } catch (error) { return null; }
  }

  /* ── Settings ──────────────────────────────────────────────── */
  // What a row is called: its words, without the hint under them or its control.
  function textOf(node) {
    let text = "";
    for (const child of node.childNodes) {
      if (child.nodeType === 3) text += child.textContent;
      else if (child.nodeType === 1 && !child.matches("small, svg, input, select, textarea, .tg, .nl-select, .nl-visually-hidden")) text += textOf(child);
    }
    return text;
  }
  const PLACES = "h3, .settings-block-label, .board-layout-name, .scene-name, .row > :first-child";

  /* The places in Settings a query names: a heading, a row, a choice. Each
     comes with its section's name and the element to bring into view. */
  function settings(root, query, limit = 2) {
    if (!root || String(query || "").trim().length < 2) return [];
    const found = [];
    for (const section of root.querySelectorAll(".csec[id^='sec-']")) {
      const tab = section.id.slice(4);
      const tabName = root.querySelector(`.ctab[data-tab="${tab}"]`)?.textContent.trim() || tab;
      for (const node of section.querySelectorAll(PLACES)) {
        // Hidden within its section (a browser without the thing); the section itself is only another tab.
        const off = node.closest("[hidden]");
        if (off && off !== section && section.contains(off)) continue;
        const name = textOf(node).replace(/\s+/g, " ").trim();
        if (name && name.length <= 80) found.push({ name, tab, tabName, node: node.closest(".row, .board-layout-option, .scene-card") || node });
      }
    }
    const seen = new Set();
    return rank(query, found, [[(place) => place.name, 1]], limit * 3).filter((place) => !seen.has(place.node) && seen.add(place.node)).slice(0, limit);
  }

  /* ── The browser's own lists ───────────────────────────────── */
  const api = () => (typeof chrome !== "undefined" ? chrome : null);
  const leave = {};
  /* Whether the browser gave leave for a source. Asked once a page, and
     again when Settings asks for it or takes it back (forget). */
  function granted(source) {
    if (!PERMISSION[source]) return Promise.resolve(false);
    if (leave[source] !== undefined) return leave[source];
    leave[source] = new Promise((resolve) => {
      const permissions = api()?.permissions;
      if (!permissions?.contains) { resolve(false); return; }
      try { permissions.contains({ permissions: [PERMISSION[source]] }, (yes) => resolve(Boolean(yes))); }
      catch (error) { resolve(false); }
    });
    return leave[source];
  }
  const forget = (source) => { delete leave[source]; };

  // A callback API as a promise that gives up after a moment rather than hold the list.
  const ask = (call) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), 300);
    try { call((result) => { clearTimeout(timer); resolve(result || []); }); }
    catch (error) { clearTimeout(timer); resolve([]); }
  });

  // Open tabs other than this one, by title, then address.
  async function tabs(query, { exclude = new Set(), self = "", limit = 3 } = {}) {
    if (!(await granted("tabs"))) return [];
    const all = await ask((done) => api().tabs.query({}, done));
    const open = all.filter((tab) => tab.url && !(self && tab.url.startsWith(self)) && !exclude.has(tab.url));
    return rank(query, open, [[(tab) => tab.title, 1], [(tab) => hostOf(tab.url), 0.9]], limit)
      .map((tab) => ({ id: tab.id, windowId: tab.windowId, name: tab.title || hostOf(tab.url), url: tab.url }));
  }

  // The browser's bookmarks not already on the board, with the folder each is in.
  async function bookmarks(query, { exclude = new Set(), limit = 3 } = {}) {
    if (!(await granted("bookmarks"))) return [];
    const hits = (await ask((done) => api().bookmarks.search(String(query), done))).filter((node) => node.url && !exclude.has(node.url));
    const top = rank(query, hits, [[(node) => node.title, 1], [(node) => hostOf(node.url), 0.9]], limit);
    const parents = top.length ? await ask((done) => api().bookmarks.get([...new Set(top.map((node) => node.parentId).filter(Boolean))], done)) : [];
    const folder = new Map(parents.map((node) => [node.id, node.title]));
    return top.map((node) => ({ name: node.title || hostOf(node.url), url: node.url, folder: folder.get(node.parentId) || "" }));
  }

  // Pages from history, most visited first among those that answer.
  async function history(query, { exclude = new Set(), limit = 3 } = {}) {
    if (!(await granted("history"))) return [];
    const pages = (await ask((done) => api().history.search({ text: String(query), startTime: 0, maxResults: 30 }, done)))
      .filter((page) => page.url && /^https?:/.test(page.url) && !exclude.has(page.url))
      .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
    return rank(query, pages, [[(page) => page.title, 1], [(page) => hostOf(page.url), 0.9]], limit)
      .map((page) => ({ name: page.title || hostOf(page.url), url: page.url }));
  }

  const NordlysSearchSources = { SOURCES, PERMISSION, KEYWORD, rank, board, usual, noteOpen, keyword, settings, textOf, tabs, bookmarks, history, granted, forget, hostOf };
  // globalThis, not window: the extension's worker (worker.js) reads keywords and the board too.
  globalThis.NordlysSearchSources = NordlysSearchSources;
  if (typeof module === "object" && module.exports) module.exports = NordlysSearchSources;
})();
