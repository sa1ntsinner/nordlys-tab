# Chrome Web Store publication guide

This document guides you through testing Nordlys locally and publishing it to the Chrome Web Store.

---

## Step 1: load locally in developer mode

You can test Nordlys in any Chromium browser (Google Chrome, Brave, Microsoft Edge, Arc, Opera, Vivaldi):

1. Open your browser and navigate to:
   * Chrome: `chrome://extensions`
   * Brave: `brave://extensions`
   * Edge: `edge://extensions`
2. Toggle **Developer mode** on (top right corner).
3. Click the **Load unpacked** button (top left).
4. Select the project folder:
   ```
   C:\Users\smile\Sync Docs\Important Stuff\Nordlys
   ```
5. Open a new tab (`Ctrl + T`) to see Nordlys in action!

---

## Step 2: package for the Chrome Web Store

To upload to the Chrome Web Store Developer Dashboard, you need a single `.zip` file containing the extension files.

### Create ZIP using PowerShell:

Run this from the repository root. List the shipped paths explicitly — a wildcard
(`-Path .\*`) would sweep in `node_modules/`, `tests/`, and the internal docs,
producing a ~40 MB upload instead of ~600 KB.

```powershell
Compress-Archive -Path manifest.json, newtab.html, PRIVACY.md, README.md, LICENSE, icons, src -DestinationPath nordlys-v0.3.1.zip -Force
```

Verify before uploading — `manifest.json` must sit at the zip root and nothing
else should be present:

```powershell
Expand-Archive nordlys-v0.3.1.zip -DestinationPath .\zip-check -Force; Get-ChildItem .\zip-check
```

---

## Step 3: the developer dashboard

1. Visit the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account (one-time $5 developer registration fee if new).
3. Click **Add new item** and upload `nordlys-v0.3.1.zip`.
4. Fill in the listing from [store-listing.md](store-listing.md), which holds the
   title, summary, description, artwork inventory and the privacy answers as
   text to paste. Do not retype them here; one copy is enough.
5. Click **Submit for Review**.
