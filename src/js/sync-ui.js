/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - PROFILES AND SYNC ON SCREEN
   ═══════════════════════════════════════════════════════════════════

   Everything a person sees of sync-client.js: the profile chip under the
   greeting and its menu, the "This device" items in the bookmark and folder
   menus, the Appearance switch for a look kept on this device, and the
   Sync & profiles section of Settings. All of it reads the client, and all
   of it redraws when the client says something changed. */
(function () {
  "use strict";

  const COLORS = () => window.NordlysProfiles?.COLORS || ["teal"];
  const say = (key, fallback, params) => {
    const value = window.I18N?.t(key, params || {});
    return value && value !== key ? value : fallback;
  };
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (key === "html") node.innerHTML = value;
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };
  const dot = (color) => el("span", { class: "profile-dot", dataset: { color: color || "teal" }, "aria-hidden": "true" });

  function ago(time) {
    if (!time) return "";
    const seconds = Math.round((time - Date.now()) / 1000);
    const format = new Intl.RelativeTimeFormat(window.I18N?.currentLang || "en", { numeric: "auto" });
    const steps = [[60, "second"], [3600, "minute"], [86400, "hour"], [Infinity, "day"]];
    let unit = 1;
    for (const [limit, name] of steps) {
      if (Math.abs(seconds) < limit) return format.format(Math.round(seconds / unit), name);
      unit = limit;
    }
    return "";
  }

  class NordlysSyncUI {
    constructor(app) {
      this.app = app;
      this.client = app.sync;
      if (!this.client) return;
      this.chip = document.getElementById("profile-chip");
      this.menuRoot = document.getElementById("profile-menu");
      this.menu = this.menuRoot && window.NordlysUI ? new window.NordlysUI.MenuController(this.menuRoot) : null;
      this.section = document.getElementById("sec-sync");
      this.buildForm();
      this.bindChip();
      this.bindDeviceMenus();
      this.buildLookRow();
      this.client.onChange(() => this.refresh());
      window.addEventListener("nordlys:languagechange", () => this.refresh());
      this.client.ready.then(() => { this.openOnStartProfile(); this.refresh(); });
      this.refresh();
    }

    refresh() {
      this.renderChip();
      this.renderLookRow();
      if (this.section) this.renderSection();
    }

    // ── The chip and its menu ─────────────────────────────────────
    bindChip() {
      if (!this.chip || !this.menu) return;
      this.chip.addEventListener("click", () => {
        if (this.menu.isOpen) { this.menu.close(); return; }
        this.renderMenu();
        const box = this.chip.getBoundingClientRect();
        this.menu.open(this.chip, { x: box.left + box.width / 2 - 110, y: box.bottom + 6 });
        this.chip.setAttribute("aria-expanded", "true");
      });
      const observer = new MutationObserver(() => { if (!this.menu.isOpen) this.chip.setAttribute("aria-expanded", "false"); });
      observer.observe(this.menuRoot, { attributes: true, attributeFilter: ["aria-hidden"] });
      document.addEventListener("pointerdown", (event) => {
        if (this.menu.isOpen && !this.menuRoot.contains(event.target) && !this.chip.contains(event.target)) this.menu.close();
      }, true);
    }

    renderChip() {
      if (!this.chip) return;
      const list = this.client.list();
      const active = this.client.active();
      this.chip.hidden = list.length < 2;
      this.chip.querySelector(".profile-name").textContent = active?.name || "";
      this.chip.querySelector(".profile-dot").dataset.color = active?.color || "teal";
      this.chip.setAttribute("aria-label", say("profiles.chipLabel", `Profile: ${active?.name}. Change profile`, { name: active?.name || "" }));
    }

    renderMenu() {
      const active = this.client.active();
      const item = (label, onClick, extra = {}) => el("div", { class: `ctx-item${extra.class ? ` ${extra.class}` : ""}`, tabindex: "-1", onclick: (event) => { event.preventDefault(); this.menu.close(); onClick(); } }, [extra.lead || null, el("span", { text: label }), extra.trail || null]);
      const rows = this.client.list().map((profile) => item(profile.name, () => this.client.switchTo(profile.id), {
        class: profile.id === active.id ? "is-current" : "",
        lead: dot(profile.color),
        trail: profile.id === active.id ? el("span", { class: "profile-check", "aria-hidden": "true", text: "✓" }) : null
      }));
      rows.forEach((row, index) => { if (this.client.list()[index].id === active.id) row.setAttribute("aria-current", "true"); });
      this.menuRoot.replaceChildren(
        el("div", { class: "ctx-header" }, el("span", { class: "ctx-target-title", text: say("profiles.title", "Profiles") })),
        ...rows,
        el("div", { class: "ctx-divider" }),
        item(say("profiles.new", "New profile"), () => this.newProfile(), { lead: el("span", { class: "profile-plus", "aria-hidden": "true", text: "+" }) }),
        item(say("profiles.manage", "Manage profiles"), () => this.app.settings?.open?.("sync"))
      );
    }

    // ── A small form ──────────────────────────────────────────────
    buildForm() {
      this.formRoot = document.getElementById("nl-form-modal");
      if (!this.formRoot || !window.NordlysUI) return;
      this.form = document.getElementById("nl-form");
      this.formDialog = new window.NordlysUI.DialogController(this.formRoot, { closeOnBackdrop: true, onClose: () => this.finishForm(null) });
      document.getElementById("nl-form-x")?.addEventListener("click", () => this.formDialog.close());
      document.getElementById("nl-form-cancel")?.addEventListener("click", () => this.formDialog.close());
      this.form.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(this.form).entries());
        const required = [...this.form.querySelectorAll("[data-required]")].find((input) => !String(input.value).trim());
        if (required) { required.setAttribute("aria-invalid", "true"); required.focus(); return; }
        const done = this.pending;
        this.pending = null;
        this.formDialog.close();
        done?.(values);
      });
    }

    finishForm(values) {
      const done = this.pending;
      this.pending = null;
      done?.(values);
    }

    /* fields: [{ name, label, value, type: "text" | "choice", options: [[value, label, hint]] }] */
    ask({ title, fields, ok, note }) {
      if (!this.formDialog) return Promise.resolve(null);
      this.finishForm(null);
      document.getElementById("nl-form-title").textContent = title;
      document.getElementById("nl-form-ok").textContent = ok;
      const noteEl = document.getElementById("nl-form-note");
      noteEl.hidden = !note;
      noteEl.textContent = note || "";
      const box = document.getElementById("nl-form-fields");
      box.replaceChildren(...fields.map((field, index) => {
        const id = `nl-form-field-${index}`;
        if (field.type === "choice") {
          return el("fieldset", { class: "nl-choice" }, [
            el("legend", { class: "quick-label", text: field.label }),
            ...field.options.map(([value, label, hint], optionIndex) => el("label", { class: "nl-choice-option" }, [
              el("input", { type: "radio", name: field.name, value, checked: (field.value ?? field.options[0][0]) === value ? true : null, id: `${id}-${optionIndex}` }),
              el("span", {}, [el("b", { text: label }), hint ? el("small", { text: hint }) : null])
            ]))
          ]);
        }
        return el("div", {}, [
          el("label", { class: "quick-label", for: id, text: field.label }),
          el("input", { id, name: field.name, type: field.type || "text", class: "glass-input", value: field.value || "", maxlength: field.max || 200, "data-required": field.required ? true : null, autocomplete: "off", spellcheck: "false" })
        ]);
      }));
      return new Promise((resolve) => {
        this.pending = resolve;
        const first = box.querySelector("input[type=text], input[type=url], input:checked, input");
        this.formDialog.open(document.activeElement, first);
        if (first?.select && first.type !== "radio") first.select();
      });
    }

    async newProfile() {
      const values = await this.ask({
        title: say("profiles.newTitle", "New profile"),
        ok: say("profiles.create", "Create"),
        fields: [
          { name: "name", label: say("profiles.name", "Name"), required: true, max: 40 },
          { name: "from", label: say("profiles.startWith", "Start with"), type: "choice", value: "empty", options: [
            ["empty", say("profiles.fromEmpty", "An empty board"), say("profiles.fromEmptyHint", "The default look, no folders yet")],
            ["copy", say("profiles.fromCopy", "A copy of this one"), say("profiles.fromCopyHint", "Every folder, bookmark and the look")]
          ] }
        ]
      });
      if (!values) return;
      try { await this.client.create({ name: values.name, from: values.from }); }
      catch (error) { if (typeof toast === "function") toast(error.message, "error"); }
    }

    // ── This device, in the bookmark and folder menus ─────────────
    bindDeviceMenus() {
      const grid = this.app.grid;
      if (!grid) return;
      const openTile = grid.openTileContextMenu.bind(grid);
      grid.openTileContextMenu = (event, gIdx, lIdx) => {
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        const group = this.app.config.groups[gIdx];
        const show = this.client.syncing() && !group?.source?.folderId && !group?.local;
        const here = Boolean(link?.local);
        const different = !here && this.client.isDifferentHere(`l/${link?.id}`);
        this.showItems(grid.tileCtxMenu, show, {
          "device-here-only": here ? say("device.shareAgain", "Share with my other devices") : say("device.hereOnly", "Only on this device"),
          "device-different": !here ? say("device.different", "Different on this device…") : null,
          "device-shared": different ? say("device.useShared", "Use the shared one") : null
        });
        openTile(event, gIdx, lIdx);
      };
      const openFolder = grid.openFolderContextMenu.bind(grid);
      grid.openFolderContextMenu = (event, gIdx) => {
        const group = this.app.config.groups[gIdx];
        this.showItems(grid.folderCtxMenu, this.client.syncing() && !group?.source?.folderId, {
          "device-folder-here-only": group?.local ? say("device.shareAgain", "Share with my other devices") : say("device.hereOnly", "Only on this device")
        });
        openFolder(event, gIdx);
      };
      // Captured: each item's own listener stops the click from bubbling.
      grid.tileCtxMenu?.addEventListener("click", (event) => {
        const action = event.target.closest(".ctx-item")?.dataset.action;
        if (!action?.startsWith("device-")) return;
        const { gIdx, lIdx } = grid.activeTileTarget || {};
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (!link) return;
        grid.closeContextMenus();
        if (action === "device-here-only") this.client.setHereOnly(link, !link.local);
        else if (action === "device-different") this.differentHere(link);
        else if (action === "device-shared") this.client.setDifferentHere(`l/${link.id}`, null);
      }, true);
      grid.folderCtxMenu?.addEventListener("click", (event) => {
        if (event.target.closest(".ctx-item")?.dataset.action !== "device-folder-here-only") return;
        const group = this.app.config.groups[grid.activeFolderTarget];
        if (!group) return;
        grid.closeContextMenus();
        this.client.setHereOnly(group, !group.local);
      }, true);
    }

    showItems(menu, show, labels) {
      if (!menu) return;
      menu.querySelectorAll("[data-device-only]").forEach((node) => {
        const action = node.dataset.action;
        const label = action ? labels[action] : "";
        node.hidden = !show || (action && !label);
        if (label) node.querySelector("span").textContent = label;
      });
    }

    async differentHere(link) {
      const values = await this.ask({
        title: say("device.differentTitle", "Different on this device"),
        ok: say("modal.saveChanges", "Save changes"),
        note: say("device.differentNote2", "Your other devices keep the shared name and address."),
        fields: [
          { name: "name", label: say("modal.bookmarkName", "Bookmark Title"), value: link.name || "", max: 200 },
          { name: "url", label: say("modal.url", "URL"), value: link.url || "", type: "url", required: true, max: 2000 }
        ]
      });
      if (!values) return;
      let url;
      try { url = new URL(values.url.trim()); } catch { if (typeof toast === "function") toast(say("device.badAddress", "That isn't a web address."), "error"); return; }
      if (!/^https?:$/.test(url.protocol)) { if (typeof toast === "function") toast(say("device.badAddress", "That isn't a web address."), "error"); return; }
      const fields = { url: url.href };
      if (values.name.trim() && values.name.trim() !== link.name) fields.name = values.name.trim();
      await this.client.setDifferentHere(`l/${link.id}`, fields);
    }

    // ── Appearance: a look kept on this device ────────────────────
    buildLookRow() {
      const appearance = document.getElementById("sec-appearance");
      if (!appearance) return;
      const input = el("input", { type: "checkbox", id: "cfg-look-here" });
      input.addEventListener("change", () => this.client.setLookHere(input.checked));
      this.lookRow = el("div", { class: "row setting-row sync-look-row", hidden: true }, [
        el("span", { id: "cfg-look-here-label" }, [
          el("span", { text: say("device.lookHere", "Keep this look on this device only") }),
          el("small", { class: "row-hint", text: say("device.lookHereHint", "Your other devices keep the shared theme and background.") })
        ]),
        el("label", { class: "tg" }, [input, el("i")])
      ]);
      input.setAttribute("aria-labelledby", "cfg-look-here-label");
      appearance.querySelector("h3")?.after(this.lookRow);
      this.lookInput = input;
    }

    renderLookRow() {
      if (!this.lookRow) return;
      this.lookRow.hidden = !this.client.syncing();
      this.lookInput.checked = this.client.lookHere();
      this.lookRow.querySelector("span > span").textContent = say("device.lookHere", "Keep this look on this device only");
      this.lookRow.querySelector(".row-hint").textContent = say("device.lookHereHint", "Your other devices keep the shared theme and background.");
    }

    // ── Settings: Sync & profiles ─────────────────────────────────
    async renderSection() {
      const token = (this.renderToken = (this.renderToken || 0) + 1);
      const status = await this.client.status();
      if (token !== this.renderToken) return;
      const focusedAction = document.activeElement?.closest?.("#sec-sync") ? document.activeElement.dataset.focusKey : null;
      const parts = [el("h3", { text: say("sync.profilesTitle", "Profiles") }), this.profilesBlock()];
      parts.push(el("h3", { text: say("sync.title", "Sync") }), this.syncBlock(status));
      if (status.enabled) {
        parts.push(el("h3", { text: say("sync.deviceTitle", "This device") }), this.deviceBlock(status));
        parts.push(el("h3", { text: say("sync.devicesTitle", "Devices") }), this.devicesBlock(status));
      }
      this.section.replaceChildren(...parts);
      if (focusedAction) this.section.querySelector(`[data-focus-key="${focusedAction}"]`)?.focus({ preventScroll: true });
    }

    button(label, onClick, { key, danger, accent, small, aria } = {}) {
      return el("button", { type: "button", class: `glass-btn${danger ? " danger" : ""}${accent ? " accent" : ""}${small ? " small" : ""}`, text: label, onclick: onClick, "data-focus-key": key, "aria-label": aria });
    }

    profilesBlock() {
      const list = this.client.list();
      const active = this.client.active();
      const rows = list.map((profile, index) => {
        const current = profile.id === active.id;
        const nextColor = COLORS()[(COLORS().indexOf(profile.color) + 1) % COLORS().length];
        return el("li", { class: `sync-profile${current ? " is-current" : ""}` }, [
          el("button", { type: "button", class: "profile-color", "data-focus-key": `color-${profile.id}`, "aria-label": say("profiles.changeColor", `Change the colour of ${profile.name}`, { name: profile.name }), onclick: () => this.client.recolor(profile.id, nextColor) }, dot(profile.color)),
          el("span", { class: "sync-profile-name" }, [el("b", { text: profile.name }), current ? el("small", { text: say("profiles.inUse", "In use here") }) : null]),
          el("span", { class: "sync-profile-actions" }, [
            current ? null : this.button(say("profiles.open", "Open"), () => this.client.switchTo(profile.id), { key: `open-${profile.id}`, small: true }),
            this.button("↑", () => this.client.move(profile.id, index - 1), { key: `up-${profile.id}`, small: true, aria: say("profiles.moveUp", `Move ${profile.name} up`, { name: profile.name }) }),
            this.button("↓", () => this.client.move(profile.id, index + 1), { key: `down-${profile.id}`, small: true, aria: say("profiles.moveDown", `Move ${profile.name} down`, { name: profile.name }) }),
            this.button(say("profiles.rename", "Rename"), () => this.renameProfile(profile), { key: `rename-${profile.id}`, small: true }),
            current || list.length < 2 ? null : this.button(say("profiles.delete", "Delete"), () => this.deleteProfile(profile), { key: `delete-${profile.id}`, small: true, danger: true })
          ])
        ]);
      });
      rows[0]?.querySelector('[data-focus-key^="up-"]')?.setAttribute("disabled", "");
      rows[rows.length - 1]?.querySelector('[data-focus-key^="down-"]')?.setAttribute("disabled", "");
      const deleted = this.client.deleted().map((profile) => el("li", { class: "sync-deleted" }, [
        dot(profile.color), el("span", { text: profile.name }),
        this.button(say("profiles.restore", "Restore"), () => this.client.restore(profile.id), { key: `restore-${profile.id}`, small: true })
      ]));
      return el("div", { class: "sync-block" }, [
        el("p", { class: "backup-note", text: say("profiles.explain", "A profile is a whole setup: folders, bookmarks, look and layout. Language and the name in the greeting are the same in all of them.") }),
        el("ul", { class: "sync-profiles" }, rows),
        this.button(say("profiles.new", "New profile"), () => this.newProfile(), { key: "new-profile" }),
        deleted.length ? el("p", { class: "quick-label sync-deleted-title", text: say("profiles.recentlyDeleted", "Recently deleted") }) : null,
        deleted.length ? el("ul", { class: "sync-profiles" }, deleted) : null
      ]);
    }

    async renameProfile(profile) {
      const values = await this.ask({ title: say("profiles.renameTitle", "Rename profile"), ok: say("profiles.rename", "Rename"), fields: [{ name: "name", label: say("profiles.name", "Name"), value: profile.name, required: true, max: 40 }] });
      if (!values) return;
      try { this.client.rename(profile.id, values.name); } catch (error) { if (typeof toast === "function") toast(error.message, "error"); }
    }

    async deleteProfile(profile) {
      const ok = await (typeof confirmDialog === "function" ? confirmDialog({
        title: say("profiles.deleteTitle", `Delete ${profile.name}?`, { name: profile.name }),
        message: say("profiles.deleteMessage", "Its folders and bookmarks go with it. You can restore it for 30 days."),
        confirmText: say("profiles.delete", "Delete"), danger: true
      }) : Promise.resolve(true));
      if (ok) await this.client.remove(profile.id);
    }

    syncBlock(status) {
      if (!status.available) {
        return el("div", { class: "sync-block" }, el("p", { class: "backup-note", text: say("sync.unavailable", "Chrome sync isn't available here. Profiles still work on this device.") }));
      }
      const input = el("input", { type: "checkbox", id: "cfg-sync-on", checked: status.enabled ? true : null, "aria-labelledby": "cfg-sync-on-label" });
      input.addEventListener("change", () => this.toggleSync(input));
      const state = {
        off: say("sync.stateOff", "Off"),
        syncing: say("sync.stateSyncing", "Syncing…"),
        ready: status.lastSync ? say("sync.stateReady", `Synced ${ago(status.lastSync)}`, { when: ago(status.lastSync) }) : say("sync.stateReadyNow", "Synced"),
        full: say("sync.stateFull", "Chrome sync is full"),
        error: say("sync.stateError", "Couldn't sync")
      }[status.state] || "";
      const used = Math.min(100, Math.round((status.bytes || 0) / 1024));
      return el("div", { class: "sync-block" }, [
        el("div", { class: "row setting-row" }, [
          el("span", { id: "cfg-sync-on-label" }, [el("span", { text: say("sync.toggle", "Sync with my Google account") }), el("small", { class: "row-hint", text: say("sync.toggleHint", "Through Chrome's own sync, on every Chrome you're signed in to. Off by default.") })]),
          el("label", { class: "tg" }, [input, el("i")])
        ]),
        status.enabled ? el("div", { class: "sync-status", role: "status" }, [
          el("span", { class: `sync-state is-${status.state}`, text: state }),
          status.error ? el("span", { class: "sync-error", text: status.error }) : null,
          el("div", { class: "sync-meter", role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(used), "aria-label": say("sync.meterLabel", "Space used in Chrome sync") }, el("i", { style: `width:${used}%` })),
          el("small", { text: say("sync.meter", `${used} of 100 KB`, { used }) }),
          this.button(say("sync.now", "Sync now"), () => this.client.syncNow(), { key: "sync-now", small: true })
        ]) : null,
        el("p", { class: "backup-note", text: say("sync.stays", "What stays on each device: uploaded icon images, wallpapers and videos, custom CSS, folders that follow Chrome bookmarks, and recent searches.") })
      ]);
    }

    async toggleSync(input) {
      input.disabled = true;
      try {
        if (!input.checked) { await this.client.disable(); return; }
        let mode = "merge";
        if (await this.client.cloudHasData()) {
          const values = await this.ask({
            title: say("sync.firstTitle", "Your setup is already in sync"),
            ok: say("sync.firstOk", "Turn on sync"),
            note: say("sync.firstNote", "A backup of this device's setup is kept either way."),
            fields: [{ name: "mode", label: say("sync.firstQuestion", "What should happen on this device?"), type: "choice", value: "use-sync", options: [
              ["use-sync", say("sync.useSync", "Use what's in sync"), say("sync.useSyncHint", "This device takes the setup from your other devices")],
              ["merge", say("sync.merge", "Merge"), say("sync.mergeHint", "Keep both. Nothing is dropped")],
              ["replace-sync", say("sync.replace", "Replace sync with this device"), say("sync.replaceHint", "Your other devices get this setup")]
            ] }]
          });
          if (!values) { input.checked = false; return; }
          mode = values.mode;
        }
        await this.client.enable(mode);
      } finally {
        input.disabled = false;
        this.refresh();
      }
    }

    deviceBlock(status) {
      const start = localStorage.getItem("nordlys_device_start") || "last";
      const select = el("select", { id: "cfg-device-start", class: "glass-input", "aria-labelledby": "cfg-device-start-label" }, [
        el("option", { value: "last", text: say("sync.startLast", "The last one used"), selected: start === "last" ? true : null }),
        ...this.client.list().map((profile) => el("option", { value: profile.id, text: profile.name, selected: start === profile.id ? true : null }))
      ]);
      select.addEventListener("change", () => { try { localStorage.setItem("nordlys_device_start", select.value); } catch { /* a preference, not data */ } });
      const hereOnly = (this.app.config.groups || []).reduce((sum, group) => sum + (group.local ? 1 : 0) + (group.links || []).filter((link) => link.local).length, 0);
      const different = Object.keys(this.client.overrideCache).length;
      return el("div", { class: "sync-block" }, [
        el("div", { class: "row setting-row" }, [
          el("span", {}, [el("span", { text: say("sync.deviceName", "Name") }), el("small", { class: "row-hint", text: status.device?.name || "" })]),
          this.button(say("profiles.rename", "Rename"), () => this.renameDevice(status.device?.name), { key: "rename-device", small: true })
        ]),
        el("div", { class: "row setting-row" }, [el("span", { id: "cfg-device-start-label", text: say("sync.startWith", "Opens on") }), select]),
        el("p", { class: "backup-note", text: say("sync.localSummary", `${hereOnly} kept only here, ${different} different here. Right-click a bookmark or folder to change that.`, { here: hereOnly, different }) })
      ]);
    }

    async renameDevice(current) {
      const values = await this.ask({ title: say("sync.renameDevice", "Name this device"), ok: say("profiles.rename", "Rename"), fields: [{ name: "name", label: say("sync.deviceName", "Name"), value: current || "", required: true, max: 40 }] });
      if (values) await this.client.renameDevice(values.name);
    }

    devicesBlock(status) {
      const rows = (status.devices || []).map((device) => {
        const me = device.id === status.device?.id;
        return el("li", { class: "sync-device" }, [
          el("span", {}, [el("b", { text: device.name || say("sync.thisDevice", "This device") }), el("small", { text: me ? say("sync.thisOne", "This device") : device.seenAt ? say("sync.seen", `Seen ${ago(device.seenAt)}`, { when: ago(device.seenAt) }) : "" })]),
          me ? null : this.button(say("sync.forget", "Forget"), () => this.client.forget(device.id), { key: `forget-${device.id}`, small: true })
        ]);
      });
      return el("div", { class: "sync-block" }, [el("ul", { class: "sync-devices" }, rows), el("p", { class: "backup-note", text: say("sync.forgetHint", "Forgetting an old device frees its space in Chrome sync. Its changes stay.") })]);
    }

    /* A device set to always open on one profile does, once per new tab. */
    openOnStartProfile() {
      const start = localStorage.getItem("nordlys_device_start");
      if (!start || start === "last" || !this.client.profiles.has(start) || this.client.active().id === start) return;
      if (sessionStorage.getItem("nordlys_started")) return;
      try { sessionStorage.setItem("nordlys_started", "1"); } catch { /* no session, no harm */ }
      this.client.switchTo(start, { undo: false });
    }
  }

  window.NordlysSyncUI = NordlysSyncUI;
})();
