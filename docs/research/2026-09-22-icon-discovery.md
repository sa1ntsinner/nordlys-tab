# Icon discovery for Nordlys

Date: 2026-09-22

## Recommendation

Do not scrape Google Images or depend on Google's undocumented `s2/favicons` endpoint. Build a user-triggered, local-first icon picker with a ranked source cascade:

1. **Brand mark search** — search only the Simple Icons collection through Iconify after the user presses Search. Fetch the chosen vector once, convert it to inert local image data, and save that data in the bookmark. This should be the primary path for well-known products.
2. **Website icon** — show Chrome's own Manifest V3 Favicon API result for the bookmark URL. This is the most private zero-network-discovery fallback and requires no attempt to scrape the target page.
3. **Discover on website** — later, as an explicit per-site action, request temporary permission for that one origin and inspect `<link rel="icon">`, `apple-touch-icon`, and the web app manifest. Rank the candidates and import the winner locally. Never request broad `https://*/*` access at install time.
4. **Paste URL / upload file / monogram** — retain these as reliable expert and offline fallbacks.
5. **Wikimedia Commons** — offer only as an optional secondary search source if Nordlys also displays source, author, license, and attribution requirements. It should not silently outrank a site's own icon or a curated brand mark.

This is not a stock-icon gallery. The initial view should have two prominent choices — **Find brand icon** and **Use website icon** — and move URL, file, monogram, and the old built-in symbols under “More options”. A search result should show a live tile preview and its source. Selecting a result should persist it locally, so opening a new tab never sends network requests.

## Why these sources

### 1. The website's own icon metadata

HTML explicitly defines `rel="icon"`; when several candidates exist, the browser considers properties such as `media`, `type`, and `sizes`. Apple touch icons are separate, non-standard link relations. A web app manifest can provide multiple icons with `src`, `sizes`, `type`, and `purpose`; SVG can declare `sizes: "any"`. These are authoritative first-party declarations rather than guessed search results. [MDN: `rel`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel), [MDN: manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)

For Nordlys, candidate ranking should be:

- supported SVG from the manifest or page, if it can be safely sanitized/rasterized;
- largest square manifest icon with purpose `any` (prefer at least 192 px);
- largest square `apple-touch-icon`;
- largest declared `rel="icon"`;
- `/favicon.ico` only as a last network fallback.

Reject non-image responses, dimensions below the display need when a better candidate exists, extreme aspect ratios, files above a strict byte limit, redirects away from HTTPS, and formats the browser cannot decode. Do not preserve an arbitrary remote URL as the tile's permanent source. Fetch once, decode, normalize to a bounded PNG/WebP or tightly sanitized SVG, and store locally.

The direct-site feature has a real permission cost: cross-origin `fetch()` from an extension page requires host permission. Chrome recommends minimal or optional permissions and explains that changing host match patterns can trigger warnings. The right UX is a button labelled “Check this website”, followed by an origin-specific runtime permission request. [Chrome: cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [Chrome: optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)

### 2. Chrome's favicon API

Chrome has an official MV3 Favicon API: with the `favicon` permission an extension builds a local `chrome-extension://…/_favicon/?pageUrl=…&size=…` URL. Nordlys already declares this permission and `_favicon/*`, so this is preferable to a Google proxy for the automatic fallback. It reuses favicon data that Chrome owns and does not require Nordlys to fetch arbitrary sites. The permission does carry the warning “Read the icons of the websites you visit”, which should be explained in privacy copy. [Chrome: Fetching favicons](https://developer.chrome.com/docs/extensions/how-to/ui/favicons), [Chrome: permission list](https://developer.chrome.com/docs/extensions/reference/permissions-list)

### 3. Simple Icons through Iconify

Iconify provides a documented public search API intended for icon pickers, permits self-hosting, and serves CORS/cache headers. Its icon-set metadata includes author and license information. However, the Iconify software license does **not** determine each hosted icon's license; each collection supplies its own metadata. Restricting initial search to `simple-icons` gives Nordlys a coherent set of recognizable monochrome brand marks rather than mixing hundreds of unrelated visual styles. [Iconify API](https://github.com/iconify/website/blob/main/docs/api/index.md), [Iconify icon data](https://github.com/iconify/website/blob/main/docs/icons/icon-data.md), [Iconify license metadata](https://github.com/iconify/types)

Simple Icons' project is CC0, but that does not make every brand mark CC0. Its own disclaimer says that individual licenses, trademarks, and brand guidelines still apply and may change. Search results should therefore say “Brand marks belong to their owners”, expose a source link where practical, and avoid presenting a mark as endorsed by Nordlys. Do not bundle a large static logo pack into the extension; import only the user's selection. [Simple Icons disclaimer](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md)

### 4. Wikimedia Commons

Commons can be queried through the MediaWiki Action API. `imageinfo` can return the original URL or thumbnail plus `extmetadata`; the latter includes fields such as artist, credit, license URL, copyright status, and whether attribution is required. It is suitable for a deliberate “Search Commons” path, not a silent logo backend: results vary in quality, often contain full wordmarks, and have heterogeneous licenses. Fetch only a few records because MediaWiki documents `extmetadata` as expensive. Preserve attribution metadata alongside the locally cached asset. [Commons machine-readable data](https://commons.wikimedia.org/wiki/Help:Machine-readable_data), [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo/en), [Commons credit guidance](https://commons.wikimedia.org/wiki/Commons:Credit_line/en)

### 5. Why not Google scraping

Google's official favicon documentation describes how **site owners publish** an icon for Google Search. It does not document `s2/favicons` as a supported public retrieval API for third-party products. Depending on that endpoint would add an undeclared service dependency, disclose every requested hostname to Google, provide no product SLA, and still return favicon-quality imagery rather than guaranteed high-resolution logos. Google's own guidance says favicons should be square and recommends more than 48×48 px, but does not turn Search into a logo API. [Google Search favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search)

Image-search scraping is worse: unstable HTML, ambiguous ownership, inconsistent resolution, search-result tracking, and a broad attack surface for content parsing. It also makes it hard to tell the user why a particular logo was chosen.

## MV3, CSP, and security constraints

- Manifest V3 forbids remotely hosted executable code; remote JSON/image data is allowed, but it must never be executed. All parsing and rendering logic stays bundled with Nordlys. [Chrome: Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), [Chrome: remote-hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
- Keep `script-src 'self'` and do not insert API-provided SVG/HTML with `innerHTML`. For Simple Icons, accept only the expected path geometry and construct the enclosing SVG locally. For arbitrary website SVG, use a strict sanitizer or rasterize in an isolated image/canvas pipeline; reject external references, scripts, animation, foreign objects, and malformed markup.
- Limit network hosts. The first release needs only Iconify plus Chrome's local favicon API. Do not add `<all_urls>` host permission. If first-party site inspection is added, use `optional_host_permissions` and request only the bookmark origin after a user gesture.
- Enforce HTTPS, timeout and abort requests, response byte limits, MIME/signature checks, bounded dimensions, and a small result limit. Never forward cookies or credentials.
- Queries leave the device only after explicit Search. Send the typed brand query, not the user's bookmark list, history, current groups, or the bookmark URL. State this beside the search control.
- Cache the selected icon as local data and record provenance (`source`, source ID/URL, optional license and attribution). Do not hotlink images on every new-tab load; hotlinking leaks usage, breaks offline behavior, and allows remote replacement.

Chrome explicitly recommends limiting permissions and notes that host permissions let extension pages make cross-origin requests. It also warns against letting untrusted messages trigger arbitrary privileged fetches. These points rule out a generic unrestricted “fetch any supplied URL in the service worker” bridge. [Chrome extension security](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure), [Chrome permission declarations](https://developer.chrome.com/docs/extensions/mv3/declare_permissions)

## Suggested product flow

1. Opening the picker immediately shows a large live preview and the current website icon.
2. The search field is prefilled from the bookmark name/domain but makes no request until Search is pressed.
3. Brand results appear as one coherent grid. Each result says `Simple Icons` and is previewed against the actual tile surface. The chosen color can follow the bookmark accent, while an “Original brand color” option may be added later using catalog metadata.
4. “Use website icon” is one click and needs no additional origin permission.
5. “Check this website for a higher-resolution icon” is an advanced action. Explain the one-site permission before the Chrome prompt.
6. If neither source works, show paste/upload/monogram. Do not show dozens of generic built-in symbols by default.
7. Store the selection locally. A small provenance line in the editor can say `Source: Simple Icons`, `Source: website`, or `Custom` and offer Replace/Reset.

## Delivery order

**Now:** ship explicit Simple Icons search, local embedding, the Chrome favicon option, URL/file/monogram fallbacks, provenance, request cancellation, and tests for unsafe SVG responses and offline failure. Reduce the built-in generic gallery's prominence rather than deleting it immediately, so existing users and backups remain compatible.

**Next:** add origin-specific “Check this website” discovery. Parse page icons and the linked manifest, score candidates, normalize the selected asset, then immediately remove optional host permission if it is no longer needed.

**Later, only if requested by users:** add Wikimedia Commons with visible license/attribution. Self-host the narrow Simple Icons index or bundle its searchable metadata if third-party availability or query privacy becomes a concern.

## Acceptance criteria

- No request occurs merely by opening the picker or editing a bookmark.
- Search sends only the explicit query to a documented host.
- The new-tab page performs no icon-network requests after selection.
- A failed/offline search leaves the current icon unchanged and offers website icon/manual options.
- Unsupported or active SVG content cannot enter the DOM.
- No broad host permission is added.
- Source/provenance survives export/import.
- Keyboard and screen-reader users can search, inspect source, choose, and undo.
- Existing icons and legacy backups continue to render.

