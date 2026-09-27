/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - MOVING AND RESIZING THE DASHBOARD CARDS BY HAND
   ═══════════════════════════════════════════════════════════════════

   A card is picked up by its header and set down on any cell; the cards it
   lands on step aside while it is still in the hand, and a soft outline
   shows where it will go. Its lower right corner stretches it cell by cell.
   Where things end up is decided by dash-layout.js; this file is only the
   hand: the pointer, the lifted card, the outline and the glide home.

   Escape while carrying puts everything back. On a narrow window, where the
   cards stand in one or two columns, the menu moves them instead.        */
(function () {
  "use strict";

  const DL = window.NordlysDashLayout;
  const LIFT = 4;

  class NordlysDashArrange {
    constructor(dash) {
      this.dash = dash;
      this.hand = null;
      this.onDown = this.onDown.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.onKey = this.onKey.bind(this);
    }

    bind(grid) {
      if (grid.dataset.arrangeBound) return;
      grid.dataset.arrangeBound = "1";
      grid.addEventListener("pointerdown", this.onDown);
    }

    onDown(event) {
      if (event.button !== 0 || this.hand || !event.isPrimary) return;
      const card = event.target.closest(".dash-card");
      if (!card) return;
      const corner = event.target.closest(".dash-resize");
      const head = event.target.closest(".dash-head");
      if (!corner && (!head || event.target.closest("button, input, textarea, select, a"))) return;
      if (this.dash.cols !== DL.COLS) return;
      event.preventDefault();
      this.hand = { mode: corner ? "resize" : "move", card, id: card.dataset.widgetId, x0: event.clientX, y0: event.clientY, pointer: event.pointerId, started: false };
      card.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
      if (corner) this.begin();
    }

    begin() {
      const hand = this.hand;
      const dash = this.dash;
      hand.started = true;
      hand.base = dash.layout();
      hand.current = hand.base;
      hand.item = hand.base.find((it) => it.id === hand.id);
      hand.rect = hand.card.getBoundingClientRect();
      hand.metrics = dash.metrics();
      dash.dragging = true;
      /* One page fit holds still while a card is in the hand: the outline and
         the cards stepping aside change the height it fits, and a page that
         rescaled mid-drag would move the cells out from under the pointer. */
      if (dash.app.grid) dash.app.grid.frozen = true;
      dash.closeMenu?.();
      document.activeElement?.blur?.();
      // The outline of where it will land, on the cells it holds now.
      hand.ghost = document.createElement("div");
      hand.ghost.className = "dash-ghost";
      hand.ghost.setAttribute("aria-hidden", "true");
      this.putGhost(hand.item);
      dash.grid.append(hand.ghost);
      dash.grid.classList.add("is-arranging");
      document.body.classList.add("dash-carrying");
      const { card, rect } = hand;
      /* One Page Fit may have zoomed the page: the pointer moves in screen
         pixels, the card in its own. */
      hand.zoom = rect.width / Math.max(1, card.offsetWidth) || 1;
      card.classList.add(hand.mode === "move" ? "is-lifted" : "is-resizing");
      if (hand.mode === "resize") {
        card.style.width = `${card.offsetWidth}px`;
        card.style.height = `${card.offsetHeight}px`;
      }
      window.addEventListener("keydown", this.onKey, true);
      window.NordlysUI?.announce?.(hand.mode === "move" ? this.say("dash.carrying", "Moving the card. Escape puts it back.") : this.say("dash.resizing", "Resizing the card. Escape puts it back."));
    }

    say(key, fallback) {
      const value = window.I18N?.t(key);
      return value && value !== key ? value : fallback;
    }

    putGhost(it) {
      const ghost = this.hand.ghost;
      ghost.style.gridColumn = `${it.x + 1} / span ${it.w}`;
      ghost.style.gridRow = `${it.y + 1} / span ${it.h}`;
    }

    onMove(event) {
      const hand = this.hand;
      if (!hand || event.pointerId !== hand.pointer) return;
      const dx = event.clientX - hand.x0;
      const dy = event.clientY - hand.y0;
      if (!hand.started) {
        if (Math.hypot(dx, dy) < LIFT) return;
        this.begin();
      }
      const { box, cell, row } = hand.metrics;
      let next;
      if (hand.mode === "move") {
        hand.card.style.transform = `translate(${dx / hand.zoom}px, ${dy / hand.zoom}px)`;
        // Where its top left corner is over, in cells.
        const x = (hand.rect.left + dx - box.left) / cell;
        const y = (hand.rect.top + dy - box.top) / row;
        next = DL.move(hand.base, hand.id, x, y);
      } else {
        // Never past the grid's right edge, never taller than the card may be.
        const limit = hand.item.maxH || DL.MAX_H;
        const width = Math.max(120, Math.min(box.right - hand.rect.left, hand.rect.width + dx));
        const height = Math.max(88, Math.min(limit * row, hand.rect.height + dy));
        hand.card.style.width = `${width / hand.zoom}px`;
        hand.card.style.height = `${height / hand.zoom}px`;
        const gap = hand.metrics.gap * hand.zoom;
        next = DL.resize(hand.base, hand.id, (width + gap) / cell, (height + gap) / row);
      }
      const it = next.find((i) => i.id === hand.id);
      const key = JSON.stringify(next.map((i) => [i.id, i.x, i.y, i.w, i.h]));
      if (key === hand.key) return;
      hand.key = key;
      hand.current = next;
      this.putGhost(it);
      this.dash.place(next, { animate: true, except: hand.id });
    }

    onKey(event) {
      if (event.key !== "Escape" || !this.hand) return;
      event.preventDefault();
      event.stopPropagation();
      this.finish(false);
    }

    onUp(event) {
      const hand = this.hand;
      if (!hand || event.pointerId !== hand.pointer) return;
      if (!hand.started) { this.release(); return; }
      this.finish(true);
    }

    release() {
      const hand = this.hand;
      window.removeEventListener("pointermove", this.onMove);
      window.removeEventListener("pointerup", this.onUp);
      window.removeEventListener("pointercancel", this.onUp);
      window.removeEventListener("keydown", this.onKey, true);
      hand?.card.releasePointerCapture?.(hand.pointer);
      this.hand = null;
    }

    /* The card glides from under the pointer onto its cells. */
    finish(keep) {
      const hand = this.hand;
      const dash = this.dash;
      const { card } = hand;
      const final = keep ? hand.current : hand.base;
      const from = card.getBoundingClientRect();
      card.classList.remove("is-lifted", "is-resizing");
      for (const prop of ["width", "height", "transform"]) card.style[prop] = "";
      hand.ghost.remove();
      dash.grid.classList.remove("is-arranging");
      document.body.classList.remove("dash-carrying");
      this.release();
      dash.place(final, { animate: true, except: hand.id });
      const spot = final.find((it) => it.id === hand.id);
      card.style.gridColumn = `${spot.x + 1} / span ${spot.w}`;
      card.style.gridRow = `${spot.y + 1} / span ${spot.h}`;
      card.dataset.w = String(spot.w);
      card.dataset.h = String(spot.h);
      const to = card.getBoundingClientRect();
      const { still, duration, easing } = dash.motion();
      if (!still) {
        const sx = from.width / Math.max(1, to.width), sy = from.height / Math.max(1, to.height);
        const z = hand.zoom || 1;
        card.animate([
          { transform: `translate(${(from.left - to.left) / z}px, ${(from.top - to.top) / z}px) scale(${sx}, ${sy})`, transformOrigin: "top left" },
          { transform: "none", transformOrigin: "top left" }
        ], { duration, easing });
      }
      dash.dragging = false;
      if (dash.app.grid) dash.app.grid.frozen = false;
      dash.app.pageFit?.request?.();
      const changed = JSON.stringify(final) !== JSON.stringify(dash.layout());
      if (keep && changed) dash.commit(final);
      else if (!keep) dash.place(hand.base, { animate: true });
    }
  }

  window.NordlysDashArrange = NordlysDashArrange;
})();
