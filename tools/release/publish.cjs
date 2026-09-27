#!/usr/bin/env node
/* Sends the built packages (npm run ports) to the stores that take them by
   API. Run by .github/workflows/release.yml on a v* tag; each store is
   skipped, with a line saying so, when its secrets are not set.

     node tools/release/publish.cjs [chrome] [edge] [firefox]

   Chrome Web Store  CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN,
                     CWS_PUBLISHER_ID (and CWS_ITEM_ID, default the live one)
   Edge Add-ons      EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID
   Firefox (AMO)     AMO_JWT_ISSUER, AMO_JWT_SECRET

   Only packages go up. Store texts and pictures are changed in each store's
   dashboard (none of the three APIs covers them); docs/store-listing.md has
   the words. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;
const zip = (name) => path.join(ROOT, `nordlys-${name}-v${VERSION}.zip`);
const env = (...names) => names.every((n) => process.env[n]) ? Object.fromEntries(names.map((n) => [n, process.env[n]])) : null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const fail = (store, message) => { failed = true; console.error(`${store}: ${message}`); };

async function chrome() {
  const e = env('CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN', 'CWS_PUBLISHER_ID');
  if (!e) return console.log('chrome: skipped, no CWS_* secrets');
  const item = process.env.CWS_ITEM_ID || 'fepiibfbbjhaoldgcfpfcikbonnjbfdc';
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: e.CWS_CLIENT_ID, client_secret: e.CWS_CLIENT_SECRET, refresh_token: e.CWS_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const token = (await tokenRes.json()).access_token;
  if (!token) return fail('chrome', `no access token (${tokenRes.status})`);
  const auth = { Authorization: `Bearer ${token}` };
  const base = `https://chromewebstore.googleapis.com`;
  const up = await fetch(`${base}/upload/v2/publishers/${e.CWS_PUBLISHER_ID}/items/${item}:upload`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/zip' }, body: fs.readFileSync(zip('chrome')) });
  const upBody = await up.text();
  if (!up.ok) return fail('chrome', `upload ${up.status} ${upBody}`);
  console.log(`chrome: uploaded ${VERSION}`);
  const pub = await fetch(`${base}/v2/publishers/${e.CWS_PUBLISHER_ID}/items/${item}:publish`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
  const pubBody = await pub.text();
  if (!pub.ok) return fail('chrome', `publish ${pub.status} ${pubBody}`);
  console.log(`chrome: sent for review (${pubBody.replace(/\s+/g, ' ').slice(0, 160)})`);
}

async function edge() {
  const e = env('EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID');
  if (!e) return console.log('edge: skipped, no EDGE_* secrets');
  const base = `https://api.addons.microsoftedge.microsoft.com/v1/products/${e.EDGE_PRODUCT_ID}/submissions`;
  const headers = { Authorization: `ApiKey ${e.EDGE_API_KEY}`, 'X-ClientID': e.EDGE_CLIENT_ID };
  const up = await fetch(`${base}/draft/package`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: fs.readFileSync(zip('edge')) });
  if (up.status !== 202) return fail('edge', `upload ${up.status} ${await up.text()}`);
  const upOp = up.headers.get('location');
  for (let i = 0; i < 40; i++) {
    const st = await (await fetch(`${base}/draft/package/operations/${upOp}`, { headers })).json();
    if (st.status === 'Succeeded') break;
    if (st.status === 'Failed') return fail('edge', `package ${JSON.stringify(st)}`);
    await wait(15000);
  }
  console.log(`edge: uploaded ${VERSION}`);
  const pub = await fetch(base, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: `Nordlys ${VERSION}. See CHANGELOG.md in https://github.com/sa1ntsinner/nordlys-tab` }) });
  if (pub.status !== 202) return fail('edge', `publish ${pub.status} ${await pub.text()}`);
  console.log('edge: sent for review');
}

async function firefox() {
  const e = env('AMO_JWT_ISSUER', 'AMO_JWT_SECRET');
  if (!e) return console.log('firefox: skipped, no AMO_* secrets');
  const r = spawnSync('npx', ['-y', 'web-ext@8', 'sign', '-s', path.join(ROOT, 'dist/firefox'), '--channel=listed', '--api-key', e.AMO_JWT_ISSUER, '--api-secret', e.AMO_JWT_SECRET, '--approval-timeout', '0'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const out = `${r.stdout}${r.stderr}`.split(e.AMO_JWT_SECRET).join('***');
  if (r.status !== 0) return fail('firefox', out.trim().split('\n').slice(-6).join('\n'));
  console.log(`firefox: sent ${VERSION} for review`);
}

(async () => {
  const want = process.argv.slice(2);
  const all = { chrome, edge, firefox };
  for (const [name, run] of Object.entries(all)) if (!want.length || want.includes(name)) await run().catch((error) => fail(name, error.message));
  process.exit(failed ? 1 : 0);
})();
