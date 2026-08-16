# 🚀 AetherTab — Complete Release & Publishing Guide

This guide covers the exact manual steps to publish **AetherTab** on **GitHub** and the **Google Chrome Web Store**.

---

## 📋 Pre-Release Summary

- [x] **Extension Architecture**: Manifest V3 compliant, zero external CDN dependencies, fast cold startup, no `<all_urls>` host permission (only allow-listed suggestion/icon hosts for user-triggered features).
- [x] **Icons Package**: 16x16, 32x32, 48x48, 128x128 PNG icons ready in `icons/`.
- [x] **Privacy Compliance**: Zero-telemetry `PRIVACY.md` whose "Optional Network Features" section matches the manifest exactly.
- [x] **UI/UX Polish**: 21 built-in themes (11 dark + 10 light) with per-theme canvas shader palettes, Dark/Light/Auto system mode, custom theme studio with live preview, drag-and-drop folders, context menus everywhere, glass confirm dialogs & toasts, instant calculator with 10 search engines, video/image wallpapers with blur & dim, Netscape HTML bookmarks import/export.
- [x] **License**: MIT `LICENSE` file included.

---

## 🛠️ Step 1: GitHub Repository & Release

The repository lives at `https://github.com/sa1ntsinner/aethertab`. For future updates:

```powershell
git add .
git commit -m "feat: describe your change"
git push
```

Tag a release when publishing a new store version:

```powershell
git tag -a v2.1.0 -m "Release v2.1.0 - First Public Beta"
git push origin v2.1.0
```

---

## 📦 Step 2: Create the Chrome Web Store `.zip` Package

Google Chrome Web Store requires a `.zip` archive where `manifest.json` is at the **root** of the zip.

### On Windows (PowerShell), from inside the project directory:
```powershell
Compress-Archive -Path manifest.json, newtab.html, PRIVACY.md, README.md, LICENSE, icons, src -DestinationPath aethertab-v2.1.0.zip -Force
```

This generates `aethertab-v2.1.0.zip` ready for upload.

---

## 💳 Step 3: Google Chrome Web Store Developer Registration

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account.
3. Accept the **Developer Terms of Service**.
4. Pay the **one-time $5.00 USD registration fee** via Google Pay.
5. Enable **2-Step Verification** on the account (mandatory): [myaccount.google.com/security](https://myaccount.google.com/security).

---

## 🏪 Step 4: Fill Store Listing in Developer Dashboard

1. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), click **`+ New Item`**.
2. Upload `aethertab-v2.1.0.zip`.

### 4.1 Store Listing Details
- **Title**: `AetherTab — Aesthetic Glass Dashboard` (Max 45 chars)
- **Summary**: `Fast, beautiful new tab: 21 glass themes, live aurora shaders, smart bookmarks, multi-engine search, and full offline privacy.` (Max 132 chars)
- **Category**: **Productivity** or **Lifestyle / Personalization**.
- **Primary Language**: `English (United States)` or `Russian`.

### 4.2 Graphic Assets & Screenshots
- **Store Icon**: Upload `icons/icon128.png` (128x128 PNG).
- **Screenshots**: At least 1 required (up to 5), recommended `1280 x 800 px`. Ready-made shots live in `docs/assets/` (main board in several themes, settings drawer, search calculator) — or take fresh ones with `F11` fullscreen.

---

## 🔒 Step 5: Privacy Practices Declaration

Fill in the **Privacy** tab in the Developer Console exactly as follows:

1. **Single Purpose Description**:
   > *"AetherTab provides a customizable, aesthetic New Tab startpage featuring ambient background shaders, local bookmark organization, and quick search."*
2. **Permission Justifications**:
   - `storage`: *"Required to save user preferences, bookmark folders, themes, and custom CSS locally on the device."*
   - `unlimitedStorage`: *"Allows users to save custom high-resolution background wallpapers and video loops locally without hitting quota limits."*
   - `favicon`: *"Allows displaying website favicons from Chrome's local favicon cache on user bookmark tiles."*
   - Hosts `suggestqueries.google.com`, `duckduckgo.com`, `api.bing.com`, `search.brave.com`, `ac.ecosia.org`, `suggest.yandex.com`, `en.wikipedia.org`: *"Fetches search autocomplete suggestions for the query the user is currently typing, from the engine the user selected. Can be disabled in Settings."*
   - Host `images.weserv.nl`: *"Image proxy fallback used only when the user pastes a custom icon URL whose host blocks cross-origin loading."*
3. **Data Usage**:
   - Select: **"I do not collect or use any user data"**.
   - Check all three certification checkboxes.
4. **Privacy Policy Link**:
   - `https://github.com/sa1ntsinner/aethertab/blob/main/PRIVACY.md`

---

## 🚀 Step 6: Submit for Review

1. Click **Submit for Review**.
2. **Review Time**: Manifest V3 extensions with local storage typically get approved within **24–48 hours**.
3. Once approved, AetherTab will be live on the Chrome Web Store with a public store URL!
