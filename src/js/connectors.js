/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE SERVICES A DASHBOARD CAN READ FROM
   ═══════════════════════════════════════════════════════════════════

   Tasks and events from the apps people already use, read straight from
   each app's own API with the person's own token. Nordlys has no server in
   between: a request goes from this browser to that service and nowhere
   else, and the token stays on this device (chrome.storage.local, never
   synced, never in a backup).

   Every connector turns its service's answer into the same shape:
     { id, title, url, due, done, source, context, priority }
   where due is "YYYY-MM-DD" or null. The request builders and the
   normalisers are pure and tested; list() does the fetching.

   Connectors that need a registered OAuth app (Google, Microsoft) read
   their client id from NordlysOAuthClients (oauth-clients.js), and say they
   are not ready while it is empty.                                     */
(function (root) {
  "use strict";

  const day = (value) => {
    if (!value) return null;
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const clip = (text, max = 300) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const safeUrl = (url) => (/^https?:\/\//i.test(String(url || "")) ? String(url) : null);
  const item = (source, fields) => ({ id: `${source}:${fields.id}`, title: clip(fields.title) || "(untitled)", url: safeUrl(fields.url), due: day(fields.due), done: Boolean(fields.done), source, context: clip(fields.context || "", 80), priority: Boolean(fields.priority), native: String(fields.id) });

  /* Each connector: what it is called, which fields a person fills in (and
     where to find them), the addresses it needs leave to reach, how its
     requests are made, and how its answers read. */
  const CONNECTORS = {
    todoist: {
      name: "Todoist", color: "#e44332", kind: "tasks",
      fields: [{ key: "token", label: "API token", secret: true, help: "https://app.todoist.com/app/settings/integrations/developer" }],
      origins: ["https://api.todoist.com/*"],
      requests: (c) => [{ url: "https://api.todoist.com/api/v1/tasks?limit=200", headers: { Authorization: `Bearer ${c.token}` } }],
      read: ([answer]) => (answer?.results || answer || []).map((t) => item("todoist", { id: t.id, title: t.content, url: t.url || `https://app.todoist.com/app/task/${t.id}`, due: t.due?.date, priority: t.priority === 4, context: t.project_name || "" })),
      complete: (c, it) => ({ url: `https://api.todoist.com/api/v1/tasks/${encodeURIComponent(it.native)}/close`, method: "POST", headers: { Authorization: `Bearer ${c.token}` } })
    },
    github: {
      name: "GitHub", color: "#24292f", kind: "tasks",
      fields: [{ key: "token", label: "Personal access token", secret: true, help: "https://github.com/settings/personal-access-tokens/new" }],
      origins: ["https://api.github.com/*"],
      requests: (c) => {
        const headers = { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json" };
        return [
          { url: "https://api.github.com/issues?filter=assigned&state=open&per_page=50", headers },
          { url: "https://api.github.com/search/issues?q=is%3Aopen+is%3Apr+review-requested%3A%40me&per_page=30", headers }
        ];
      },
      read: ([assigned, reviews]) => {
        const seen = new Set();
        const out = [];
        for (const issue of [...(assigned || []), ...((reviews && reviews.items) || [])]) {
          if (seen.has(issue.id)) continue;
          seen.add(issue.id);
          const repo = (issue.repository?.full_name) || String(issue.repository_url || "").split("/repos/")[1] || "";
          out.push(item("github", { id: issue.id, title: `${issue.pull_request ? "Review: " : ""}${issue.title}`, url: issue.html_url, due: issue.milestone?.due_on, context: repo }));
        }
        return out;
      }
    },
    gitlab: {
      name: "GitLab", color: "#fc6d26", kind: "tasks",
      fields: [{ key: "token", label: "Personal access token", secret: true, help: "https://gitlab.com/-/user_settings/personal_access_tokens" }, { key: "host", label: "Server", placeholder: "https://gitlab.com" }],
      origins: (c) => [`${(c.host || "https://gitlab.com").replace(/\/+$/, "")}/*`],
      requests: (c) => {
        const base = (c.host || "https://gitlab.com").replace(/\/+$/, "");
        const headers = { "PRIVATE-TOKEN": c.token };
        return [{ url: `${base}/api/v4/issues?scope=assigned_to_me&state=opened&per_page=50`, headers }, { url: `${base}/api/v4/merge_requests?scope=assigned_to_me&state=opened&per_page=30`, headers }];
      },
      read: ([issues, merges]) => [
        ...(issues || []).map((i) => item("gitlab", { id: `i${i.id}`, title: i.title, url: i.web_url, due: i.due_date, context: i.references?.full?.split("#")[0] || "" })),
        ...(merges || []).map((m) => item("gitlab", { id: `m${m.id}`, title: `Merge: ${m.title}`, url: m.web_url, context: m.references?.full?.split("!")[0] || "" }))
      ]
    },
    trello: {
      name: "Trello", color: "#0c66e4", kind: "tasks",
      fields: [{ key: "key", label: "API key", help: "https://trello.com/power-ups/admin" }, { key: "token", label: "Token", secret: true, help: "https://trello.com/power-ups/admin" }],
      origins: ["https://api.trello.com/*"],
      requests: (c) => [{ url: `https://api.trello.com/1/members/me/cards?filter=open&fields=name,due,dueComplete,shortUrl,idBoard&board=true&board_fields=name&key=${encodeURIComponent(c.key)}&token=${encodeURIComponent(c.token)}` }],
      read: ([cards]) => (cards || []).filter((card) => !card.dueComplete).map((card) => item("trello", { id: card.id, title: card.name, url: card.shortUrl, due: card.due, context: card.board?.name || "" })),
      complete: (c, it) => ({ url: `https://api.trello.com/1/cards/${encodeURIComponent(it.native)}?dueComplete=true&key=${encodeURIComponent(c.key)}&token=${encodeURIComponent(c.token)}`, method: "PUT" })
    },
    asana: {
      name: "Asana", color: "#f06a6a", kind: "tasks",
      fields: [{ key: "token", label: "Personal access token", secret: true, help: "https://app.asana.com/0/my-apps" }, { key: "workspace", label: "Workspace ID (optional)" }],
      origins: ["https://app.asana.com/*"],
      /* Asana needs a workspace for "my tasks"; without one the first of the
         person's workspaces is used, found on the first step. */
      steps: async (c, get) => {
        let workspace = c.workspace;
        if (!workspace) workspace = (await get({ url: "https://app.asana.com/api/1.0/users/me?opt_fields=workspaces.gid", headers: { Authorization: `Bearer ${c.token}` } }))?.data?.workspaces?.[0]?.gid;
        if (!workspace) return [[]];
        return [await get({ url: `https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${encodeURIComponent(workspace)}&completed_since=now&limit=100&opt_fields=name,due_on,permalink_url,completed,projects.name`, headers: { Authorization: `Bearer ${c.token}` } })];
      },
      read: ([answer]) => (answer?.data || []).filter((t) => !t.completed).map((t) => item("asana", { id: t.gid, title: t.name, url: t.permalink_url, due: t.due_on, context: t.projects?.[0]?.name || "" })),
      complete: (c, it) => ({ url: `https://app.asana.com/api/1.0/tasks/${encodeURIComponent(it.native)}`, method: "PUT", headers: { Authorization: `Bearer ${c.token}`, "content-type": "application/json" }, body: JSON.stringify({ data: { completed: true } }) })
    },
    clickup: {
      name: "ClickUp", color: "#7b68ee", kind: "tasks",
      fields: [{ key: "token", label: "Personal API token", secret: true, help: "https://app.clickup.com/settings/apps" }],
      origins: ["https://api.clickup.com/*"],
      steps: async (c, get) => {
        const headers = { Authorization: c.token };
        const [user, teams] = await Promise.all([get({ url: "https://api.clickup.com/api/v2/user", headers }), get({ url: "https://api.clickup.com/api/v2/team", headers })]);
        const me = user?.user?.id;
        const lists = await Promise.all((teams?.teams || []).slice(0, 3).map((team) => get({ url: `https://api.clickup.com/api/v2/team/${team.id}/task?include_closed=false&subtasks=true${me ? `&assignees[]=${me}` : ""}`, headers })));
        return [lists];
      },
      read: ([lists]) => (lists || []).flatMap((answer) => answer?.tasks || []).map((t) => item("clickup", { id: t.id, title: t.name, url: t.url, due: t.due_date ? Number(t.due_date) : null, priority: t.priority?.priority === "urgent", context: t.list?.name || "" })),
      complete: null
    },
    linear: {
      name: "Linear", color: "#5e6ad2", kind: "tasks",
      fields: [{ key: "token", label: "Personal API key", secret: true, help: "https://linear.app/settings/account/security" }],
      origins: ["https://api.linear.app/*"],
      requests: (c) => [{
        url: "https://api.linear.app/graphql", method: "POST", headers: { Authorization: c.token, "content-type": "application/json" },
        body: JSON.stringify({ query: "{ viewer { assignedIssues(first: 60, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) { nodes { id identifier title url dueDate priority team { key } } } } }" })
      }],
      read: ([answer]) => (answer?.data?.viewer?.assignedIssues?.nodes || []).map((n) => item("linear", { id: n.id, title: `${n.identifier} ${n.title}`, url: n.url, due: n.dueDate, priority: n.priority === 1, context: n.team?.key || "" }))
    },
    jira: {
      name: "Jira", color: "#0052cc", kind: "tasks",
      fields: [{ key: "site", label: "Site", placeholder: "your-team.atlassian.net" }, { key: "email", label: "Email" }, { key: "token", label: "API token", secret: true, help: "https://id.atlassian.com/manage-profile/security/api-tokens" }],
      origins: (c) => [`https://${String(c.site || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/*`],
      requests: (c) => {
        const site = String(c.site || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        const auth = btoa(`${c.email}:${c.token}`);
        return [{ url: `https://${site}/rest/api/3/search/jql?jql=${encodeURIComponent("assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC")}&fields=summary,duedate,priority,project&maxResults=60`, headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }, site }];
      },
      read: ([answer], c) => {
        const site = String(c?.site || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        return (answer?.issues || []).map((i) => item("jira", { id: i.id, title: `${i.key} ${i.fields?.summary || ""}`, url: `https://${site}/browse/${i.key}`, due: i.fields?.duedate, priority: /highest|high/i.test(i.fields?.priority?.name || ""), context: i.fields?.project?.name || "" }));
      }
    },
    notion: {
      name: "Notion", color: "#191919", kind: "tasks",
      fields: [{ key: "token", label: "Integration secret", secret: true, help: "https://www.notion.so/profile/integrations" }, { key: "database", label: "Task database link or ID" }],
      origins: ["https://api.notion.com/*"],
      requests: (c) => {
        const id = (String(c.database || "").match(/[0-9a-f]{32}/i) || [String(c.database || "").replace(/-/g, "")])[0];
        return [{ url: `https://api.notion.com/v1/databases/${id}/query`, method: "POST", headers: { Authorization: `Bearer ${c.token}`, "Notion-Version": "2022-06-28", "content-type": "application/json" }, body: JSON.stringify({ page_size: 60 }) }];
      },
      /* A Notion database has no fixed shape: the title is the title
         property, the date is the first date property, and a checkbox or a
         status called done marks it finished. */
      read: ([answer]) => (answer?.results || []).map((page) => {
        const props = Object.values(page.properties || {});
        const title = props.find((p) => p.type === "title")?.title?.map((t) => t.plain_text).join("") || "";
        const date = props.find((p) => p.type === "date")?.date?.start || null;
        const doneBox = props.find((p) => p.type === "checkbox");
        const status = props.find((p) => p.type === "status")?.status?.name || "";
        const done = (doneBox && doneBox.checkbox) || /^(done|complete|completed|готово)$/i.test(status);
        return item("notion", { id: page.id, title, url: page.url, due: date, done });
      }).filter((t) => !t.done)
    },
    ics: {
      name: "Calendar (ICS link)", color: "#34a853", kind: "events",
      fields: [{ key: "url", label: "Calendar address (iCal/ICS)", secret: true, help: "https://support.google.com/calendar/answer/37648" }],
      origins: (c) => { try { const u = new URL(String(c.url || "").replace(/^webcal:/i, "https:")); return [`${u.protocol}//${u.hostname}/*`]; } catch (error) { return []; } },
      requests: (c) => [{ url: String(c.url || "").replace(/^webcal:/i, "https:"), text: true }],
      read: ([text], c, now = Date.now()) => events(String(text || ""), now).map((e) => ({ ...item("ics", { id: e.uid || `${e.start}${e.title}`, title: e.title, url: e.url, due: day(e.start) }), start: e.start, end: e.end, allDay: e.allDay, where: clip(e.location || "", 80) }))
    },
    googletasks: {
      name: "Google Tasks", color: "#1a73e8", kind: "tasks", oauth: "google",
      scopes: ["https://www.googleapis.com/auth/tasks"],
      fields: [], origins: ["https://tasks.googleapis.com/*"],
      steps: async (c, get) => {
        const headers = { Authorization: `Bearer ${c.accessToken}` };
        const lists = await get({ url: "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=20", headers });
        return [await Promise.all((lists?.items || []).slice(0, 8).map(async (list) => ({ list, tasks: await get({ url: `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=false&maxResults=100`, headers }) })))];
      },
      read: ([groups]) => (groups || []).flatMap(({ list, tasks }) => (tasks?.items || []).map((t) => item("googletasks", { id: `${list.id}/${t.id}`, title: t.title, url: t.webViewLink || "https://tasks.google.com/", due: t.due, context: list.title }))),
      complete: (c, it) => { const [list, task] = it.native.split("/"); return { url: `https://tasks.googleapis.com/tasks/v1/lists/${list}/tasks/${task}`, method: "PATCH", headers: { Authorization: `Bearer ${c.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }) }; }
    },
    googlecalendar: {
      name: "Google Calendar", color: "#4285f4", kind: "events", oauth: "google",
      scopes: ["https://www.googleapis.com/auth/calendar.events.readonly"],
      fields: [], origins: ["https://www.googleapis.com/*"],
      requests: (c, now = Date.now()) => [{ url: `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=30&timeMin=${encodeURIComponent(new Date(now - 3600e3).toISOString())}&timeMax=${encodeURIComponent(new Date(now + 14 * 86400e3).toISOString())}`, headers: { Authorization: `Bearer ${c.accessToken}` } }],
      read: ([answer]) => (answer?.items || []).map((e) => ({ ...item("googlecalendar", { id: e.id, title: e.summary, url: e.htmlLink, due: e.start?.date || e.start?.dateTime }), start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, allDay: Boolean(e.start?.date), where: clip(e.location || "", 80) }))
    },
    mstodo: {
      name: "Microsoft To Do", color: "#2564cf", kind: "tasks", oauth: "microsoft",
      scopes: ["Tasks.ReadWrite", "offline_access"],
      fields: [], origins: ["https://graph.microsoft.com/*"],
      steps: async (c, get) => {
        const headers = { Authorization: `Bearer ${c.accessToken}` };
        const lists = await get({ url: "https://graph.microsoft.com/v1.0/me/todo/lists", headers });
        return [await Promise.all((lists?.value || []).slice(0, 8).map(async (list) => ({ list, tasks: await get({ url: `https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks?$filter=status ne 'completed'&$top=100`, headers }) })))];
      },
      read: ([groups]) => (groups || []).flatMap(({ list, tasks }) => (tasks?.value || []).map((t) => item("mstodo", { id: `${list.id}/${t.id}`, title: t.title, url: "https://to-do.office.com/tasks/", due: t.dueDateTime?.dateTime, priority: t.importance === "high", context: list.displayName }))),
      complete: (c, it) => { const [list, task] = it.native.split("/"); return { url: `https://graph.microsoft.com/v1.0/me/todo/lists/${list}/tasks/${task}`, method: "PATCH", headers: { Authorization: `Bearer ${c.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }) }; }
    }
  };

  // ── Calendar files ─────────────────────────────────────────────
  /* The events of an iCalendar file that fall in the next two weeks, with
     weekly and daily repeats unrolled. Enough for "what is next", not a
     full RFC 5545 engine. */
  function unfold(text) { return text.replace(/\r?\n[ \t]/g, ""); }
  function icsDate(value, params = "") {
    if (!value) return null;
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
    if (!m) return null;
    if (!m[4]) return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true, time: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
    const utc = m[7] === "Z";
    const t = utc ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    return { iso: new Date(t).toISOString(), allDay: false, time: t, tzid: /TZID=/i.test(params) };
  }
  function events(text, now = Date.now(), days = 14) {
    const out = [];
    const until = now + days * 86400e3;
    for (const block of unfold(text).split("BEGIN:VEVENT").slice(1)) {
      const body = block.split("END:VEVENT")[0];
      const field = (name) => { const m = new RegExp(`^${name}((?:;[^:\\n]*)?):(.*)$`, "mi").exec(body); return m ? { params: m[1], value: m[2].trim() } : null; };
      const start = field("DTSTART");
      const s = start && icsDate(start.value, start.params);
      if (!s) continue;
      const endField = field("DTEND");
      const e = endField && icsDate(endField.value, endField.params);
      const length = e ? e.time - s.time : 0;
      const title = (field("SUMMARY")?.value || "").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ");
      const base = { uid: field("UID")?.value || "", title, location: (field("LOCATION")?.value || "").replace(/\\,/g, ","), url: field("URL")?.value || null, allDay: s.allDay };
      if (/STATUS:CANCELLED/i.test(body)) continue;
      const rule = field("RRULE")?.value || "";
      const push = (time) => { if (time + length >= now - 3600e3 && time <= until) out.push({ ...base, uid: `${base.uid}@${time}`, start: s.allDay ? new Date(time).toISOString().slice(0, 10) : new Date(time).toISOString(), end: length ? new Date(time + length).toISOString() : null }); };
      const freq = /FREQ=(DAILY|WEEKLY)/i.exec(rule)?.[1]?.toUpperCase();
      if (!freq) { push(s.time); continue; }
      const step = (freq === "DAILY" ? 1 : 7) * 86400e3 * Number(/INTERVAL=(\d+)/i.exec(rule)?.[1] || 1);
      const count = Number(/COUNT=(\d+)/i.exec(rule)?.[1] || 0);
      const endRule = /UNTIL=(\d{8}(?:T\d{6}Z?)?)/i.exec(rule)?.[1];
      const last = endRule ? icsDate(endRule).time : Infinity;
      for (let i = 0, t = s.time; t <= until && t <= last && (!count || i < count); i++, t += step) push(t);
    }
    return out.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 60);
  }

  // ── Fetching ───────────────────────────────────────────────────
  class ConnectorError extends Error { constructor(message, status) { super(message); this.status = status; } }
  async function fetchOne(spec) {
    const response = await fetch(spec.url, { method: spec.method || "GET", headers: spec.headers || {}, body: spec.body });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let said;
      try { const j = JSON.parse(text); said = j.message || j.error?.message || j.errors?.[0]?.message || j.error || ""; } catch (error) { said = text.slice(0, 120); }
      throw new ConnectorError(response.status === 401 || response.status === 403 ? `The token was refused (${response.status}).` : `The service answered ${response.status}${said ? `: ${said}` : ""}.`, response.status);
    }
    if (spec.text) return response.text();
    return response.status === 204 ? null : response.json();
  }
  // Everything one connector has for this person, in the shared shape.
  async function list(id, creds, now = Date.now()) {
    const c = CONNECTORS[id];
    if (!c) throw new ConnectorError(`No connector called ${id}.`);
    const answers = c.steps ? await c.steps(creds, fetchOne) : await Promise.all(c.requests(creds, now).map(fetchOne));
    return c.read(answers, creds, now);
  }
  async function complete(id, creds, it) {
    const c = CONNECTORS[id];
    if (!c?.complete) return false;
    await fetchOne(c.complete(creds, it));
    return true;
  }
  const originsOf = (id, creds) => { const o = CONNECTORS[id]?.origins; return typeof o === "function" ? o(creds || {}) : o || []; };
  const ready = (id, creds) => {
    const c = CONNECTORS[id];
    if (!c) return false;
    if (c.oauth) return Boolean(creds?.accessToken);
    return c.fields.every((f) => f.placeholder === "https://gitlab.com" || f.label.includes("optional") || String(creds?.[f.key] || "").trim());
  };

  // ── OAuth for the services that need a registered app ──────────
  /* Google and Microsoft: an authorization-code flow with PKCE through
     chrome.identity, so no secret is kept in the extension. The client id
     comes from oauth-clients.js; until it is filled in these say so. */
  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  async function signIn(id) {
    const c = CONNECTORS[id];
    const clients = root.NordlysOAuthClients || {};
    const client = clients[c?.oauth];
    if (!client?.clientId) throw new ConnectorError(`${c?.name || id} is not set up in this build yet.`);
    const identity = root.chrome?.identity;
    if (!identity?.launchWebAuthFlow) throw new ConnectorError("This browser can't open a sign-in window for extensions.");
    const redirect = identity.getRedirectURL("oauth");
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
    const endpoints = c.oauth === "google"
      ? { auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token" }
      : { auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token" };
    const url = new URL(endpoints.auth);
    for (const [k, v] of Object.entries({ client_id: client.clientId, response_type: "code", redirect_uri: redirect, scope: c.scopes.join(" "), code_challenge: challenge, code_challenge_method: "S256", state, access_type: "offline", prompt: "consent" })) url.searchParams.set(k, v);
    const back = await new Promise((resolve, reject) => identity.launchWebAuthFlow({ url: url.href, interactive: true }, (result) => (root.chrome.runtime.lastError || !result ? reject(new ConnectorError("Sign-in was closed.")) : resolve(result))));
    const params = new URL(back).searchParams;
    if (params.get("state") !== state || !params.get("code")) throw new ConnectorError("Sign-in didn't finish.");
    const body = new URLSearchParams({ client_id: client.clientId, grant_type: "authorization_code", code: params.get("code"), redirect_uri: redirect, code_verifier: verifier });
    if (client.clientSecret) body.set("client_secret", client.clientSecret);
    const token = await fetchOne({ url: endpoints.token, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString() });
    return { accessToken: token.access_token, refreshToken: token.refresh_token || null, expires: Date.now() + (Number(token.expires_in) || 3600) * 1000 };
  }
  async function refresh(id, creds) {
    const c = CONNECTORS[id];
    const client = (root.NordlysOAuthClients || {})[c?.oauth];
    if (!creds?.refreshToken || !client?.clientId) return creds;
    if (creds.expires && creds.expires - Date.now() > 120e3) return creds;
    const endpoint = c.oauth === "google" ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    const body = new URLSearchParams({ client_id: client.clientId, grant_type: "refresh_token", refresh_token: creds.refreshToken });
    if (client.clientSecret) body.set("client_secret", client.clientSecret);
    const token = await fetchOne({ url: endpoint, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString() });
    return { ...creds, accessToken: token.access_token, refreshToken: token.refresh_token || creds.refreshToken, expires: Date.now() + (Number(token.expires_in) || 3600) * 1000 };
  }

  const api = { CONNECTORS, list, complete, originsOf, ready, events, icsDate, signIn, refresh, ConnectorError, day };
  root.NordlysConnectors = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
