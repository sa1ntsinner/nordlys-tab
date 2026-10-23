/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - FOLDERS THAT FOLLOW A LIST AT AN ADDRESS
   ═══════════════════════════════════════════════════════════════════

   A list of bookmarks kept at a web address, by a team or by one person for
   every machine they use: a Nordlys backup, a bookmarks file a browser
   exported, JSON, or plain text with one address per line. Its folders come
   onto the board and follow it the way a folder follows the browser's
   bookmarks: read again once an hour has passed, without cookies, the look
   set here kept. Read in only when a board has such a folder, or a bookmarks
   file is imported (the same reading serves both).                       */
(function (root) {
  "use strict";

  const EVERY = 60 * 60 * 1000;
  const LARGEST = 2e6;
  const READ_KEY = "nordlys_lists_read";

  const web = (url) => typeof url === "string" && /^https?:\/\/[^\s]+$/i.test(url);
  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (error) { return url; } };

  function link(url, name) {
    const address = typeof url === "string" ? url.trim() : "";
    if (!web(address)) return null;
    const named = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    return { name: named || host(address), url: address };
  }

  function folder(label, links) {
    const kept = (links || []).filter(Boolean);
    return kept.length ? { label: typeof label === "string" ? label.trim() : "", links: kept } : null;
  }

  // What a list that does not name its folder is called: its file, else its site.
  function nameOf(address) {
    try {
      const url = new URL(address);
      const file = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").replace(/\.[a-z0-9]+$/i, "");
      return file || url.hostname.replace(/^www\./, "");
    } catch (error) { return ""; }
  }

  // JSON: a Nordlys backup, folders ([{ label, links }]), links ([{ name, url }] or addresses), or { links }.
  function fromJson(value) {
    const linkOf = (item) => (typeof item === "string" ? link(item) : link(item?.url ?? item?.href, item?.name ?? item?.title));
    const groups = Array.isArray(value?.groups) ? value.groups
      : Array.isArray(value) && value.some((item) => Array.isArray(item?.links)) ? value : null;
    if (groups) return groups.map((group) => folder(group?.label ?? group?.name ?? group?.title, (Array.isArray(group?.links) ? group.links : []).map(linkOf)));
    const links = Array.isArray(value) ? value : Array.isArray(value?.links) ? value.links : [];
    return [folder(value?.label ?? value?.name ?? value?.title, links.map(linkOf))];
  }

  /* Plain text or Markdown: an address on each line, named by the words beside
     it ("Docs https://…", "- [Docs](https://…)", "Docs: https://…"). A line
     without one that is a heading ("# Work") or ends in a colon starts a
     folder; any other line is left alone. */
  function fromText(text) {
    const folders = [{ label: "", links: [] }];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      const markdown = line.match(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/i);
      const bare = markdown ? null : line.match(/https?:\/\/[^\s<>"'`]+/i);
      if (markdown || bare) {
        const url = markdown ? markdown[2] : bare[0].replace(/[.,;:!?)\]]+$/, "");
        const name = markdown ? markdown[1] : line.replace(bare[0], " ").replace(/^(?:[-*+•>]|\d+[.)])\s+/, "").replace(/[\s:|–—-]+$/, "").replace(/^[\s:|–—-]+/, "");
        folders.at(-1).links.push(link(url, name));
      } else if (/^#+\s*\S/.test(line) || /\S:$/.test(line)) {
        folders.push({ label: line.replace(/^#+\s*/, "").replace(/:$/, ""), links: [] });
      }
    }
    return folders.map((each) => folder(each.label, each.links));
  }

  /* A bookmarks file a browser exported, or any page of links; addresses are
     read against the list's own. A folder inside a folder is a folder of its
     own, named by its path ("Work / Docs"), and each link comes over once:
     into the folder it sits in, not into every folder above it too. */
  function fromHtml(text, base) {
    const dom = new DOMParser().parseFromString(text, "text/html");
    const absolute = (href) => { try { return new URL(String(href || "").trim(), base || undefined).href; } catch (error) { return null; } };
    const linksIn = (scope, here) => [...scope.querySelectorAll("a")].filter(here).map((a) => link(absolute(a.getAttribute("href")), a.textContent));
    const headers = [...dom.querySelectorAll("h3")];
    if (!headers.length) return [folder("", linksIn(dom, () => true))];
    const listOf = (h3) => [...(h3.parentElement?.children || [])].find((child) => child.tagName === "DL")
      || (h3.nextElementSibling?.tagName === "DL" ? h3.nextElementSibling : null);
    const pathOf = (h3) => {
      const names = [h3.textContent.trim()];
      for (let dl = h3.parentElement?.parentElement?.closest("dl"); dl; dl = dl.parentElement?.closest("dl")) {
        const above = [...(dl.parentElement?.children || [])].find((child) => child.tagName === "H3");
        if (above && listOf(above) === dl) names.unshift(above.textContent.trim());
      }
      return names.filter(Boolean).join(" / ");
    };
    return headers.map((h3) => {
      const list = listOf(h3);
      return list ? folder(pathOf(h3), linksIn(list, (a) => a.closest("dl") === list)) : null;
    });
  }

  /* The folders a list holds, each { label, links }, only web addresses kept.
     A folder the list does not name is called `unnamed` (by default after the
     list's file or site). Empty when there is nothing to keep. */
  function parse(text, address = "", unnamed = nameOf(address)) {
    let body = String(text || "");
    if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
    const trimmed = body.trim();
    let folders = null;
    if (/^[[{]/.test(trimmed)) {
      try { folders = fromJson(JSON.parse(trimmed)); } catch (error) { folders = null; }
    }
    if (!folders) folders = /<(!doctype|html|dl|a)\b/i.test(body) && typeof DOMParser === "function" ? fromHtml(body, address) : fromText(body);
    return folders.filter(Boolean).map((each) => ({ label: each.label || unnamed, links: each.links }));
  }

  /* Each link the list brings keeps what was set on it here (its icon,
     colour, its id for sync), matched by address in order, so two links to
     one page keep one each. The list owns the name and the address. */
  function keepLooks(fresh, previous) {
    const before = new Map();
    for (const old of previous || []) {
      if (typeof old?.url === "string") before.set(old.url, [...(before.get(old.url) || []), old]);
    }
    return fresh.map((each) => {
      const old = before.get(each.url)?.shift();
      return old ? { ...old, name: each.name, url: each.url } : { ...each };
    });
  }

  // When each list was last read: kept on this device, so its tabs ask once an hour between them.
  const memory = {};
  function readTimes() {
    try { return JSON.parse(localStorage.getItem(READ_KEY)) || {}; } catch (error) { return memory; }
  }
  function markRead(url, now = Date.now()) {
    const times = readTimes();
    times[url] = now;
    try { localStorage.setItem(READ_KEY, JSON.stringify(times)); } catch (error) { Object.assign(memory, times); }
  }

  async function read(url) {
    const response = await fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.timeout?.(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > LARGEST) throw new Error("too large");
    return text;
  }

  /* Reads each list the board follows that has not been read for an hour and
     puts what it holds into the folders that follow it. A list that cannot be
     read leaves them as they are; a folder the list no longer has is marked
     missing, never emptied. Resolves true when a folder changed. */
  async function refresh(groups, { now = Date.now(), fetchText = read } = {}) {
    const following = (groups || []).filter((group) => group?.source?.type === "list" && web(group.source.url));
    const times = readTimes();
    const due = [...new Set(following.map((group) => group.source.url))].filter((url) => now - (Number(times[url]) || 0) >= EVERY);
    let changed = false;
    for (const url of due) {
      markRead(url, now);
      let folders;
      try { folders = parse(await fetchText(url), url); } catch (error) { continue; }
      // A list of one folder that one folder follows still matches when the list renamed it.
      const alone = folders.length === 1 && following.filter((group) => group.source.url === url).length === 1 ? folders[0] : null;
      for (const group of following) {
        // "Stop following" may have landed while the list was being read.
        if (group.source?.url !== url) continue;
        const found = folders.find((each) => each.label === group.source.folder) || alone;
        if (!found) {
          if (!group.source.missing) { group.source.missing = true; changed = true; }
          continue;
        }
        if (group.source.missing) { delete group.source.missing; changed = true; }
        const links = keepLooks(found.links, group.links);
        if (JSON.stringify(links) !== JSON.stringify(group.links || [])) { group.links = links; changed = true; }
      }
    }
    return changed;
  }

  const api = { parse, refresh, read, markRead, keepLooks, nameOf, EVERY };
  root.NordlysLists = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
