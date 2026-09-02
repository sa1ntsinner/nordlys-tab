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
  await openSettings(page, 'appearance');
  const select = page.locator('#cfg-font-display');
  const trigger = page.locator('#cfg-font-display + .nl-select');
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
  await openSettings(page, 'appearance');
  await page.locator('#cfg-font-display + .nl-select').click();
  const list = page.locator('.nl-select-list.open');
  await expect(list).toBeVisible();
  /* The list takes focus a frame after it opens. Typing into the gap sends the
     keys somewhere else, which is a flake under load rather than a bug — but a
     suite that fails at random is a suite people stop reading. */
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('option');

  /* The font list is whatever is installed, so the target is chosen from what
     is actually there: an option that is not already focused and whose first two
     letters no other option shares. */
  const target = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.nl-select-list.open [role="option"]')].map(node => node.textContent.trim());
    const focused = document.activeElement?.textContent?.trim();
    return labels.find(label => label !== focused
      && labels.filter(other => other.slice(0, 2).toLowerCase() === label.slice(0, 2).toLowerCase()).length === 1);
  });
  expect(target, 'the list has an option with a unique two-letter prefix').toBeTruthy();
  await page.keyboard.type(target.slice(0, 2).toLowerCase());
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focused, `type-ahead landed on "${focused}"`).toBe(target);
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

/* The list scrolls a row into view whenever focus lands on one that is below
   the fold. It was also closing itself on any scroll event, including that one,
   so walking the keyboard to a row far down — or typing the first letter of
   anything below the fold — shut the list and restored the previous value. */
test('reaching a row below the fold does not close the list', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSettings(page, 'appearance');
  await page.locator('#cfg-font-display + .nl-select').click();
  const list = page.locator('.nl-select-list.open');
  await expect(list).toBeVisible();
  const rows = list.locator('[role="option"]');
  expect(await rows.count(), 'a list long enough to scroll').toBeGreaterThan(6);
  const last = (await rows.last().textContent()).trim();

  await page.keyboard.press('End');
  await expect(list, 'the list survives being scrolled to its last row').toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(last);

  /* The very last row of this list is not a font but the offer to load the
     device's fonts, which asks a question rather than committing a value. One
     step up is the last real font, and that is what the walk should commit. */
  await page.keyboard.press('ArrowUp');
  const reached = await page.evaluate(() => document.activeElement?.dataset.value);
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  expect(await page.locator('#cfg-font-display').inputValue()).toBe(reached);
});
