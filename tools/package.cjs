#!/usr/bin/env node
/* Builds the upload package and refuses to build a wrong one.

   Three things have gone wrong by hand before and are checked here: the
   manifest and the running config disagreeing on the version, a file whose
   name starts with an underscore (Chrome refuses to load the folder), and a
   release guide that names the previous version's archive. */
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync, statSync, rmSync } = require('node:fs');
const { join, resolve, relative } = require('node:path');

const ROOT = resolve(__dirname, '..');
const INCLUDE = ['manifest.json', 'newtab.html', 'PRIVACY.md', 'README.md', 'LICENSE', 'icons', 'src'];

function fail(message) { console.error(`package: ${message}`); process.exit(1); }

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const appVersion = /version:\s*"([^"]+)"/.exec(readFileSync(join(ROOT, 'src', 'js', 'app.js'), 'utf8'))?.[1];
if (manifest.version !== appVersion) fail(`manifest.json says ${manifest.version}, src/js/app.js says ${appVersion}`);
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail(`version ${manifest.version} is not a plain three-part number`);

function walk(path, out = []) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}
const files = INCLUDE.flatMap(name => {
  const full = join(ROOT, name);
  if (!existsSync(full)) fail(`${name} is missing`);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const underscored = files.filter(file => /(^|[\\/])_[^\\/]*$/.test(relative(ROOT, file)));
if (underscored.length) fail(`files Chrome will refuse to load:\n  ${underscored.map(f => relative(ROOT, f)).join('\n  ')}`);

for (const doc of ['RELEASE_GUIDE.md', 'docs/CHROME_STORE_GUIDE.md']) {
  const text = readFileSync(join(ROOT, doc), 'utf8');
  const stale = [...text.matchAll(/nordlys-v(\d+\.\d+\.\d+)\.zip/g)].map(m => m[1]).filter(v => v !== manifest.version);
  if (stale.length) fail(`${doc} still names version ${[...new Set(stale)].join(', ')}`);
}

const archive = join(ROOT, `nordlys-v${manifest.version}.zip`);
rmSync(archive, { force: true });
if (process.platform === 'win32') {
  const paths = INCLUDE.map(name => `'${name}'`).join(', ');
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path ${paths} -DestinationPath '${archive}' -Force`], { cwd: ROOT, stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', archive, ...INCLUDE], { cwd: ROOT, stdio: 'inherit' });
}

const size = Math.round(statSync(archive).size / 1024);
console.log(`${relative(ROOT, archive)}: ${files.length} files, ${size} KB, version ${manifest.version}`);
