const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/ui', timeout: 30_000, expect: { timeout: 5_000 },
  fullyParallel: false, workers: 1, reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'no-preference', locale: 'en-US' }
});
