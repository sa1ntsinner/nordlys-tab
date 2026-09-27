#!/usr/bin/env node
/* Builds Nordlys for each browser from the one source tree.

     dist/chrome   + nordlys-chrome-v<version>.zip    Chrome Web Store
     dist/edge     + nordlys-edge-v<version>.zip      Edge Add-ons
     dist/firefox  + nordlys-firefox-v<version>.zip   addons.mozilla.org
     dist/safari                                      input for Xcode's converter

   The code is the same everywhere; only the manifest differs. What each
   browser lacks is handled at run time by src/js/platform.js, so nothing
   here rewrites a script. The archives are written by hand (below) rather
   than by PowerShell's Compress-Archive, which stores paths with
   backslashes, and addons.mozilla.org rejects those. */
const { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } = require('node:fs');
const { join, resolve, relative, dirname } = require('node:path');
const zlib = require('node:zlib');

const ROOT = resolve(__dirname, '..');
const OUT = join(ROOT, 'dist');
const INCLUDE = ['manifest.json', 'newtab.html', 'PRIVACY.md', 'README.md', 'LICENSE', 'icons', 'src'];
const GECKO_ID = 'nordlys@sa1ntsinner.github.io';
const ENGINE_LIST = 'src/js/search-engines.js';
const ENGINE_STUB = '/* This browser searches with its own engine; there is nothing to choose here. */\n';

function fail(message) { console.error(`build-ports: ${message}`); process.exit(1); }

const base = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const appVersion = /version:\s*"([^"]+)"/.exec(readFileSync(join(ROOT, 'src', 'js', 'app.js'), 'utf8'))?.[1];
if (base.version !== appVersion) fail(`manifest.json says ${base.version}, src/js/app.js says ${appVersion}`);

const without = (list, ...names) => (list || []).filter(name => !names.includes(name));
const neutral = base.description.replace(/^A Chrome new tab page/, 'A new tab page');

const PORTS = {
  chrome: manifest => manifest,
  edge: manifest => ({ ...manifest, description: neutral }),
  firefox: manifest => ({
    ...manifest,
    description: neutral,
    // Firefox has no /_favicon/ service; icons come from the site instead.
    // It will not ask for identity later, only at install, where it shows
    // no prompt (it opens nothing without a click on Connect).
    permissions: [...without(manifest.permissions, 'favicon'), 'identity'],
    optional_permissions: without(manifest.optional_permissions, 'identity'),
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '140.0',
        // Nordlys sends nothing to its author. Declared, as AMO asks.
        data_collection_permissions: { required: ['none'] }
      }
    }
  }),
  safari: manifest => ({
    ...manifest,
    description: neutral,
    // Safari has neither the favicon service, the search API nor identity;
    // the search box asks for an engine instead (platform.js).
    permissions: without(manifest.permissions, 'favicon', 'search'),
    // Nor bookmarks: Safari extensions cannot read them (bookmark-sync.js).
    optional_permissions: without(manifest.optional_permissions, 'identity', 'bookmarks'),
    browser_specific_settings: { safari: { strict_min_version: '17.0' } }
  })
};

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
}).map(file => relative(ROOT, file).split(/[\\/]/).join('/')).filter(file => file !== 'manifest.json');
const underscored = files.filter(file => file.split('/').some(segment => segment.startsWith('_')));
if (underscored.length) fail(`files a browser will refuse to load:\n  ${underscored.join('\n  ')}`);

/* A plain zip: deflate per file, forward slashes, fixed timestamps so the
   same source gives the same archive. */
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const centralSize = centrals.reduce((sum, buf) => sum + buf.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const only = process.argv.slice(2);
for (const [name, port] of Object.entries(PORTS)) {
  if (only.length && !only.includes(name)) continue;
  const dir = join(OUT, name);
  rmSync(dir, { recursive: true, force: true });
  const manifest = port(JSON.parse(JSON.stringify(base)));
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const entries = [{ name: 'manifest.json', data: Buffer.from(manifestText) }];
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), manifestText);
  for (const file of files) {
    const target = join(dir, file);
    mkdirSync(dirname(target), { recursive: true });
    // Browsers with a search API search with the browser's own engine, and
    // their builds carry no list to choose from (store policy, and ours).
    if (file === ENGINE_LIST && name !== 'safari') {
      writeFileSync(target, ENGINE_STUB);
      entries.push({ name: file, data: Buffer.from(ENGINE_STUB) });
      continue;
    }
    copyFileSync(join(ROOT, file), target);
    entries.push({ name: file, data: readFileSync(join(ROOT, file)) });
  }
  if (name === 'safari') {
    console.log(`dist/safari: ${entries.length} files - convert on a Mac: xcrun safari-web-extension-converter dist/safari --app-name Nordlys --bundle-identifier io.github.sa1ntsinner.nordlys`);
    continue;
  }
  const archive = join(ROOT, `nordlys-${name}-v${base.version}.zip`);
  writeFileSync(archive, zip(entries));
  console.log(`${relative(ROOT, archive)}: ${entries.length} files, ${Math.round(statSync(archive).size / 1024)} KB`);
}
