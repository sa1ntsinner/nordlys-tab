#!/usr/bin/env node
/* One-time: lets the release workflow publish to the Chrome Web Store, and
   lets tools/release/youtube.cjs upload videos, as you.

     node tools/release/google-auth.cjs <client_secret_….json> <publisher-id>

   The JSON is an OAuth client of type "Desktop app" from Google Cloud
   Console (see docs/release/AUTOPILOT.md). This opens Google's sign-in in
   your browser, listens on 127.0.0.1 for the answer, and then:
     - sets CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN and
       CWS_PUBLISHER_ID as secrets of sa1ntsinner/nordlys-tab (through gh);
     - keeps the same refresh token in ~/.nordlys/google.json for YouTube.
   Nothing is printed that would let anyone else use it. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');

const [, , clientFile, publisher] = process.argv;
if (!clientFile || !publisher) { console.error('usage: node tools/release/google-auth.cjs <client_secret.json> <publisher-id>'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(clientFile, 'utf8'));
const client = raw.installed || raw.web;
if (!client) { console.error('That file is not an OAuth client JSON.'); process.exit(1); }
const SCOPES = ['https://www.googleapis.com/auth/chromewebstore', 'https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'];
const REPO = 'sa1ntsinner/nordlys-tab';

const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const state = crypto.randomBytes(12).toString('hex');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
  if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) { res.end('Something went wrong. Close this tab and run the script again.'); return; }
  const redirect = `http://127.0.0.1:${server.address().port}/callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: client.client_id, client_secret: client.client_secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }) });
  const token = await tokenRes.json();
  if (!token.refresh_token) { res.end('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and run again.'); console.error('no refresh token:', token.error || tokenRes.status); server.close(); return; }
  const gh = (name, value) => execFileSync('gh', ['secret', 'set', name, '-R', REPO], { input: value, env: { ...process.env, GH_TOKEN: execFileSync('gh', ['auth', 'token', '--user', 'sa1ntsinner'], { encoding: 'utf8' }).trim() } });
  gh('CWS_CLIENT_ID', client.client_id); gh('CWS_CLIENT_SECRET', client.client_secret); gh('CWS_REFRESH_TOKEN', token.refresh_token); gh('CWS_PUBLISHER_ID', publisher);
  const dir = path.join(os.homedir(), '.nordlys');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'google.json'), JSON.stringify({ client_id: client.client_id, client_secret: client.client_secret, refresh_token: token.refresh_token, scopes: SCOPES }, null, 1), { mode: 0o600 });
  res.end('Done. You can close this tab.');
  console.log(`Done: four CWS_* secrets are set on ${REPO}, and ~/.nordlys/google.json holds the YouTube access.`);
  server.close();
});
server.listen(0, '127.0.0.1', () => {
  const redirect = `http://127.0.0.1:${server.address().port}/callback`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for (const [k, v] of Object.entries({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256' })) auth.searchParams.set(k, v);
  console.log('Opening Google sign-in in your browser. If it does not open, visit:\n' + auth.toString());
  // rundll32 rather than "start": cmd would cut the address at its first &.
  const opener = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', auth.toString()]] : process.platform === 'darwin' ? ['open', [auth.toString()]] : ['xdg-open', [auth.toString()]];
  spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
});
