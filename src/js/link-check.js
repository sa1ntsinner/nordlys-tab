/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - CHECKING THE BOOKMARKS
   ═══════════════════════════════════════════════════════════════════

   Settings → Bookmarks → Check the bookmarks: the bookmarks that are on the
   board more than once, and the pages that are no longer there. Read in only
   when someone checks. Each page is asked about once, without cookies. A
   page is called gone only when its own site says so (404, 410), which takes
   leave to read the answer; without that leave, only a site that does not
   answer at all can be told apart.                                       */
(function (root) {
  "use strict";

  // One page however it was written: no fragment, no www, no slash at the end, either scheme.
  function pageOf(url) {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return null;
      return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`;
    } catch (error) { return null; }
  }

  /* The bookmarks that are the same page, each with every place it is on the
     board, in board order: [{ url, places: [{ group, link, folder, name, followed }] }]. */
  function twins(groups) {
    const pages = new Map();
    groups.forEach((group, g) => (group.links || []).forEach((link, l) => {
      const page = pageOf(link.url);
      if (!page) return;
      if (!pages.has(page)) pages.set(page, []);
      pages.get(page).push({ group: g, link: l, folder: group.label || "", name: link.name || "", url: link.url, followed: Boolean(group.source) });
    }));
    return [...pages.values()].filter((places) => places.length > 1).map((places) => ({ url: places[0].url, places }));
  }

  // What a site's answer says about a page: gone only when the site itself says so.
  function verdict(status) {
    if (status === 404 || status === 410) return "gone";
    if (status >= 500) return "error";
    return "ok";
  }

  /* Asks about one page: { state: ok | gone | error | unreachable, status }.
     Readable means Nordlys may read that site's answer; otherwise the
     question is one that reads nothing back (no-cors) and only "does not
     answer" can come of it. */
  async function ask(url, readable, timeout = 10000) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), timeout);
    const options = { credentials: "omit", cache: "no-store", redirect: "follow", referrerPolicy: "no-referrer", signal: control.signal };
    try {
      if (!readable) {
        await fetch(url, { ...options, method: "HEAD", mode: "no-cors" });
        return { state: "ok" };
      }
      let answer = await fetch(url, { ...options, method: "HEAD" });
      // Some sites refuse HEAD, or say "not found" to it, and serve the page to a GET.
      if ([404, 405, 501].includes(answer.status)) {
        answer = await fetch(url, { ...options, method: "GET" });
        answer.body?.cancel().catch(() => {});
      }
      return { state: verdict(answer.status), status: answer.status };
    } catch (error) {
      return { state: "unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }

  /* Every address asked about, a few at a time; told as each one answers.
     Resolves with a Map of address to answer. */
  async function check(urls, readable, onEach = () => {}, width = 6) {
    const queue = [...new Set(urls)];
    const answers = new Map();
    const worker = async () => {
      while (queue.length) {
        const url = queue.shift();
        answers.set(url, await ask(url, readable(url)));
        onEach(answers.size);
      }
    };
    await Promise.all(Array.from({ length: Math.min(width, queue.length) }, worker));
    return answers;
  }

  /* ── The panel: Settings → Bookmarks → Check the bookmarks ─────
     `settings` is the settings drawer (settings.js): its words, the board,
     and the bookmarks list drawn again after a change. Leave to read the
     sites is asked there, in the click, before this is read in. */
  async function run(settings, urls, readable) {
    const button = document.getElementById("check-run");
    const state = document.getElementById("check-state");
    button.disabled = true;
    document.getElementById("check-results").replaceChildren();
    state.textContent = settings.text("check.asking", "Asking each site…");
    let shown = 0;
    const answers = await check(urls, readable, (done) => {
      // Told as it goes, but not at every answer.
      if (Date.now() - shown < 400) return;
      shown = Date.now();
      state.textContent = settings.text("check.progress", `${done} of ${urls.length} asked`, { done, total: urls.length });
    });
    button.disabled = false;
    state.textContent = settings.text("check.done", "Checked {count} pages.", { count: urls.length });
    draw(settings, answers, urls.some((url) => !readable(url)));
  }

  // What the check found: the bookmarks there twice, then the pages that are not there.
  function draw(settings, answers, partly) {
    const out = document.getElementById("check-results");
    if (!out) return;
    const groups = settings.app.config.groups || [];
    const say = (key, fallback, params) => settings.text(key, fallback, params);
    const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
    const button = (text, act, danger = false) => { const node = el("button", `glass-btn small${danger ? " danger" : ""}`, text); node.type = "button"; node.addEventListener("click", act); return node; };
    const row = (name, where, actions) => { const li = el("li", "check-row"); const said = el("span", "check-said"); said.append(el("b", "", name), el("small", "", where)); li.append(said, ...actions); return li; };
    const redraw = () => { settings.app.saveConfig(); settings.app.grid?.render(); settings.renderBookmarksManager(); draw(settings, answers, partly); };
    // Removed by the bookmark itself, so the places of the others never shift under it; Undo puts the folders back as they were.
    const remove = (links, message) => {
      const before = groups.map((group) => [...(group.links || [])]);
      for (const group of groups) if (!group.source) group.links = (group.links || []).filter((link) => !links.includes(link));
      redraw();
      window.NordlysUI?.showUndoToast?.({ message, onAction: () => { groups.forEach((group, index) => { group.links = before[index]; }); redraw(); } });
    };
    const parts = [];
    const doubles = twins(groups);
    if (doubles.length) {
      const list = el("ul", "check-list");
      parts.push(el("h4", "check-title", say("check.twice", "On the board more than once")), list);
      for (const twin of doubles) {
        const [first, ...copies] = twin.places;
        const removable = copies.filter((place) => !place.followed).map((place) => groups[place.group].links[place.link]);
        list.append(row(first.name || twin.url, twin.places.map((place) => place.folder).join(" · "), removable.length
          ? [button(say("check.keepOne", "Keep the first"), () => remove(removable, say("check.removedCopies", "{count} copies removed", { count: removable.length })))]
          : []));
      }
    }
    const SAID = {
      gone: (answer) => say("check.gone", "Not there any more ({status})", { status: answer.status }),
      error: (answer) => say("check.error", "The site has an error ({status})", { status: answer.status }),
      unreachable: () => say("check.unreachable", "Does not answer")
    };
    const broken = [];
    groups.forEach((group) => (group.links || []).forEach((link) => {
      const answer = answers.get(link.url);
      if (answer && answer.state !== "ok") broken.push({ group, link, answer });
    }));
    if (broken.length) {
      const list = el("ul", "check-list");
      parts.push(el("h4", "check-title", say("check.broken", "Pages that are not there")), list);
      for (const { group, link, answer } of broken) {
        const open = el("a", "glass-btn small", say("check.open", "Open"));
        open.href = link.url; open.target = "_blank"; open.rel = "noopener noreferrer";
        // A followed bookmark is removed where it comes from: the browser's bookmarks, or the list.
        const elsewhere = group.source && el("small", "check-followed", group.source.type === "list"
          ? say("follow.inList", "In the list at {site}", { site: settings.app.grid?.siteOf(group) })
          : say("check.followed", "In your browser's bookmarks"));
        list.append(row(link.name || link.url, `${group.label || ""} · ${SAID[answer.state](answer)}`, [open,
          elsewhere || button(say("check.remove", "Remove"), () => remove([link], say("toast.itemDeleted", `${link.name} deleted`, { name: link.name || link.url })), true)]));
      }
    }
    if (!parts.length) parts.push(el("p", "check-clear", say("check.clear", "Nothing to fix: every page answered, and none is on the board twice.")));
    // Without leave to read the sites, a missing page cannot be told from one that is there.
    if (partly) parts.push(el("p", "row-hint", say("check.partly", "Some sites could only be asked whether they answer: without leave to read them, a page that is gone looks like one that is there.")));
    out.replaceChildren(...parts);
  }

  const api = { pageOf, twins, verdict, ask, check, run };
  root.NordlysLinkCheck = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
