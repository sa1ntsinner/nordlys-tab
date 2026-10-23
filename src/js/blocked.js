/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - A SITE KEPT SHUT WHILE A FOCUS RUNS
   ═══════════════════════════════════════════════════════════════════

   The worker sends a tab here when it goes to a site the focus timer card
   lists while a focus runs (worker.js). The page says until when, and goes
   on to the site by itself as soon as no focus runs: the time is up, or the
   timer was paused or reset in any tab. */
(async function () {
  "use strict";

  const KEY = "nordlys_dash.focus-timer";
  const say = (key, fallback, params) => {
    const value = window.I18N?.t(key, params || {});
    return value && value !== key ? value : fallback;
  };
  let language = "en";
  try { language = localStorage.getItem("nordlys_language") || "en"; } catch (error) { /* English, then */ }
  await window.I18N?.setLanguage(language);

  let target = null;
  try { target = new URL(new URLSearchParams(location.search).get("u")); } catch (error) { /* nowhere to go on to */ }
  if (!/^https?:$/.test(target?.protocol || "")) target = null;
  const site = target ? target.hostname.replace(/^www\./, "") : "";
  if (site) document.title = site;

  // When the focus that runs ends (a count-up one, never), or 0 when none runs; as worker.js reads it.
  const ends = (timer, now) => (!timer?.running || timer.phase !== "focus" ? 0 : timer.mode === "countup" ? Infinity : timer.endsAt > now ? timer.endsAt : 0);
  const said = document.getElementById("shut-said");
  let wait = null;
  const show = (timer) => {
    clearTimeout(wait);
    const end = ends(timer, Date.now());
    if (!end) { if (target) location.replace(target.href); return; }
    const time = end === Infinity ? "" : new Date(end).toLocaleTimeString(window.I18N?.currentLang || "en", { hour: "2-digit", minute: "2-digit" });
    said.textContent = time ? say("shut.until", "{site} opens at {time}, when this focus ends.", { site, time }) : say("shut.open", "{site} opens when this focus ends.", { site });
    if (time) wait = setTimeout(() => show(timer), end - Date.now() + 50);
  };
  chrome.storage.local.get(KEY, (items) => show(items?.[KEY]));
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes[KEY]) show(changes[KEY].newValue); });
})();
