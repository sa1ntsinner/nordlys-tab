const { test } = require('node:test');
const assert = require('node:assert');
const NordlysProfiles = require('../../src/js/profiles.js');

/* The two stores the page has: localStorage for the small list read at first
   paint, chrome.storage.local for the boards, which can be large. */
function stores() {
  const meta = new Map();
  const local = new Map();
  return {
    meta: { getItem: k => meta.has(k) ? meta.get(k) : null, setItem: (k, v) => meta.set(k, String(v)), removeItem: k => meta.delete(k) },
    local: {
      get: async key => ({ [key]: local.has(key) ? JSON.parse(local.get(key)) : undefined }),
      set: async items => { for (const [k, v] of Object.entries(items)) local.set(k, JSON.stringify(v)); },
      remove: async key => { local.delete(key); }
    },
    raw: local
  };
}
const config = (theme, labels, extra = {}) => ({ theme, language: 'en', userName: 'Elmir', ...extra, groups: labels.map(label => ({ id: `g-${label}`, label, links: [{ id: `l-${label}`, name: label, url: 'https://x.example/' }] })) });

test('the first open makes one profile out of the board there is, and writes nothing until it matters', async () => {
  const s = stores();
  const profiles = new NordlysProfiles(s);
  profiles.init('Main');
  assert.strictEqual(profiles.list().length, 1);
  assert.strictEqual(profiles.list()[0].name, 'Main');
  assert.strictEqual(profiles.active().id, profiles.list()[0].id);
  assert.strictEqual(s.meta.getItem('nordlys_profiles'), null, 'a page that did nothing wrote nothing');
  // Once something happens, it is kept.
  profiles.rename(profiles.active().id, 'Work');
  const again = new NordlysProfiles(s); again.init('Other');
  assert.deepStrictEqual(again.list(), profiles.list());
});

test('switching keeps each board and carries the person fields across', async () => {
  const profiles = new NordlysProfiles(stores());
  profiles.init('Work');
  const work = config('aurora-void', ['Daily']);
  const homeId = await profiles.create({ name: 'Home', color: 'amber', from: 'empty', live: work, defaults: { theme: 'nord-frost', groups: [] } });
  const home = await profiles.switchTo(homeId, work);
  assert.strictEqual(home.theme, 'nord-frost');
  assert.deepStrictEqual(home.groups, []);
  assert.strictEqual(home.userName, 'Elmir', 'the name in the greeting is the same person');
  home.theme = 'silk-night';
  home.language = 'ru';
  const back = await profiles.switchTo(profiles.list()[0].id, home);
  assert.deepStrictEqual(back.groups.map(g => g.label), ['Daily']);
  assert.strictEqual(back.theme, 'aurora-void');
  assert.strictEqual(back.language, 'ru', 'language follows the person, not the profile');
  const homeAgain = await profiles.configOf(homeId, back);
  assert.strictEqual(homeAgain.theme, 'silk-night');
});

test('a copied profile gets its own folder and bookmark ids', async () => {
  const profiles = new NordlysProfiles(stores());
  profiles.init('Work');
  const work = config('aurora-void', ['Daily', 'Code']);
  const copyId = await profiles.create({ name: 'Copy', color: 'violet', from: 'copy', live: work, defaults: { groups: [] } });
  const copy = await profiles.configOf(copyId, work);
  assert.deepStrictEqual(copy.groups.map(g => g.label), ['Daily', 'Code']);
  const ids = new Set(work.groups.flatMap(g => [g.id, ...g.links.map(l => l.id)]));
  assert.ok(copy.groups.every(g => !ids.has(g.id) && g.links.every(l => !ids.has(l.id))), 'no id is shared between profiles');
});

test('the last profile and the one in use cannot be deleted; a deleted one can come back', async () => {
  const profiles = new NordlysProfiles(stores());
  profiles.init('Work');
  const work = config('aurora-void', ['Daily']);
  await assert.rejects(profiles.remove(profiles.active().id, work), /last|in use/i);
  const homeId = await profiles.create({ name: 'Home', color: 'amber', from: 'copy', live: work, defaults: { groups: [] } });
  await assert.rejects(profiles.remove(profiles.active().id, work), /in use/i);
  await profiles.remove(homeId, work);
  assert.deepStrictEqual(profiles.list().map(p => p.name), ['Work']);
  assert.deepStrictEqual(profiles.deleted().map(p => p.name), ['Home']);
  await profiles.restore(homeId);
  assert.deepStrictEqual(profiles.list().map(p => p.name), ['Work', 'Home']);
  assert.deepStrictEqual((await profiles.configOf(homeId, work)).groups.map(g => g.label), ['Daily']);
});

test('rename, colour and order are kept', async () => {
  const s = stores();
  const profiles = new NordlysProfiles(s);
  profiles.init('Work');
  const live = config('aurora-void', []);
  const a = await profiles.create({ name: 'Home', from: 'empty', live, defaults: { groups: [] } });
  const b = await profiles.create({ name: 'Study', from: 'empty', live, defaults: { groups: [] } });
  profiles.rename(a, '  Дом  ');
  profiles.recolor(b, 'rose');
  profiles.move(b, 0);
  const reopened = new NordlysProfiles(s); reopened.init('x');
  assert.deepStrictEqual(reopened.list().map(p => [p.name, p.color]), [['Study', 'rose'], ['Work', reopened.list()[1].color], ['Дом', reopened.list()[2].color]]);
  assert.throws(() => profiles.rename(a, '   '), /name/i);
});

test('a snapshot of every profile, and adopting one from another device', async () => {
  const profiles = new NordlysProfiles(stores());
  profiles.init('Work');
  const work = config('aurora-void', ['Daily']);
  const homeId = await profiles.create({ name: 'Home', from: 'empty', live: work, defaults: { theme: 'nord-frost', groups: [] } });
  const snap = await profiles.snapshot(work);
  assert.deepStrictEqual(snap.person, { language: 'en', userName: 'Elmir' });
  assert.deepStrictEqual(snap.profiles.map(p => [p.name, p.config.theme]), [['Work', 'aurora-void'], ['Home', 'nord-frost']]);
  assert.ok(!('userName' in snap.profiles[0].config), 'person fields are not part of a profile');

  // Another device renamed Home, added Study, and deleted Work, which is in use here.
  const remote = {
    person: { language: 'de', userName: 'Elmir' },
    profiles: [
      { id: homeId, name: 'Zuhause', color: 'amber', config: { theme: 'nord-frost', groups: [] } },
      { id: 'study', name: 'Study', color: 'rose', config: { theme: 'tokyo-night', groups: [] } }
    ]
  };
  const { live, switched } = await profiles.adopt(remote, work);
  assert.strictEqual(switched, true, 'the profile in use here was deleted elsewhere');
  assert.deepStrictEqual(profiles.list().map(p => p.name), ['Zuhause', 'Study']);
  assert.strictEqual(profiles.active().id, homeId);
  assert.strictEqual(live.theme, 'nord-frost');
  assert.strictEqual(live.language, 'de');
});
