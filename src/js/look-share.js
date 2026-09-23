/* A look: everything about how Nordlys appears and nothing about what it holds.
   Theme, sky, mood, the scatter of the sky, fonts and the shape of the board go
   into it; bookmarks, a name, a wallpaper and custom CSS never do — not by
   filtering them out, but by only ever reading the fields listed here.

   The text form is `nordlys-look:v1:` and base64url of the JSON, short enough
   to paste into a message. Decoding trusts nothing: every field is checked and
   anything unknown, malformed or out of range is dropped rather than applied. */
(function () {
  const PREFIX = 'nordlys-look:v1:';
  const HEX = /^#[0-9a-f]{6}$/i;
  const SCENES = ['aurora', 'halo', 'silk', 'frost', 'drift', 'horizon', 'solid'];
  const FAMILY = /^[\p{L}\p{N} .'&+-]{1,64}$/u;
  const STUDIO = ['bg', 'card', 'border', 'accent', 'glow', 'text', 'dim'];

  const number = (min, max) => value => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined);
  const oneOf = options => value => (options.includes(value) ? value : undefined);
  const FIELDS = {
    theme: value => (typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value) ? value : undefined),
    bgMode: oneOf(SCENES),
    bgPalette: value => (typeof value === 'string' && /^[\w-]{1,48}$/.test(value) ? value : undefined),
    bgMotion: number(0, 1.5),
    bgIntensity: number(0.15, 1.5),
    bgSeed: value => (Number.isInteger(value) && value >= 0 && value <= 0xffffffff ? value : undefined),
    bgRealSky: value => (typeof value === 'boolean' ? value : undefined),
    bgDaylight: value => (typeof value === 'boolean' ? value : undefined),
    boardLayout: oneOf(['natural', 'fitted']),
    glassLevel: oneOf(['full', 'subtle', 'off']),
    cardRadius: number(6, 36),
    tileSize: number(50, 110),
    cardGap: number(6, 28),
    boardGap: number(6, 48),
    boardWidth: oneOf(['narrow', 'standard', 'wide']),
    tileLabels: value => (typeof value === 'boolean' ? value : undefined),
    cardGlow: number(0, 100),
    iconShape: oneOf(['squircle', 'rounded', 'circle']),
    hoverEffect: oneOf(['lift', 'glow', 'scale', 'none'])
  };

  function cleanFonts(fonts) {
    if (!fonts || typeof fonts !== 'object' || Array.isArray(fonts)) return undefined;
    const out = {};
    for (const slot of ['display', 'interface', 'mono']) {
      if (typeof fonts[slot] === 'string' && FAMILY.test(fonts[slot])) out[slot] = fonts[slot];
    }
    return Object.keys(out).length ? out : undefined;
  }

  function cleanStudio(theme) {
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return undefined;
    const out = {};
    for (const key of STUDIO) {
      if (!HEX.test(theme[key] || '')) return undefined;
      out[key] = theme[key].toLowerCase();
    }
    return out;
  }

  function cleanMood(mood) {
    if (!mood || typeof mood !== 'object' || Array.isArray(mood)) return undefined;
    const colors = Array.isArray(mood.colors) && mood.colors.length === 3 && mood.colors.every(color => HEX.test(color || '')) ? mood.colors.map(color => color.toLowerCase()) : null;
    if (!colors) return undefined;
    const name = typeof mood.name === 'string' ? mood.name.trim().slice(0, 24) : '';
    return { name: name || 'Shared mood', colors };
  }

  /* Only the listed fields, each only if it is the right shape. */
  function clean(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const look = {};
    for (const [field, check] of Object.entries(FIELDS)) {
      const value = check(raw[field]);
      if (value !== undefined) look[field] = value;
    }
    const fonts = cleanFonts(raw.fonts);
    if (fonts) look.fonts = fonts;
    if (raw.theme === 'custom') {
      const studio = cleanStudio(raw.customTheme);
      if (studio) look.customTheme = studio; else delete look.theme;
    }
    const mood = cleanMood(raw.mood);
    if (mood) look.mood = mood;
    return Object.keys(look).length ? look : null;
  }

  // The look of a config as it stands.
  function capture(config) {
    const look = clean(config) || {};
    if (config.theme === 'custom') look.customTheme = cleanStudio(config.customTheme);
    const mood = (config.bgPalettes || []).find(entry => entry && entry.id === config.bgPalette);
    if (mood) look.mood = cleanMood(mood);
    // A wallpaper or a video stays on the device it was chosen on.
    if (!SCENES.includes(config.bgMode)) delete look.bgMode;
    return look;
  }

  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  }

  function encode(look) {
    return PREFIX + toBase64Url(JSON.stringify(look));
  }

  /* { look } when the text is a look, { error } when it is not. Four thousand
     characters is far more than any real look needs, and a limit on what is
     parsed at all. */
  function decode(text) {
    const trimmed = String(text || '').replace(/\s+/g, '');
    if (!trimmed.startsWith(PREFIX)) return { error: 'notALook' };
    const body = trimmed.slice(PREFIX.length);
    if (!body || body.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(body)) return { error: 'damaged' };
    let raw;
    try { raw = JSON.parse(fromBase64Url(body)); } catch { return { error: 'damaged' }; }
    const look = clean(raw);
    return look ? { look } : { error: 'empty' };
  }

  window.NordlysLook = { PREFIX, capture, encode, decode, clean };
})();
