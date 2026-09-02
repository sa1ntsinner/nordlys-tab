const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* A title is allowed to widen its card a little — that is how "GAMING & SIM"
   fits above two columns, and forbidding it outright clipped every ordinary
   folder name. What it may not do is run away: an unconstrained 90-character
   name stretched the card across the whole window with three tiles adrift in it. */
test('a long folder name widens its card within bounds and then truncates', async ({ nordlysPage }) => {
  const { page } = nordlysPage;

  const widthWith = async label => page.evaluate(name => {
    window.Nordlys.config.groups = [{
      label: name, cols: 3, hidden: false,
      links: [
        { name: 'One', url: 'https://a.test/', icon: 'globe', color: '#7c9cff' },
        { name: 'Two', url: 'https://b.test/', icon: 'globe', color: '#7c9cff' },
        { name: 'Three', url: 'https://c.test/', icon: 'globe', color: '#7c9cff' }
      ]
    }];
    window.Nordlys.grid.render();
    document.getElementById('board').classList.add('board-loaded');
    const card = document.querySelector('#board > .card');
    const title = card.querySelector('.cat b');
    return {
      card: Math.round(card.getBoundingClientRect().width),
      clipped: title.scrollWidth > title.clientWidth + 1
    };
  }, label);

  const short = await widthWith('WORK');
  const long = await widthWith('A FOLDER NAME THAT SIMPLY REFUSES TO STOP GOING ON AND ON AND ON FOREVER');

  expect(long.card, `a long name widened the folder from ${short.card}px to ${long.card}px`).toBeLessThanOrEqual(Math.round(short.card * 1.25));
  expect(long.card, 'a folder must never approach the width of the window').toBeLessThanOrEqual(Math.round(await page.evaluate(() => innerWidth) * 0.5));
  expect(long.clipped, 'the overlong title must be truncated rather than pushed out').toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Ordinary names must still be readable in full — the bound exists for absurd
  // ones, not to clip every folder on the board.
  const ordinary = await page.evaluate(() => {
    window.Nordlys.config = JSON.parse(JSON.stringify(window.Nordlys.defaultConfig));
    window.Nordlys.grid.render();
    document.getElementById('board').classList.add('board-loaded');
    return [...document.querySelectorAll('#board > .card .cat b')]
      .filter(node => node.scrollWidth > node.clientWidth + 1)
      .map(node => node.textContent);
  });
  expect(ordinary, 'default folder names must not be truncated').toEqual([]);
});
