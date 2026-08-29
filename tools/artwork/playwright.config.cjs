const { defineConfig } = require('@playwright/test');

/* The artwork generators are not tests: they drive the real product and write
   the store and README images from what it renders, so the pictures cannot
   claim a feature the code no longer has. Kept out of `npm test` because they
   assert nothing and take a minute of deliberate canvas warm-up.

   Run: npm run artwork */
module.exports = defineConfig({
  testDir: __dirname,
  timeout: 600_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium', headless: true,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark', reducedMotion: 'no-preference', locale: 'en-US'
  }
});
