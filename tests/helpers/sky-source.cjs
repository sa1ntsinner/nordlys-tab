/* The sky engine as the page loads it: the catalogue, the engine, then each
   sky's own file, in the order newtab.html lists them. One script, so a test
   can run it in a vm context and read the engine back. */
const { readFileSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

function skyFiles() {
  const markup = read('newtab.html');
  return [...markup.matchAll(/<script src="(src\/js\/(?:sky-catalog|background|skies\/[\w-]+)\.js)"><\/script>/g)].map(match => match[1]);
}

const skySource = () => skyFiles().map(read).join('\n');

module.exports = { skySource, skyFiles };
