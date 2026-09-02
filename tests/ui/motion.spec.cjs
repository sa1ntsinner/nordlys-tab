const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { openIconPicker } = require('../helpers/flows.cjs');

async function animationAudit(page, context = null) {
  return page.evaluate(scope => document.getAnimations({ subtree: true }).filter(animation => {
    const target = animation.effect?.target;
    return !scope || target?.matches?.(scope) || target?.closest?.(scope);
  }).map(animation => {
    const effect = animation.effect;
    const timing = effect?.getComputedTiming() || {};
    const keys = new Set();
    for (const frame of effect?.getKeyframes?.() || []) {
      for (const key of Object.keys(frame)) {
        if (!['offset', 'easing', 'composite', 'computedOffset'].includes(key)) keys.add(key);
      }
    }
    const target = effect?.target;
    return { target: target ? `${target.tagName.toLowerCase()}#${target.id}.${[...target.classList].join('.')}` : 'unknown', properties: [...keys], duration: Number(timing.duration) || 0, delay: Number(timing.delay) || 0 };
  }), context);
}

/* The page used to assemble itself: the clock bloomed, the search bar rose, the
   cards lifted and the tiles cascaded, and a timer switched the whole thing off
   after as much as two seconds. On a surface opened dozens of times a day that
   is not a flourish, it is a toll — so arrival is now instant by contract, and
   motion belongs only to things the user starts. */
test('the page does not animate itself on arrival', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const onArrival = await animationAudit(page);
  const moving = onArrival.filter(animation => animation.duration > 0);
  expect(moving, `nothing should be animating on load: ${JSON.stringify(moving)}`).toEqual([]);
});

test('interactive motion uses only transform and opacity within budget', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#q').click();
  await page.locator('#q').fill('git');
  await page.waitForTimeout(60);
  const suggestions = await animationAudit(page, '#sugg');
  for (const animation of suggestions) {
    expect.soft(animation.properties.filter(property => !['transform', 'opacity'].includes(property)), JSON.stringify(animation)).toEqual([]);
    expect.soft(animation.duration + Math.max(0, animation.delay), JSON.stringify(animation)).toBeLessThanOrEqual(320);
  }
  await page.keyboard.press('Escape');

  await page.locator('#gear').click();
  const panel = await animationAudit(page, '#cfg, #dim');
  for (const animation of panel) expect.soft(animation.duration, JSON.stringify(animation)).toBeLessThanOrEqual(280);
});

test('reduced motion removes scale, blur, parallax, and long animation', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.locator('#gear').click();
  const audit = await animationAudit(page);
  for (const animation of audit) {
    expect.soft(animation.duration + Math.max(0, animation.delay), JSON.stringify(animation)).toBeLessThanOrEqual(120);
    expect.soft(animation.properties).not.toContain('filter');
    expect.soft(animation.properties).not.toContain('backdropFilter');
  }
  const reduced = await page.evaluate(() => ({
    transform: getComputedStyle(document.querySelector('#cfg')).transform,
    mouseX: document.documentElement.style.getPropertyValue('--mouse-x')
  }));
  expect(reduced.transform).not.toMatch(/matrix\([^)]*0\.9/);
  await page.mouse.move(10, 10);
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--mouse-x'))).toBe(reduced.mouseX);
});

test('reduced motion computes no transform, filter, or backdrop blur in interactive states', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  const tile = page.locator('#board .tile').first(); await tile.hover(); await tile.focus(); await page.locator('#gear').hover();
  await page.locator('#gear').click(); await page.locator('#settings-tab-bookmarks').click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary').click(); await openIconPicker(page, folder);
  const offenders = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getClientRects().length && !element.closest('[hidden],[inert],[aria-hidden="true"]')).map(element => {
    const style = getComputedStyle(element); return { selector: `${element.tagName.toLowerCase()}#${element.id}.${element.className}`, transform: style.transform, filter: style.filter, backdrop: style.backdropFilter };
  }).filter(item => item.transform !== 'none' || item.filter !== 'none' || item.backdrop !== 'none'));
  expect(offenders).toEqual([]);
});

/* A control that does not answer a press reads as a dead surface — the click
   registers only once the work behind it finishes. */
test('controls answer a press immediately', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  const button = page.locator('#cfg-export');
  await expect(button).toBeVisible();

  const box = await button.boundingBox();
  const resting = await button.evaluate(node => getComputedStyle(node).transform);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const pressed = await button.evaluate(node => getComputedStyle(node).transform);
  await page.mouse.up();

  expect(pressed, 'a pressed control must visibly give').not.toBe(resting);
  expect(pressed).not.toBe('none');
});

test('reduced motion keeps the press silent', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  const button = page.locator('#cfg-export');
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const pressed = await button.evaluate(node => getComputedStyle(node).transform);
  await page.mouse.up();
  expect(pressed, 'reduced motion must not scale on press').toBe('none');
});
