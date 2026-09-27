/* Assembles the GitHub Pages site in .site-dist/: the page in site/, and beside
   it the files it borrows from the extension, so the sky on the page is the
   extension's own code and not a copy that can drift. The live demo in demo/
   is the extension's own new tab page with site/demo/shim.js standing in for
   the Chrome APIs. Run by .github/workflows/pages.yml; locally, `npm run site`
   and open .site-dist/. (Not _site: a folder starting with "_" in the repo stops
   Chrome loading it unpacked.) */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.site-dist');
const { BOARDS } = require('./artwork/store-board.cjs');
const BORROWED = {
  'sky/colour-tools.js': 'src/js/colour-tools.js',
  'sky/sky-zones.js': 'src/js/sky-zones.js',
  'sky/sky-clock.js': 'src/js/sky-clock.js',
  'sky/sky-gl.js': 'src/js/sky-gl.js',
  'sky/background.js': 'src/js/background.js',
  'fonts/outfit.woff2': 'src/fonts/outfit.woff2',
  'fonts/instrument-sans.woff2': 'src/fonts/instrument-sans.woff2',
  'icon.svg': 'icons/icon.svg',
  'icon128.png': 'icons/icon128.png'
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'site'), OUT, { recursive: true });
for (const [to, from] of Object.entries(BORROWED)) {
  fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), path.join(OUT, to));
}
// The live demo: the real page, a demo board, and the stand-in for Chrome.
const DEMO = path.join(OUT, 'demo');
for (const dir of ['src', 'icons']) fs.cpSync(path.join(ROOT, dir), path.join(DEMO, dir), { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const board = { ...BOARDS.sky, bgIntensity: 1.5 };
const page = fs.readFileSync(path.join(ROOT, 'newtab.html'), 'utf8')
  .replace('<title>Nordlys</title>', `<title>Nordlys live demo</title>
  <meta name="robots" content="noindex">`)
  .replace('<script src="src/js/boot.js"></script>', `<script>window.__NORDLYS_DEMO_BOARD = ${JSON.stringify(board)}; window.__NORDLYS_DEMO_VERSION = ${JSON.stringify(manifest.version)};</script>
  <script src="shim.js"></script>
  <script src="src/js/boot.js"></script>`);
if (!page.includes('shim.js')) throw new Error('newtab.html changed: the demo shim could not be put in');
fs.writeFileSync(path.join(DEMO, 'index.html'), page);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`site assembled in ${path.relative(ROOT, OUT)}/`);
