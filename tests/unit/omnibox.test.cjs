const { test } = require('node:test');
const assert = require('node:assert/strict');

/* "nl" in the address bar (omnibox.js): the keywords and the board answer,
   the first answer stands for Enter, and anything else goes to the browser's
   own engine. */
const done = { opened: [], created: [], searched: [], defaults: [] };
const on = {};
let saved = {};
globalThis.chrome = {
  runtime: { getURL: () => 'chrome-extension://abc/' },
  storage: { local: { get: (key, answer) => answer({ [key]: saved }) } },
  omnibox: {
    onInputChanged: { addListener: (fn) => { on.changed = fn; } },
    onInputEntered: { addListener: (fn) => { on.entered = fn; } },
    setDefaultSuggestion: (suggestion) => done.defaults.push(suggestion.description)
  },
  tabs: { update: (details) => done.opened.push(details.url), create: (details) => done.created.push(details) },
  search: { query: (details) => { done.searched.push(details); return Promise.resolve(); } }
};
globalThis.NordlysCommands = require('../../src/js/commands.js');
require('../../src/js/search-sources.js');
require('../../src/js/omnibox.js');

saved = {
  golinks: [{ key: 'gh', url: 'https://github.com/search?q=%s' }],
  groups: [{ label: 'Code & more', links: [{ name: 'GitHub', url: 'https://github.com/' }, { name: 'Gist <3', url: 'https://gist.github.com/' }] }]
};

test('a keyword answers first, and the board after it, as text the address bar can show', async () => {
  let shown = null;
  await on.changed('gh nordlys', (list) => { shown = list; });
  assert.equal(done.defaults.at(-1), '<match>gh</match> nordlys <url>https://github.com/search?q=nordlys</url>');
  assert.deepEqual(shown, []);
  await on.changed('gi', (list) => { shown = list; });
  assert.equal(done.defaults.at(-1), 'GitHub <dim>Code &#38; more</dim> <url>https://github.com/</url>');
  assert.deepEqual(shown, [{ content: 'https://gist.github.com/', description: 'Gist &#60;3 <dim>Code &#38; more</dim> <url>https://gist.github.com/</url>' }]);
  await on.changed('weather tomorrow', (list) => { shown = list; });
  assert.equal(done.defaults.at(-1), '<match>weather tomorrow</match>');
});

test('Enter opens the chosen answer, the first one, or searches', async () => {
  await on.entered('https://gist.github.com/', 'newBackgroundTab');
  assert.deepEqual(done.created, [{ url: 'https://gist.github.com/', active: false }]);
  await on.entered('gh tab', 'currentTab');
  await on.entered('git', 'currentTab');
  assert.deepEqual(done.opened, ['https://github.com/search?q=tab', 'https://github.com/']);
  await on.entered('weather tomorrow', 'newForegroundTab');
  assert.deepEqual(done.searched, [{ text: 'weather tomorrow', disposition: 'NEW_TAB' }]);
});
