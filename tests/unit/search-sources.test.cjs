const { test } = require('node:test');
const assert = require('node:assert/strict');
globalThis.NordlysCommands = require('../../src/js/commands.js');
const sources = require('../../src/js/search-sources.js');

/* Where the search box looks (search-sources.js): the board, ranked the way
   the commands are, and the browser's own lists, read only with its leave. */

const GROUPS = [
  { label: 'Work', links: [{ name: 'Jira', url: 'https://acme.atlassian.net' }, { name: 'Pull requests', url: 'https://github.com/pulls' }] },
  { label: 'Git', links: [{ name: 'Docs', url: 'https://docs.example.com' }] },
  { label: 'Code', links: [{ name: 'GitHub', url: 'https://github.com' }, { name: 'GitLab', url: 'https://www.gitlab.com' }] }
];

// A browser with the given leave and lists, for one test.
function browser({ granted = [], tabs = [], marks = [], pages = [] } = {}) {
  for (const source of sources.SOURCES) sources.forget(source);
  globalThis.chrome = {
    permissions: { contains: (request, done) => done(request.permissions.every((name) => granted.includes(name))) },
    tabs: { query: (query, done) => done(tabs) },
    bookmarks: {
      search: (text, done) => done(marks.filter((mark) => mark.url && `${mark.title} ${mark.url}`.toLowerCase().includes(text.toLowerCase()))),
      get: (ids, done) => done(marks.filter((mark) => ids.includes(mark.id)))
    },
    history: { search: (query, done) => done(pages) }
  };
}

test('the board answers by name first, then address, then folder', () => {
  const names = (query) => sources.board(GROUPS, query).map((link) => link.name);
  assert.deepEqual(names('git'), ['GitHub', 'GitLab', 'Pull requests', 'Docs'], 'name, then github.com, then the folder "Git"');
  assert.deepEqual(names('gitlab'), ['GitLab']);
  assert.deepEqual(names('jira'), ['Jira']);
  assert.equal(sources.board(GROUPS, 'jira')[0].groupLabel, 'Work');
  assert.deepEqual(names('nothing like it'), []);
  assert.deepEqual(names('  '), []);
  assert.equal(sources.board(GROUPS, 'git', 2).length, 2);
});

test('a keyword alone opens its site, and with words puts them where %s is', () => {
  const golinks = [{ key: 'gh', url: 'https://github.com/search?q=%s&type=repositories' }, { key: 'Mail', url: 'https://mail.example.com/inbox' }, { key: 'bad', url: 'javascript:alert(1)' }];
  assert.deepEqual(sources.keyword(golinks, 'gh nordlys tab'), { key: 'gh', url: 'https://github.com/search?q=nordlys%20tab&type=repositories', words: 'nordlys tab' });
  assert.equal(sources.keyword(golinks, 'GH').url, 'https://github.com/', 'alone, the site itself');
  assert.equal(sources.keyword(golinks, 'mail').url, 'https://mail.example.com/inbox');
  assert.equal(sources.keyword(golinks, 'mail is down'), null, 'no %s, so words after it are a search');
  assert.equal(sources.keyword(golinks, 'ghost'), null);
  assert.equal(sources.keyword(golinks, 'bad'), null, 'only web addresses');
  assert.equal(sources.keyword(golinks, 'gh a&b=c').url, 'https://github.com/search?q=a%26b%3Dc&type=repositories');
  assert.equal(sources.keyword([{ key: 'x' }, null], 'x'), null);
  assert.equal(sources.keyword(undefined, 'gh'), null);
  assert.ok(sources.KEYWORD.test('w.en') && sources.KEYWORD.test('вики') && !sources.KEYWORD.test('two words') && !sources.KEYWORD.test('+x'));
});

test('equal answers keep the order they came in', () => {
  const items = [{ name: 'Alpha one' }, { name: 'Beta one' }, { name: 'Gamma one' }];
  assert.deepEqual(sources.rank('one', items, [[(item) => item.name, 1]], 5).map((item) => item.name), ['Alpha one', 'Beta one', 'Gamma one']);
});

test('an address is shown by its host', () => {
  assert.equal(sources.hostOf('https://www.gitlab.com/explore'), 'gitlab.com');
  assert.equal(sources.hostOf('not a url'), '');
});

test('nothing is read from the browser without its leave', async () => {
  browser({ tabs: [{ id: 1, title: 'GitHub', url: 'https://github.com' }] });
  assert.deepEqual(await sources.tabs('git'), []);
  browser({ granted: ['tabs'], tabs: [{ id: 1, title: 'GitHub', url: 'https://github.com' }] });
  assert.equal((await sources.tabs('git')).length, 1);
});

test('open tabs leave out this page and what is already shown', async () => {
  browser({
    granted: ['tabs'],
    tabs: [
      { id: 1, windowId: 9, title: 'Nordlys', url: 'chrome-extension://abc/newtab.html' },
      { id: 2, windowId: 9, title: 'GitHub', url: 'https://github.com' },
      { id: 3, windowId: 9, title: 'The git book', url: 'https://git-scm.com/book' }
    ]
  });
  assert.deepEqual(await sources.tabs('git', { self: 'chrome-extension://abc' }), [
    { id: 2, windowId: 9, name: 'GitHub', url: 'https://github.com' },
    { id: 3, windowId: 9, name: 'The git book', url: 'https://git-scm.com/book' }
  ]);
  assert.deepEqual((await sources.tabs('git', { exclude: new Set(['https://github.com']) })).map((tab) => tab.id), [3]);
});

test('a browser bookmark comes with the folder it is in', async () => {
  browser({
    granted: ['bookmarks'],
    marks: [
      { id: '10', title: 'Reading' },
      { id: '11', parentId: '10', title: 'Gitea', url: 'https://gitea.io' },
      { id: '12', parentId: '10', title: 'GitHub', url: 'https://github.com' }
    ]
  });
  assert.deepEqual(await sources.bookmarks('git', { exclude: new Set(['https://github.com']) }), [{ name: 'Gitea', url: 'https://gitea.io', folder: 'Reading' }]);
});

test('history gives web pages, the most visited first', async () => {
  browser({
    granted: ['history'],
    pages: [
      { title: 'Git tips', url: 'https://example.com/git', visitCount: 2 },
      { title: 'Git basics', url: 'https://example.com/basics', visitCount: 9 },
      { title: 'Git settings', url: 'chrome://settings/git', visitCount: 50 },
      { title: 'Git on the board', url: 'https://board.example', visitCount: 99 }
    ]
  });
  assert.deepEqual((await sources.history('git', { exclude: new Set(['https://board.example']) })).map((page) => page.name), ['Git basics', 'Git tips']);
});

test('what is usually opened around this hour, about three times lately, while it is on the board', () => {
  const at = (day, hour) => new Date(2026, 9, day, hour, 10).getTime();
  let rhythm = null;
  for (const day of [1, 2, 3]) rhythm = sources.noteOpen(rhythm, 'https://acme.atlassian.net', at(day, 9));
  rhythm = sources.noteOpen(rhythm, 'https://github.com', at(3, 8));
  rhythm = sources.noteOpen(rhythm, 'https://github.com', at(3, 10));
  for (const day of [1, 2, 3, 4]) rhythm = sources.noteOpen(rhythm, 'https://docs.example.com', at(day, 21));
  rhythm = sources.noteOpen(rhythm, 'https://gone.example', at(3, 9));
  rhythm.urls['https://gone.example'][9] = 9;
  assert.deepEqual(sources.usual(GROUPS, rhythm, at(5, 9)).map((link) => [link.name, link.groupLabel]), [['Jira', 'Work']], 'an open an hour off counts half');
  assert.deepEqual(sources.usual(GROUPS, rhythm, at(5, 21)).map((link) => link.name), ['Docs']);
  assert.deepEqual(sources.usual(GROUPS, rhythm, at(5, 15)), []);
  const later = sources.noteOpen(structuredClone(rhythm), 'https://github.com', at(5, 12) + 60 * 864e5);
  assert.deepEqual(Object.keys(later.urls), ['https://github.com'], 'a habit given up two months ago is forgotten');
});
