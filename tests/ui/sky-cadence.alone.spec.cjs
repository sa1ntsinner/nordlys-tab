const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Between paints the loop sleeps on a timer rather than taking a vsync callback
   every refresh only to find the budget not yet spent. Asleep or not, it keeps
   the thirty-a-second cadence, never has two frames on the way at once, and
   pausing leaves nothing behind to wake it. (How few callbacks each paint
   costs at each panel rate is pinned exactly in tests/unit/frame-budget.)

   The cadence is judged against the frames the browser offered, not the
   clock on the wall. A shared CI runner drawing this page in software gives
   the page a frame every 50 to 60 ms, so a sky that painted on the first
   frame it was due still showed gaps of 50, and a bound of 37 ms failed it
   for the machine's speed. What the loop decides is the same on any machine:
   never paint sooner than the budget, and paint on the first offered frame
   once it is due rather than sleeping past it. A second chain of callbacks,
   started here only to watch which frames there were, records them. */
test('a moving sky sleeps between paints and keeps its cadence; a paused one does nothing', async ({ nordlysPage, browserName }) => {
  test.skip(browserName !== 'chromium', 'headless Gecko and Playwright WebKit paint too few frames a second to measure the 30 fps budget');
  const { page } = nordlysPage;
  expect(await page.evaluate(() => window.Nordlys.bgEngine.mode), 'a scene that keeps the thirty-a-second budget').toBe('aurora');
  const sample = () => page.evaluate(async () => {
    const engine = window.Nordlys.bgEngine;
    const { loop, wake } = engine;
    const budget = 1000 / 30;
    const paints = [];
    const offered = [];
    let watching = true;
    const watch = time => { offered.push(time); if (watching) requestAnimationFrame(watch); };
    requestAnimationFrame(watch);
    let callbacks = 0;
    let wakes = 0;
    engine.loop = now => {
      callbacks++;
      loop(now);
      if (engine.lastFrame === now) paints.push(now);
    };
    engine.wake = () => { wakes++; wake(); };
    await new Promise(resolve => setTimeout(resolve, 1500));
    watching = false;
    Object.assign(engine, { loop, wake });
    const gaps = paints.slice(1).map((time, i) => time - paints[i]);
    /* A paint is late when the browser offered a frame at which it was already
       due (the loop's own test) and the sky let that frame go by. */
    const late = paints.slice(1).filter((time, i) => offered.some(frame => frame - paints[i] >= budget - 2 && frame < time)).length;
    return { paints: paints.length, callbacks, wakes, late, shortest: gaps.length ? Math.min(...gaps) : null, scheduled: engine.animId !== null };
  });

  const moving = await sample();
  expect(moving.scheduled).toBe(true);
  expect(moving.paints, 'a sky that keeps moving').toBeGreaterThan(2);
  expect(moving.paints, 'no more than thirty paints a second').toBeLessThanOrEqual(48);
  expect(moving.shortest, 'paints a budget apart, never a refresh').toBeGreaterThan(30);
  /* A timer that wakes later than the lead allows costs one frame, and the
     lead then grows to cover it; a sky that sleeps past most of them has lost
     its cadence. */
  expect(moving.late, `${moving.late} of ${moving.paints - 1} paints let a due frame go by`).toBeLessThanOrEqual((moving.paints - 1) / 4);
  // One frame on its way at a time: no second chain of callbacks or timers.
  expect(moving.callbacks, `${moving.callbacks} callbacks for ${moving.paints} paints`).toBeLessThanOrEqual(moving.paints * 2 + 2);
  expect(moving.wakes).toBeLessThanOrEqual(moving.paints + 1);

  await page.evaluate(() => window.Nordlys.bgEngine.pause());
  const paused = await sample();
  expect(paused).toEqual({ paints: 0, callbacks: 0, wakes: 0, late: 0, shortest: null, scheduled: false });

  await page.evaluate(() => window.Nordlys.bgEngine.resume());
  const resumed = await sample();
  expect(resumed.paints, 'and moves again').toBeGreaterThan(2);
  expect(resumed.late).toBeLessThanOrEqual((resumed.paints - 1) / 4);
});
