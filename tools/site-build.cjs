/* Assembles the GitHub Pages site in _site/: the page in site/, and beside it
   the files it borrows from the extension, so the sky on the page is the
   extension's own code and not a copy that can drift. Run by
   .github/workflows/pages.yml; locally, `npm run site` and open _site/. */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const BORROWED = {
  'sky/colour-tools.js': 'src/js/colour-tools.js',
  'sky/sky-zones.js': 'src/js/sky-zones.js',
  'sky/sky-clock.js': 'src/js/sky-clock.js',
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
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`site assembled in ${path.relative(ROOT, OUT)}/`);
