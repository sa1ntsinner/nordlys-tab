/* Compact bookmark settings editor. AuroraApp remains the storage owner. */
(function () {
  class NordlysBookmarkSettings {
    constructor({ app, root, openIconPicker }) {
      this.app = app; this.root = root; this.openIconPicker = openIconPicker;
      this.expanded = new Set(); this.renaming = new Set();
    }
    text(key, fallback) { return window.I18N?.t(key) || fallback; }
    save(message) { this.app.saveConfig(); this.app.grid?.render(); if (message) NordlysUI.announce(message); }
    moveFolder(folder, delta) {
      const groups = this.app.config.groups, index = groups.indexOf(folder), target = Math.max(0, Math.min(groups.length - 1, index + delta)); if (index < 0 || target === index) return;
      const [movedFolder] = groups.splice(index, 1); groups.splice(target, 0, movedFolder); this.save(`${movedFolder.label} moved to position ${target + 1}`); this.render();
    }
    moveBookmark(group, link, delta) {
      const links = group.links || [], bookmarkIndex = links.indexOf(link), target = Math.max(0, Math.min(links.length - 1, bookmarkIndex + delta)); if (bookmarkIndex < 0 || target === bookmarkIndex) return;
      links.splice(bookmarkIndex, 1); links.splice(target, 0, link); this.expanded.add(group); this.save(`${link.name} moved to position ${target + 1}`); this.render();
    }
    transferBookmark(group, link, destination) {
      const sourceIndex = group.links.indexOf(link); if (sourceIndex < 0 || !destination || destination === group) return;
      group.links.splice(sourceIndex, 1); (destination.links ||= []).push(link); this.expanded.add(destination); this.save(`${link.name} moved to ${destination.label}`); this.render();
    }
    removeWithUndo({ group, link }) {
      const bookmarkIndex = group.links.indexOf(link); if (bookmarkIndex < 0) return;
      const [removed] = group.links.splice(bookmarkIndex, 1), snapshot = JSON.parse(JSON.stringify(removed));
      this.expanded.add(group); this.save(`${snapshot.name} deleted`); this.render();
      NordlysUI.showUndoToast({ message: `${snapshot.name} deleted`, actionLabel: 'Undo', onAction: () => {
        if (!this.app.config.groups.includes(group)) return;
        group.links.splice(Math.min(bookmarkIndex, group.links.length), 0, snapshot); this.expanded.add(group); this.save(`${snapshot.name} restored`); this.render();
      } });
    }
    iconFor(link) {
      const def = resolveIcon(link.url, link.icon), presentation = NordlysIcons.resolvePresentation({ source: link, metadata: def || {}, isLight: this.app.isLightTheme() });
      return NordlysIcons.renderIcon(presentation);
    }
    render() {
      if (!this.root) return; this.root.replaceChildren();
      (this.app.config.groups || []).forEach((group, groupIndex) => {
        const details = document.createElement('article'); details.className = 'bookmark-folder-accordion'; details.dataset.groupIndex = groupIndex;
        const summary = document.createElement('summary'); summary.className = 'bookmark-folder-summary';
        summary.setAttribute('role', 'button'); summary.tabIndex = 0; summary.setAttribute('aria-expanded', String(this.expanded.has(group)));
        const name = document.createElement('strong'); name.textContent = group.label || 'Folder';
        const count = document.createElement('span'); count.className = 'bookmark-folder-count'; count.textContent = String((group.links || []).length); count.setAttribute('aria-label', `${count.textContent} bookmarks`);
        const actions = document.createElement('span'); actions.className = 'bookmark-folder-actions';
        const action = (label, text, handler, disabled = false) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'bookmark-compact-action'; button.setAttribute('aria-label', label); button.textContent = text; button.disabled = disabled; button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); handler(); }); return button; };
        const renameInput = document.createElement('input'); renameInput.className = 'bookmark-folder-name-input'; renameInput.setAttribute('aria-label', `Folder name for ${group.label}`); renameInput.value = group.label || '';
        renameInput.hidden = !this.renaming.has(group);
        const commitRename = () => { group.label = renameInput.value.trim() || this.text('bookmarks.newFolder', 'New Folder'); this.renaming.delete(group); this.save(`${group.label} renamed`); this.render(); };
        renameInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commitRename(); } }); renameInput.addEventListener('change', commitRename);
        const columns = document.createElement('select'); columns.setAttribute('aria-label', `Columns for ${group.label}`);
        for (let value = 1; value <= 8; value++) { const option = document.createElement('option'); option.value = String(value); option.textContent = `${value}`; option.selected = Number(group.cols) === value; columns.append(option); }
        columns.addEventListener('change', () => { group.cols = Number(columns.value); this.save(`${group.label}: ${group.cols} columns`); });
        actions.append(
          action(`${group.hidden ? 'Show' : 'Hide'} ${group.label}`, group.hidden ? 'Show' : 'Hide', () => { group.hidden = !group.hidden; this.save(`${group.label} ${group.hidden ? 'hidden' : 'shown'}`); this.render(); }),
          action(`Move ${group.label} up`, '↑', () => this.moveFolder(group, -1), groupIndex === 0),
          action(`Move ${group.label} down`, '↓', () => this.moveFolder(group, 1), groupIndex === this.app.config.groups.length - 1),
          action(`Rename ${group.label}`, 'Rename', () => { this.renaming.add(group); this.render(); this.root.querySelector(`[data-group-index="${this.app.config.groups.indexOf(group)}"] .bookmark-folder-name-input`)?.focus(); }),
          columns,
          action(`Add bookmark to ${group.label}`, this.text('bookmarks.addBookmark', 'Add bookmark'), () => { (group.links ||= []).push({ name: 'New Bookmark', url: 'https://', color: '#35d6c0', icon: 'globe' }); this.expanded.add(group); this.save('Bookmark added'); this.render(); }),
          action(`Delete folder ${group.label}`, 'Delete', async () => { const ok = await confirmDialog({ title: 'Delete folder?', message: `Delete ${group.label}?`, danger: true }); if (!ok) return; const index = this.app.config.groups.indexOf(group); if (index >= 0) this.app.config.groups.splice(index, 1); this.save(`${group.label} deleted`); this.render(); })
        );
        const toggle = () => { this.expanded.has(group) ? this.expanded.delete(group) : this.expanded.add(group); this.render(); };
        summary.addEventListener('click', toggle); summary.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
        summary.append(name, count); details.append(summary, actions, renameInput);
        const list = document.createElement('div'); list.className = 'bookmark-summary-list'; list.hidden = !this.expanded.has(group);
        (group.links || []).forEach((link, bookmarkIndex) => {
          const row = document.createElement('article'); row.className = 'bookmark-summary-row';
          const icon = document.createElement('span'); icon.className = 'bookmark-summary-icon'; icon.append(this.iconFor(link));
          const meta = document.createElement('span'); meta.className = 'bookmark-summary-meta';
          const title = document.createElement('strong'); title.className = 'bookmark-summary-name'; title.textContent = link.name || 'Bookmark';
          const host = document.createElement('span'); host.className = 'bookmark-summary-host'; try { host.textContent = new URL(link.url).hostname; } catch { host.textContent = link.url || ''; } meta.append(title, host);
          const editor = document.createElement('div'); editor.className = 'bookmark-editor'; editor.hidden = true;
          const titleInput = document.createElement('input'); titleInput.value = link.name || ''; titleInput.setAttribute('aria-label', 'Bookmark title');
          const urlInput = document.createElement('input'); urlInput.value = link.url || ''; urlInput.type = 'url'; urlInput.setAttribute('aria-label', 'Bookmark URL');
          const currentGroupIndex = () => this.app.config.groups.indexOf(group), currentBookmarkIndex = () => group.links.indexOf(link);
          const iconButton = action(`Choose icon for ${link.name}`, 'Choose icon', () => this.openIconPicker(currentGroupIndex(), currentBookmarkIndex(), iconButton));
          const saveButton = action(`Save ${link.name}`, 'Save', () => { link.name = titleInput.value.trim() || 'Bookmark'; link.url = /^https?:\/\//i.test(urlInput.value) ? urlInput.value : `https://${urlInput.value}`; this.save(`${link.name} saved`); this.render(); });
          editor.append(titleInput, urlInput, iconButton, saveButton);
          const edit = action(`Edit ${link.name}`, 'Edit', () => { editor.hidden = false; titleInput.focus(); });
          const up = action(`Move ${link.name} up`, '↑', () => this.moveBookmark(group, link, -1), bookmarkIndex === 0);
          const down = action(`Move ${link.name} down`, '↓', () => this.moveBookmark(group, link, 1), bookmarkIndex === group.links.length - 1);
          const transfer = document.createElement('select'); transfer.setAttribute('aria-label', `Move ${link.name} to folder`); const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Move to…'; placeholder.selected = true; transfer.append(placeholder);
          this.app.config.groups.forEach((candidate, index) => { if (candidate === group) return; const option = document.createElement('option'); option.value = String(index); option.textContent = candidate.label; transfer.append(option); });
          transfer.addEventListener('change', () => this.transferBookmark(group, link, this.app.config.groups[Number(transfer.value)]));
          const remove = action(`Delete ${link.name}`, 'Delete', () => this.removeWithUndo({ group, link })); remove.classList.add('danger');
          row.append(icon, meta, edit, up, down, transfer, remove, editor); list.append(row);
        });
        details.append(list); this.root.append(details);
      });
    }
  }
  window.NordlysBookmarkSettings = NordlysBookmarkSettings;
})();
