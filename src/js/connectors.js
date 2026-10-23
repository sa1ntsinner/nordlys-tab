/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE SERVICES A DASHBOARD CAN READ FROM
   ═══════════════════════════════════════════════════════════════════

   Tasks and events from the apps people already use, read straight from
   each app's own API with the person's own token. Nordlys has no server in
   between: a request goes from this browser to that service and nowhere
   else, and the token stays on this device (chrome.storage.local, never
   synced, never in a backup).

   Every connector turns its service's answer into the same shape:
     { id, title, url, due, done, source, context, priority }
   where due is "YYYY-MM-DD" or null. The request builders and the
   normalisers are pure and tested; list() does the fetching.

   Three are kept: Todoist, GitHub and any calendar by its ICS link. Each
   is one token or one address, with nothing to register and no sign-in
   window. Others were cut in 2.5.2: each one is a service that can change
   under Nordlys, for few people.                                       */
(function (root) {
  "use strict";

  const day = (value) => {
    if (!value) return null;
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const clip = (text, max = 300) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const safeUrl = (url) => (/^https?:\/\//i.test(String(url || "")) ? String(url) : null);
  const item = (source, fields) => ({ id: `${source}:${fields.id}`, title: clip(fields.title) || "(untitled)", url: safeUrl(fields.url), due: day(fields.due), done: Boolean(fields.done), source, context: clip(fields.context || "", 80), priority: Boolean(fields.priority), native: String(fields.id) });

  /* Each connector: what it is called, which fields a person fills in (and
     where to find them), the addresses it needs leave to reach, how its
     requests are made, and how its answers read. */
  const CONNECTORS = {
    todoist: {
      name: "Todoist", color: "#e44332", kind: "tasks",
      fields: [{ key: "token", label: "API token", secret: true, help: "https://app.todoist.com/app/settings/integrations/developer" }],
      origins: ["https://api.todoist.com/*"],
      requests: (c) => [{ url: "https://api.todoist.com/api/v1/tasks?limit=200", headers: { Authorization: `Bearer ${c.token}` } }],
      read: ([answer]) => (answer?.results || answer || []).map((t) => item("todoist", { id: t.id, title: t.content, url: t.url || `https://app.todoist.com/app/task/${t.id}`, due: t.due?.date, priority: t.priority === 4, context: t.project_name || "" })),
      complete: (c, it) => ({ url: `https://api.todoist.com/api/v1/tasks/${encodeURIComponent(it.native)}/close`, method: "POST", headers: { Authorization: `Bearer ${c.token}` } })
    },
    github: {
      name: "GitHub", color: "#24292f", kind: "tasks",
      fields: [{ key: "token", label: "Personal access token", secret: true, help: "https://github.com/settings/personal-access-tokens/new" }],
      origins: ["https://api.github.com/*"],
      requests: (c) => {
        const headers = { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json" };
        return [
          { url: "https://api.github.com/issues?filter=assigned&state=open&per_page=50", headers },
          { url: "https://api.github.com/search/issues?q=is%3Aopen+is%3Apr+review-requested%3A%40me&per_page=30", headers }
        ];
      },
      read: ([assigned, reviews]) => {
        const seen = new Set();
        const out = [];
        for (const issue of [...(assigned || []), ...((reviews && reviews.items) || [])]) {
          if (seen.has(issue.id)) continue;
          seen.add(issue.id);
          const repo = (issue.repository?.full_name) || String(issue.repository_url || "").split("/repos/")[1] || "";
          out.push(item("github", { id: issue.id, title: `${issue.pull_request ? "Review: " : ""}${issue.title}`, url: issue.html_url, due: issue.milestone?.due_on, context: repo }));
        }
        return out;
      }
    },
    /* Several calendars in one connection, a link each: work and home in one
       list. One that does not answer leaves the others shown. */
    ics: {
      name: "Calendar (ICS link)", color: "#34a853", kind: "events", partial: true,
      fields: [{ key: "url", label: "Calendar address (iCal/ICS)", secret: true, multiple: true, help: "https://support.google.com/calendar/answer/37648" }],
      origins: (c) => [...new Set(calendars(c).map((url) => `${new URL(url).protocol}//${new URL(url).hostname}/*`))],
      requests: (c) => calendars(c).map((url) => ({ url, text: true })),
      read: (texts, c, now = Date.now()) => {
        const seen = new Set();
        return texts.flatMap((text, calendar) => (text == null ? [] : events(String(text), now)).map((e) => ({
          ...item("ics", { id: e.uid || `${e.start}${e.title}`, title: e.title, url: e.url, due: day(e.start) }),
          start: e.start, end: e.end, allDay: e.allDay, join: e.join, calendar,
          // A place that is only the meeting's link says nothing the Join button does not.
          where: e.join && e.location.includes(e.join) ? "" : clip(e.location || "", 80)
        }))).filter((e) => !seen.has(e.id) && seen.add(e.id));
      }
    }
  };
  // The calendar links of a connection, one per line; webcal is the same address over https.
  const calendars = (c) => String(c?.url || "").split(/\s+/).map((url) => safeUrl(url.replace(/^webcal:/i, "https:"))).filter(Boolean).slice(0, 8);

  // ── Calendar files ─────────────────────────────────────────────
  /* The events of an iCalendar file that fall in the next two weeks. Times
     are read in their own zone (TZID), repeats are unrolled on the wall
     clock of that zone, so a weekly 9:00 stays at 9:00 across a change to
     summer time, and the parts of RFC 5545 that calendars really send are
     followed: DAILY, WEEKLY, MONTHLY and YEARLY with INTERVAL, COUNT,
     UNTIL, BYDAY (also "2MO", "-1FR"), BYMONTHDAY and BYMONTH; EXDATE for
     a meeting called off; RECURRENCE-ID for one that was moved. */
  const DAY_MS = 86400e3;
  const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  function unfold(text) { return text.replace(/\r?\n[ \t]/g, ""); }
  const unescape = (value) => value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
  /* The address to join an online meeting by: the conference fields the big
     calendars add, else the first meeting link in its place, its link or its
     notes. Only the meeting services' own https addresses count. */
  const MEETING = /https:\/\/(?:meet\.google\.com|(?:[\w-]+\.)*zoom\.(?:us|com)|teams\.microsoft\.com|teams\.live\.com|(?:[\w-]+\.)*webex\.com|whereby\.com|meet\.jit\.si|app\.chime\.aws|meet\.goto\.com|(?:[\w-]+\.)*gotomeeting\.com)\/[^\s<>"'\\,;]+/i;
  function joinOf(field) {
    for (const name of ["X-GOOGLE-CONFERENCE", "X-MICROSOFT-ONLINEMEETINGCONFLINK", "X-MICROSOFT-SKYPETEAMSMEETINGURL", "URL", "LOCATION", "DESCRIPTION"]) {
      const found = MEETING.exec(unescape(field(name)?.value || ""));
      if (found) return found[0].replace(/[.)\]>]+$/, "");
    }
    return null;
  }
  // How far a zone is ahead of UTC at a moment, in ms; null for a zone this browser does not know.
  const zoneOffsets = new Map();
  function zoneOffset(zone, time) {
    let format = zoneOffsets.get(zone);
    if (format === undefined) {
      try { format = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch (error) { format = null; }
      zoneOffsets.set(zone, format);
    }
    if (!format) return null;
    const p = Object.fromEntries(format.formatToParts(new Date(time)).map((part) => [part.type, part.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - time;
  }
  // A wall-clock time in a zone ("UTC", "floating" for the viewer's own, or a TZID) as a moment.
  function moment(parts, zone) {
    const wall = Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.mi, parts.s);
    if (zone === "UTC") return wall;
    if (zone !== "floating") {
      const first = zoneOffset(zone, wall);
      if (first !== null) {
        const guess = wall - first;
        const second = zoneOffset(zone, guess);
        return wall - (second === first ? first : second);
      }
    }
    return new Date(parts.y, parts.m - 1, parts.d, parts.h, parts.mi, parts.s).getTime();
  }
  function readDate(value, params = "") {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value || "").trim());
    if (!m) return null;
    const parts = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
    const tzid = /TZID=("?)([^;:"]+)\1/i.exec(params)?.[2];
    /* A date with no time is a day on the viewer's calendar, wherever they
       are: read as a UTC midnight, an all-day event on the 23rd ended at
       seven in the evening of the 23rd in New York. */
    const zone = !m[4] ? "floating" : m[7] ? "UTC" : tzid || "floating";
    return { parts, zone, allDay: !m[4] };
  }
  function icsDate(value, params = "") {
    const read = readDate(value, params);
    if (!read) return null;
    const time = moment(read.parts, read.zone);
    if (read.allDay) return { iso: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, allDay: true, time };
    return { iso: new Date(time).toISOString(), allDay: false, time, tzid: read.zone !== "UTC" && read.zone !== "floating" };
  }
  const dayNumber = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
  // The day an instant falls on where the viewer is, as YYYY-MM-DD; two hours on, so a change of clocks cannot pull a midnight back a day.
  const localDay = (time) => { const d = new Date(time + 2 * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const fromDayNumber = (n) => { const date = new Date(n * DAY_MS); return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }; };
  const monthLength = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function duration(text) {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(text || "").trim());
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * ((+(m[2] || 0) * 7 + +(m[3] || 0)) * DAY_MS + (+(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000);
  }
  // The days of one month a rule picks, as day numbers in order.
  function daysInMonth(y, m, rule, startDay) {
    const last = monthLength(y, m);
    const out = new Set();
    for (const value of rule.BYMONTHDAY || []) { const d = value < 0 ? last + 1 + value : value; if (d >= 1 && d <= last) out.add(d); }
    for (const by of rule.BYDAY || []) {
      const weekday = WEEKDAYS.indexOf(by.day);
      const matches = [];
      for (let d = 1; d <= last; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === weekday) matches.push(d);
      if (!by.nth) matches.forEach((d) => out.add(d));
      else { const d = by.nth > 0 ? matches[by.nth - 1] : matches[matches.length + by.nth]; if (d) out.add(d); }
    }
    if (!rule.BYMONTHDAY && !rule.BYDAY && startDay <= last) out.add(startDay);
    return [...out].sort((a, b) => a - b).map((d) => dayNumber(y, m, d));
  }
  function parseRule(text) {
    const rule = {};
    for (const pair of String(text || "").split(";")) {
      const [key, value] = pair.split("=");
      if (!key || value === undefined) continue;
      rule[key.toUpperCase()] = value.toUpperCase();
    }
    if (!/^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(rule.FREQ || "")) return null;
    return {
      FREQ: rule.FREQ, INTERVAL: Math.max(1, +rule.INTERVAL || 1), COUNT: +rule.COUNT || 0, UNTIL: rule.UNTIL || null,
      BYDAY: rule.BYDAY ? rule.BYDAY.split(",").map((v) => /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(v)).filter(Boolean).map((m) => ({ nth: +(m[1] || 0), day: m[2] })) : null,
      BYMONTHDAY: rule.BYMONTHDAY ? rule.BYMONTHDAY.split(",").map(Number).filter((n) => n && Math.abs(n) <= 31) : null,
      BYMONTH: rule.BYMONTH ? rule.BYMONTH.split(",").map(Number).filter((n) => n >= 1 && n <= 12) : null
    };
  }
  /* The start days of a repeating event, one period at a time, in order,
     from its first day; it stops when told to (the caller's window). */
  /* Each period also says the day it begins on, so the caller can stop at
     the end of its window even when a period has no days at all: the 31st
     of a February, every twelve months, used to be asked about twenty
     thousand times. */
  function* repeatDays(start, rule) {
    const first = dayNumber(start.y, start.m, start.d);
    const weekStart = first - ((new Date(first * DAY_MS).getUTCDay() + 6) % 7);
    for (let k = 0; k < 20000; k++) {
      let days, begins;
      if (rule.FREQ === "DAILY") days = [begins = first + k * rule.INTERVAL];
      else if (rule.FREQ === "WEEKLY") {
        const week = begins = weekStart + k * 7 * rule.INTERVAL;
        days = rule.BYDAY ? rule.BYDAY.map((by) => week + ((WEEKDAYS.indexOf(by.day) + 6) % 7)).sort((a, b) => a - b) : [first + k * 7 * rule.INTERVAL];
      } else if (rule.FREQ === "MONTHLY") {
        const index = (start.m - 1) + k * rule.INTERVAL;
        const y = start.y + Math.floor(index / 12), m = (index % 12) + 1;
        begins = dayNumber(y, m, 1);
        days = daysInMonth(y, m, rule, start.d);
      } else {
        const y = start.y + k * rule.INTERVAL;
        begins = dayNumber(y, 1, 1);
        days = (rule.BYMONTH || [start.m]).flatMap((m) => daysInMonth(y, m, rule, start.d));
      }
      yield { begins, days: days.filter((day) => day >= first) };
    }
  }
  function events(text, now = Date.now(), days = 14) {
    const out = [];
    const from = now - 3600e3;
    const until = now + days * DAY_MS;
    const blocks = unfold(text).split("BEGIN:VEVENT").slice(1).map((block) => {
      const body = block.split("END:VEVENT")[0];
      const all = (name) => [...body.matchAll(new RegExp(`^${name}((?:;[^:\\n]*)?):(.*)$`, "gmi"))].map((m) => ({ params: m[1], value: m[2].trim() }));
      return { body, field: (name) => all(name)[0] || null, all };
    });
    // A moved or called-off single meeting replaces its place in the series.
    const moved = new Map();
    for (const b of blocks) {
      const id = b.field("RECURRENCE-ID");
      if (!id) continue;
      const uid = b.field("UID")?.value || "";
      const at = icsDate(id.value, id.params);
      if (at) (moved.get(uid) || moved.set(uid, new Set()).get(uid)).add(at.time);
    }
    for (const b of blocks) {
      if (/^STATUS:CANCELLED/mi.test(b.body)) continue;
      const startField = b.field("DTSTART");
      const start = startField && readDate(startField.value, startField.params);
      if (!start) continue;
      const startTime = moment(start.parts, start.zone);
      const endField = b.field("DTEND");
      const end = endField && icsDate(endField.value, endField.params);
      // A day-long event with neither end nor length lasts the day (RFC 5545, 3.6.1).
      const length = end ? end.time - startTime : duration(b.field("DURATION")?.value) || (start.allDay ? DAY_MS : 0);
      const uid = b.field("UID")?.value || "";
      const base = { uid, title: unescape(b.field("SUMMARY")?.value || ""), location: unescape(b.field("LOCATION")?.value || ""), url: b.field("URL")?.value || null, allDay: start.allDay, join: joinOf(b.field) };
      const push = (time) => {
        if (time + length < from || time > until) return;
        // A day-long event is given as days: its first, and the day after its last.
        out.push({ ...base, uid: `${uid}@${time}`, start: start.allDay ? localDay(time) : new Date(time).toISOString(), end: start.allDay ? localDay(time + length) : length ? new Date(time + length).toISOString() : null });
      };
      const rule = !b.field("RECURRENCE-ID") && parseRule(b.field("RRULE")?.value);
      if (!rule) { push(startTime); continue; }
      const skip = new Set(moved.get(uid) || []);
      for (const ex of b.all("EXDATE")) for (const value of ex.value.split(",")) { const at = icsDate(value, ex.params || startField.params); if (at) skip.add(at.time); }
      const last = rule.UNTIL ? icsDate(rule.UNTIL)?.time ?? Infinity : Infinity;
      let count = 0;
      outer: for (const period of repeatDays(start.parts, rule)) {
        if (period.begins * DAY_MS > until + DAY_MS) break;
        for (const day of period.days) {
          // Days long past are only counted: no zone sum for years of repeats.
          if ((day + 2) * DAY_MS + Math.max(0, length) < from) { count++; if (rule.COUNT && count >= rule.COUNT) break outer; continue; }
          const { y, m, d } = fromDayNumber(day);
          const time = moment({ ...start.parts, y, m, d }, start.zone);
          if (time > last || time > until || (rule.COUNT && count >= rule.COUNT)) break outer;
          count++;
          if (!skip.has(time)) push(time);
        }
      }
    }
    return out.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 60);
  }

  // ── Fetching ───────────────────────────────────────────────────
  class ConnectorError extends Error { constructor(message, status) { super(message); this.status = status; } }
  // A calendar link is anybody's file: it may not hang the card, nor be the size of a film.
  const FETCH_MS = 20000;
  const TEXT_LIMIT = 5 * 1024 * 1024;
  async function fetchOne(spec) {
    const control = typeof AbortController === "function" ? new AbortController() : null;
    const timer = control ? setTimeout(() => control.abort(), FETCH_MS) : null;
    try { return await answerOf(spec, control); }
    catch (error) { throw error?.name === "AbortError" ? new ConnectorError("The service took too long to answer.") : error; }
    finally { clearTimeout(timer); }
  }
  async function answerOf(spec, control) {
    const response = await fetch(spec.url, { method: spec.method || "GET", headers: spec.headers || {}, body: spec.body, signal: control?.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let said;
      try { const j = JSON.parse(text); said = j.message || j.error?.message || j.errors?.[0]?.message || j.error || ""; } catch (error) { said = text.slice(0, 120); }
      throw new ConnectorError(response.status === 401 || response.status === 403 ? `The token was refused (${response.status}).` : `The service answered ${response.status}${said ? `: ${said}` : ""}.`, response.status);
    }
    if (spec.text) {
      if (Number(response.headers?.get?.("content-length")) > TEXT_LIMIT) throw new ConnectorError("The file is too large to read.");
      const text = await response.text();
      if (text.length > TEXT_LIMIT) throw new ConnectorError("The file is too large to read.");
      return text;
    }
    return response.status === 204 ? null : response.json();
  }
  // Everything one connector has for this person, in the shared shape.
  async function list(id, creds, now = Date.now()) {
    const c = CONNECTORS[id];
    if (!c) throw new ConnectorError(`No connector called ${id}.`);
    const answers = await Promise.allSettled(c.requests(creds, now).map(fetchOne));
    const failed = answers.find((answer) => answer.status === "rejected");
    // Where the parts stand alone (calendars), the ones that answered are shown and the failure is told beside them.
    if (failed && (!c.partial || answers.every((answer) => answer.status === "rejected"))) throw failed.reason;
    const items = c.read(answers.map((answer) => answer.value ?? null), creds, now);
    if (failed) items.failed = failed.reason;
    return items;
  }
  async function complete(id, creds, it) {
    const c = CONNECTORS[id];
    if (!c?.complete) return false;
    await fetchOne(c.complete(creds, it));
    return true;
  }
  const originsOf = (id, creds) => { const o = CONNECTORS[id]?.origins; return typeof o === "function" ? o(creds || {}) : o || []; };
  const ready = (id, creds) => {
    const c = CONNECTORS[id];
    if (!c) return false;
    return c.fields.every((f) => String(creds?.[f.key] || "").trim());
  };

  const api = { CONNECTORS, list, complete, originsOf, ready, events, icsDate, ConnectorError, day, fetchOne };
  root.NordlysConnectors = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
