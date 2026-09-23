/* Compact bookmark settings editor. NordlysApp remains the storage owner. */
(function () {
  class NordlysBookmarkSettings {
    constructor({ app, root, openIconPicker }) {
      this.app = app; this.root = root; this.openIconPicker = openIconPicker;
      this.expanded = new Set(); this.renaming = new Set();
    }
    text(key, fallback, params) { const value = window.I18N?.t(key, params || {}); return value && value !== key ? value : fallback; }

    /* Every row used to wear its whole vocabulary: Edit, up, down, a Move-to
       select and Delete, five controls competing with the bookmark they act on.
       One button holds them now, and a single shared menu serves every row. */
    overflow() {
      if (this._overflow) return this._overflow;
      const root = document.createElement('div');
      root.className = 'glass-context-menu nl-overflow-menu';
      document.body.append(root);
      this._overflow = new NordlysUI.MenuController(root);
      return this._overflow;
    }
    openOverflow(button, entries, { filterable = false, filterLabel = 'Filter' } = {}) {
      const menu = this.overflow();
      /* A long list — every folder in a large bookmark tree — gets a filter
         field at the top instead of being cut off. The picker used to stop at
         forty and say nothing, and people with large trees are the ones this
         feature exists for. */
      let filter = null;
      if (filterable) {
        filter = document.createElement('input');
        filter.type = 'search'; filter.className = 'ctx-filter'; filter.setAttribute('role', 'searchbox');
        filter.placeholder = filterLabel; filter.setAttribute('aria-label', filterLabel); filter.autocomplete = 'off';
      }
      const fill = list => {
        /* Only the items are rebuilt. Replacing the whole menu would detach the
           filter field mid-keystroke and drop focus onto the page, which is why
           an earlier version stopped answering the keyboard after one letter. */
        menu.root.querySelectorAll('[role="menuitem"]').forEach(item => item.remove());
        if (filter && !filter.isConnected) menu.root.append(filter);
        for (const entry of list) {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = `ctx-item${entry.danger ? ' danger' : ''}`;
          item.setAttribute('role', 'menuitem');
          /* The menu takes items out of the tab order when it opens. A submenu
             builds its items afterwards, so they have to opt in themselves or
             Tab escapes the menu that is supposed to be holding focus. */
          item.tabIndex = -1;
          item.textContent = entry.label;
          if (entry.disabled) item.setAttribute('disabled', '');
          item.addEventListener('click', () => {
            // A submenu keeps the menu open and swaps its contents, so moving a
            // bookmark to another folder never needs a select inside a menu.
            if (entry.submenu) { fill(entry.submenu()); menu.root.querySelector('[role="menuitem"]')?.focus(); return; }
            menu.close(); entry.run?.();
          });
          menu.root.append(item);
        }
      };
      fill(entries);
      if (filter) {
        filter.addEventListener('input', () => {
          const needle = filter.value.trim().toLowerCase();
          fill(needle ? entries.filter(entry => entry.label.toLowerCase().includes(needle)) : entries);
        });
      }
      const box = button.getBoundingClientRect();
      menu.open(button, { x: box.right - 210, y: box.bottom + 6 });
      if (filter) filter.focus({ preventScroll: true });
    }
    save(message) { this.app.saveConfig(); this.app.grid?.render(); if (message) NordlysUI.announce(message); }
    /* The list is the board in reading order, so with rows of the user's own a
       step can cross the end of a row without the index changing: the folder
       stays put in the list and changes row on the board. */
    moveFolder(folder, delta) {
      const groups = this.app.config.groups, index = groups.indexOf(folder);
      if (index < 0 || !window.NordlysBoardLayout) return;
      const target = window.NordlysBoardLayout.shift(groups, index, delta);
      if (target < 0) return;
      const name = folder.label;
      const place = window.NordlysBoardLayout.hasRows(groups) && !folder.hidden ? this.app.grid?.placeOf(folder) : null;
      this.save(place
        ? this.text('announce.movedToRow', `${name} moved to row ${place.row}, position ${place.position}`, { name, ...place })
        : this.text('announce.movedToPosition', `${name} moved to position ${target + 1}`, { name, position: target + 1 }));
      this.render();
    }
    moveBookmark(group, link, delta) {
      // The browser keeps a followed folder's order; a refresh would put it back.
      if (group.source?.folderId) return;
      const links = group.links || [], bookmarkIndex = links.indexOf(link), target = Math.max(0, Math.min(links.length - 1, bookmarkIndex + delta)); if (bookmarkIndex < 0 || target === bookmarkIndex) return;
      links.splice(bookmarkIndex, 1); links.splice(target, 0, link); this.expanded.add(group); this.save(this.text('announce.movedToPosition', `${link.name} moved to position ${target + 1}`, { name: link.name, position: target + 1 })); this.render();
    }
    transferBookmark(group, link, destination) {
      if (destination?.source?.folderId || group.source?.folderId) return;
      const sourceIndex = group.links.indexOf(link); if (sourceIndex < 0 || !destination || destination === group) return;
      group.links.splice(sourceIndex, 1); (destination.links ||= []).push(link); this.expanded.add(destination); this.save(this.text('announce.movedToFolder', `${link.name} moved to ${destination.label}`, { name: link.name, folder: destination.label })); this.render();
    }
    removeWithUndo({ group, link }) {
      const bookmarkIndex = group.links.indexOf(link); if (bookmarkIndex < 0) return;
      const [removed] = group.links.splice(bookmarkIndex, 1), snapshot = JSON.parse(JSON.stringify(removed));
      /* Said once, by the toast, in the reader's own language — this used to
         announce an English literal here and then show a translated toast. */
      this.expanded.add(group); this.save(); this.render();
      const say = (key, fallback) => (window.I18N ? window.I18N.t(key, { name: snapshot.name }) : fallback);
      NordlysUI.showUndoToast({ message: say('toast.itemDeleted', `${snapshot.name} deleted`), onAction: () => {
        if (!this.app.config.groups.includes(group)) return;
        group.links.splice(Math.min(bookmarkIndex, group.links.length), 0, snapshot); this.expanded.add(group); this.save(); this.render();
        NordlysUI.announce(say('toast.itemRestored', `${snapshot.name} restored`));
      } });
    }
    iconFor(link) {
      const def = resolveIcon(link.url, link.icon), presentation = NordlysIcons.resolvePresentation({ source: link, metadata: def || {}, isLight: this.app.isLightTheme() });
      return NordlysIcons.renderIcon(presentation);
    }
    /* Linking hands ownership of a folder's contents to the browser. Unlinking
       keeps whatever was on screen, because taking the bookmarks away would be
       the data loss this feature exists to avoid. */
    async toggleBrowserLink(group) {
      const sync = window.NordlysBookmarks;
      if (!sync) return;

      if (group.source?.folderId) {
        delete group.source;
        for (const link of group.links || []) delete link.fromBrowser;
        this.save(this.text('announce.unfollowed', `${group.label} no longer follows the browser`, { name: group.label }));
        this.render();
        this.app.followBrowserFolders?.();
        return;
      }

      // Asked here, on the click, so installing never prompts about bookmarks.
      if (!(await sync.granted()) && !(await sync.request())) return;

      let folders;
      try {
        folders = await sync.folders();
      } catch (error) {
        NordlysUI.announce(this.text('bookmarks.linkUnavailable', 'Browser bookmarks are not available'));
        return;
      }
      if (!folders.length) {
        NordlysUI.announce(this.text('bookmarks.linkEmpty', 'No bookmark folders found'));
        return;
      }

      const button = this.root.querySelector(`[data-group-index="${this.app.config.groups.indexOf(group)}"] .bookmark-overflow`);
      this.openOverflow(button || document.body, folders.map((folder) => ({
        label: folder.path,
        run: async () => {
          /* The folder's own bookmarks are replaced by the browser's. When there
             are any, that is said first, and the state before is kept. */
          const own = (group.links || []).length;
          if (own > 0) {
            const ok = await confirmDialog({
              title: this.text('bookmarks.linkReplaceTitle', 'Replace this folder\'s bookmarks?'),
              message: (window.I18N ? window.I18N.t('bookmarks.linkReplaceMessage', { count: own, folder: folder.title }) : `Following "${folder.title}" replaces the ${own} bookmarks here. The previous state is kept in the restore point.`),
              confirmText: this.text('bookmarks.linkConfirm', 'Follow'),
              danger: true
            });
            if (!ok) return;
            this.app.snapshotBeforeMigration?.(this.app.config);
          }
          // Read first: a folder that cannot be read is not linked, and nothing
          // that was on screen is touched.
          let links;
          try {
            links = await sync.linksIn(folder.id);
          } catch (error) {
            NordlysUI.announce(this.text('bookmarks.linkUnavailable', 'Browser bookmarks are not available'));
            return;
          }
          group.source = { type: 'browser', folderId: folder.id, title: folder.title };
          group.links = links;
          this.save(this.text('announce.follows', `${group.label} follows ${folder.title}`, { name: group.label, folder: folder.title }));
          this.render();
          this.app.grid?.render();
          this.app.followBrowserFolders?.();
        }
      })), { filterable: true, filterLabel: this.text('bookmarks.filterFolders', 'Filter folders') });
    }

    render() {
      if (!this.root) return; this.root.replaceChildren();
      const groups = this.app.config.groups || [];
      groups.forEach((group, groupIndex) => {
        const details = document.createElement('article'); details.className = 'bookmark-folder-accordion'; details.dataset.groupIndex = groupIndex;
        const open = this.expanded.has(group);
        const summary = document.createElement('summary'); summary.className = 'bookmark-folder-summary';
        summary.setAttribute('role', 'button'); summary.tabIndex = 0; summary.setAttribute('aria-expanded', String(open));
        const chevron = document.createElement('span'); chevron.className = 'bookmark-folder-chevron'; chevron.setAttribute('aria-hidden', 'true');
        const name = document.createElement('strong'); name.textContent = group.label || this.text('bookmarks.newFolder', 'New Folder');
        const count = document.createElement('span'); count.className = 'bookmark-folder-count'; count.textContent = String((group.links || []).length); count.setAttribute('aria-label', this.text('a11y.bookmarkCount', `${count.textContent} bookmarks`, { count: count.textContent }));
        /* The browser owns these, so the row says whose they are. Built here,
           attached with the rest of the summary below: an element that is not
           in the document yet cannot have a sibling inserted after it. */
        let linkedBadge = null;
        if (group.source?.folderId) {
          details.dataset.linked = 'true';
          linkedBadge = document.createElement('span');
          linkedBadge.className = 'bookmark-folder-linked';
          linkedBadge.textContent = group.source.missing
            ? this.text('bookmarks.linkMissing', 'folder missing')
            : (group.source.title || this.text('bookmarks.linkedShort', 'browser'));
          linkedBadge.title = this.text('bookmarks.linkedTitle', 'Follows a browser bookmark folder');
        }

        const button = (label, text, handler, extra = {}) => {
          const node = document.createElement('button'); node.type = 'button';
          node.className = extra.className || 'bookmark-compact-action';
          node.setAttribute('aria-label', label);
          node.textContent = text;
          if (extra.disabled) node.disabled = true;
          node.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); handler(node); });
          return node;
        };

        const renameInput = document.createElement('input'); renameInput.className = 'bookmark-folder-name-input'; renameInput.setAttribute('aria-label', this.text('a11y.folderNameFor', `Folder name for ${group.label}`, { name: group.label })); renameInput.value = group.label || '';
        renameInput.hidden = !this.renaming.has(group);
        const commitRename = () => { group.label = renameInput.value.trim() || this.text('bookmarks.newFolder', 'New Folder'); this.renaming.delete(group); this.save(this.text('announce.renamed', `${group.label} renamed`, { name: group.label })); this.render(); };
        renameInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commitRename(); } });
        renameInput.addEventListener('change', commitRename);
        renameInput.addEventListener('click', event => event.stopPropagation());

        const addBookmark = () => {
          (group.links ||= []).push({ name: 'New Bookmark', url: 'https://', color: '#35d6c0', icon: 'globe' });
          this.expanded.add(group); this.save(this.text('announce.bookmarkAdded', 'Bookmark added')); this.render();
        };

        const folderMenu = button(this.text('a11y.moreActionsFor', `More actions for ${group.label}`, { name: group.label }), '⋯', node => this.openOverflow(node, [
          { label: this.text('bookmarks.rename', 'Rename'), run: () => { this.renaming.add(group); this.render(); this.root.querySelector(`[data-group-index="${this.app.config.groups.indexOf(group)}"] .bookmark-folder-name-input`)?.focus(); } },
          { label: this.text('bookmarks.addBookmark', 'Add bookmark'), disabled: Boolean(group.source?.folderId), run: addBookmark },
          { label: group.hidden ? this.text('bookmarks.showOnBoard', 'Show on the board') : this.text('bookmarks.hideFromBoard', 'Hide from the board'), run: () => { group.hidden = !group.hidden; this.save(group.hidden ? this.text('announce.hidden', `${group.label} hidden`, { name: group.label }) : this.text('announce.shown', `${group.label} shown`, { name: group.label })); this.render(); } },
          { label: this.text('bookmarks.moveUp', 'Move up'), disabled: groupIndex === 0, run: () => this.moveFolder(group, -1) },
          { label: this.text('bookmarks.moveDown', 'Move down'), disabled: groupIndex === groups.length - 1, run: () => this.moveFolder(group, 1) },
          { label: group.source?.folderId
              ? this.text('bookmarks.unlink', 'Stop following the browser')
              : this.text('bookmarks.link', 'Follow a browser folder'),
            run: () => this.toggleBrowserLink(group) },
          { label: this.text('bookmarks.deleteFolder', 'Delete folder'), danger: true, run: async () => {
            const ok = await confirmDialog({ title: this.text('confirm.deleteFolderTitle', 'Delete folder?'), message: `${group.label}`, danger: true });
            if (!ok) return;
            const index = this.app.config.groups.indexOf(group);
            if (index >= 0) this.app.grid.deleteFolderWithUndo(index);
          } }
        ]), { className: 'bookmark-compact-action bookmark-overflow' });

        const toggle = () => { this.expanded.has(group) ? this.expanded.delete(group) : this.expanded.add(group); this.render(); };
        summary.addEventListener('click', toggle);
        summary.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
        /* The overflow button used to sit inside the summary, which is itself a
           button: a control nested in a control, which Axe flags and screen
           readers cannot describe. They are siblings on one grid row now. */
        summary.append(chevron, name, count);
        if (linkedBadge) summary.append(linkedBadge);
        const head = document.createElement('div'); head.className = 'bookmark-folder-head';
        head.append(summary, folderMenu);
        details.append(head, renameInput);

        const list = document.createElement('div'); list.className = 'bookmark-summary-list'; list.hidden = !open;

        /* Adding a bookmark used to be one identical grey button among seven.
           Inside the folder it is the obvious next thing to do. */
        const toolbar = document.createElement('div'); toolbar.className = 'bookmark-folder-toolbar';
        const add = button(this.text('a11y.addBookmarkTo', `Add bookmark to ${group.label}`, { name: group.label }), this.text('bookmarks.addBookmark', 'Add bookmark'), addBookmark, { className: 'glass-btn accent bookmark-add' });
        if (group.source?.folderId) {
          add.disabled = true;
          add.title = this.text('bookmarks.linkedAddHint', 'Add it in the browser; this folder follows along');
        }
        const columnsLabel = document.createElement('label'); columnsLabel.className = 'bookmark-columns';
        const columnsText = document.createElement('span'); columnsText.textContent = this.text('bookmarks.columns', 'Columns');
        const columns = document.createElement('select'); columns.setAttribute('aria-label', this.text('hint.columnsFor', `Columns for ${group.label}`, { name: group.label }));
        for (let value = 1; value <= 8; value++) { const option = document.createElement('option'); option.value = String(value); option.textContent = `${value}`; option.selected = Number(group.cols) === value; columns.append(option); }
        columns.addEventListener('change', () => { group.cols = Number(columns.value); this.save(this.text('announce.columns', `${group.label}: ${group.cols} columns`, { name: group.label, count: group.cols })); });
        columnsLabel.append(columnsText, columns);
        toolbar.append(add, columnsLabel);
        list.append(toolbar);

        (group.links || []).forEach((link, bookmarkIndex) => {
          const row = document.createElement('article'); row.className = 'bookmark-summary-row';
          const icon = document.createElement('span'); icon.className = 'bookmark-summary-icon'; icon.append(this.iconFor(link));
          NordlysIcons.applyIconContrast(icon);
          const meta = document.createElement('span'); meta.className = 'bookmark-summary-meta';
          const title = document.createElement('strong'); title.className = 'bookmark-summary-name'; title.textContent = link.name || 'Bookmark';
          const host = document.createElement('span'); host.className = 'bookmark-summary-host';
          try { host.textContent = new URL(link.url).hostname; } catch { host.textContent = link.url || ''; }
          meta.append(title, host);

          const editor = document.createElement('div'); editor.className = 'bookmark-editor'; editor.hidden = true;
          const titleInput = document.createElement('input'); titleInput.value = link.name || ''; titleInput.setAttribute('aria-label', this.text('modal.bookmarkName', 'Bookmark title'));
          const urlInput = document.createElement('input'); urlInput.value = link.url || ''; urlInput.type = 'url'; urlInput.setAttribute('aria-label', this.text('modal.url', 'Bookmark URL'));
          const currentGroupIndex = () => this.app.config.groups.indexOf(group), currentBookmarkIndex = () => group.links.indexOf(link);
          /* A followed bookmark's name and address belong to the browser; its
             look is set here. Moving, reordering and deleting it happen there. */
          const followed = Boolean(group.source?.folderId);
          if (followed) {
            const hint = this.text('bookmarks.linkedEditHint', 'This folder follows the browser: rename or change the address there. The icon and colour are yours to set here.');
            for (const input of [titleInput, urlInput]) { input.readOnly = true; input.title = hint; }
          }
          const iconButton = button(this.text('a11y.chooseIconFor', `Choose icon for ${link.name}`, { name: link.name }), this.text('modal.chooseIcon', 'Choose icon'), () => this.openIconPicker(currentGroupIndex(), currentBookmarkIndex(), iconButton));
          const saveButton = button(this.text('a11y.saveBookmark', `Save ${link.name}`, { name: link.name }), this.text('modal.saveChanges', 'Save'), () => {
            if (!followed) {
              link.name = titleInput.value.trim() || 'Bookmark';
              link.url = /^https?:\/\//i.test(urlInput.value) ? urlInput.value : `https://${urlInput.value}`;
            }
            this.save(this.text('announce.saved', `${link.name} saved`, { name: link.name })); this.render();
          });
          editor.append(titleInput, urlInput, iconButton, saveButton);

          const rowMenu = button(this.text('a11y.moreActionsFor', `More actions for ${link.name}`, { name: link.name }), '⋯', node => this.openOverflow(node, [
            { label: this.text('ctx.editBookmark', 'Edit'), run: () => { editor.hidden = false; titleInput.focus(); } },
            { label: this.text('bookmarks.moveUp', 'Move up'), disabled: followed || bookmarkIndex === 0, run: () => this.moveBookmark(group, link, -1) },
            { label: this.text('bookmarks.moveDown', 'Move down'), disabled: followed || bookmarkIndex === group.links.length - 1, run: () => this.moveBookmark(group, link, 1) },
            /* A folder that follows the browser is not a destination: anything
               moved into it would vanish on the next refresh. */
            { label: this.text('bookmarks.moveTo', 'Move to folder'),
              disabled: followed || groups.filter(candidate => candidate !== group && !candidate.source?.folderId).length === 0,
              submenu: () => groups
                .filter(candidate => candidate !== group && !candidate.source?.folderId)
                .map(candidate => ({ label: candidate.label || this.text('bookmarks.newFolder', 'New Folder'), run: () => this.transferBookmark(group, link, candidate) })) },
            { label: this.text('ctx.deleteBookmark', 'Delete'), danger: true, disabled: followed, run: () => this.removeWithUndo({ group, link }) }
          ]), { className: 'bookmark-compact-action bookmark-overflow' });

          const rowActions = document.createElement('span'); rowActions.className = 'bookmark-row-actions'; rowActions.append(rowMenu);
          row.append(icon, meta, rowActions, editor); list.append(row);
        });
        details.append(list); this.root.append(details);
      });
    }
  }
  window.NordlysBookmarkSettings = NordlysBookmarkSettings;
})();
