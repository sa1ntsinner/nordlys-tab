/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - EXPLICIT, LOCAL-FIRST BRAND ICON DISCOVERY
   Network work happens only after a search; selected vectors are embedded.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const API_ROOT = "https://api.iconify.design";
  const COLLECTION = "simple-icons";
  const MAX_RESULTS = 32;
  const MAX_RESPONSE_BYTES = 512 * 1024;
  const REQUEST_TIMEOUT_MS = 8000;

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

  async function readJson(response) {
    const declared = Number(response.headers?.get?.("content-length"));
    if (declared > MAX_RESPONSE_BYTES) throw new Error("Icon response is too large");
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("Icon response is too large");
    return JSON.parse(text);
  }

  async function search(query, { colour, fetchImpl = fetch, signal } = {}) {
    const cleaned = String(query || "").trim().slice(0, 80);
    if (!cleaned) return [];
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("Icon search timed out")), REQUEST_TIMEOUT_MS);
    const options = { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" };
    try {
      const searchUrl = `${API_ROOT}/search?query=${encodeURIComponent(cleaned)}&prefixes=${COLLECTION}&limit=${MAX_RESULTS}`;
      const searchResponse = await fetchImpl(searchUrl, options);
      if (!searchResponse.ok) throw new Error(`Search failed (${searchResponse.status})`);
      const searchData = await readJson(searchResponse);
      const slugs = Array.from(new Set((searchData.icons || [])
        .filter(id => typeof id === "string" && id.startsWith(`${COLLECTION}:`))
        .map(id => id.slice(COLLECTION.length + 1))
        .filter(slug => /^[a-z0-9-]+$/.test(slug))))
        .slice(0, MAX_RESULTS);
      if (!slugs.length) return [];

      const iconsUrl = `${API_ROOT}/${COLLECTION}.json?icons=${encodeURIComponent(slugs.join(","))}`;
      const iconsResponse = await fetchImpl(iconsUrl, options);
      if (!iconsResponse.ok) throw new Error(`Icons failed (${iconsResponse.status})`);
      const iconSet = await readJson(iconsResponse);
      return slugs.flatMap(slug => {
        const icon = iconSet.icons?.[slug];
        if (!icon) return [];
        try {
          return [{ id: `${COLLECTION}:${slug}`, slug, name: titleFromSlug(slug), source: "Simple Icons", dataUrl: vectorDataUrl({
            ...icon,
            width: icon.width || iconSet.width,
            height: icon.height || iconSet.height
          }, colour) }];
        } catch {
          return [];
        }
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    }
  }

  const api = { search, vectorDataUrl, titleFromSlug };
  if (typeof window !== "undefined") window.NordlysIconDiscovery = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
