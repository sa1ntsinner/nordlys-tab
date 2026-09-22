const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function tools() {
  const window = {};
  vm.runInContext(readFileSync('src/js/colour-tools.js', 'utf8'), vm.createContext({ window }));
  return window.NordlysColour;
}
const hue = (tools, hex) => tools.toOklch(tools.hexToRgb(hex))[2];
const turn = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };

test('a harmony keeps the colour it started from and turns the hue as promised', () => {
  const c = tools();
  const base = '#35d6c0';
  const neighbours = c.harmony(base, 'neighbours');
  const split = c.harmony(base, 'split');
  assert.equal(neighbours.length, 3);
  assert.ok(turn(hue(c, neighbours[0]), hue(c, base)) < 0.05, 'the first is the base hue');
  for (const other of neighbours.slice(1)) assert.ok(Math.abs(turn(hue(c, other), hue(c, base)) - Math.PI / 7) < 0.12);
  for (const other of split.slice(1)) assert.ok(Math.abs(turn(hue(c, other), hue(c, base)) - (2 * Math.PI) / 3) < 0.15);
  for (const hex of [...neighbours, ...split]) assert.match(hex, /^#[0-9a-f]{6}$/);
  assert.equal(c.harmony('not a colour', 'split'), null);
});

test('a picture gives the three colours it is mostly made of, the same way every time', () => {
  const c = tools();
  const pixels = [
    ...Array(500).fill([20, 60, 160]),   // a blue sky
    ...Array(300).fill([230, 140, 40]),  // an orange sunset
    ...Array(200).fill([30, 120, 60])    // a green hill
  ];
  const first = c.paletteFromPixels(pixels);
  assert.deepEqual([...first], [...c.paletteFromPixels([...pixels].reverse())], 'order of pixels does not matter');
  const hues = first.map(hex => hue(c, hex));
  const near = target => hues.some(h => turn(h, hue(c, c.rgbToHex(target))) < 0.25);
  assert.ok(near([20, 60, 160]) && near([230, 140, 40]) && near([30, 120, 60]), `found ${first}`);
  // Lifted into the range a sky can glow in: none of them near black.
  for (const hex of first) assert.ok(c.toOklch(c.hexToRgb(hex))[0] >= 0.6, `${hex} is too dark to glow`);
  const lightness = [...first].map(hex => c.toOklch(c.hexToRgb(hex))[0]);
  assert.deepEqual(lightness, [...lightness].sort((a, b) => b - a), 'brightest first');
});

test('too few pixels make no palette rather than a guess', () => {
  assert.equal(tools().paletteFromPixels([[1, 2, 3]]), null);
});

/* The page under the sky, from the computed background the themes set. */
test('the page behind the sky is read from its own gradients', () => {
  const c = tools();
  const glow = 'radial-gradient(80% 55% at 85% 8%, rgba(189, 147, 249, 0.14) 0%, rgba(0, 0, 0, 0) 55%), radial-gradient(130% 100% at 50% -10%, rgb(40, 42, 54) 0%, rgb(25, 23, 36) 100%)';
  const plain = [...c.backgroundAt('none', 'rgb(25, 23, 36)', 700, 190, 1440, 900)];
  assert.deepEqual(plain, [25, 23, 36], 'no gradient is the colour itself');
  // Under the glow's centre: the base gradient near its top, lit by 14% purple.
  const lit = [...c.backgroundAt(glow, 'rgb(25, 23, 36)', 1224, 72, 1440, 900)];
  assert.ok(lit[2] > 60 && lit[0] > 55, `lit ${lit}`);
  // Far from both centres: the base gradient's last stop.
  assert.deepEqual([...c.backgroundAt(glow, 'rgb(25, 23, 36)', 0, 900, 1440, 900)], [25, 23, 36]);
  // A vertical line, top colour at the top and bottom colour at the bottom.
  const line = 'linear-gradient(rgb(255, 255, 255) 0%, rgb(0, 0, 0) 100%)';
  assert.deepEqual([...c.backgroundAt(line, 'rgb(0, 0, 0)', 50, 0, 100, 100)], [255, 255, 255]);
  assert.deepEqual([...c.backgroundAt(line, 'rgb(0, 0, 0)', 50, 50, 100, 100)], [128, 128, 128]);
  assert.deepEqual([...c.backgroundAt('linear-gradient(180deg, rgb(255, 0, 0), rgb(0, 0, 255))', 'rgb(0, 0, 0)', 50, 100, 100, 100)], [0, 0, 255]);
  // A form it does not know is left out, not guessed at.
  assert.deepEqual([...c.backgroundAt('conic-gradient(red, blue)', 'rgb(1, 2, 3)', 5, 5, 10, 10)], [1, 2, 3]);
});
