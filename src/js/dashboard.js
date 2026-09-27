/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE DASHBOARD
   ═══════════════════════════════════════════════════════════════════

   A row of cards between the search box and the folders, there only when
   the profile has Dashboard turned on. The New tab mode stays exactly the
   page it was: nothing here runs or draws while the dashboard is off.

   Which cards there are, their order, size and settings live in the
   profile's config (config.dashboard), so they travel with the profile and
   with sync. What a card holds — tasks, a note, the timer — is kept per card
   in chrome.storage.local under nordlys_dash.<card id>, because it changes
   every few seconds and can outgrow what Chrome sync allows for one value.

   The knowledge of each card (what a task list does when you tick one off,
   how a timer counts) is in widget-kit.js and tested there. This file is
   only the page: drawing the cards and handing what people do to the kit. */
(function () {
  "use strict";

  const K = window.NordlysWidgetKit;
  const DATA = "nordlys_dash.";
  const say = (key, fallback, params) => {
    const value = window.I18N?.t(key, params || {});
    const text = value && value !== key ? value : fallback;
    return params ? text.replace(/\{(\w+)\}/g, (all, name) => (params[name] ?? all)) : text;
  };
  /* A list that scrolls says so: its lower edge fades while more is below,
     so a row cut by the edge reads as "more", not as broken. */
  const fadeWhenMore = (list) => {
    const check = () => list.classList.toggle("is-more", list.scrollTop + list.clientHeight < list.scrollHeight - 2);
    if (!list.dataset.fade) {
      list.dataset.fade = "1";
      list.addEventListener("scroll", check, { passive: true });
      if (typeof ResizeObserver === "function") new ResizeObserver(check).observe(list);
    }
    requestAnimationFrame(check);
  };
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of [].concat(children)) if (child !== null && child !== undefined && child !== false) node.append(child);
    return node;
  };
  const icon = (path) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    svg.append(p);
    return svg;
  };
  const locale = () => window.I18N?.currentLang || "en";
  const root = window;
  const storage = () => (typeof chrome !== "undefined" && chrome.storage?.local) || null;

  const ICONS = {
    focus: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
    notes: "M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6",
    timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2M10 2h4M18.5 5.5l1.5-1.5",
    clocks: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
    countdown: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M9 15h6",
    weather: "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z",
    quote: "M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    close: "M6 6l12 12M18 6 6 18",
    play: "M8 5v14l11-7z",
    pause: "M8 5h3v14H8zM13 5h3v14h-3z",
    reset: "M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6",
    flag: "M5 21V4M5 4h11l-2 4 2 4H5",
    chevron: "m7 10 5 5 5-5",
    calendar: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
    habits: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11",
    flame: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2 2 3 1-2 1-4 1-6Z",
    stash: "M4 7h16v12H4zM4 7l2-3h12l2 3M9 12h6",
    send: "M5 12h14M13 6l6 6-6 6",
    stopSquare: "M7 7h10v10H7z",
    ai: "M12 3l1.8 4.9L19 9.7l-4.3 3 1.3 5.3L12 15.3 7.9 18l1.3-5.3L5 9.7l5.2-1.8z",
    inbox: "M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z",
    agenda: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h3M8 17h6",
    external: "M14 4h6v6M20 4l-9 9M18 14v5H5V6h5",
    link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
    expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    plus: "M12 5v14M5 12h14",
    up: "M12 19V5M6 11l6-6 6 6",
    down: "M12 5v14M18 13l-6 6-6-6",
    gear: "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19 12l2-1-2-4-2 .5-1.5-1L15 4h-6l-.5 2.5-1.5 1L5 7l-2 4 2 1v2l-2 1 2 4 2-.5 1.5 1L9 22h6l.5-2.5 1.5-1 2 .5 2-4-2-1z",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
  };
  const SKY = {
    clear: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    partly: "M8 3v1.5M3.6 5.6l1 1M2 10h1.5M12.4 6.6l1-1M5 10a3 3 0 0 1 5.7-1.3M8 20h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13.5 3.3 3.3 0 0 0 8 20Z",
    cloudy: ICONS.weather,
    fog: "M4 9h16M3 13h18M5 17h14M7 5h10",
    drizzle: "M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14ZM9 17l-.5 1.5M13 17l-.5 1.5M17 17l-.5 1.5",
    rain: "M7 13h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 4.5 4.3 4.3 0 0 0 7 13ZM8 16l-1 3M12 16l-1 3M16 16l-1 3",
    snow: "M7 13h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 4.5 4.3 4.3 0 0 0 7 13ZM8 17h.01M12 19h.01M16 17h.01M10 21h.01M14 21h.01",
    storm: "M7 13h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 4.5 4.3 4.3 0 0 0 7 13ZM12 14l-2 4h3l-2 4"
  };

  // Names for the sounds and the kinds of sky, as the message keys spell them.
  const SOUND_NAMES = {
    rain: () => say("dash.sound.rain", "Rain"), ocean: () => say("dash.sound.ocean", "Ocean"), brown: () => say("dash.sound.brown", "Deep noise"),
    wind: () => say("dash.sound.wind", "Wind"), aurora: () => say("dash.sound.aurora", "Aurora pad")
  };
  const SKY_NAMES = {
    clear: () => say("dash.sky.clear", "Clear"), partly: () => say("dash.sky.partly", "Partly cloudy"), cloudy: () => say("dash.sky.cloudy", "Cloudy"),
    fog: () => say("dash.sky.fog", "Fog"), drizzle: () => say("dash.sky.drizzle", "Drizzle"), rain: () => say("dash.sky.rain", "Rain"),
    snow: () => say("dash.sky.snow", "Snow"), storm: () => say("dash.sky.storm", "Thunderstorm")
  };
  const skyName = (kind) => (SKY_NAMES[kind] || SKY_NAMES.cloudy)();

  /* Public-domain lines, one a day. */
  const QUOTES = [
    ["The secret of getting ahead is getting started.", "Mark Twain"],
    ["Well begun is half done.", "Aristotle"],
    ["It is not that we have a short time to live, but that we waste a lot of it.", "Seneca"],
    ["You have power over your mind, not outside events. Realize this, and you will find strength.", "Marcus Aurelius"],
    ["The journey of a thousand miles begins with one step.", "Lao Tzu"],
    ["Do not wait to strike till the iron is hot; but make it hot by striking.", "William Butler Yeats"],
    ["Nothing will work unless you do.", "Maya Angelou"],
    ["Simplicity is the ultimate sophistication.", "Leonardo da Vinci"],
    ["Our life is frittered away by detail. Simplify, simplify.", "Henry David Thoreau"],
    ["Energy and persistence conquer all things.", "Benjamin Franklin"],
    ["What you do today can improve all your tomorrows.", "Ralph Marston"],
    ["To live is the rarest thing in the world. Most people exist, that is all.", "Oscar Wilde"],
    ["The best way out is always through.", "Robert Frost"],
    ["Do what you can, with what you have, where you are.", "Theodore Roosevelt"],
    ["Waste no more time arguing what a good man should be. Be one.", "Marcus Aurelius"],
    ["He who has a why to live can bear almost any how.", "Friedrich Nietzsche"],
    ["Luck is what happens when preparation meets opportunity.", "Seneca"],
    ["It does not matter how slowly you go as long as you do not stop.", "Confucius"],
    ["Knowing is not enough; we must apply.", "Johann Wolfgang von Goethe"],
    ["Little by little, one travels far.", "J. R. R. Tolkien"],
    ["An unhurried sense of time is in itself a form of wealth.", "Bonnie Friedman"],
    ["Rest is not idleness.", "John Lubbock"],
    ["Adopt the pace of nature: her secret is patience.", "Ralph Waldo Emerson"],
    ["Quality is not an act, it is a habit.", "Aristotle"],
    ["The mind is everything. What you think you become.", "Buddha"],
    ["Begin at once to live.", "Seneca"],
    ["Wherever you are, be all there.", "Jim Elliot"],
    ["Great things are done by a series of small things brought together.", "Vincent van Gogh"],
    ["Action is the foundational key to all success.", "Pablo Picasso"],
    ["The present moment always will have been.", "Seneca"]
  ];

  /* ── The cards ──────────────────────────────────────────────────
     Each type: its name, how wide it starts, what it keeps, and how it
     draws. draw(card) is called once; card.update() redraws the parts that
     change. Everything that reads the time asks card.now(). */
  const TYPES = {
    focus: {
      name: () => say("dash.focus", "Focus of the day"), size: 2,
      data: () => K.focus.create(),
      draw(card) {
        const body = card.body;
        const render = () => {
          const today = K.focus.today(card.data, card.now());
          if (!today) {
            const input = el("input", { type: "text", class: "dash-input dash-focus-input", maxlength: "140", placeholder: say("dash.focusAsk", "What matters most today?"), "aria-label": say("dash.focusAsk", "What matters most today?") });
            input.addEventListener("keydown", (event) => {
              if (event.key !== "Enter" || !input.value.trim()) return;
              K.focus.set(card.data, input.value, card.now());
              card.save();
              render();
              body.querySelector(".dash-focus-check")?.focus();
            });
            body.replaceChildren(el("p", { class: "dash-focus-greet", text: card.greeting() }), input);
            return;
          }
          const check = el("input", { type: "checkbox", class: "dash-check dash-focus-check", "aria-label": say("dash.focusDone", "Done") });
          check.checked = today.done;
          check.addEventListener("change", () => { K.focus.finish(card.data, check.checked, card.now()); card.save(); render(); });
          body.replaceChildren(
            el("p", { class: `dash-focus-note${today.done ? " is-done" : ""}`, text: today.done ? say("dash.focusWell", "Done. Nicely.") : say("dash.focusToday", "Today") }),
            el("div", { class: `dash-focus${today.done ? " is-done" : ""}` }, [
              check,
              el("span", { class: "dash-focus-text", text: today.text, title: today.text }),
              el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.focusClear", "Change the focus"), title: say("dash.focusClear", "Change the focus"), onclick: () => { K.focus.clear(card.data); card.save(); render(); body.querySelector("input")?.focus(); } }, icon(ICONS.close))
            ])
          );
        };
        card.update = render;
        render();
      }
    },

    tasks: {
      name: () => say("dash.tasks", "Tasks"), size: 1,
      data: () => K.tasks.create(),
      draw(card) {
        const dash = card.app.dashboard;
        const VIEWS = [
          ["all", () => say("dash.viewAll", "All")], ["today", () => say("dash.viewToday", "Today")],
          ["upcoming", () => say("dash.viewLater", "Later")], ["done", () => say("dash.viewDone", "Done")]
        ];
        let view = card.data.view || "all";
        let open = null;
        const tabs = el("div", { class: "dash-tabs", role: "tablist", "aria-label": card.title() });
        const list = el("ul", { class: "dash-tasks", "aria-label": card.title() });
        const input = el("input", { type: "text", class: "dash-input", maxlength: String(K.tasks.MAX_TEXT), placeholder: say("dash.taskAdd", "Add a task"), "aria-label": say("dash.taskAdd", "Add a task"), title: say("dash.taskAddHint", "Try “tomorrow”, “on friday” or “!” for important") });
        const hint = el("span", { class: "dash-task-hint", "aria-live": "polite" });
        const foot = el("div", { class: "dash-foot" });
        const now = () => card.now();
        const save = () => { card.save(); render(); };
        const dueLabel = (task) => {
          const state = K.tasks.state(task, now());
          if (state === "none") return "";
          if (state === "today") return say("dash.dueToday", "Today");
          if (task.due === K.tasks.shift(now(), 1)) return say("dash.dueTomorrow", "Tomorrow");
          const date = new Date(`${task.due}T12:00`);
          const soon = Math.abs(date - now()) < 6 * 86400000;
          return new Intl.DateTimeFormat(locale(), soon ? { weekday: "short" } : { day: "numeric", month: "short" }).format(date);
        };
        input.addEventListener("input", () => {
          const parsed = K.tasks.parse(input.value, now());
          const parts = [];
          if (parsed.due) parts.push(dueLabel({ due: parsed.due }));
          if (parsed.priority) parts.push(say("dash.important", "Important"));
          hint.textContent = parts.join(" · ");
        });
        input.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          const parsed = K.tasks.parse(input.value, now());
          // Added in the Today view, a task with no date is for today.
          const due = parsed.due || (view === "today" ? K.tasks.shift(now(), 0) : null);
          if (K.tasks.add(card.data, parsed.text, now(), { due, priority: parsed.priority })) { input.value = ""; hint.textContent = ""; save(); }
        });
        const setView = (next) => { view = next; card.data.view = next; card.save({ soon: true }); render(); };
        const dateMenu = (task, opener) => dash.popup(opener, [
          { label: say("dash.dueToday", "Today"), run: () => { K.tasks.setDue(card.data, task.id, K.tasks.shift(now(), 0)); save(); } },
          { label: say("dash.dueTomorrow", "Tomorrow"), run: () => { K.tasks.setDue(card.data, task.id, K.tasks.shift(now(), 1)); save(); } },
          { label: say("dash.dueNextWeek", "Next week"), run: () => { K.tasks.setDue(card.data, task.id, K.tasks.shift(now(), 7)); save(); } },
          task.due ? { label: say("dash.dueNone", "No date"), run: () => { K.tasks.setDue(card.data, task.id, null); save(); } } : null
        ], say("dash.dueMenu", "When"));

        /* Carrying a task up or down the list by hand. */
        const carry = (event, row, task) => {
          if (event.button !== 0 || view === "done" || event.target.closest("button, input")) return;
          const startY = event.clientY;
          let active = false, target = null;
          const rows = () => [...list.querySelectorAll(".dash-task:not(.is-done)")];
          const move = (e) => {
            const dy = e.clientY - startY;
            if (!active && Math.abs(dy) < 5) return;
            if (!active) { active = true; row.classList.add("is-carried"); list.classList.add("is-sorting"); }
            row.style.transform = `translateY(${dy}px)`;
            const others = rows().filter((r) => r !== row);
            target = others.findIndex((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
            others.forEach((r, i) => r.classList.toggle("is-before", target === i));
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            if (!active) return;
            const order = rows().filter((r) => r !== row).map((r) => r.dataset.id);
            const beforeId = target >= 0 ? order[target] : null;
            const ids = card.data.items.map((t) => t.id).filter((id) => id !== task.id);
            const at = beforeId ? ids.indexOf(beforeId) : ids.length;
            K.tasks.move(card.data, task.id, at < 0 ? ids.length : at);
            save();
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        };

        const renderTask = (task) => {
          const check = el("input", { type: "checkbox", class: "dash-check", "aria-label": task.text });
          check.checked = task.done;
          check.addEventListener("change", () => { K.tasks.toggle(card.data, task.id, now()); save(); });
          const text = el("span", { class: "dash-task-text", text: task.text, tabindex: "0", title: say("dash.taskEdit", "Double-click to edit") });
          const edit = () => {
            const field = el("input", { type: "text", class: "dash-input dash-task-edit", value: task.text, maxlength: String(K.tasks.MAX_TEXT), "aria-label": say("dash.taskEdit", "Edit the task") });
            let finished = false;
            const finish = (keep) => {
              if (finished) return;
              finished = true;
              if (keep) { K.tasks.edit(card.data, task.id, field.value); card.save(); }
              render();
            };
            field.addEventListener("keydown", (event) => {
              if (event.key === "Enter") finish(true);
              if (event.key === "Escape") { event.stopPropagation(); finish(false); }
            });
            field.addEventListener("blur", () => finish(true));
            text.replaceWith(field);
            field.focus();
            field.select();
          };
          text.addEventListener("dblclick", edit);
          text.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "F2") { event.preventDefault(); edit(); }
            if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
              event.preventDefault();
              const index = card.data.items.findIndex((t) => t.id === task.id);
              K.tasks.move(card.data, task.id, index + (event.key === "ArrowUp" ? -1 : 1));
              save();
              list.querySelector(`[data-id="${task.id}"] .dash-task-text`)?.focus();
            }
          });
          const due = dueLabel(task);
          const progress = K.tasks.progress(task);
          const meta = el("span", { class: "dash-task-meta" }, [
            task.priority ? el("span", { class: "dash-task-flag", title: say("dash.important", "Important") }, icon(ICONS.flag)) : null,
            due ? el("span", { class: `dash-task-due is-${K.tasks.state(task, now())}`, text: due }) : null,
            progress.total ? el("span", { class: "dash-task-subs", text: `${progress.done}/${progress.total}` }) : null
          ]);
          const expanded = open === task.id;
          const row = el("li", { class: `dash-task${task.done ? " is-done" : ""}${task.priority ? " is-important" : ""}${expanded ? " is-open" : ""}`, dataset: { id: task.id } }, [
            el("div", { class: "dash-task-row" }, [
              check,
              el("span", { class: "dash-task-main" }, [text, meta.childNodes.length ? meta : null]),
              el("span", { class: "dash-task-actions" }, [
                el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.taskMore", "Steps and details: {task}", { task: task.text }), "aria-expanded": String(expanded), onclick: () => { open = expanded ? null : task.id; render(); } }, icon(ICONS.chevron)),
                el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.dueMenu", "When"), title: say("dash.dueMenu", "When"), onclick: (e) => dateMenu(task, e.currentTarget) }, icon(ICONS.calendar)),
                el("button", { type: "button", class: `dash-icon-btn${task.priority ? " is-on" : ""}`, "aria-pressed": String(Boolean(task.priority)), "aria-label": say("dash.important", "Important"), title: say("dash.important", "Important"), onclick: () => { K.tasks.setPriority(card.data, task.id, !task.priority); save(); } }, icon(ICONS.flag)),
                el("button", { type: "button", class: "dash-icon-btn dash-task-remove", "aria-label": say("dash.taskRemove", "Remove {task}", { task: task.text }), onclick: () => { K.tasks.remove(card.data, task.id); save(); } }, icon(ICONS.close))
              ])
            ])
          ]);
          if (expanded) {
            const subs = el("ul", { class: "dash-subs" }, (task.subs || []).map((sub) => {
              const box = el("input", { type: "checkbox", class: "dash-check dash-check-small", "aria-label": sub.text });
              box.checked = sub.done;
              box.addEventListener("change", () => { K.tasks.toggleSub(card.data, task.id, sub.id); save(); });
              return el("li", { class: sub.done ? "is-done" : "" }, [box, el("span", { text: sub.text }),
                el("button", { type: "button", class: "dash-icon-btn dash-task-remove", "aria-label": say("dash.taskRemove", "Remove {task}", { task: sub.text }), onclick: () => { K.tasks.removeSub(card.data, task.id, sub.id); save(); } }, icon(ICONS.close))]);
            }));
            const addSub = el("input", { type: "text", class: "dash-input dash-sub-add", placeholder: say("dash.subAdd", "Add a step"), "aria-label": say("dash.subAdd", "Add a step"), maxlength: String(K.tasks.MAX_TEXT) });
            addSub.addEventListener("keydown", (event) => {
              if (event.key === "Enter" && K.tasks.addSub(card.data, task.id, addSub.value, now())) { save(); list.querySelector(".dash-sub-add")?.focus(); }
              if (event.key === "Escape") { event.stopPropagation(); open = null; render(); }
            });
            row.append(el("div", { class: "dash-task-details" }, [subs, addSub]));
          }
          row.addEventListener("pointerdown", (event) => carry(event, row, task));
          return row;
        };

        const render = () => {
          const counts = Object.fromEntries(VIEWS.map(([key]) => [key, K.tasks.filter(card.data, key, now()).filter((t) => key === "done" || !t.done).length]));
          tabs.replaceChildren(...VIEWS.map(([key, name]) => el("button", {
            type: "button", role: "tab", class: "dash-tab", "aria-selected": String(view === key), tabindex: view === key ? "0" : "-1", onclick: () => setView(key)
          }, [el("span", { text: name() }), counts[key] && key !== "done" ? el("small", { text: String(counts[key]) }) : null])));
          const shown = K.tasks.filter(card.data, view, now());
          const empty = { all: say("dash.tasksEmpty", "Nothing on the list"), today: say("dash.todayEmpty", "Nothing due today"), upcoming: say("dash.laterEmpty", "Nothing planned ahead"), done: say("dash.doneEmpty", "Nothing ticked off yet") }[view];
          list.replaceChildren(...(shown.length ? shown.map(renderTask) : [el("li", { class: "dash-tasks-empty", text: empty })]));
          fadeWhenMore(list);
          const left = K.tasks.filter(card.data, "all", now()).filter((t) => !t.done).length;
          const doneCount = card.data.items.filter((t) => t.done).length;
          foot.hidden = !card.data.items.length;
          foot.replaceChildren(...[
            el("span", { text: say("dash.tasksLeft", "{count} to do", { count: left }) }),
            doneCount ? el("button", { type: "button", class: "dash-link", text: say("dash.tasksClear", "Clear done"), onclick: () => { K.tasks.clearDone(card.data); save(); } }) : null
          ].filter(Boolean));
          input.parentElement.hidden = view === "done";
        };
        tabs.addEventListener("keydown", (event) => {
          const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
          if (!step) return;
          const keys = VIEWS.map(([key]) => key);
          setView(keys[(keys.indexOf(view) + step + keys.length) % keys.length]);
          tabs.querySelector('[aria-selected="true"]')?.focus();
        });
        card.update = render;
        card.body.replaceChildren(tabs, list, el("label", { class: "dash-task-new" }, [icon(ICONS.plus), input, hint]), foot);
        render();
      }
    },

    habits: {
      name: () => say("dash.habits", "Habits"), size: 1,
      data: () => K.habits.create(),
      draw(card) {
        const list = el("ul", { class: "dash-habits", "aria-label": card.title() });
        const input = el("input", { type: "text", class: "dash-input", maxlength: "60", placeholder: say("dash.habitAdd", "Add a habit"), "aria-label": say("dash.habitAdd", "Add a habit") });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && K.habits.add(card.data, input.value)) { input.value = ""; card.save(); render(); }
        });
        const weekday = (day) => new Intl.DateTimeFormat(locale(), { weekday: "narrow" }).format(new Date(`${day}T12:00`));
        const long = (day) => new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00`));
        const render = () => {
          const now = card.now();
          const days = K.habits.week({ days: [] }, now).map((d) => d.day);
          const head = el("li", { class: "dash-habit dash-habit-head", "aria-hidden": "true" }, [
            el("span", { class: "dash-habit-name" }),
            el("span", { class: "dash-habit-week" }, days.map((day, i) => el("span", { class: i === 6 ? "is-today" : "", text: weekday(day) }))),
            el("span", { class: "dash-habit-streak" })
          ]);
          const rows = card.data.items.map((habit) => {
            const streak = K.habits.streak(habit, now);
            return el("li", { class: "dash-habit", dataset: { id: habit.id } }, [
              el("span", { class: "dash-habit-name", text: habit.name, title: habit.name }),
              el("span", { class: "dash-habit-week", role: "group", "aria-label": habit.name }, K.habits.week(habit, now).map(({ day, done }, i) => el("button", {
                type: "button", class: `dash-habit-day${done ? " is-done" : ""}${i === 6 ? " is-today" : ""}`,
                "aria-pressed": String(done), "aria-label": `${habit.name}: ${long(day)}`, title: long(day),
                onclick: () => { K.habits.toggle(card.data, habit.id, day); card.save(); render(); list.querySelector(`[data-id="${habit.id}"] .dash-habit-day:nth-child(${i + 1})`)?.focus(); }
              }))),
              el("span", { class: `dash-habit-streak${streak ? " is-on" : ""}`, title: say("dash.habitStreak", "{days} days in a row", { days: streak }) }, streak ? [icon(ICONS.flame), el("b", { text: String(streak) })] : []),
              el("button", { type: "button", class: "dash-icon-btn dash-task-remove", "aria-label": say("dash.taskRemove", "Remove {task}", { task: habit.name }), onclick: () => { K.habits.remove(card.data, habit.id); card.save(); render(); } }, icon(ICONS.close))
            ]);
          });
          list.replaceChildren(...(rows.length ? [head, ...rows] : [el("li", { class: "dash-tasks-empty", text: say("dash.habitsEmpty", "A habit a day: add one below") })]));
          fadeWhenMore(list);
        };
        card.update = render;
        card.body.replaceChildren(list, el("label", { class: "dash-task-new" }, [icon(ICONS.plus), input]));
        render();
      }
    },

    stash: {
      name: () => say("dash.stash", "Tab stash"), size: 1,
      data: () => K.stash.create(),
      draw(card) {
        const api = () => (typeof chrome !== "undefined" ? chrome : null);
        const self = (() => { try { return api()?.runtime?.getURL?.("") || location.origin; } catch (error) { return location.origin; } })();
        let open = null;
        /* The browser's own icon for a page where there is one (an extension
           page with the favicon permission); its first letter otherwise. */
        const letter = (url) => { let host = ""; try { host = new URL(url).hostname.replace(/^www./, ""); } catch (error) {} return el("span", { class: "dash-stash-icon is-letter", "aria-hidden": "true", dataset: { letter: (host[0] || "?").toUpperCase() } }); };
        const favicon = (url) => {
          if (location.protocol !== "chrome-extension:") return letter(url);
          const img = el("img", { class: "dash-stash-icon", alt: "", width: "16", height: "16", loading: "lazy" });
          img.src = api().runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
          img.addEventListener("error", () => img.replaceWith(letter(url)));
          return img;
        };
        // Asked for when first used, from the click that needs it.
        const allowed = () => new Promise((resolve) => {
          const perms = api()?.permissions;
          if (!perms?.request) { resolve(Boolean(api()?.tabs)); return; }
          perms.request({ permissions: ["tabs"] }, (granted) => resolve(Boolean(granted)));
        });
        const openTab = (url) => { try { api()?.tabs?.create?.({ url, active: false }); } catch (error) { window.open(url, "_blank", "noopener"); } };
        const put = el("button", { type: "button", class: "dash-cta dash-stash-put" }, [icon(ICONS.stash), el("span", { text: say("dash.stashPut", "Stash the tabs of this window") })]);
        put.addEventListener("click", async () => {
          if (!(await allowed()) || !api()?.tabs?.query) {
            window.NordlysUI?.announce?.(say("dash.stashNeeds", "Nordlys needs to see your tabs to put them away."));
            if (typeof toast === "function") toast(say("dash.stashNeeds", "Nordlys needs to see your tabs to put them away."), "info", 4000);
            return;
          }
          api().tabs.query({ currentWindow: true }, (tabs) => {
            const picked = K.stash.pick(tabs || [], self);
            const group = K.stash.add(card.data, picked, card.now());
            if (!group) { if (typeof toast === "function") toast(say("dash.stashNothing", "No other tabs to put away"), "info", 3000); return; }
            card.save();
            render();
            api().tabs.remove(picked.map((tab) => tab.id), () => {});
            window.NordlysUI?.showUndoToast?.({
              message: say("dash.stashDone", "{count} tabs put away", { count: group.tabs.length }),
              onAction: () => { group.tabs.forEach((tab) => openTab(tab.url)); K.stash.remove(card.data, group.id); card.save(); render(); }
            });
          });
        });
        const list = el("ul", { class: "dash-stash" });
        const when = (at) => {
          const minutes = Math.round((card.now() - at) / 60000);
          const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
          if (minutes < 60) return rtf.format(-minutes, "minute");
          if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), "hour");
          return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(at);
        };
        const render = () => {
          const groups = card.data.groups;
          list.replaceChildren(...(groups.length ? groups.map((group) => {
            const expanded = open === group.id;
            const row = el("li", { class: `dash-stash-group${expanded ? " is-open" : ""}` }, [
              el("div", { class: "dash-stash-head" }, [
                el("button", { type: "button", class: "dash-stash-toggle", "aria-expanded": String(expanded), onclick: () => { open = expanded ? null : group.id; render(); } }, [
                  el("span", { class: "dash-stash-icons", "aria-hidden": "true" }, group.tabs.slice(0, 4).map((tab) => favicon(tab.url))),
                  el("span", { class: "dash-stash-count", text: say("dash.stashCount", "{count} tabs", { count: group.tabs.length }) }),
                  el("small", { text: when(group.at) })
                ]),
                el("button", { type: "button", class: "dash-link", text: say("dash.stashOpenAll", "Open all"), onclick: () => { group.tabs.forEach((tab) => openTab(tab.url)); K.stash.remove(card.data, group.id); card.save(); render(); } }),
                el("button", { type: "button", class: "dash-icon-btn dash-task-remove", "aria-label": say("dash.stashForget", "Forget these tabs"), title: say("dash.stashForget", "Forget these tabs"), onclick: () => { K.stash.remove(card.data, group.id); card.save(); render(); } }, icon(ICONS.close))
              ])
            ]);
            if (expanded) row.append(el("ul", { class: "dash-stash-tabs" }, group.tabs.map((tab) => el("li", {}, el("button", {
              type: "button", class: "dash-stash-tab", title: tab.url,
              onclick: () => { openTab(tab.url); K.stash.take(card.data, group.id, tab.url); card.save(); render(); }
            }, [favicon(tab.url), el("span", { text: tab.title })])))));
            return row;
          }) : [el("li", { class: "dash-tasks-empty", text: say("dash.stashEmpty", "Put a window of tabs away and come back to it later.") })]));
          fadeWhenMore(list);
        };
        card.update = render;
        card.body.replaceChildren(put, list);
        render();
      }
    },

    ai: {
      name: () => say("dash.ai", "Ask"), size: 1,
      data: () => ({ messages: [] }),
      draw(card) {
        const dash = card.app.dashboard;
        const AI = window.NordlysAI;
        const log = el("div", { class: "dash-ai-log", role: "log", "aria-live": "polite", "aria-label": card.title() });
        const input = el("textarea", { class: "dash-input dash-ai-input", rows: "1", maxlength: "4000", placeholder: say("dash.aiAsk", "Ask anything"), "aria-label": say("dash.aiAsk", "Ask anything") });
        const send = el("button", { type: "button", class: "dash-round-btn accent dash-ai-send", "aria-label": say("dash.aiSend", "Send") }, icon(ICONS.send));
        const status = el("p", { class: "dash-ai-status" });
        let controller = null;
        // Words only: whatever the model says is text, never markup.
        const rich = (text) => {
          const box = el("div", { class: "dash-ai-text" });
          const parts = String(text).split(/```/);
          parts.forEach((part, i) => {
            if (i % 2) { box.append(el("pre", {}, el("code", { text: part.replace(/^\w*\n/, "") }))); return; }
            for (const para of part.split(/\n{2,}/)) {
              const trimmed = para.trim();
              if (!trimmed) continue;
              const lines = trimmed.split("\n");
              if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
                box.append(el(/^\s*\d/.test(lines[0]) ? "ol" : "ul", {}, lines.map((l) => el("li", {}, inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))))));
              } else box.append(el("p", {}, inline(trimmed)));
            }
          });
          return box;
        };
        const inline = (text) => text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean).map((bit) => {
          if (bit.startsWith("`") && bit.endsWith("`")) return el("code", { text: bit.slice(1, -1) });
          if (bit.startsWith("**") && bit.endsWith("**")) return el("strong", { text: bit.slice(2, -2) });
          return document.createTextNode(bit);
        });
        const render = () => {
          const messages = card.data.messages || [];
          const setup = dash.aiSetup;
          if (!messages.length) {
            log.replaceChildren(el("div", { class: "dash-ai-empty" }, [
              el("p", { text: setup ? say("dash.aiHello", "Ask a question, get a plain answer. {model}", { model: AI.PROVIDERS[setup.provider]?.name || "" }) : say("dash.aiNone", "Choose a model to talk to: the one in Chrome, your own key, or one on your computer.") }),
              setup ? null : el("button", { type: "button", class: "dash-cta", onclick: () => card.openSettings() }, [icon(ICONS.gear), el("span", { text: say("dash.aiChoose", "Choose a model") })])
            ]));
          } else {
            log.replaceChildren(...messages.map((m, i) => el("div", { class: `dash-ai-msg is-${m.role}${m.error ? " is-error" : ""}` }, [
              m.role === "assistant" ? rich(m.content) : el("p", { class: "dash-ai-text", text: m.content }),
              m.role === "assistant" && !m.error && m.content ? el("div", { class: "dash-ai-actions" }, [
                el("button", { type: "button", class: "dash-link", text: say("dash.aiCopy", "Copy"), onclick: () => navigator.clipboard?.writeText(m.content).then(() => window.NordlysUI?.announce?.(say("dash.aiCopied", "Copied"))) }),
                el("button", { type: "button", class: "dash-link", text: say("dash.aiTask", "Make it a task"), onclick: () => dash.addTask(m.content.split("\n")[0].replace(/[*#`]/g, "").slice(0, 200)) })
              ]) : null,
              i === messages.length - 1 && controller ? el("span", { class: "dash-ai-typing", "aria-hidden": "true" }, [el("i"), el("i"), el("i")]) : null
            ])));
          }
          log.scrollTop = log.scrollHeight;
          send.replaceChildren(icon(controller ? ICONS.stopSquare : ICONS.send));
          send.setAttribute("aria-label", controller ? say("dash.aiStop", "Stop") : say("dash.aiSend", "Send"));
        };
        card.ask = async (question) => {
          const text = String(question || "").trim();
          if (!text) return;
          const setup = dash.aiSetup;
          if (!setup) { card.openSettings(); return; }
          const messages = (card.data.messages ||= []);
          messages.push({ role: "user", content: text });
          const answer = { role: "assistant", content: "" };
          messages.push(answer);
          if (messages.length > 40) messages.splice(0, messages.length - 40);
          controller = new AbortController();
          render();
          const system = `You are a helpful assistant on a browser new tab page called Nordlys. Answer plainly and briefly unless asked for more. Today is ${new Date().toDateString()}. Answer in the language of the question.`;
          let painted = 0;
          try {
            await AI.ask(setup, messages.slice(0, -1), {
              system, signal: controller.signal,
              onText: (piece) => {
                answer.content += piece;
                // Redraw at most a few times a second: the words arrive faster than that.
                const now = performance.now();
                if (now - painted > 90) { painted = now; render(); }
              }
            });
          } catch (error) {
            if (error.name !== "AbortError") { answer.error = true; answer.content = error.message || String(error); }
          } finally {
            controller = null;
            card.save();
            render();
          }
        };
        const go = () => {
          if (controller) { controller.abort(); return; }
          const text = input.value;
          input.value = "";
          input.style.height = "";
          card.ask(text);
        };
        send.addEventListener("click", go);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); go(); }
        });
        input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = `${Math.min(120, input.scrollHeight)}px`; });
        const clear = el("button", { type: "button", class: "dash-link", text: say("dash.aiClear", "New conversation"), onclick: () => { card.data.messages = []; card.save(); render(); input.focus(); } });
        card.update = render;
        card.body.replaceChildren(log, el("div", { class: "dash-ai-row" }, [input, send]), el("div", { class: "dash-foot" }, [status, clear]));
        render();
      }
    },

    inbox: {
      name: () => say("dash.inbox", "From your apps"), size: 1,
      data: () => ({ items: [], errors: {}, at: 0, filter: "" }),
      settings: [{ key: "sources", type: "sources", kind: "tasks", value: null, label: () => say("dash.inboxSources", "Show tasks from") }],
      draw(card) {
        const dash = card.app.dashboard;
        const C = window.NordlysConnectors;
        const chips = el("div", { class: "dash-tabs dash-source-chips", role: "tablist", "aria-label": say("dash.inboxSources", "Show tasks from") });
        const list = el("div", { class: "dash-inbox" });
        const foot = el("div", { class: "dash-foot" });
        const sources = () => dash.sourcesFor(card.settings.sources, "tasks");
        const refresh = async (force = false) => {
          if (!sources().length) { render(); return; }
          if (card.loading || (!force && Date.now() - (card.data.at || 0) < 5 * 60e3)) return;
          card.loading = true;
          render();
          const { items, errors } = await dash.pull(sources());
          card.loading = false;
          card.data = { ...card.data, items, errors, at: Date.now() };
          card.save();
          render();
        };
        const groupOf = (it) => {
          if (!it.due) return "later";
          const today = K.dayOf(card.now());
          return it.due < today ? "overdue" : it.due === today ? "today" : it.due <= K.tasks.shift(card.now(), 7) ? "week" : "later";
        };
        const GROUPS = [["overdue", () => say("dash.groupOverdue", "Overdue")], ["today", () => say("dash.dueToday", "Today")], ["week", () => say("dash.groupWeek", "This week")], ["later", () => say("dash.groupLater", "Later")]];
        const dueText = (it) => {
          if (!it.due) return "";
          if (it.due === K.dayOf(card.now())) return say("dash.dueToday", "Today");
          if (it.due === K.tasks.shift(card.now(), 1)) return say("dash.dueTomorrow", "Tomorrow");
          return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(new Date(`${it.due}T12:00`));
        };
        const row = (it) => {
          const connector = C.CONNECTORS[it.source];
          const canTick = Boolean(connector?.complete);
          const open = () => { if (it.url) window.open(it.url, "_blank", "noopener"); };
          const tick = el("input", { type: "checkbox", class: "dash-check", "aria-label": say("dash.inboxDone", "Done in {app}: {task}", { app: connector?.name || "", task: it.title }) });
          tick.addEventListener("change", async () => {
            tick.disabled = true;
            try {
              await dash.completeRemote(it);
              card.data.items = card.data.items.filter((x) => x.id !== it.id);
              card.save();
              window.NordlysUI?.announce?.(say("dash.inboxTicked", "Marked done in {app}", { app: connector.name }));
              render();
            } catch (error) {
              tick.checked = false; tick.disabled = false;
              if (typeof toast === "function") toast(`${connector.name}: ${error.message}`, "danger", 4000);
            }
          });
          return el("div", { class: `dash-inbox-row${it.priority ? " is-important" : ""}`, dataset: { id: it.id } }, [
            canTick ? tick : el("span", { class: "dash-brand-dot", style: `--brand:${connector?.color || "#888"}`, "aria-hidden": "true" }),
            el("span", { class: "dash-task-main" }, [
              el("a", { class: "dash-inbox-title", href: it.url || "#", target: "_blank", rel: "noopener", text: it.title, onclick: (e) => { if (!it.url) e.preventDefault(); } }),
              el("span", { class: "dash-task-meta" }, [
                dash.brandIcon(it.source, 11),
                el("span", { text: [connector?.name, it.context].filter(Boolean).join(" · ") }),
                it.due ? el("span", { class: `dash-task-due is-${K.tasks.state({ due: it.due }, card.now())}`, text: dueText(it) }) : null
              ])
            ]),
            canTick ? null : el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.inboxOpen", "Open in {app}", { app: connector?.name || "" }), title: say("dash.inboxOpen", "Open in {app}", { app: connector?.name || "" }), onclick: open }, icon(ICONS.external))
          ]);
        };
        const render = () => {
          const ids = sources();
          if (!ids.length) {
            chips.replaceChildren();
            list.replaceChildren(el("div", { class: "dash-ai-empty" }, [
              el("p", { text: say("dash.inboxEmpty", "Tasks from Todoist, GitHub, Trello, Asana, Linear, Jira and more, in one list.") }),
              el("button", { type: "button", class: "dash-cta", onclick: (e) => dash.openConnectPicker(e.currentTarget, "tasks") }, [icon(ICONS.plus), el("span", { text: say("dash.connectApp", "Connect an app") })])
            ]));
            foot.replaceChildren();
            return;
          }
          const filter = ids.includes(card.data.filter) ? card.data.filter : "";
          chips.replaceChildren(...[["", say("dash.viewAll", "All")], ...ids.map((id) => [id, C.CONNECTORS[id].name])].map(([id, name]) => el("button", {
            type: "button", role: "tab", class: "dash-tab", "aria-selected": String(filter === id), tabindex: filter === id ? "0" : "-1", title: name,
            onclick: () => { card.data.filter = id; card.save({ soon: true }); render(); }
          }, id ? [dash.brandIcon(id, 12), el("span", { class: "nl-visually-hidden", text: name })] : [el("span", { text: say("dash.viewAll", "All") })])));
          const items = (card.data.items || []).filter((it) => ids.includes(it.source) && (!filter || it.source === filter));
          const groups = GROUPS.map(([key, name]) => [key, name, items.filter((it) => groupOf(it) === key)]).filter(([, , g]) => g.length);
          list.replaceChildren(...(groups.length ? groups.flatMap(([key, name, g]) => [el("h3", { class: `dash-inbox-group is-${key}`, text: name() }), ...g.map(row)]) : [el("p", { class: "dash-tasks-empty", text: card.loading ? say("dash.inboxLoading", "Looking…") : say("dash.inboxClear", "Nothing waiting. Nicely done.") })]));
          fadeWhenMore(list);
          const errors = Object.entries(card.data.errors || {}).filter(([id]) => ids.includes(id));
          foot.replaceChildren(...[
            errors.length ? el("button", { type: "button", class: "dash-link dash-inbox-error", text: `${C.CONNECTORS[errors[0][0]].name}: ${errors[0][1]}`, onclick: () => dash.openConnect(errors[0][0]) }) : el("span", { text: card.data.at ? say("dash.inboxAt", "Updated {time}", { time: new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit" }).format(card.data.at) }) : "" }),
            el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.refresh", "Refresh"), title: say("dash.refresh", "Refresh"), disabled: card.loading || undefined, onclick: () => refresh(true) }, icon(ICONS.reset))
          ]);
          card.root.classList.toggle("is-loading", Boolean(card.loading));
        };
        card.update = () => { render(); refresh(); };
        card.tick = () => { if (Date.now() - (card.data.at || 0) > 10 * 60e3) refresh(); };
        card.body.replaceChildren(chips, list, foot);
        render();
        refresh();
      }
    },

    agenda: {
      name: () => say("dash.agenda", "Calendar"), size: 1,
      data: () => ({ items: [], errors: {}, at: 0 }),
      settings: [{ key: "sources", type: "sources", kind: "events", value: null, label: () => say("dash.agendaSources", "Show events from") }],
      draw(card) {
        const dash = card.app.dashboard;
        const C = window.NordlysConnectors;
        const list = el("div", { class: "dash-agenda" });
        const foot = el("div", { class: "dash-foot" });
        const sources = () => dash.sourcesFor(card.settings.sources, "events");
        const refresh = async (force = false) => {
          if (!sources().length || card.loading || (!force && Date.now() - (card.data.at || 0) < 10 * 60e3)) { render(); return; }
          card.loading = true;
          const { items, errors } = await dash.pull(sources());
          card.loading = false;
          card.data = { items, errors, at: Date.now() };
          card.save();
          render();
        };
        const time = (iso) => new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit", hour12: card.app.config.timeFormat === "12h" }).format(new Date(iso));
        const dayName = (d) => {
          if (d === K.dayOf(card.now())) return say("dash.dueToday", "Today");
          if (d === K.tasks.shift(card.now(), 1)) return say("dash.dueTomorrow", "Tomorrow");
          return new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${d}T12:00`));
        };
        const render = () => {
          if (!sources().length) {
            list.replaceChildren(el("div", { class: "dash-ai-empty" }, [
              el("p", { text: say("dash.agendaEmpty", "Your next events, from Google Calendar or any calendar link (Outlook, iCloud, Proton).") }),
              el("button", { type: "button", class: "dash-cta", onclick: (e) => dash.openConnectPicker(e.currentTarget, "events") }, [icon(ICONS.plus), el("span", { text: say("dash.connectCalendar", "Connect a calendar") })])
            ]));
            foot.replaceChildren();
            return;
          }
          const now = card.now();
          const events = (card.data.items || []).filter((e) => sources().includes(e.source) && new Date(e.end || e.start).getTime() >= now - 60e3).sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 25);
          const byDay = new Map();
          for (const e of events) { const d = e.allDay ? String(e.start).slice(0, 10) : K.dayOf(new Date(e.start)); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(e); }
          const next = events.find((e) => !e.allDay && new Date(e.start).getTime() > now);
          list.replaceChildren(...(events.length ? [...byDay].flatMap(([d, es]) => [el("h3", { class: "dash-inbox-group", text: dayName(d) }), ...es.map((e) => {
            const live = !e.allDay && new Date(e.start).getTime() <= now && new Date(e.end || e.start).getTime() > now;
            return el("a", { class: `dash-event${live ? " is-now" : ""}${e === next ? " is-next" : ""}`, href: e.url || "#", target: "_blank", rel: "noopener", onclick: (ev) => { if (!e.url) ev.preventDefault(); } }, [
              el("span", { class: "dash-event-time", text: e.allDay ? say("dash.allDay", "All day") : time(e.start) }),
              el("span", { class: "dash-event-bar", style: `--brand:${C.CONNECTORS[e.source]?.color || "var(--accent)"}`, "aria-hidden": "true" }),
              el("span", { class: "dash-task-main" }, [el("span", { class: "dash-event-title", text: e.title }), e.where ? el("span", { class: "dash-task-meta", text: e.where }) : null])
            ]);
          })]) : [el("p", { class: "dash-tasks-empty", text: card.loading ? say("dash.inboxLoading", "Looking…") : say("dash.agendaFree", "Nothing on the calendar for two weeks.") })]));
          fadeWhenMore(list);
          const errors = Object.entries(card.data.errors || {});
          foot.replaceChildren(...[
            errors.length ? el("button", { type: "button", class: "dash-link dash-inbox-error", text: `${C.CONNECTORS[errors[0][0]].name}: ${errors[0][1]}`, onclick: () => dash.openConnect(errors[0][0]) }) : el("span"),
            el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.refresh", "Refresh"), title: say("dash.refresh", "Refresh"), onclick: () => refresh(true) }, icon(ICONS.reset))
          ]);
        };
        card.update = () => { render(); refresh(); };
        card.tick = () => { if (Date.now() - (card.data.at || 0) > 15 * 60e3) refresh(); else if (Date.now() % 60000 < 1000) render(); };
        card.body.replaceChildren(list, foot);
        render();
        refresh();
      }
    },

    notes: {
      name: () => say("dash.notes", "Note"), size: 1,
      data: () => ({ text: "" }),
      draw(card) {
        const area = el("textarea", { class: "dash-note", maxlength: "20000", placeholder: say("dash.noteHint", "Anything you want to keep in sight"), "aria-label": card.title(), spellcheck: "true" });
        area.value = card.data.text || "";
        area.addEventListener("input", () => { card.data.text = area.value; card.save({ soon: true }); });
        card.update = () => { if (document.activeElement !== area) area.value = card.data.text || ""; };
        card.body.replaceChildren(area);
      }
    },

    timer: {
      name: () => say("dash.timer", "Focus timer"), size: 1,
      // Every timer card and Focus mode are views of the one focus timer.
      shared: "focus-timer",
      data: (settings) => K.timer.create({ focus: settings?.focus || 25, rest: settings?.rest || 5 }),
      settings: [
        { key: "focus", type: "number", min: 1, max: 60, value: 25, label: () => say("dash.timerFocusMin", "Focus, minutes") },
        { key: "rest", type: "number", min: 1, max: 60, value: 5, label: () => say("dash.timerRestMin", "Break, minutes") },
        { key: "sound", type: "select", value: "", label: () => say("dash.timerSound", "Sound while focusing"), options: () => [["", say("dash.soundNone", "None")], ...(window.NordlysSoundscapes?.KINDS || []).filter((kind) => SOUND_NAMES[kind]).map((kind) => [kind, SOUND_NAMES[kind]()])] }
      ],
      applySettings(card) {
        const t = card.data;
        t.focus = Math.max(1, Math.min(60, Number(card.settings.focus) || 25));
        t.rest = Math.max(1, Math.min(60, Number(card.settings.rest) || 5));
        if (!t.running) t.left = K.timer.length(t);
      },
      draw(card) {
        const face = el("div", { class: "dash-timer-face", role: "timer", "aria-live": "off" });
        const phase = el("div", { class: "dash-timer-phase" });
        const go = el("button", { type: "button", class: "dash-round-btn accent" });
        const reset = el("button", { type: "button", class: "dash-round-btn", "aria-label": say("dash.timerReset", "Reset"), title: say("dash.timerReset", "Reset") }, icon(ICONS.reset));
        const whole = el("button", { type: "button", class: "dash-round-btn", "aria-label": say("focus.open", "Open focus mode"), title: say("focus.open", "Open focus mode"), onclick: () => card.app.focusMode?.show() }, icon(ICONS.expand));
        const dots = el("div", { class: "dash-timer-dots" });
        const sound = () => card.settings.sound;
        go.addEventListener("click", () => {
          const t = card.data;
          if (t.running) { K.timer.pause(t, card.now()); card.app.dashboard.sounds.stop(); }
          else {
            K.timer.start(t, card.now());
            if (t.phase === "focus" && sound()) card.app.dashboard.sounds.play(sound(), card.settings.volume ?? 0.5).catch(() => {});
          }
          card.save();
          render();
        });
        reset.addEventListener("click", () => { K.timer.reset(card.data); card.app.dashboard.sounds.stop(); card.save(); render(); });
        const render = () => {
          const t = card.data;
          const change = document.visibilityState === "visible" ? K.timer.tick(t, card.now()) : null;
          if (change) {
            card.save();
            card.app.dashboard.chime(change);
            if (change === "rest") card.app.dashboard.sounds.stop();
          }
          const left = K.timer.remaining(t, card.now());
          face.textContent = K.timer.face(left);
          phase.textContent = t.phase === "focus" ? say("dash.timerFocus", "Focus") : say("dash.timerRest", "Break");
          card.root.classList.toggle("is-running", t.running);
          card.root.classList.toggle("is-rest", t.phase === "rest");
          go.replaceChildren(icon(t.running ? ICONS.pause : ICONS.play));
          go.setAttribute("aria-label", t.running ? say("dash.timerPause", "Pause") : say("dash.timerStart", "Start"));
          const done = K.timer.sessions(t, card.now());
          dots.replaceChildren(...Array.from({ length: Math.max(4, done) }, (x, i) => el("i", { class: i < done ? "on" : "" })));
          dots.setAttribute("aria-label", say("dash.timerSessions", "{count} sessions today", { count: done }));
          card.root.style.setProperty("--progress", String(Math.max(0, Math.min(1, 1 - left / K.timer.length(t)))));
        };
        card.update = render;
        card.tick = render;
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        ring.setAttribute("viewBox", "0 0 112 112");
        ring.setAttribute("aria-hidden", "true");
        for (const name of ["track", "fill"]) {
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("class", name);
          circle.setAttribute("cx", "56"); circle.setAttribute("cy", "56"); circle.setAttribute("r", "50");
          circle.setAttribute("pathLength", "100");
          ring.append(circle);
        }
        card.body.replaceChildren(el("div", { class: "dash-timer" }, [
          el("div", { class: "dash-timer-ring" }, [ring, face]),
          el("div", { class: "dash-timer-side" }, [phase, el("div", { class: "dash-timer-controls" }, [go, reset, whole]), dots])
        ]));
        render();
      }
    },

    clocks: {
      name: () => say("dash.clocks", "World clocks"), size: 1,
      settings: [{ key: "zones", type: "zones", value: ["America/New_York", "Asia/Tokyo"], label: () => say("dash.clocksZones", "Places") }],
      draw(card) {
        const list = el("ul", { class: "dash-clocks" });
        const render = () => {
          const home = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const hour12 = card.app.config.timeFormat === "12h";
          const zones = (card.settings.zones || []).slice(0, 6);
          list.replaceChildren(...zones.map((zone) => {
            const time = K.clock(zone, card.now(), { hour12, home, locale: locale() });
            if (!time) return null;
            const city = zone.split("/").pop().replace(/_/g, " ");
            const shift = time.dayShift > 0 ? say("dash.clockTomorrow", "tomorrow") : time.dayShift < 0 ? say("dash.clockYesterday", "yesterday") : "";
            return el("li", {}, [el("span", { class: "dash-clock-city", text: city }), el("span", { class: "dash-clock-shift", text: shift }), el("b", { class: "dash-clock-time", text: time.time })]);
          }).filter(Boolean));
          if (!zones.length) list.replaceChildren(el("li", { class: "dash-empty", text: say("dash.clocksEmpty", "Add places in this card's settings") }));
        };
        card.update = render;
        card.tick = render;
        card.body.replaceChildren(list);
        render();
      }
    },

    countdown: {
      name: () => say("dash.countdown", "Countdown"), size: 1,
      settings: [
        { key: "title", type: "text", value: "", label: () => say("dash.countdownWhat", "What for") },
        { key: "date", type: "date", value: "", label: () => say("dash.countdownDate", "Date") }
      ],
      draw(card) {
        const render = () => {
          const left = K.countdown(card.settings.date, card.now());
          const what = card.settings.title || say("dash.countdownThe", "the day");
          if (!left) {
            card.body.replaceChildren(el("button", { type: "button", class: "dash-cta", onclick: () => card.openSettings() }, [icon(ICONS.countdown), el("span", { text: say("dash.countdownPick", "Pick a date") })]));
            return;
          }
          const big = left.state === "today" ? say("dash.countdownToday", "Today") : new Intl.NumberFormat(locale()).format(left.days);
          const small = left.state === "today" ? what
            : left.state === "ahead" ? say("dash.countdownAhead", "days until {what}", { what })
              : say("dash.countdownPast", "days since {what}", { what });
          card.body.replaceChildren(el("div", { class: "dash-countdown" }, [el("b", { text: big }), el("span", { text: small })]));
        };
        card.update = render;
        render();
      }
    },

    weather: {
      name: () => say("dash.weather", "Weather"), size: 2,
      network: "open-meteo.com",
      settings: [
        { key: "place", type: "place", value: null, label: () => say("dash.weatherPlace", "Place") },
        { key: "units", type: "select", value: "metric", label: () => say("dash.weatherUnits", "Units"), options: () => [["metric", "°C"], ["imperial", "°F"]] }
      ],
      data: () => ({ at: 0, key: "", forecast: null }),
      draw(card) {
        const render = () => {
          const place = card.settings.place;
          if (!place) {
            card.body.replaceChildren(el("button", { type: "button", class: "dash-cta", onclick: () => card.openSettings() }, [icon(ICONS.weather), el("span", { text: say("dash.weatherPick", "Choose a place") })]));
            return;
          }
          const w = card.data.forecast;
          if (!w) { card.body.replaceChildren(el("p", { class: "dash-empty", text: card.data.error ? say("dash.weatherOffline", "No forecast right now") : say("dash.weatherLoading", "Looking at the sky…") })); return; }
          const day = (date) => new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(new Date(`${date}T12:00`));
          card.body.replaceChildren(el("div", { class: "dash-weather" }, [
            el("div", { class: "dash-weather-now" }, [
              el("span", { class: `dash-sky dash-sky-${w.now.kind}` }, icon(SKY[w.now.kind] || SKY.cloudy)),
              el("b", { text: `${w.now.temp}°` }),
              el("span", { class: "dash-weather-place" }, [el("span", { text: place.name }), el("small", { text: `${skyName(w.now.kind)} · ${w.days[0].hi}° / ${w.days[0].lo}°` })])
            ]),
            el("ol", { class: "dash-weather-days" }, w.days.slice(1, 5).map((d) => el("li", { title: skyName(d.kind) }, [
              el("span", { text: day(d.date) }),
              el("span", { class: `dash-sky dash-sky-${d.kind}` }, icon(SKY[d.kind] || SKY.cloudy)),
              el("span", {}, [`${d.hi}°`, el("small", { text: `${d.lo}°` })])
            ])))
          ]));
        };
        card.redraw = render;
        card.update = () => { render(); card.app.dashboard.refreshWeather(card); };
        card.tick = () => card.app.dashboard.refreshWeather(card);
        render();
        card.app.dashboard.refreshWeather(card);
      }
    },

    quote: {
      name: () => say("dash.quote", "A line for today"), size: 2,
      settings: [
        { key: "mine", type: "textarea", value: "", label: () => say("dash.quoteMine", "Your own lines, one a line (“text — who said it”)") },
        { key: "source", type: "select", value: "both", label: () => say("dash.quoteSource", "Show"), options: () => [["both", say("dash.quoteBoth", "Mine and the ones built in")], ["mine", say("dash.quoteOnlyMine", "Only mine")]] }
      ],
      draw(card) {
        // One a day, from the person's own lines, the ones built in, or both.
        const pool = () => {
          const mine = String(card.settings.mine || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
            const at = line.search(/\s[—–-]\s/);
            return at > 0 ? [line.slice(0, at).trim().replace(/^[“"]|[”"]$/g, ""), line.slice(at + 3).trim()] : [line.replace(/^[“"]|[”"]$/g, ""), ""];
          });
          if (card.settings.source === "mine" && mine.length) return mine;
          return [...mine, ...QUOTES];
        };
        const render = () => {
          const day = Math.floor((card.now() - new Date(card.now()).getTimezoneOffset() * 60000) / 86400000);
          const lines = pool();
          const [text, author] = lines[((day % lines.length) + lines.length) % lines.length];
          card.body.replaceChildren(el("figure", { class: "dash-quote" }, [el("blockquote", { text: `“${text}”` }), author ? el("figcaption", { text: author }) : null]));
        };
        card.update = render;
        render();
      }
    }
  };
  const ORDER = ["focus", "tasks", "habits", "timer", "notes", "weather", "clocks", "countdown", "inbox", "agenda", "stash", "ai", "quote"];
  /* How big each kind of card starts, and how small or large it may be
     made, in cells of the twelve-column grid (dash-layout.js). */
  const SIZES = {
    focus: { w: 6, h: 2, minW: 4, minH: 2, maxH: 3 },
    tasks: { w: 3, h: 3, minW: 3, minH: 2 },
    habits: { w: 4, h: 3, minW: 3, minH: 2 },
    stash: { w: 4, h: 3, minW: 3, minH: 2 },
    ai: { w: 4, h: 4, minW: 3, minH: 3 },
    inbox: { w: 4, h: 4, minW: 3, minH: 3 },
    agenda: { w: 4, h: 3, minW: 3, minH: 2 },
    timer: { w: 3, h: 2, minW: 3, minH: 2, maxH: 3 },
    notes: { w: 3, h: 3, minW: 2, minH: 2 },
    weather: { w: 6, h: 2, minW: 3, minH: 2, maxH: 3 },
    clocks: { w: 3, h: 2, minW: 2, minH: 2 },
    countdown: { w: 3, h: 2, minW: 2, minH: 2, maxH: 3 },
    quote: { w: 6, h: 2, minW: 3, minH: 2, maxH: 3 }
  };
  const GEOMETRY = ["x", "y", "w", "h", "size"];
  const DL = window.NordlysDashLayout;
  const STARTER = ["focus", "tasks", "timer"];
  /* Layouts to start from, for different kinds of day. Each is a list of
     [type, x, y, w, h] on the twelve-column grid. */
  const PRESETS = {
    calm: { name: () => say("dash.presetCalm", "Calm"), note: () => say("dash.presetCalmNote", "A line for the day, the weather, one thing to do"),
      cards: [["focus", 0, 0, 6, 2], ["weather", 6, 0, 6, 2], ["quote", 0, 2, 8, 2], ["clocks", 8, 2, 4, 2]] },
    planner: { name: () => say("dash.presetPlanner", "Planner"), note: () => say("dash.presetPlannerNote", "Tasks, habits and what is coming"),
      cards: [["focus", 0, 0, 8, 2], ["countdown", 8, 0, 4, 2], ["tasks", 0, 2, 5, 4], ["habits", 5, 2, 4, 3], ["timer", 9, 2, 3, 2], ["notes", 9, 4, 3, 2]] },
    deep: { name: () => say("dash.presetDeep", "Deep work"), note: () => say("dash.presetDeepNote", "A timer, the list, a place for notes"),
      cards: [["timer", 0, 0, 4, 3], ["tasks", 4, 0, 4, 4], ["notes", 8, 0, 4, 4], ["focus", 0, 3, 4, 2]] },
    travel: { name: () => say("dash.presetTravel", "Traveller"), note: () => say("dash.presetTravelNote", "Weather, time zones and the day you leave"),
      cards: [["weather", 0, 0, 6, 2], ["clocks", 6, 0, 3, 3], ["countdown", 9, 0, 3, 2], ["notes", 0, 2, 6, 2], ["tasks", 9, 2, 3, 3]] },
    minimal: { name: () => say("dash.presetMinimal", "Minimal"), note: () => say("dash.presetMinimalNote", "One thing for today, and nothing else"),
      cards: [["focus", 2, 0, 8, 2]] }
  };
  /* Balance: outside the hours of work, the cards that ask something of
     you rest, and the calm ones stay. */
  const WORK_TYPES = new Set(["tasks", "timer", "habits", "focus"]);


  // The switch in a row reads its name from the row.
  const toggleLabel = (section) => {
    const balance = section.querySelector("#cfg-dash-balance");
    if (balance) balance.setAttribute("aria-labelledby", "cfg-dash-balance-label");
  };

  class NordlysDashboard {
    constructor(app) {
      this.app = app;
      this.root = document.getElementById("dash");
      this.cards = new Map();
      this.data = new Map();
      this.signature = "";
      this.sounds = window.NordlysSoundscapes ? new window.NordlysSoundscapes() : { play: async () => false, stop() {}, KINDS: [] };
      this.saveTimers = new Map();
      this.ticker = 0;
      this.menu = null;
      if (typeof chrome !== "undefined") chrome.storage?.onChanged?.addListener?.((changes, area) => {
        if (area !== "local") return;
        for (const [key, change] of Object.entries(changes)) {
          if (!key.startsWith(DATA)) continue;
          const id = key.slice(DATA.length);
          if (this.saveTimers.has(id)) continue;
          if (change.newValue === undefined) this.data.delete(id); else this.data.set(id, change.newValue);
          if (change.newValue) this.refreshKey(id, change.newValue);
        }
      });
      document.addEventListener("visibilitychange", () => this.schedule());
      window.addEventListener("nordlys:languagechange", () => { this.signature = ""; this.render(); this.renderSection(); });
      /* Which model the Ask card talks to, and the key for it. Kept on this
         device only: never in the config, never synced, never in a backup. */
      /* The apps a person connected: their tokens, on this device only,
         the same as the model key above. */
      this.connections = {};
      storage()?.get?.("nordlys_connections", (items) => {
        this.connections = items?.nordlys_connections || {};
        this.renderSection();
        for (const c of this.cards.values()) if (c.widget.type === "inbox" || c.widget.type === "agenda") c.update?.();
      });
      this.aiSetup = null;
      storage()?.get?.("nordlys_ai", (items) => {
        const saved = items?.nordlys_ai;
        this.aiSetup = saved && window.NordlysAI?.PROVIDERS[saved.provider] ? saved : (root.LanguageModel ? { provider: "chrome" } : null);
        for (const c of this.cards.values()) if (c.widget.type === "ai") c.update?.();
      });
      this.section = document.getElementById("sec-dashboard");
      this.arrange = window.NordlysDashArrange ? new window.NordlysDashArrange(this) : null;
      // Read now, so a backup taken while the dashboard is off still has it.
      this.load([...this.widgets().map((w) => this.dataKey(w)), "focus-timer"]);
      document.addEventListener("nordlys:dashboard", () => this.renderSection());
      // Balance turns over at the edges of the working day without a reload.
      this.wasResting = this.resting();
      setInterval(() => { const now = this.resting(); if (now !== this.wasResting) { this.wasResting = now; this.render(); } }, 60000);
      this.renderSection();
    }

    // ── Settings: Dashboard ──────────────────────────────────────
    renderSection() {
      if (!this.section) return;
      const focused = document.activeElement?.closest?.("#sec-dashboard") ? document.activeElement.dataset.focusKey : null;
      const toggle = el("input", { type: "checkbox", id: "cfg-dashboard", "data-focus-key": "toggle" });
      toggle.checked = this.on;
      toggle.addEventListener("change", () => this.setOn(toggle.checked));
      const parts = [
        el("h3", { text: say("dash.sectionTitle", "Dashboard") }),
        el("div", { class: "row setting-row" }, [
          el("span", { id: "cfg-dashboard-label" }, [
            el("span", { text: say("dash.modeLabel", "Show the dashboard") }),
            el("small", { class: "row-hint", text: say("dash.modeHint", "Cards for your day above the folders: focus, tasks, a timer, weather and more. Off, this is the plain new tab again. Each profile has its own.") })
          ]),
          el("label", { class: "tg" }, [toggle, el("i")])
        ])
      ];
      toggle.setAttribute("aria-labelledby", "cfg-dashboard-label");
      const order = this.readingOrder();
      const widgets = this.widgets().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      if (this.on) {
        parts.push(el("span", { class: "settings-block-label", text: say("dash.cardsTitle", "Cards") }));
        parts.push(el("ul", { class: "dash-settings-list" }, widgets.length ? widgets.map((widget, index) => el("li", {}, [
          el("span", { class: "dash-type-icon" }, icon(ICONS[widget.type])),
          el("span", { class: "dash-settings-name", text: this.title(widget) }),
          el("span", { class: "dash-settings-actions" }, [
            this.iconButton(ICONS.up, () => this.move(widget.id, -1), { key: `up-${widget.id}`, label: say("dash.moveUp", "Move {name} up", { name: this.title(widget) }), disabled: index === 0 }),
            this.iconButton(ICONS.down, () => this.move(widget.id, 1), { key: `down-${widget.id}`, label: say("dash.moveDown", "Move {name} down", { name: this.title(widget) }), disabled: index === widgets.length - 1 }),
            this.iconButton(ICONS.gear, () => this.openSettings(widget), { key: `set-${widget.id}`, label: `${say("dash.settings", "Settings")}: ${this.title(widget)}`, hidden: !(TYPES[widget.type].settings || widget.type === "tasks" || widget.type === "notes") }),
            this.iconButton(ICONS.trash, () => this.remove(widget.id), { key: `rm-${widget.id}`, label: `${say("dash.remove", "Remove card")}: ${this.title(widget)}`, danger: true })
          ])
        ])) : [el("li", { class: "dash-empty", text: say("dash.noCards", "No cards yet") })]));
        parts.push(el("span", { class: "settings-block-label", text: say("dash.presetsTitle", "Start from a layout") }));
        parts.push(el("div", { class: "dash-presets" }, Object.entries(PRESETS).map(([key, preset]) => el("button", {
          type: "button", class: "dash-preset", "data-focus-key": `preset-${key}`, onclick: () => this.applyPreset(key)
        }, [this.presetPicture(preset), el("span", { class: "dash-preset-name", text: preset.name() }), el("small", { text: preset.note() })]))));
        parts.push(el("span", { class: "settings-block-label", text: say("dash.addTitle", "Add a card") }));
        parts.push(el("div", { class: "dash-settings-add" }, this.types().map(({ type, name, network }) => el("button", {
          type: "button", class: "dash-settings-type", "data-focus-key": `add-${type}`, onclick: () => this.add(type)
        }, [icon(ICONS[type]), el("span", { text: name }), network ? el("small", { text: say("dash.usesNetwork", "Uses {host}", { host: network }) }) : null]))));
      }
      if (this.on) {
        const folders = el("input", { type: "checkbox", id: "cfg-dash-folders", "data-focus-key": "folders", "aria-labelledby": "cfg-dash-folders-label" });
        folders.checked = this.state.showBoard !== false;
        folders.addEventListener("change", () => { this.write({ ...this.state, showBoard: folders.checked }); this.app.pageFit?.request?.({ now: true }); });
        parts.push(el("div", { class: "row setting-row" }, [
          el("span", { id: "cfg-dash-folders-label" }, [el("span", { text: say("dash.showFolders", "Show the folders below the cards") }), el("small", { class: "row-hint", text: say("dash.showFoldersHint", "Off, the page is the dashboard alone. The folders are still there when the dashboard is off.") })]),
          el("label", { class: "tg" }, [folders, el("i")])
        ]));
        parts.push(this.balanceBlock());
        parts.push(el("h3", { text: say("dash.connectionsTitle", "Connected apps") }));
        parts.push(el("p", { class: "row-hint dash-connections-hint", text: say("dash.connectionsHint", "Tasks and events from the apps you use, shown in the From your apps and Calendar cards. Each one talks to its app directly.") }));
        parts.push(this.connectionsBlock());
      }
      this.section.replaceChildren(...parts.filter(Boolean));
      toggleLabel(this.section);
      if (focused) this.section.querySelector(`[data-focus-key="${focused}"]`)?.focus({ preventScroll: true });
    }
    // A small drawing of a layout: its cards as blocks on the grid.
    presetPicture(preset) {
      const rows = Math.max(...preset.cards.map(([, , y, , h]) => y + h));
      const box = el("span", { class: "dash-preset-picture", "aria-hidden": "true", style: `--rows:${rows}` });
      for (const [type, x, y, w, h] of preset.cards) box.append(el("i", { dataset: { type }, style: `grid-column:${x + 1} / span ${w};grid-row:${y + 1} / span ${h}` }));
      return box;
    }
    balanceBlock() {
      const balance = { on: false, start: "09:00", end: "18:00", weekdays: true, ...(this.state.balance || {}) };
      const toggle = el("input", { type: "checkbox", id: "cfg-dash-balance", "data-focus-key": "balance" });
      toggle.checked = balance.on;
      toggle.addEventListener("change", () => this.setBalance({ on: toggle.checked }));
      const time = (key, label) => {
        const input = el("input", { type: "time", class: "dash-input dash-time", value: balance[key], "aria-label": label, "data-focus-key": `balance-${key}` });
        input.addEventListener("change", () => { if (/^\d\d:\d\d$/.test(input.value)) this.setBalance({ [key]: input.value }); });
        return input;
      };
      const weekdays = el("input", { type: "checkbox", id: "cfg-dash-weekdays", "data-focus-key": "balance-weekdays" });
      weekdays.checked = balance.weekdays !== false;
      weekdays.addEventListener("change", () => this.setBalance({ weekdays: weekdays.checked }));
      return el("div", { class: "dash-balance" }, [
        el("div", { class: "row setting-row" }, [
          el("span", { id: "cfg-dash-balance-label" }, [
            el("span", { text: say("dash.balance", "Balance") }),
            el("small", { class: "row-hint", text: say("dash.balanceHint", "Outside your working hours, tasks, the timer and habits rest, and only the calm cards stay.") })
          ]),
          el("label", { class: "tg" }, [toggle, el("i")])
        ]),
        balance.on ? el("div", { class: "dash-balance-hours" }, [
          el("span", { text: say("dash.balanceHours", "Working hours") }), time("start", say("dash.balanceFrom", "From")), el("span", { text: "–" }), time("end", say("dash.balanceTo", "To")),
          el("label", { class: "dash-balance-weekdays" }, [weekdays, el("span", { text: say("dash.balanceWeekdays", "Weekdays only") })])
        ]) : null
      ]);
    }
    iconButton(path, onClick, { key, label, danger, disabled, hidden } = {}) {
      return el("button", { type: "button", class: `dash-icon-btn dash-row-btn${danger ? " danger" : ""}`, onclick: onClick, "data-focus-key": key, "aria-label": label, title: label, disabled, style: hidden ? "visibility:hidden" : null, tabindex: hidden ? "-1" : null, "aria-hidden": hidden ? "true" : null }, icon(path));
    }
    button(label, onClick, { key, danger, aria, disabled } = {}) {
      return el("button", { type: "button", class: `glass-btn small${danger ? " danger" : ""}`, text: label, onclick: onClick, "data-focus-key": key, "aria-label": aria, disabled });
    }

    // ── The profile's part of it ─────────────────────────────────
    get state() {
      const current = this.app.config.dashboard;
      return current && typeof current === "object" ? current : { on: false, widgets: [] };
    }
    write(next) {
      this.app.config.dashboard = next;
      this.app.saveConfig();
      this.app.sync?.schedulePush?.();
      this.render();
      document.dispatchEvent(new CustomEvent("nordlys:dashboard"));
    }
    get on() { return Boolean(this.state.on); }
    widgets() { return (this.state.widgets || []).filter((w) => w && TYPES[w.type]); }
    /* What is on the page now: every card, or in the hours Balance keeps
       for rest, only the calm ones. */
    shownWidgets() { return this.resting() ? this.widgets().filter((w) => !WORK_TYPES.has(w.type)) : this.widgets(); }
    resting(now = Date.now()) {
      const balance = this.state.balance;
      if (!balance?.on) return false;
      const d = new Date(now);
      const minutes = d.getHours() * 60 + d.getMinutes();
      const [sh, sm] = String(balance.start || "09:00").split(":").map(Number);
      const [eh, em] = String(balance.end || "18:00").split(":").map(Number);
      const start = sh * 60 + sm, end = eh * 60 + em;
      const weekday = d.getDay() >= 1 && d.getDay() <= 5;
      if (balance.weekdays !== false && !weekday) return true;
      return start <= end ? minutes < start || minutes >= end : minutes < start && minutes >= end;
    }
    applyPreset(key) {
      const preset = PRESETS[key];
      if (!preset) return;
      const before = structuredClone(this.state);
      const widgets = preset.cards.map(([type, x, y, w, h]) => ({ ...this.blank(type), x, y, w, h }));
      this.write({ ...this.state, on: true, seeded: true, widgets });
      window.NordlysUI?.showUndoToast?.({ message: say("dash.presetApplied", "Layout: {name}", { name: preset.name() }), onAction: () => this.write(before) });
    }
    setBalance(patch) { this.write({ ...this.state, balance: { on: false, start: "09:00", end: "18:00", weekdays: true, ...(this.state.balance || {}), ...patch } }); }
    types() { return ORDER.map((type) => ({ type, name: TYPES[type].name(), network: TYPES[type].network || null })); }

    setOn(on) {
      const state = { ...this.state, on: Boolean(on), widgets: [...(this.state.widgets || [])] };
      // The first time, three cards to start from rather than an empty row.
      if (on && !state.seeded) {
        if (!state.widgets.length) state.widgets = STARTER.map((type) => this.blank(type));
        state.seeded = true;
      }
      this.write(state);
      if (!on) this.sounds.stop();
      window.NordlysUI?.announce?.(on ? say("dash.onSaid", "Dashboard on") : say("dash.offSaid", "Dashboard off"));
    }
    blank(type) {
      const settings = {};
      for (const field of TYPES[type].settings || []) settings[field.key] = structuredClone(field.value);
      return { id: K.newId(), type, settings };
    }
    add(type) {
      if (!TYPES[type]) return null;
      const widget = this.blank(type);
      const state = { ...this.state, on: true, seeded: true, widgets: [...(this.state.widgets || []), widget] };
      this.write(state);
      requestAnimationFrame(() => this.cards.get(widget.id)?.root.querySelector("input, textarea, button:not(.dash-menu-btn)")?.focus({ preventScroll: false }));
      return widget.id;
    }
    change(id, fn) {
      const widgets = (this.state.widgets || []).map((w) => (w.id === id ? fn(structuredClone(w)) : w)).filter(Boolean);
      this.write({ ...this.state, widgets });
    }
    remove(id) {
      const before = structuredClone(this.state);
      const widget = this.widgets().find((w) => w.id === id);
      this.change(id, () => null);
      window.NordlysUI?.showUndoToast?.({
        message: say("dash.removed", "Removed {name}", { name: widget ? this.title(widget) : "" }),
        onAction: () => this.write(before)
      });
      /* The card's contents stay in storage until the undo is gone, so Undo
         brings back the tasks too. */
      setTimeout(() => {
        // A shared key (the focus timer) outlives any one card of it.
        if (widget && this.dataKey(widget) === id && !this.widgets().some((w) => w.id === id)) storage()?.remove?.(DATA + id);
      }, 12000);
    }
    // One place along in reading order: the two cards trade places.
    move(id, step) {
      const items = this.layout().sort((a, b) => a.y - b.y || a.x - b.x);
      const from = items.findIndex((it) => it.id === id);
      const other = items[from + step];
      if (from < 0 || !other) return;
      const next = DL.swap(items, id, other.id);
      this.commit(next);
      requestAnimationFrame(() => this.cards.get(id)?.root.querySelector(".dash-menu-btn")?.focus());
    }
    resize(id, w, h) { this.commit(DL.resize(this.layout(), id, w, h)); }
    readingOrder() { return this.layout().sort((a, b) => a.y - b.y || a.x - b.x).map((it) => it.id); }

    // ── Where the cards sit ──────────────────────────────────────
    /* The layout in cells, made whole: a card from an older build, another
       device or a backup has a size and a place like any other. */
    layout() {
      const widgets = this.shownWidgets();
      const items = widgets.map((w) => {
        const size = SIZES[w.type];
        const legacyW = w.size === 2 ? 6 : w.size === 1 ? 3 : undefined;
        return { id: w.id, x: w.x, y: w.y, w: w.w ?? legacyW ?? size.w, h: w.h ?? size.h, minW: size.minW, minH: size.minH, maxW: size.maxW, maxH: size.maxH };
      });
      return DL.normalize(items, Object.fromEntries(widgets.map((w) => [w.id, SIZES[w.type]])));
    }
    commit(items) {
      const spots = new Map(items.map((it) => [it.id, it]));
      const widgets = (this.state.widgets || []).map((w) => {
        const it = spots.get(w.id);
        if (!it) return w;
        const next = { ...w, x: it.x, y: it.y, w: it.w, h: it.h };
        delete next.size;
        return next;
      });
      this.write({ ...this.state, widgets });
    }
    get cols() {
      const width = this.root?.clientWidth || 1200;
      return width >= 900 ? DL.COLS : width >= 560 ? 6 : 1;
    }
    metrics() {
      const style = getComputedStyle(this.grid);
      const gap = parseFloat(style.columnGap) || 16;
      const unit = parseFloat(style.getPropertyValue("--dash-unit")) || 88;
      const box = this.grid.getBoundingClientRect();
      const cols = this.cols;
      return { box, gap, unit, cols, cell: (box.width + gap) / cols, row: unit + gap };
    }
    motion() {
      const css = getComputedStyle(document.documentElement);
      const still = window.NordlysUI?.motion?.reduced?.() || matchMedia("(prefers-reduced-motion: reduce)").matches;
      return { still, duration: parseFloat(css.getPropertyValue("--nl-motion-settle")) || 420, easing: css.getPropertyValue("--nl-ease-emphasized").trim() || "ease" };
    }
    /* Puts every card on its cells. Cards that move glide there from where
       they were (FLIP), and a card caught mid-glide carries on from where it
       is rather than jumping. */
    place(items, { animate = true, except = null } = {}) {
      if (!this.grid) return;
      const cols = this.cols;
      const shown = cols === DL.COLS ? items : DL.reflow(items, cols);
      const { still, duration, easing } = this.motion();
      const moving = animate && !still;
      const first = new Map();
      if (moving) for (const [id, card] of this.cards) if (id !== except) first.set(id, card.root.getBoundingClientRect());
      this.grid.style.setProperty("--dash-cols", String(cols));
      for (const it of shown) {
        const card = this.cards.get(it.id);
        // The card in the hand keeps its cells until it is set down.
        if (!card || it.id === except) continue;
        card.root.style.gridColumn = `${it.x + 1} / span ${it.w}`;
        card.root.style.gridRow = `${it.y + 1} / span ${it.h}`;
        card.root.dataset.w = String(it.w);
        card.root.dataset.h = String(it.h);
      }
      if (!moving) return;
      for (const [id, before] of first) {
        const node = this.cards.get(id)?.root;
        if (!node) continue;
        node.getAnimations().filter((a) => a.id === "dash-flip").forEach((a) => a.cancel());
        const after = node.getBoundingClientRect();
        const dx = before.left - after.left, dy = before.top - after.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        const animation = node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration, easing });
        animation.id = "dash-flip";
      }
    }
    // From the command line: the first card of the kind, made if there is none.
    async ensure(type) {
      if (!this.on) this.setOn(true);
      if (!this.widgets().some((w) => w.type === type)) this.add(type);
      await this.render();
      const widget = this.widgets().find((w) => w.type === type);
      return this.cards.get(widget?.id) || null;
    }
    async addTask(text) {
      const card = await this.ensure("tasks");
      // "> task call mum tomorrow !" reads the same as typing it in the card.
      const parsed = K.tasks.parse(text, Date.now());
      if (!card || !K.tasks.add(card.data, parsed.text, Date.now(), { due: parsed.due, priority: parsed.priority })) return false;
      card.save();
      card.update?.();
      window.NordlysUI?.announce?.(say("dash.taskAdded", "Added to {name}", { name: card.title() }));
      return true;
    }
    async toggleTimer() {
      const card = await this.ensure("timer");
      card?.root.querySelector(".dash-round-btn.accent")?.click();
      return Boolean(card);
    }
    title(widget) { return widget.settings?.title && widget.type !== "countdown" ? widget.settings.title : TYPES[widget.type].name(); }

    // ── What a card keeps ────────────────────────────────────────
    /* For the backup file: what every card of this profile holds. */
    backupData() {
      const out = {};
      const keys = new Set([...this.widgets().map((w) => this.dataKey(w)), "focus-timer"]);
      for (const key of keys) if (this.data.has(key)) out[key] = structuredClone(this.data.get(key));
      return out;
    }
    /* Where a card keeps what it holds: its own id, or a key it shares with
       every card of its kind (the focus timer). */
    dataKey(widget) { return TYPES[widget.type]?.shared || widget.id; }
    // Tells every view of a key (cards, Focus mode) that it changed.
    refreshKey(key, value, source = null) {
      for (const card of this.cards.values()) {
        if (card === source || this.dataKey(card.widget) !== key) continue;
        card.data = value;
        card.update?.();
      }
      document.dispatchEvent(new CustomEvent("nordlys:dashdata", { detail: { key } }));
    }
    /* What is kept under a key, made if there is none: for Focus mode,
       which is not a card but reads and writes the same timer. */
    async shared(key, make) {
      await this.load([key]);
      if (!this.data.has(key)) this.data.set(key, make());
      return this.data.get(key);
    }
    saveShared(key, options) {
      this.persist(key, this.data.get(key), options);
      this.refreshKey(key, this.data.get(key));
    }
    async load(ids) {
      const store = storage();
      const missing = ids.filter((id) => !this.data.has(id));
      if (!store || !missing.length) return;
      const found = await new Promise((resolve) => store.get(missing.map((id) => DATA + id), (items) => resolve(items || {})));
      for (const id of missing) if (found[DATA + id]) this.data.set(id, found[DATA + id]);
    }
    persist(id, value, { soon = false } = {}) {
      this.data.set(id, value);
      clearTimeout(this.saveTimers.get(id));
      const write = () => {
        storage()?.set?.({ [DATA + id]: value }, () => { setTimeout(() => this.saveTimers.delete(id), 50); });
      };
      if (soon) this.saveTimers.set(id, setTimeout(write, 400));
      else { this.saveTimers.set(id, 0); write(); }
    }

    // ── Drawing ──────────────────────────────────────────────────
    /* Drawing waits for what the cards hold, so a caller that needs the cards
       (a command) is handed the drawing already under way rather than none. */
    render() {
      if (!this.root) return Promise.resolve();
      const widgets = this.on ? this.shownWidgets() : [];
      this.wasResting = this.resting();
      const signature = JSON.stringify([this.on, this.wasResting, this.state.showBoard !== false, widgets.map((w) => Object.fromEntries(Object.entries(w).filter(([key]) => !GEOMETRY.includes(key)))), locale()]);
      if (signature === this.signature) {
        // Only where the cards sit has changed: they move, nothing is redrawn.
        if (this.on && this.grid) this.place(this.layout(), { animate: !this.dragging });
        return this.drawing || Promise.resolve();
      }
      this.signature = signature;
      this.drawing = this.draw(widgets, signature);
      return this.drawing;
    }
    async draw(widgets, signature) {
      document.documentElement.toggleAttribute("data-dashboard", this.on);
      // The folders can step aside while the dashboard is on.
      document.documentElement.dataset.dashFolders = this.on && this.state.showBoard === false ? "off" : "on";
      if (!this.on) {
        this.root.hidden = true;
        this.root.replaceChildren();
        this.cards.clear();
        this.schedule();
        return;
      }
      await this.load(widgets.map((w) => this.dataKey(w)));
      if (signature !== this.signature) return;
      const focusedId = document.activeElement?.closest?.(".dash-card")?.dataset.widgetId;
      const focusedMenu = document.activeElement?.classList.contains("dash-menu-btn");
      this.cards.clear();
      const nodes = widgets.map((widget, index) => this.card(widget, index, widgets.length));
      const focusedAdder = document.activeElement?.classList.contains("dash-add");
      // Cards rise in once, when the dashboard appears; a redraw stays still.
      const arriving = this.root.hidden;
      this.root.classList.toggle("is-arriving", arriving);
      if (arriving) setTimeout(() => this.root.classList.remove("is-arriving"), 700);
      this.grid = el("div", { class: "dash-grid" }, nodes);
      this.root.replaceChildren(this.grid, el("div", { class: "dash-bar" }, [
        this.app.focusMode ? el("button", { type: "button", class: "dash-pill dash-focus-open", onclick: () => this.app.focusMode.show() }, [icon(ICONS.focus), el("span", { text: say("focus.title", "Focus mode") })]) : null,
        this.adder()
      ]));
      this.root.hidden = false;
      this.place(this.layout(), { animate: false });
      this.arrange?.bind(this.grid);
      if (!this.resizer && window.ResizeObserver) {
        this.resizer = new ResizeObserver(() => { if (this.grid?.isConnected && !this.dragging) this.place(this.layout(), { animate: false }); });
        this.resizer.observe(this.root);
      }
      if (focusedAdder) this.root.querySelector(".dash-add")?.focus({ preventScroll: true });
      if (focusedId && focusedMenu) this.cards.get(focusedId)?.root.querySelector(".dash-menu-btn")?.focus({ preventScroll: true });
      this.schedule();
      this.app.pageFit?.request?.();
    }

    card(widget, index, count) {
      const type = TYPES[widget.type];
      const body = el("div", { class: "dash-body" });
      const titleId = `dash-title-${widget.id}`;
      const menuBtn = el("button", { type: "button", class: "dash-icon-btn dash-menu-btn", "aria-haspopup": "menu", "aria-label": say("dash.cardMenu", "{name} options", { name: this.title(widget) }), title: say("dash.options", "Options") }, icon(ICONS.more));
      const root = el("article", { class: "dash-card", dataset: { widgetId: widget.id, type: widget.type }, "aria-labelledby": titleId, style: `--i:${index}` }, [
        el("header", { class: "dash-head", title: say("dash.dragHint", "Drag to move") }, [el("span", { class: "dash-type-icon" }, icon(ICONS[widget.type])), el("h2", { id: titleId, text: this.title(widget) }), menuBtn]),
        body,
        el("span", { class: "dash-resize", "aria-hidden": "true", title: say("dash.resizeHint", "Drag to resize") })
      ]);
      const key = this.dataKey(widget);
      const stored = this.data.get(key);
      const card = {
        app: this.app, root, body, widget,
        settings: widget.settings || {},
        data: stored || (type.data ? type.data(widget.settings) : {}),
        now: () => Date.now(),
        title: () => this.title(widget),
        greeting: () => (this.app.config.userName ? say("dash.focusHello", "{name}, what matters most today?", { name: this.app.config.userName }) : say("dash.focusIntro", "One thing for today")),
        save: (options) => { this.persist(key, card.data, options); this.refreshKey(key, card.data, card); },
        openSettings: () => this.openSettings(widget)
      };
      if (!stored && type.data) this.data.set(key, card.data);
      if (type.applySettings) type.applySettings(card);
      menuBtn.addEventListener("click", () => this.openMenu(widget, menuBtn));
      try { type.draw(card); } catch (error) { body.replaceChildren(el("p", { class: "dash-empty", text: say("dash.broken", "This card could not be drawn") })); }
      this.cards.set(widget.id, card);
      return root;
    }

    adder() {
      return el("button", { type: "button", class: "dash-add", "aria-label": say("dash.addCard", "Add a card"), title: say("dash.addCard", "Add a card"), onclick: (event) => this.openAdd(event.currentTarget) }, [icon(ICONS.plus), el("span", { text: say("dash.addCard", "Add a card") })]);
    }

    /* Clocks and timers need a second hand; nothing else does. The page
       ticks only while it is shown and a card asks for it. */
    schedule() {
      clearInterval(this.ticker);
      this.ticker = 0;
      if (document.visibilityState !== "visible") return;
      const ticking = [...this.cards.values()].filter((card) => card.tick);
      if (!ticking.length) return;
      this.ticker = setInterval(() => {
        for (const card of this.cards.values()) {
          if (!card.tick) continue;
          if (card.widget.type === "weather") { if (Date.now() % 60000 < 1000) card.tick(); } else card.tick();
        }
      }, 1000);
    }

    // ── Menus ────────────────────────────────────────────────────
    closeMenu() {
      if (!this.menu) return;
      const { node, opener, cleanup } = this.menu;
      this.menu = null;
      cleanup();
      node.remove();
      opener?.setAttribute("aria-expanded", "false");
    }
    popup(opener, items, label) {
      this.closeMenu();
      const node = el("div", { class: "dash-menu glass-context-menu open", role: "menu", "aria-label": label });
      for (const item of items) {
        if (!item) continue;
        node.append(el("button", { type: "button", role: "menuitem", class: `ctx-item dash-menu-item${item.danger ? " danger" : ""}`, onclick: () => { this.closeMenu(); item.run(); } }, [
          item.mark || (item.icon ? icon(item.icon) : null), el("span", { text: item.label }), item.note ? el("small", { text: item.note }) : null
        ]));
      }
      document.body.append(node);
      const box = opener.getBoundingClientRect();
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      node.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, box.right - width))}px`;
      node.style.top = `${box.bottom + 6 + height > window.innerHeight ? Math.max(8, box.top - height - 6) : box.bottom + 6}px`;
      opener.setAttribute("aria-expanded", "true");
      const buttons = [...node.querySelectorAll("button")];
      const onKey = (event) => {
        const at = buttons.indexOf(document.activeElement);
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.closeMenu(); opener.focus(); }
        else if (event.key === "ArrowDown") { event.preventDefault(); buttons[(at + 1) % buttons.length].focus(); }
        else if (event.key === "ArrowUp") { event.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length].focus(); }
        else if (event.key === "Tab") this.closeMenu();
      };
      const onDown = (event) => { if (!node.contains(event.target) && event.target !== opener) this.closeMenu(); };
      node.addEventListener("keydown", onKey);
      setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
      this.menu = { node, opener, cleanup: () => document.removeEventListener("pointerdown", onDown, true) };
      buttons[0]?.focus();
    }
    openMenu(widget, opener) {
      const order = this.readingOrder();
      const index = order.indexOf(widget.id);
      const count = order.length;
      const type = TYPES[widget.type];
      const spot = this.layout().find((it) => it.id === widget.id);
      const limits = SIZES[widget.type];
      this.popup(opener, [
        type.settings || widget.type === "tasks" || widget.type === "notes" || widget.type === "ai" ? { label: say("dash.settings", "Settings"), run: () => this.openSettings(widget) } : null,
        spot.x + spot.w + 3 <= DL.COLS && spot.w + 3 <= (limits.maxW || DL.COLS) ? { label: say("dash.wider", "Make wider"), run: () => this.resize(widget.id, spot.w + 3, spot.h) } : null,
        spot.w - 3 >= limits.minW ? { label: say("dash.narrower", "Make narrower"), run: () => this.resize(widget.id, spot.w - 3, spot.h) } : null,
        spot.h < (limits.maxH || DL.MAX_H) ? { label: say("dash.taller", "Make taller"), run: () => this.resize(widget.id, spot.w, spot.h + 1) } : null,
        spot.h > limits.minH ? { label: say("dash.shorter", "Make shorter"), run: () => this.resize(widget.id, spot.w, spot.h - 1) } : null,
        index > 0 ? { label: say("dash.moveLeft", "Move left"), run: () => this.move(widget.id, -1) } : null,
        index < count - 1 ? { label: say("dash.moveRight", "Move right"), run: () => this.move(widget.id, 1) } : null,
        { label: say("dash.remove", "Remove card"), danger: true, run: () => this.remove(widget.id) }
      ], say("dash.cardMenu", "{name} options", { name: this.title(widget) }));
    }
    openAdd(opener) {
      this.popup(opener, this.types().map(({ type, name, network }) => ({
        label: name, icon: ICONS[type], note: network ? say("dash.usesNetwork", "Uses {host}", { host: network }) : "",
        run: () => this.add(type)
      })), say("dash.addCard", "Add a card"));
    }

    // ── A card's settings ────────────────────────────────────────
    /* The Ask card's model: which one, and where its key lives. Saving asks
       Chrome for leave to reach that one address, from the click itself. */
    openAiSettings(widget) {
      const AI = window.NordlysAI;
      const setup = { provider: "chrome", model: "", key: "", base: "", ...(this.aiSetup || {}) };
      const form = el("form", { class: "dash-form" });
      const dialog = el("dialog", { class: "dash-dialog glass-panel", "aria-labelledby": "dash-dialog-title" }, [el("h2", { id: "dash-dialog-title", text: say("dash.aiModel", "The model to ask") }), form]);
      const provider = el("select", { id: "dash-ai-provider", class: "dash-input" }, Object.entries(AI.PROVIDERS).filter(([key]) => key !== "chrome" || root.LanguageModel).map(([key, p]) => el("option", { value: key, text: p.name })));
      provider.value = AI.PROVIDERS[setup.provider] && (setup.provider !== "chrome" || root.LanguageModel) ? setup.provider : "openai";
      const model = el("input", { id: "dash-ai-model", class: "dash-input", type: "text", autocomplete: "off", spellcheck: "false" });
      const key = el("input", { id: "dash-ai-key", class: "dash-input", type: "password", autocomplete: "off", spellcheck: "false", placeholder: say("dash.aiKeyHint", "Paste your key") });
      const base = el("input", { id: "dash-ai-base", class: "dash-input", type: "url", autocomplete: "off", spellcheck: "false", placeholder: "https://…/v1" });
      model.value = setup.model || "";
      key.value = setup.key || "";
      base.value = setup.base || "";
      const field = (id, label, control) => el("div", { class: "dash-field", dataset: { field: id } }, [el("label", { for: control.id, text: label }), control]);
      const rows = {
        model: field("model", say("dash.aiModelName", "Model"), model),
        key: field("key", say("dash.aiKey", "Key"), key),
        base: field("base", say("dash.aiBase", "Address"), base)
      };
      const note = el("small", { class: "dash-note-small" });
      const sync = () => {
        const p = AI.PROVIDERS[provider.value];
        rows.model.hidden = provider.value === "chrome";
        rows.key.hidden = !p.key;
        rows.base.hidden = provider.value !== "custom" && provider.value !== "ollama";
        model.placeholder = p.model || "";
        if (provider.value === "ollama" && !base.value) base.placeholder = p.base;
        note.textContent = provider.value === "chrome"
          ? say("dash.aiChromeNote", "Chrome's own model runs on this device. Nothing leaves your computer.")
          : provider.value === "ollama"
            ? say("dash.aiLocalNote", "The model runs on your computer. Nordlys talks to it at this address and nowhere else.")
            : say("dash.aiKeyNote", "Your key stays on this device: it is not synced and not in backups. Questions go straight to {name}; Nordlys never sees them.", { name: p.name });
      };
      provider.addEventListener("change", sync);
      const error = el("p", { class: "dash-form-error", role: "alert" });
      const cancel = el("button", { type: "button", class: "glass-btn", text: say("dash.cancel", "Cancel"), onclick: () => dialog.close() });
      form.append(field("provider", say("dash.aiProvider", "Talk to"), provider), rows.model, rows.key, rows.base, note, error,
        el("div", { class: "dash-form-actions" }, [cancel, el("button", { type: "submit", class: "glass-btn accent", text: say("dash.save", "Save") })]));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const next = { provider: provider.value, model: model.value.trim(), key: key.value.trim(), base: base.value.trim() };
        if (AI.PROVIDERS[next.provider].key && !next.key && next.provider !== "custom") { error.textContent = say("dash.aiNeedsKey", "This one needs a key."); key.focus(); return; }
        const finish = () => {
          this.aiSetup = next;
          storage()?.set?.({ nordlys_ai: next });
          dialog.close();
          for (const c of this.cards.values()) if (c.widget.type === "ai") c.update?.();
        };
        const origin = AI.origin(next);
        const perms = typeof chrome !== "undefined" ? chrome.permissions : null;
        if (!origin || !perms?.request) { finish(); return; }
        perms.request({ origins: [origin] }, (granted) => {
          if (granted) finish();
          else error.textContent = say("dash.aiNoLeave", "Without leave to reach {site}, Nordlys can't ask it.", { site: origin.replace("/*", "") });
        });
      });
      dialog.addEventListener("close", () => { dialog.remove(); this.cards.get(widget.id)?.root.querySelector(".dash-menu-btn")?.focus(); });
      document.body.append(dialog);
      sync();
      dialog.showModal();
      provider.focus();
    }
    // ── Connected apps ───────────────────────────────────────────
    connected(id) { return window.NordlysConnectors?.ready(id, this.connections[id]) || false; }
    connectedOf(kind) { const C = window.NordlysConnectors; return Object.keys(C?.CONNECTORS || {}).filter((id) => C.CONNECTORS[id].kind === kind && this.connected(id)); }
    // A card's chosen sources, or every connected one of its kind.
    sourcesFor(chosen, kind) { const all = this.connectedOf(kind); return Array.isArray(chosen) ? chosen.filter((id) => all.includes(id)) : all; }
    saveConnections() { storage()?.set?.({ nordlys_connections: this.connections }); }
    brandIcon(id, size = 16) {
      const brand = window.NordlysBrands?.[id];
      /* A near-black mark (GitHub, Notion) takes the colour of the text
         instead, so it reads on a dark theme as well as a light one. */
      const raw = window.NordlysConnectors?.CONNECTORS[id]?.color || "";
      const rgb = /^#([0-9a-f]{6})$/i.exec(raw) ? [0, 2, 4].map((k) => parseInt(raw.slice(1 + k, 3 + k), 16) / 255) : null;
      const dark = rgb && (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) < 0.2;
      const color = !raw || dark ? "currentColor" : raw;
      const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgNode.setAttribute("viewBox", "0 0 24 24");
      svgNode.setAttribute("width", String(size)); svgNode.setAttribute("height", String(size));
      svgNode.setAttribute("aria-hidden", "true");
      svgNode.setAttribute("class", "dash-brand");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", brand?.d || ICONS.link);
      if (brand && !brand.stroke) { p.setAttribute("fill", color); p.setAttribute("stroke", "none"); } else { p.setAttribute("fill", "none"); p.setAttribute("stroke", color); p.setAttribute("stroke-width", "2"); }
      svgNode.style.setProperty("--brand", color);
      svgNode.append(p);
      return svgNode;
    }
    /* Everything the given apps have, merged. One app failing never takes the
       others with it; its error is kept to be shown. */
    async pull(ids) {
      const C = window.NordlysConnectors;
      const items = [];
      const errors = {};
      await Promise.all(ids.map(async (id) => {
        try {
          if (C.CONNECTORS[id].oauth) { this.connections[id] = await C.refresh(id, this.connections[id]); this.saveConnections(); }
          items.push(...await C.list(id, this.connections[id]));
        } catch (error) { errors[id] = error.message || String(error); }
      }));
      return { items, errors };
    }
    async completeRemote(it) {
      const C = window.NordlysConnectors;
      if (!(await C.complete(it.source, this.connections[it.source], it))) throw new Error(say("dash.inboxCantTick", "This app can't be ticked from here."));
    }
    openConnectPicker(opener, kind) {
      const C = window.NordlysConnectors;
      this.popup(opener, Object.entries(C.CONNECTORS).filter(([, c]) => !kind || c.kind === kind).map(([id, c]) => ({
        // Each app by its own mark, so the list reads at a glance.
        label: c.name, mark: this.brandIcon(id, 18), note: this.connected(id) ? say("dash.connected", "Connected") : !this.canSignIn(c) ? say("dash.soon", "Soon") : "", run: () => this.openConnect(id)
      })), say("dash.connectApp", "Connect an app"));
    }
    /* Connecting one app: its fields, where to find them, leave to reach
       it (asked from this click), and a first look to prove it works. */
    openConnect(id) {
      const C = window.NordlysConnectors;
      const c = C.CONNECTORS[id];
      const saved = { ...(this.connections[id] || {}) };
      const form = el("form", { class: "dash-form" });
      const dialog = el("dialog", { class: "dash-dialog glass-panel", "aria-labelledby": "dash-dialog-title" }, [
        el("h2", { id: "dash-dialog-title", class: "dash-connect-title" }, [this.brandIcon(id, 22), el("span", { text: c.name })]), form
      ]);
      const inputs = {};
      for (const field of c.fields) {
        const input = el("input", { id: `dash-conn-${field.key}`, class: "dash-input", type: field.secret ? "password" : "text", autocomplete: "off", spellcheck: "false", placeholder: field.placeholder || "" });
        input.value = saved[field.key] || "";
        inputs[field.key] = input;
        form.append(el("div", { class: "dash-field" }, [
          el("label", { for: input.id, text: field.label }), input,
          field.help ? el("a", { class: "dash-link dash-help", href: field.help, target: "_blank", rel: "noopener", text: say("dash.whereToFind", "Where to find it ↗") }) : null
        ]));
      }
      const error = el("p", { class: "dash-form-error", role: "alert" });
      const status = el("p", { class: "dash-note-small", role: "status" });
      // Safari has no identity API, so no sign-in window to open.
      const clientReady = this.canSignIn(c);
      form.append(el("small", { class: "dash-note-small", text: c.oauth
        ? (clientReady ? say("dash.oauthNote", "You sign in with {who} in a window of theirs. Nordlys keeps the access on this device only.", { who: c.oauth === "google" ? "Google" : "Microsoft" }) : say("dash.oauthLater", "Signing in with {who} comes in the next update.", { who: c.oauth === "google" ? "Google" : "Microsoft" }))
        : say("dash.tokenNote", "The token stays on this device: not synced, not in backups. Nordlys talks to {app} directly and reads only your tasks.", { app: c.name }) }), status, error);
      const disconnect = this.connected(id) ? el("button", { type: "button", class: "glass-btn danger", text: say("dash.disconnect", "Disconnect"), onclick: () => {
        delete this.connections[id]; this.saveConnections(); dialog.close(); this.afterConnections();
      } }) : null;
      const submit = el("button", { type: "submit", class: "glass-btn accent", text: c.oauth ? say("dash.signIn", "Sign in") : say("dash.connect", "Connect"), disabled: !clientReady || undefined });
      form.append(el("div", { class: "dash-form-actions" }, [disconnect, el("button", { type: "button", class: "glass-btn", text: say("dash.cancel", "Cancel"), onclick: () => dialog.close() }), submit]));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        error.textContent = "";
        const creds = { ...saved };
        for (const [key, input] of Object.entries(inputs)) creds[key] = input.value.trim();
        if (!c.oauth && !C.ready(id, creds)) { error.textContent = say("dash.fillFields", "Fill in the fields above."); return; }
        const origins = C.originsOf(id, creds);
        const perms = typeof chrome !== "undefined" ? chrome.permissions : null;
        const go = async () => {
          submit.disabled = true;
          status.textContent = say("dash.checking", "Checking…");
          try {
            const finalCreds = c.oauth ? { ...creds, ...(await C.signIn(id)) } : creds;
            const found = await C.list(id, finalCreds);
            this.connections[id] = finalCreds;
            this.saveConnections();
            status.textContent = say("dash.connectedFound", "Connected. {count} found.", { count: found.length });
            setTimeout(() => dialog.close(), 700);
            this.afterConnections();
          } catch (e) {
            status.textContent = "";
            error.textContent = e.message || String(e);
            submit.disabled = false;
          }
        };
        // Chrome and Edge ask for identity when it is first needed; Firefox
        // grants it at install and refuses a request for it.
        const optional = (typeof chrome !== "undefined" && chrome.runtime?.getManifest?.().optional_permissions) || ["identity"];
        const permissions = c.oauth && optional.includes("identity") ? ["identity"] : [];
        if (!perms?.request) { go(); return; }
        perms.request({ origins, ...(permissions.length ? { permissions } : {}) }, (granted) => {
          if (granted) go();
          else error.textContent = say("dash.aiNoLeave", "Without leave to reach {site}, Nordlys can't ask it.", { site: origins.map((o) => o.replace("/*", "")).join(", ") });
        });
      });
      dialog.addEventListener("close", () => dialog.remove());
      document.body.append(dialog);
      dialog.showModal();
      (Object.values(inputs)[0] || submit).focus();
    }
    afterConnections() {
      this.renderSection();
      for (const c of this.cards.values()) if (c.widget.type === "inbox" || c.widget.type === "agenda") { c.data.at = 0; c.update?.(); }
    }
    // An app behind a company sign-in needs its registered client id, and a
    // browser with a sign-in window (Safari has none).
    canSignIn(c) { return !c.oauth || (Boolean(window.NordlysOAuthClients?.[c.oauth]?.clientId) && window.NordlysPlatform?.name !== "safari"); }
    connectionsBlock() {
      const C = window.NordlysConnectors;
      if (!C) return null;
      return el("div", { class: "dash-connections" }, Object.entries(C.CONNECTORS).map(([id, c]) => el("button", {
        type: "button", class: `dash-connection${this.connected(id) ? " is-on" : ""}`, "data-focus-key": `conn-${id}`, onclick: () => this.openConnect(id)
      }, [this.brandIcon(id, 22), el("span", { class: "dash-connection-name", text: c.name }), el("small", { text: this.connected(id) ? say("dash.connected", "Connected") : !this.canSignIn(c) ? say("dash.soon", "Soon") : c.kind === "events" ? say("dash.kindEvents", "Events") : say("dash.kindTasks", "Tasks") })])));
    }
    // From the search box: "? question" asks the Ask card.
    async ask(question) {
      const card = await this.ensure("ai");
      card?.root.querySelector(".dash-ai-input")?.focus();
      await card?.ask?.(question);
    }
    async openSettings(widget) {
      if (widget.type === "ai") { this.openAiSettings(widget); return; }
      const type = TYPES[widget.type];
      const fields = [...(widget.type === "tasks" || widget.type === "notes" ? [{ key: "title", type: "text", value: "", label: () => say("dash.cardName", "Name of the card") }] : []), ...(type.settings || [])];
      const values = structuredClone(widget.settings || {});
      const form = el("form", { class: "dash-form" });
      const dialog = el("dialog", { class: "dash-dialog glass-panel", "aria-labelledby": "dash-dialog-title" }, [
        el("h2", { id: "dash-dialog-title", text: this.title(widget) }), form
      ]);
      for (const field of fields) {
        const id = `dash-field-${field.key}`;
        const label = el("label", { for: id, text: field.label() });
        let control;
        if (field.type === "select") {
          control = el("select", { id, class: "dash-input" }, field.options().map(([value, text]) => el("option", { value, text })));
          control.value = values[field.key] ?? field.value;
          control.addEventListener("change", () => { values[field.key] = control.value; });
        } else if (field.type === "sources") {
          const C = window.NordlysConnectors;
          const all = Object.keys(C.CONNECTORS).filter((cid) => C.CONNECTORS[cid].kind === field.kind);
          const chosen = new Set(Array.isArray(values[field.key]) ? values[field.key] : this.connectedOf(field.kind));
          control = el("div", { id, class: "dash-source-list" }, all.map((cid) => {
            const box = el("input", { type: "checkbox", disabled: !this.connected(cid) || undefined });
            box.checked = chosen.has(cid) && this.connected(cid);
            box.addEventListener("change", () => { if (box.checked) chosen.add(cid); else chosen.delete(cid); values[field.key] = [...chosen]; });
            return el("label", { class: "dash-source" }, [box, this.brandIcon(cid, 14), el("span", { text: C.CONNECTORS[cid].name }), this.connected(cid) ? null : el("button", { type: "button", class: "dash-link", text: say("dash.connect", "Connect"), onclick: () => this.openConnect(cid) })]);
          }));
        } else if (field.type === "textarea") {
          control = el("textarea", { id, class: "dash-input dash-textarea", rows: "5", maxlength: "4000" });
          control.value = values[field.key] ?? field.value ?? "";
          control.addEventListener("input", () => { values[field.key] = control.value; });
        } else if (field.type === "zones") {
          control = this.zonesField(id, values);
        } else if (field.type === "place") {
          control = this.placeField(id, values);
        } else {
          control = el("input", { id, class: "dash-input", type: field.type, min: field.min, max: field.max });
          control.value = values[field.key] ?? field.value ?? "";
          control.addEventListener("input", () => { values[field.key] = field.type === "number" ? Number(control.value) : control.value; });
        }
        form.append(el("div", { class: "dash-field" }, [label, control]));
      }
      const done = el("button", { type: "submit", class: "glass-btn accent", text: say("dash.save", "Save") });
      const cancel = el("button", { type: "button", class: "glass-btn", text: say("dash.cancel", "Cancel"), onclick: () => dialog.close() });
      form.append(el("div", { class: "dash-form-actions" }, [cancel, done]));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.change(widget.id, (w) => ({ ...w, settings: values }));
        const data = this.data.get(widget.id);
        if (widget.type === "weather" && data) { data.at = 0; this.persist(widget.id, data); }
        dialog.close();
      });
      dialog.addEventListener("close", () => { dialog.remove(); this.cards.get(widget.id)?.root.querySelector(".dash-menu-btn")?.focus(); });
      document.body.append(dialog);
      dialog.showModal();
      form.querySelector("input, select")?.focus();
    }
    zonesField(id, values) {
      const zones = [...(values.zones || [])];
      const list = el("ul", { class: "dash-zone-list" });
      const draw = () => list.replaceChildren(...zones.map((zone, i) => el("li", {}, [
        el("span", { text: zone.replace(/_/g, " ") }),
        el("button", { type: "button", class: "dash-icon-btn", "aria-label": say("dash.taskRemove", "Remove {task}", { task: zone.replace(/_/g, " ") }), onclick: () => { zones.splice(i, 1); values.zones = [...zones]; draw(); } }, icon(ICONS.close))
      ])));
      const listId = `${id}-options`;
      const input = el("input", { id, class: "dash-input", type: "text", list: listId, placeholder: say("dash.clocksAdd", "Type a city, then Enter"), autocomplete: "off" });
      const options = el("datalist", { id: listId }, K.zones().map((zone) => el("option", { value: zone.replace(/_/g, " ") })));
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const typed = input.value.trim().toLowerCase().replace(/ /g, "_");
        const zone = K.zones().find((z) => z.toLowerCase() === typed) || K.zones().find((z) => z.toLowerCase().endsWith(`/${typed}`));
        if (!zone || zones.includes(zone) || zones.length >= 6) return;
        zones.push(zone);
        values.zones = [...zones];
        input.value = "";
        draw();
      });
      draw();
      return el("div", { class: "dash-zones" }, [list, input, options]);
    }
    placeField(id, values) {
      const current = el("p", { class: "dash-place-now", text: values.place ? values.place.label || values.place.name : say("dash.weatherNone", "No place yet") });
      const results = el("ul", { class: "dash-place-results", role: "listbox" });
      const input = el("input", { id, class: "dash-input", type: "search", placeholder: say("dash.weatherSearch", "Search for a city"), autocomplete: "off" });
      let timer = 0;
      input.addEventListener("input", () => {
        clearTimeout(timer);
        const name = input.value.trim();
        if (name.length < 2) { results.replaceChildren(); return; }
        timer = setTimeout(async () => {
          try {
            const answer = await fetch(K.weather.searchUrl(name, locale())).then((r) => r.json());
            results.replaceChildren(...(answer.results || []).map((r) => {
              const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
              return el("li", {}, el("button", { type: "button", class: "dash-link", text: label, onclick: () => {
                values.place = { name: r.name, label, lat: +r.latitude.toFixed(3), lon: +r.longitude.toFixed(3) };
                current.textContent = label;
                results.replaceChildren();
                input.value = "";
              } }));
            }));
          } catch (error) {
            results.replaceChildren(el("li", { class: "dash-empty", text: say("dash.weatherOffline", "No forecast right now") }));
          }
        }, 350);
      });
      return el("div", { class: "dash-place" }, [current, input, results, el("small", { class: "dash-note-small", text: say("dash.weatherPrivacy", "The city you search for and its forecast are asked from Open-Meteo. Nothing else is sent.") })]);
    }

    // ── Weather, fetched at most every half hour ─────────────────
    async refreshWeather(card) {
      const place = card.settings.place;
      if (!place || card.loading) return;
      const key = `${place.lat},${place.lon},${card.settings.units}`;
      if (card.data.key === key && Date.now() - card.data.at < 30 * 60000 && card.data.forecast) return;
      card.loading = true;
      try {
        const answer = await fetch(K.weather.url({ lat: place.lat, lon: place.lon, units: card.settings.units })).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
        const forecast = K.weather.parse(answer);
        if (!forecast) throw new Error("empty");
        card.data = { at: Date.now(), key, forecast };
      } catch (error) {
        card.data = { ...card.data, at: Date.now() - 25 * 60000, error: true };
      } finally {
        card.loading = false;
      }
      card.save();
      if (this.cards.get(card.widget.id) === card) card.redraw?.();
    }

    /* A soft two-note chime when a focus or a break ends. */
    chime(phase) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.chimeCtx ||= new AudioCtx();
        const ctx = this.chimeCtx;
        const notes = phase === "rest" ? [880, 660] : [660, 880];
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = ctx.currentTime + i * 0.28;
          osc.frequency.value = f;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 1.5);
        });
      } catch (error) { /* no sound: the face still says it */ }
      window.NordlysUI?.announce?.(phase === "rest" ? say("dash.timerRestNow", "Focus done. Time for a break.") : say("dash.timerFocusNow", "Break over."));
    }
  }

  NordlysDashboard.TYPES = TYPES;
  window.NordlysDashboard = NordlysDashboard;
})();
