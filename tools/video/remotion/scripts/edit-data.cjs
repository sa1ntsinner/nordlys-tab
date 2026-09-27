/* The edits (src/edit/*.ts) as plain data, for scripts: esbuild bundles
   them with the music map, so what the scripts read is what the films use. */
const path = require('node:path');
const esbuild = require('esbuild');

module.exports = function editData() {
  const out = esbuild.buildSync({
    stdin: { contents: "export { youtube } from './src/edit/youtube'; export { store } from './src/edit/store'; export * as music from './src/music';", resolveDir: path.resolve(__dirname, '..'), loader: 'ts' },
    bundle: true, format: 'cjs', platform: 'node', write: false, loader: { '.json': 'json' }, external: ['remotion'],
    // src/music.ts imports Easing from nowhere; remotion is only needed by camera.ts, which the edits do not import.
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
};
