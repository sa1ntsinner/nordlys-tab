const { test, expect } = require('../helpers/nordlys-fixture.cjs');

const viewports = [
  [320, 568], [768, 720], [1024, 768], [1440, 900],
  [1920, 1080], [2560, 1440], [3840, 2160]
];

for (const [width, height] of viewports) {
  test(`canvas remains readable at ${width}x${height}`, async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(350);
    const result = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      const clock = rect('#hero');
      const search = rect('#searchwrap');
      const board = rect('#board');
      const visible = element => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
      };
      const controls = [...document.querySelectorAll('#page button, #page a.tile, #gear')]
        .filter(visible)
        .map(element => ({ name: element.getAttribute('aria-label') || element.textContent.trim(), box: element.getBoundingClientRect().toJSON() }));
      const labels = [...document.querySelectorAll('#board .lbl')].filter(visible).map(label => {
        const box = label.getBoundingClientRect();
        const column = label.closest('.tile')?.getBoundingClientRect();
        return { text: label.textContent.trim(), left: box.left, right: box.right, columnLeft: column?.left, columnRight: column?.right };
      });
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ordered: clock && search && board && clock.bottom <= search.top && search.bottom <= board.top,
        controls,
        labels
      };
    });
    expect(result.overflow).toBeLessThanOrEqual(0);
    expect(result.ordered).toBe(true);
    for (const control of result.controls) {
      expect.soft(control.box.width, `${control.name} width`).toBeGreaterThanOrEqual(40);
      expect.soft(control.box.height, `${control.name} height`).toBeGreaterThanOrEqual(40);
    }
    for (const label of result.labels) {
      expect.soft(label.left, `${label.text} left`).toBeGreaterThanOrEqual(label.columnLeft - 1);
      expect.soft(label.right, `${label.text} right`).toBeLessThanOrEqual(label.columnRight + 1);
    }
  });
}

test('1024 layout remains usable at a 200 percent zoom equivalent', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 512, height: 768 });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator('#clock')).toBeVisible();
  await expect(page.locator('#searchwrap')).toBeVisible();
  await expect(page.locator('#board > .card').first()).toBeVisible();
});
