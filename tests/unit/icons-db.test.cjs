const { test } = require('node:test');
const assert = require('node:assert/strict');

const { resolveIcon, ICONS_DB } = require('../../src/js/icons-db.js');

const keyOf = (def) => def && Object.keys(ICONS_DB).find(key => ICONS_DB[key] === def);
const iconFor = (url) => keyOf(resolveIcon(url));

/* The map is a list of domain prefixes. It used to be walked in insertion
   order with host.includes(prefix), so "google." — first in the list — claimed
   mail.google.com, drive.google.com and gemini.google.com before their own
   entries were reached, and "github." matched github.example.org. */
test('the most specific domain wins over a shorter one', () => {
  assert.equal(iconFor('https://mail.google.com/mail/u/0/'), 'gmail');
  assert.equal(iconFor('https://drive.google.com/drive/my-drive'), 'googledrive');
  assert.equal(iconFor('https://docs.google.com/document/d/x'), 'googledrive');
  assert.equal(iconFor('https://gemini.google.com/app'), 'gemini');
  assert.equal(iconFor('https://www.google.com/'), 'google');
  assert.equal(iconFor('https://google.co.uk/search?q=x'), 'google');
});

test('a brand name inside somebody else\'s domain is not that brand', () => {
  assert.equal(iconFor('https://github.example.org/'), null);
  assert.equal(iconFor('https://notgithub.com/'), null);
  assert.equal(iconFor('https://youtube.fake.test/'), null);
});

test('subdomains of a brand still belong to it', () => {
  assert.equal(iconFor('https://gist.github.com/x'), 'github');
  assert.equal(iconFor('https://store.steampowered.com/app/1'), 'steam');
  assert.equal(iconFor('https://console.anthropic.com/'), 'claude');
  assert.equal(iconFor('https://old.reddit.com/r/startpages'), 'reddit');
});

test('exact-domain entries match themselves and their subdomains only', () => {
  assert.equal(iconFor('https://x.com/nordlys'), 'twitter');
  assert.equal(iconFor('https://t.me/somebody'), 'telegram');
  assert.equal(iconFor('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(iconFor('https://en.wikipedia.org/wiki/Aurora'), 'wikipedia');
  assert.equal(iconFor('https://notx.com/'), null);
});

test('an explicit icon key always wins over the address', () => {
  assert.equal(keyOf(resolveIcon('https://github.com', 'youtube')), 'youtube');
});

test('addresses that are not URLs resolve to nothing, quietly', () => {
  assert.equal(resolveIcon('not a url'), null);
  assert.equal(resolveIcon(''), null);
  assert.equal(resolveIcon(undefined), null);
});

/* Software every institution hosts under its own domain: the brand is the first
   label, whatever follows. moodle.tu-dortmund.de is Moodle. */
test('a leading-label entry matches the first label under any domain', () => {
  assert.equal(iconFor('https://moodle.tu-dortmund.de/my/'), 'school');
  assert.equal(iconFor('https://moodle.example.ac.uk/'), 'school');
  assert.equal(iconFor('https://boss.tu-dortmund.de/'), 'school');
  assert.equal(iconFor('https://notmoodle.com/'), null);
  assert.equal(iconFor('https://example.com/moodle'), null);
});
