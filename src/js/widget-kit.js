/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHAT THE DASHBOARD WIDGETS KNOW
   ═══════════════════════════════════════════════════════════════════

   Pure: no storage, no page, no clock of its own. Every function that
   depends on the time is handed "now", so the widgets can be tested at
   any hour and two of them never disagree about what day it is.

     tasks      a list: add, tick off, move, and done ones drop off next day
     focus      one line for today, and whether it happened
     timer      focus and rest, counted from timestamps, not intervals
     countdown  whole days to a date
     clock      the time somewhere else, and whether it is another day there
     weather    Open-Meteo's answer, folded into what a card shows          */
(function (root) {
  "use strict";

  const dayOf = (now) => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  let counter = 0;
  const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const clean = (text, max) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

  // ── Tasks ──────────────────────────────────────────────────────
  const MAX_TEXT = 280;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const shift = (now, days) => { const d = new Date(now); d.setDate(d.getDate() + days); return dayOf(d); };
  /* Words for when, at the end of what was typed: "tomorrow", "on monday",
     "in 3 days", and the same in Russian. Only at the end, so "Saturday
     market" stays a market and "Tomorrowland" stays a festival. */
  const WEEKDAYS = {
    en: [["sunday", "sun"], ["monday", "mon"], ["tuesday", "tue"], ["wednesday", "wed"], ["thursday", "thu"], ["friday", "fri"], ["saturday", "sat"]],
    ru: [["воскресенье"], ["понедельник"], ["вторник"], ["среду", "среда"], ["четверг"], ["пятницу", "пятница"], ["субботу", "суббота"]]
  };
  function whenOf(text, now) {
    const lower = text.toLowerCase();
    const end = (pattern) => { const m = new RegExp(`(?:^|\\s)(?:${pattern})$`, "u").exec(lower); return m ? { at: m.index, match: m } : null; };
    const simple = [["today|tonight|сегодня", 0], ["tomorrow|завтра", 1], ["послезавтра|day after tomorrow", 2]];
    for (const [words, days] of simple) { const hit = end(words); if (hit) return { at: hit.at, due: shift(now, days) }; }
    const later = end("in (\\d{1,3}) (days?|weeks?)|через (\\d{1,3}) (дн(?:я|ей)|день|недел(?:ю|и|ь))");
    if (later) {
      const m = later.match;
      const n = Number(m[1] || m[3]);
      const weeks = /week|недел/.test(m[2] || m[4]);
      return { at: later.at, due: shift(now, n * (weeks ? 7 : 1)) };
    }
    const today = new Date(now).getDay();
    for (const names of [WEEKDAYS.en, WEEKDAYS.ru]) {
      for (const [day, forms] of names.entries()) {
        const hit = end(`(?:on |next |в |во )?(?:${forms.join("|")})`);
        // A weekday alone, with nothing before it, is more likely a name.
        if (hit && hit.at > 0) return { at: hit.at, due: shift(now, ((day - today + 7) % 7) || 7) };
      }
    }
    return null;
  }
  const tasks = {
    MAX_TEXT,
    create: () => ({ items: [] }),
    add(list, text, now, { due = null, priority = false } = {}) {
      const value = clean(text, MAX_TEXT);
      if (!value) return null;
      const task = { id: newId(), text: value, done: false, created: now };
      if (due && DATE.test(due)) task.due = due;
      if (priority) task.priority = true;
      list.items.push(task);
      return task;
    },
    shift,
    // What was typed into the add field: the words, a due date, a "!".
    parse(input, now) {
      let text = clean(input, MAX_TEXT);
      let priority = false;
      if (/(^|\s)!+(?=\s|$)/.test(text)) { priority = true; text = text.replace(/(^|\s)!+(?=\s|$)/g, " ").replace(/\s+/g, " ").trim(); }
      const when = whenOf(text, now);
      if (when) text = text.slice(0, when.at).trim();
      return { text, due: when ? when.due : null, priority };
    },
    // Where a task stands against the calendar.
    state(task, now) {
      if (!task.due) return "none";
      const today = dayOf(now);
      return task.due < today ? "overdue" : task.due === today ? "today" : "later";
    },
    /* The four views of a list. Open tasks keep the order they were put in,
       with the ones that matter most first; done ones come last. */
    filter(list, view, now) {
      const today = dayOf(now);
      const open = list.items.filter((task) => !task.done);
      const ranked = [...open.filter((task) => task.priority), ...open.filter((task) => !task.priority)];
      if (view === "today") return ranked.filter((task) => task.due && task.due <= today);
      if (view === "upcoming") return ranked.filter((task) => task.due && task.due > today);
      if (view === "done") return list.items.filter((task) => task.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      return [...ranked, ...list.items.filter((task) => task.done && dayOf(task.doneAt) === today)];
    },
    setDue(list, id, due) {
      const task = tasks.find(list, id);
      if (!task) return null;
      if (due && DATE.test(due)) task.due = due; else delete task.due;
      return task;
    },
    setPriority(list, id, on) {
      const task = tasks.find(list, id);
      if (!task) return null;
      if (on) task.priority = true; else delete task.priority;
      return task;
    },
    addSub(list, id, text, now) {
      const task = tasks.find(list, id);
      const value = clean(text, MAX_TEXT);
      if (!task || !value) return null;
      const sub = { id: newId(), text: value, done: false };
      (task.subs ||= []).push(sub);
      return sub;
    },
    toggleSub(list, id, subId) {
      const sub = tasks.find(list, id)?.subs?.find((s) => s.id === subId);
      if (sub) sub.done = !sub.done;
      return sub || null;
    },
    removeSub(list, id, subId) {
      const task = tasks.find(list, id);
      if (!task?.subs) return false;
      task.subs = task.subs.filter((s) => s.id !== subId);
      if (!task.subs.length) delete task.subs;
      return true;
    },
    progress: (task) => ({ done: (task.subs || []).filter((s) => s.done).length, total: (task.subs || []).length }),
    find: (list, id) => list.items.find((task) => task.id === id) || null,
    toggle(list, id, now) {
      const task = tasks.find(list, id);
      if (!task) return null;
      task.done = !task.done;
      if (task.done) task.doneAt = now; else delete task.doneAt;
      return task;
    },
    // An emptied task is a removed one: there is nothing left to do.
    edit(list, id, text) {
      const task = tasks.find(list, id);
      if (!task) return null;
      const value = clean(text, MAX_TEXT);
      if (!value) { tasks.remove(list, id); return null; }
      task.text = value;
      return task;
    },
    remove(list, id) {
      const index = list.items.findIndex((task) => task.id === id);
      if (index >= 0) list.items.splice(index, 1);
      return index >= 0;
    },
    move(list, id, index) {
      const from = list.items.findIndex((task) => task.id === id);
      if (from < 0) return false;
      const [task] = list.items.splice(from, 1);
      list.items.splice(Math.max(0, Math.min(index, list.items.length)), 0, task);
      return true;
    },
    clearDone(list) {
      const before = list.items.length;
      list.items = list.items.filter((task) => !task.done);
      return before - list.items.length;
    },
    /* What the card shows: open tasks in their order, then today's done
       ones. A task done yesterday has had its moment. */
    view(list, now) {
      const today = dayOf(now);
      const open = list.items.filter((task) => !task.done);
      const done = list.items.filter((task) => task.done && dayOf(task.doneAt) === today);
      return [...open, ...done];
    }
  };

  // ── Focus of the day ───────────────────────────────────────────
  const HISTORY = 30;
  const focus = {
    HISTORY,
    create: () => ({ day: null, text: "", done: false, history: [] }),
    set(state, text, now) {
      const day = dayOf(now);
      if (state.day && state.day !== day && state.text) {
        state.history.push({ day: state.day, text: state.text, done: Boolean(state.done) });
        if (state.history.length > HISTORY) state.history.splice(0, state.history.length - HISTORY);
      }
      state.day = day;
      state.text = clean(text, 140);
      state.done = false;
      return state;
    },
    today: (state, now) => (state.day === dayOf(now) && state.text ? { text: state.text, done: Boolean(state.done) } : null),
    finish(state, done, now) {
      if (state.day !== dayOf(now)) return false;
      state.done = Boolean(done);
      return true;
    },
    clear(state) { state.text = ""; state.done = false; }
  };

  // ── Focus timer ────────────────────────────────────────────────
  const MINUTE = 60_000;
  const minutes = (value, fallback) => Math.max(1, Math.min(60, Math.round(Number.isFinite(Number(value)) ? Number(value) : fallback)));
  const timer = {
    create: ({ focus: f = 25, rest = 5 } = {}) => ({
      focus: minutes(f, 25), rest: minutes(rest, 5), phase: "focus", running: false,
      endsAt: 0, left: minutes(f, 25) * MINUTE, log: []
    }),
    length: (t) => (t.phase === "focus" ? t.focus : t.rest) * MINUTE,
    remaining: (t, now) => Math.max(0, t.running ? t.endsAt - now : t.left),
    start(t, now) {
      if (t.running) return;
      t.running = true;
      if (t.mode === "countup") t.startedAt = now;
      else t.endsAt = now + t.left;
    },
    pause(t, now) {
      if (!t.running) return;
      if (t.mode === "countup") t.spent = (t.spent || 0) + (now - t.startedAt);
      else t.left = Math.max(0, t.endsAt - now);
      t.running = false;
    },
    reset(t) {
      t.phase = "focus";
      t.running = false;
      t.left = t.focus * MINUTE;
    },
    /* Called on every frame the card draws. A focus that ran out is logged
       and the break starts by itself; a break that ran out leaves the next
       focus waiting for the person, who may have walked away. */
    tick(t, now) {
      if (t.mode === "countup" || !t.running || now < t.endsAt) return null;
      if (t.phase === "focus") {
        t.log.push({ day: dayOf(t.endsAt), min: t.focus });
        if (t.log.length > 400) t.log.splice(0, t.log.length - 400);
        t.phase = "rest";
        t.left = t.rest * MINUTE;
        t.endsAt = now + t.left;
        return "rest";
      }
      t.phase = "focus";
      t.running = false;
      t.left = t.focus * MINUTE;
      return "focus";
    },
    // A log entry is { day, min }; builds before 2.7 wrote the day alone.
    sessions: (t, now) => t.log.filter((entry) => (entry.day || entry) === dayOf(now)).length,
    minutes: (t, now) => t.log.filter((entry) => (entry.day || entry) === dayOf(now)).reduce((sum, entry) => sum + (entry.min ?? t.focus), 0),
    /* Days in a row with a finished focus. A streak that reaches yesterday
       still stands in the morning: today is not over. */
    streak(t, now) {
      const days = new Set(t.log.map((entry) => entry.day || entry));
      const cursor = new Date(now);
      if (!days.has(dayOf(cursor))) cursor.setDate(cursor.getDate() - 1);
      let count = 0;
      while (days.has(dayOf(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
      return count;
    },
    more(t, minutes, now) {
      const add = minutes * MINUTE;
      if (t.running) t.endsAt += add; else t.left += add;
    },
    // Ends the phase that is on without counting it.
    skip(t, now) {
      if (t.phase === "focus") {
        t.phase = "rest";
        t.left = t.rest * MINUTE;
        if (t.running) t.endsAt = now + t.left;
      } else {
        t.phase = "focus";
        t.running = false;
        t.left = t.focus * MINUTE;
      }
    },
    /* Counting up: no end, just how long. It is logged when it is stopped,
       if it lasted a minute or more. */
    setMode(t, mode) {
      t.mode = mode === "countup" ? "countup" : "pomodoro";
      t.running = false;
      t.phase = "focus";
      t.left = t.focus * MINUTE;
      t.spent = 0;
    },
    elapsed: (t, now) => (t.spent || 0) + (t.running && t.mode === "countup" ? now - t.startedAt : 0),
    stop(t, now) {
      const spent = timer.elapsed(t, now);
      if (spent >= MINUTE) t.log.push({ day: dayOf(now), min: Math.floor(spent / MINUTE) });
      t.running = false;
      t.spent = 0;
    },
    face(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    }
  };

  // ── Habits ─────────────────────────────────────────────────────
  /* Each habit keeps the days it was done, as dates. A year of them is
     plenty for a streak and a week of dots. */
  const habits = {
    create: () => ({ items: [] }),
    add(state, name) {
      const value = clean(name, 60);
      if (!value) return null;
      const habit = { id: newId(), name: value, days: [] };
      state.items.push(habit);
      return habit;
    },
    find: (state, id) => state.items.find((h) => h.id === id) || null,
    done: (habit, day) => habit.days.includes(day),
    toggle(state, id, day) {
      const habit = habits.find(state, id);
      if (!habit) return null;
      if (habit.days.includes(day)) habit.days = habit.days.filter((d) => d !== day);
      else { habit.days.push(day); habit.days.sort(); }
      if (habit.days.length > 400) habit.days.splice(0, habit.days.length - 400);
      return habit;
    },
    remove(state, id) { state.items = state.items.filter((h) => h.id !== id); },
    rename(state, id, name) { const habit = habits.find(state, id); const value = clean(name, 60); if (habit && value) habit.name = value; return habit; },
    week: (habit, now) => Array.from({ length: 7 }, (v, i) => { const day = shift(now, i - 6); return { day, done: habit.days.includes(day) }; }),
    streak(habit, now) {
      let offset = habit.days.includes(dayOf(now)) ? 0 : -1;
      let count = 0;
      while (habit.days.includes(shift(now, offset))) { count++; offset--; }
      return count;
    }
  };

  // ── Tab stash ──────────────────────────────────────────────────
  /* Open tabs put away in a group, to come back to. Only web pages are
     kept: not this page, not pinned tabs, not the browser's own pages. */
  const stash = {
    MAX_GROUPS: 50,
    MAX_TABS: 100,
    create: () => ({ groups: [] }),
    pick: (tabs, self) => tabs.filter((tab) => /^https?:\/\//i.test(tab.url || "") && !tab.pinned && !(self && String(tab.url).startsWith(self))),
    add(state, tabs, now) {
      if (!tabs.length) return null;
      const group = { id: newId(), at: now, tabs: tabs.slice(0, stash.MAX_TABS).map((tab) => ({ url: tab.url, title: clean(tab.title || tab.url, 200) })) };
      state.groups.unshift(group);
      if (state.groups.length > stash.MAX_GROUPS) state.groups.length = stash.MAX_GROUPS;
      return group;
    },
    remove(state, id) { state.groups = state.groups.filter((g) => g.id !== id); },
    // A tab opened from the stash leaves it; a group with nothing left goes.
    take(state, id, url) {
      const group = state.groups.find((g) => g.id === id);
      if (!group) return;
      const at = group.tabs.findIndex((t) => t.url === url);
      if (at >= 0) group.tabs.splice(at, 1);
      if (!group.tabs.length) stash.remove(state, id);
    }
  };

  // ── Countdown ──────────────────────────────────────────────────
  function countdown(date, now) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
    if (!match) return null;
    const target = Date.UTC(+match[1], +match[2] - 1, +match[3]);
    const [y, m, d] = dayOf(now).split("-").map(Number);
    const days = Math.round((target - Date.UTC(y, m - 1, d)) / (24 * 3600 * 1000));
    if (days === 0) return { days: 0, state: "today" };
    return { days: Math.abs(days), state: days > 0 ? "ahead" : "past" };
  }

  // ── World clock ────────────────────────────────────────────────
  const zoneDay = (zone, now) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  function clock(zone, now, { hour12 = false, home, locale = "en-GB" } = {}) {
    try {
      const time = new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12 }).format(now);
      const here = home ? zoneDay(home, now) : dayOf(now);
      const there = zoneDay(zone, now);
      const dayShift = there === here ? 0 : there > here ? 1 : -1;
      return { time, dayShift };
    } catch (error) {
      return null;
    }
  }
  const zones = () => (typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []);

  // ── Weather ────────────────────────────────────────────────────
  const weather = {
    url({ lat, lon, units = "metric", days = 5 }) {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("current", "temperature_2m,weather_code,is_day");
      url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", String(days));
      if (units === "imperial") url.searchParams.set("temperature_unit", "fahrenheit");
      return url.href;
    },
    // Finding a place by name, for the settings of the card.
    searchUrl: (name, language = "en") => {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", String(name));
      url.searchParams.set("count", "6");
      url.searchParams.set("language", language);
      return url.href;
    },
    // WMO weather codes, as Open-Meteo sends them.
    kind(code) {
      const c = Number(code);
      if (c === 0 || c === 1) return "clear";
      if (c === 2) return "partly";
      if (c === 45 || c === 48) return "fog";
      if (c >= 51 && c <= 57) return "drizzle";
      if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
      if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
      if (c >= 95 && c <= 99) return "storm";
      return "cloudy";
    },
    parse(answer) {
      const current = answer?.current;
      const daily = answer?.daily;
      if (!current || !daily?.time) return null;
      return {
        now: { temp: Math.round(current.temperature_2m), kind: weather.kind(current.weather_code), day: current.is_day !== 0 },
        days: daily.time.map((date, i) => ({
          date,
          hi: Math.round(daily.temperature_2m_max[i]),
          lo: Math.round(daily.temperature_2m_min[i]),
          kind: weather.kind(daily.weather_code[i]),
          rain: daily.precipitation_probability_max?.[i] ?? null
        }))
      };
    }
  };

  const api = { dayOf, newId, tasks, focus, timer, habits, stash, countdown, clock, zones, weather };
  root.NordlysWidgetKit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
