/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - INTERNATIONALIZATION (i18n)
   ═══════════════════════════════════════════════════════════════════

   The words live in src/locales, one file per language. All eight used to
   sit in this file, 450 KB of object literal parsed on every new tab to show
   one of them. Now a tab loads English, which every other language falls back
   to, and the language in use, whose tag boot.js writes into the head so it
   is here before anything is drawn. Another is fetched when somebody picks it,
   and setLanguage() then answers with a promise. */

window.I18N = {
  LANGUAGES: ['en', 'ru', 'es', 'de', 'fr', 'ja', 'zh', 'tr'],
  // The same object the locale files add themselves to, whichever came first.
  translations: (globalThis.NordlysLocales ||= {}),
  currentLang: 'en',

  t(key, params = {}) {
    let text = this.translations[this.currentLang]?.[key] || this.translations['en']?.[key] || key;
    if (typeof text === 'string') {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return text;
  },

  // A language not on the page yet arrives as one more script beside it.
  load(lang) {
    if (this.translations[lang] || !this.LANGUAGES.includes(lang)) return Promise.resolve(Boolean(this.translations[lang]));
    this.loading ||= {};
    return this.loading[lang] ||= new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `src/locales/${lang}.js`;
      script.onload = () => resolve(Boolean(this.translations[lang]));
      script.onerror = () => { delete this.loading[lang]; resolve(false); };
      document.head.append(script);
    });
  },

  setLanguage(lang) {
    if (this.LANGUAGES.includes(lang) && !this.translations[lang]) return this.load(lang).then((ok) => this.setLanguage(ok ? lang : 'en'));
    this.currentLang = this.translations[lang] ? lang : 'en';
    try {
      localStorage.setItem('nordlys_language', this.currentLang);
    } catch(e) {}
    // Screen readers pick their voice from it.
    document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : this.currentLang;
    this.applyDOM();
    window.dispatchEvent(new CustomEvent('nordlys:languagechange', { detail: { lang: this.currentLang } }));
  },

  applyDOM(root = document) {
    // 1. Elements with data-i18n (textContent / innerText)
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.hasAttribute('placeholder')) el.setAttribute('placeholder', text);
      } else {
        el.textContent = text;
      }
    });

    // 2. Placeholders
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', this.t(key));
    });

    // 3. Titles / Tooltips
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.setAttribute('title', this.t(key));
    });

    // 4. Aria labels
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', this.t(key));
    });
  }
};
