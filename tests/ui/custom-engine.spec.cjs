const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* "Let me point it at the engine I actually use" is one of the most repeated
   asks about start pages, and a search box that cannot reach someone's engine
   is a search box they route around. */

async function openGeneral(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').click();
}

async function chooseEngine(page, value) {
  await page.locator('#cfg-default-engine').evaluate((select, key) => {
    select.value = key;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(120);
}

test('the template field appears only for the custom engine', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openGeneral(page);
  await expect(page.locator('#custom-engine-row')).toBeHidden();
  await chooseEngine(page, 'custom');
  await expect(page.locator('#custom-engine-row')).toBeVisible();
  await chooseEngine(page, 'duckduckgo');
  await expect(page.locator('#custom-engine-row')).toBeHidden();
});

test('a template without a placeholder is called out rather than ignored', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openGeneral(page);
  await chooseEngine(page, 'custom');

  await page.locator('#cfg-custom-engine').fill('https://example.com/search?q=');
  await expect(page.locator('#custom-engine-note')).toHaveAttribute('data-state', 'warn');

  await page.locator('#cfg-custom-engine').fill('https://example.com/search?q=%s');
  await expect(page.locator('#custom-engine-note')).toHaveAttribute('data-state', 'ok');
});

test('searching goes where the template points', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openGeneral(page);
  await chooseEngine(page, 'custom');
  await page.locator('#cfg-custom-engine').fill('https://searx.example/search?q=%s&lang=en');
  await page.keyboard.press('Escape');

  const destination = await page.evaluate(() => {
    const search = window.Aurora.widgets;
    const engine = search.resolveEngine();
    return engine.custom ? engine.url.replace('%s', encodeURIComponent('hello world')) : null;
  });
  expect(destination).toBe('https://searx.example/search?q=hello%20world&lang=en');
});

/* Someone can select Custom and then not fill anything in, or type nonsense.
   The search box still has to work. */
test('an unusable template falls back rather than breaking search', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openGeneral(page);
  await chooseEngine(page, 'custom');
  await page.locator('#cfg-custom-engine').fill('not a url at all');
  await page.keyboard.press('Escape');

  const engine = await page.evaluate(() => {
    const resolved = window.Aurora.widgets.resolveEngine();
    return { name: resolved.name, custom: Boolean(resolved.custom) };
  });
  expect(engine.custom, 'a template with no placeholder is not usable').toBe(false);
  expect(engine.name).toBe('Google');
});

test('the choice survives a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openGeneral(page);
  await chooseEngine(page, 'custom');
  await page.locator('#cfg-custom-engine').fill('https://kagi.example/search?q=%s');
  await page.waitForTimeout(150);

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  expect(await page.evaluate(() => window.Aurora.config.defaultEngine)).toBe('custom');
  expect(await page.evaluate(() => window.Aurora.widgets.resolveEngine().name)).toBe('kagi.example');
});
