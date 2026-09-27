#!/usr/bin/env node
/* Uploads a video to the YouTube channel signed in by google-auth.cjs, with
   the title, description and tags from docs/video/youtube/README.md, and its
   thumbnail.

     node tools/release/youtube.cjs <video.mp4> [--thumbnail png] [--privacy public|unlisted|private]

   YouTube keeps videos uploaded through an API project it has not audited
   private, whatever is asked; then open YouTube Studio and switch it to
   Public (or ask Google to audit the project once, see AUTOPILOT.md). */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const video = args[0];
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const thumb = flag('thumbnail', path.join(ROOT, 'docs/video/youtube/thumbnail.png'));
const privacy = flag('privacy', 'public');
const auth = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.nordlys/google.json'), 'utf8'));
const kit = fs.readFileSync(path.join(ROOT, 'docs/video/youtube/README.md'), 'utf8');
const block = (heading) => kit.match(new RegExp(`## ${heading}\\n\\n\`\`\`\\n([\\s\\S]*?)\\n\`\`\``))?.[1].trim();
const title = block('Title'), description = block('Description');
const tags = block('Tags').split(',').map((t) => t.trim()).filter(Boolean);

(async () => {
  const token = (await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: auth.client_id, client_secret: auth.client_secret, refresh_token: auth.refresh_token, grant_type: 'refresh_token' }) })).json()).access_token;
  if (!token) throw new Error('no access token; run tools/release/google-auth.cjs again');
  const bytes = fs.readFileSync(video);
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(bytes.length), 'X-Upload-Content-Type': 'video/mp4' },
    body: JSON.stringify({ snippet: { title, description, tags, categoryId: '28', defaultLanguage: 'en', defaultAudioLanguage: 'en' }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false, embeddable: true } })
  });
  if (!start.ok) throw new Error(`start ${start.status} ${await start.text()}`);
  const put = await fetch(start.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length) }, body: bytes });
  const done = await put.json();
  if (!done.id) throw new Error(`upload ${put.status} ${JSON.stringify(done)}`);
  console.log(`uploaded https://youtu.be/${done.id} (${done.status?.privacyStatus})`);
  if (fs.existsSync(thumb)) {
    const t = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${done.id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' }, body: fs.readFileSync(thumb) });
    console.log(t.ok ? 'thumbnail set' : `thumbnail ${t.status} ${await t.text()}`);
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
