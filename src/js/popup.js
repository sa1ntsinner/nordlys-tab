/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE TOOLBAR BUTTON: THIS PAGE, INTO A FOLDER
   ═══════════════════════════════════════════════════════════════════

   The page in view, named and put into a folder of the board in use. It
   never writes the board itself: what it saves waits in nordlys_inbox until
   a new tab takes it (app.js, takeInbox), so a board open in another tab is
   never written over. The browser shows this popup the page's address and
   title only because its button was pressed (activeTab). */
(async function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const say = (key, fallback, params) => {
    const value = window.I18N?.t(key, params || {});
    return value && value !== key ? value : fallback;
  };
  const read = (key) => { try { return localStorage.getItem(key); } catch (error) { return null; } };
  const local = (method, value) => new Promise((resolve) => chrome.storage.local[method](value, (out) => resolve(out || {})));

  await window.I18N?.setLanguage(read("nordlys_language") || "en");
  const form = $("save-form"), name = $("save-name"), folder = $("save-folder"), said = $("save-said");
  const [tab] = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs || [])));
  let url = null;
  try { url = new URL(tab?.url); } catch (error) { /* said below */ }
  if (!url || !/^https?:$/.test(url.protocol)) {
    form.hidden = true;
    said.textContent = say("save.cannot", "Only a web page can go on the board.");
    return;
  }
  $("save-host").textContent = url.hostname.replace(/^www\./, "");
  if (tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)) Object.assign($("save-icon"), { src: tab.favIconUrl, hidden: false });
  name.value = (tab.title || url.hostname).slice(0, 120);

  /* The folders of the board in use, as the page last saved it; never one
     that follows the browser's bookmarks. The newer of the two stores: a
     board too big for the fast one is saved to the browser's alone, and the
     fast one then still shows a bookmark deleted since. */
  let config = null;
  try { config = JSON.parse(read("nordlys_config")); } catch (error) { /* the browser's copy, then */ }
  let held = {};
  try { held = await local("get", ["nordlys_config", "nordlys_config_saved_at"]); } catch (error) { /* the fast copy, then */ }
  if (held.nordlys_config?.groups && (!config || Number(held.nordlys_config_saved_at) > (Number(read("nordlys_config_saved_at")) || 0))) config = held.nordlys_config;
  config ||= {};
  const folders = (config.groups || []).map((group, index) => ({ group, index })).filter(({ group }) => !group.source);
  for (const { group, index } of folders) folder.append(new Option(group.label || say("bookmarks.newFolder", "New folder"), String(index)));
  const last = folders.find(({ group }) => group.id && group.id === read("nordlys_save_folder"));
  if (last) folder.value = String(last.index);
  if (!folders.length) folder.append(new Option(say("save.newFolder", "A new folder, Saved"), ""));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const group = folder.value === "" ? null : config.groups?.[Number(folder.value)];
    const label = group?.label || say("save.savedFolder", "Saved");
    if (group?.links?.some((link) => link.url === url.href)) {
      said.textContent = say("save.already", "Already in {folder}.", { folder: label });
      return;
    }
    $("save-go").disabled = true;
    try {
      await window.NordlysInbox.add({ url: url.href, name: name.value.trim() || url.hostname,
        folder: group ? { id: group.id || "", label: group.label || "", index: Number(folder.value) } : null });
    } catch (error) {
      said.textContent = say("save.failed", "This page could not be saved. Try again.");
      $("save-go").disabled = false;
      return;
    }
    try { if (group?.id) localStorage.setItem("nordlys_save_folder", group.id); } catch (error) { /* only a convenience */ }
    said.textContent = say("save.done", "Saved to {folder}.", { folder: label });
    said.classList.add("done");
    setTimeout(() => window.close(), 900);
  });
  name.select();
})();
