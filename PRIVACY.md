# Nordlys privacy policy

Effective date: August 16, 2026
Last updated: October 21, 2026
Version: 2.5.2

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
| Search history | `localStorage` | The list of recent searches shown when you click into the search box. Settings → General → Remember recent searches turns it off and forgets them; you can also delete each one, and Reset clears them all | No |
| Custom CSS | `chrome.storage.local` / `localStorage` | Stylesheets you added | No |
| One page fit sizes | `localStorage` | With One page fit on, the sizes it last worked out for up to four window sizes, so a new tab opens already fitted. Never in backups, cleared by Reset | No |
| Your own wallpaper | IndexedDB | The picture or video loop you picked as the background | No |

---

## 3. Sync, if you turn it on

Sync is off until you turn it on in Settings. Then your setup (folders, bookmarks, profiles, look and layout) is saved in the browser's own sync storage, `storage.sync`, and the browser carries it to your other devices where you're signed in to it: Chrome with your Google account, Edge with your Microsoft account, Firefox with your Mozilla account. Nordlys has no server in between and never sees it. What the browser does with its sync data is covered by that browser's privacy policy.

These never go to sync: uploaded or cropped icon images, wallpapers and video loops, custom CSS, folders that follow your browser's bookmarks, recent searches, One page fit sizes, and what dashboard cards hold (tasks, notes, habits, stashed tabs). A deleted bookmark is kept in sync only as the fact that it was deleted, and is dropped from sync 30 days later. Turning sync off stops sending; it doesn't delete what the browser already holds.

---

## 4. When it goes online

A new tab with no dashboard cards makes no network request at all. These can take it online:

1. When you press Enter in the search box, the text goes through Chrome's `chrome.search` API to the search engine set in Chrome, as it does from the address bar. Nordlys doesn't choose the engine or know which one answered. Nothing is sent while you type. Older versions fetched live suggestions; this one doesn't. Safari gives extensions no search API, so there you pick an engine once in Settings → General and the search goes straight to it.
2. Opening the icon picker and typing sends nothing. When you press Search, only your phrase goes to Iconify's public API (`api.iconify.design`) for the Simple Icons set. The chosen icon is rebuilt as plain image data and saved locally, so new tabs don't load it online. Bookmark addresses, folders, history and settings aren't included.
3. When you paste an image address for an icon, Nordlys downloads it once and saves it locally. It tries the address directly, or uses `images.weserv.nl` if the site blocks cross-origin loading. The address stays with the bookmark, along with the last few addresses used and a small copy of each icon, so you can switch back. Showing that list makes no request.
4. Opening the icon picker sends nothing. The Website icon tab uses Chrome's local favicon cache. Firefox and Safari have no such cache, so there the tab loads nothing until you pick a source. Optional provider buttons send only the domain you typed, and only to the provider you click. A failed lookup doesn't try another provider on its own.
5. The dashboard weather card asks Open-Meteo (`geocoding-api.open-meteo.com` and `api.open-meteo.com`) for a city you search for and the forecast of the place you chose, and nothing else. Open-Meteo needs no key or account.
6. Connected apps (Settings → Dashboard) read your tasks and events from the apps you connect: Todoist, GitHub, and any calendar by its link (Google Calendar, Outlook, iCloud, Proton and others give one). Your browser asks that app for your tasks with your own token, and nothing goes anywhere else. Ticking a task tells that app it is done. The token is kept only on this device: it is not synced and not written into backups. The browser asks for your leave to reach each app's address when you connect it. Disconnecting deletes the token.
7. **Cards refresh on their own while they are on your dashboard.** You don't have to click anything for these requests: the weather card asks Open-Meteo again when its forecast is more than 30 minutes old; the From your apps card asks the apps you connected when its list is more than 5 minutes old, and every 10 minutes while a tab is open; the Calendar card asks for your calendar link when its events are more than 10 minutes old, and every 15 minutes while a tab is open. They do this only while a new tab is open and the card is on the dashboard. Remove the card, or turn the dashboard off, and they stop.
8. Settings → Support contains plain links to a donation page, the repository, its issue tracker and this policy. Opening the section loads no remote image, script, beacon or counter. Clicking a link opens a new tab without a referrer or identifier, and Nordlys doesn't learn that you clicked it. A wallet address shown there is copied by your browser's clipboard and goes nowhere else.

The time-of-day light uses the date and your time zone on your device. It doesn't ask for your location or send anything.

Nordlys never sends your bookmark list or browsing activity anywhere. At install it asks for access to no site at all. Access to a site is asked for when you connect it yourself: Todoist, GitHub, or the one address of a calendar link. That is why the list of optional sites includes any `https` address: a calendar link can be on any server. Nordlys asks only for that one address, and never on its own. Iconify, Open-Meteo and `images.weserv.nl` allow browser requests (CORS), so they need no permission.

---

## 5. Permissions

Nordlys uses these permissions:

- `storage` saves your bookmarks, themes and folders on your device.
- `unlimitedStorage` lets you keep your own wallpaper pictures and video loops in IndexedDB without hitting the browser's storage limit.
- `favicon` shows site icons from Chrome's local favicon cache on your tiles.
- `search` hands what you type in the search box to the browser, which sends it to the search engine you chose in the browser. Nordlys doesn't pick the engine or see the results.
- `bookmarks` is optional and isn't requested at install. Nordlys asks for it only when you link a folder to a Chrome bookmark folder. It only reads that folder to mirror its tiles. It never changes or sends your Chrome bookmarks. If you revoke access in `chrome://extensions`, mirroring stops and the tiles already on screen stay.
- Nordlys asks for no site at install. It can't read, change or send data from pages you visit.
- `tabs` is optional and isn't requested at install. Nordlys asks for it only when you press "Stash the tabs of this window" on the Tab stash card. It then reads the addresses and titles of that window's tabs once, saves them on your device and closes those tabs. Nothing is sent anywhere. Without it, Nordlys can't see your open tabs.
- `topSites` is optional and isn't requested at install. Nordlys asks for it only when you press "Start from my most visited sites" on an empty board. It reads the browser's list of your most visited sites once, makes a folder of them on your device and keeps nothing else. Nothing is sent anywhere.
- Optional site access (for connected apps and calendar links) is asked for one site at a time, when you connect it. You can take it back in the browser's extension settings.
- Nordlys has no history access. It doesn't look at your browsing history.
- Nordlys has no web-accessible resources. Sites you visit can't load an extension file to check whether it's installed.

---

## 6. Content security policy

Nordlys uses the strict Manifest V3 content security policy. Its scripts, icons and shaders are in the extension package. It can't load or run code from elsewhere.

---

## 7. Keeping and deleting your data

- You can export your whole setup from Settings at any time as a `.json` backup or a standard `.html` bookmarks file.
- Reset to Defaults in Settings deletes everything, including stored wallpapers and search history. Uninstalling from `chrome://extensions` also deletes it all.

---

## 8. Contact

You can check these details in the source code.

- Repository: https://github.com/sa1ntsinner/nordlys-tab
- Licence: MIT
