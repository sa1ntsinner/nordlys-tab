const { test, expect } = require('../helpers/nordlys-fixture.cjs');

function contrastRatio(foreground, background) {
  const luminance = value => { const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => { const c = channel / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]; };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (light + .05) / (dark + .05);
}

test('Appearance uses selectable two-column theme cards and a shared live tile preview', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click();
  const cards = page.locator('.theme-card[data-theme]'); await expect(cards).toHaveCount(21);
  await expect(cards.filter({ has: page.locator('[aria-hidden="true"]') })).toHaveCount(0);
  await expect(page.locator('.theme-card[aria-pressed="true"]')).toHaveCount(1);
  const columns = await page.locator('#theme-dark-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  await expect(page.locator('#advanced-glass-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('#appearance-shared-preview .card .tile .box')).toBeVisible();
  await expect(page.locator('#appearance-shared-preview .lbl')).toHaveText('Nordlys Studio');
});

test('all built-in themes retain semantic colors and identical component geometry', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click();
  const ids = await page.locator('.theme-card[data-theme]').evaluateAll(nodes => nodes.map(node => node.dataset.theme));
  const results = await page.evaluate(idsToCheck => {
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;color:var(--nl-text-primary);background:var(--nl-surface-card);border-color:var(--nl-border);outline-color:var(--nl-focus)'; document.body.append(probe);
    const output = idsToCheck.map(id => {
      window.Aurora.setTheme(id); const css = getComputedStyle(probe), tile = document.querySelector('.tile .box').getBoundingClientRect(), card = document.querySelector('.card').getBoundingClientRect();
      return { id, colors: [css.color, css.backgroundColor, css.borderColor, css.outlineColor], geometry: [Math.round(tile.width), Math.round(tile.height), Math.round(card.style?.borderRadius || 0)] };
    }); probe.remove(); return output;
  }, ids);
  expect(results).toHaveLength(21);
  for (const result of results) {
    expect(result.colors.every(value => value && value !== 'rgba(0, 0, 0, 0)')).toBe(true);
    expect.soft(contrastRatio(result.colors[0], result.colors[1]), `${result.id} primary text contrast`).toBeGreaterThanOrEqual(4.5);
  }
  expect(new Set(results.map(result => result.geometry.slice(0, 2).join('x'))).size).toBe(1);
});

test('custom theme accent actions and preview artwork keep WCAG contrast', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.locator('#btn-create-custom-theme').click();
  const contrast = await page.evaluate(() => {
    document.querySelector('#thm-bg-hex').value = '#080b14';
    document.querySelector('#thm-bg-hex').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#thm-accent-hex').value = '#2563eb';
    document.querySelector('#thm-accent-hex').dispatchEvent(new Event('input', { bubbles: true }));
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = value => {
      const channels = rgb(value).map(channel => { const c = channel / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    };
    const ratio = (foreground, background) => { const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x); return (a + .05) / (b + .05); };
    const save = document.querySelector('#thm-save-btn'), icon = document.querySelector('#appearance-shared-preview .nl-icon svg');
    return {
      save: ratio(getComputedStyle(save).color, getComputedStyle(save).backgroundColor),
      icon: ratio(getComputedStyle(icon).fill, getComputedStyle(document.querySelector('#appearance-shared-preview .box')).backgroundColor)
    };
  });
  expect(contrast.save).toBeGreaterThanOrEqual(4.5);
  expect(contrast.icon).toBeGreaterThanOrEqual(3);
});

test('custom theme studio warns when authored text colors fail contrast', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); await page.locator('#btn-create-custom-theme').click();
  await page.locator('#thm-text-hex').fill('#111111');
  await expect(page.locator('#custom-theme-contrast-warning')).toBeVisible();
  await expect(page.locator('#custom-theme-contrast-warning')).toHaveAttribute('role', 'status');
  await page.locator('#thm-text-hex').fill('#f1f5f9');
  await expect(page.locator('#custom-theme-contrast-warning')).toBeHidden();
});
