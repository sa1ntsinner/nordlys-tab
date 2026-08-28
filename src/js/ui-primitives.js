/* Shared accessible interaction primitives. Loaded before all feature modules. */
(function () {
  const focusableSelector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  const layers = [];

  function visibleFocusable(root) {
    return [...root.querySelectorAll(focusableSelector)].filter(node => {
      const style = getComputedStyle(node);
      return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  class FocusScope {
    constructor(root) {
      this.root = root; this.opener = null; this.active = false;
      this.onKeyDown = this.onKeyDown.bind(this);
    }
    activate(opener = document.activeElement) {
      if (this.active) return;
      this.active = true; this.opener = opener;
      this.root.addEventListener('keydown', this.onKeyDown);
      const target = this.root.querySelector('[autofocus]') || visibleFocusable(this.root)[0] || this.root;
      if (!this.root.hasAttribute('tabindex') && target === this.root) this.root.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    onKeyDown(event) {
      if (event.key !== 'Tab') return;
      const nodes = visibleFocusable(this.root);
      if (!nodes.length) { event.preventDefault(); this.root.focus(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    deactivate({ restore = true } = {}) {
      if (!this.active) return;
      this.active = false; this.root.removeEventListener('keydown', this.onKeyDown);
      if (restore && this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    }
  }

  function pushLayer(layer) { layers.push(layer); }
  function removeLayer(layer) { const index = layers.lastIndexOf(layer); if (index >= 0) layers.splice(index, 1); }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !layers.length) return;
    event.preventDefault(); event.stopPropagation(); layers[layers.length - 1].close();
  }, true);

  class DialogController {
    constructor(root, options = {}) {
      this.root = root; this.options = options; this.scope = new FocusScope(root); this.isOpen = false;
      root.setAttribute('role', root.getAttribute('role') || 'dialog'); root.setAttribute('aria-modal', 'true');
      this.onBackdrop = event => { if (event.target === root && options.closeOnBackdrop !== false) this.close(); };
    }
    open(opener = document.activeElement) {
      if (this.isOpen) return;
      this.isOpen = true; this.root.hidden = false; this.root.classList.add('open');
      this.root.setAttribute('aria-hidden', 'false'); this.root.addEventListener('pointerdown', this.onBackdrop);
      pushLayer(this); this.scope.activate(opener); this.options.onOpen?.();
    }
    close() {
      if (!this.isOpen) return;
      this.isOpen = false; this.root.classList.remove('open'); this.root.setAttribute('aria-hidden', 'true');
      this.root.removeEventListener('pointerdown', this.onBackdrop); removeLayer(this); this.scope.deactivate(); this.options.onClose?.();
    }
  }

  class RovingTabs {
    constructor(root, { orientation = 'horizontal', onSelect = null } = {}) {
      this.root = root; this.orientation = orientation; this.onSelect = onSelect;
      root.setAttribute('role', 'tablist'); root.setAttribute('aria-orientation', orientation);
      this.tabs = [...root.querySelectorAll('[role="tab"], [data-tab]')];
      this.tabs.forEach((tab, index) => {
        tab.setAttribute('role', 'tab'); tab.tabIndex = tab.getAttribute('aria-selected') === 'true' || (!index && !this.tabs.some(item => item.getAttribute('aria-selected') === 'true')) ? 0 : -1;
        tab.addEventListener('click', () => this.select(tab));
        tab.addEventListener('keydown', event => this.onKey(event, tab));
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
  }

  class MenuController {
    constructor(root, { onAction = null } = {}) { this.root = root; this.onAction = onAction; this.opener = null; }
    items() { return [...this.root.querySelectorAll('[role="menuitem"], .ctx-item')].filter(item => !item.hidden); }
    open(opener, point) {
      this.opener = opener; this.root.setAttribute('role', 'menu'); this.root.classList.add('open');
      this.items().forEach(item => { item.setAttribute('role', 'menuitem'); item.tabIndex = -1; });
      if (point) { this.root.style.left = `${point.x}px`; this.root.style.top = `${point.y}px`; }
      pushLayer(this); this.items()[0]?.focus(); this.root.addEventListener('keydown', this._key = event => this.onKey(event));
    }
    onKey(event) {
      const items = this.items(); let index = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') index = (index + 1) % items.length;
      else if (event.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;
      else if (event.key === 'Home') index = 0; else if (event.key === 'End') index = items.length - 1;
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.activeElement?.click(); return; }
      else return; event.preventDefault(); items[index]?.focus();
    }
    close() { this.root.classList.remove('open'); this.root.removeEventListener('keydown', this._key); removeLayer(this); if (this.opener?.isConnected) this.opener.focus(); }
  }

  function liveRegion() {
    let region = document.getElementById('nl-live-region');
    if (!region) { region = document.createElement('div'); region.id = 'nl-live-region'; region.className = 'nl-visually-hidden'; region.setAttribute('aria-live', 'polite'); region.setAttribute('aria-atomic', 'true'); document.body.append(region); }
    return region;
  }
  function announce(message) { const region = liveRegion(); region.textContent = ''; requestAnimationFrame(() => { region.textContent = String(message); }); }
  function showUndoToast({ message, actionLabel = 'Undo', onAction, duration = 5000 }) {
    const dock = document.getElementById('toast-dock') || document.body;
    const item = document.createElement('div'); item.className = 'toast toast-info on'; item.setAttribute('role', 'status');
    const text = document.createElement('span'); text.textContent = message;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'toast-action'; button.textContent = actionLabel;
    let active = true; const finish = action => { if (!active) return; active = false; clearTimeout(timer); item.remove(); if (action) onAction?.(); };
    button.addEventListener('click', () => finish(true)); item.append(text, button); dock.append(item);
    const timer = setTimeout(() => finish(false), duration); return { dismiss: () => finish(false) };
  }

  window.NordlysUI = { FocusScope, DialogController, RovingTabs, MenuController, announce, showUndoToast, layers };
})();
