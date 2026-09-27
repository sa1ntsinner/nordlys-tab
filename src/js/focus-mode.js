/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - FOCUS MODE
   ═══════════════════════════════════════════════════════════════════

   The whole page given to one thing: the sky, dimmed; a large timer in a
   ring; what you said you would do; a sound if you want one; your tasks at
   the side and how long you have focused today at the foot. The timer is
   the same one the dashboard's timer cards show (the "focus-timer" key in
   dashboard.js), so starting it here or there is starting the same timer.

   Opened from a timer card, "> focus" or the Focus button of the dashboard;
   Escape or the cross closes it. A small floating window keeps the time in
   sight over other tabs where the browser offers Document Picture-in-Picture. */
(function () {
  "use strict";

  const K = window.NordlysWidgetKit;
  const KEY = "focus-timer";
  const say = (key, fallback, params) => {
    const value = window.I18N?.t(key, params || {});
    const text = value && value !== key ? value : fallback;
    return params ? text.replace(/\{(\w+)\}/g, (all, name) => (params[name] ?? all)) : text;
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
  const svg = (path, cls = "") => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("aria-hidden", "true");
    if (cls) node.setAttribute("class", cls);
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    node.append(p);
    return node;
  };
  const ICON = {
    close: "M6 6l12 12M18 6 6 18",
    play: "M8 5v14l11-7z",
    pause: "M8 5h3v14H8zM13 5h3v14h-3z",
    stop: "M7 7h10v10H7z",
    reset: "M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6",
    skip: "M5 5l9 7-9 7zM17 5v14",
    plus: "M12 5v14M5 12h14",
    pip: "M3 5h18v14H3zM12 12h7v5h-7z",
    full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    sound: "M4 9v6h4l5 4V5L8 9H4ZM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
    flame: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2 2 3 1-2 1-4 1-6Z"
  };
  const MANTRAS = [
    () => say("focus.mantra1", "One thing at a time."),
    () => say("focus.mantra2", "Slow is smooth, smooth is fast."),
    () => say("focus.mantra3", "Stay with it a little longer."),
    () => say("focus.mantra4", "Deep work is quiet work."),
    () => say("focus.mantra5", "Breathe out. Begin again."),
    () => say("focus.mantra6", "The next small step is enough.")
  ];
  const SOUNDS = [
    ["rain", () => say("dash.sound.rain", "Rain")], ["ocean", () => say("dash.sound.ocean", "Ocean")],
    ["brown", () => say("dash.sound.brown", "Deep noise")], ["wind", () => say("dash.sound.wind", "Wind")],
    ["aurora", () => say("dash.sound.aurora", "Aurora pad")]
  ];

  class NordlysFocusMode {
    constructor(app) {
      this.app = app;
      this.root = null;
      this.ticker = 0;
      this.pip = null;
      this.onKey = this.onKey.bind(this);
      document.addEventListener("nordlys:dashdata", (event) => { if (this.open && event.detail?.key === KEY) this.draw(); });
    }
    get dash() { return this.app.dashboard; }
    get open() { return Boolean(this.root && !this.root.hidden); }
    get sounds() { return this.dash.sounds; }

    /* It opens at once, keys and all; the timer it reads may still be on
       its way from storage, and is drawn the moment it is there. */
    async show() {
      if (!this.dash || this.open) return;
      this.opener = document.activeElement;
      this.timer = this.dash.data.get(KEY) || this.timer || K.timer.create({ focus: 25, rest: 5 });
      if (!this.root) this.build();
      this.root.hidden = false;
      document.body.classList.add("focus-mode-open");
      requestAnimationFrame(() => this.root.classList.add("is-open"));
      document.addEventListener("keydown", this.onKey, true);
      this.draw();
      this.go.focus({ preventScroll: true });
      this.timer = await this.dash.shared(KEY, () => this.timer);
      this.draw();
      this.tick();
      this.go.focus({ preventScroll: true });
      window.NordlysUI?.announce?.(say("focus.opened", "Focus mode. Escape closes it."));
    }

    hide() {
      if (!this.open) return;
      this.root.classList.remove("is-open");
      document.body.classList.remove("focus-mode-open");
      document.removeEventListener("keydown", this.onKey, true);
      if (!this.pip || this.pip.closed) clearInterval(this.ticker);
      const { still, duration } = this.dash.motion();
      setTimeout(() => { if (!this.root.classList.contains("is-open")) this.root.hidden = true; }, still ? 0 : duration);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      this.opener?.focus?.({ preventScroll: true });
    }

    onKey(event) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        this.hide();
      } else if (event.key === " " && !event.target.closest("input, textarea, button, [role='radio']")) {
        event.preventDefault();
        this.toggle();
      } else if (event.key === "Tab") {
        // Focus stays inside, as in any dialog.
        const stops = [...this.root.querySelectorAll("button, input, [tabindex]")].filter((node) => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
        if (!stops.length) return;
        const at = stops.indexOf(document.activeElement);
        if (event.shiftKey && at <= 0) { event.preventDefault(); stops[stops.length - 1].focus(); }
        else if (!event.shiftKey && at === stops.length - 1) { event.preventDefault(); stops[0].focus(); }
      }
    }

    // ── The page ─────────────────────────────────────────────────
    build() {
      const button = (cls, path, label, run) => el("button", { type: "button", class: cls, "aria-label": label, title: label, onclick: run }, svg(path));
      this.go = el("button", { type: "button", class: "fm-go", onclick: () => this.toggle() });
      this.face = el("div", { class: "fm-face", role: "timer", "aria-live": "off" });
      this.phaseText = el("div", { class: "fm-phase" });
      this.status = el("span", { class: "fm-status-text" });
      this.statusDot = el("span", { class: "fm-status-dot", "aria-hidden": "true" });
      this.ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.ring.setAttribute("viewBox", "0 0 200 200");
      this.ring.setAttribute("class", "fm-ring-svg");
      this.ring.setAttribute("aria-hidden", "true");
      for (const name of ["track", "fill"]) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", name);
        circle.setAttribute("cx", "100"); circle.setAttribute("cy", "100"); circle.setAttribute("r", "94");
        circle.setAttribute("pathLength", "100");
        this.ring.append(circle);
      }
      this.intent = el("input", { type: "text", class: "fm-intent", maxlength: "140", placeholder: say("focus.intent", "I will focus on…"), "aria-label": say("focus.intent", "I will focus on…") });
      this.intent.addEventListener("input", () => { this.timer.intent = this.intent.value; this.dash.saveShared(KEY, { soon: true }); });
      this.intent.addEventListener("keydown", (event) => { if (event.key === "Enter") { this.intent.blur(); if (!this.timer.running) this.toggle(); } });
      this.modes = el("div", { class: "fm-modes", role: "radiogroup", "aria-label": say("focus.modeLabel", "Timer") },
        [["pomodoro", say("focus.pomodoro", "Pomodoro")], ["countup", say("focus.countup", "Count up")]].map(([mode, label]) => el("button", {
          type: "button", role: "radio", class: "fm-mode", dataset: { mode }, text: label,
          onclick: () => { if ((this.timer.mode || "pomodoro") === mode) return; this.stopSound(); K.timer.setMode(this.timer, mode); this.save(); this.draw(); }
        })));
      this.statsLine = el("p", { class: "fm-stats" });
      this.mantra = el("p", { class: "fm-mantra" });
      this.soundRow = el("div", { class: "fm-sounds", role: "radiogroup", "aria-label": say("focus.sounds", "Sound") });
      this.volume = el("input", { type: "range", class: "fm-volume", min: "0", max: "100", "aria-label": say("focus.volume", "Volume") });
      this.volume.addEventListener("input", () => { this.timer.volume = Number(this.volume.value) / 100; this.sounds.setVolume?.(this.timer.volume); this.save({ soon: true }); });
      this.taskList = el("ul", { class: "fm-tasks" });
      this.pipButton = button("fm-icon", ICON.pip, say("focus.pip", "Keep the timer in a small window"), () => this.openPip());
      if (!window.documentPictureInPicture) this.pipButton.hidden = true;

      this.root = el("div", { id: "focus-mode", class: "focus-mode", role: "dialog", "aria-modal": "true", "aria-label": say("focus.title", "Focus mode"), hidden: true }, [
        el("div", { class: "fm-veil" }),
        el("header", { class: "fm-top" }, [
          el("div", { class: "fm-status" }, [this.statusDot, this.status]),
          el("div", { class: "fm-top-actions" }, [
            this.pipButton,
            button("fm-icon", ICON.full, say("focus.fullscreen", "Full screen"), () => this.fullscreen()),
            button("fm-icon fm-close", ICON.close, say("focus.close", "Close focus mode"), () => this.hide())
          ])
        ]),
        el("main", { class: "fm-center" }, [
          this.modes,
          el("div", { class: "fm-ring" }, [this.ring, el("div", { class: "fm-read" }, [this.phaseText, this.face])]),
          this.intent,
          el("div", { class: "fm-controls" }, [
            button("fm-round", ICON.reset, say("dash.timerReset", "Reset"), () => { this.stopSound(); if (this.timer.mode === "countup") K.timer.stop(this.timer, Date.now()); else K.timer.reset(this.timer); this.save(); this.draw(); }),
            this.go,
            this.moreButton = el("button", { type: "button", class: "fm-round fm-more", "aria-label": say("focus.more", "Five more minutes"), title: say("focus.more", "Five more minutes"), onclick: () => { K.timer.more(this.timer, 5, Date.now()); this.save(); this.draw(); } }, [el("span", { text: "+5" })]),
            this.skipButton = button("fm-round", ICON.skip, say("focus.skip", "Skip to the next part"), () => { K.timer.skip(this.timer, Date.now()); this.syncSound(); this.save(); this.draw(); })
          ])
        ]),
        el("aside", { class: "fm-panel fm-left", "aria-label": say("focus.sounds", "Sound") }, [
          el("h2", {}, [svg(ICON.sound), el("span", { text: say("focus.sounds", "Sound") })]), this.soundRow, this.volume
        ]),
        el("aside", { class: "fm-panel fm-right", "aria-label": say("dash.tasks", "Tasks") }, [
          el("h2", { text: say("dash.tasks", "Tasks") }), this.taskList
        ]),
        el("footer", { class: "fm-foot" }, [this.statsLine, this.mantra])
      ]);
      document.body.append(this.root);
    }

    save(options) { this.dash.saveShared(KEY, options); }

    toggle() {
      const t = this.timer;
      const now = Date.now();
      if (t.running) { K.timer.pause(t, now); this.stopSound(); }
      else { K.timer.start(t, now); this.syncSound(); }
      this.save();
      this.draw();
    }

    // Sound plays while a focus runs, and never during a break.
    syncSound() {
      const t = this.timer;
      if (t.running && t.phase === "focus" && t.sound) {
        if (this.sounds.playing !== t.sound) this.sounds.play(t.sound, t.volume ?? 0.5).catch(() => {});
      } else this.stopSound();
    }
    stopSound() { if (this.sounds.playing) this.sounds.stop(); }

    tick() {
      clearInterval(this.ticker);
      this.ticker = setInterval(() => {
        // The small window keeps the time going after the page is closed.
        if (!this.open && (!this.pip || this.pip.closed)) { clearInterval(this.ticker); return; }
        const change = document.visibilityState === "visible" ? K.timer.tick(this.timer, Date.now()) : null;
        if (change) { this.save(); this.dash.chime(change); this.syncSound(); }
        this.draw();
      }, 1000);
    }

    draw() {
      if (!this.root) return;
      const t = this.timer = this.dash.data.get(KEY) || this.timer;
      const now = Date.now();
      const countup = t.mode === "countup";
      const left = countup ? K.timer.elapsed(t, now) : K.timer.remaining(t, now);
      this.face.textContent = K.timer.face(left);
      this.phaseText.textContent = countup ? say("focus.countup", "Count up") : t.phase === "focus" ? say("dash.timerFocus", "Focus") : say("dash.timerRest", "Break");
      const progress = countup ? (left % 3600000) / 3600000 : 1 - left / K.timer.length(t);
      this.root.style.setProperty("--fm-progress", String(Math.max(0, Math.min(1, progress))));
      this.root.classList.toggle("is-running", t.running);
      this.root.classList.toggle("is-rest", !countup && t.phase === "rest");
      this.status.textContent = t.running ? (t.phase === "rest" && !countup ? say("focus.onBreak", "On a break") : say("focus.focusing", "Focusing")) : say("focus.ready", "Ready when you are");
      this.go.replaceChildren(svg(t.running ? ICON.pause : ICON.play));
      this.go.setAttribute("aria-label", t.running ? say("dash.timerPause", "Pause") : say("dash.timerStart", "Start"));
      this.moreButton.hidden = countup;
      this.skipButton.hidden = countup;
      for (const mode of this.modes.children) {
        const on = mode.dataset.mode === (countup ? "countup" : "pomodoro");
        mode.setAttribute("aria-checked", String(on));
        mode.tabIndex = on ? 0 : -1;
      }
      if (document.activeElement !== this.intent) this.intent.value = t.intent || "";
      // How the day is going.
      const minutes = K.timer.minutes(t, now);
      const streak = K.timer.streak(t, now);
      const parts = [say("focus.today", "Today: {min} min", { min: minutes }), say("focus.sessions", "{count} sessions", { count: K.timer.sessions(t, now) })];
      if (streak > 1) parts.push(say("focus.streak", "{days} days in a row", { days: streak }));
      this.statsLine.textContent = parts.join("  ·  ");
      const day = Math.floor(now / 86400000);
      this.mantra.textContent = MANTRAS[day % MANTRAS.length]();
      this.drawSounds();
      this.drawTasks();
      this.drawPip();
    }

    drawSounds() {
      const t = this.timer;
      if (document.activeElement !== this.volume) this.volume.value = String(Math.round((t.volume ?? 0.5) * 100));
      const chips = [["", () => say("dash.soundNone", "None")], ...SOUNDS];
      if (this.soundRow.children.length !== chips.length) {
        this.soundRow.replaceChildren(...chips.map(([kind, name]) => el("button", {
          type: "button", role: "radio", class: "fm-chip", dataset: { sound: kind }, text: name(),
          onclick: () => { t.sound = kind; this.save(); this.syncSound(); this.drawSounds(); }
        })));
      }
      for (const chip of this.soundRow.children) {
        const on = (chip.dataset.sound || "") === (t.sound || "");
        chip.setAttribute("aria-checked", String(on));
        chip.tabIndex = on ? 0 : -1;
      }
      this.volume.disabled = !t.sound;
    }

    /* The first task list of the dashboard, to tick off without leaving. */
    drawTasks() {
      const widget = this.dash.widgets().find((w) => w.type === "tasks");
      const list = widget ? this.dash.data.get(widget.id) : null;
      const panel = this.taskList.closest(".fm-panel");
      panel.hidden = !list;
      if (!list) return;
      const view = K.tasks.view(list, Date.now()).slice(0, 8);
      const signature = JSON.stringify(view.map((task) => [task.id, task.done, task.text]));
      if (signature === this.taskSignature) return;
      this.taskSignature = signature;
      this.taskList.replaceChildren(...(view.length ? view.map((task) => {
        const check = el("input", { type: "checkbox", class: "dash-check", "aria-label": task.text });
        check.checked = task.done;
        check.addEventListener("change", () => {
          K.tasks.toggle(list, task.id, Date.now());
          this.dash.persist(widget.id, list);
          this.dash.refreshKey(widget.id, list);
          this.taskSignature = "";
          this.drawTasks();
        });
        return el("li", { class: task.done ? "is-done" : "" }, [check, el("span", { text: task.text })]);
      }) : [el("li", { class: "fm-empty", text: say("dash.tasksEmpty", "Nothing on the list") })]));
    }

    fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else this.root.requestFullscreen?.().catch(() => {});
    }

    // ── A small window that stays over other tabs ────────────────
    async openPip() {
      if (!window.documentPictureInPicture) return;
      if (this.pip && !this.pip.closed) { this.pip.focus?.(); return; }
      try {
        const win = await window.documentPictureInPicture.requestWindow({ width: 240, height: 240 });
        this.pip = win;
        for (const sheet of document.querySelectorAll('link[rel="stylesheet"]')) win.document.head.append(sheet.cloneNode());
        win.document.documentElement.className = document.documentElement.className;
        for (const attr of ["data-theme", "data-corners"]) if (document.documentElement.hasAttribute(attr)) win.document.documentElement.setAttribute(attr, document.documentElement.getAttribute(attr));
        win.document.documentElement.style.cssText = document.documentElement.style.cssText;
        win.document.body.className = "fm-pip-body";
        this.pipFace = el("div", { class: "fm-pip-face" });
        this.pipPhase = el("div", { class: "fm-pip-phase" });
        this.pipGo = el("button", { type: "button", class: "fm-go fm-pip-go", onclick: () => this.toggle() });
        win.document.body.append(el("div", { class: "fm-pip" }, [this.pipPhase, this.pipFace, this.pipGo]));
        win.addEventListener("pagehide", () => { this.pip = null; });
        this.drawPip();
        this.tick();
      } catch (error) { /* the browser said no: the page timer is still here */ }
    }
    drawPip() {
      if (!this.pip || this.pip.closed) return;
      this.pipFace.textContent = this.face.textContent;
      this.pipPhase.textContent = this.phaseText.textContent;
      this.pipGo.replaceChildren(svg(this.timer.running ? ICON.pause : ICON.play));
      this.pipGo.setAttribute("aria-label", this.go.getAttribute("aria-label"));
    }
  }

  window.NordlysFocusMode = NordlysFocusMode;
})();
