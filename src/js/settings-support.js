/* The Support section of the settings drawer.

   This is the only place in the product that asks the user for anything, so it
   is built to ask once and then get out of the way: no badge on the rail, no
   counter, no loop, no prompt that comes back. Someone who never opens it will
   never learn it is here, and that is the intended cost.

   Below the ask sits About, which is the reason to open this tab when you are
   never going to pay for anything: the build that is running, what changed in
   it, and the keys that do the work.

   Everything it can offer is declared in SUPPORT_CONFIG below and nowhere else.
   A blank value is not a placeholder to be filled in with a good guess — an
   address or an account that nobody verified is worse than no button at all,
   so a blank renders the honest unavailable state instead. */
(function () {
  /* ── The one place an owner fills in ──────────────────────────────────
     coffeeUrl  the project's own Buy Me a Coffee page, e.g.
                "https://buymeacoffee.com/<handle>". Blank until whoever owns
                the account confirms it; the section then says donations are
                not open yet rather than linking somewhere unverified.
     wallets    one entry per network an address is actually held for:
                { id, name, address }. An empty list means the crypto
                disclosure is not rendered at all. Never seed this with an
                example — the suite fails if anything address-shaped appears
                while the list is empty.
     The four remaining links are files and pages of this repository, each one
     verified to exist at the path named here. */
  const SUPPORT_CONFIG = {
    coffeeUrl: '',
    repositoryUrl: 'https://github.com/sa1ntsinner/nordlys-tab',
    issuesUrl: 'https://github.com/sa1ntsinner/nordlys-tab/issues/new',
    privacyUrl: 'https://github.com/sa1ntsinner/nordlys-tab/blob/main/PRIVACY.md',
    changelogUrl: 'https://github.com/sa1ntsinner/nordlys-tab/blob/main/CHANGELOG.md',
    wallets: []
  };

  /* Local path data in the same stroke vocabulary as the settings rail. No
     remote imagery, no icon font, no emoji standing in for a drawn mark. */
  const ICONS = {
    coffee: ['M17 8h1a4 4 0 0 1 0 8h-1', 'M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z', 'M6 2v2', 'M10 2v2', 'M14 2v2'],
    coins: ['M14 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0', 'M18.09 10.37A6 6 0 1 1 10.34 18', 'M7 6h1v4', 'm16.71 13.88.7.71-2.82 2.82'],
    star: ['M12 3.2l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.9Z'],
    idea: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z', 'M12 7v5', 'M9.5 9.5h5'],
    shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
    copy: ['M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
    check: ['m20 6-11 11-5-5'],
    external: ['M7 17 17 7', 'M9 7h8v8'],
    notes: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z', 'M14 3v5h5', 'M9 13h6', 'M9 17h4'],
    keyboard: ['M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z', 'M7 11h.01', 'M11 11h.01', 'M15 11h.01', 'M8 14h8']
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(name, className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of ICONS[name] || []) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  class NordlysSupportSettings {
    constructor({ root, app = null }) {
      this.root = root;
      this.app = app;
      this.give = root.querySelector('#support-give');
      this.actions = root.querySelector('#support-actions');
      this.about = root.querySelector('#support-about');
      this.timers = new Set();
      /* A parameterised label ("Copy the Bitcoin address") cannot be carried by
         data-i18n, so the section rebuilds itself when the language changes
         rather than freezing whichever language it was first drawn in. */
      this.onLanguageChange = () => this.render();
      window.addEventListener('nordlys:languagechange', this.onLanguageChange);
      this.render();
    }

    /* I18N.t answers with the key itself when a message is missing, which is
       exactly how a key reaches the screen. The fallback is what gets shown
       instead. */
    text(key, fallback, params) {
      const value = window.I18N?.t(key, params || {});
      return !value || value === key ? fallback : value;
    }

    /* SUPPORT_CONFIG is edited by hand, so a mistyped or pasted value has to
       fail closed rather than become a live link. Anything that is not an https
       address — a scheme, a relative path, a blank — renders as nothing. */
    httpsOnly(value) {
      const text = String(value || '').trim();
      if (!text) return '';
      try { return new URL(text).protocol === 'https:' ? text : ''; } catch { return ''; }
    }

    /* Every link out of the product: a new tab, no opener handed over, no
       referrer, and a sentence a screen reader hears before following it. */
    externalLink(url, className) {
      const link = document.createElement('a');
      link.className = className;
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return link;
    }

    newTabNote() {
      const note = document.createElement('span');
      note.className = 'nl-visually-hidden';
      note.dataset.i18n = 'support.newTab';
      note.textContent = this.text('support.newTab', 'opens in a new tab');
      return note;
    }

    label(key, fallback, className) {
      const span = document.createElement('span');
      span.className = className;
      span.dataset.i18n = key;
      span.textContent = this.text(key, fallback);
      return span;
    }

    render() {
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
      if (!this.give || !this.actions) return;
      this.give.replaceChildren();
      this.actions.replaceChildren();
      this.about?.replaceChildren();
      this.renderCoffee();
      this.renderWallets();
      this.renderActions();
      this.renderAbout();
    }

    /* The primary action, and the one thing here that takes money directly. It
       is drawn as an ordinary primary button — the same one the other sections
       use — because giving it a treatment of its own is the first step toward
       a product that pleads. */
    renderCoffee() {
      const url = this.httpsOnly(SUPPORT_CONFIG.coffeeUrl);
      if (!url) {
        /* No verified account: a sentence, not a disabled control. A button
           that cannot be pressed is still a button someone will press. */
        const note = document.createElement('p');
        note.className = 'support-unavailable';
        note.dataset.i18n = 'support.coffeeUnavailable';
        note.textContent = this.text('support.coffeeUnavailable',
          'Donations are not open yet. The other ways below help just as much.');
        this.give.append(note);
        return;
      }
      const link = this.externalLink(url, 'glass-btn accent support-coffee');
      link.append(
        icon('coffee', 'btn-icon'),
        this.label('support.coffee', 'Buy me a coffee', 'support-coffee-label'),
        this.newTabNote()
      );
      const hint = document.createElement('p');
      hint.className = 'support-hint';
      hint.dataset.i18n = 'support.coffeeHint';
      hint.textContent = this.text('support.coffeeHint', 'A one-off thank you, if it earned one.');
      this.give.append(link, hint);
    }

    /* Collapsed, and absent entirely when no address is configured. Crypto is
       an alternative for people who prefer it, not a second headline. */
    renderWallets() {
      const wallets = (SUPPORT_CONFIG.wallets || []).filter(item => item && item.name && String(item.address || '').trim());
      if (!wallets.length) return;

      /* Both collapsed panels in this section share one chrome — the row, the
         chevron and the open state — and differ only in what they hold. */
      const disclosure = document.createElement('details');
      disclosure.className = 'support-disclosure support-wallets';
      const summary = document.createElement('summary');
      summary.className = 'support-disclosure-summary';
      const chevron = document.createElement('span');
      chevron.className = 'support-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      summary.append(chevron, icon('coins', 'support-action-icon'),
        this.label('support.cryptoTitle', 'Send crypto instead', 'support-wallets-label'));

      const list = document.createElement('ul');
      list.className = 'support-wallet-list';
      for (const wallet of wallets) list.append(this.walletRow(wallet));
      disclosure.append(summary, list);
      this.give.append(disclosure);
    }

    walletRow(wallet) {
      const address = String(wallet.address).trim();
      const row = document.createElement('li');
      row.className = 'support-wallet';

      const name = document.createElement('span');
      name.className = 'support-wallet-name';
      name.textContent = wallet.name;

      /* <code> rather than an input: the address is a value to read and copy,
         not a field to edit, and it wraps instead of scrolling out of a
         phone-width sheet. */
      const value = document.createElement('code');
      value.className = 'support-wallet-address';
      value.textContent = address;

      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'glass-btn support-copy';
      // "Copy" alone tells a screen reader nothing when there are three of them.
      copy.setAttribute('aria-label', this.resting(wallet));
      const copyLabel = this.label('support.copy', 'Copy', 'support-copy-label');
      copy.append(icon('copy', 'btn-icon'), copyLabel);
      copy.addEventListener('click', () => this.copyAddress({ wallet, address, button: copy, label: copyLabel }));

      row.append(name, value, copy);
      return row;
    }

    /* "Copy" alone tells a screen reader nothing when three buttons say it,
       and it is the name a speech-input user says out loud, so it has to keep
       matching the word on the button. */
    resting(wallet) {
      return this.text('support.copyAddress', `Copy the ${wallet.name} address`, { network: wallet.name });
    }

    copyAddress({ wallet, address, button, label }) {
      const settle = (key, fallback) => {
        const message = this.text(key, fallback, { network: wallet.name });
        NordlysUI.announce(message);
        return message;
      };
      const done = () => {
        // Seen and heard: the button says so where the eye already is, and the
        // live region says so for anyone who cannot see the button at all.
        button.classList.add('copied');
        label.textContent = this.text('support.copied', 'Copied');
        label.removeAttribute('data-i18n');
        button.replaceChild(icon('check', 'btn-icon'), button.firstChild);
        button.setAttribute('aria-label', settle('support.addressCopied', `${wallet.name} address copied`));
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          if (!button.isConnected) return;
          button.classList.remove('copied');
          label.dataset.i18n = 'support.copy';
          label.textContent = this.text('support.copy', 'Copy');
          button.replaceChild(icon('copy', 'btn-icon'), button.firstChild);
          button.setAttribute('aria-label', this.resting(wallet));
        }, 2000);
        this.timers.add(timer);
      };

      const written = navigator.clipboard?.writeText(address);
      if (!written) { settle('support.copyFailed', 'The address could not be copied'); return; }
      written.then(done, () => settle('support.copyFailed', 'The address could not be copied'));
    }

    /* The part of the section that costs nothing and is worth the most: the
       three things a person can do that actually keep the project going. */
    renderActions() {
      const entries = [
        { url: SUPPORT_CONFIG.repositoryUrl, mark: 'star', key: 'support.star', fallback: 'Star it on GitHub', hintKey: 'support.starHint', hint: 'Stars are how people find it.' },
        { url: SUPPORT_CONFIG.issuesUrl, mark: 'idea', key: 'support.report', fallback: 'Report a bug or suggest an idea', hintKey: 'support.reportHint', hint: 'Bugs and ideas go to the same place.' },
        { url: SUPPORT_CONFIG.privacyUrl, mark: 'shield', key: 'support.privacy', fallback: 'Read the privacy promise', hintKey: 'support.privacyHint', hint: 'What stays on your machine, and what never leaves it.' }
      ];
      for (const entry of entries) {
        const url = this.httpsOnly(entry.url);
        if (!url) continue;
        const link = this.externalLink(url, 'support-action');
        const text = document.createElement('span');
        text.className = 'support-action-text';
        text.append(
          this.label(entry.key, entry.fallback, 'support-action-label'),
          this.label(entry.hintKey, entry.hint, 'support-action-hint')
        );
        link.append(icon(entry.mark, 'support-action-icon'), text, this.newTabNote(), icon('external', 'support-action-out'));
        this.actions.append(link);
      }
    }

    /* The half of the section that is worth opening even if the answer to the
       ask is no: which build is running, what changed in it, and the keys.
       Drawn a step quieter than everything above it — one line of text and one
       collapsed list, no cards and no colour of its own. */
    renderAbout() {
      if (!this.about) return;
      const line = document.createElement('p');
      line.className = 'support-about-line';

      /* Parameterised, so it cannot carry data-i18n: applyDOM would put the
         literal "{version}" back on screen. The language listener re-renders
         the section instead, which is the same bargain the wallet rows make. */
      const version = this.version();
      if (version) {
        const stamp = document.createElement('span');
        stamp.className = 'support-version';
        stamp.textContent = this.text('support.version', `Nordlys ${version}`, { version });
        line.append(stamp);
      }

      const changelog = this.httpsOnly(SUPPORT_CONFIG.changelogUrl);
      if (changelog) {
        const link = this.externalLink(changelog, 'support-about-link');
        link.append(
          icon('notes', 'support-action-icon'),
          this.label('support.changelog', 'Changelog', 'support-about-link-label'),
          this.newTabNote(),
          icon('external', 'support-action-out')
        );
        line.append(link);
      }

      if (line.childElementCount) this.about.append(line);
      this.about.append(this.shortcutLegend());
    }

    /* The version the product already knows, never a second number typed here:
       the installed manifest when Chrome is there to answer, and the running
       app's own default otherwise. A copy kept in this file is a copy that
       will one day label a build that is not the one running. */
    version() {
      const manifest = globalThis.chrome?.runtime?.getManifest?.();
      return String(manifest?.version || this.app?.defaultConfig?.version || '').trim();
    }

    /* The legend has to describe the handlers, not a convention: app.js picks
       Cmd over Ctrl with exactly this test, so any other test here would
       eventually print a key that does nothing on the machine reading it. */
    shortcuts() {
      const mac = String(navigator.platform || '').toUpperCase().includes('MAC');
      const mod = mac ? '⌘' : 'Ctrl';
      const alt = mac ? '⌥' : 'Alt';
      return [
        { chords: [['/']], key: 'support.keySearch', fallback: 'Jump to the search box' },
        { chords: [['>']], key: 'support.keyCommand', fallback: 'In search: a command — theme, sky, mood, move… — type > alone for the list' },
        { chords: [[mod, 'K']], key: 'support.keySearchAnywhere', fallback: 'Jump to search from anywhere, even mid-typing' },
        { chords: [[mod, ',']], key: 'support.keySettings', fallback: 'Open or close settings' },
        { chords: [[alt, '1–9']], key: 'support.keyBookmark', fallback: 'Open one of the first nine bookmarks — hold Alt to see which' },
        { chords: [['←→↑↓'], [alt, 'Shift', '←→↑↓']], key: 'support.keyBoard', fallback: 'On a bookmark: walk its folder, or carry the bookmark with it' },
        { chords: [['Enter'], ['←→↑↓']], key: 'support.keyArrange', fallback: "On a folder's handle: Enter arranges the board, then the arrows move the folder" },
        { chords: [['Shift', 'F10'], ['Menu']], key: 'support.keyMenu', fallback: 'Menu for the focused bookmark' },
        { chords: [[mod, 'Z']], key: 'support.keyUndo', fallback: 'Undo the last change: while its notice is showing, even inside a dialog, and while arranging' }
      ];
    }

    shortcutLegend() {
      const disclosure = document.createElement('details');
      disclosure.className = 'support-disclosure support-shortcuts';
      const summary = document.createElement('summary');
      summary.className = 'support-disclosure-summary';
      const chevron = document.createElement('span');
      chevron.className = 'support-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      summary.append(chevron, icon('keyboard', 'support-action-icon'),
        this.label('support.shortcuts', 'Keyboard shortcuts', 'support-shortcuts-label'));

      const list = document.createElement('dl');
      list.className = 'support-shortcut-list';
      for (const shortcut of this.shortcuts()) list.append(this.shortcutRow(shortcut));
      disclosure.append(summary, list);
      return disclosure;
    }

    /* A <dl> of key-to-meaning, not five cards. The keys are glyphs rather than
       prose, so they are the one thing here no locale translates. */
    shortcutRow({ chords, key, fallback }) {
      const row = document.createElement('div');
      row.className = 'support-shortcut';

      const keys = document.createElement('dt');
      keys.className = 'support-shortcut-keys';
      chords.forEach((chord, index) => {
        if (index) {
          // Two ways to the same menu. The slash is punctuation, not a key.
          const separator = document.createElement('span');
          separator.className = 'support-shortcut-or';
          separator.setAttribute('aria-hidden', 'true');
          separator.textContent = '/';
          keys.append(separator);
        }
        for (const cap of chord) {
          const kbd = document.createElement('kbd');
          kbd.textContent = cap;
          keys.append(kbd);
        }
      });

      const what = document.createElement('dd');
      what.className = 'support-shortcut-what';
      what.dataset.i18n = key;
      what.textContent = this.text(key, fallback);

      row.append(keys, what);
      return row;
    }

    destroy() {
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
      window.removeEventListener('nordlys:languagechange', this.onLanguageChange);
    }
  }

  window.NordlysSupportSettings = NordlysSupportSettings;
  /* The tests reach the configuration to prove the empty and the configured
     states without shipping an address; an owner edits SUPPORT_CONFIG above. */
  window.NordlysSupportConfig = SUPPORT_CONFIG;
})();
