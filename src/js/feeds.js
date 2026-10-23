/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - FEEDS AND VALUES FROM THE WEB
   ═══════════════════════════════════════════════════════════════════

   What the Feeds card and the Value card read: RSS and Atom (which is
   also what Reddit, YouTube and Hacker News give out), and one value out
   of any JSON. Pure and tested; the cards do the fetching, with leave for
   each site asked from the click that adds it.                          */
(function (root) {
  "use strict";

  const web = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.href : null; } catch (error) { return null; } };
  const resolve = (url, base) => { try { return web(new URL(String(url || "").trim(), base || undefined).href); } catch (error) { return null; } };

  /* What a person typed, as the address of a feed: a feed or a site as it
     is, and the short ways to name the big ones (hn, r/name, a YouTube
     channel or playlist). A site's own feed is found when it is read. */
  function address(input) {
    const text = String(input || "").trim();
    if (!text) return null;
    if (/^(hn|hacker ?news)$/i.test(text)) return "https://news.ycombinator.com/rss";
    const sub = /^(?:\/?r\/|(?:https?:\/\/)?(?:www\.|old\.|new\.)?reddit\.com\/r\/)([\w-]{2,32})\/?(?:[?#].*)?$/i.exec(text);
    if (sub) return `https://www.reddit.com/r/${sub[1]}/.rss`;
    const url = web(/^https?:\/\//i.test(text) ? text : /^[a-z][\w+.-]*:\/\//i.test(text) ? "" : `https://${text}`);
    if (!url) return null;
    const u = new URL(url);
    if (/(^|\.)youtube\.com$/i.test(u.hostname)) {
      const channel = /^\/channel\/(UC[\w-]{22})/.exec(u.pathname)?.[1];
      if (channel) return `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`;
      const list = u.pathname === "/playlist" && u.searchParams.get("list");
      if (list) return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(list)}`;
    }
    return url;
  }

  // ── Reading RSS and Atom ─────────────────────────────────────────
  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: "\u00a0" };
  const decode = (text) => String(text).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? all;
    const n = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    try { return String.fromCodePoint(n); } catch (error) { return all; }
  });
  const TAG = /<\/?[a-z][^>]*>/gi;
  /* The words of an element: CDATA as written, entities read, and markup
     dropped, also the markup a feed escaped into its titles. */
  const textOf = (xml) => decode(String(xml || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(TAG, " ")).replace(TAG, " ").replace(/\s+/g, " ").trim();
  // The first element of that name (with its prefix, if it has one: dc:date).
  const element = (xml, name) => new RegExp(`<${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${name}>)`, "i").exec(xml);
  const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag); return m ? decode(m[1] ?? m[2]) : null; };
  // An item's page: RSS says it as text, Atom as the href of its alternate link.
  function linkOf(xml, base) {
    const rss = /<link>([\s\S]*?)<\/link>/i.exec(xml);
    if (rss) return resolve(textOf(rss[1]), base);
    const tags = xml.match(/<link\b[^>]*>/gi) || [];
    const best = tags.find((tag) => (attr(tag, "rel") || "alternate") === "alternate") || tags[0];
    return best ? resolve(attr(best, "href"), base) : null;
  }
  const BLOCK = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
  /* A feed's name and its newest fifty items, { id, title, url, at }; null
     when the text is not a feed at all (a web page, an error). */
  function parse(text, base = "") {
    const xml = String(text || "");
    if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) return null;
    const head = xml.replace(BLOCK, "");
    const items = (xml.match(BLOCK) || []).slice(0, 50).map((block) => {
      // Some feeds give an item no link, only a permanent address as its guid.
      const url = linkOf(block, base) || web(textOf(element(block, "guid")?.[1]));
      const date = ["pubDate", "published", "updated", "dc:date"].map((name) => element(block, name)).find(Boolean);
      const at = Date.parse(textOf(date?.[1]));
      return { id: textOf((element(block, "guid") || element(block, "id"))?.[1]) || url, title: textOf(element(block, "title")?.[1]).slice(0, 300), url, at: Number.isFinite(at) ? at : 0 };
    }).filter((it) => it.url && it.title);
    return { title: textOf(element(head, "title")?.[1]).slice(0, 80), items };
  }
  // The feeds a web page names in its head, for a site given instead of its feed.
  function discover(html, base) {
    return (String(html || "").match(/<link\b[^>]*>/gi) || [])
      .filter((tag) => /\balternate\b/i.test(attr(tag, "rel") || "") && /(rss|atom)\+xml/i.test(attr(tag, "type") || ""))
      .map((tag) => resolve(attr(tag, "href"), base)).filter(Boolean);
  }
  // Every feed's items as one list, newest first, each page once.
  function merge(lists, limit = 60) {
    const seen = new Set();
    return lists.flat().sort((a, b) => b.at - a.at).filter((it) => !seen.has(it.url) && seen.add(it.url)).slice(0, limit);
  }

  // ── One value out of JSON ────────────────────────────────────────
  /* By a path as people write it: data.items[0].price, items.0.price or
     $.data.price. Only the answer's own fields are followed. */
  function pick(value, path) {
    const steps = String(path || "").trim().replace(/^\$\.?/, "").match(/[^.[\]"']+/g) || [];
    let at = value;
    for (const step of steps) {
      if (at === null || typeof at !== "object" || !Object.prototype.hasOwnProperty.call(at, step)) return undefined;
      at = at[step];
    }
    return at;
  }
  // A number, also one an API sends as text ("67012.50"); null otherwise.
  const numberOf = (value) => (typeof value === "number" && Number.isFinite(value) ? value
    : typeof value === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(value) ? Number(value) : null);
  // How a value reads on the card.
  function show(value, locale = "en") {
    if (value === undefined) return null;
    const n = numberOf(value);
    if (n !== null) return new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(n) < 10 ? 3 : 2 }).format(n);
    if (typeof value === "string") return value.trim().slice(0, 120);
    return JSON.stringify(value).slice(0, 120);
  }

  const api = { address, parse, discover, merge, pick, numberOf, show, textOf };
  root.NordlysFeeds = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
