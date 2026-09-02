const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('uses source-aware icon proportions and restrained interaction states', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const svg = page.locator('.tile').first().locator('.box svg');
  const box = page.locator('.tile').first().locator('.box');
  const [svgRect, boxRect] = await Promise.all([svg.boundingBox(), box.boundingBox()]);
  expect(svgRect.width / boxRect.width).toBeGreaterThanOrEqual(.62);
  expect(svgRect.width / boxRect.width).toBeLessThanOrEqual(.66);
  await page.evaluate(() => {
    window.Nordlys.config.groups[0].links[0].customImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    window.Nordlys.grid.render();
  });
  const raster = page.locator('.tile').first().locator('.box img');
  const [rasterRect, rasterBox] = await Promise.all([raster.boundingBox(), page.locator('.tile').first().locator('.box').boundingBox()]);
  expect(rasterRect.width / rasterBox.width).toBeGreaterThanOrEqual(.68);
  expect(rasterRect.width / rasterBox.width).toBeLessThanOrEqual(.74);
});

test('keeps tiles usable and canvas free of horizontal overflow at 320px', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('#board').waitFor();
  await page.waitForTimeout(1200);
  const sizes = await page.locator('#board .tile .box').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(56);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
