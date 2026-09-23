/* The boards the store artwork is taken from: sites nearly everyone knows,
   each with the icon Nordlys ships for it (src/js/icons-db.js), so a stranger
   reads the picture as their own new tab and not as someone else's. Only the
   artwork uses these; the product still ships an empty board. */

const link = (name, url, icon, color) => ({ name, url, icon, color });

const SITES = {
  gmail: link('Gmail', 'https://mail.google.com/', 'gmail', '#ea4335'),
  drive: link('Drive', 'https://drive.google.com/', 'googledrive', '#1fa463'),
  youtube: link('YouTube', 'https://www.youtube.com/', 'youtube', '#ff0033'),
  wikipedia: link('Wikipedia', 'https://www.wikipedia.org/', 'wikipedia', '#e8eaed'),
  reddit: link('Reddit', 'https://www.reddit.com/', 'reddit', '#ff4500'),
  amazon: link('Amazon', 'https://www.amazon.com/', 'amazon', '#ff9900'),
  chatgpt: link('ChatGPT', 'https://chatgpt.com/', 'openai', '#10a37f'),
  claude: link('Claude', 'https://claude.ai/', 'claude', '#d97757'),
  gemini: link('Gemini', 'https://gemini.google.com/', 'gemini', '#8ab4f8'),
  perplexity: link('Perplexity', 'https://www.perplexity.ai/', 'perplexity', '#22b8cd'),
  notion: link('Notion', 'https://www.notion.so/', 'notion', '#f8f9fa'),
  slack: link('Slack', 'https://slack.com/', 'slack', '#e01e5a'),
  figma: link('Figma', 'https://www.figma.com/', 'figma', '#a259ff'),
  trello: link('Trello', 'https://trello.com/', 'trello', '#0c66e4'),
  linear: link('Linear', 'https://linear.app/', 'linear', '#8b8ff0'),
  github: link('GitHub', 'https://github.com/', 'github', '#e6edf3'),
  stackoverflow: link('Stack Overflow', 'https://stackoverflow.com/', 'stackoverflow', '#f48024'),
  docker: link('Docker', 'https://hub.docker.com/', 'docker', '#2496ed'),
  vercel: link('Vercel', 'https://vercel.com/', 'vercel', '#f5f5f5'),
  x: link('X', 'https://x.com/', 'twitter', '#f5f5f5'),
  discord: link('Discord', 'https://discord.com/app', 'discord', '#5865f2'),
  telegram: link('Telegram', 'https://web.telegram.org/', 'telegram', '#29b6f6'),
  linkedin: link('LinkedIn', 'https://www.linkedin.com/', 'linkedin', '#0a66c2'),
  pinterest: link('Pinterest', 'https://www.pinterest.com/', 'pinterest', '#e60023'),
  netflix: link('Netflix', 'https://www.netflix.com/', 'netflix', '#e50914'),
  spotify: link('Spotify', 'https://open.spotify.com/', 'spotify', '#1db954'),
  twitch: link('Twitch', 'https://www.twitch.tv/', 'twitch', '#9146ff'),
  steam: link('Steam', 'https://store.steampowered.com/', 'steam', '#66c0f4'),
  aliexpress: link('AliExpress', 'https://www.aliexpress.com/', 'aliexpress', '#ff4747'),
  google: link('Google', 'https://www.google.com/', 'google', '#4285f4')
};

const folder = (label, cols, names, hidden = false) => ({ label, cols, hidden, links: names.map(name => ({ ...SITES[name] })) });

/* A board with its look: theme, scene and arrangement are the product's own
   settings, set the way a user sets them. */
function board({ theme, scene, folders, ...settings }) {
  return { theme, bgMode: scene, groups: folders, ...settings };
}

const BOARDS = {
  // The hero: a full board under the aurora.
  sky: board({
    theme: 'aurora-void', scene: 'aurora', bgIntensity: 1.4,
    folders: [
      folder('Daily', 3, ['gmail', 'drive', 'youtube', 'wikipedia', 'reddit', 'amazon']),
      folder('AI', 2, ['chatgpt', 'claude', 'gemini', 'perplexity']),
      folder('Work', 3, ['notion', 'slack', 'figma', 'trello', 'linear', 'github']),
      folder('Social', 2, ['x', 'discord', 'telegram', 'linkedin']),
      folder('Watch & listen', 2, ['netflix', 'spotify', 'twitch', 'steam'], true),
      folder('Shopping', 2, ['amazon', 'aliexpress'], true)
    ]
  }),
  // Arranging: many folders, so Fitted has rows to even out.
  arrange: board({
    theme: 'catppuccin-mocha', scene: 'silk', tileSize: 64,
    folders: [
      folder('Daily', 3, ['gmail', 'drive', 'google', 'youtube', 'wikipedia', 'reddit']),
      folder('AI', 2, ['chatgpt', 'claude', 'gemini', 'perplexity']),
      folder('Work', 2, ['notion', 'slack', 'figma', 'trello']),
      folder('Code', 4, ['github', 'stackoverflow', 'docker', 'vercel']),
      folder('Social', 3, ['x', 'discord', 'telegram']),
      folder('Watch', 3, ['netflix', 'spotify', 'twitch']),
      folder('Shopping', 2, ['amazon', 'aliexpress'], true)
    ]
  }),
  // Icons: larger tiles, fewer folders, so each mark reads.
  icons: board({
    theme: 'tokyo-night', scene: 'halo', tileSize: 96,
    folders: [
      folder('Watch & listen', 2, ['youtube', 'netflix', 'spotify', 'twitch']),
      folder('AI', 2, ['chatgpt', 'claude', 'gemini', 'perplexity']),
      folder('Social', 2, ['x', 'discord', 'telegram', 'reddit'], true)
    ]
  }),
  // Daylight: the sky is the subject, so the board is folded into the dock.
  daylight: board({
    theme: 'dracula-velvet', scene: 'drift',
    folders: [
      folder('Daily', 3, ['gmail', 'drive', 'youtube'], true),
      folder('AI', 2, ['chatgpt', 'claude'], true),
      folder('Work', 2, ['notion', 'slack'], true)
    ]
  }),
  // Themes: the same board light and dark.
  light: board({
    theme: 'porcelain-light', scene: 'frost', boardWidth: 'wide',
    folders: [
      folder('Daily', 3, ['gmail', 'drive', 'youtube', 'wikipedia', 'reddit', 'amazon']),
      folder('Work', 3, ['notion', 'slack', 'figma', 'trello', 'linear', 'github']),
      folder('AI', 2, ['chatgpt', 'claude', 'gemini', 'perplexity']),
      folder('Social', 2, ['x', 'discord', 'telegram', 'pinterest'])
    ]
  }),
  // The marquee: a compact, familiar board to lean in from the edge.
  marquee: board({
    theme: 'boreal-emerald', scene: 'aurora', bgIntensity: 1.45,
    folders: [
      folder('Daily', 3, ['gmail', 'drive', 'youtube', 'wikipedia', 'reddit', 'amazon']),
      folder('AI', 2, ['chatgpt', 'claude', 'gemini', 'perplexity']),
      folder('Work', 2, ['notion', 'slack', 'figma', 'github']),
      folder('Watch', 2, ['netflix', 'spotify', 'twitch', 'steam'])
    ]
  })
};
BOARDS.dark = { ...BOARDS.light, theme: 'gruvbox-dark', bgMode: 'silk' };

module.exports = { BOARDS };
