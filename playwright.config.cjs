const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/ui',
  /* Throwaway inspection sweeps live alongside the suite but are not part of
     the gate; counting them once made the reported test total wrong. They must
     not be named with a leading underscore: Chrome refuses to load an unpacked
     extension whose directory holds any such file. */
  /* The pixel snapshots are Windows renders (their names end in -win32) and
     are reviewed by eye on that machine; on CI's Linux they would only ever
     report a different font rasteriser. */
  /* Off Windows they are left out altogether, for the same reason: a Mac has
     no snapshots to compare with, and each run only wrote new ones and failed.

     A spec named *.alone.spec.cjs measures time, and is only true on a
     machine doing nothing else: it runs by itself afterwards
     (tools/alone.playwright.config.cjs; npm run test:ui runs both). */
  testIgnore: ['**/*.sweep.cjs', '**/*.alone.spec.cjs', ...(process.env.CI || process.platform !== 'win32' ? ['**/visual-regression.spec.cjs'] : [])],
  timeout: 30_000, expect: { timeout: 5_000 },
  /* Every test starts its own static server on an ephemeral port, so each one
     is its own origin with its own localStorage — nothing is shared between
     them, and running them one at a time was five minutes of waiting for no
     reason. Visual snapshots are per-test and unaffected by ordering. */
  fullyParallel: true, workers: process.env.CI ? 2 : 4, reporter: [['list'], ['html', { open: 'never' }]],
  /* On a Mac the skies are drawn by the GPU (Metal) and not by the software
     renderer headless Chromium falls back to, which kept every core busy for
     the whole run. NORDLYS_SOFTWARE_GL=1 puts the software renderer back. */
  use: { launchOptions: { args: process.platform === 'darwin' && !process.env.NORDLYS_SOFTWARE_GL ? ['--use-angle=metal'] : [] }, browserName: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'no-preference', locale: 'en-US' }
});
