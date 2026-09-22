# Privacy Policy for Nordlys

**Effective Date:** August 16, 2026
**Last Updated:** September 22, 2026
**Version:** 2.2.3

Nordlys ("the extension", "we", or "our") is designed with a strict **Privacy-by-Architecture** principle. Nordlys is a client-side, offline-capable New Tab override extension.

**Your bookmarks, themes, and settings never leave your browser.**

---

## 1. Zero Telemetry & Data Collection

- **Zero Analytics or Trackers:** Nordlys does not include Google Analytics, Mixpanel, Sentry, PostHog, or any tracking telemetry.
- **No Remote Servers:** We do not operate external API servers, backend databases, or logging endpoints.
- **No Third-Party Trackers or Ads:** Zero tracking pixels, cookies, or advertising SDKs.
- **No Keystroke or Input Logging by us:** Your bookmarks, custom themes, and settings remain strictly on your local machine.

---

## 2. 100% Client-Side Local Storage

All user preferences, custom themes, custom CSS, bookmarks, and folder layouts are stored exclusively on your device using Chrome's local storage API (`chrome.storage.local` and `localStorage`):

| Data Type | Storage Location | Purpose | Transmitted Externally? |
| :--- | :--- | :--- | :--- |
| **Theme & Shaders Settings** | `chrome.storage.local` / `localStorage` | Saves selected palette, glass blur, and background mode | **NO (100% Local)** |
| **Clock & Greeting Config** | `chrome.storage.local` / `localStorage` | 12h/24h toggle, name greeting, seconds display | **NO (100% Local)** |
| **Custom Bookmarks & Folders** | `chrome.storage.local` / `localStorage` | User-defined bookmark links, titles, colors, and icons | **NO (100% Local)** |
| **Search History** | `localStorage` | Optional recent-searches list shown when the search bar is focused (deletable per item, wiped by Reset) | **NO (100% Local)** |
| **Custom CSS Snippets** | `chrome.storage.local` / `localStorage` | Injected custom stylesheets | **NO (100% Local)** |
| **Custom Wallpapers** | `IndexedDB (MediaVault)` | Persists custom background image/video loop locally | **NO (100% Local)** |

---

## 3. Optional Network Features (Transparent & User-Controlled)

Nordlys performs **no background network requests**. The only network traffic it can ever generate is triggered directly by you:

1. **Searching:** When you press Enter in the search bar, the text is handed to Chrome through its `chrome.search` API, which sends it to the search engine you have chosen in Chrome's own settings — exactly what the address bar does. Nordlys does not choose the engine, does not know which one answered, and sends nothing while you type. Earlier versions fetched live suggestions from a search engine as you typed; that no longer happens.
2. **Brand icon search (user-initiated only):** Opening the icon picker and typing makes no request. Pressing Search sends only that brand/product phrase to Iconify's public API (`api.iconify.design`) and restricts results to the Simple Icons collection. The selected path-only SVG is rebuilt as inert image data and stored locally; new tabs never hotlink it. Bookmark URLs, folders, history, and other settings are not included.
3. **Bookmark Icon Fetch (user-initiated only):** When you paste an image URL in the icon picker, that image is downloaded once (directly, or via the `images.weserv.nl` image proxy when the source blocks cross-origin loading) and stored locally as Base64.
4. **Website icons (only when you open that source):** Opening the icon picker makes no request. The "Website icon" tab reads from Chrome's **local** favicon cache by default — no network at all. Optional provider chips contact only the provider you explicitly choose, with only the domain you typed; a failed lookup never falls back to another provider on its own.
5. **Support links (only when you click one):** The Support section in Settings holds ordinary links — a donation page, this repository, its issue tracker, and this policy. Opening the section requests nothing: no remote image, no script, no beacon, no counter. Following a link opens that site in a new tab with the referrer withheld and no identifier attached; nothing tells Nordlys that you did. Any wallet address shown there is copied by your browser's clipboard and goes nowhere else.

No background request sends your bookmark list or browsing activity. The extension requests no `<all_urls>` host permission and Iconify needs no host permission because its public API explicitly supports browser CORS.

---

## 4. Extension Permissions Explanation

In accordance with the Principle of Least Privilege, Nordlys requests only the minimum necessary permissions:

- **`storage`**: Used strictly to persist user customizations (bookmarks, themes, folders) locally.
- **`unlimitedStorage`**: Allows saving custom user wallpaper images and video loops inside client-side IndexedDB without hitting strict browser storage limits.
- **`favicon`**: Allows displaying website favicons from Chrome's local favicon cache on bookmark tiles.
- **`bookmarks` (optional, never requested at install)**: Only asked for at the moment you point a folder at one of your browser's bookmark folders, and only used to read that folder's contents so the tiles can mirror it. Nordlys never writes to your browser bookmarks and never sends them anywhere. Revoking it in `chrome://extensions` stops the mirroring; the tiles already on screen stay.
- **One host permission**: `images.weserv.nl`, used only for an icon you paste the address of. Nordlys cannot read, alter, or transmit data from web pages you visit.
- **No `tabs` History Access**: Nordlys does not inspect your browsing history, active tabs, or open URLs.
- **Nothing exposed to websites**: Nordlys declares no web-accessible resources, so a page you visit cannot load a file from the extension to find out that you have it installed.

---

## 5. Content Security Policy (CSP)

Nordlys enforces the strict Manifest V3 Content Security Policy:
- All scripts, icons, and shaders are bundled locally within the extension.
- Dynamic remote code loading is disallowed.

---

## 6. Data Retention, Portability & Deletion

You have complete control over your data:
- **Instant Export:** Export your entire setup as a portable `.json` backup or universal Netscape `.html` bookmarks file anytime in Settings.
- **Instant Deletion:** Click "Reset to Defaults" in Settings (also purges stored wallpapers and search history) or uninstall the extension from `chrome://extensions` to permanently purge all stored data.

---

## 7. Contact & Open Source Auditing

Nordlys is 100% transparent and open source.
- **Repository:** https://github.com/sa1ntsinner/nordlys-tab
- **License:** MIT License
