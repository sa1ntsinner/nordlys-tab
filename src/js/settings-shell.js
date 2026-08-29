/* Responsive settings shell. Configuration remains owned by SettingsController/AuroraApp. */
(function () {
  const groups = [
    { label: 'Customize', ids: ['appearance', 'background', 'bookmarks'] },
    { label: 'App', ids: ['general'] },
    { label: 'Advanced', ids: ['custom-css', 'backup'] }
  ];
  const iconPaths = {
    appearance: 'M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-1a1.4 1.4 0 0 1 0-2.8H15a6 6 0 0 0-3-11.6ZM7.5 10h.01M10 7h.01M14 7.5h.01',
    background: 'M3 5h18v14H3zM3 15l5-5 4 4 2-2 7 7M16 9h.01',
    bookmarks: 'M6 3h12v18l-6-4-6 4z',
    general: 'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19 12l2-1-2-4-2 .5-1.5-1L15 4h-6l-.5 2.5-1.5 1L5 7l-2 4 2 1v2l-2 1 2 4 2-.5 1.5 1L9 22h6l.5-2.5 1.5-1 2 .5 2-4-2-1z',
    'custom-css': 'M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16',
    backup: 'M12 3v12M7 10l5 5 5-5M4 19h16'
  };
  class NordlysSettingsShell {
    constructor({ root, opener, onSectionChange = null }) {
      this.root = root; this.opener = opener; this.onSectionChange = onSectionChange;
      this.nav = root.querySelector('.ctabs'); this.body = root.querySelector('.cbody'); this.closeButton = root.querySelector('#cfgx');
      const title = root.querySelector('.chead b'); if (title) title.id = 'settings-title';
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'settings-title'); root.setAttribute('aria-hidden', 'true');
      const resizer = root.querySelector('#cfg-resizer');
      if (resizer) { resizer.setAttribute('role', 'separator'); resizer.setAttribute('aria-orientation', 'vertical'); }
      this.buildLayout(); this.preparePanels(); this.roving = new NordlysUI.RovingTabs(this.nav, { orientation: this.orientation(), onSelect: id => this.select(id) });
      this.dialog = new NordlysUI.DialogController(root, { closeOnBackdrop: false, onClose: () => this.afterClose() });
      this.closeButton?.addEventListener('click', () => this.close());
      document.getElementById('dim')?.addEventListener('click', () => this.close());
      window.addEventListener('resize', () => this.syncOrientation(), { passive: true });
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
        const label = document.createElement('span'); label.className = 'settings-nav-label'; label.textContent = group.label; label.setAttribute('aria-hidden', 'true'); section.append(label);
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
        const control = row.querySelector('input, select, textarea, button'); const text = row.querySelector('span');
        if (control && text && !control.getAttribute('aria-label')) control.setAttribute('aria-label', text.textContent.replace(/\s+/g, ' ').trim() || `Setting ${index + 1}`);
      });
    }
    select(sectionId, { focus = true } = {}) {
      const tab = this.nav.querySelector(`[data-tab="${sectionId}"]`), panel = this.root.querySelector(`#sec-${sectionId}`); if (!tab || !panel) return;
      this.nav.querySelectorAll('.ctab').forEach(item => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
      this.root.querySelectorAll('.csec').forEach(item => { const active = item === panel; item.classList.toggle('active', active); item.hidden = !active; });
      if (focus) tab.focus({ preventScroll: true }); this.onSectionChange?.(sectionId);
    }
    open(sectionId = null) { if (sectionId) this.select(sectionId, { focus: false }); document.getElementById('dim')?.classList.add('on'); document.body.classList.add('cfgopen'); this.dialog.open(this.opener); }
    close() { this.dialog.close(); }
    afterClose() { document.getElementById('dim')?.classList.remove('on'); document.body.classList.remove('cfgopen'); }
    destroy() { this.close(); }
  }
  window.NordlysSettingsShell = NordlysSettingsShell;
})();
