/* Responsive settings shell. Configuration remains owned by SettingsController/NordlysApp. */
(function () {
  const groups = [
    { label: 'Customize', key: 'nav.groupCustomize', ids: ['appearance', 'background', 'bookmarks'] },
    { label: 'App', key: 'nav.groupApp', ids: ['general', 'support'] },
    { label: 'Advanced', key: 'nav.groupAdvanced', ids: ['custom-css', 'backup'] }
  ];
  const iconPaths = {
    appearance: 'M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-1a1.4 1.4 0 0 1 0-2.8H15a6 6 0 0 0-3-11.6ZM7.5 10h.01M10 7h.01M14 7.5h.01',
    background: 'M3 5h18v14H3zM3 15l5-5 4 4 2-2 7 7M16 9h.01',
    bookmarks: 'M6 3h12v18l-6-4-6 4z',
    general: 'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19 12l2-1-2-4-2 .5-1.5-1L15 4h-6l-.5 2.5-1.5 1L5 7l-2 4 2 1v2l-2 1 2 4 2-.5 1.5 1L9 22h6l.5-2.5 1.5-1 2 .5 2-4-2-1z',
    'custom-css': 'M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16',
    backup: 'M12 3v12M7 10l5 5 5-5M4 19h16',
    support: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
  };
  class NordlysSettingsShell {
    constructor({ root, opener, onSectionChange = null, onClosed = null }) {
      this.root = root; this.opener = opener; this.onSectionChange = onSectionChange; this.onClosed = onClosed;
      this.nav = root.querySelector('.ctabs'); this.body = root.querySelector('.cbody'); this.closeButton = root.querySelector('#cfgx');
      const title = root.querySelector('.chead b'); if (title) title.id = 'settings-title';
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'settings-title'); root.setAttribute('aria-hidden', 'true');
      const resizer = root.querySelector('#cfg-resizer');
      if (resizer) { resizer.setAttribute('role', 'separator'); resizer.setAttribute('aria-orientation', 'vertical'); }
      this.buildLayout(); this.preparePanels(); this.roving = new NordlysUI.RovingTabs(this.nav, { orientation: this.orientation(), onSelect: id => this.select(id) });
      this.dialog = new NordlysUI.DialogController(root, { closeOnBackdrop: false, onClose: () => this.afterClose() });
      this.dim = document.getElementById('dim'); this.onCloseClick = () => this.close(); this.onResize = () => { this.syncOrientation(); if (this.nav) { this.nav.dataset.indicator = 'still'; this.placeIndicator(); } };
      this.closeButton?.addEventListener('click', this.onCloseClick);
      this.dim?.addEventListener('click', this.onCloseClick);
      window.addEventListener('resize', this.onResize, { passive: true });
      this.enhanceRows(); this.select('appearance', { focus: false }); this.syncOrientation();
    }
    orientation() { return matchMedia('(max-width: 759px)').matches ? 'horizontal' : 'vertical'; }
    syncOrientation() { const value = this.orientation(); this.nav.setAttribute('aria-orientation', value); if (this.roving) this.roving.orientation = value; }
    buildLayout() {
      const layout = document.createElement('div'); layout.className = 'settings-layout';
      this.root.insertBefore(layout, this.nav); layout.append(this.nav, this.body);
      const tabs = [...this.nav.querySelectorAll('.ctab')];
      groups.forEach(group => {
        const section = document.createElement('div'); section.className = 'settings-nav-group'; section.setAttribute('role', 'presentation');
        const label = document.createElement('span'); label.className = 'settings-nav-label';
        // Carrying the key lets I18N.applyDOM retranslate it on a language switch,
        // rather than freezing whatever language the rail was built in.
        if (group.key) label.dataset.i18n = group.key;
        label.textContent = window.I18N ? window.I18N.t(group.key, {}) : group.label;
        if (label.textContent === group.key) label.textContent = group.label;
        label.setAttribute('aria-hidden', 'true'); section.append(label);
        group.ids.forEach(id => { const tab = tabs.find(item => item.dataset.tab === id); if (tab) section.append(tab); }); this.nav.append(section);
      });
      tabs.forEach(tab => {
        tab.id = `settings-tab-${tab.dataset.tab}`; tab.setAttribute('aria-controls', `sec-${tab.dataset.tab}`); tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('settings-tab-icon'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', iconPaths[tab.dataset.tab]); svg.append(path); tab.prepend(svg);
      });
    }
    preparePanels() {
      this.root.querySelectorAll('.csec').forEach(panel => {
        panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `settings-tab-${panel.id.replace('sec-', '')}`); panel.tabIndex = 0;
      });
    }
    enhanceRows() {
      this.root.querySelectorAll('.csec > .row').forEach((row, index) => {
        row.classList.add('setting-row');
        const control = row.querySelector('input, select, textarea, button'); const text = row.querySelector(':scope > span');
        /* Named by the visible label itself rather than a copy of its words. The
           copy was taken once, in English, so a German panel read "Language" to
           a screen reader beside "Sprache" on the screen — and a slider's name
           never carried the value its label shows. */
        if (control && text && !control.getAttribute('aria-label') && !control.hasAttribute('aria-labelledby')) {
          if (!text.id) text.id = `setting-label-${index + 1}`;
          control.setAttribute('aria-labelledby', text.id);
        }
      });
    }
    select(sectionId, { focus = true } = {}) {
      const tab = this.nav.querySelector(`[data-tab="${sectionId}"]`), panel = this.root.querySelector(`#sec-${sectionId}`); if (!tab || !panel) return;
      // The new section arrives from the direction the choice went on the rail.
      const tabs = [...this.nav.querySelectorAll('.ctab')];
      const was = tabs.findIndex(item => item.classList.contains('active'));
      this.root.dataset.travel = was > tabs.indexOf(tab) ? 'up' : 'down';
      this.nav.querySelectorAll('.ctab').forEach(item => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
      this.placeIndicator(tab);
      this.root.querySelectorAll('.csec').forEach(item => { const active = item === panel; item.classList.toggle('active', active); item.hidden = !active; });
      if (focus) tab.focus({ preventScroll: true }); this.onSectionChange?.(sectionId);
    }
    /* The rail's accent bar: one shape that travels to the chosen tab
       (motion.css), along the rail when it stands, under the tabs when a
       narrow window lays them in a row. Placed without motion while the
       drawer is closed, so opening it never shows the bar flying in. */
    placeIndicator(tab = this.nav.querySelector('.ctab.active')) {
      if (!tab || !this.nav) return;
      const nav = this.nav.getBoundingClientRect();
      const box = tab.getBoundingClientRect();
      if (!box.width || !nav.width) return;
      const row = getComputedStyle(this.nav).flexDirection.startsWith('row');
      const x = box.left - nav.left - this.nav.clientLeft + this.nav.scrollLeft;
      const y = box.top - nav.top - this.nav.clientTop + this.nav.scrollTop;
      const geometry = row
        ? { x: x + 12, y: y + box.height - 3, w: box.width - 24, h: 3 }
        : { x, y: y + 9, w: 3, h: box.height - 18 };
      for (const [key, value] of Object.entries(geometry)) this.nav.style.setProperty(`--tab-${key}`, `${value}px`);
      this.nav.classList.add('has-indicator');
      const moving = this.root.classList.contains('open') || document.body.classList.contains('cfgopen');
      this.nav.dataset.indicator = moving ? 'moving' : 'still';
    }
    /* The opener is whatever asked for the drawer, because that is where focus
       goes back to when it closes. It is the gear almost always — but the board's
       empty state opens it too, and sending focus to a gear the user never
       pressed loses their place on the page. */
    open(sectionId = null, opener = this.opener) {
      if (sectionId) this.select(sectionId, { focus: false });
      document.getElementById('dim')?.classList.add('on'); document.body.classList.add('cfgopen'); this.dialog.open(opener || this.opener);
      // Measured once the drawer has its width; the bar is where it belongs before anything moves.
      requestAnimationFrame(() => { this.nav.dataset.indicator = 'still'; this.placeIndicator(); requestAnimationFrame(() => { this.nav.dataset.indicator = 'moving'; }); });
    }
    close() { this.dialog.close(); }
    afterClose() { document.getElementById('dim')?.classList.remove('on'); document.body.classList.remove('cfgopen'); this.onClosed?.(); }
    destroy() { this.close(); this.closeButton?.removeEventListener('click', this.onCloseClick); this.dim?.removeEventListener('click', this.onCloseClick); window.removeEventListener('resize', this.onResize); this.roving?.destroy(); }
  }
  window.NordlysSettingsShell = NordlysSettingsShell;
})();
