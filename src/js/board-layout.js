/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHERE FOLDERS SIT ON THE BOARD
   ═══════════════════════════════════════════════════════════════════

   The board is a stack of rows, and a row is a run of folders. Until somebody
   arranges them, the board chooses the rows itself; once they move a folder,
   every folder carries the row it is on (group.row) and the rows are theirs.

   Two things used to make a tidy board impossible. Rows broke wherever the
   next folder stopped fitting, so a board that needed two rows got a full one
   and a stub. And nothing said which folders shared a row, so "these four on
   top, those five below" could not be asked for at all.

   Everything here is pure: arrays in, arrays out, no DOM. The grid measures,
   this decides, and the unit tests hold the decisions still. */
(function () {
  "use strict";

  const LAYOUTS = ["natural", "fitted"];
  const MAX_ROW = 99;
  // Widths arrive in layout units; this only absorbs floating-point noise.
  const EPSILON = 0.05;

  const isRow = (value) => Number.isInteger(value) && value >= 0 && value <= MAX_ROW;
  const hasRows = (groups) => (groups || []).some((group) => isRow(group?.row));

  /* The visible folders, row by row, as indices into groups. Before anybody has
     arranged anything the whole board is a single row that the grid wraps. */
  function rowsOf(groups) {
    const visible = [];
    (groups || []).forEach((group, index) => { if (group && !group.hidden) visible.push(index); });
    if (!visible.length) return [];
    if (!hasRows(groups)) return [visible];
    const byRow = new Map();
    for (const index of visible) {
      const row = isRow(groups[index].row) ? groups[index].row : 0;
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row).push(index);
    }
    return [...byRow.keys()].sort((a, b) => a - b).map((row) => byRow.get(row));
  }

  /* How a run of folders breaks into lines: as few lines as the width allows,
     then the split whose widest line is narrowest, so a board that needs two
     lines gets two of a similar width rather than a full line and a stub. On a
     tie the earlier line takes the extra folder, the way text fills a page.
     Returns the number of folders on each line. */
  function balance(widths, gap, capacity) {
    const count = widths.length;
    if (!count) return [];
    const room = Math.max(0, Number(capacity) || 0);
    const pre = [0];
    for (const width of widths) pre.push(pre[pre.length - 1] + Math.max(0, Number(width) || 0));
    const span = (from, to) => pre[to] - pre[from] + gap * (to - from - 1);
    // A folder wider than the window still gets a line; it cannot be split.
    const fits = (from, to) => to - from === 1 || span(from, to) <= room + EPSILON;

    let lines = 1;
    for (let start = 0, end = 1; end <= count; end++) {
      if (!fits(start, end)) { lines++; start = end - 1; }
    }
    if (lines === 1) return [count];

    /* widest[k][j]: the narrowest possible widest line when the first j folders
       fill k lines. Then, with that bound fixed, the split that leaves the
       least room unused on every line — squared, so one ragged line costs more
       than two slightly short ones. */
    const widest = Array.from({ length: lines + 1 }, () => new Array(count + 1).fill(Infinity));
    widest[0][0] = 0;
    for (let k = 1; k <= lines; k++) {
      for (let j = k; j <= count; j++) {
        for (let i = k - 1; i < j; i++) {
          if (!fits(i, j) || widest[k - 1][i] === Infinity) continue;
          const value = Math.max(widest[k - 1][i], span(i, j));
          if (value < widest[k][j]) widest[k][j] = value;
        }
      }
    }
    const bound = widest[lines][count] + EPSILON;
    const cost = Array.from({ length: lines + 1 }, () => new Array(count + 1).fill(Infinity));
    const cut = Array.from({ length: lines + 1 }, () => new Array(count + 1).fill(-1));
    cost[0][0] = 0;
    for (let k = 1; k <= lines; k++) {
      for (let j = k; j <= count; j++) {
        // Walking i downwards means a tie keeps the longer earlier line.
        for (let i = j - 1; i >= k - 1; i--) {
          if (!fits(i, j) || cost[k - 1][i] === Infinity) continue;
          const width = span(i, j);
          if (width > bound && j - i > 1) continue;
          const slack = Math.max(0, bound - width);
          const value = cost[k - 1][i] + slack * slack;
          if (value < cost[k][j] - 1e-6) { cost[k][j] = value; cut[k][j] = i; }
        }
      }
    }
    const counts = [];
    for (let k = lines, j = count; k > 0; k--) {
      const i = cut[k][j];
      counts.unshift(j - i);
      j = i;
    }
    return counts;
  }

  /* Writes the lines a person is looking at back into the folders: the array
     order becomes the reading order, and every folder the row it is on.

     lines holds indices into groups and covers every visible folder once.
     Hidden folders are not on the board, so they travel with the visible
     folder in front of them — except when that folder is the one being moved,
     in which case they stay put beside whatever came before it. Returns, for
     each old index, where that folder now is. */
  function commit(groups, lines, moved = -1) {
    const followers = new Map();
    const leading = [];
    let previous = -1;
    groups.forEach((group, index) => {
      if (!group) return;
      if (!group.hidden) {
        if (index !== moved) { previous = index; followers.set(index, []); }
        else followers.set(index, []);
        return;
      }
      if (previous === -1) leading.push(index);
      else followers.get(previous).push(index);
    });
    const order = [...leading];
    for (const index of leading) groups[index].row = 0;
    lines.forEach((line, row) => {
      for (const index of line) {
        order.push(index);
        groups[index].row = row;
        for (const follower of followers.get(index) || []) {
          order.push(follower);
          groups[follower].row = row;
        }
      }
    });
    // Anything the lines did not mention keeps its place at the end.
    groups.forEach((group, index) => { if (!order.includes(index)) order.push(index); });
    const where = new Array(groups.length);
    order.forEach((index, position) => { where[index] = position; });
    const reordered = order.map((index) => groups[index]);
    groups.splice(0, groups.length, ...reordered);
    return where;
  }

  /* Rows back to the board's own choosing. */
  function clearRows(groups) {
    let changed = false;
    for (const group of groups || []) {
      if (group && "row" in group) { delete group.row; changed = true; }
    }
    return changed;
  }

  /* Keeps a stored board coherent after anything outside the board edited it:
     a folder added, deleted, imported or moved in a list. Once rows exist,
     every folder has one — a newcomer joins the folder before it — rows are
     numbered from 0 without gaps, and the array reads row by row. */
  function normalise(groups) {
    if (!Array.isArray(groups)) return false;
    if (!hasRows(groups)) return clearRows(groups);
    const before = JSON.stringify(groups.map((group) => group?.row));
    // A folder with no row joins the one before it; at the front, the first row.
    let last = groups.find((group) => group && isRow(group.row)).row;
    for (const group of groups) {
      if (!group) continue;
      if (isRow(group.row)) last = group.row;
      else group.row = last;
    }
    /* Numbered by the visible folders, so a row holding nothing but hidden
       folders is not an empty band on the board; its folders join the row in
       front of them. */
    const visibleRows = [...new Set(groups.filter((group) => group && !group.hidden).map((group) => group.row))].sort((a, b) => a - b);
    const renumber = new Map(visibleRows.map((row, index) => [row, index]));
    const floor = (row) => {
      let best = 0;
      for (const [from, to] of renumber) if (from <= row) best = to;
      return best;
    };
    for (const group of groups) if (group) group.row = renumber.has(group.row) ? renumber.get(group.row) : floor(group.row);
    const sorted = groups.map((group, index) => ({ group, index }))
      .sort((a, b) => ((a.group?.row ?? 0) - (b.group?.row ?? 0)) || (a.index - b.index))
      .map(({ group }) => group);
    const reordered = sorted.some((group, index) => group !== groups[index]);
    if (reordered) groups.splice(0, groups.length, ...sorted);
    return reordered || before !== JSON.stringify(groups.map((group) => group?.row));
  }

  /* One keyboard step for a folder, on the lines as they are drawn. Left and
     right walk the reading order and cross the end of a row into the next one;
     up and down change row, keeping roughly the same place along it, and past
     the first or last row open a new one — unless the folder is already alone
     there, when there is nowhere further to go. Returns new lines, or null. */
  function step(lines, index, key) {
    const at = lines.findIndex((line) => line.includes(index));
    if (at < 0) return null;
    const next = lines.map((line) => [...line]);
    const line = next[at];
    const position = line.indexOf(index);
    const alone = line.length === 1;
    const without = () => { line.splice(position, 1); };
    const tidy = () => next.filter((row) => row.length);
    switch (key) {
      case "ArrowLeft": {
        if (position > 0) { [line[position - 1], line[position]] = [line[position], line[position - 1]]; return next; }
        if (at === 0) return null;
        without();
        next[at - 1].push(index);
        return tidy();
      }
      case "ArrowRight": {
        if (position < line.length - 1) { [line[position + 1], line[position]] = [line[position], line[position + 1]]; return next; }
        if (at === next.length - 1) return null;
        without();
        next[at + 1].unshift(index);
        return tidy();
      }
      case "ArrowUp": {
        if (at === 0) {
          if (alone) return null;
          without();
          return [[index], ...next];
        }
        without();
        const above = next[at - 1];
        above.splice(Math.min(position, above.length), 0, index);
        return tidy();
      }
      case "ArrowDown": {
        if (at === next.length - 1) {
          if (alone) return null;
          without();
          return [...next, [index]];
        }
        without();
        const below = next[at + 1];
        below.splice(Math.min(position, below.length), 0, index);
        return tidy();
      }
      default: return null;
    }
  }

  /* Places a folder at a target on the lines as drawn: into row `row` before
     the folder `before` (or at the row's end when before is null), or into a
     new row opened at position `newRow`. */
  function place(lines, index, target) {
    const next = lines.map((line) => line.filter((item) => item !== index));
    if (target && Number.isInteger(target.newRow)) {
      const at = Math.max(0, Math.min(next.length, target.newRow));
      next.splice(at, 0, [index]);
      return next.filter((line) => line.length);
    }
    const row = next[Math.max(0, Math.min(next.length - 1, target?.row ?? 0))];
    if (!row) return [[index]];
    const before = target?.before;
    const position = before == null ? row.length : row.indexOf(before);
    row.splice(position < 0 ? row.length : position, 0, index);
    return next.filter((line) => line.length);
  }

  /* "Move up" and "Move down" in the settings list, which is the board in
     reading order. With rows of the user's own, a visible folder takes the same
     single step the arrow keys take on the board, so crossing the end of a row
     is a step of its own rather than a jump past it. A hidden folder has no
     place on the board; it simply swaps and takes the row it lands in. Returns
     the folder's new index, or -1 when it could not move. */
  function shift(groups, index, delta) {
    const target = index + Math.sign(delta);
    if (!groups[index] || target < 0 || target >= groups.length) return -1;
    const folder = groups[index];
    if (hasRows(groups) && !folder.hidden) {
      const lines = rowsOf(groups);
      const next = step(lines, index, delta < 0 ? "ArrowLeft" : "ArrowRight");
      if (!next) return -1;
      return commit(groups, next, index)[index];
    }
    groups.splice(index, 1);
    groups.splice(target, 0, folder);
    if (hasRows(groups)) {
      const neighbour = groups[target - 1] || groups[target + 1];
      if (neighbour && isRow(neighbour.row)) folder.row = neighbour.row;
      normalise(groups);
    }
    return groups.indexOf(folder);
  }

  /* Tidy up: folders of a similar height side by side, tallest first, in rows
     that each fit the window. In Fitted every folder on a line takes the
     line's height, so a one-tile folder beside a three-row one is a panel of
     empty glass; in Natural the same pairing is a ragged edge. Where the rows
     break is chosen to cost the least of both: the glass a short folder would
     leave empty beside the tallest in its row, and — at half the weight — the
     width a row leaves unused. Heights and widths are what the grid measured;
     equal heights keep the order they had. Returns lines of indices. */
  function tidy(items, gap, capacity) {
    const sorted = [...items]
      .map((item, position) => ({ ...item, position, height: Math.round(Number(item.height) || 0), width: Math.max(0, Number(item.width) || 0) }))
      .sort((a, b) => (b.height - a.height) || (a.position - b.position));
    const count = sorted.length;
    if (!count) return [];
    const room = Math.max(0, Number(capacity) || 0);
    const best = new Array(count + 1).fill(Infinity);
    const cut = new Array(count + 1).fill(0);
    best[0] = 0;
    for (let j = 1; j <= count; j++) {
      let width = -gap;
      // Walking back from j: the row is sorted[i..j-1], tallest first.
      for (let i = j - 1; i >= 0; i--) {
        width += gap + sorted[i].width;
        if (width > room + EPSILON && i < j - 1) break;
        const tallest = sorted[i].height;
        // Adding a taller folder in front raises the row for everyone behind it.
        let waste = 0;
        for (let k = i; k < j; k++) waste += (tallest - sorted[k].height) * sorted[k].width;
        const unused = Math.max(0, room - width) * tallest * 0.5;
        const value = best[i] + waste + unused;
        if (value < best[j]) { best[j] = value; cut[j] = i; }
      }
    }
    const lines = [];
    for (let j = count; j > 0; j = cut[j]) lines.unshift(sorted.slice(cut[j], j).map((item) => item.index));
    return lines;
  }

  const api = { LAYOUTS, MAX_ROW, isRow, hasRows, rowsOf, balance, commit, clearRows, normalise, step, place, shift, tidy };
  if (typeof window !== "undefined") window.NordlysBoardLayout = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
