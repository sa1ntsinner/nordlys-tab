# 🌐 Chrome Web Store & Developer Publication Guide

This document guides you through testing Nordlys locally and publishing it to the Chrome Web Store.

---

## 🛠️ Step 1: Load Locally in Developer Mode

You can test Nordlys in any Chromium browser (Google Chrome, Brave, Microsoft Edge, Arc, Opera, Vivaldi):

1. Open your browser and navigate to:
   * Chrome: `chrome://extensions`
   * Brave: `brave://extensions`
   * Edge: `edge://extensions`
2. Toggle **Developer mode** on (top right corner).
3. Click the **Load unpacked** button (top left).
4. Select the project folder:
   ```
   C:\Users\smile\Sync Docs\Important Stuff\aurora-tab
   ```
5. Open a new tab (`Ctrl + T`) to see Nordlys in action!

---

## 📦 Step 2: Packaging for Chrome Web Store

To upload to the Chrome Web Store Developer Dashboard, you need a single `.zip` file containing the extension files.

### Create ZIP using PowerShell:
```powershell
Compress-Archive -Path "C:\Users\smile\Sync Docs\Important Stuff\aurora-tab\*" -DestinationPath "C:\Users\smile\Sync Docs\Important Stuff\nordlys-v2.1.0.zip" -Force
```

---

## 🚀 Step 3: Chrome Web Store Developer Dashboard

1. Visit the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account (one-time $5 developer registration fee if new).
3. Click **Add new item** and upload `nordlys-v2.1.0.zip`.
4. Fill in Store Listing Details:
   - **Title**: `Nordlys - Aesthetic Glass Startpage`
   - **Summary**: `Aesthetic, ultra-fast New Tab startpage featuring dynamic Aurora Borealis shaders, Liquid Glass themes, and smart bookmarking.`
   - **Category**: `Productivity` / `Fun`
   - **Privacy Policy**: Mention that 0 data is collected externally and all bookmarks/settings remain 100% local on user device.
5. Click **Submit for Review**.
