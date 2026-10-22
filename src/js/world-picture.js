/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE PICTURE OF THE DAY
   ═══════════════════════════════════════════════════════════════════

   Four places with a picture for every day, none wanting an account or a key:

     wikimedia   Wikimedia Commons' picture of the day
     paintings   a painting from Commons' featured pictures, in the public domain
     met         a painting from the Met's highlights, in the public domain
     epic        the Earth as NASA's EPIC camera saw it, a million miles out

   Each is asked once a day for where the picture is and whose it is. The
   picture itself is an ordinary image the browser loads and keeps for the
   day. Wikimedia's servers let the page read a picture's pixels (CORS), so
   its pictures are measured for the text over them; the others come with a
   shade the page puts behind its words. A painting is shown whole, framed in
   a blur of itself, never cropped to fill the screen; a photograph that is
   wide enough fills it.

   Nothing is asked until one of these is the sky on screen. What is asked is
   the date and the language, and for the collections a number that turns
   the date into a picture. */
(function (root) {
  "use strict";

  const KEY = "nordlys_world_picture";
  const DAY = 86400000;
  // The day where the person is, as a number: the same picture all day in every tab.
  const dayOf = (date) => Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / DAY);
  const pad = (n) => String(n).padStart(2, "0");
  const plain = (text, limit = 140) => {
    const value = String(text || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
  };
  // A caption is often a paragraph; its first sentence names the picture.
  const firstSentence = (text) => String(text || "").split(/(?<=[.!?])\s+(?=\p{Lu})/u)[0];
  /* The words of a piece of Commons markup that a reader sees: not the hidden
     data, the edit icons or the other languages. A document from DOMParser
     runs nothing and loads nothing; only its text is read. */
  function visibleText(html, lang, limit, prefer) {
    if (typeof DOMParser !== "function") return plain(html, limit);
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
    doc.querySelectorAll("[style*='display:none'], [style*='display: none'], .noprint, img").forEach((node) => node.remove());
    const versions = [...doc.querySelectorAll("[lang]")];
    const pick = (prefer && doc.querySelector(prefer)) || versions.find((node) => node.lang === lang) || versions.find((node) => node.lang === "en");
    return plain((pick || doc.body).textContent, limit);
  }

  async function getJSON(url) {
    const control = typeof AbortController === "function" ? new AbortController() : null;
    const timer = control ? setTimeout(() => control.abort(), 12000) : null;
    try {
      const answer = await fetch(url, control ? { signal: control.signal } : undefined);
      if (!answer.ok) throw new Error(`HTTP ${answer.status}`);
      return await answer.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Only an https address may become a background or a link.
  const safe = (url) => {
    try { return new URL(url).protocol === "https:" ? new URL(url).href : null; } catch (error) { return null; }
  };

  /* Each source answers for a date with { url, title, by, link, fit, cors }:
     fit is "fill" (cover the page), "frame" (the whole picture, framed) or
     "dark" (on black, as the Earth is). */
  const SOURCES = {
    wikimedia: {
      async ask(date, lang) {
        // The picture of the day is a photograph most days, a video or a diagram on some: then the day before's.
        for (const back of [0, 1, 2]) {
          const day = new Date(date.getTime() - back * DAY);
          const answer = await getJSON(`https://api.wikimedia.org/feed/v1/wikipedia/${lang}/featured/${day.getFullYear()}/${pad(day.getMonth() + 1)}/${pad(day.getDate())}`);
          const image = answer?.image;
          const original = image?.image;
          if (!original?.source || !/\.(jpe?g|png|webp)(\?|$)/i.test(original.source)) continue;
          // A standard size of Wikimedia's thumbnails, wide enough for a screen; the original if it is smaller.
          const thumb = image.thumbnail?.source && original.width > 1920
            ? image.thumbnail.source.replace(/\?.*$/, "").replace(/\/\d+px-([^/]+)$/, "/1920px-$1") : original.source.replace(/\?.*$/, "");
          const url = safe(thumb);
          if (!url) continue;
          const wide = original.width / Math.max(1, original.height) >= 1.2;
          return {
            url, cors: true, fit: wide ? "fill" : "frame",
            title: plain(firstSentence(plain(image.description?.text, 400)) || image.title?.replace(/^File:/, "").replace(/\.\w+$/, "")),
            by: plain([image.artist?.text, image.license?.type].filter(Boolean).join(" · "), 90),
            link: safe(image.file_page) || "https://commons.wikimedia.org/wiki/Commons:Picture_of_the_day"
          };
        }
        return null;
      }
    },

    paintings: {
      async ask(date, lang) {
        // Commons' featured pictures that are a reproduction of a work of art (P6243): paintings, almost all of them.
        const search = encodeURIComponent("incategory:Featured_pictures_on_Wikimedia_Commons haswbstatement:P6243");
        const api = (offset) => "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6"
          + `&gsrsearch=${search}&gsrlimit=1&gsroffset=${offset}&gsrinfo=totalhits&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata`
          + "&iiurlwidth=1920&iiurlheight=1440&iiextmetadatafilter=ObjectName%7CArtist%7CDateTimeOriginal";
        const total = (await getJSON(api(0)))?.query?.searchinfo?.totalhits || 0;
        if (!total) return null;
        const page = Object.values((await getJSON(api(dayOf(date) % Math.min(total, 9000))))?.query?.pages || {})[0];
        const info = page?.imageinfo?.[0];
        const url = safe((info?.thumburl || info?.url || "").replace(/\?.*$/, ""));
        if (!url) return null;
        const meta = (key, prefer) => visibleText(info.extmetadata?.[key]?.value, lang, 90, prefer);
        const when = meta("DateTimeOriginal");
        return {
          url, cors: true, fit: "frame",
          title: meta("ObjectName") || plain(String(page.title || "").replace(/^File:/, "").replace(/\.\w+$/, "")),
          // The painter's name is the first link; what follows it is a museum's note.
          by: plain([meta("Artist", "bdi, a"), /unknown/i.test(when) ? "" : when].filter(Boolean).join(", "), 90),
          link: safe(info.descriptionurl) || "https://commons.wikimedia.org/wiki/Commons:Featured_pictures"
        };
      }
    },

    met: {
      async ask(date) {
        // The European paintings the Met counts among its highlights: a page of ten from today's place in the list.
        const base = "https://collectionapi.metmuseum.org/public/collection/v1.1/search?departmentId=11&isHighlight=true&hasImages=true&q=*";
        const total = (await getJSON(`${base}&limit=1&offset=0`))?.total || 0;
        if (!total) return null;
        const offset = dayOf(date) % total;
        const ids = (await getJSON(`${base}&limit=10&offset=${Math.min(offset, Math.max(0, total - 10))}`))?.objectIDs || [];
        for (const id of ids.slice(0, 6)) {
          const object = await getJSON(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${Number(id)}`);
          const url = object?.isPublicDomain && safe(object.primaryImageSmall);
          if (!url) continue;
          return {
            url, cors: false, fit: "frame",
            title: plain(object.title),
            by: plain([object.artistDisplayName, object.objectDate].filter(Boolean).join(", "), 90),
            link: safe(object.objectURL) || "https://www.metmuseum.org/art/collection"
          };
        }
        return null;
      }
    },

    epic: {
      async ask() {
        // The newest day EPIC has, and the picture from the middle of it.
        const list = await getJSON("https://epic.gsfc.nasa.gov/api/natural");
        const shot = Array.isArray(list) && list.length ? list[Math.floor(list.length / 2)] : null;
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(shot?.date || "");
        if (!match || !/^[\w-]+$/.test(shot.image || "")) return null;
        return {
          url: `https://epic.gsfc.nasa.gov/archive/natural/${match[1]}/${match[2]}/${match[3]}/jpg/${shot.image}.jpg`,
          cors: false, fit: "dark",
          // EPIC's caption is the same sentence every day; the date says which day it is.
          title: "",
          by: `NASA EPIC · ${match[1]}-${match[2]}-${match[3]}`,
          link: "https://epic.gsfc.nasa.gov/"
        };
      }
    }
  };

  function read() {
    try { return JSON.parse(root.localStorage.getItem(KEY) || "{}") || {}; } catch (error) { return {}; }
  }

  const asking = {};
  /* Today's picture from a source: the one kept if it is today's, and if it
     is not, the newest kept one while today's is asked for. `fresh` hears
     about today's when it arrives. A thumbnail passes ask: false. */
  function today(source, fresh, { ask = true, now = new Date(), lang = "en" } = {}) {
    if (!SOURCES[source]) return null;
    const kept = read()[source];
    const day = dayOf(now);
    if (kept?.day === day && kept.lang === lang) return kept.picture;
    if (ask && !asking[source] && root.navigator?.onLine !== false && !(kept?.failedAt && Date.now() - kept.failedAt < 30 * 60000)) {
      asking[source] = SOURCES[source].ask(now, lang).then((picture) => {
        const data = read();
        data[source] = picture ? { day, lang, picture } : { ...(data[source] || {}), failedAt: Date.now() };
        try { root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (error) { /* asked again next tab */ }
        if (picture) fresh?.(picture);
      }).catch(() => {
        const data = read();
        data[source] = { ...(data[source] || {}), failedAt: Date.now() };
        try { root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (error) { /* asked again next tab */ }
      }).finally(() => { delete asking[source]; });
    }
    return kept?.picture || null;
  }

  const api = { SOURCES, today, dayOf, firstSentence, KEY };
  root.NordlysWorldPicture = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
