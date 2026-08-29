/* Font slots. Typography is global rather than part of a theme: a theme is a
   colour palette, so a palette switch must never change which face you read. */
(function () {
  const FALLBACK = {
    display: '"Segoe UI Variable Display", "Segoe UI", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    interface: '"Segoe UI Variable Text", "Segoe UI", "SF Pro Text", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace'
  };

  const SLOTS = [
    { key: 'display', token: '--font-display', bundled: 'Outfit', mono: false },
    { key: 'interface', token: '--font-main', bundled: 'Instrument Sans', mono: false },
    { key: 'mono', token: '--font-mono', bundled: null, mono: true }
  ];

  /* Shipped inside the extension, so always offered. */
  const BUNDLED = ['Outfit', 'Instrument Sans'];

  /* Offered by name only — an absent family simply falls through the stack, so
     naming one costs nothing and needs no permission. Split by slot so a
     monospace face is never proposed for the clock, or a proportional one for
     the calculator readout. */
  const SYSTEM = {
    proportional: ['Segoe UI', 'SF Pro Text', 'Inter', 'Roboto', 'Helvetica Neue', 'Arial', 'Georgia'],
    mono: ['Cascadia Code', 'Consolas', 'SF Mono', 'Menlo', 'IBM Plex Mono']
  };

  const DEFAULT = 'default';

  function slotFor(key) { return SLOTS.find(slot => slot.key === key); }

  function stackFor(key, family) {
    const slot = slotFor(key);
    if (!slot) return '';
    const tail = FALLBACK[key];
    if (!family || family === DEFAULT) return slot.bundled ? `"${slot.bundled}", ${tail}` : tail;
    return `"${family}", ${slot.bundled ? `"${slot.bundled}", ` : ''}${tail}`;
  }

  /* Written onto :root beside the theme tokens so one code path applies both. */
  function apply(config, root = document.documentElement) {
    const chosen = (config && config.fonts) || {};
    for (const slot of SLOTS) root.style.setProperty(slot.token, stackFor(slot.key, chosen[slot.key]));
  }

  /* Older builds stored a font on the custom theme. Move it into the Interface
     slot once and drop the key, so the value survives without the concept doing. */
  function migrate(config) {
    if (!config) return false;
    const legacy = config.customTheme && config.customTheme.font;
    if (!legacy) return false;
    config.fonts = Object.assign({}, config.fonts);
    if (!config.fonts.interface || config.fonts.interface === DEFAULT) {
      // The legacy value was a whole CSS stack; keep only the first family.
      config.fonts.interface = String(legacy).split(',')[0].replace(/["']/g, '').trim() || DEFAULT;
    }
    delete config.customTheme.font;
    return true;
  }

  function optionsFor(key, deviceFamilies = []) {
    const slot = slotFor(key);
    const common = slot?.mono ? SYSTEM.mono : SYSTEM.proportional;
    const bundled = slot?.mono ? [] : BUNDLED;
    const seen = new Set();
    const rows = [{ value: DEFAULT, label: 'Default', group: 'Recommended' }];
    for (const family of bundled) if (!seen.has(family)) { seen.add(family); rows.push({ value: family, label: family, group: 'Bundled with Nordlys' }); }
    for (const family of common) if (!seen.has(family)) { seen.add(family); rows.push({ value: family, label: family, group: 'Common system fonts' }); }
    for (const family of deviceFamilies) if (!seen.has(family)) { seen.add(family); rows.push({ value: family, label: family, group: 'Installed on this device' }); }
    return rows;
  }

  /* Chrome only reveals the device inventory from a user gesture, and a refusal
     comes back as an empty list rather than an exception — so an empty result is
     reported as "unavailable", never as success with nothing in it. */
  async function listLocalFonts() {
    if (typeof window.queryLocalFonts !== 'function') return { granted: false, families: [] };
    try {
      const faces = await window.queryLocalFonts();
      const families = [...new Set(faces.map(face => face.family))].sort((a, b) => a.localeCompare(b));
      return { granted: families.length > 0, families };
    } catch {
      return { granted: false, families: [] };
    }
  }

  window.NordlysType = { SLOTS, BUNDLED, SYSTEM, DEFAULT, stackFor, apply, migrate, optionsFor, listLocalFonts };
})();
