# 🎨 AetherTab Custom CSS Styling Guide

AetherTab provides an embedded, real-time Custom CSS injector that allows you to customize every aspect of the startpage interface.

---

## 🔍 Core Component CSS Selectors

| Selector | Description |
| :--- | :--- |
| `body` | Global page background and typography container |
| `#hero` | Clock, Date, and Greeting wrapper |
| `#clock` | Digital clock header (`#hh`, `#mm`, `#ss`) |
| `#date` | Top date indicator |
| `#greet` | Dynamic time-of-day greeting |
| `#searchwrap` | Omni-search bar wrapper container |
| `#search` | Glassmorphic search input box |
| `#q` | Search text input |
| `#sugg` | Autocomplete suggestions dropdown |
| `#board` | Main Bento card container |
| `.card` | Glassmorphic folder card |
| `.cat` | Folder category header (`.cat b`, `.cat s`) |
| `.grid` | CSS grid containing bookmark tiles |
| `.tile` | Bookmark tile anchor container |
| `.box` | Glassmorphic icon container tile box |
| `.lbl` | Bookmark title text |
| `#hiddenDock` | Dock holding folded / hidden folders |
| `#gear` | Settings trigger gear icon |
| `#cfg` | Sliding settings drawer |

---

## 🚀 Snippets & Examples

### 1. Ultra Minimalist (Hide Clock, Show Only Search & Bookmarks)
```css
#hero {
  display: none !important;
}

#page {
  justify-content: flex-start;
  padding-top: 10vh;
}
```

### 2. Neon Cyberpunk Glow on Bookmark Hover
```css
.tile:hover .box {
  box-shadow: 0 0 25px var(--c, #ff007f), inset 0 0 10px rgba(255, 255, 255, 0.4);
  border-color: #ffffff;
  transform: translateY(-8px) scale(1.1);
}
```

### 3. Extra Rounded macOS Tahoe Glass Cards
```css
:root {
  --card-radius: 36px;
  --tile-radius: 24px;
}

.card {
  backdrop-filter: blur(40px) saturate(220%);
  border: 1px solid rgba(255, 255, 255, 0.25);
}
```

### 4. Custom JetBrains Mono / Inter Typography
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;500;700&display=swap');

body, #clock, #q, .lbl {
  font-family: 'JetBrains Mono', monospace !important;
}

#clock {
  font-weight: 300;
  letter-spacing: -0.04em;
}
```

### 5. Floating Dock Bar at Bottom
```css
#board {
  position: fixed;
  bottom: 24px;
  max-width: 90vw;
}

.card {
  padding: 10px 14px;
}
```
