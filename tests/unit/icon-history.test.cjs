const test = require('node:test');
const assert = require('node:assert/strict');
const history = require('../../src/js/icon-history.js');

const THUMB = 'data:image/webp;base64,UklGRg==';

test('an address used goes to the front and marks the current icon', () => {
  const link = { name: 'GitHub', url: 'https://github.com/' };
  history.remember(link, 'https://a.test/one.png', THUMB, 1);
  history.remember(link, 'https://a.test/two.png', THUMB, 2);
  history.remember(link, 'https://a.test/one.png', THUMB, 3);
  assert.deepEqual(link.iconUrls.map(e => e.url), ['https://a.test/one.png', 'https://a.test/two.png']);
  assert.equal(link.iconUrl, 'https://a.test/one.png');
  assert.equal(link.iconUrls[0].at, 3);
});

test('the list keeps the last few, and only real web addresses', () => {
  const link = {};
  for (let i = 0; i < 10; i++) history.remember(link, `https://a.test/${i}.png`, THUMB, i);
  assert.equal(link.iconUrls.length, history.LIMIT);
  assert.equal(link.iconUrls[0].url, 'https://a.test/9.png');
  assert.equal(history.remember(link, 'javascript:alert(1)', THUMB), false);
  assert.equal(history.remember(link, 'data:image/png;base64,AA', THUMB), false);
  const dirty = history.clean([{ url: 'https://ok.test/a.png', thumb: 'data:text/html,<b>' }, { url: 'ftp://x' }, null, { url: 'https://ok.test/a.png' }]);
  assert.deepEqual(dirty, [{ url: 'https://ok.test/a.png', thumb: '', at: 0 }]);
});

test('an edited address replaces the old one', () => {
  const link = {};
  history.remember(link, 'https://a.test/old.png', THUMB, 1);
  history.remember(link, 'https://a.test/other.png', THUMB, 2);
  history.replace(link, 'https://a.test/old.png', 'https://a.test/new.png', THUMB, 3);
  assert.deepEqual(link.iconUrls.map(e => e.url), ['https://a.test/new.png', 'https://a.test/other.png']);
  assert.equal(link.iconUrl, 'https://a.test/new.png');
});

test('removing an address can be undone, and takes the current marker with it', () => {
  const link = {};
  history.remember(link, 'https://a.test/a.png', THUMB, 1);
  history.remember(link, 'https://a.test/b.png', THUMB, 2);
  const removed = history.forget(link, 'https://a.test/b.png');
  assert.equal(link.iconUrl, undefined, 'the current icon no longer claims an address that is gone');
  assert.deepEqual(link.iconUrls.map(e => e.url), ['https://a.test/a.png']);
  history.restore(link, removed);
  assert.deepEqual(link.iconUrls.map(e => e.url), ['https://a.test/b.png', 'https://a.test/a.png']);
  assert.equal(link.iconUrl, 'https://a.test/b.png');
  const last = {};
  history.remember(last, 'https://a.test/only.png', THUMB);
  history.forget(last, 'https://a.test/only.png');
  assert.equal('iconUrls' in last, false, 'an empty list is not stored');
});

test('another kind of icon keeps the addresses but not the marker', () => {
  const link = {};
  history.remember(link, 'https://a.test/a.png', THUMB);
  history.leave(link);
  assert.equal(link.iconUrl, undefined);
  assert.equal(link.iconUrls.length, 1);
  assert.equal(history.hostOf('https://www.cdn.example.com/x.png'), 'cdn.example.com');
});
