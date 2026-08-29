const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/ui',
  /* Throwaway inspection sweeps live alongside the suite but are not part of
     the gate; counting them once made the reported test total wrong. */
  testIgnore: '**/__t-*.spec.cjs',
  timeout: 30_000, expect: { timeout: 5_000 },
  fullyParallel: false, workers: 1, reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'no-preference', locale: 'en-US' }
});
