const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { openIconPicker } = require('../helpers/flows.cjs');

/* The clock, the date and the greeting all change on their own schedule. Baking
   any of them into a baseline makes the suite fail at midnight, or at whatever
   hour the greeting turns over, for no reason to do with the code. */
async function stabilize(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}#bg-canvas,#clock,#date,#greet{visibility:hidden!important}' });
  await page.waitForTimeout(100);
}

async function snapshot(page, name, options = {}) {
  await stabilize(page);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
    ...options
  });
}

test('representative canvas geometry and icon contrast', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await snapshot(page, 'canvas-dark-1440.png');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('#gear').click(); await page.locator('[data-mode="light"]').click(); await page.locator('#cfgx').click();
  await snapshot(page, 'canvas-light-1024.png');
  await page.setViewportSize({ width: 320, height: 568 });
  await snapshot(page, 'canvas-narrow-320.png');
});

test('settings appearance and bookmark hierarchy', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await snapshot(page, 'settings-appearance-1440.png');
  await page.getByRole('tab', { name: 'Bookmarks' }).click();
  await page.locator('.bookmark-folder-accordion summary').first().click();
  await snapshot(page, 'settings-bookmarks-expanded-1440.png');
});

test('icon picker dialog', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Bookmarks' }).click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary').click();
  await openIconPicker(page, folder);
  await snapshot(page, 'dialog-icon-picker-1440.png');
});

test('menu quick edit and keyboard focus states', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const tile = page.locator('#board .tile').first();
  await tile.focus(); await page.keyboard.press('Shift+F10'); await page.waitForTimeout(120);
  await snapshot(page, 'context-menu-keyboard-1440.png');
  await page.keyboard.press('Enter');
  await snapshot(page, 'dialog-quick-edit-1440.png');
  await page.keyboard.press('Escape'); await tile.focus();
  await snapshot(page, 'tile-focus-ring-1440.png');
});

test('Reduced Motion remains compositionally identical', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await snapshot(page, 'canvas-reduced-motion-1440.png');
});

test('custom theme studio handles dark and light luminance inputs', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click(); await page.locator('#btn-create-custom-theme').click();
  await page.locator('.theme-advanced summary').click();
  await page.locator('#thm-bg-hex').fill('#080b14'); await page.locator('#thm-text-hex').fill('#f4f7ff');
  await snapshot(page, 'custom-theme-dark-1440.png');
  await page.locator('#thm-bg-hex').fill('#f4f7fb'); await page.locator('#thm-card-hex').fill('#ffffff'); await page.locator('#thm-text-hex').fill('#172033');
  await snapshot(page, 'custom-theme-light-1440.png');
});
