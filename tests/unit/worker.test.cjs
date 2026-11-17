const { test } = require('node:test');
const assert = require('node:assert/strict');

/* The extension's worker (worker.js): "nl" in the address bar, where the
   keywords and the board answer, the first answer stands for Enter and
   anything else goes to the browser's own engine; and "Save to Nordlys" in
   the right-click menu, which only puts the page in the inbox. */
const done = { opened: [], created: [], searched: [], defaults: [], menus: [], sent: [], badges: [] };
const on = {};
const store = {};
globalThis.chrome = {
  runtime: { getURL: (path = '') => `chrome-extension://abc/${path}`, onInstalled: { addListener: (fn) => { on.installed = fn; } } },
  storage: {
    /* Answers a tick later, as the browser does: two saves that both read the
       list before either wrote it is the very thing the queue is there for. */
    local: {
      get: (key, answer) => { const held = { [key]: store[key] }; setImmediate(() => answer(held)); },
      set: (items, answer) => setImmediate(() => {
        if (store.refuse) chrome.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
        else Object.assign(store, JSON.parse(JSON.stringify(items)));
        answer?.();
        delete chrome.runtime.lastError;
      }),
      remove: (key, answer) => setImmediate(() => { delete store[key]; answer?.(); })
    },
    onChanged: { addListener: (fn) => { on.stored = fn; } }
  },
  contextMenus: { create: (item) => done.menus.push(item), onClicked: { addListener: (fn) => { on.clicked = fn; } } },
  omnibox: {
    onInputChanged: { addListener: (fn) => { on.changed = fn; } },
    onInputEntered: { addListener: (fn) => { on.entered = fn; } },
    setDefaultSuggestion: (suggestion) => done.defaults.push(suggestion.description)
  },
  tabs: {
    update: (tab, details) => (details ? done.sent.push([tab, details.url]) : done.opened.push(tab.url)),
    create: (details) => done.created.push(details),
    onUpdated: { addListener: (fn) => { on.updated = fn; on.listening = true; }, removeListener: () => { on.listening = false; } }
  },
  search: { query: (details) => { done.searched.push(details); return Promise.resolve(); } }
};
// One holder of a name at a time, in the order asked, as navigator.locks gives it.
const held = new Map();
Object.defineProperty(globalThis.navigator, 'locks', { configurable: true, value: {
  request(name, work) {
    const mine = (held.get(name) || Promise.resolve()).then(() => work());
    held.set(name, mine.catch(() => {}));
    return mine;
  }
} });
globalThis.chrome.action = { setBadgeText: (details) => done.badges.push(details.text) };
globalThis.NordlysCommands = require('../../src/js/commands.js');
require('../../src/js/search-sources.js');
require('../../src/js/inbox.js');
require('../../src/js/worker.js');

store.nordlys_config = {
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

/* The two clicks are not waited for one by one: each used to read the list and
   write it back, and two at once kept one page. */
test('"Save to Nordlys" puts the page or the link in the inbox, and nothing else; two at once are both kept', async () => {
  on.installed();
  assert.deepEqual(done.menus.map((item) => [item.id, item.contexts[0]]), [['nordlys-save-page', 'page'], ['nordlys-save-link', 'link']]);
  await Promise.all([
    on.clicked({ menuItemId: 'nordlys-save-page', pageUrl: 'https://read.example/essay' }, { title: 'An essay' }),
    on.clicked({ menuItemId: 'nordlys-save-link', pageUrl: 'https://read.example/essay', linkUrl: 'https://cited.example/', selectionText: 'a source' }),
    on.clicked({ menuItemId: 'nordlys-save-page', pageUrl: 'chrome://settings/' }, { title: 'Settings' })
  ]);
  assert.equal(new Set(store.nordlys_inbox.map((item) => item.id)).size, 2, 'each waits under an id of its own');
  assert.deepEqual(store.nordlys_inbox.map(({ url, name, folder }) => ({ url, name, folder })), [
    { url: 'https://read.example/essay', name: 'An essay', folder: null },
    { url: 'https://cited.example/', name: 'a source', folder: null }
  ]);
  assert.equal(store.nordlys_config.groups.length, 1, "the board itself is the page's to write");
  assert.deepEqual(done.badges, []);
});

test('a save the browser refuses is said on the toolbar button, and the pages already waiting stay', async () => {
  store.refuse = true;
  await on.clicked({ menuItemId: 'nordlys-save-page', pageUrl: 'https://lost.example/' }, { id: 7, title: 'Not kept' });
  store.refuse = false;
  assert.deepEqual(done.badges, ['!']);
  assert.deepEqual(store.nordlys_inbox.map((item) => item.url), ['https://read.example/essay', 'https://cited.example/']);
});

test('a new tab takes the pages only once its board is saved, and leaves the ones it did not take', async () => {
  const before = store.nordlys_inbox.map((item) => item.id);
  // The board could not be saved: nothing is taken.
  await globalThis.NordlysInbox.take(async () => null);
  assert.deepEqual(store.nordlys_inbox.map((item) => item.id), before);
  // One page is on a saved board: that one leaves, the other waits.
  await globalThis.NordlysInbox.take(async (items) => new Set([items[0].id]));
  assert.deepEqual(store.nordlys_inbox.map((item) => item.id), [before[1]]);
  await globalThis.NordlysInbox.take(async (items) => new Set(items.map((item) => item.id)));
  assert.equal(store.nordlys_inbox, undefined);
});

test('pages that waited without an id, from before 2.6.4, are given one and kept in order', async () => {
  store.nordlys_inbox = [{ url: 'https://old.example/1', name: 'One', folder: null }, { url: 'https://old.example/2', name: 'Two', folder: null }];
  let seen = [];
  await globalThis.NordlysInbox.take(async (items) => { seen = items; return null; });
  assert.deepEqual(seen.map((item) => item.url), ['https://old.example/1', 'https://old.example/2']);
  assert.equal(new Set(seen.map((item) => item.id)).size, 2);
  delete store.nordlys_inbox;
});

test('while a focus runs, a tab that goes to a site the timer card lists waits on the quiet page', async () => {
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  assert.equal(on.listening, false, 'with no focus over a list, tabs never wake the worker');
  store.nordlys_config = { ...store.nordlys_config, dashboard: { widgets: [{ id: 'w1', type: 'timer', settings: { shut: 'youtube.com\nhttps://www.Reddit.com/r/all, news.test' } }, { id: 'w2', type: 'notes', settings: { shut: 'notes.test' } }] } };
  const visit = async (url) => { done.sent.length = 0; await on.updated(7, { url }); return done.sent.map(([tab, to]) => [tab, decodeURIComponent(to.split('?u=')[1] || '')]); };
  store['nordlys_dash.focus-timer'] = { running: true, phase: 'focus', endsAt: Date.now() + 60000 };
  // A write it does not read is not a reason to read the config again.
  on.stored({ nordlys_sync: {} }, 'local');
  on.stored({ 'nordlys_dash.focus-timer': {} }, 'sync');
  await settle();
  assert.equal(on.listening, false);
  on.stored({ 'nordlys_dash.focus-timer': {} }, 'local');
  await settle();
  assert.equal(on.listening, true);
  assert.deepEqual(await visit('https://m.youtube.com/watch?v=1'), [[7, 'https://m.youtube.com/watch?v=1']]);
  assert.deepEqual(await visit('https://reddit.com/'), [[7, 'https://reddit.com/']]);
  assert.deepEqual(await visit('https://notyoutube.com/'), [], 'only the site and its own subdomains');
  assert.deepEqual(await visit('https://notes.test/'), [], 'only what a timer card lists');
  assert.equal(done.sent.length, 0);
  store['nordlys_dash.focus-timer'] = { running: true, phase: 'rest', endsAt: Date.now() + 60000 };
  assert.deepEqual(await visit('https://youtube.com/'), [], 'a break keeps nothing shut');
  store['nordlys_dash.focus-timer'] = { running: true, phase: 'focus', endsAt: Date.now() - 1 };
  assert.deepEqual(await visit('https://youtube.com/'), [], 'nor a focus whose time is up');
  store['nordlys_dash.focus-timer'] = { running: false, phase: 'focus', endsAt: Date.now() + 60000 };
  assert.deepEqual(await visit('https://youtube.com/'), [], 'nor a paused one');
  on.stored({ 'nordlys_dash.focus-timer': {} }, 'local');
  await settle();
  assert.equal(on.listening, false);
});
