# Nordlys privacy policy

Effective date: August 16, 2026
Last updated: September 25, 2026
Version: 2.5.1

Nordlys runs as a new tab page in your browser. It has no server or account.

Your bookmarks, themes and settings stay in your browser.

---

## 1. What Nordlys doesn't do

- It has no analytics or tracking, including Google Analytics, Mixpanel, Sentry and PostHog.
- It has no server, database or logging endpoint.
- It has no ads, tracking pixels, cookies or ad SDKs.
- It doesn't log what you type, and your bookmarks, themes and settings stay on your machine.

---

## 2. What it stores, and where

Everything is saved on your device. Settings and bookmarks use Chrome's extension storage (`chrome.storage.local`) and `localStorage`. Your own wallpaper uses IndexedDB:

| What | Where | What it's for | Sent anywhere? |
| :--- | :--- | :--- | :--- |
| Theme and background settings | `chrome.storage.local` / `localStorage` | Your palette, glass blur and background | No |
| Clock and greeting | `chrome.storage.local` / `localStorage` | 12 or 24 hours, the name in the greeting, seconds | No |
| Bookmarks and folders | `chrome.storage.local` / `localStorage` | Your links, titles, colours and icons | No |
| Search history | `localStorage` | The optional list of recent searches shown when you click into the search box. You can delete each one, and Reset clears them all | No |
| Custom CSS | `chrome.storage.local` / `localStorage` | Stylesheets you added | No |
| One page fit sizes | `localStorage` | With One page fit on, the sizes it last worked out for up to four window sizes, so a new tab opens already fitted. Never in backups, cleared by Reset | No |
| Your own wallpaper | IndexedDB | The picture or video loop you picked as the background | No |

---

## 3. When it goes online

Nordlys makes no network requests in the background. These actions can take it online:

1. When you press Enter in the search box, the text goes through Chrome's `chrome.search` API to the search engine set in Chrome, as it does from the address bar. Nordlys doesn't choose the engine or know which one answered. Nothing is sent while you type. Older versions fetched live suggestions; this one doesn't.
2. Opening the icon picker and typing sends nothing. When you press Search, only your phrase goes to Iconify's public API (`api.iconify.design`) for the Simple Icons set. The chosen icon is rebuilt as plain image data and saved locally, so new tabs don't load it online. Bookmark addresses, folders, history and settings aren't included.
3. When you paste an image address for an icon, Nordlys downloads it once and saves it locally. It tries the address directly, or uses `images.weserv.nl` if the site blocks cross-origin loading. The address stays with the bookmark, along with the last few addresses used and a small copy of each icon, so you can switch back. Showing that list makes no request.
4. Opening the icon picker sends nothing. The Website icon tab uses Chrome's local favicon cache. Optional provider buttons send only the domain you typed, and only to the provider you click. A failed lookup doesn't try another provider on its own.
5. Settings → Support contains plain links to a donation page, the repository, its issue tracker and this policy. Opening the section loads no remote image, script, beacon or counter. Clicking a link opens a new tab without a referrer or identifier, and Nordlys doesn't learn that you clicked it. A wallet address shown there is copied by your browser's clipboard and goes nowhere else.

The time-of-day light uses the date and your time zone on your device. It doesn't ask for your location or send anything.

Nordlys never sends your bookmark list or browsing activity anywhere. It doesn't ask for access to all sites (`<all_urls>`). Iconify's public API allows browser requests (CORS), so it needs no host permission.

---

## 4. Permissions

Nordlys uses these permissions:

- `storage` saves your bookmarks, themes and folders on your device.
- `unlimitedStorage` lets you keep your own wallpaper pictures and video loops in IndexedDB without hitting the browser's storage limit.
- `favicon` shows site icons from Chrome's local favicon cache on your tiles.
- `bookmarks` is optional and isn't requested at install. Nordlys asks for it only when you link a folder to a Chrome bookmark folder. It only reads that folder to mirror its tiles. It never changes or sends your Chrome bookmarks. If you revoke access in `chrome://extensions`, mirroring stops and the tiles already on screen stay.
- The one host permission, `images.weserv.nl`, is used only for an icon address you pasted. Nordlys can't read, change or send data from pages you visit.
- Nordlys has no tabs or history access. It doesn't look at your browsing history, open tabs or their addresses.
- Nordlys has no web-accessible resources. Sites you visit can't load an extension file to check whether it's installed.

---

## 5. Content security policy

Nordlys uses the strict Manifest V3 content security policy. Its scripts, icons and shaders are in the extension package. It can't load or run code from elsewhere.

---

## 6. Keeping and deleting your data

- You can export your whole setup from Settings at any time as a `.json` backup or a standard `.html` bookmarks file.
- Reset to Defaults in Settings deletes everything, including stored wallpapers and search history. Uninstalling from `chrome://extensions` also deletes it all.

---

## 7. Contact

You can check these details in the source code.

- Repository: https://github.com/sa1ntsinner/nordlys-tab
- Licence: MIT
