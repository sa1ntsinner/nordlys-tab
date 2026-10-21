/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - BRINGING A BOARD OVER FROM ANOTHER NEW-TAB EXTENSION
   ═══════════════════════════════════════════════════════════════════

   Pure: a parsed backup file in, Nordlys folders out, or null when the file
   is none of these. Each reader follows the format as that extension writes
   it (read from their shipping code, October 2026):

     FVD Speed Dial   {db:{dials, groups}, prefs}; the text its Export dialog shows
     Speed Dial 2     {dials, groups, preferences}; speed-dial-2-export-*.json
                      (and the older one, with dials and groups keyed "0", "1")
     Infinity         {version:"v2", data:{site:{sites}}}; infinityBackup-*.infinity
     nightTab         {nightTab:true, bookmark:[…]} (bookmarks before 7.0)
     Bonjourr         its settings file; every link is a top-level "links…" key
     Tabliss          {version:3, "data/<id>":{links}}

   Only web addresses are kept, and an icon only when it is a web address
   too: pictures inside a file (data: URLs) and app tiles stay behind. */
(function (root) {
  "use strict";

  const web = (url) => typeof url === "string" && /^https?:\/\/[^\s]+$/i.test(url.trim());
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (error) { return url; } };
  const byOrder = (key) => (a, b) => (Number(a?.[key]) || 0) - (Number(b?.[key]) || 0);
  const list = (value) => (Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : []);

  function link(url, name, icon) {
    if (!web(url)) return null;
    const out = { name: text(name) || host(url.trim()), url: url.trim() };
    if (web(icon)) out.customImg = icon.trim();
    return out;
  }

  function folder(label, links) {
    const kept = links.filter(Boolean);
    return kept.length ? { label: text(label) || "Imported", links: kept } : null;
  }

  // ── FVD Speed Dial ─────────────────────────────────────────────
  function fvd(file) {
    const db = file.db || file;
    const groups = list(db.groups).sort(byOrder("position"));
    const dials = list(db.dials).filter((dial) => !dial?.deny).sort(byOrder("position"));
    return groups.map((group) => folder(group.name, dials
      .filter((dial) => dial.group_id === group.id)
      .map((dial) => link(dial.url, dial.title || dial.auto_title, dial.thumb_source_type === "url" ? dial.thumb_url : null))));
  }

  // ── Speed Dial 2 ───────────────────────────────────────────────
  function speedDial2(file) {
    const groups = list(file.groups).sort(byOrder("position"));
    // Group 0 is Home, whether or not the file lists it.
    if (!groups.some((group) => Number(group.id) === 0)) groups.unshift({ id: 0, title: file.preferences?.defaultGroupName || "Home" });
    const dials = list(file.dials).sort(byOrder("position"));
    return groups.map((group) => folder(group.title, dials
      .filter((dial) => Number(dial.idgroup || 0) === Number(group.id))
      .map((dial) => link(dial.url, dial.title, dial.thumbnail))));
  }

  // ── Infinity ───────────────────────────────────────────────────
  /* Pages have no names; a folder on a page becomes a folder of its own,
     after the page it sat on. */
  function infinity(file) {
    const pages = list(file.data?.site?.sites);
    const out = [];
    pages.forEach((page, index) => {
      const items = list(page);
      const tile = (item) => (item?.type === "app" ? null : link(item?.target, item?.name, item?.bgType === "image" ? item.bgImage : null));
      out.push(folder(`Page ${index + 1}`, items.filter((item) => !Array.isArray(item?.children)).map(tile)));
      for (const item of items) if (Array.isArray(item?.children)) out.push(folder(item.name, item.children.map(tile)));
    });
    return out;
  }

  // ── nightTab ───────────────────────────────────────────────────
  function nightTab(file) {
    const groups = list(file.bookmark || file.bookmarks);
    // Before 4.0 the list was bookmarks with no groups at all.
    const grouped = groups.some((group) => Array.isArray(group?.items)) ? groups : [{ name: "nightTab", items: groups }];
    return grouped.map((group) => folder(typeof group.name === "string" ? group.name : group.name?.text, list(group.items).map((item) => {
      const display = item?.display || {};
      const name = display.name?.text ?? item?.name;
      const visual = display.visual || item?.visual || {};
      return link(item?.url, name, visual.type === "image" ? visual.image?.url : null);
    })));
  }

  // ── Bonjourr ───────────────────────────────────────────────────
  /* A top-level link's parent is its group's name; inside a folder, the
     folder's id. Each group, and each folder in it, becomes a folder. */
  function bonjourr(file) {
    const entries = Object.entries(file).filter(([key, value]) => key.startsWith("links") && value && typeof value === "object" && !Array.isArray(value) && value._id);
    const items = entries.map(([, value]) => value);
    // Very old files: a plain list of {title, url, icon}.
    if (!items.length && Array.isArray(file.links)) return [folder("Bonjourr", file.links.map((item) => link(item?.url, item?.title, item?.icon)))];
    const names = Array.isArray(file.linkgroups?.groups) && file.linkgroups.groups.length ? file.linkgroups.groups : ["default"];
    const icon = (item) => (item.icon && typeof item.icon === "object" && item.icon.type === "url" ? item.icon.value : typeof item.icon === "string" ? item.icon : null);
    const out = [];
    for (const name of names) {
      const here = items.filter((item) => (item.parent ?? names[0]) === name).sort(byOrder("order"));
      out.push(folder(name === "default" ? "Bonjourr" : name, here.filter((item) => !item.folder).map((item) => link(item.url, item.title, icon(item)))));
      for (const sub of here.filter((item) => item.folder)) {
        out.push(folder(sub.title, items.filter((item) => item.parent === sub._id && !item.folder).sort(byOrder("order")).map((item) => link(item.url, item.title, icon(item)))));
      }
    }
    return out;
  }

  // ── Tabliss ────────────────────────────────────────────────────
  function tabliss(file) {
    const widgets = Object.entries(file).filter(([key, value]) => key.startsWith("widget/") && value?.key === "widget/links").sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));
    const sets = widgets.length ? widgets.map(([key, value]) => ({ name: value.display?.title || value.name, links: file[`data/${key.slice("widget/".length)}`]?.links }))
      : Object.entries(file).filter(([key, value]) => key.startsWith("data/") && Array.isArray(value?.links)).map(([, value]) => ({ links: value.links }));
    return sets.map((set, index) => folder(set.name || (sets.length > 1 ? `Tabliss ${index + 1}` : "Tabliss"), list(set.links).map((item) => link(item?.url, item?.name, item?.icon))));
  }

  const FORMATS = [
    { id: "fvd", name: "FVD Speed Dial", test: (f) => Boolean(f.db && (f.db.dials || f.db.groups) && f.prefs), read: fvd },
    { id: "speeddial2", name: "Speed Dial 2", test: (f) => Boolean(f.dials && f.groups && (f.preferences || f.settings) && list(f.dials).some((d) => d && "idgroup" in d)), read: speedDial2 },
    { id: "infinity", name: "Infinity", test: (f) => Boolean(f.data?.site?.sites) || (f.version === "v2" && f.data && "site" in f.data), read: infinity },
    { id: "nighttab", name: "nightTab", test: (f) => f.nightTab === true || (Array.isArray(f.bookmarks) && typeof f.version === "string" && f.state), read: nightTab },
    { id: "bonjourr", name: "Bonjourr", test: (f) => Boolean(f.linkgroups || (f.about && Object.keys(f).some((k) => k.startsWith("links")))), read: bonjourr },
    { id: "tabliss", name: "Tabliss", test: (f) => Object.keys(f).some((k) => k.startsWith("data/") || k.startsWith("widget/")), read: tabliss }
  ];

  /* The folders a file brings, and whose file it was; null when it is not
     one of these (a Nordlys backup is read elsewhere). */
  function read(file) {
    if (!file || typeof file !== "object" || Array.isArray(file)) return null;
    const format = FORMATS.find((entry) => { try { return entry.test(file); } catch (error) { return false; } });
    if (!format) return null;
    const groups = format.read(file).filter(Boolean);
    return { from: format.name, id: format.id, groups };
  }

  const api = { read, FORMATS: FORMATS.map(({ id, name }) => ({ id, name })) };
  root.NordlysImporters = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
