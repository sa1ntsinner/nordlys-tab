/* The board the UI specs interact with.

   Nordlys ships an empty board: a new install shows nothing the user did not
   put there, which is the product's whole promise and is asserted by
   tests/unit/default-config.test.cjs. That leaves the interaction specs — drag,
   reorder, the context menus, the icon picker, the tile geometry — with nothing
   to act on, so they install this instead.

   It is a test fixture and never a product default. It is written where a real
   user's board lives, localStorage, before the page loads, so the specs drive
   exactly the path a returning user takes. Specs about first run, or about how
   the page adopts what it finds in storage, opt out with
   `test.use({ nordlysBoard: null })`.

   Shape note: complete and current, so loading it migrates nothing and
   therefore writes no restore point. Anything missing is filled from
   DEFAULT_CONFIG by loadConfig(). */

const DEMO_BOARD = {
  theme: 'aurora-void',
  groups: [
    {
      label: 'Daily',
      cols: 4,
      hidden: false,
      links: [
        { name: 'YouTube', url: 'https://www.youtube.com/', color: '#ff6b6b', icon: 'youtube' },
        { name: 'Notion', url: 'https://www.notion.so/', color: '#f8f9fa', icon: 'notion' },
        { name: 'ChatGPT', url: 'https://chatgpt.com/', color: '#10a37f', icon: 'openai' },
        { name: 'Reddit', url: 'https://www.reddit.com/', color: '#ff8c42', icon: 'reddit' },
        { name: 'DeepL', url: 'https://www.deepl.com/translator', color: '#4d96ff', icon: 'deepl' },
        { name: 'Spotify', url: 'https://open.spotify.com/', color: '#1db954', icon: 'spotify' },
        { name: 'Telegram', url: 'https://web.telegram.org/a/', color: '#29b6f6', icon: 'telegram' },
        { name: 'Netflix', url: 'https://www.netflix.com/', color: '#e50914', icon: 'netflix' }
      ]
    },
    {
      label: 'Dev & tech',
      cols: 3,
      hidden: false,
      links: [
        { name: 'GitHub', url: 'https://github.com/', color: '#9aa5b1', icon: 'github' },
        { name: 'LeetCode', url: 'https://leetcode.com/', color: '#ffa116', icon: 'leetcode' },
        { name: 'Gemini', url: 'https://gemini.google.com/app', color: '#8ab4f8', icon: 'gemini' },
        { name: 'Perplexity', url: 'https://www.perplexity.ai/', color: '#22b8cd', icon: 'perplexity' },
        { name: 'Deep-ML', url: 'https://www.deep-ml.com/', color: '#d946ef', icon: 'brain' },
        { name: 'VIA Keymap', url: 'https://usevia.app/', color: '#06b6d4', icon: 'keyboard' }
      ]
    },
    {
      label: 'Studies',
      cols: 2,
      hidden: false,
      links: [
        { name: 'Wikipedia', url: 'https://www.wikipedia.org/', color: '#f97316', icon: 'school' },
        { name: 'Coursera', url: 'https://www.coursera.org/', color: '#84cc16', icon: 'school' }
      ]
    },
    {
      label: 'Gaming & sim',
      cols: 2,
      hidden: false,
      links: [
        { name: 'Steam', url: 'https://store.steampowered.com/', color: '#66c0f4', icon: 'steam' },
        { name: 'GG.deals', url: 'https://gg.deals/', color: '#a855f7', icon: 'tag' },
        { name: 'LFM Sim', url: 'https://lowfuelmotorsport.com/', color: '#ef4444', icon: 'flag' },
        { name: 'RaceControl', url: 'https://game.racecontrol.gg/', color: '#38bdf8', icon: 'steering' }
      ]
    },
    {
      label: 'Shopping',
      cols: 2,
      hidden: false,
      links: [
        { name: 'AliExpress', url: 'https://www.aliexpress.com/', color: '#ff4747', icon: 'bag' },
        { name: 'Kleinanzeigen', url: 'https://www.kleinanzeigen.de/', color: '#86efac', icon: 'bag' }
      ]
    }
  ]
};

module.exports = { DEMO_BOARD };
