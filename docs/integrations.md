# Connected apps

The dashboard can show tasks and events from the apps you already use, in the
**From your apps** and **Calendar** cards. Connect them in Settings → Dashboard →
Connected apps.

How it works:

- Each app is read straight from its own API, from your browser. Nordlys has no
  server in between.
- Your token is kept only on this device. It's in `chrome.storage.local`, not in
  sync and not in backups.
- The browser asks you to allow access to that one app's address the first
  time you connect it.
- Ticking a Todoist task in the card marks it done in Todoist. GitHub issues and
  reviews open in GitHub.
- While a card is on the dashboard it refreshes itself: From your apps when its
  list is more than 5 minutes old and every 10 minutes, Calendar when its events
  are more than 10 minutes old and every 15 minutes. Errors are shown in your
  language.

| App | What you paste | Where to get it |
|---|---|---|
| Todoist | API token | Settings → Integrations → Developer |
| GitHub | Fine-grained personal access token with read access to issues and pull requests | github.com/settings/personal-access-tokens |
| Any calendar | Its secret iCal (ICS) address | Google Calendar: Settings → your calendar → Secret address in iCal format. Outlook: Settings → Calendar → Shared calendars → Publish. iCloud: share the calendar publicly. |

## Calendar links

The ICS reader (`events` in `src/js/connectors.js`) shows the next two weeks.
It follows the parts of RFC 5545 that calendars send:

- times in their own zone (`TZID`), read with the browser's time-zone data, and
  floating times in yours;
- `DAILY`, `WEEKLY`, `MONTHLY` and `YEARLY` repeats with `INTERVAL`, `COUNT`,
  `UNTIL`, `BYDAY` (also `2MO`, `-1FR`), `BYMONTHDAY` and `BYMONTH`, unrolled on
  the wall clock of the event's zone, so a weekly 9:00 stays at 9:00 across a
  change of clocks;
- `EXDATE` for a meeting called off, and `RECURRENCE-ID` for one that was moved;
- `DURATION` when there is no `DTEND`.

A `TZID` the browser doesn't know (some Outlook exports use Windows zone names)
is read as your own time.

## What was cut in 2.5.2, and why

GitLab, Trello, Asana, ClickUp, Linear, Jira and Notion were connectors in
2.5.1; Google Tasks, Google Calendar and Microsoft To Do were listed as "Soon"
and never worked (they needed a registered OAuth app, and asked for the
`identity` permission meanwhile). Each was one more third-party API to keep up
with, for few people, and together they made the extension's purpose and its
permissions hard to explain to a store reviewer. Tokens stored for them are
deleted on the first new tab of 2.5.2.
