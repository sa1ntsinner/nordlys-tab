/* ═══════════════════════════════════════════════════════════════════
   AURORA TAB 2.1 - SHARED UI KIT (ESCAPING, TOASTS, GLASS CONFIRM)
   Loaded first so every other module can rely on these primitives.
   ═══════════════════════════════════════════════════════════════════ */

/* Escape user-provided strings before they are placed into innerHTML. */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* #rrggbb -> { r, g, b } (returns null on anything else) */
function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/* Perceived luminance 0..1 — used to auto-detect light custom themes. */
function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const linear = (value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

/* ── Frosted Toast Notifications ─────────────────────────────────── */
const AuroraToast = {
  dock: null,

  ensureDock() {
    if (!this.dock) {
      this.dock = document.getElementById("toast-dock");
    }
    if (!this.dock) {
      this.dock = document.createElement("div");
      this.dock.id = "toast-dock";
      document.body.appendChild(this.dock);
    }
    return this.dock;
  },

  /* kind: "info" | "success" | "danger" */
  show(message, kind = "info", duration = 2600) {
    const dock = this.ensureDock();

    // Keep the stack short & readable
    while (dock.children.length >= 3) {
      dock.firstElementChild.remove();
    }

    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.setAttribute("role", "status");

    const icons = {
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>',
      danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    el.innerHTML = `${icons[kind] || icons.info}<span></span>`;
    el.querySelector("span").textContent = message;
    dock.appendChild(el);

    // enter -> hold -> leave
    requestAnimationFrame(() => el.classList.add("on"));
    setTimeout(() => {
      el.classList.remove("on");
      el.addEventListener("transitionend", () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 600); // fallback removal
    }, duration);
  }
};

function toast(message, kind = "info", duration) {
  AuroraToast.show(message, kind, duration);
}

/* ── Glass Confirm Dialog (Promise-based confirm() replacement) ──── */
const AuroraConfirm = {
  active: null,

  open({ title, message, confirmText, cancelText, danger = true }) {
    // Only one dialog at a time; auto-cancel the previous one
    if (this.active) this.active.resolve(false);

    const backdrop = document.getElementById("confirm-modal");
    if (!backdrop) return Promise.resolve(window.confirm(message || title));

    const t = (k, fb) => (window.I18N ? window.I18N.t(k) : fb);
    backdrop.querySelector(".confirm-title").textContent = title || t("confirm.title", "Are you sure?");
    backdrop.querySelector(".confirm-message").textContent = message || "";
    const okBtn = backdrop.querySelector(".confirm-ok");
    const cancelBtn = backdrop.querySelector(".confirm-cancel");
    okBtn.textContent = confirmText || t("confirm.delete", "Delete");
    cancelBtn.textContent = cancelText || t("confirm.cancel", "Cancel");
    okBtn.classList.toggle("danger", danger);

    backdrop.classList.add("open");

    return new Promise((resolve) => {
      const done = (result) => {
        backdrop.classList.remove("open");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        backdrop.removeEventListener("click", onBackdrop);
        window.removeEventListener("keydown", onKey, true);
        this.active = null;
        resolve(result);
      };
      const onOk = () => done(true);
      const onCancel = () => done(false);
      const onBackdrop = (e) => { if (e.target === backdrop) done(false); };
      const onKey = (e) => {
        if (e.key === "Escape") { e.stopPropagation(); done(false); }
        if (e.key === "Enter") { e.stopPropagation(); done(true); }
      };

      this.active = { resolve: done };
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      backdrop.addEventListener("click", onBackdrop);
      window.addEventListener("keydown", onKey, true);
      setTimeout(() => okBtn.focus(), 60);
    });
  }
};

function confirmDialog(options) {
  return AuroraConfirm.open(typeof options === "string" ? { message: options } : options);
}
