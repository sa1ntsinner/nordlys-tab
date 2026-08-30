/* Shared accessible interaction primitives. Loaded before all feature modules. */
(function () {
  const focusableSelector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  const layers = [];

  function visibleFocusable(root) {
    return [...root.querySelectorAll(focusableSelector)].filter(node => {
      if (node.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
      if (node.closest('details:not([open]) > :not(summary)')) return false;
      if (!node.getClientRects().length) return false;
      for (let current = node; current && current !== root.parentElement; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || style.contentVisibility === 'hidden') return false;
        if (current === root) break;
      }
      return true;
    });
  }

  class FocusScope {
    constructor(root) {
      this.root = root; this.opener = null; this.active = false;
      this.onKeyDown = this.onKeyDown.bind(this);
    }
    activate(opener = document.activeElement, initialFocus = null) {
      if (this.active) return;
      this.active = true; this.opener = opener;
      document.addEventListener('keydown', this.onKeyDown, true);
      this.focusInitial(initialFocus);
    }
    /* Initial focus is set once, here. Callers name their preferred target instead of
       focusing it later on a timer — a deferred focus overrides whatever the user
       already did in the meantime. */
    focusInitial(preferred = null) {
      const requested = typeof preferred === 'string' ? this.root.querySelector(preferred) : preferred;
      const target = (requested?.isConnected && requested) || this.root.querySelector('[autofocus]') || visibleFocusable(this.root)[0] || this.root;
      if (!this.root.hasAttribute('tabindex') && target === this.root) this.root.tabIndex = -1;
      target.focus({ preventScroll: true });
      const selectable = target instanceof HTMLTextAreaElement
        || (target instanceof HTMLInputElement && /^(text|search|url|tel|email|password)$/.test(target.type));
      if (selectable && target.value) target.select();
    }
    onKeyDown(event) {
      if (event.key !== 'Tab' || layers[layers.length - 1]?.scope !== this) return;
      const nodes = visibleFocusable(this.root);
      if (!nodes.length) { event.preventDefault(); this.root.focus(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    deactivate({ restore = true } = {}) {
      if (!this.active) return;
      this.active = false; document.removeEventListener('keydown', this.onKeyDown, true);
      if (restore && this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    }
  }

  function setLayerInteractive(layer, interactive) {
    if (!layer?.root) return;
    layer.root.inert = !interactive;
  }
  function pushLayer(layer) {
    const previous = layers[layers.length - 1]; setLayerInteractive(previous, false);
    layers.push(layer); setLayerInteractive(layer, true);
  }
  function removeLayer(layer) {
    const index = layers.lastIndexOf(layer); if (index >= 0) layers.splice(index, 1);
    setLayerInteractive(layer, false); setLayerInteractive(layers[layers.length - 1], true);
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !layers.length) return;
    event.preventDefault(); event.stopPropagation(); layers[layers.length - 1].close();
  }, true);
  document.addEventListener('focusin', event => {
    const top = layers[layers.length - 1];
    if (!top?.root || top.root.contains(event.target)) return;
    const target = visibleFocusable(top.root)[0] || top.root;
    target.focus({ preventScroll: true });
  }, true);

  class DialogController {
    constructor(root, options = {}) {
      this.root = root; this.options = options; this.scope = new FocusScope(root); this.isOpen = false;
      root.setAttribute('role', root.getAttribute('role') || 'dialog'); root.setAttribute('aria-modal', 'true');
      root.hidden = !root.classList.contains('open'); root.inert = root.hidden; root.setAttribute('aria-hidden', String(root.hidden));
      this.onBackdrop = event => { if (event.target === root && options.closeOnBackdrop !== false) this.close(); };
    }
    open(opener = document.activeElement, initialFocus = null) {
      if (this.isOpen) return;
      this.isOpen = true; this.root.hidden = false; this.root.inert = false; this.root.style.visibility = 'visible'; this.root.setAttribute('aria-hidden', 'false');
      this.root.classList.add('open'); this.root.addEventListener('pointerdown', this.onBackdrop);
      pushLayer(this); this.scope.activate(opener, initialFocus ?? this.options.initialFocus ?? null); this.options.onOpen?.();
    }
    close() {
      if (!this.isOpen) return;
      this.isOpen = false; this.root.classList.remove('open'); this.root.setAttribute('aria-hidden', 'true'); this.root.inert = true; this.root.style.removeProperty('visibility');
      this.root.removeEventListener('pointerdown', this.onBackdrop); removeLayer(this); this.scope.deactivate(); this.options.onClose?.();
      this.root.hidden = true;
    }
  }

  class RovingTabs {
    constructor(root, { orientation = 'horizontal', onSelect = null } = {}) {
      this.root = root; this.orientation = orientation; this.onSelect = onSelect;
      root.setAttribute('role', 'tablist'); root.setAttribute('aria-orientation', orientation);
      this.tabs = [...root.querySelectorAll('[role="tab"], [data-tab]')];
      this.handlers = new Map();
      this.tabs.forEach((tab, index) => {
        tab.setAttribute('role', 'tab'); tab.tabIndex = tab.getAttribute('aria-selected') === 'true' || (!index && !this.tabs.some(item => item.getAttribute('aria-selected') === 'true')) ? 0 : -1;
        const click = () => this.select(tab), keydown = event => this.onKey(event, tab);
        this.handlers.set(tab, { click, keydown }); tab.addEventListener('click', click); tab.addEventListener('keydown', keydown);
      });
    }
    select(tab) {
      this.tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
      tab.focus(); this.onSelect?.(tab.dataset.tab, tab);
    }
    onKey(event, tab) {
      const previous = this.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      const next = this.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      let index = this.tabs.indexOf(tab);
      if (event.key === previous) index = (index - 1 + this.tabs.length) % this.tabs.length;
      else if (event.key === next) index = (index + 1) % this.tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = this.tabs.length - 1;
      else return;
      event.preventDefault(); this.select(this.tabs[index]);
    }
    destroy() { this.handlers.forEach(({ click, keydown }, tab) => { tab.removeEventListener('click', click); tab.removeEventListener('keydown', keydown); }); this.handlers.clear(); }
  }

  class MenuController {
    constructor(root, { onAction = null } = {}) {
      this.root = root; this.onAction = onAction; this.opener = null; this.isOpen = false;
      root.hidden = true; root.inert = true; root.setAttribute('aria-hidden', 'true');
    }
    items() { return [...this.root.querySelectorAll('[role="menuitem"], .ctx-item')].filter(item => !item.hidden && !item.hasAttribute('disabled')); }
    open(opener, point) {
      this.position(point);
      if (this.isOpen) return;
      this.isOpen = true; this.opener = opener; this.root.hidden = false; this.root.inert = false; this.root.style.visibility = 'visible'; this.root.setAttribute('aria-hidden', 'false'); this.root.setAttribute('role', 'menu'); this.root.classList.add('open');
      const items = this.items();
      items.forEach(item => { item.setAttribute('role', 'menuitem'); item.tabIndex = -1; });
      this.position(point); pushLayer(this); items[0]?.focus({ preventScroll: true });
      this.root.addEventListener('keydown', this._key = event => this.onKey(event));
    }
    position(point) {
      if (!point) return;
      const wasHidden = this.root.hidden; if (wasHidden) { this.root.hidden = false; this.root.style.visibility = 'hidden'; }
      const width = this.root.offsetWidth || 220, height = this.root.offsetHeight || 220;
      this.root.style.left = `${Math.max(10, Math.min(point.x, innerWidth - width - 10))}px`;
      this.root.style.top = `${Math.max(10, Math.min(point.y, innerHeight - height - 10))}px`;
      if (wasHidden) { this.root.hidden = true; this.root.style.removeProperty('visibility'); }
    }
    onKey(event) {
      const items = this.items(); let index = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') index = (index + 1) % items.length;
      else if (event.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;
      else if (event.key === 'Home') index = 0; else if (event.key === 'End') index = items.length - 1;
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.activeElement?.click(); return; }
      else return; event.preventDefault(); items[index]?.focus();
    }
    close() { if (!this.isOpen) return; this.isOpen = false; this.root.classList.remove('open'); this.root.setAttribute('aria-hidden', 'true'); this.root.inert = true; this.root.style.removeProperty('visibility'); this.root.removeEventListener('keydown', this._key); removeLayer(this); this.root.hidden = true; if (this.opener?.isConnected) this.opener.focus(); }
  }

  /* ── Themed select ────────────────────────────────────────────────
     A native <select> paints operating-system chrome that no theme can reach.
     The element stays in the DOM, hidden, as the value and the event source —
     so every existing `.value =` and `change` listener keeps working — and this
     draws the visible control in theme colours on top of it.

     The list is portalled to <body> rather than left beside its trigger: opening
     a layer marks the one beneath it inert, and a list nested inside the drawer
     would be disabled by its own parent. */
  class SelectMenu {
    constructor(select) {
      this.select = select;
      this.trigger = document.createElement('button');
      this.trigger.type = 'button';
      this.trigger.className = 'nl-select';
      this.trigger.setAttribute('role', 'combobox');
      this.trigger.setAttribute('aria-haspopup', 'listbox');
      this.trigger.setAttribute('aria-expanded', 'false');
      // The name has to survive every shape the panel uses: an explicit aria-label,
      // a <label for>, a wrapping <label>, or a plain span sitting in the same row.
      const labelledBy = select.getAttribute('aria-labelledby');
      const rowLabel = select.id && document.querySelector(`label[for="${select.id}"]`);
      const inRow = select.closest('.row, .setting-row, .bookmark-summary-row, .bookmark-folder-actions');
      const nearby = rowLabel || select.closest('label') || inRow?.querySelector(':scope > span, :scope > label');
      const label = select.getAttribute('aria-label') || nearby?.textContent?.trim() || select.title;
      if (labelledBy) this.trigger.setAttribute('aria-labelledby', labelledBy);
      else if (label) this.trigger.setAttribute('aria-label', label);
      this.value = document.createElement('span'); this.value.className = 'nl-select-value';
      const caret = document.createElement('span'); caret.className = 'nl-select-caret'; caret.setAttribute('aria-hidden', 'true');
      this.trigger.append(this.value, caret);

      this.root = document.createElement('div');
      this.root.className = 'nl-select-list';
      this.root.setAttribute('role', 'listbox');
      this.root.hidden = true; this.root.inert = true;

      select.hidden = true;
      select.setAttribute('aria-hidden', 'true');
      select.tabIndex = -1;
      select.insertAdjacentElement('afterend', this.trigger);

      this.isOpen = false; this.typed = ''; this.typedAt = 0;
      this.trigger.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
      this.trigger.addEventListener('keydown', event => this.onTriggerKey(event));
      this.root.addEventListener('keydown', event => this.onListKey(event));
      /* An open list closes when the page moves under it, because the trigger it
         is anchored to has moved. Its own inner scrolling is not that: the list
         scrolls whenever a row is brought into view, which is exactly what
         type-ahead and a keyboard walk past the visible rows both do. Reacting
         to it meant typing the first letter of any option below the fold shut
         the list and put the old value back. */
      this.onReposition = (event) => {
        if (event?.target instanceof Node && this.root.contains(event.target)) return;
        if (this.isOpen) this.close();
      };
      this.sync();
    }

    options() { return [...this.select.options]; }
    rows() { return [...this.root.querySelectorAll('[role="option"]')]; }

    sync() {
      const current = this.select.selectedOptions[0];
      this.value.textContent = current ? current.textContent.trim() : '';
      if (current?.dataset.fontPreview) this.value.style.fontFamily = `"${current.dataset.fontPreview}", var(--font-main)`;
      else this.value.style.removeProperty('font-family');
    }

    build() {
      this.root.replaceChildren();
      let lastGroup = null;
      for (const option of this.options()) {
        const group = option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement.label : null;
        if (group && group !== lastGroup) {
          const heading = document.createElement('div');
          heading.className = 'nl-select-group'; heading.setAttribute('role', 'presentation');
          heading.textContent = group; this.root.append(heading);
        }
        lastGroup = group;
        const row = document.createElement('div');
        row.className = 'nl-select-option';
        row.setAttribute('role', 'option');
        row.tabIndex = -1;
        row.dataset.value = option.value;
        row.setAttribute('aria-selected', String(option.selected));
        row.textContent = option.textContent.trim();
        // Each font previews itself, so the list shows what it is offering.
        if (option.dataset.fontPreview) row.style.fontFamily = `"${option.dataset.fontPreview}", var(--font-main)`;
        row.addEventListener('click', () => this.commit(option.value));
        this.root.append(row);
      }
    }

    place() {
      const rect = this.trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 180);
      this.root.style.width = `${width}px`;
      this.root.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
      // Flip above the trigger when the list would otherwise leave the viewport.
      const height = this.root.offsetHeight;
      const below = innerHeight - rect.bottom - 8;
      this.root.style.top = height > below && rect.top > below ? `${Math.max(8, rect.top - height - 6)}px` : `${rect.bottom + 6}px`;
    }

    open() {
      if (this.isOpen || this.select.disabled) return;
      // The list is portalled on first use, not on construction: a panel holds
      // dozens of these and most are never opened.
      if (!this.root.isConnected) document.body.append(this.root);
      this.build();
      this.isOpen = true;
      this.root.hidden = false; this.root.inert = false;
      this.root.classList.add('open');
      this.trigger.setAttribute('aria-expanded', 'true');
      this.place();
      pushLayer(this);
      const selected = this.rows().find(row => row.getAttribute('aria-selected') === 'true') || this.rows()[0];
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: 'nearest' });
      this.outside = event => { if (!this.root.contains(event.target) && event.target !== this.trigger) this.close(); };
      addEventListener('pointerdown', this.outside, true);
      // Armed a frame later: bringing the selected option into view scrolls, and a
      // scroll-closes-the-list handler registered now would shut it immediately.
      requestAnimationFrame(() => {
        if (!this.isOpen) return;
        addEventListener('scroll', this.onReposition, true);
        addEventListener('resize', this.onReposition);
      });
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.root.classList.remove('open');
      this.root.hidden = true; this.root.inert = true;
      this.trigger.setAttribute('aria-expanded', 'false');
      removeLayer(this);
      removeEventListener('scroll', this.onReposition, true);
      removeEventListener('resize', this.onReposition);
      removeEventListener('pointerdown', this.outside, true);
      if (this.trigger.isConnected) this.trigger.focus({ preventScroll: true });
    }

    commit(value) {
      this.select.value = value;
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
      this.sync();
      this.close();
    }

    onTriggerKey(event) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); this.open(); }
    }

    onListKey(event) {
      const rows = this.rows();
      let index = rows.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') index = (index + 1) % rows.length;
      else if (event.key === 'ArrowUp') index = (index - 1 + rows.length) % rows.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = rows.length - 1;
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.commit(document.activeElement?.dataset.value); return; }
      else if (event.key === 'Tab') { event.preventDefault(); this.close(); return; }
      else if (event.key.length === 1) {
        // Type-ahead: consecutive keystrokes narrow, a pause starts a new search.
        const now = Date.now();
        this.typed = now - this.typedAt > 800 ? event.key : this.typed + event.key;
        this.typedAt = now;
        const match = rows.find(row => row.textContent.toLowerCase().startsWith(this.typed.toLowerCase()));
        if (match) { match.focus(); match.scrollIntoView({ block: 'nearest' }); }
        return;
      } else return;
      event.preventDefault();
      rows[index]?.focus();
      rows[index]?.scrollIntoView({ block: 'nearest' });
    }

    destroy() { this.close(); this.trigger.remove(); this.root.remove(); this.select.hidden = false; this.select.removeAttribute('aria-hidden'); }
  }

  const enhanced = new WeakMap();
  function enhanceSelect(select) {
    if (!select || enhanced.has(select)) return enhanced.get(select);
    const menu = new SelectMenu(select);
    enhanced.set(select, menu);
    return menu;
  }
  let selectObserver = null;
  function enhanceSelects(root = document) {
    root.querySelectorAll('select:not([data-native])').forEach(enhanceSelect);
    if (selectObserver || root !== document || !document.body) return;
    // The bookmark manager builds a dropdown per folder and per bookmark on every
    // render, long after this first pass. Watching is what keeps a freshly built
    // control from falling back to system chrome.
    selectObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('select:not([data-native])')) enhanceSelect(node);
          node.querySelectorAll?.('select:not([data-native])').forEach(enhanceSelect);
        }
        // A detached control leaves its portalled list behind otherwise.
        for (const node of record.removedNodes) {
          if (node.nodeType !== 1) continue;
          const gone = node.matches?.('select') ? [node] : [...(node.querySelectorAll?.('select') || [])];
          for (const select of gone) if (!select.isConnected) enhanced.get(select)?.destroy();
        }
      }
    });
    selectObserver.observe(document.body, { childList: true, subtree: true });
  }
  /* settings.js writes `select.value` directly when it syncs the form, and a
     silent write fires no event — so the visible control is refreshed on demand. */
  function refreshSelects(root = document) {
    root.querySelectorAll('select').forEach(select => enhanced.get(select)?.sync());
  }

  /* FLIP: read where things are, let the caller change the layout, then play each
     item back from where it was. Reflow becomes a movement you can follow instead
     of a jump, and it rides transform alone so it stays on the compositor. */
  function animateReflow(container, mutate, { duration = 240 } = {}) {
    if (!container) { mutate(); return; }
    const items = [...container.children];
    const before = items.map(item => item.getBoundingClientRect());
    mutate();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    items.forEach((item, index) => {
      const after = item.getBoundingClientRect();
      const dx = before[index].left - after.left, dy = before[index].top - after.top;
      if (!dx && !dy) return;
      item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration, easing: 'cubic-bezier(.2, .8, .2, 1)' }
      );
    });
  }

  function liveRegion() {
    let region = document.getElementById('nl-live-region');
    if (!region) { region = document.createElement('div'); region.id = 'nl-live-region'; region.className = 'nl-visually-hidden'; region.setAttribute('aria-live', 'polite'); region.setAttribute('aria-atomic', 'true'); document.body.append(region); }
    return region;
  }
  function announce(message) { const region = liveRegion(); region.textContent = ''; requestAnimationFrame(() => { region.textContent = String(message); }); }
  /* Every caller wants the same sentence in the user's language, so the default
     label comes from the dictionary rather than from each call site. */
  function undoText(key, params) {
    return window.I18N ? window.I18N.t(key, params) : null;
  }

  function showUndoToast({ message, actionLabel, onAction, duration = 5000 }) {
    actionLabel = actionLabel || undoText('toast.undo') || 'Undo';
    const dock = document.getElementById('toast-dock') || document.body;
    const item = document.createElement('div'); item.className = 'toast toast-info on'; item.setAttribute('role', 'status');
    const text = document.createElement('span'); text.textContent = message;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'toast-action'; button.textContent = actionLabel;
    let active = true; const finish = action => { if (!active) return; active = false; clearTimeout(timer); item.remove(); if (action) onAction?.(); };
    button.addEventListener('click', () => finish(true)); item.append(text, button); dock.append(item);
    const timer = setTimeout(() => finish(false), duration); return { dismiss: () => finish(false) };
  }

  window.NordlysUI = { FocusScope, DialogController, RovingTabs, MenuController, SelectMenu, enhanceSelect, enhanceSelects, refreshSelects, announce, showUndoToast, undoText, animateReflow, visibleFocusable, layers };
})();
