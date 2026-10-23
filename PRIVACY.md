# Nordlys privacy policy

Effective date: August 16, 2026
Last updated: October 23, 2026
Version: 3.0.0

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
| Where the sky is, working hours, saved skies | `chrome.storage.local` / `localStorage` | The place you set for the sky, the hours the Your day sky knows, and the skies you saved | Only to your own browser's sync, if you turn sync on |
| Keywords | `chrome.storage.local` / `localStorage` | The words you set in Settings → General that take the search box, or `nl` in the address bar, to your own addresses | No |
| Pages you saved | `chrome.storage.local` | A page saved with the toolbar button or the right-click item waits here until the next new tab puts it on your board, then it is deleted | No |
| Exchange rates | `localStorage` | The day's rates the search box last asked for (item 10 below), so it answers again without asking. Cleared by Reset | No |
| What the sky learned | `localStorage` | The weather and the K index last asked for, the horizon of the sky's place, and today's picture of the day with its caption, so a new tab draws at once instead of asking again. Cleared by Reset | No |
| What dashboard cards hold | `chrome.storage.local` | Your tasks, notes, habits, stashed tabs and focus sessions, and what a card last read: a calendar's events, a feed's items, a Value card's last 48 readings | No |
| Whether watched sites answer | `localStorage` | For a bookmark set to show whether its site is up: when it was last asked, whether it answered and how fast. Cleared by Reset | No |
| Lists your folders follow | `localStorage` | When each list a folder follows was last read, so it is read at most once an hour. Cleared by Reset | No |
| What you usually open at this hour | `localStorage` | How often each bookmark on your board was opened in each hour of the day, so the empty search box can offer it at that hour. Older counts fade day by day. Settings → General → Offer what you usually open at this hour turns it off and forgets it; Reset clears it too | No |

---

## 3. Sync, if you turn it on

Sync is off until you turn it on in Settings. Then your setup (folders, bookmarks, profiles, look and layout) is saved in the browser's own sync storage, `storage.sync`, and the browser carries it to your other devices where you're signed in to it: Chrome with your Google account, Edge with your Microsoft account, Firefox with your Mozilla account. Nordlys has no server in between and never sees it. What the browser does with its sync data is covered by that browser's privacy policy.

The place you set for the sky travels with your setup. What was fetched for it (the weather, the K index, the horizon and the pictures) never does. These never go to sync: uploaded or cropped icon images, wallpapers and video loops, custom CSS, folders that follow your browser's bookmarks, recent searches, what you open at which hour, whether watched sites answered, One page fit sizes, and what dashboard cards hold (tasks, notes, habits, stashed tabs). A folder that follows a list at an address does travel with your setup, address and all; each device reads the list itself, and only with leave to reach that site. A deleted bookmark is kept in sync only as the fact that it was deleted, and is dropped from sync 30 days later. Turning sync off stops sending; it doesn't delete what the browser already holds.

---

## 4. When it goes online

A new tab with no dashboard cards, under a sky drawn on your computer, makes no network request at all. These can take it online:

1. When you press Enter in the search box, the text goes through Chrome's `chrome.search` API to the search engine set in Chrome, as it does from the address bar. Nordlys doesn't choose the engine or know which one answered. Nothing you type is sent while you type. Older versions fetched live suggestions; this one doesn't. The one request typing can start is for exchange rates (item 10). A keyword you set up goes straight to its address instead, with the words after it where the address has `%s`. Safari gives extensions no search API, so there you pick an engine once in Settings → General and the search goes straight to it. Typing `nl` and a space in the address bar does the same as the search box: your keywords and bookmarks answer from your saved settings, on your device, and anything else goes to the browser's engine.
2. Opening the icon picker and typing sends nothing. When you press Search, only your phrase goes to Iconify's public API (`api.iconify.design`) for the Simple Icons set. The chosen icon is rebuilt as plain image data and saved locally, so new tabs don't load it online. Bookmark addresses, folders, history and settings aren't included.
3. When you paste an image address for an icon, Nordlys downloads it once and saves it locally. It tries the address directly, or uses `images.weserv.nl` if the site blocks cross-origin loading. The address stays with the bookmark, along with the last few addresses used and a small copy of each icon, so you can switch back. Showing that list makes no request.
4. Opening the icon picker sends nothing. The Website icon tab uses Chrome's local favicon cache. Firefox and Safari have no such cache, so there the tab loads nothing until you pick a source. Optional provider buttons send only the domain you typed, and only to the provider you click. A failed lookup doesn't try another provider on its own.
5. The dashboard weather card asks Open-Meteo (`geocoding-api.open-meteo.com` and `api.open-meteo.com`) for a city you search for and the forecast of the place you chose, and nothing else. Open-Meteo needs no key or account.
6. Connected apps (Settings → Dashboard) read your tasks and events from the apps you connect: Todoist, GitHub, and any calendar by its link (Google Calendar, Outlook, iCloud, Proton and others give one). Your browser asks that app for your tasks with your own token, and nothing goes anywhere else. Ticking a task tells that app it is done. The token is kept only on this device: it is not synced and not written into backups. The browser asks for your leave to reach each app's address when you connect it. Disconnecting deletes the token.
7. **Cards refresh on their own while they are on your dashboard.** You don't have to click anything for these requests: the weather card asks Open-Meteo again when its forecast is more than 30 minutes old; the From your apps card asks the apps you connected when its list is more than 5 minutes old, and every 10 minutes while a tab is open; the Calendar card asks for your calendar links when its events are more than 10 minutes old, and every 15 minutes while a tab is open; the Feeds card asks its feeds every 30 minutes, and 5 minutes after one could not be read; a Value card asks its address as often as you set in it. They do this only while a new tab is open and the card is on the dashboard. Remove the card, or turn the dashboard off, and they stop.
8. **Skies drawn from the world.** Only while one of them is the sky on screen. Each answer is kept, so a new tab asks again only when it could have changed:
   - The weather, for Outside now or a sky whose weather is set to "As it is outside": Open-Meteo (`api.open-meteo.com`) is asked for the current weather at the sky's place, at most every 30 minutes.
   - The aurora, for Space weather or an aurora set to "As seen from here" or "As under the oval": NOAA's Space Weather Prediction Center (`services.swpc.noaa.gov`) is asked for the planetary K index, at most every 30 minutes. Nothing about you or your place is sent.
   - The real horizon, for Your horizon: Open-Meteo's elevation service (`api.open-meteo.com`) is asked for the height of about 260 points around the sky's place, once for each place.
   - The sky's place is the city you set under Where the sky is, otherwise the weather card's city, otherwise the main city of your time zone, rounded to a hundredth of a degree (about a kilometre). Nordlys never asks the browser for your location. Searching for a place sends only what you type to Open-Meteo's place search (`geocoding-api.open-meteo.com`), and only the place you choose is kept.
   - Your day draws today's meetings from your calendar cards, on your device. It sends nothing of its own.
9. **The picture of the day.** Only while one of the Picture of the day skies is on screen, once a day for each, and again only in another language or 30 minutes after a failed try:
   - Wikimedia Commons: Wikimedia's feed (`api.wikimedia.org`) is asked for the day's picture with the date and your language, and the picture comes from `upload.wikimedia.org`.
   - Masterpieces: Wikimedia Commons' search (`commons.wikimedia.org`) is asked for one of its featured paintings, by a number made from the date, and the picture comes from `upload.wikimedia.org`.
   - The Met: the Metropolitan Museum's open collection (`collectionapi.metmuseum.org`) is asked for one of its highlighted paintings, by a number made from the date, and the picture comes from `images.metmuseum.org`.
   - The Earth today: NASA's EPIC service (`epic.gsfc.nasa.gov`) is asked for its latest day, and the picture comes from the same server.
   The browser loads the picture as it loads any picture on the web, so that server sees an ordinary request for it. A rotation (Settings → Background → Change by itself) can land on one of these skies or on a sky drawn from the world; its requests are then the ones above.
10. **Exchange rates.** Typing an amount of money to change, such as "100 usd to eur", asks ExchangeRate-API (`open.er-api.com`) for the day's rates against the US dollar, at most once a day. The request carries nothing you typed: not the amount and not the currencies. The rates are kept for the day, and the answer names where they came from. Units and the time in other places are worked out on your device.
11. **Settings from an address.** Only when you give an address under Settings → Backup → Settings as text and press Read it. The browser asks for your leave to reach that one site, and the file is read once, without cookies or a referrer. It is shown to you and changes nothing until you apply it.
12. **Feeds and values.** The Feeds card reads the feeds and sites you list in it: an RSS or Atom feed as it is, a site's page once to find the feed it names, and Hacker News, Reddit and YouTube addresses as their own feeds. The Value card reads the address you give it as JSON and shows one number from it. Both read without cookies or a referrer, and the browser asks for your leave to reach each site when you save the card.
13. **Sites you watch.** A bookmark set to "Show if it is up" (right-click its tile) is asked whether it answers: one request that reads nothing back, without cookies, at most every 5 minutes for all your new tabs together, and only while a new tab is in view. Its server sees an ordinary request from your browser. No permission is needed, because nothing is read.
14. **Checking the bookmarks.** Only when you press Check now under Settings → Bookmarks → Check the bookmarks. Each page on your board is asked about once, without cookies. To tell a page that is gone from one that is there, the browser asks for your leave to read those sites in that click, and Nordlys gives it back when the check is done.
15. **Folders that follow a list.** Only when you follow a list under Settings → Bookmarks → Follow a list at an address. The browser asks for your leave to reach that one site; the list is read then, and again at most once an hour when a new tab opens, without cookies or a referrer.
16. Settings → Support contains plain links to a donation page, the repository, its issue tracker and this policy. Opening the section loads no remote image, script, beacon or counter. Clicking a link opens a new tab without a referrer or identifier, and Nordlys doesn't learn that you clicked it. A wallet address shown there is copied by your browser's clipboard and goes nowhere else.

The time-of-day light uses the date and your time zone on your device. The night light's "From sunset to sunrise" works out where the sun is from the date and the sky's place, on your device too. Neither asks for your location or sends anything.

Nordlys never sends your bookmark list or browsing activity anywhere. At install it asks for access to no site at all. Access to a site is asked for when you set it up yourself: Todoist, GitHub, the address of a calendar link, a feed or site on the Feeds card, a Value card's address, a list a folder follows, or the one address you read settings from. Checking your bookmarks asks for the sites on your board and hands that leave back when it is done. That is why the list of optional sites includes any `https` address: a calendar, a feed or a list can be on any server. Nordlys asks only for the sites you name, and never on its own. Iconify, Open-Meteo, NOAA, Wikimedia, the Met, NASA EPIC, ExchangeRate-API and `images.weserv.nl` allow browser requests (CORS), so they need no permission.

---

## 5. Permissions

Nordlys uses these permissions:

- `storage` saves your bookmarks, themes and folders on your device.
- `unlimitedStorage` lets you keep your own wallpaper pictures and video loops in IndexedDB without hitting the browser's storage limit.
- `favicon` shows site icons from Chrome's local favicon cache on your tiles.
- `activeTab` lets the toolbar button read the address and title of the page in view when you press it, so you can save the page to a folder. It gives no access to any other page and none when the button isn't pressed. Nothing is sent anywhere.
- `tabGroups` names the group of tabs a folder opens as, when you choose Open all, after the folder. It reads nothing.
- `contextMenus` adds "Save to Nordlys" to the right-click menu of pages and links. A page saved there stays on your device, like one saved from the toolbar button.
- `search` hands what you type in the search box to the browser, which sends it to the search engine you chose in the browser. Nordlys doesn't pick the engine or see the results.
- `bookmarks` is optional and isn't requested at install. Nordlys asks for it only when you link a folder to a Chrome bookmark folder, or turn on Your browser's bookmarks under Settings → General → The search box also finds. It reads that folder to mirror its tiles, or the bookmarks that match what you type in the search box. It never changes or sends your Chrome bookmarks. If you revoke access in `chrome://extensions`, mirroring stops and the tiles already on screen stay.
- Nordlys asks for no site at install. It can't read, change or send data from pages you visit.
- `tabs` is optional and isn't requested at install. Nordlys asks for it only when you press "Stash the tabs of this window" on the Tab stash card, add the Tabs or Recently closed card, list sites to keep shut on the Focus timer card, or turn on Open tabs under Settings → General → The search box also finds. For the stash it reads the addresses and titles of that window's tabs once, saves them on your device and closes those tabs. The Tabs card reads your open tabs to show the ones open more than once and the ones not looked at for days, and closes only the ones you choose. For sites kept shut, the browser tells Nordlys the address a tab goes to; only while a focus runs is it compared with your list, and a tab going to one of those sites waits on a page of Nordlys's own until the focus ends. For the search box it reads the titles and addresses of open tabs while you type, to offer switching to one, and keeps nothing. Nothing is sent anywhere. Without it, Nordlys can't see your open tabs.
- `sessions` is optional and isn't requested at install. Nordlys asks for it only when you add the Recently closed card. It reads the tabs and windows you closed lately to list them, and brings one back when you click it. It keeps nothing and sends nothing.
- `topSites` is optional and isn't requested at install. Nordlys asks for it only when you press "Start from my most visited sites" on an empty board. It reads the browser's list of your most visited sites once, makes a folder of them on your device and keeps nothing else. Nothing is sent anywhere.
- Optional site access (for connected apps, calendar links, feeds, a Value card's address and lists your folders follow) is asked for one site at a time, when you set it up. Checking your bookmarks asks for the sites on your board at once and gives that leave back when it is done. You can take any of it back in the browser's extension settings.
- `history` is optional and isn't requested at install. Nordlys asks for it only when you turn on Pages you visited under Settings → General → The search box also finds. Then the search box asks the browser's history for pages that match what you type, shows a few, and keeps nothing. Nothing is sent anywhere. Turned off, or with the leave taken back, it doesn't look at your history.
- Nordlys has no web-accessible resources. Sites you visit can't load an extension file to check whether it's installed.

---

## 6. Content security policy

Nordlys uses the strict Manifest V3 content security policy. Its scripts, icons and shaders are in the extension package. It can't load or run code from elsewhere.

---

## 7. Keeping and deleting your data

- You can export your whole setup from Settings at any time as a `.json` backup or a standard `.html` bookmarks file, or read it as text under Settings → Backup → Settings as text.
- Reset to Defaults in Settings deletes everything, including stored wallpapers and search history. Uninstalling from `chrome://extensions` also deletes it all.

---

## 8. Contact

You can check these details in the source code.

- Repository: https://github.com/sa1ntsinner/nordlys-tab
- Licence: MIT
