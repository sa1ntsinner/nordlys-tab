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
    activate(opener = document.activeElement) {
      if (this.active) return;
      this.active = true; this.opener = opener;
      document.addEventListener('keydown', this.onKeyDown, true);
      this.focusInitial();
    }
    focusInitial() {
      const target = this.root.querySelector('[autofocus]') || visibleFocusable(this.root)[0] || this.root;
      if (!this.root.hasAttribute('tabindex') && target === this.root) this.root.tabIndex = -1;
      target.focus({ preventScroll: true });
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
    open(opener = document.activeElement) {
      if (this.isOpen) return;
      this.isOpen = true; this.root.hidden = false; this.root.inert = false; this.root.style.visibility = 'visible'; this.root.setAttribute('aria-hidden', 'false');
      this.root.classList.add('open'); this.root.addEventListener('pointerdown', this.onBackdrop);
      pushLayer(this); this.scope.activate(opener); this.options.onOpen?.();
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

  window.NordlysUI = { FocusScope, DialogController, RovingTabs, MenuController, announce, showUndoToast, visibleFocusable, layers };
})();
