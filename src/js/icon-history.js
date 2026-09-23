/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE ADDRESSES A BOOKMARK'S ICON HAS COME FROM
   ═══════════════════════════════════════════════════════════════════

   An icon taken from a web address used to keep the picture and forget the
   address, so the next time the icon menu opened, the field was empty and the
   link had to be found again. Each bookmark now keeps the address its current
   icon came from (link.iconUrl) and the last few it has used
   (link.iconUrls), newest first, each with a small picture of what it gave —
   drawn from the icon that was saved, so showing the list never asks the
   network for anything.

   Pure: objects in, objects out. The icon menu (settings.js) draws it. */
(function () {
  "use strict";

  const LIMIT = 6;
  const isAddress = (value) => typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim()) && value.length <= 2048;
  const isThumb = (value) => typeof value === "string" && /^data:image\/(png|webp|jpeg|gif);base64,/i.test(value) && value.length <= 40000;

  /* Only well-formed entries, newest first, one per address, at most LIMIT. */
  function clean(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object" || !isAddress(entry.url)) continue;
      const url = entry.url.trim();
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, thumb: isThumb(entry.thumb) ? entry.thumb : "", at: Number.isFinite(entry.at) ? entry.at : 0 });
      if (out.length === LIMIT) break;
    }
    return out;
  }

  const list = (link) => clean(link?.iconUrls);

  /* An address just used: to the front, and marked as the current icon's. */
  function remember(link, url, thumb = "", now = Date.now()) {
    if (!link || !isAddress(url)) return false;
    const address = url.trim();
    const rest = list(link).filter((entry) => entry.url !== address);
    link.iconUrls = clean([{ url: address, thumb, at: now }, ...rest]);
    link.iconUrl = address;
    return true;
  }

  /* An address edited into another: the old one goes, the new one is used. */
  function replace(link, from, to, thumb = "", now = Date.now()) {
    if (!link || !isAddress(to)) return false;
    link.iconUrls = list(link).filter((entry) => entry.url !== String(from || "").trim());
    return remember(link, to, thumb, now);
  }

  /* An address taken off the list. The icon on the tile stays as it is; it
     simply no longer says where it came from. Returns the entry, for Undo. */
  function forget(link, url) {
    const entries = list(link);
    const at = entries.findIndex((entry) => entry.url === url);
    if (at < 0) return null;
    const [removed] = entries.splice(at, 1);
    const wasCurrent = link.iconUrl === url;
    if (entries.length) link.iconUrls = entries;
    else delete link.iconUrls;
    if (wasCurrent) delete link.iconUrl;
    return { entry: removed, index: at, wasCurrent };
  }

  /* Undo of forget: the entry back where it was. */
  function restore(link, removed) {
    if (!link || !removed?.entry) return;
    const entries = list(link);
    entries.splice(Math.min(removed.index, entries.length), 0, removed.entry);
    link.iconUrls = clean(entries);
    if (removed.wasCurrent) link.iconUrl = removed.entry.url;
  }

  /* Another kind of icon chosen — a brand mark, a favicon, a file, a letter:
     the tile's picture no longer comes from an address, but the addresses
     used before are kept to go back to. */
  function leave(link) {
    if (link) delete link.iconUrl;
  }

  /* The host an address points at, for a label. */
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return String(url || ""); }
  }

  const api = { LIMIT, clean, list, remember, replace, forget, restore, leave, hostOf, isAddress, isThumb };
  if (typeof window !== "undefined") window.NordlysIconHistory = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
