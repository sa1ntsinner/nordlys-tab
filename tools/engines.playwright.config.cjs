/* The same UI suite in Firefox's and Safari's engines (Gecko and WebKit).
   Not part of the gate: it is how the ports are checked before a release.
   Specs that load the real Chrome extension, or read Chrome's own
   performance counters, only mean something in Chromium and are left out,
   as are the pixel snapshots (Windows Chromium renders).

     npx playwright install firefox webkit
     npx playwright test --config=tools/engines.playwright.config.cjs */
const { defineConfig } = require('@playwright/test');
const base = require('../playwright.config.cjs');

module.exports = defineConfig({
  ...base,
  testDir: '../tests/ui',
  testIgnore: ['**/*.sweep.cjs', '**/visual-regression.spec.cjs', '**/extension-*.spec.cjs', '**/real-*.spec.cjs', '**/accessibility.spec.cjs', '**/perf*.spec.cjs'],
  reporter: [['list'], ['json', { outputFile: '../test-results/engines.json' }]],
  retries: 1,
  projects: [
    { name: 'firefox', use: { ...base.use, browserName: 'firefox' } },
    { name: 'webkit', use: { ...base.use, browserName: 'webkit' } }
  ]
});
