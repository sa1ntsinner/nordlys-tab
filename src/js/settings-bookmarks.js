/* Compact bookmark settings editor. AuroraApp remains the storage owner. */
(function () {
  class NordlysBookmarkSettings {
    constructor({ app, root, openIconPicker }) { this.app = app; this.root = root; this.openIconPicker = openIconPicker; this.expanded = new Set(); }
    save(message) { this.app.saveConfig(); this.app.grid?.render(); if (message) NordlysUI.announce(message); }
    moveFolder(index, delta) {
      const groups = this.app.config.groups, target = Math.max(0, Math.min(groups.length - 1, index + delta)); if (target === index) return;
      const [folder] = groups.splice(index, 1); groups.splice(target, 0, folder); this.save(`${folder.label} moved to position ${target + 1}`); this.render();
    }
    moveBookmark(groupIndex, bookmarkIndex, delta) {
      const links = this.app.config.groups[groupIndex].links, target = Math.max(0, Math.min(links.length - 1, bookmarkIndex + delta)); if (target === bookmarkIndex) return;
      const [link] = links.splice(bookmarkIndex, 1); links.splice(target, 0, link); this.expanded.add(groupIndex); this.save(`${link.name} moved to position ${target + 1}`); this.render();
    }
    removeWithUndo({ groupIndex, bookmarkIndex }) {
      const group = this.app.config.groups[groupIndex], [removed] = group.links.splice(bookmarkIndex, 1); if (!removed) return;
      const snapshot = JSON.parse(JSON.stringify(removed)); this.expanded.add(groupIndex); this.save(`${snapshot.name} deleted`); this.render();
      NordlysUI.showUndoToast({ message: `${snapshot.name} deleted`, actionLabel: 'Undo', onAction: () => {
        const destination = this.app.config.groups[groupIndex]; if (!destination) return;
        destination.links.splice(Math.min(bookmarkIndex, destination.links.length), 0, snapshot); this.expanded.add(groupIndex); this.save(`${snapshot.name} restored`); this.render();
      } });
    }
    iconFor(link) {
      const def = resolveIcon(link.url, link.icon), presentation = NordlysIcons.resolvePresentation({ source: link, metadata: def || {}, isLight: this.app.isLightTheme() });
      return NordlysIcons.renderIcon(presentation);
    }
    render() {
      if (!this.root) return; this.root.replaceChildren();
      (this.app.config.groups || []).forEach((group, groupIndex) => {
        const details = document.createElement('details'); details.className = 'bookmark-folder-accordion'; details.dataset.groupIndex = groupIndex; details.open = this.expanded.has(groupIndex);
        details.addEventListener('toggle', () => details.open ? this.expanded.add(groupIndex) : this.expanded.delete(groupIndex));
        const summary = document.createElement('summary'); summary.className = 'bookmark-folder-summary';
        const name = document.createElement('strong'); name.textContent = group.label || 'Folder';
        const count = document.createElement('span'); count.className = 'bookmark-folder-count'; count.textContent = String((group.links || []).length); count.setAttribute('aria-label', `${count.textContent} bookmarks`);
        const actions = document.createElement('span'); actions.className = 'bookmark-folder-actions';
        const action = (label, text, handler, disabled = false) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'bookmark-compact-action'; button.setAttribute('aria-label', label); button.textContent = text; button.disabled = disabled; button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); handler(); }); return button; };
        actions.append(
          action(`${group.hidden ? 'Show' : 'Hide'} ${group.label}`, group.hidden ? 'Show' : 'Hide', () => { group.hidden = !group.hidden; this.save(`${group.label} ${group.hidden ? 'hidden' : 'shown'}`); this.render(); }),
          action(`Move ${group.label} up`, '↑', () => this.moveFolder(groupIndex, -1), groupIndex === 0),
          action(`Move ${group.label} down`, '↓', () => this.moveFolder(groupIndex, 1), groupIndex === this.app.config.groups.length - 1),
          action(`More actions for ${group.label}`, '•••', () => {})
        );
        summary.append(name, count); details.append(summary, actions);
        const list = document.createElement('div'); list.className = 'bookmark-summary-list';
        (group.links || []).forEach((link, bookmarkIndex) => {
          const row = document.createElement('article'); row.className = 'bookmark-summary-row';
          const icon = document.createElement('span'); icon.className = 'bookmark-summary-icon'; icon.append(this.iconFor(link));
          const meta = document.createElement('span'); meta.className = 'bookmark-summary-meta';
          const title = document.createElement('strong'); title.className = 'bookmark-summary-name'; title.textContent = link.name || 'Bookmark';
          const host = document.createElement('span'); host.className = 'bookmark-summary-host'; try { host.textContent = new URL(link.url).hostname; } catch { host.textContent = link.url || ''; } meta.append(title, host);
          const editor = document.createElement('div'); editor.className = 'bookmark-editor'; editor.hidden = true;
          const titleInput = document.createElement('input'); titleInput.value = link.name || ''; titleInput.setAttribute('aria-label', 'Bookmark title');
          const urlInput = document.createElement('input'); urlInput.value = link.url || ''; urlInput.type = 'url'; urlInput.setAttribute('aria-label', 'Bookmark URL');
          const iconButton = action(`Choose icon for ${link.name}`, 'Choose icon', () => this.openIconPicker(groupIndex, bookmarkIndex, iconButton));
          const saveButton = action(`Save ${link.name}`, 'Save', () => { link.name = titleInput.value.trim() || 'Bookmark'; link.url = /^https?:\/\//i.test(urlInput.value) ? urlInput.value : `https://${urlInput.value}`; this.save(`${link.name} saved`); this.render(); });
          editor.append(titleInput, urlInput, iconButton, saveButton);
          const edit = action(`Edit ${link.name}`, 'Edit', () => { editor.hidden = false; titleInput.focus(); });
          const up = action(`Move ${link.name} up`, '↑', () => this.moveBookmark(groupIndex, bookmarkIndex, -1), bookmarkIndex === 0);
          const down = action(`Move ${link.name} down`, '↓', () => this.moveBookmark(groupIndex, bookmarkIndex, 1), bookmarkIndex === group.links.length - 1);
          const remove = action(`Delete ${link.name}`, 'Delete', () => this.removeWithUndo({ groupIndex, bookmarkIndex })); remove.classList.add('danger');
          row.append(icon, meta, edit, up, down, remove, editor); list.append(row);
        });
        details.append(list); this.root.append(details);
      });
    }
  }
  window.NordlysBookmarkSettings = NordlysBookmarkSettings;
})();
