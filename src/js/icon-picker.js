/* Accessible lifecycle and shared preview for the existing multi-source picker. */
(function () {
  class NordlysIconPicker {
    constructor({ dialogRoot }) {
      this.root = dialogRoot; const title = dialogRoot.querySelector('.modal-head b'); if (title) title.id = 'icon-picker-title';
      dialogRoot.setAttribute('aria-labelledby', 'icon-picker-title'); this.dialog = new NordlysUI.DialogController(dialogRoot, { closeOnBackdrop: true });
      const tabs = dialogRoot.querySelector('.icon-modal-tabs'); if (tabs) this.tabs = new NordlysUI.RovingTabs(tabs, { onSelect: id => this.select(id) });
      dialogRoot.querySelectorAll('.icon-tab-btn').forEach(tab => { tab.setAttribute('aria-controls', `modal-pane-${tab.dataset.tab}`); tab.setAttribute('aria-selected', String(tab.classList.contains('active'))); });
      dialogRoot.querySelectorAll('.modal-tab-pane').forEach(pane => { pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', `icon-source-${pane.id.replace('modal-pane-', '')}`); });
      this.ensurePreview();
    }
    ensurePreview() {
      if (this.root.querySelector('#icon-live-preview')) return;
      const preview = document.createElement('div'); preview.id = 'icon-live-preview'; preview.className = 'icon-live-preview'; preview.setAttribute('aria-label', 'Live tile preview');
      preview.innerHTML = '<section class="card"><a class="tile" href="#" onclick="return false"><div class="box"><span class="mono">N</span></div><span class="lbl">Bookmark</span></a></section>';
      this.root.querySelector('.modal-body')?.prepend(preview);
    }
    select(id) { this.root.querySelectorAll('.icon-tab-btn').forEach(tab => { const active = tab.dataset.tab === id; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); }); this.root.querySelectorAll('.modal-tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === `modal-pane-${id}`)); }
    open(currentIcon, opener) {
      const preview = this.root.querySelector('#icon-live-preview'); const label = preview?.querySelector('.lbl'); const box = preview?.querySelector('.box');
      if (label) label.textContent = currentIcon?.name || 'Bookmark';
      if (box && currentIcon) {
        const metadata = resolveIcon(currentIcon.url, currentIcon.icon) || {};
        const presentation = NordlysIcons.resolvePresentation({ source: currentIcon, metadata, isLight: document.documentElement.classList.contains('light-ui') });
        box.replaceChildren(NordlysIcons.renderIcon(presentation));
        box.style.setProperty('--c', currentIcon.color || 'var(--nl-accent)');
      }
      this.dialog.open(opener);
    }
    close() { this.dialog.close(); }
  }
  window.NordlysIconPicker = NordlysIconPicker;
})();
