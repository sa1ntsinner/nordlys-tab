/* Nine folders in the shape of a real board that asked for a symmetric
   layout: five of them two rows of tiles tall, four a single row, column
   counts from two to four. At 2000px the old wrap broke it six over three,
   with every edge ragged. The names are generic; the shape is the point. */
const link = (name, url) => ({ name, url });
const NINE_FOLDERS = {
  theme: 'aurora-void',
  groups: [
    { label: 'Watch', cols: 2, links: [link('YouTube', 'https://www.youtube.com/'), link('Vimeo', 'https://vimeo.com/'), link('Netflix', 'https://www.netflix.com/')] },
    { label: 'Studies', cols: 2, links: [link('Wikipedia', 'https://www.wikipedia.org/'), link('Coursera', 'https://www.coursera.org/'), link('Khan', 'https://www.khanacademy.org/'), link('arXiv', 'https://arxiv.org/')] },
    { label: 'AI', cols: 2, links: [link('Gemini', 'https://gemini.google.com/'), link('Perplexity', 'https://www.perplexity.ai/'), link('ChatGPT', 'https://chatgpt.com/'), link('Claude', 'https://claude.ai/')] },
    { label: 'Work', cols: 2, links: [link('GitHub', 'https://github.com/'), link('Linear', 'https://linear.app/')] },
    { label: 'Gaming', cols: 3, links: [link('Steam', 'https://store.steampowered.com/'), link('SteamDB', 'https://steamdb.info/'), link('GG.deals', 'https://gg.deals/'), link('Itch', 'https://itch.io/'), link('GOG', 'https://www.gog.com/'), link('Epic', 'https://store.epicgames.com/')] },
    { label: 'Read', cols: 2, links: [link('X', 'https://x.com/')] },
    { label: 'Shopping', cols: 2, links: [link('AliExpress', 'https://www.aliexpress.com/'), link('eBay', 'https://www.ebay.com/')] },
    { label: 'Misc', cols: 2, links: [link('VIA', 'https://usevia.app/')] },
    { label: 'Coding', cols: 4, links: [link('Exercism', 'https://exercism.org/'), link('Deep-ML', 'https://www.deep-ml.com/'), link('LeetCode', 'https://leetcode.com/'), link('LearnC++', 'https://www.learncpp.com/'), link('ROS', 'https://www.ros.org/'), link('Full Stack Open', 'https://fullstackopen.com/'), link('NeetCode', 'https://neetcode.io/')] }
  ]
};
module.exports = { NINE_FOLDERS };
