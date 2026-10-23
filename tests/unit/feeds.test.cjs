const { test } = require('node:test');
const assert = require('node:assert/strict');
const feeds = require('../../src/js/feeds.js');

/* What the Feeds and Value cards read (feeds.js): RSS and Atom as the big
   sites send them, a site's own feed found in its page, and one value out
   of a JSON answer. */

const HN = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Hacker News</title><link>https://news.ycombinator.com/</link>
<item><title>Show HN: A sky that moves &amp; a clock</title><link>https://example.com/sky</link><pubDate>Thu, 22 Oct 2026 09:00:00 +0000</pubDate><comments>https://news.ycombinator.com/item?id=1</comments></item>
<item><title><![CDATA[Tom & Jerry <b>in</b> HTML]]></title><link>https://example.com/tj</link><pubDate>Thu, 22 Oct 2026 11:30:00 GMT</pubDate></item>
</channel></rss>`;

const YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<link rel="self" href="https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv"/><title>Aurora Channel</title>
<entry><id>yt:video:abc</id><title>Northern lights, live</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc"/><published>2026-10-21T18:00:00+00:00</published>
<media:group><media:title>Something else</media:title></media:group></entry></feed>`;

const RELATIVE = `<feed xmlns="http://www.w3.org/2005/Atom"><title type="html">A &lt;em&gt;quiet&lt;/em&gt; blog</title>
<entry><title>First</title><link href="/posts/first"/><updated>2026-10-01T00:00:00Z</updated></entry>
<entry><title>Dangerous</title><link href="javascript:alert(1)"/></entry>
<entry><title></title><link href="/posts/empty"/></entry></feed>`;

test('RSS reads its name, titles, pages and times, entities and CDATA included', () => {
  const feed = feeds.parse(HN, 'https://news.ycombinator.com/rss');
  assert.equal(feed.title, 'Hacker News');
  assert.deepEqual(feed.items.map((it) => [it.title, it.url, new Date(it.at).toISOString()]), [
    ['Show HN: A sky that moves & a clock', 'https://example.com/sky', '2026-10-22T09:00:00.000Z'],
    ['Tom & Jerry in HTML', 'https://example.com/tj', '2026-10-22T11:30:00.000Z']
  ]);
});

test('Atom takes the alternate link, its own title over a media title, and resolves a page against the feed', () => {
  const yt = feeds.parse(YOUTUBE, 'https://www.youtube.com/feeds/videos.xml?channel_id=x');
  assert.equal(yt.title, 'Aurora Channel');
  assert.deepEqual(yt.items, [{ id: 'yt:video:abc', title: 'Northern lights, live', url: 'https://www.youtube.com/watch?v=abc', at: Date.parse('2026-10-21T18:00:00Z') }]);
  const blog = feeds.parse(RELATIVE, 'https://blog.example/feed.xml');
  assert.equal(blog.title, 'A quiet blog', 'markup a feed escaped into a title is dropped');
  assert.deepEqual(blog.items.map((it) => it.url), ['https://blog.example/posts/first'], 'no script address, no item without a title');
});

test('a web page is not a feed, but it can say where its feed is', () => {
  const page = '<!doctype html><html><head><link rel="stylesheet" href="/a.css"><link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml"><link type="application/atom+xml" rel="alternate home" href="https://feeds.example/atom"></head></html>';
  assert.equal(feeds.parse(page), null);
  assert.deepEqual(feeds.discover(page, 'https://site.example/blog/'), ['https://site.example/feed.xml', 'https://feeds.example/atom']);
});

test('the short ways to name a feed', () => {
  assert.equal(feeds.address('hn'), 'https://news.ycombinator.com/rss');
  assert.equal(feeds.address('r/aurora'), 'https://www.reddit.com/r/aurora/.rss');
  assert.equal(feeds.address('https://old.reddit.com/r/space/'), 'https://www.reddit.com/r/space/.rss');
  assert.equal(feeds.address('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'), 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv');
  assert.equal(feeds.address('youtube.com/playlist?list=PL123'), 'https://www.youtube.com/feeds/videos.xml?playlist_id=PL123');
  assert.equal(feeds.address('blog.example/feed'), 'https://blog.example/feed');
  assert.equal(feeds.address('https://www.reddit.com/r/space/comments/1/x/'), 'https://www.reddit.com/r/space/comments/1/x/', 'a post is not its subreddit');
  for (const bad of ['', 'ftp://files.example/feed', 'javascript:alert(1)', 'file:///etc/passwd']) assert.equal(feeds.address(bad), null, bad);
});

test('several feeds read as one list, newest first, each page once', () => {
  const a = [{ url: 'https://x/1', at: 1 }, { url: 'https://x/3', at: 3 }];
  const b = [{ url: 'https://x/2', at: 2 }, { url: 'https://x/3', at: 3 }];
  assert.deepEqual(feeds.merge([a, b]).map((it) => it.url), ['https://x/3', 'https://x/2', 'https://x/1']);
  assert.equal(feeds.merge([a, b], 2).length, 2);
});

test('one value out of JSON, by a path as people write it', () => {
  const answer = { data: { items: [{ price: '67012.50' }, { price: 3 }] }, ok: true, name: 'BTC' };
  assert.equal(feeds.pick(answer, 'data.items[0].price'), '67012.50');
  assert.equal(feeds.pick(answer, 'data.items.1.price'), 3);
  assert.equal(feeds.pick(answer, '$.name'), 'BTC');
  assert.equal(feeds.pick(answer, ''), answer, 'no path is the whole answer');
  assert.equal(feeds.pick(answer, 'data.nothing.here'), undefined);
  assert.equal(feeds.pick(answer, 'name.constructor'), undefined, 'only its own fields');
  assert.equal(feeds.pick(answer, '__proto__'), undefined);
  assert.equal(feeds.numberOf('67012.50'), 67012.5);
  assert.equal(feeds.numberOf('12 apples'), null);
  assert.equal(feeds.show('67012.50', 'en'), '67,012.5');
  assert.equal(feeds.show(0.123456, 'de'), '0,123');
  assert.equal(feeds.show(true), 'true');
  assert.equal(feeds.show({ a: 1 }), '{"a":1}');
  assert.equal(feeds.show(undefined), null);
});
