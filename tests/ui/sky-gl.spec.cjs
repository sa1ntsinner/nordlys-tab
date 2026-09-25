/* global NORDLYS_REST_PHASE -- read inside page.evaluate, where background.js declares it */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Silk's threads used to be stroked on the 2D canvas, which Chrome rasterises
   on the CPU for a stroke this long and this curved: Silk ran at ten to
   eighteen frames a second on an integrated GPU while every other scene held
   thirty. They are drawn on the GPU layer now (sky-gl.js). The move is only
   worth making if nobody can see it, so the same frame is painted both ways
   and compared as the eye gets it: the canvas over the page colour under it. */
async function bothWays(page, scene) {
  return page.evaluate(async (scene) => {
    window.Nordlys.config.bgMode = scene;
    await window.Nordlys.updateBackgroundMode();
    const engine = window.Nordlys.bgEngine;
    engine.pause();
    engine.quietZones = [];
    const frame = () => {
      engine.t = NORDLYS_REST_PHASE[scene];
      engine.render(0);
      const canvas = engine.canvas;
      return engine.ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const gpu = frame();
    const layer = engine.gl && !engine.gl.lost ? 'gpu' : String(engine.gl);
    // Held off the layer until the scene is chosen again: the 2D strokes.
    engine.gl = null;
    const flat = frame();
    const ground = engine.quietGround;
    const over = (pixels, i, k) => pixels[i + k] * (pixels[i + 3] / 255) + ground[k] * (1 - pixels[i + 3] / 255);
    const width = engine.canvas.width, height = engine.canvas.height;
    let total = 0, lit = 0, channels = 0, inkGpu = 0, inkFlat = 0;
    for (let i = 0; i < gpu.length; i += 4) {
      if (flat[i + 3] > 8) lit++;
      for (let k = 0; k < 3; k++) {
        const [a, b] = [over(gpu, i, k), over(flat, i, k)];
        total += Math.abs(a - b);
        inkGpu += Math.abs(a - ground[k]);
        inkFlat += Math.abs(b - ground[k]);
        channels++;
      }
    }
    /* Two rasterisers never agree on the last sub-pixel of an antialiased edge,
       and a one-pixel line is nearly all edge. The eye does not resolve that,
       so "far" is judged over 2 by 2 blocks, where an edge shifted by a
       fraction of a pixel adds up to the same light. */
    let far = 0, blocks = 0;
    for (let y = 0; y + 1 < height; y += 2) {
      for (let x = 0; x + 1 < width; x += 2) {
        for (let k = 0; k < 3; k++) {
          let a = 0, b = 0;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const i = ((y + dy) * width + x + dx) * 4;
            a += over(gpu, i, k);
            b += over(flat, i, k);
          }
          if (Math.abs(a - b) / 4 > 4) far++;
          blocks++;
        }
      }
    }
    return { layer, lit: lit / (gpu.length / 4), mean: total / channels, far: far / blocks, ink: inkGpu / (inkFlat || 1), light: engine.lightMode };
  }, scene);
}

test('Silk draws its threads on the GPU, and they look as the 2D strokes do', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const gl = await page.evaluate(() => Boolean(new OffscreenCanvas(1, 1).getContext('webgl2')));
  test.skip(!gl, 'this browser has no WebGL2, so Silk is painted in 2D and there is nothing to compare');
  const dark = await bothWays(page, 'silk');
  expect(dark.layer, 'the screen paints Silk on the GPU layer').toBe('gpu');
  expect(dark.lit, 'there is a weave to compare').toBeGreaterThan(0.05);
  expect(dark.mean, 'on average the two frames are within a fraction of a level').toBeLessThan(0.5);
  expect(dark.far, 'and hardly a patch anywhere differs by more than 4 of 255').toBeLessThan(0.005);
  expect(Math.abs(dark.ink - 1), 'the same light in all').toBeLessThan(0.03);

  await page.evaluate(() => { window.Nordlys.config.theme = 'porcelain-light'; window.Nordlys.applyThemeTokens(); });
  await page.evaluate(async () => { window.Nordlys.config.bgMode = 'halo'; await window.Nordlys.updateBackgroundMode(); });
  const light = await bothWays(page, 'silk');
  expect(light.light, 'the light theme multiplies instead of screening').toBe(true);
  expect(light.layer).toBe('gpu');
  expect(light.mean).toBeLessThan(0.5);
  expect(light.far).toBeLessThan(0.005);
});

test('the GPU layer is kept only while a scene draws with it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const gl = await page.evaluate(() => Boolean(new OffscreenCanvas(1, 1).getContext('webgl2')));
  test.skip(!gl, 'no WebGL2 in this browser');
  const state = () => page.evaluate(() => {
    const layer = window.Nordlys.bgEngine.gl;
    return layer === undefined ? 'none' : layer && !layer.lost ? 'live' : 'lost';
  });
  await page.evaluate(async () => { window.Nordlys.config.bgMode = 'silk'; await window.Nordlys.updateBackgroundMode(); });
  await expect.poll(state).toBe('live');
  await page.evaluate(async () => { window.Nordlys.config.bgMode = 'halo'; await window.Nordlys.updateBackgroundMode(); });
  expect(await state(), 'Halo draws no long lines, so the surface goes').toBe('none');
});

/* Contour's lines went to the GPU layer for the same reason (sky-gl.js), as
   pieces of one strip merged where they meet. The same frame both ways again. */
test('Contour draws its lines on the GPU, and they look as the 2D strokes do', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const gl = await page.evaluate(() => Boolean(new OffscreenCanvas(1, 1).getContext('webgl2')));
  test.skip(!gl, 'no WebGL2 in this browser');
  const dark = await bothWays(page, 'drift');
  expect(dark.layer).toBe('gpu');
  expect(dark.lit, 'there are lines to compare').toBeGreaterThan(0.02);
  expect(dark.mean).toBeLessThan(0.5);
  expect(dark.far).toBeLessThan(0.005);
  expect(Math.abs(dark.ink - 1), 'the same light in all').toBeLessThan(0.03);
});
