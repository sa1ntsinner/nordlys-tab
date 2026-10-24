/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - A REVIEW, ASKED FOR ONCE
   ═══════════════════════════════════════════════════════════════════

   After two weeks and thirty new tabs on this device, a small card in the
   corner asks for a review in the store this copy came from (platform.js).
   It takes no focus, is shown once, and never comes back whatever the
   answer. The count stays on this device and nothing is sent. A browser
   with no store to send to (Safari for now, a copy loaded by hand) is
   never asked. */
(function (root) {
  "use strict";

  const KEY = "nordlys_review";
  const DAYS = 14;
  const TABS = 30;

  // One more new tab: the count to keep, and whether the card is due now.
  function count(state, now) {
    const next = { since: Number.isFinite(state?.since) ? state.since : now, tabs: (Number(state?.tabs) || 0) + 1, done: Boolean(state?.done) };
    return { state: next, due: !next.done && next.tabs >= TABS && now - next.since >= DAYS * 86400000 };
  }

  const read = () => { try { return JSON.parse(root.localStorage.getItem(KEY) || "null"); } catch (error) { return null; } };
  const write = (state) => { try { root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* counted again next tab */ } };

  function storeUrl() {
    const P = root.NordlysPlatform;
    let manifest = {};
    try { manifest = root.chrome?.runtime?.getManifest?.() || {}; } catch (error) { /* a plain page */ }
    return P?.reviewUrl({ name: P.name, id: root.chrome?.runtime?.id, updateUrl: manifest.update_url }) || null;
  }

  function say(key, fallback) {
    const value = root.I18N?.t(key);
    return value && value !== key ? value : fallback;
  }

  function show(url, onDone) {
    const card = document.createElement("aside");
    card.className = "review-ask glass-panel";
    card.setAttribute("aria-labelledby", "review-ask-title");
    const title = document.createElement("h2");
    title.id = "review-ask-title";
    title.textContent = say("review.title", "A line for Nordlys?");
    const text = document.createElement("p");
    text.textContent = say("review.text", "One person makes it, and a review in the store is how others find it. A sentence or two is plenty.");
    const write = document.createElement("a");
    write.className = "glass-btn accent";
    write.href = url;
    write.target = "_blank";
    write.rel = "noopener noreferrer";
    write.textContent = say("review.write", "Write a review");
    const later = document.createElement("button");
    later.type = "button";
    later.className = "glass-btn";
    later.textContent = say("review.no", "No, thanks");
    const actions = document.createElement("div");
    actions.className = "review-ask-actions";
    actions.append(write, later);
    card.append(title, text, actions);
    const close = () => { card.classList.add("is-leaving"); setTimeout(() => card.remove(), 200); onDone?.(); };
    write.addEventListener("click", close);
    later.addEventListener("click", close);
    card.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } });
    document.body.append(card);
    return card;
  }

  /* Counted on every new tab; shown a moment after the page settles, and
     only over a quiet page: Settings or a dialog open, it waits for the
     next tab. */
  function run({ now = Date.now(), delay = 3000 } = {}) {
    const url = storeUrl();
    if (!url) return;
    const { state, due } = count(read(), now);
    write(state);
    if (!due) return;
    setTimeout(() => {
      if (document.hidden || root.NordlysUI?.layers?.length || document.body.classList.contains("cfgopen")) return;
      write({ ...state, done: true });
      show(url);
    }, delay);
  }

  const api = { KEY, DAYS, TABS, count, run, show, storeUrl };
  root.NordlysReviewAsk = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
