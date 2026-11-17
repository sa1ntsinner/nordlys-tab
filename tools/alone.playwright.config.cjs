/* The specs that measure time (*.alone.spec.cjs), one at a time and after
   everything else: beside four workers drawing skies, a timer wakes late and
   the measurement is of the machine, not of Nordlys.

     npx playwright test --config=tools/alone.playwright.config.cjs
     npm run test:ui     (the suite, then these) */
const { defineConfig } = require('@playwright/test');
const base = require('../playwright.config.cjs');

module.exports = defineConfig({
  ...base,
  testDir: '../tests/ui',
  testMatch: '**/*.alone.spec.cjs',
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']]
});
