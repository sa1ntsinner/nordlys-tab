# Connected apps

The dashboard can show tasks and events from the apps you already use, in the
**From your apps** and **Calendar** cards. Connect them in Settings → Dashboard →
Connected apps.

How it works:

- Each app is read straight from its own API, from your browser. Nordlys has no
  server in between.
- Your token is kept only on this device. It's in `chrome.storage.local`, not in
  sync and not in backups.
- Chrome asks you to allow access to that one app's address the first time you
  connect it.
- Ticking a task in the card marks it done in the app, where the app allows it
  (Todoist, Trello, Asana, Google Tasks, Microsoft To Do). Other tasks open in
  their app.

## With a personal token

| App | What you paste | Where to get it |
|---|---|---|
| Todoist | API token | Settings → Integrations → Developer |
| GitHub | Fine-grained personal access token with read access to issues and pull requests | github.com/settings/personal-access-tokens |
| GitLab | Personal access token (`read_api`), and your server if it isn't gitlab.com | User settings → Access tokens |
| Trello | API key and token | trello.com/power-ups/admin → your Power-Up → API key → Token |
| Asana | Personal access token (the workspace is optional) | app.asana.com/0/my-apps |
| ClickUp | Personal API token | Settings → Apps |
| Linear | Personal API key | Settings → Account → Security & access |
| Jira | Your site, your email and an API token | id.atlassian.com → Security → API tokens |
| Notion | An internal integration secret and the link to your task database. Share the database with the integration. | notion.so/profile/integrations |
| Any calendar | Its secret iCal (ICS) address | Google Calendar: Settings → your calendar → Secret address in iCal format. Outlook: Settings → Calendar → Shared calendars → Publish. iCloud: share the calendar publicly. |

A Notion database can have any shape:

- the title property is the task;
- the first date property is its due date;
- a checkbox, or a status called Done, marks it finished.

## With a sign-in (needs a registered app)

Google Tasks, Google Calendar and Microsoft To Do have no personal tokens. You sign
in with a window from Google or Microsoft. Nordlys uses an authorization code flow
with PKCE, so the extension holds no secret.

Each service needs an app registered once by the developer, with its client id in
`src/js/oauth-clients.js`. Until then, those three say "comes in the next update".

### Google (Tasks and Calendar)

1. In Google Cloud Console, create a project. Then enable the **Google Tasks API**
   and the **Google Calendar API**.
2. Configure the OAuth consent screen:
   - user type: External;
   - scopes: `.../auth/tasks` and `.../auth/calendar.events.readonly`;
   - add a privacy policy link.
3. Create an OAuth client ID of type **Web application**. As the authorised
   redirect URI, add `https://<extension-id>.chromiumapp.org/oauth`. The extension
   id is on `chrome://extensions`; it's the same for everyone once the extension
   is published.
4. Put the client id in `oauth-clients.js` under `google`. Google requires a secret
   for web clients even with PKCE; if it does for yours, put it under
   `clientSecret`. It is not a real secret in an extension, and Google documents
   that.
5. Sensitive scopes need Google's verification before the app goes past 100 users.

### Microsoft (To Do)

1. In the Azure portal, open Microsoft Entra ID → App registrations → New
   registration.
2. Supported accounts: any organisational directory and personal Microsoft
   accounts.
3. Redirect URI, platform **Single-page application**:
   `https://<extension-id>.chromiumapp.org/oauth`.
4. API permissions: Microsoft Graph → delegated → `Tasks.ReadWrite` and
   `offline_access`.
5. Put the Application (client) ID in `oauth-clients.js` under `microsoft`.

## Adding another app

A connector in `src/js/connectors.js` names:

- its fields and where to find them;
- the addresses it needs to reach;
- how to ask for the person's tasks;
- how to read the answer into `{ id, title, url, due, done, source, context, priority }`.

Tests for the reading go in `tests/unit/connectors.test.cjs`, with a real answer
from the app.
