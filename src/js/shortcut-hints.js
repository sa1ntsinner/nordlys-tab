/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE KEY FOR WHAT THE POINTER IS RESTING ON
   ═══════════════════════════════════════════════════════════════════

   Rest the mouse on something that has a shortcut and, after a moment, a
   small label says what it is and which keys do the same. It is the
   browser's tooltip done properly: one look for every control, the keys
   drawn as keys, and nothing at all for a touch, a pen, a passing pointer
   or a keyboard user (who has ? for the whole list).

   SHORTCUTS is the one list of keys the page answers to. app.js handles
   them; the Support legend and the ? sheet print them; this file points at
   them from the controls. A control names its shortcut with
   data-shortcut-hint="<id>", or is found by the selector below. */
(function (root) {
  "use strict";

  const mac = () => String(root.navigator?.platform || "").toUpperCase().includes("MAC");
  const mod = () => (mac() ? "⌘" : "Ctrl");
  const alt = () => (mac() ? "⌥" : "Alt");
  const say = (key, fallback) => { const value = root.I18N?.t(key); return value && value !== key ? value : fallback; };

  // id → the keys (each a chord of caps), and where on the page it lives.
  const SHORTCUTS = {
    search: { keys: () => [["/"], [mod(), "K"]], at: "#search, #q", name: () => say("hint.search", "Search") },
    settings: { keys: () => [[mod(), ","]], at: "#gear" },
    close: { keys: () => [["Esc"]], at: "#cfgx" },
    undo: { keys: () => [[mod(), "Z"]], at: ".toast-action" },
    dashboard: { keys: () => [["D"]] },
    focus: { keys: () => [["F"]] },
    timer: { keys: () => [["T"]] },
    newFolder: { keys: () => [["N"]], at: "#board-empty-create" },
    arrange: { keys: () => [["A"]], at: "#board .groupGrip" },
    shuffle: { keys: () => [["S"]], at: "#bg-shuffle" },
    mode: { keys: () => [["L"]], at: "#color-mode-switcher" },
    profile: { keys: () => [["P"]], at: "#profile-chip" },
    sheet: { keys: () => [["?"]] },
    // The first nine tiles, by the number each one carries.
    tile: { keys: (node) => [[alt(), node.dataset.shortcut]], at: "#board .tile[data-shortcut]", wait: 900 }
  };

  const WAIT = 450;

  // What the control is called: its own name, which the title used to carry.
  function nameOf(node, entry) {
    return entry?.name?.() || node.dataset.hintName || node.getAttribute("aria-label") || node.dataset.titleWas || node.querySelector(".lbl")?.textContent || "";
  }

  function find(target) {
    if (!(target instanceof Element)) return null;
    const named = target.closest("[data-shortcut-hint]");
    if (named && SHORTCUTS[named.dataset.shortcutHint]) return { node: named, id: named.dataset.shortcutHint };
    for (const [id, entry] of Object.entries(SHORTCUTS)) {
      if (!entry.at) continue;
      const node = target.closest(entry.at);
      if (node) return { node, id };
    }
    return null;
  }

  class ShortcutHints {
    constructor({ enabled = () => true } = {}) {
      this.enabled = enabled;
      this.timer = 0;
      this.current = null;
      this.bubble = null;
      document.addEventListener("pointerover", (event) => this.over(event), { passive: true });
      document.addEventListener("pointerout", (event) => { if (this.current && !this.current.node.contains(event.relatedTarget)) this.leave(); }, { passive: true });
      // A click or a key puts it away, and it stays away until the pointer leaves.
      for (const type of ["pointerdown", "keydown", "wheel"]) document.addEventListener(type, () => this.hide(), { capture: true, passive: true });
      window.addEventListener("blur", () => this.leave());
      window.addEventListener("scroll", () => this.hide(), { capture: true, passive: true });
    }

    over(event) {
      if (event.pointerType !== "mouse" || !this.enabled()) return;
      const found = find(event.target);
      if (!found || found.node === this.current?.node) return;
      this.leave();
      // The browser's own tooltip would sit on top of this one: it steps aside.
      if (found.node.hasAttribute("title")) {
        found.node.dataset.titleWas = found.node.getAttribute("title");
        found.node.removeAttribute("title");
      }
      this.current = found;
      this.timer = setTimeout(() => this.show(found), SHORTCUTS[found.id].wait || WAIT);
    }

    show({ node, id }) {
      if (!node.isConnected || !this.enabled()) return;
      const chords = SHORTCUTS[id].keys(node).filter((chord) => chord.every(Boolean));
      if (!chords.length) return;
      const bubble = document.createElement("div");
      bubble.className = "shortcut-hint";
      bubble.setAttribute("role", "presentation");
      bubble.setAttribute("aria-hidden", "true");
      const name = nameOf(node, SHORTCUTS[id]).trim();
      if (name) {
        const label = document.createElement("span");
        label.className = "shortcut-hint-name";
        label.textContent = name;
        bubble.append(label);
      }
      const keys = document.createElement("span");
      keys.className = "shortcut-hint-keys";
      chords.forEach((chord, index) => {
        if (index) {
          const or = document.createElement("span");
          or.className = "shortcut-hint-or";
          or.textContent = say("hint.or", "or");
          keys.append(or);
        }
        for (const cap of chord) {
          const kbd = document.createElement("kbd");
          kbd.textContent = cap;
          keys.append(kbd);
        }
      });
      bubble.append(keys);
      document.body.append(bubble);
      // Above the control, or below it when there is no room; never off screen.
      const box = node.getBoundingClientRect();
      const width = bubble.offsetWidth;
      const height = bubble.offsetHeight;
      const below = box.top - height - 10 < 8;
      bubble.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, box.left + box.width / 2 - width / 2))}px`;
      bubble.style.top = `${below ? box.bottom + 10 : box.top - height - 10}px`;
      bubble.dataset.side = below ? "below" : "above";
      requestAnimationFrame(() => bubble.classList.add("on"));
      this.bubble = bubble;
    }

    hide() {
      clearTimeout(this.timer);
      this.timer = 0;
      this.bubble?.remove();
      this.bubble = null;
    }

    // The pointer has gone: the control gets its own title back.
    leave() {
      this.hide();
      const node = this.current?.node;
      if (node?.dataset.titleWas !== undefined) { node.setAttribute("title", node.dataset.titleWas); delete node.dataset.titleWas; }
      this.current = null;
    }
  }

  root.NordlysShortcutHints = { ShortcutHints, SHORTCUTS, find };
})(typeof globalThis !== "undefined" ? globalThis : this);
