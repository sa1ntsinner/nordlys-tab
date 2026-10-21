# Release steps

Nordlys is on the [Chrome Web Store](https://chromewebstore.google.com/detail/nordlys/fepiibfbbjhaoldgcfpfcikbonnjbfdc). Release a new version as an update to that listing.

1. Update the version in `manifest.json` and `src/js/app.js`. The store requires a higher number. Move the Unreleased notes in `CHANGELOG.md` under the new version.
2. Run `npm test`.
3. Run `npm run package`. It checks the version and builds `nordlys-v2.5.1.zip` with the extension files.
4. Commit, tag and push.

   ```sh
   git tag -a v2.5.1 -m "Nordlys 2.5.1"
   git push origin main v2.5.1
   ```

5. Open Nordlys in the [developer dashboard](https://chrome.google.com/webstore/devconsole) and upload the zip under Package. If the listing text or screenshots changed, use [docs/store-listing.md](docs/store-listing.md). The privacy answers and permission justifications are there too.
6. Submit for review. Updates usually go through in a day or two.

Use `https://github.com/sa1ntsinner/nordlys-tab/blob/main/PRIVACY.md` for the dashboard's privacy policy link.
