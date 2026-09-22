/* The board as a command line. A leading ">" in the search box turns what
   follows into an instruction — "theme nord", "sky frost", "move youtube to
   daily" — and the page shows the result before Enter makes it so.

   This file only reads the words: it knows nothing about the page, and turns
   text plus a description of what exists into ranked candidates. English verbs
   always work; the locale's own verbs work beside them. */
(function () {
  const fold = value => String(value || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

  const ENGLISH = {
    theme: ['theme'],
    sky: ['sky', 'scene', 'atmosphere'],
    mood: ['mood', 'colours', 'colors', 'colour', 'color'],
    shuffle: ['shuffle'],
    arrange: ['arrange', 'layout'],
    newFolder: ['new folder', 'folder', 'add folder'],
    rename: ['rename'],
    hide: ['hide', 'fold'],
    show: ['show', 'unhide'],
    move: ['move'],
    settings: ['settings', 'preferences']
  };
  const JOINERS_EN = ['to', '→', '->'];

  // How well a name answers to what was typed: whole, start, word start, inside.
  function score(query, name) {
    const q = fold(query), n = fold(name);
    if (!q) return 0.1;
    if (!n) return 0;
    if (n === q) return 4;
    if (n.startsWith(q)) return 3;
    if (n.split(/[\s&/·-]+/).some(word => word.startsWith(q))) return 2;
    if (n.replace(/[\s&/·-]+/g, '').startsWith(q.replace(/\s+/g, ''))) return 1.8;
    if (n.includes(q)) return 1;
    return 0;
  }

  function ranked(query, items, limit = 5) {
    return items
      .map(item => ({ item, score: Math.max(score(query, item.name), item.key ? score(query, item.key) * 0.9 : 0) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || fold(a.item.name).localeCompare(fold(b.item.name)))
      .slice(0, limit)
      .map(entry => entry.item);
  }

  /* The verb at the start of the text, longest alias first, so "new folder x"
     is never read as "new" and "folder x". */
  function verbOf(text, verbs) {
    const folded = fold(text);
    let found = null;
    for (const [verb, aliases] of Object.entries(verbs)) {
      for (const alias of aliases) {
        const a = fold(alias);
        if (!a) continue;
        if ((folded === a || folded.startsWith(`${a} `)) && (!found || a.length > found.alias.length)) found = { verb, alias: a };
      }
    }
    if (!found) return null;
    return { verb: found.verb, rest: folded === found.alias ? '' : text.trim().slice(text.trim().length - (folded.length - found.alias.length)).trim() };
  }

  // "Daily to Morning" → ["Daily", "Morning"], whichever joiner was used.
  function split(rest, joiners) {
    const folded = fold(rest);
    for (const joiner of joiners) {
      const j = fold(joiner);
      if (!j) continue;
      const at = folded.indexOf(/^[\p{L}\p{N}]/u.test(j) ? ` ${j} ` : j);
      if (at > 0) {
        const width = /^[\p{L}\p{N}]/u.test(j) ? j.length + 2 : j.length;
        return [rest.slice(0, at).trim(), rest.slice(at + width).trim()];
      }
    }
    return [rest.trim(), ''];
  }

  function merge(extra = {}) {
    const verbs = {};
    for (const [verb, aliases] of Object.entries(ENGLISH)) verbs[verb] = [...aliases, ...(extra[verb] || [])];
    return verbs;
  }

  /* What there is to act on arrives in `world`:
     { themes, scenes, moods, folders, bookmarks, tabs } — each a list of
     { key, name } — plus the locale's { verbs, joiners }. Returns the ranked
     candidates, or { help: true } for a bare ">". */
  function parse(input, world, locale = {}) {
    const text = String(input || '').trim();
    if (!text) return { help: true, candidates: [] };
    const verbs = merge(locale.verbs);
    const joiners = [...JOINERS_EN, ...(locale.joiners || [])];
    const found = verbOf(text, verbs);
    if (!found) {
      // A verb still being typed: offer the verbs it could become.
      const typed = fold(text);
      const starting = Object.entries(verbs).filter(([, aliases]) => aliases.some(alias => fold(alias).startsWith(typed))).map(([verb]) => verb);
      return { candidates: starting.map(verb => ({ kind: 'verb', verb })) };
    }
    const { verb, rest } = found;
    const one = (kind, list, extra = {}) => ({ candidates: ranked(rest, list).map(target => ({ kind, target, ...extra })) });
    switch (verb) {
      case 'theme': return one('theme', world.themes || []);
      case 'sky': return one('sky', world.scenes || []);
      case 'mood': return one('mood', world.moods || []);
      case 'hide': return one('hide', (world.folders || []).filter(folder => !folder.hidden));
      case 'show': return one('show', (world.folders || []).filter(folder => folder.hidden));
      case 'settings': return rest ? one('settings', world.tabs || []) : { candidates: [{ kind: 'settings', target: null }] };
      case 'shuffle': return { candidates: [{ kind: 'shuffle' }] };
      case 'arrange': return { candidates: [{ kind: 'arrange' }] };
      case 'newFolder': return { candidates: rest ? [{ kind: 'newFolder', name: rest }] : [] };
      case 'rename': {
        const [from, to] = split(rest, joiners);
        return { candidates: ranked(from, world.folders || []).map(target => ({ kind: 'rename', target, name: to })) };
      }
      case 'move': {
        const [what, where] = split(rest, joiners);
        const bookmarks = ranked(what, world.bookmarks || [], 3);
        const folders = where ? ranked(where, world.folders || [], 3) : [];
        const out = [];
        for (const bookmark of bookmarks) for (const folder of folders) if (folder.key !== bookmark.folder) out.push({ kind: 'move', target: bookmark, folder });
        return { candidates: out.slice(0, 5) };
      }
      default: return { candidates: [] };
    }
  }

  const api = { parse, score, fold, ENGLISH };
  if (typeof window !== 'undefined') window.NordlysCommands = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
