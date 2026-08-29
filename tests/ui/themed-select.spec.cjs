const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openSettings(page, section = null) {
  await page.locator('#gear').click();
  await expect(page.locator('#cfg')).toBeVisible();
  // Each section is hidden until its tab is chosen, so a control cannot be
  // reached — or clicked — from the wrong one.
  if (section) {
    await page.locator(`#settings-tab-${section}`).click();
    await expect(page.locator(`#sec-${section}`)).toBeVisible();
  }
}

/* The complaint this replaces is visual: a native <select> paints operating-system
   chrome no theme can reach. The element may stay as the value source, but it must
   never render, never take focus, and never reach the accessibility tree. */
test('no native dropdown can render or be reached', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page);
  const exposed = await page.evaluate(() => [...document.querySelectorAll('select')].map(select => ({
    id: select.id || select.className,
    hidden: select.hidden,
    ariaHidden: select.getAttribute('aria-hidden'),
    tabIndex: select.tabIndex,
    // data-native marks a select driven by a purpose-built control instead of the
    // generic list — the scene picker owns the background one.
    drivenElsewhere: select.hasAttribute('data-native'),
    hasTrigger: select.nextElementSibling?.classList.contains('nl-select') === true,
    paints: select.getClientRects().length > 0
  })));
  expect(exposed.length, 'the panel still has dropdowns to replace').toBeGreaterThan(5);
  expect(exposed.filter(item => !item.hidden || item.ariaHidden !== 'true' || item.tabIndex !== -1), 'native selects must be inert').toEqual([]);
  expect(exposed.filter(item => item.paints), 'no native select may paint').toEqual([]);
  expect(exposed.filter(item => !item.hasTrigger && !item.drivenElsewhere), 'every select needs a themed control').toEqual([]);
  expect(exposed.filter(item => item.drivenElsewhere && item.hasTrigger), 'a purpose-built control must not double up with the generic list').toEqual([]);
});

test('the themed list commits with the keyboard and returns focus to its trigger', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page, 'general');
  const select = page.locator('#cfg-time-format');
  const trigger = page.locator('#cfg-time-format + .nl-select');
  const before = await select.inputValue();

  await trigger.focus();
  await page.keyboard.press('Enter');
  const list = page.locator('.nl-select-list.open');
  await expect(list).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(list.locator('[role="option"][aria-selected="true"]')).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  await expect(trigger, 'focus returns to the control that opened the list').toBeFocused();
  expect(await select.inputValue(), 'the native value follows the themed list').not.toBe(before);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('escape closes the list without changing the value', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page, 'general');
  const select = page.locator('#cfg-default-engine');
  const trigger = page.locator('#cfg-default-engine + .nl-select');
  const before = await select.inputValue();

  await trigger.click();
  await expect(page.locator('.nl-select-list.open')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');

  await expect(page.locator('.nl-select-list.open')).toBeHidden();
  expect(await select.inputValue(), 'a cancelled list must not commit').toBe(before);
  await expect(trigger).toBeFocused();
  // Escape closed the list only — the drawer it lives in stays open.
  await expect(page.locator('#cfg')).toBeVisible();
});

test('typing jumps to a matching option', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page, 'general');
  await page.locator('#cfg-default-engine + .nl-select').click();
  await expect(page.locator('.nl-select-list.open')).toBeVisible();
  await page.keyboard.type('wi');
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim().toLowerCase());
  expect(focused?.startsWith('wi'), `type-ahead landed on "${focused}"`).toBe(true);
});

test('font options preview themselves and reach the canvas', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page, 'appearance');
  const trigger = page.locator('#cfg-font-display + .nl-select');
  await trigger.click();
  const outfit = page.locator('.nl-select-list.open [role="option"]', { hasText: /^Outfit$/ });
  await expect(outfit).toBeVisible();
  expect(await outfit.evaluate(node => getComputedStyle(node).fontFamily), 'each face previews itself').toContain('Outfit');

  const georgia = page.locator('.nl-select-list.open [role="option"]', { hasText: /^Georgia$/ });
  await georgia.click();
  await expect(page.locator('.nl-select-list.open')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.Aurora.config.fonts?.display)).toBe('Georgia');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)).toContain('Georgia');
});
