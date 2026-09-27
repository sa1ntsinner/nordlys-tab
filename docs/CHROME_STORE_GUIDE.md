# Load and package the extension

## Load it unpacked

Nordlys works in Chromium browsers, including Chrome, Edge, Brave, Arc, Opera and Vivaldi.

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Turn on Developer mode.
3. Click Load unpacked and pick the repo folder.
4. Open a new tab.

Chrome reads every file in the folder when it loads the extension. A large `node_modules` folder or extra checkouts can slow that down. A clean clone is fine.

## Build the zip without npm

`npm run package` checks the version and makes the zip. To do it by hand, run this in PowerShell from the repo root:

```powershell
Compress-Archive -Path manifest.json, newtab.html, PRIVACY.md, README.md, LICENSE, icons, src -DestinationPath nordlys-v2.5.1.zip -Force
```

List the paths shown. A wildcard would also pack `node_modules/`, the tests and the docs, growing the upload from about 600 KB to 40 MB.

Check that `manifest.json` is at the root of the zip:

```powershell
Expand-Archive nordlys-v2.5.1.zip -DestinationPath .\zip-check -Force; Get-ChildItem .\zip-check
```

Follow [RELEASE_GUIDE.md](../RELEASE_GUIDE.md) to upload the zip and finish the release.
