/* The layouts the store artwork is composed in. Every picture of the product
   inside them is the product itself, captured by the specs beside this file;
   this only decides where each capture sits, what is said above it, and the
   light it sits in. One type scale, one window, one depth, so the five
   screenshots read as one set. */

const FONTS = `
  @font-face { font-family: "Outfit"; src: url("/src/fonts/outfit.woff2") format("woff2"); font-weight: 100 900; }
  @font-face { font-family: "Instrument Sans"; src: url("/src/fonts/instrument-sans.woff2") format("woff2"); font-weight: 400 700; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { overflow: hidden; }
  body { font-family: "Instrument Sans", system-ui, sans-serif; color: #eef3fb; -webkit-font-smoothing: antialiased; }
`;

/* The light every slide sits in: its own capture, blurred far past legibility
   and lowered, so the colour around the window is the colour inside it. */
const backdrop = (image, { blur = 64, dim = 0.5 } = {}) => `
  <div class="bg" style="position:absolute;inset:-12%;background:url('${image}') center/cover;filter:blur(${blur}px) saturate(1.25) brightness(${dim});"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,.06), transparent 60%), linear-gradient(180deg, rgba(4,7,14,.25), rgba(4,7,14,.55));"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(38% 46% at 12% 88%, rgba(53,214,192,.20), transparent 70%), radial-gradient(40% 50% at 90% 78%, rgba(91,108,255,.24), transparent 70%), radial-gradient(30% 30% at 50% 108%, rgba(160,110,255,.18), transparent 70%);"></div>`;

/* A plain window: no operating system's chrome, only an edge, a hairline and
   a shadow deep enough to lift it off the light. */
const windowFrame = (image, { width, x, y, radius = 16, tilt = '' }) => `
  <div style="position:absolute;left:${x}px;top:${y}px;width:${width}px;border-radius:${radius}px;overflow:hidden;transform:${tilt || 'none'};
    box-shadow:0 2px 0 rgba(255,255,255,.06) inset, 0 0 0 1px rgba(255,255,255,.13), 0 30px 60px -10px rgba(0,0,0,.55), 0 60px 140px -20px rgba(0,0,0,.6);">
    <img src="${image}" style="display:block;width:100%;height:auto">
  </div>`;

const heading = (title, subtitle, { top = 58 } = {}) => `
  <div style="position:absolute;left:0;right:0;top:${top}px;text-align:center;padding:0 120px">
    <h1 style="font-family:Outfit,system-ui;font-weight:600;font-size:46px;line-height:1.08;letter-spacing:-1.2px;color:#f4f7fd;text-shadow:0 2px 24px rgba(0,0,0,.35)">${title}</h1>
    <p style="margin-top:14px;font-size:19px;line-height:1.45;color:rgba(228,236,250,.78);max-width:940px;margin-left:auto;margin-right:auto">${subtitle}</p>
  </div>`;

const page = (width, height, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  body { width:${width}px; height:${height}px; position:relative; background:#060a14; }
</style></head><body>${body}</body></html>`;

/* 1280 x 800: a headline, a line under it, and the product. */
function slide({ title, subtitle, image, backdropImage }) {
  return page(1280, 800, `${backdrop(backdropImage || image)}${heading(title, subtitle)}${windowFrame(image, { width: 912, x: 184, y: 190 })}`);
}

/* 1280 x 800 with four captures of one board, labelled. */
function mosaic({ title, subtitle, frames, backdropImage }) {
  const w = 452, h = Math.round(w * 900 / 1440), gap = 22;
  const left = Math.round((1280 - (w * 2 + gap)) / 2), top = 200;
  const cells = frames.map((frame, index) => {
    const x = left + (index % 2) * (w + gap), y = top + Math.floor(index / 2) * (h + gap);
    return `${windowFrame(frame.image, { width: w, x, y, radius: 12 })}
      <span style="position:absolute;left:${x + 14}px;top:${y + h - 42}px;padding:6px 12px;border-radius:999px;font-size:14px;font-weight:600;letter-spacing:.2px;color:#f4f7fd;background:rgba(8,12,24,.62);backdrop-filter:blur(10px);box-shadow:0 0 0 1px rgba(255,255,255,.14)">${frame.label}</span>`;
  }).join('');
  return page(1280, 800, `${backdrop(backdropImage || frames[0].image)}${heading(title, subtitle)}${cells}`);
}

const label = (text, x, y) => `<span style="position:absolute;left:${x}px;top:${y}px;padding:5px 11px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:.2px;color:#f4f7fd;background:rgba(8,12,24,.62);backdrop-filter:blur(10px);box-shadow:0 0 0 1px rgba(255,255,255,.14)">${text}</span>`;

/* 1280 x 800 with nine captures in a three by three grid, each named. Without
   a title it is the grid alone, for the site and the README. */
function grid({ title, subtitle, frames, backdropImage }) {
  const gap = 16, top = title ? 184 : 34, h = Math.floor((800 - top - 34 - gap * 2) / 3), w = Math.round(h * 1.6);
  const left = Math.round((1280 - (w * 3 + gap * 2)) / 2);
  const cells = frames.map((frame, index) => {
    const x = left + (index % 3) * (w + gap), y = top + Math.floor(index / 3) * (h + gap);
    return `${windowFrame(frame.image, { width: w, x, y, radius: 10 })}${label(frame.label, x + 10, y + h - 36)}`;
  }).join('');
  return page(1280, 800, `${backdrop(backdropImage || frames[0].image)}${title ? heading(title, subtitle, { top: 50 }) : ''}${cells}`);
}

/* 1280 x 800 with four close-ups on cards, two by two, each with its name
   above it. A card's picture is one capture, or four small ones. */
function tiles({ title, subtitle, cells, backdropImage }) {
  const gap = 22, top = 196, width = 1112, w = (width - gap) / 2, h = (800 - top - 34 - gap) / 2;
  const left = (1280 - width) / 2;
  const picture = (cell) => cell.images
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;height:100%">${cell.images.map(image => `
        <div style="position:relative;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.12)">
          <img src="${image.image}" style="display:block;width:100%;height:100%;object-fit:cover">
          <span style="position:absolute;left:8px;bottom:7px;font-size:11px;font-weight:600;color:#f4f7fd;text-shadow:0 1px 6px rgba(0,0,0,.7)">${image.label}</span>
        </div>`).join('')}</div>`
    : `<img src="${cell.image}" style="display:block;max-width:100%;max-height:100%;border-radius:10px;box-shadow:0 0 0 1px rgba(255,255,255,.12), 0 18px 40px -12px rgba(0,0,0,.6)">`;
  const cards = cells.map((cell, index) => {
    const x = left + (index % 2) * (w + gap), y = top + Math.floor(index / 2) * (h + gap);
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:16px;padding:16px 18px 18px;display:flex;flex-direction:column;gap:12px;
        background:rgba(10,15,28,.58);backdrop-filter:blur(18px);box-shadow:0 0 0 1px rgba(255,255,255,.12), 0 30px 60px -18px rgba(0,0,0,.6)">
      <p style="font-family:Outfit,system-ui;font-size:19px;font-weight:600;letter-spacing:-.2px;color:#f4f7fd">${cell.label}</p>
      <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">${picture(cell)}</div>
    </div>`;
  }).join('');
  return page(1280, 800, `${backdrop(backdropImage || cells[0].image)}${heading(title, subtitle)}${cards}`);
}

/* 1280 x 800 with two captures overlapping: one set back, one in front. */
function pair({ title, subtitle, back, front, backdropImage }) {
  return page(1280, 800, `${backdrop(backdropImage || back)}${heading(title, subtitle)}
    ${windowFrame(back, { width: 700, x: 96, y: 206, radius: 14 })}
    ${windowFrame(front, { width: 700, x: 484, y: 262, radius: 14 })}`);
}

/* 1280 x 800 with the board set back and one part of it brought forward,
   larger, on a card of its own. */
function feature({ title, subtitle, back, detail, detailWidth = 560, backdropImage }) {
  return page(1280, 800, `${backdrop(backdropImage || back)}${heading(title, subtitle)}
    ${windowFrame(back, { width: 780, x: 90, y: 200, radius: 14 })}
    <div style="position:absolute;right:90px;top:200px;bottom:30px;width:${detailWidth}px;display:flex;align-items:center">
      <div style="width:100%;border-radius:18px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.16), 0 30px 70px -10px rgba(0,0,0,.65), 0 60px 140px -20px rgba(0,0,0,.6)">
        <img src="${detail}" style="display:block;width:100%;height:auto">
      </div>
    </div>`);
}

const lockup = ({ scale = 1 }) => `
  <div style="display:flex;align-items:center;gap:${20 * scale}px">
    <img src="/icons/icon128.png" style="width:${84 * scale}px;height:${84 * scale}px;border-radius:${22 * scale}px;box-shadow:0 ${14 * scale}px ${36 * scale}px rgba(0,0,0,.45)">
    <span style="font-family:Outfit,system-ui;font-weight:500;font-size:${92 * scale}px;letter-spacing:${-2.4 * scale}px;line-height:1;color:#f4f7fd;text-shadow:0 ${4 * scale}px ${26 * scale}px rgba(0,0,0,.5)">Nordlys</span>
  </div>`;

const chip = (text) => `<span style="padding:8px 14px;border-radius:999px;font-size:15px;font-weight:600;color:#eef3fb;background:rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(255,255,255,.16);backdrop-filter:blur(8px)">${text}</span>`;

/* The name, one line and three facts on the left, the board leaning in from
   the right edge: the store's marquee (1400 x 560) and the link preview the
   site hands to chats and social sites (1200 x 630). */
const TAGLINE = 'Bookmark folders on your new tab, with an animated background.';
const FACTS = ['9 backgrounds', '21 themes', 'No account or analytics'];

function banner({ sky, product, width, height, scale, productWidth, productTop, textLeft, textWidth }) {
  return page(width, height, `
    <div style="position:absolute;inset:0;background:url('${sky}') center/cover"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(90deg, rgba(5,8,16,.8) 0%, rgba(5,8,16,.45) 46%, rgba(5,8,16,.05) 75%)"></div>
    <div style="position:absolute;right:${-Math.round(productWidth * 0.2)}px;top:${productTop}px;perspective:1600px">
      ${windowFrame(product, { width: productWidth, x: 0, y: 0, radius: 16, tilt: 'rotateY(-16deg) rotateX(4deg)' }).replace('position:absolute;left:0px;top:0px;', 'position:relative;')}
    </div>
    <div style="position:absolute;left:${textLeft}px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:${24 * scale}px;width:${textWidth}px">
      ${lockup({ scale: 0.9 * scale })}
      <p style="font-size:${26 * scale}px;line-height:1.35;color:rgba(232,240,252,.86);max-width:${textWidth - 40}px">${TAGLINE}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${FACTS.map(chip).join('')}</div>
    </div>`);
}

const marquee = ({ sky, product }) => banner({ sky, product, width: 1400, height: 560, scale: 1, productWidth: 760, productTop: 70, textLeft: 96, textWidth: 560 });
const og = ({ sky, product }) => banner({ sky, product, width: 1200, height: 630, scale: 1, productWidth: 660, productTop: 110, textLeft: 72, textWidth: 520 });

/* 440 x 280: legible at the size the store shows it — the mark, the name and
   four words. */
function small({ sky }) {
  return page(440, 280, `
    <div style="position:absolute;inset:0;background:url('${sky}') center/cover"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(90% 90% at 50% 50%, rgba(5,8,16,.2), rgba(5,8,16,.62))"></div>
    <div style="position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:16px">
      ${lockup({ scale: 0.52 })}
      <p style="font-size:17px;letter-spacing:.2px;color:rgba(232,240,252,.86);text-shadow:0 2px 12px rgba(0,0,0,.5)">Bookmarks on your new tab</p>
    </div>`);
}

/* A wide cover for the Buy Me a Coffee page: the sky, the name centred a
   little high, so an avatar laid over the bottom edge takes nothing from it. */
function cover({ sky, width, height }) {
  const scale = height / 600;
  return page(width, height, `
    <div style="position:absolute;inset:0;background:url('${sky}') center/cover"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(5,8,16,.1), rgba(5,8,16,.45))"></div>
    <div style="position:absolute;left:0;right:0;top:${Math.round(height * 0.3)}px;display:grid;justify-items:center;gap:${18 * scale}px">
      ${lockup({ scale: 1.05 * scale })}
      <p style="font-size:${28 * scale}px;color:rgba(232,240,252,.86);text-shadow:0 2px 16px rgba(0,0,0,.5)">Bookmark folders on your new tab. No account or ads.</p>
    </div>`);
}

module.exports = { slide, mosaic, grid, tiles, pair, feature, marquee, og, small, cover };
