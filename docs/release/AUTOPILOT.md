# Releasing without anyone at the keyboard

After the one-time setup below, a release is one tag:

```sh
git tag -a v2.5.3 -m "Nordlys 2.5.3" && git push origin v2.5.3
```

and GitHub does the rest:

| Store | Workflow | Needs |
| --- | --- | --- |
| Chrome Web Store | `release.yml` → `tools/release/publish.cjs` | `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID` |
| Edge Add-ons | `release.yml` | `EDGE_CLIENT_ID`, `EDGE_API_KEY`, `EDGE_PRODUCT_ID` |
| Firefox (AMO) | `release.yml` | `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` (set) |
| Mac App Store | `safari.yml` | `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (set) |
| GitHub release | `release.yml` | nothing |

The workflow refuses a tag whose version isn't the one in `manifest.json`,
runs lint and the unit tests, builds the packages, sends each store its
package, and makes a GitHub release with the zips and the changelog section.
A store without its secrets is skipped with a line in the log.

What no store API does: change the listing's text or pictures. Those stay a
paste from `docs/store-listing.md` into each dashboard when they change.

## One-time setup

### Chrome Web Store

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (any name, e.g. "Nordlys release").
2. APIs & Services → Library: enable **Chrome Web Store API**.
3. APIs & Services → OAuth consent screen: External; app name "Nordlys
   release"; your email as support and developer contact; add yourself as a
   **test user**. Then **Publish app** (to "In production"), or the refresh
   token expires after 7 days. No verification is needed for your own use.
4. Credentials → Create credentials → OAuth client ID → type **Desktop app**.
   Download the JSON.
5. Chrome Web Store Developer Dashboard → Account (Publisher settings): copy
   the **Publisher ID**.
6. Run, from the repo:

   ```sh
   node tools/release/google-auth.cjs <client_secret_….json> <publisher-id>
   ```

   Sign in with the Google account that owns the Chrome Web Store item and
   allow access. The script sets the four `CWS_*` secrets.

### Edge

After the first version is live (a product must exist):

1. Partner Center → Microsoft Edge → **Publish API** → Enable the new
   experience → **Create API credentials**.
2. Copy the **Client ID** and **API key**, and the **Product ID** from the
   extension's overview page.
3. Set them:

   ```sh
   gh secret set EDGE_CLIENT_ID -R sa1ntsinner/nordlys-tab
   gh secret set EDGE_API_KEY -R sa1ntsinner/nordlys-tab
   gh secret set EDGE_PRODUCT_ID -R sa1ntsinner/nordlys-tab
   ```

   (each asks for the value), or put them in a text file and say so.

The Edge API key expires after a while (Partner Center shows the date);
renew it there when it does.
