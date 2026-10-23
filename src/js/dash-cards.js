/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE CARDS FEW PEOPLE ADD
   ═══════════════════════════════════════════════════════════════════

   Feeds, a value from the web, the open tabs and the tabs closed lately.
   A tab reads this file only once one of these cards is on its dashboard
   (TYPES[type].files in dashboard.js), so a page without them never pays
   for them. What a card works out is pure and tested (tidy); the rest
   draws and asks the browser, with leave for each site or permission
   asked from the click that needs it.                                   */
(function (root) {
  "use strict";

  const IDLE_DAYS = 3;
  /* The tabs worth a look: pages open twice (the copy kept is the one in
     front, else the one looked at last) and pages nobody has looked at for
     days. A pinned tab, one playing sound or the one in front is never
     "left"; Nordlys's own pages are none of this. */
  function tidy(tabs, now = Date.now(), self = "") {
    const web = tabs.filter((tab) => /^https?:/i.test(tab.url || "") && !(self && tab.url.startsWith(self)));
    const byPage = new Map();
    for (const tab of web) {
      const page = tab.url.replace(/#.*$/, "");
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page).push(tab);
    }
    const rank = (tab) => (tab.active ? Infinity : tab.lastAccessed || 0);
    const twice = [...byPage.values()].filter((same) => same.length > 1).map((same) => {
      const [keep, ...extra] = [...same].sort((a, b) => rank(b) - rank(a));
      return { keep, extra };
    });
    const copies = new Set(twice.flatMap((group) => group.extra.map((tab) => tab.id)));
    const left = web.filter((tab) => !copies.has(tab.id) && !tab.pinned && !tab.active && !tab.audible && tab.lastAccessed && now - tab.lastAccessed >= IDLE_DAYS * 86400e3)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    return { count: tabs.length, windows: new Set(tabs.map((tab) => tab.windowId)).size, twice, left };
  }

  function register(D) {
    const { el, icon, say, locale, explain, fadeWhenMore, pageIcon, ICONS } = D.kit;
    const T = D.TYPES;
    const F = root.NordlysFeeds;
    const C = root.NordlysConnectors;
    const api = () => (typeof chrome !== "undefined" ? chrome : null);
    const self = (() => { try { return api()?.runtime?.getURL?.("") || location.origin; } catch (error) { return location.origin; } })();
    const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (error) { return url; } };
    const originsOf = (urls) => [...new Set(urls.filter((url) => /^https:\/\//i.test(url)).map((url) => `${new URL(url).origin}/*`))];
    const clock = (at) => new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit" }).format(at);
    const ago = (at) => {
      const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));
      const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto", style: "short" });
      if (minutes < 60) return rtf.format(-minutes, "minute");
      if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), "hour");
      if (minutes < 10080) return rtf.format(-Math.round(minutes / 1440), "day");
      return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(at);
    };
    // Whether the browser holds these permissions; asking for them happens only from a click.
    const holds = (permissions) => new Promise((resolve) => {
      const perms = api()?.permissions;
      if (!perms?.contains) { resolve(true); return; }
      perms.contains({ permissions }, (yes) => { void api().runtime?.lastError; resolve(Boolean(yes)); });
    });
    const ask = (permissions) => new Promise((resolve) => {
      const perms = api()?.permissions;
      if (!perms?.request) { resolve(true); return; }
      perms.request({ permissions }, (yes) => { void api().runtime?.lastError; resolve(Boolean(yes)); });
    });
    const refreshButton = (card, refresh) => el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.refresh", "Refresh"), title: say("dash.refresh", "Refresh"), disabled: card.loading || undefined, onclick: () => refresh(true) }, icon(ICONS.reset));
    /* What went wrong reading a site: leave not given yet reads as a way to
       give it; anything else, as what happened. */
    const trouble = (card, failure, urls, refresh) => (failure.leave
      ? el("button", { type: "button", class: "dash-link dash-leave", text: say("dash.leaveFor", "Allow reading {site}", { site: failure.site }), onclick: () => card.app.dashboard.askLeave(originsOf(urls)).then((yes) => { if (yes) refresh(true); }) })
      : el("span", { class: "dash-inbox-error", text: failure.text, title: failure.text }));
    const failureOf = async (card, error, url) => {
      const missing = await card.app.dashboard.withoutLeave(originsOf([url]));
      return { leave: missing.length > 0, site: hostOf(url), text: `${hostOf(url)}: ${explain(error)}` };
    };
    const emptyCard = (text, action, run) => el("div", { class: "dash-app-empty" }, [
      el("p", { text }),
      action ? el("button", { type: "button", class: "dash-cta", onclick: run }, [icon(ICONS.plus), el("span", { text: action })]) : null
    ]);

    // ── Feeds ──────────────────────────────────────────────────────
    const feedsOf = (text) => [...new Set(String(text || "").split(/\n+/).map((line) => F.address(line)).filter(Boolean))].slice(0, 12);
    // A feed, or the feed a page names in its head.
    const readFeed = async (url) => {
      const text = await C.fetchOne({ url, text: true });
      let feed = F.parse(text, url);
      const found = feed ? null : F.discover(text, url)[0];
      if (found) feed = F.parse(await C.fetchOne({ url: found, text: true }), found);
      if (!feed) throw new Error(say("dash.feedsNone", "There is no feed at this address."));
      return { title: feed.title || hostOf(url), items: feed.items.map((it) => ({ ...it, feed: url })) };
    };
    // Read again every half hour; five minutes after a feed failed.
    const feedsPeriod = (card) => (Object.keys(card.data.failures || {}).length ? 5 : 30) * 60e3;
    Object.assign(T.feeds, {
      named: true,
      settings: [{
        key: "feeds", type: "textarea", value: "", spellcheck: "false",
        label: () => say("dash.feedsList", "Feeds, one on each line"),
        hint: () => say("dash.feedsHint", "A site or its feed, r/ with a subreddit, a YouTube channel, or hn for Hacker News."),
        placeholder: () => "hn\nr/space\nhttps://blog.example"
      }],
      origins: (values) => originsOf(feedsOf(values.feeds)),
      data: () => ({ items: [], names: {}, failures: {}, at: 0, key: "", filter: "" }),
      draw(card) {
        const chips = el("div", { class: "dash-tabs dash-source-chips", role: "tablist", "aria-label": card.title() });
        const list = el("div", { class: "dash-feed" });
        const foot = el("div", { class: "dash-foot" });
        const refresh = async (force = false) => {
          const urls = feedsOf(card.settings.feeds);
          const key = urls.join(" ");
          const fresh = card.data.key === key && Date.now() - (card.data.at || 0) < feedsPeriod(card);
          if (!urls.length || card.loading || (fresh && !force)) { render(); return; }
          card.loading = true;
          render();
          const results = await Promise.allSettled(urls.map(readFeed));
          const names = {};
          const failures = {};
          await Promise.all(results.map(async (result, index) => {
            if (result.status === "fulfilled") names[urls[index]] = result.value.title;
            else failures[urls[index]] = await failureOf(card, result.reason, urls[index]);
          }));
          card.loading = false;
          // A feed that failed this time keeps what it showed before.
          const kept = (card.data.items || []).filter((it) => failures[it.feed]);
          card.data = { ...card.data, key, at: Date.now(), names: { ...card.data.names, ...names }, failures, items: F.merge([...results.filter((r) => r.status === "fulfilled").map((r) => r.value.items), kept], 80) };
          card.save();
          render();
        };
        const render = () => {
          const urls = feedsOf(card.settings.feeds);
          card.root.classList.toggle("is-loading", Boolean(card.loading));
          if (!urls.length) {
            chips.replaceChildren();
            foot.replaceChildren();
            list.replaceChildren(emptyCard(say("dash.feedsEmpty", "Headlines from what you read: blogs, news, a subreddit, YouTube channels."), say("dash.feedsAdd", "Add feeds"), () => card.openSettings()));
            return;
          }
          const name = (url) => card.data.names?.[url] || hostOf(url);
          const filter = urls.includes(card.data.filter) ? card.data.filter : "";
          chips.replaceChildren(...(urls.length > 1 ? [["", say("dash.viewAll", "All")], ...urls.map((url) => [url, name(url)])].map(([url, text]) => el("button", {
            type: "button", role: "tab", class: "dash-tab", "aria-selected": String(filter === url), tabindex: filter === url ? "0" : "-1", title: text,
            onclick: () => { card.data.filter = url; card.save({ soon: true }); render(); }
          }, el("span", { text }))) : []));
          const items = (card.data.items || []).filter((it) => urls.includes(it.feed) && (!filter || it.feed === filter));
          list.replaceChildren(...(items.length ? items.map((it) => el("a", { class: "dash-feed-row", href: it.url, target: "_blank", rel: "noopener" }, [
            el("span", { class: "dash-feed-title", text: it.title }),
            el("span", { class: "dash-task-meta", text: [urls.length > 1 && !filter ? name(it.feed) : "", it.at ? ago(it.at) : ""].filter(Boolean).join(" · ") })
          ])) : [el("p", { class: "dash-tasks-empty", text: card.loading ? say("dash.inboxLoading", "Looking…") : say("dash.feedsQuiet", "Nothing in these feeds yet.") })]));
          fadeWhenMore(list);
          const failed = urls.filter((url) => card.data.failures?.[url]);
          foot.replaceChildren(
            failed.length ? trouble(card, card.data.failures[failed[0]], failed, refresh) : el("span", { text: card.data.at ? say("dash.inboxAt", "Updated {time}", { time: clock(card.data.at) }) : "" }),
            refreshButton(card, refresh)
          );
        };
        card.update = render;
        card.reload = () => refresh(true);
        // "5 min ago" moves on each minute, unless someone is going through the list.
        card.tick = () => { if (Date.now() - (card.data.at || 0) > feedsPeriod(card)) refresh(); else if (Date.now() % 60000 < 1000 && !card.root.contains(document.activeElement)) render(); };
        card.body.replaceChildren(chips, list, foot);
        refresh();
      }
    });

    // ── A value from the web ───────────────────────────────────────
    const web = (url) => { const text = String(url || "").trim(); try { const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); return text && /^https?:$/.test(u.protocol) ? u.href : null; } catch (error) { return null; } };
    const every = (minutes) => new Intl.NumberFormat(locale(), { style: "unit", unit: minutes < 60 ? "minute" : "hour", unitDisplay: "long" }).format(minutes < 60 ? minutes : minutes / 60);
    // The readings so far as a line, once there are two numbers to draw.
    const spark = (history) => {
      if (!history || history.length < 2) return null;
      const values = history.map(([, value]) => value);
      const low = Math.min(...values);
      const span = Math.max(...values) - low || 1;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 24");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("class", "dash-spark");
      svg.setAttribute("aria-hidden", "true");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", values.map((value, index) => `${(index / (values.length - 1)) * 100},${(1 - (value - low) / span) * 22 + 1}`).join(" "));
      line.setAttribute("vector-effect", "non-scaling-stroke");
      svg.append(line);
      return svg;
    };
    // As often as the card was told; five minutes after a failure.
    const valuePeriod = (card) => (card.data.failure ? 5 : Math.max(5, Number(card.settings.every) || 15)) * 60e3;
    Object.assign(T.value, {
      named: true,
      settings: [
        { key: "url", type: "url", value: "", spellcheck: "false", label: () => say("dash.valueUrl", "An address that answers in JSON"), placeholder: () => "https://api.example.com/price" },
        { key: "path", type: "text", value: "", spellcheck: "false", label: () => say("dash.valuePath", "Where the value is in the answer"), hint: () => say("dash.valuePathHint", "For example data.price or items[0].count. Left empty, the whole answer."), placeholder: () => "data.price" },
        { key: "unit", type: "text", value: "", label: () => say("dash.valueUnit", "Unit after the value") },
        { key: "every", type: "select", value: "15", label: () => say("dash.valueEvery", "Looks again every"), options: () => [5, 15, 60, 360].map((m) => [String(m), every(m)]) }
      ],
      origins: (values) => originsOf([web(values.url)].filter(Boolean)),
      data: () => ({ at: 0, key: "", value: null, history: [], failure: null }),
      draw(card) {
        const refresh = async (force = false) => {
          const url = web(card.settings.url);
          const key = `${url} ${card.settings.path || ""}`;
          const fresh = card.data.key === key && Date.now() - (card.data.at || 0) < valuePeriod(card);
          if (!url || card.loading || (fresh && !force)) { render(); return; }
          card.loading = true;
          render();
          let value;
          let failure = null;
          try {
            const text = await C.fetchOne({ url, text: true });
            let answer;
            try { answer = JSON.parse(text); } catch (error) { throw new Error(say("dash.valueNotJson", "The answer is not JSON."), { cause: error }); }
            value = F.pick(answer, card.settings.path);
            if (value === undefined) throw new Error(say("dash.valueMissing", "The answer has nothing at {path}.", { path: card.settings.path || "" }));
          } catch (error) {
            failure = await failureOf(card, error, url);
          }
          card.loading = false;
          const same = card.data.key === key;
          const number = failure ? null : F.numberOf(value);
          const history = [...(same ? card.data.history || [] : []), ...(number === null ? [] : [[Date.now(), number]])].slice(-48);
          card.data = { at: Date.now(), key, value: failure ? (same ? card.data.value : null) : value, history, failure };
          card.save();
          render();
        };
        const render = () => {
          card.root.classList.toggle("is-loading", Boolean(card.loading));
          if (!web(card.settings.url)) {
            card.body.replaceChildren(emptyCard(say("dash.valueEmpty", "One number or word from any address that answers in JSON: a price, a count, a status."), say("dash.valueSet", "Choose the address"), () => card.openSettings()));
            return;
          }
          const shown = card.data.value === null || card.data.value === undefined ? null : F.show(card.data.value, locale());
          card.body.replaceChildren(...[
            el("p", { class: "dash-value" }, [
              el("b", { class: "dash-value-now", text: shown ?? "–" }),
              shown !== null && card.settings.unit ? el("span", { class: "dash-value-unit", text: card.settings.unit }) : null
            ]),
            spark(card.data.history),
            el("div", { class: "dash-foot" }, [
              card.data.failure ? trouble(card, card.data.failure, [web(card.settings.url)], refresh) : el("span", { text: card.data.at ? say("dash.inboxAt", "Updated {time}", { time: clock(card.data.at) }) : "" }),
              refreshButton(card, refresh)
            ])
          ].filter(Boolean));
        };
        card.update = render;
        card.reload = () => refresh(true);
        card.tick = () => { if (Date.now() - (card.data.at || 0) > valuePeriod(card)) refresh(); };
        refresh();
      }
    });

    // ── Open tabs ──────────────────────────────────────────────────
    const show = (tab) => { api().tabs.update(tab.id, { active: true }); api().windows?.update?.(tab.windowId, { focused: true }); };
    const tabRow = (tab, note, close) => el("li", { class: "dash-tab-item" }, [
      el("button", { type: "button", class: "dash-tab-row", title: tab.url, onclick: () => show(tab) }, [pageIcon(tab.url), el("span", { text: tab.title || hostOf(tab.url) }), note ? el("small", { text: note }) : null]),
      close ? el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.tabClose", "Close {tab}", { tab: tab.title || hostOf(tab.url) }), title: say("dash.tabCloseShort", "Close"), onclick: close }, icon(ICONS.close)) : null
    ]);
    Object.assign(T.tabs, {
      data: () => ({}),
      draw(card) {
        const list = el("div", { class: "dash-tidy" });
        let allowed = false;
        let looked = 0;
        const refresh = async () => {
          looked = Date.now();
          // Given meanwhile elsewhere (the stash asks for the same), it counts here too.
          if (!allowed) allowed = await holds(["tabs"]);
          if (!allowed || !api()?.tabs?.query) { render(null); return; }
          api().tabs.query({}, (tabs) => render(tidy(tabs || [], Date.now(), self)));
        };
        const close = (tabs, undo) => {
          api().tabs.remove(tabs.map((tab) => tab.id), () => { void api().runtime?.lastError; refresh(); });
          const message = say("dash.tabsClosed", "{count} tabs closed", { count: tabs.length });
          if (undo) window.NordlysUI?.showUndoToast?.({ message, onAction: () => tabs.forEach((tab) => api().tabs.create({ url: tab.url, active: false })) });
          else if (typeof toast === "function") toast(message, "success", 2600);
        };
        const render = (state) => {
          if (!state) {
            list.replaceChildren(emptyCard(say("dash.tabsAbout", "The tabs open twice and the ones left for days, to close in one go."), say("dash.tabsLook", "Look at my tabs"), async () => {
              allowed = await ask(["tabs"]);
              refresh();
            }));
            return;
          }
          const sum = state.windows > 1 ? say("dash.tabsSumWindows", "{count} tabs in {windows} windows", { count: state.count, windows: state.windows }) : say("dash.tabsSum", "{count} tabs open", { count: state.count });
          const parts = [el("p", { class: "dash-tidy-sum", text: sum })];
          if (state.twice.length) {
            const extra = state.twice.flatMap((group) => group.extra);
            parts.push(el("h3", { class: "dash-inbox-group", text: say("dash.tabsTwice", "Open more than once") }));
            parts.push(el("ul", { class: "dash-tab-list" }, state.twice.slice(0, 5).map((group) => tabRow(group.keep, `×${group.extra.length + 1}`))));
            parts.push(el("button", { type: "button", class: "dash-link dash-tidy-act", text: say("dash.tabsCloseCopies", "Close the copies ({count})", { count: extra.length }), onclick: () => close(extra, false) }));
          }
          if (state.left.length) {
            parts.push(el("h3", { class: "dash-inbox-group", text: say("dash.tabsLeft", "Not looked at for {days} days", { days: IDLE_DAYS }) }));
            parts.push(el("ul", { class: "dash-tab-list" }, state.left.slice(0, 6).map((tab) => tabRow(tab, ago(tab.lastAccessed), () => close([tab], true)))));
            parts.push(el("button", { type: "button", class: "dash-link dash-tidy-act", text: say("dash.tabsCloseLeft", "Close them all"), onclick: () => close(state.left, true) }));
          }
          if (!state.twice.length && !state.left.length) parts.push(el("p", { class: "dash-tasks-empty", text: say("dash.tabsTidy", "Nothing to tidy: no page is open twice, and none has waited for days.") }));
          list.replaceChildren(...parts);
          fadeWhenMore(list);
        };
        card.update = () => refresh();
        card.tick = () => { if (Date.now() - looked > 15000) refresh(); };
        card.body.replaceChildren(list);
        refresh();
      }
    });

    // ── Recently closed ────────────────────────────────────────────
    const NEEDS = ["sessions", "tabs"];
    // One listener for every card that shows them; a card gone from the page lets go.
    const watchers = new Set();
    let listening = false;
    const watch = (fn) => {
      watchers.add(fn);
      if (listening || !api()?.sessions?.onChanged) return;
      listening = true;
      api().sessions.onChanged.addListener(() => { for (const watcher of [...watchers]) if (watcher() === false) watchers.delete(watcher); });
    };
    // Chrome counts in seconds, Firefox in milliseconds.
    const closedAt = (entry) => (entry.lastModified < 1e12 ? entry.lastModified * 1000 : entry.lastModified);
    Object.assign(T.closed, {
      data: () => ({}),
      draw(card) {
        const list = el("ul", { class: "dash-closed" });
        const watcher = () => { if (!list.isConnected) return false; refresh(); return true; };
        const refresh = async () => {
          if (!(await holds(NEEDS))) { render(null); return; }
          const sessions = api()?.sessions;
          if (!sessions?.getRecentlyClosed) { render(undefined); return; }
          watch(watcher);
          sessions.getRecentlyClosed({ maxResults: 25 }, (entries) => render(entries || []));
        };
        const restore = (id) => api().sessions.restore(id, () => { void api().runtime?.lastError; });
        const render = (entries) => {
          if (entries === null) {
            list.replaceChildren(el("li", { class: "dash-closed-empty" }, emptyCard(say("dash.closedAbout", "The tabs and windows you closed lately, back with one click."), say("dash.closedShow", "Show them"), async () => { await ask(NEEDS); refresh(); })));
            return;
          }
          if (entries === undefined) { list.replaceChildren(el("li", { class: "dash-tasks-empty", text: say("dash.closedNone", "This browser does not tell Nordlys which tabs were closed.") })); return; }
          const isWeb = (tab) => /^https?:/i.test(tab?.url || "") && !tab.url.startsWith(self);
          const rows = entries.map((entry) => {
            if (entry.tab) {
              if (!isWeb(entry.tab)) return null;
              return el("li", {}, el("button", { type: "button", class: "dash-tab-row", title: entry.tab.url, onclick: () => restore(entry.tab.sessionId) }, [
                pageIcon(entry.tab.url), el("span", { text: entry.tab.title || hostOf(entry.tab.url) }), el("small", { text: ago(closedAt(entry)) })
              ]));
            }
            const tabs = (entry.window?.tabs || []).filter(isWeb);
            if (!tabs.length) return null;
            return el("li", {}, el("button", { type: "button", class: "dash-tab-row", title: tabs.map((tab) => tab.title || tab.url).join("\n"), onclick: () => restore(entry.window.sessionId) }, [
              el("span", { class: "dash-stash-icon dash-closed-window", "aria-hidden": "true" }, icon(ICONS.tabs)),
              el("span", { text: say("dash.closedWindow", "A window of {count} tabs", { count: tabs.length }) }),
              el("small", { text: ago(closedAt(entry)) })
            ]));
          }).filter(Boolean).slice(0, 15);
          list.replaceChildren(...(rows.length ? rows : [el("li", { class: "dash-tasks-empty", text: say("dash.closedEmpty", "Nothing closed lately.") })]));
          fadeWhenMore(list);
        };
        card.update = () => refresh();
        card.body.replaceChildren(list);
        refresh();
      }
    });
  }

  if (root.NordlysDashboard) register(root.NordlysDashboard);
  const exported = { tidy, IDLE_DAYS };
  root.NordlysDashCards = exported;
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
})(typeof globalThis !== "undefined" ? globalThis : this);
