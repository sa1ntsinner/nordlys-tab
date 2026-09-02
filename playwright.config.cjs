const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/ui',
  /* Throwaway inspection sweeps live alongside the suite but are not part of
     the gate; counting them once made the reported test total wrong. They must
     not be named with a leading underscore: Chrome refuses to load an unpacked
     extension whose directory holds any such file. */
  testIgnore: '**/*.sweep.cjs',
  timeout: 30_000, expect: { timeout: 5_000 },
  /* Every test starts its own static server on an ephemeral port, so each one
     is its own origin with its own localStorage — nothing is shared between
     them, and running them one at a time was five minutes of waiting for no
     reason. Visual snapshots are per-test and unaffected by ordering. */
  fullyParallel: true, workers: process.env.CI ? 2 : 4, reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'no-preference', locale: 'en-US' }
});
