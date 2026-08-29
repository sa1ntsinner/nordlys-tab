const { test, expect } = require('../helpers/nordlys-fixture.cjs');

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

test('entrance and interactive motion use only transform and opacity within budget', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const entrance = await animationAudit(page);
  expect(entrance.length).toBeGreaterThan(0);
  for (const animation of entrance) {
    expect.soft(animation.properties.filter(property => !['transform', 'opacity'].includes(property)), JSON.stringify(animation)).toEqual([]);
    expect.soft(animation.duration + Math.max(0, animation.delay), JSON.stringify(animation)).toBeLessThanOrEqual(320);
  }
  await page.waitForTimeout(350);
  await page.locator('#gear').click();
  const panel = await animationAudit(page, '#cfg, #dim');
  for (const animation of panel) expect.soft(animation.duration, JSON.stringify(animation)).toBeLessThanOrEqual(280);
});

test('reduced motion removes scale, blur, parallax, and long animation', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
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
  const { page } = nordlysPage; await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  const tile = page.locator('#board .tile').first(); await tile.hover(); await tile.focus(); await page.locator('#gear').hover();
  await page.locator('#gear').click(); await page.locator('#settings-tab-bookmarks').click();
  const folder = page.locator('.bookmark-folder-accordion').first(); await folder.locator('summary').click(); await folder.getByRole('button', { name: /Edit YouTube/ }).click(); await folder.getByRole('button', { name: /Choose icon/ }).click();
  const offenders = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getClientRects().length && !element.closest('[hidden],[inert],[aria-hidden="true"]')).map(element => {
    const style = getComputedStyle(element); return { selector: `${element.tagName.toLowerCase()}#${element.id}.${element.className}`, transform: style.transform, filter: style.filter, backdrop: style.backdropFilter };
  }).filter(item => item.transform !== 'none' || item.filter !== 'none' || item.backdrop !== 'none'));
  expect(offenders).toEqual([]);
});
