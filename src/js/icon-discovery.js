/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - FINDING AN ICON FROM A NAME OR A LINK
   ═══════════════════════════════════════════════════════════════════

   What a person does by hand, in the same order: look for the brand's mark
   as a vector, then as a large picture with a clear background, and take a
   favicon only when nothing better exists.

   Nothing here runs until the person asks. A name goes to two public
   catalogues: Iconify (the SVG Logos and Simple Icons sets, both CC0) and
   Wikidata, whose entry for a brand names its icon on Wikimedia Commons. A
   link is also read itself, once, for the icons its page declares; the
   browser asks leave for that site first. Whatever is chosen is kept as
   picture data inside the bookmark, so the tile never loads it again. */
(function () {
  "use strict";

  const ICONIFY = "https://api.iconify.design";
  const WIKIDATA = "https://www.wikidata.org/w/api.php";
  const SPARQL = "https://query.wikidata.org/sparql";
  const COMMONS = "https://commons.wikimedia.org/w/api.php";
  const SIMPLE_ICONS = "https://cdn.simpleicons.org";
  const MAX_JSON = 512 * 1024;
  const MAX_PAGE = 1536 * 1024;
  const MAX_IMAGE = 1536 * 1024;
  const TIMEOUT_MS = 3500;
  /* The whole search ends by then with whatever it has. */
  const BUDGET_MS = 4000;
  /* A result this good is applied the moment it arrives, and no site is asked for more. */
  const GOOD = 90;
  /* Below this an icon is lost on its tile (the same line the tile itself draws). */
  const MIN_CONTRAST = 1.8;
  const MAX_CHOICES = 6;
  const SITE_IMAGES = 8;

  /* Simple Icons names its marks by running the words together — githubactions,
     googledrive — so a result read "Githubactions". The brands whose casing is
     their own are spelled out, the families that prefix a hundred products are
     split off, and everything else is capitalised as a word. */
  const TITLES = {
    github: "GitHub", gitlab: "GitLab", youtube: "YouTube", linkedin: "LinkedIn", paypal: "PayPal",
    openai: "OpenAI", whatsapp: "WhatsApp", tiktok: "TikTok", playstation: "PlayStation", macos: "macOS",
    ios: "iOS", npm: "npm", pnpm: "pnpm", ebay: "eBay", iphone: "iPhone", ipad: "iPad", icloud: "iCloud",
    javascript: "JavaScript", typescript: "TypeScript", nodedotjs: "Node.js", vuedotjs: "Vue.js", nextdotjs: "Next.js",
    stackoverflow: "Stack Overflow", deepl: "DeepL", leetcode: "LeetCode", hackerrank: "HackerRank",
    duckduckgo: "DuckDuckGo", soundcloud: "SoundCloud", wordpress: "WordPress", woocommerce: "WooCommerce",
    mongodb: "MongoDB", postgresql: "PostgreSQL", mysql: "MySQL", graphql: "GraphQL", devdotto: "DEV",
    bbc: "BBC", cnn: "CNN", nba: "NBA", nasa: "NASA", ibm: "IBM", hp: "HP", aws: "AWS", gmail: "Gmail",
    chatgpt: "ChatGPT", huggingface: "Hugging Face", googlechrome: "Google Chrome", xbox: "Xbox", dropbox: "Dropbox",
    onedrive: "OneDrive", onenote: "OneNote", vk: "VK", ok: "OK", x: "X", tv: "TV"
  };
  const FAMILIES = ["google", "github", "microsoft", "amazon", "apple", "adobe", "youtube", "jetbrains", "atlassian",
    "mozilla", "samsung", "xbox", "nintendo", "playstation", "facebook", "discord", "spotify", "cloudflare", "oracle", "visualstudio"];
  const WORDS = { visualstudio: "Visual Studio", aws: "AWS" };

  function titleFromSlug(slug) {
    const name = String(slug || "").toLowerCase();
    if (TITLES[name]) return TITLES[name];
    if (WORDS[name]) return WORDS[name];
    for (const family of FAMILIES) {
      if (name.startsWith(family) && name.length > family.length + 1) {
        return `${titleFromSlug(family)} ${titleFromSlug(name.slice(family.length))}`;
      }
    }
    return name
      .split("-")
      .filter(Boolean)
      .map(word => TITLES[word] || word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /* Simple Icons are monochrome vector marks. Accept only path geometry from
     the API response, then author the enclosing SVG ourselves. This turns a
     third-party response into inert image data rather than injecting markup. */
  function vectorDataUrl(icon, colour = "#eef4ff") {
    const body = String(icon?.body || "");
    if (body.length > 100_000) throw new Error("Vector is too large");
    const safeColour = /^#[0-9a-f]{6}$/i.test(colour) ? colour : "#eef4ff";
    const paths = [];
    const pathPattern = /<path\b([^>]*)\/?\s*>/gi;
    let match;
    while ((match = pathPattern.exec(body))) {
      let attributes = match[1].replace(/\/$/, "").trim();
      const dMatch = /(?:^|\s)d="([^"]+)"(?:\s|$)/i.exec(attributes);
      if (!dMatch || !/^[0-9a-z.,+\-\s]+$/i.test(dMatch[1])) throw new Error("Unsafe vector path");
      attributes = attributes.replace(dMatch[0], " ").replace(/(?:^|\s)fill="currentColor"(?:\s|$)/i, " ").trim();
      if (attributes) throw new Error("Unsupported vector attributes");
      paths.push(dMatch[1]);
    }
    const residue = body.replace(pathPattern, "").trim();
    if (!paths.length || residue) throw new Error("Unsupported vector markup");
    const width = Number(icon?.width) || 24;
    const height = Number(icon?.height) || 24;
    if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 512)) throw new Error("Invalid vector dimensions");
    const pathMarkup = paths.map(d => `<path d="${d}"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="${safeColour}">${pathMarkup}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /* A full-colour mark has fills, gradients and groups, so it cannot be cut
     down to paths. It is only ever shown as an image, where a browser runs no
     script and loads nothing from outside; what could do either is refused
     here all the same. */
  function markupDataUrl(icon) {
    const body = String(icon?.body || "");
    if (!body || body.length > 120_000) throw new Error("Vector is too large");
    if (/<\s*(script|foreignObject|iframe|image|style|animate|set)\b/i.test(body) || /\son[a-z]+\s*=/i.test(body)
      || /(?:href|src)\s*=\s*["']\s*(?!#)/i.test(body) || /url\(\s*["']?\s*(?!#)/i.test(body)) throw new Error("Unsupported vector markup");
    const width = Number(icon?.width) || 256;
    const height = Number(icon?.height) || 256;
    if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 4096)) throw new Error("Invalid vector dimensions");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}">${body}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /* ── What was typed ─────────────────────────────────────────────── */

  const IMAGE_PATH = /\.(svg|png|jpe?g|webp|gif|ico|avif)$/i;
  const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);

  /* The word a host is known by: open.spotify.com is "spotify", bbc.co.uk "bbc". */
  function brandFromHost(host) {
    const labels = String(host || "").toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
    if (labels.length < 2) return labels[0] || "";
    const tail = labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2;
    return labels[labels.length - tail] || "";
  }

  /* Letters and digits only, lowercase: how the catalogues spell a brand. */
  const slugOf = (text) => String(text || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");

  /* A name, the address of a site, or the address of a picture. */
  function parseQuery(text) {
    const typed = String(text || "").trim().slice(0, 2048);
    if (!typed) return { kind: "empty" };
    if (/^data:image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)[;,]/i.test(typed)) return { kind: "image", url: typed };
    const looksLikeAddress = /^https?:\/\//i.test(typed) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]\S*)?$/i.test(typed) && /\.[a-z]{2,}(:\d+)?([/?#]|$)/i.test(typed));
    if (!looksLikeAddress) return { kind: "name", name: typed.slice(0, 80) };
    let url;
    try { url = new URL(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`); } catch { return { kind: "name", name: typed.slice(0, 80) }; }
    if (!/^https?:$/.test(url.protocol)) return { kind: "name", name: typed.slice(0, 80) };
    if (IMAGE_PATH.test(url.pathname)) return { kind: "image", url: url.href, host: url.hostname };
    return { kind: "site", url: url.href, origin: url.origin, host: url.hostname, name: brandFromHost(url.hostname) };
  }

  /* The sites the browser is asked leave to read, for this query. A name
     needs none: both catalogues answer any page. */
  function originsFor(query) {
    // A page inside a larger site is looked for on that site's front page too (fromSite).
    if (query?.kind === "site") { const parent = parentSite(query.host); return [`${query.origin}/*`, ...(parent && parent !== query.origin ? [`${parent}/*`] : [])]; }
    if (query?.kind === "image" && query.host) { try { return [`${new URL(query.url).origin}/*`]; } catch { return []; } }
    return [];
  }

  /* ── Ranking ────────────────────────────────────────────────────── */

  /* One number per candidate, from what it is and how it measured:
       a vector first, then a large picture with a clear background;
       an opaque background, a wide wordmark and a tiny favicon last. */
  const SOURCE_SCORE = {
    address: 40, "logos-icon": 14, logos: 12, "wikimedia-icon": 14, "wikimedia-logo": 6, "simple-icons": 6,
    "site-icon": 10, "site-touch": 10, "site-manifest": 10, "site-mask": 4, "site-logo": 2, "site-inline": -4, "site-og": -30, "site-title": -60, browser: -10
  };
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const linear = (value) => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  const luminanceOf = (r, g, b) => 0.2126 * linear(r / 255) + 0.7152 * linear(g / 255) + 0.0722 * linear(b / 255);

  /* How wide the picture is for its height, and how wide the drawing inside
     it: a wordmark in a square box is still a wordmark. */
  function shape(candidate) {
    const longest = Math.max(candidate.width || 0, candidate.height || 0), shortest = Math.max(1, Math.min(candidate.width || 0, candidate.height || 0));
    return { box: longest ? longest / shortest : Infinity, ink: candidate.inkAspect || 1 };
  }

  /* Whether the mark can be seen, as it is, on the tile it is going to
     (`ground` is how light that tile is, 0 to 1). Unknown reads as yes. */
  const reads = (candidate, ground) => !(ground >= 0) || !(candidate.luminance >= 0) || contrast(candidate.luminance, ground) >= MIN_CONTRAST;
  /* A mark of one colour on a clear ground: the tile re-tones it when it would be lost. */
  const retonable = (candidate) => !candidate.opaque && Boolean(candidate.mono || candidate.flat);

  function score(candidate, ground) {
    const { width = 0, height = 0 } = candidate;
    const longest = Math.max(width, height);
    const { box, ink } = shape(candidate);
    let points = candidate.vector ? 100 : longest >= 192 ? 82 : longest >= 128 ? 72 : longest >= 96 ? 60 : longest >= 64 ? 48 : longest >= 48 ? 34 : Math.round(longest / 6);
    if (candidate.opaque) points -= 40;
    else if (!candidate.vector && candidate.measured) points += 12;
    if (box > 1.5 || ink > 1.5 || 1 / ink > 1.9) points -= 18;
    if (candidate.mono) points -= 8;
    if (candidate.measured === false) points -= 20;
    // Lost on this tile: a one-colour mark is re-toned there and loses little; anything else stays lost.
    if (!reads(candidate, ground)) points -= retonable(candidate) ? 6 : 30;
    // Found under a longer or a shorter name than the one asked for.
    points -= candidate.distance || 0;
    return points + (SOURCE_SCORE[candidate.from] || 0);
  }

  /* Wide wordmarks and banners are not icons. A picture the person pointed
     at themselves is never refused. */
  function acceptable(candidate) {
    if (candidate.from === "address") return true;
    const { box, ink } = shape(candidate);
    return box <= 1.7 && ink <= 2.2;
  }

  /* Two pictures of the same drawing: the same mark from two catalogues, or
     one icon a site offers in five sizes. Only the better is worth showing. */
  function alike(a, b) {
    if (!a.look || !b.look || a.look.length !== b.look.length || Boolean(a.opaque) !== Boolean(b.opaque)) return false;
    let apart = 0;
    for (let at = 0; at < a.look.length; at++) apart += Math.abs(a.look[at] - b.look[at]);
    return apart / a.look.length < 0.06;
  }

  function rank(candidates, { limit = MAX_CHOICES, ground } = {}) {
    const seen = new Set();
    const usable = [], refused = [];
    for (const candidate of candidates) {
      if (!candidate?.src || seen.has(candidate.src)) continue;
      seen.add(candidate.src);
      (acceptable(candidate) ? usable : refused).push({ ...candidate, score: score(candidate, ground) });
    }
    // A site whose only picture is a wide one still has that picture; a link preview is not an icon even then.
    const pool = usable.length ? usable : refused.filter(candidate => candidate.from !== "site-og").map(candidate => ({ ...candidate, score: candidate.score - 40 }));
    pool.sort((a, b) => b.score - a.score);
    const kept = [];
    for (const candidate of pool) if (!kept.some(better => alike(better, candidate))) kept.push(candidate);
    /* The first would have to be re-toned to be seen, and close behind it is
       one that reads as it stands (the white mark on a dark theme, the shaded
       globe beside the black letter): that one goes first. */
    if (kept.length > 1 && !reads(kept[0], ground)) {
      const plain = kept.findIndex(candidate => !candidate.opaque && reads(candidate, ground) && kept[0].score - candidate.score <= 12);
      if (plain > 0) kept.unshift(...kept.splice(plain, 1));
    }
    // A favicon-sized picture is shown only when nothing larger was found, and then only one.
    const proper = kept.filter(candidate => candidate.vector || Math.max(candidate.width, candidate.height) >= 48);
    const small = kept.filter(candidate => !proper.includes(candidate));
    return [...proper, ...small.slice(0, 1)].slice(0, limit);
  }

  /* ── The network, kept on a short lead ──────────────────────────── */

  function context({ fetchImpl, signal } = {}) {
    return { fetchImpl: fetchImpl || ((...args) => fetch(...args)), signal, asked: 0, failed: 0 };
  }

  async function request(ctx, url, { max, as = "text" } = {}) {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(ctx.signal?.reason);
    if (ctx.signal?.aborted) forwardAbort();
    else ctx.signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("Timed out")), TIMEOUT_MS);
    ctx.asked++;
    try {
      const response = await ctx.fetchImpl(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const declared = Number(response.headers?.get?.("content-length"));
      if (declared > max) throw new Error("Response is too large");
      if (as === "blob") {
        const blob = await response.blob();
        if (blob.size > max) throw new Error("Response is too large");
        return { blob, url: response.url || url, type: response.headers?.get?.("content-type") || blob.type || "" };
      }
      const text = await response.text();
      if (text.length > max) throw new Error("Response is too large");
      return { text, url: response.url || url };
    } catch (error) {
      // A request that never reached anyone: how "offline" is told from "nothing found".
      if (error instanceof TypeError) ctx.failed++;
      throw error;
    } finally {
      clearTimeout(timeout);
      ctx.signal?.removeEventListener("abort", forwardAbort);
    }
  }

  const json = async (ctx, url) => JSON.parse((await request(ctx, url, { max: MAX_JSON })).text);

  /* ── Source: the open brand sets ────────────────────────────────── */

  /* The names a brand may be filed under, each with how far it is from what
     was asked: the name itself, the words of the bookmark's address
     (moodle.example.edu is Moodle), and last the single words of a name of
     several ("RST GitLab" runs on GitLab). */
  const HOST_NOISE = new Set(["www", "m", "app", "apps", "web", "portal", "store", "shop", "my", "en", "de", "login", "account", "accounts", "home", "go", "git", "mail", "docs", "api", "campus"]);
  function namesFor(name, host) {
    const names = new Map();
    const add = (text, distance) => {
      const slug = slugOf(text);
      if (slug.length >= 2 && !names.has(slug)) names.set(slug, { text: String(text).trim().slice(0, 80), distance });
    };
    add(name, 0);
    const labels = String(host || "").toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
    const brand = brandFromHost(host);
    // gemini.google.com is Gemini before it is Google.
    const part = labels.length > 2 && !HOST_NOISE.has(labels[0]) && labels[0].length >= 4 ? labels[0] : "";
    if (part) add(part, 6);
    if (brand) add(brand, !slugOf(name) ? 0 : part ? 16 : 4);
    const words = String(name || "").split(/[\s._/-]+/).filter(Boolean);
    if (words.length > 1) for (const word of words.filter(word => word.length >= 4).slice(0, 3)) add(word, 30);
    return [...names].slice(0, 5).map(([slug, entry]) => ({ slug, ...entry }));
  }

  async function fromIconify(name, ctx, { host = "" } = {}) {
    const names = namesFor(name, host);
    if (!names.length) return [];
    /* The catalogue's own search, one question per name, all at once. From
       what it answers only the brand itself is taken, or the brand under its
       maker's name (Gemini is filed as Google Gemini): "steam" must not
       bring Steam Deck or SteamDB. */
    const answers = await Promise.all(names.map(entry => json(ctx, `${ICONIFY}/search?query=${encodeURIComponent(entry.text)}&prefixes=logos,simple-icons&limit=32`).catch(error => ({ error }))));
    if (answers.every(answer => answer.error)) throw answers[0].error;
    const exact = { logos: [], "simple-icons": [] };
    const distances = new Map();
    answers.forEach((found, at) => {
      const { slug: wanted, distance } = names[at];
      for (const id of found?.icons || []) {
        const [prefix, slug] = String(id).split(":");
        if (!exact[prefix] || !/^[a-z0-9-]+$/.test(slug || "")) continue;
        const stem = slugOf(prefix === "logos" ? slug.replace(/-icon$/, "") : slug);
        const family = stem !== wanted && FAMILIES.some(maker => stem === maker + wanted);
        if (stem !== wanted && !family) continue;
        const key = `${prefix}:${slug}`, far = distance + (family ? 4 : 0);
        if (!distances.has(key)) { if (exact[prefix].length < 6) { exact[prefix].push(slug); distances.set(key, far); } }
        else distances.set(key, Math.min(distances.get(key), far));
      }
    });
    /* Simple Icons draws every mark in one colour and keeps the brand's own
       colour beside it; its own address hands the mark back in that colour. */
    const colours = new Map(await Promise.all(exact["simple-icons"].map(async (slug) => {
      const drawn = await request(ctx, `${SIMPLE_ICONS}/${slug}`, { max: 100_000 }).catch(() => null);
      return [slug, /fill="(#[0-9a-f]{6})"/i.exec(drawn?.text || "")?.[1] || "#10151f"];
    })));
    const sets = await Promise.all(Object.entries(exact).filter(([, slugs]) => slugs.length).map(async ([prefix, slugs]) => {
      const set = await json(ctx, `${ICONIFY}/${prefix}.json?icons=${encodeURIComponent(slugs.join(","))}`).catch(() => null);
      return { prefix, slugs, set };
    }));
    const out = [];
    for (const { prefix, slugs, set } of sets) {
      for (const slug of slugs) {
        const icon = set?.icons?.[slug];
        if (!icon) continue;
        const width = icon.width || set.width || (prefix === "logos" ? 256 : 24), height = icon.height || set.height || (prefix === "logos" ? 256 : 24);
        const distance = distances.get(`${prefix}:${slug}`) || 0;
        try {
          out.push(prefix === "logos"
            ? { id: `logos:${slug}`, src: markupDataUrl({ ...icon, width, height }), from: slug.endsWith("-icon") ? "logos-icon" : "logos", label: "SVG Logos", vector: true, width, height, distance }
            // In the brand's colour; a black or grey one is re-toned against its tile, in either direction.
            : { id: `simple-icons:${slug}`, src: vectorDataUrl({ ...icon, width, height }, colours.get(slug)), from: "simple-icons", label: "Simple Icons", vector: true, width, height, distance });
        } catch { /* a mark this code will not embed */ }
      }
    }
    return out;
  }

  /* ── Source: Wikidata's entry for the brand, and its files on Commons ── */

  const commonsFile = (value) => {
    try { return decodeURIComponent(String(value).split("Special:FilePath/")[1] || "").replace(/_/g, " "); } catch { return ""; }
  };

  async function fromWikimedia(name, ctx, { host, strict = false } = {}) {
    const term = String(name || "").trim().slice(0, 80);
    if (!term) return [];
    const search = await json(ctx, `${WIKIDATA}?action=wbsearchentities&search=${encodeURIComponent(term)}&language=en&uselang=en&type=item&limit=8&format=json&origin=*`);
    const ids = (search.search || []).map(entry => entry.id).filter(id => /^Q\d+$/.test(id)).slice(0, 8);
    if (!ids.length) return [];
    const query = `SELECT ?item ?p ?v WHERE { VALUES ?item { ${ids.map(id => `wd:${id}`).join(" ")} } VALUES ?p { wdt:P154 wdt:P8972 wdt:P856 } ?item ?p ?v }`;
    const facts = await json(ctx, `${SPARQL}?format=json&query=${encodeURIComponent(query)}`);
    const entities = new Map(ids.map(id => [id, { icons: [], logos: [], sites: [] }]));
    for (const row of facts.results?.bindings || []) {
      const entity = entities.get(String(row.item?.value || "").split("/").pop());
      const property = String(row.p?.value || "").split("/").pop();
      if (!entity) continue;
      if (property === "P856") entity.sites.push(String(row.v?.value || ""));
      else (property === "P8972" ? entity.icons : entity.logos).push(commonsFile(row.v?.value));
    }
    /* The first entry with a mark of its own, in the order the search gave
       them; when the site is known, an entry whose own website is that site
       comes before all others. */
    const brand = host ? brandFromHost(host) : "";
    const bare = String(host || "").toLowerCase().replace(/^www\./, "");
    const siteOf = (site) => { try { return new URL(site).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
    // The very host first (gemini.google.com is not all of Google), then the same registered name.
    const isSite = (entity) => entity.sites.some(site => siteOf(site) === bare);
    const ownsSite = (entity) => isSite(entity) || entity.sites.some(site => brandFromHost(siteOf(site)) === brand);
    const marked = ids.map(id => entities.get(id)).filter(entity => entity.icons.length || entity.logos.length);
    const entity = (bare && marked.find(isSite)) || (brand && marked.find(ownsSite)) || marked[0];
    if (!entity) return [];
    // Looked up from a link, an entry that names another site as its own is a different brand of the same name.
    if (strict && brand && !ownsSite(entity)) return [];
    // Asked by name from a bookmark of some other site: a namesake until shown otherwise.
    const distance = brand && !ownsSite(entity) ? (entity.sites.length ? 30 : 10) : 0;
    const files = [...entity.icons.map(file => ({ file, from: "wikimedia-icon" })), ...entity.logos.map(file => ({ file, from: "wikimedia-logo" }))]
      .filter(entry => entry.file && /\.(svg|png|webp)$/i.test(entry.file)).slice(0, 4);
    if (!files.length) return [];
    const info = await json(ctx, `${COMMONS}?action=query&titles=${encodeURIComponent(files.map(entry => `File:${entry.file}`).join("|"))}&prop=imageinfo&iiprop=url%7Csize%7Cmime&format=json&origin=*`);
    const pages = Object.values(info.query?.pages || {});
    const out = [];
    for (const { file, from } of files) {
      const page = pages.find(entry => String(entry.title || "").replace(/_/g, " ") === `File:${file}`);
      const image = page?.imageinfo?.[0];
      if (!image?.url || !/^https:\/\/upload\.wikimedia\.org\//.test(image.url)) continue;
      out.push({ id: `wikimedia:${file}`, url: image.url, from, label: "Wikimedia Commons", vector: image.mime === "image/svg+xml", width: image.width, height: image.height, distance });
    }
    return out;
  }

  /* ── Source: the site itself ────────────────────────────────────── */

  const largestSize = (sizes) => Math.max(0, ...String(sizes || "").split(/\s+/).map(size => parseInt(size, 10) || 0));

  /* Every picture a page offers as its own mark, best guesses first. */
  function siteReferences(doc, base) {
    const refs = [];
    const add = (href, from, hint = 0) => {
      if (!href) return;
      try {
        const url = new URL(href, base);
        if (/^https?:$/.test(url.protocol) || url.protocol === "data:") refs.push({ url: url.href, from, hint });
      } catch { /* not an address */ }
    };
    let manifest = "";
    for (const link of doc.querySelectorAll("link[rel][href]")) {
      const rel = ` ${String(link.getAttribute("rel")).toLowerCase()} `;
      const href = link.getAttribute("href");
      const vector = /svg/i.test(link.getAttribute("type") || "") || /\.svg(\?|#|$)/i.test(href);
      if (rel.includes(" mask-icon ")) add(href, "site-mask", 900);
      else if (rel.includes(" apple-touch-icon")) add(href, "site-touch", largestSize(link.getAttribute("sizes")) || 180);
      else if (rel.includes(" icon ")) add(href, "site-icon", vector ? 1000 : largestSize(link.getAttribute("sizes")) || 32);
      else if (rel.includes(" manifest ")) manifest = href;
    }
    const logoish = (node) => /logo|brand/i.test(`${node.getAttribute("class") || ""} ${node.getAttribute("id") || ""} ${node.getAttribute("alt") || ""} ${node.getAttribute("src") || ""}`);
    const header = doc.querySelector("header, nav, [role='banner']") || doc.body;
    const pictures = [...(header?.querySelectorAll("img[src]") || [])].filter(logoish).slice(0, 2);
    for (const picture of pictures) add(picture.getAttribute("src"), "site-logo", /\.svg(\?|#|$)/i.test(picture.getAttribute("src")) ? 800 : 100);
    /* A logo drawn into the page. One that points elsewhere for its shapes, or
       leaves its colour to the page's stylesheet, cannot stand alone. */
    const drawn = [...(header?.querySelectorAll("a[href='/'] svg[viewBox], [class*='logo' i] svg[viewBox], svg[class*='logo' i][viewBox]") || [])]
      .filter(svg => !svg.querySelector("use, image, foreignObject, script, style")).slice(0, 2);
    for (const svg of drawn) {
      const copy = svg.cloneNode(true);
      for (const node of [copy, ...copy.querySelectorAll("*")]) {
        for (const attribute of [...node.attributes]) if (/^on|^(class|style|id)$/i.test(attribute.name)) node.removeAttribute(attribute.name);
      }
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const markup = copy.outerHTML;
      if (markup.length <= 60_000 && !/(?:href|src)\s*=|url\(/i.test(markup)) refs.push({ url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`, from: "site-inline", hint: 700 });
    }
    add(doc.querySelector("meta[property='og:image'][content], meta[name='og:image'][content]")?.getAttribute("content"), "site-og", 50);
    let manifestUrl = "";
    if (manifest) { try { manifestUrl = new URL(manifest, base).href; } catch { /* ignored */ } }
    return { refs, manifestUrl };
  }

  /* Where a site keeps its icon when its page does not say, or cannot be read. */
  const WELL_KNOWN = [["/apple-touch-icon.png", "site-touch", 180], ["/favicon.svg", "site-icon", 990], ["/favicon.png", "site-icon", 48], ["/favicon.ico", "site-icon", 16]];

  /* A page as a document. One that only sends the browser on (an old
     "meta refresh" front door) is followed once, within its own site. */
  async function readPage(ctx, url, hops = 1) {
    const page = await request(ctx, url, { max: MAX_PAGE }).catch(() => null);
    if (!page) return null;
    const doc = new DOMParser().parseFromString(page.text, "text/html");
    const onward = /url\s*=\s*['"]?([^'";]+)/i.exec(doc.querySelector("meta[http-equiv='refresh' i][content]")?.getAttribute("content") || "")?.[1];
    if (onward && hops > 0) {
      try {
        const next = new URL(onward.trim(), page.url);
        if (next.origin === new URL(page.url).origin) return (await readPage(ctx, next.href, hops - 1)) || { doc, url: page.url };
      } catch { /* not an address */ }
    }
    return { doc, url: page.url };
  }

  /* A site with no icon of any kind that opens its title with an emoji is
     known by that emoji: it is drawn as the picture. */
  function titleMark(doc) {
    const emoji = /^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/u.exec(doc.querySelector("title")?.textContent || "")?.[1];
    if (!emoji || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const pen = canvas.getContext("2d");
    pen.font = '104px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    pen.textAlign = "center"; pen.textBaseline = "middle";
    pen.fillText(emoji, 64, 70);
    return canvas.toDataURL("image/png");
  }

  /* The site a host belongs to: portal.example.cloud is part of www.example.cloud. */
  function parentSite(host) {
    const labels = String(host || "").toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
    const tail = labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2;
    return labels.length > tail ? `https://www.${labels.slice(-tail).join(".")}` : "";
  }

  async function fromSite(query, ctx) {
    /* A page inside a larger site (a portal, a university's exam office)
       often carries no mark of its own, or a sixteen-pixel one. The larger
       site's front page is read beside it, and its icons stand behind the
       page's own. */
    const parent = parentSite(query.host);
    const [own, wider] = await Promise.all([
      siteIcons(query.url, query.origin, ctx),
      parent && parent !== query.origin ? siteIcons(`${parent}/`, parent, ctx).catch(() => []) : []
    ]);
    const label = (ref) => { try { return new URL(ref.url).hostname; } catch { return query.host; } };
    return [...own.map(ref => ({ ...ref, label: query.host })), ...wider.map(ref => ({ ...ref, label: ref.url.startsWith("http") ? label(ref) : query.host, distance: 14 }))]
      .map(ref => ({ id: `site:${ref.url.slice(0, 200)}`, url: ref.url, from: ref.from, label: ref.label, distance: ref.distance || 0, address: ref.url.startsWith("http") ? ref.url : undefined }));
  }

  async function siteIcons(url, origin, ctx) {
    /* The page the bookmark opens, and when that one will not answer (a
       sign-in wall, a page that has moved) the site's front page. */
    const front = `${origin}/`;
    let page = await readPage(ctx, url);
    if (!page && url !== front) page = await readPage(ctx, front);
    let refs = [], manifestUrl = "";
    if (page) {
      const base = page.doc.querySelector("base[href]") ? new URL(page.doc.querySelector("base[href]").getAttribute("href"), page.url).href : page.url;
      ({ refs, manifestUrl } = siteReferences(page.doc, base));
      const mark = titleMark(page.doc);
      if (mark) refs.push({ url: mark, from: "site-title", hint: 1 });
    }
    /* A site that has an icon at all is never left with nothing: the usual
       places are tried for whatever the page did not declare. */
    const declared = (from) => refs.some(ref => ref.from === from && ref.url.startsWith("http"));
    const home = page ? new URL(page.url).origin : origin;
    for (const [path, from, hint] of WELL_KNOWN) {
      if (path !== "/favicon.ico" && declared(from)) continue;
      refs.push({ url: `${home}${path}`, from, hint });
    }
    if (manifestUrl) {
      const manifest = await json(ctx, manifestUrl).catch(() => null);
      for (const icon of Array.isArray(manifest?.icons) ? manifest.icons : []) {
        // A maskable icon is a full-bleed square made to be cut by the system: an opaque plate by design.
        if (/maskable/i.test(icon?.purpose || "") && !/any/i.test(icon.purpose)) continue;
        try { refs.push({ url: new URL(icon.src, manifestUrl).href, from: "site-manifest", hint: /svg/i.test(`${icon.type} ${icon.src}`) ? 1000 : largestSize(icon.sizes) || 64 }); } catch { /* ignored */ }
      }
    }
    return [...new Map(refs.map(ref => [ref.url, ref])).values()].sort((a, b) => b.hint - a.hint).slice(0, SITE_IMAGES);
  }

  /* ── Pictures: fetched once, measured, kept as data ─────────────── */

  const toDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  /* Size, whether the four corners are see-through, where the drawing sits
     inside its box, and whether it has colour of its own. */
  async function measure(src) {
    const image = new Image();
    image.src = src;
    await image.decode();
    const width = image.naturalWidth || 256, height = image.naturalHeight || 256;
    const side = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = side;
    const pen = canvas.getContext("2d", { willReadFrequently: true });
    const scale = Math.min(side / width, side / height);
    const drawnWidth = Math.max(1, Math.round(width * scale)), drawnHeight = Math.max(1, Math.round(height * scale));
    const left = Math.floor((side - drawnWidth) / 2), top = Math.floor((side - drawnHeight) / 2);
    pen.drawImage(image, left, top, drawnWidth, drawnHeight);
    const { data } = pen.getImageData(0, 0, side, side);
    const alphaAt = (x, y) => data[(y * side + x) * 4 + 3];
    const corners = [[left, top], [left + drawnWidth - 1, top], [left, top + drawnHeight - 1], [left + drawnWidth - 1, top + drawnHeight - 1]];
    const opaque = corners.filter(([x, y]) => alphaAt(x, y) > 240).length >= 3;
    let minX = side, minY = side, maxX = -1, maxY = -1, inked = 0, coloured = 0, weight = 0, light = 0;
    const sum = [0, 0, 0];
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const at = (y * side + x) * 4;
      if (data[at + 3] < 24) continue;
      inked++;
      const alpha = data[at + 3] / 255;
      weight += alpha; light += luminanceOf(data[at], data[at + 1], data[at + 2]) * alpha;
      sum[0] += data[at] * alpha; sum[1] += data[at + 1] * alpha; sum[2] += data[at + 2] * alpha;
      if (Math.max(data[at], data[at + 1], data[at + 2]) - Math.min(data[at], data[at + 1], data[at + 2]) > 28) coloured++;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!inked) throw new Error("Empty picture");
    // One colour throughout: nearly every drawn pixel sits by the average of them all.
    const mean = sum.map(channel => channel / weight);
    let near = 0;
    for (let at = 0; at < data.length; at += 4) {
      if (data[at + 3] < 24) continue;
      if (Math.abs(data[at] - mean[0]) + Math.abs(data[at + 1] - mean[1]) + Math.abs(data[at + 2] - mean[2]) < 72) near += data[at + 3] / 255;
    }
    /* What the drawing looks like, coarsely: an eight by eight grid over where
       it sits, each cell how much of it is drawn (how light, on a plate). */
    const look = [];
    const cellW = (maxX - minX + 1) / 8, cellH = (maxY - minY + 1) / 8;
    for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
      let total = 0, count = 0;
      for (let y = Math.floor(minY + row * cellH); y < Math.max(Math.floor(minY + row * cellH) + 1, Math.floor(minY + (row + 1) * cellH)); y++) {
        for (let x = Math.floor(minX + column * cellW); x < Math.max(Math.floor(minX + column * cellW) + 1, Math.floor(minX + (column + 1) * cellW)); x++) {
          const at = (y * side + x) * 4;
          total += opaque ? (data[at] + data[at + 1] + data[at + 2]) / 765 : data[at + 3] / 255;
          count++;
        }
      }
      look.push(count ? total / count : 0);
    }
    // Where the drawing is, as fractions of the picture: for trimming clear margins away.
    const bounds = { x: (minX - left) / drawnWidth, y: (minY - top) / drawnHeight, w: (maxX - minX + 1) / drawnWidth, h: (maxY - minY + 1) / drawnHeight };
    return {
      width, height, opaque, mono: coloured / inked < 0.08, flat: !opaque && near / weight > 0.9, luminance: light / weight,
      inkAspect: (maxX - minX + 1) / (maxY - minY + 1), look, bounds, measured: true
    };
  }

  async function picture(candidate, ctx) {
    let src = candidate.src || "";
    let vector = Boolean(candidate.vector);
    if (!src && candidate.url.startsWith("data:")) src = candidate.url;
    if (!src) {
      const got = await request(ctx, candidate.url, { max: MAX_IMAGE, as: "blob" });
      const type = (got.blob.type || got.type || "").split(";")[0].trim().toLowerCase();
      const byName = /\.svg(\?|#|$)/i.test(candidate.url) ? "image/svg+xml" : /\.ico(\?|#|$)/i.test(candidate.url) ? "image/x-icon" : "";
      const mime = /^image\//.test(type) ? type : byName;
      if (!mime) throw new Error("Not a picture");
      src = await toDataUrl(got.blob.type === mime ? got.blob : new Blob([got.blob], { type: mime }));
      vector = mime === "image/svg+xml";
    } else if (/^data:image\/svg\+xml/i.test(src)) vector = true;
    const measured = await measure(src);
    // A vector's stated size says nothing of how it scales; its shape is what was measured.
    return { ...candidate, ...measured, width: candidate.width || measured.width, height: candidate.height || measured.height, src, vector, mono: candidate.mono ?? measured.mono };
  }

  const settle = async (jobs) => (await Promise.allSettled(jobs)).flatMap(result => result.status === "fulfilled" ? [].concat(result.value) : []);

  /* find(text) → { query, choices, offline }
     `access` answers whether the browser gave leave to read the site in
     question (the picker asks before calling); without it the site is not
     read and the catalogues alone answer. */
  /* find(text) → { query, choices, offline, declined, late }

     Every source is asked at once. `onProgress` hears the choices, best
     first, each time one of them has answered, so the first good icon can be
     shown without waiting for the slowest; the whole search ends after
     `budget` milliseconds with what it has (`late` says it was cut short).

     `page` is the address of the bookmark the icon is for. A name is then
     looked for on that site too, and what the catalogues say for the name
     is checked against it.

     `access` is the browser's leave to read the site: true, a promise of the
     answer (the question was put at the press), or a function that puts the
     question only when it is needed — for a picture its host will not hand
     over, and for a bookmark's own site when no catalogue had a good answer.

     `ground` is how light the tile is, 0 to 1, so what cannot be seen on it
     does not come first. */
  async function find(text, { access = true, host = "", page = "", ground, fetchImpl, signal, measureImpl, onProgress, budget = BUDGET_MS } = {}) {
    const query = parseQuery(text);
    if (query.kind === "empty") return { query, choices: [], offline: false };
    const stopper = new AbortController();
    const stop = () => stopper.abort(signal?.reason);
    if (signal?.aborted) stop(); else signal?.addEventListener("abort", stop, { once: true });
    const ctx = context({ fetchImpl, signal: stopper.signal });
    const load = (candidate) => (measureImpl ? measureImpl(candidate, ctx) : picture(candidate, ctx));
    const found = [];
    let over = false, late = false, declined = false;
    const ranked = () => rank(found, { ground });
    const gather = (source) => source.then(list => settle(list.map(load))).then((list) => {
      if (over) return;
      found.push(...list);
      if (list.length) onProgress?.(ranked());
    }, () => {});

    /* The clock runs while Nordlys is looking, not while the person reads the browser's question. */
    let timer = 0, expire = () => {};
    const expired = new Promise((resolve) => { expire = resolve; });
    const clock = (running) => { clearTimeout(timer); if (running) timer = setTimeout(() => { late = true; expire(); }, budget); };
    const leave = async (ask) => { clock(false); try { return Boolean(await ask); } finally { clock(true); } };

    const work = (async () => {
      if (query.kind === "image") {
        const address = () => gather(Promise.resolve([{ id: "address", url: query.url, from: "address", label: query.host || "", address: query.url.startsWith("http") ? query.url : undefined }]));
        if (typeof access !== "function" && !(await leave(access))) { declined = true; return; }
        // A picture at an address is tried first as anyone may read it; the question is kept for a host that refuses.
        await address();
        if (!found.length && typeof access === "function" && query.host) {
          if (await leave(access())) await address(); else declined = true;
        }
        return;
      }
      const site = query.kind === "site" ? query : (() => { const own = parseQuery(page); return own.kind === "site" ? own : null; })();
      const near = query.kind === "site" ? query.host : (site?.host || host);
      const catalogues = [
        gather(fromIconify(query.name, ctx, { host: near })),
        gather(fromWikimedia(query.name, ctx, query.kind === "site" ? { host: query.host, strict: true } : { host: near }))
      ];
      if (!site) { await Promise.all(catalogues); return; }
      const read = () => gather(fromSite(site, ctx));
      if (typeof access === "function") {
        // Leave not yet given: the catalogues first, and the question only if they have nothing good.
        await Promise.all(catalogues);
        if ((ranked()[0]?.score || 0) >= GOOD) return;
        if (await leave(access())) await read(); else declined = query.kind === "site";
        return;
      }
      const allowed = await leave(access);
      if (allowed) catalogues.push(read()); else declined = query.kind === "site";
      await Promise.all(catalogues);
    })();

    clock(true);
    try { await Promise.race([work.catch(() => {}), expired]); }
    finally { over = true; clearTimeout(timer); signal?.removeEventListener("abort", stop); if (late) stopper.abort(new Error("Out of time")); }
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Stopped");
    const choices = ranked();
    return { query, choices, offline: !choices.length && ctx.asked > 0 && ctx.failed >= ctx.asked, declined, late };
  }

  const api = { find, parseQuery, originsFor, brandFromHost, namesFor, score, rank, siteReferences, measure, vectorDataUrl, markupDataUrl, titleFromSlug, fromIconify, fromWikimedia, fromSite, context, GOOD, BUDGET_MS };
  if (typeof window !== "undefined") window.NordlysIconDiscovery = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
