# Sync and profiles

Status: built 2026-09-25 (profiles, sync, device-only items and overrides), not released yet. Two-browser manual check pending before 2.6.0.

## What it is for

Your setup should follow you to every Chrome you're signed in to, with no
account of ours, no database and no server. On top of that:

- any bookmark, folder or setting can be kept on one device only, or can look
  different on one device while staying shared everywhere else;
- one Google account can hold several profiles (for example Work, Home and
  Study), each a whole setup, switched from the new tab itself.

Sync is off until you turn it on.

## What Chrome gives us, and its limits

Chrome syncs `chrome.storage.sync` between browsers signed in to the same
account, as long as the person has extension sync turned on. The `storage`
permission already covers it, so no new permission is needed.

The limits shape everything below:

- about 100 KB in total, 8 KB per item, 512 items;
- about 120 writes a minute and 1,800 an hour;
- nothing large fits: uploaded or cropped icon images, wallpapers, video
  loops and custom CSS stay on the device they were added on.

## Starting point

The sync work from 2026-09-10 (`74c2831`, on the local `main` only, 19 commits
behind `origin/main`) is the base. It gets ported onto the current `main`
rather than merged, since the board code has moved on. What it already has:

- every folder and bookmark has a stable id, and the board is stored as
  records (`c` for settings, `g/<id>` for folders, `l/<id>` for bookmarks);
- every field is a register holding the value, a logical counter and the id
  of the device that wrote it, so edits merge per field;
- deletion is a field (`_alive: false`), so an offline rename can't bring a
  deleted bookmark back;
- each installation writes only its own sync keys (`nl.sync.1.<device>...`),
  so two devices writing at once never overwrite each other's items;
- one queue for every tab, and a local backup before sync is turned on;
- a bookmark can open a different address on one machine.

## Data model

### Synced

The existing record model, extended with profiles:

- `p/<id>`: a profile, with `name`, `color` (one of the theme accents),
  `_order` and `_alive`;
- every folder gets a `_profile` field naming the profile it belongs to;
  bookmarks follow their folder;
- settings split in two. The look and the layout (theme, background, mood,
  fonts, tile size, spacing, board width, Fitted, One page fit) move to
  `c/<profileId>`, so each profile has its own. Things about the person
  rather than the board (language, time format, the name in the greeting,
  whether links open in a new tab) stay in the shared `c` record.

Moving a folder to another profile is one field change. Deleting a profile
marks it and its folders `_alive: false`; it can be restored for 30 days,
after which its tombstones are compacted.

The first time sync starts on an existing board, the board becomes the first
profile (named after the greeting name, or "Main").

### Local to this device (`chrome.storage.local`, never synced)

- `deviceId` and a readable `deviceName` ("Windows · Chrome", editable);
- the active profile on this device, and whether this device opens on the
  last profile used or always on a chosen one;
- local-only items: bookmarks, folders and settings marked "Only on this
  device". They are kept here in full and never flattened into sync records;
- overrides: `{ recordId: { field: value } }` laid over synced records, for
  example a different address, icon or name for one bookmark, or a different
  theme for the whole look. This generalises the old per-machine address.

### What the page sees

The board the page renders is built from:

1. the synced model, filtered to the active profile;
2. plus the local-only items of that profile;
3. with this device's overrides applied on top.

The rest of the product keeps reading one config as it does today. Edits go
back through a diff: a change to an overridden field updates the override, a
change to a local-only item stays local, everything else becomes synced
changes.

### What doesn't travel

Uploaded and cropped icon images (`data:` and `blob:` URLs), wallpapers and
video loops, custom CSS, folders linked to Chrome bookmark folders (their
folder ids mean nothing in another profile), recent searches and One page fit
sizes. On other devices an image icon falls back to the site's favicon or its
letter. Settings lists what stayed behind on this device.

## Interface

### Profile switcher on the new tab

- Hidden while there is one profile. With two or more, the greeting line
  reads "Good afternoon · ● Work ▾".
- Clicking it opens a glass menu like the others: each profile with its
  colour dot and a check on the active one, then "New profile" and
  "Manage…".
- Switching fades the board out and back in with the new profile (about
  200 ms) and changes the sky with it. With reduced motion it is instant.
- It works from the keyboard, from the command line (`> profile home`), and
  one Undo switches back.

### "This device" on bookmarks and folders

In the context menu and quick edit of a bookmark or folder:

- **Only on this device**: the item never goes to sync;
- **Different here**: a local address, icon or name, with "Use the shared
  one" to drop it.

Such tiles get a small device mark, shown only in Arrange mode and on hover
so the board stays quiet. The Appearance section has the same "Only on this
device" switch for the look, for a light theme on a laptop and dark
everywhere else.

### Settings: Sync and profiles

- **Sync**: the switch, the status ("Synced 2 min ago", "Waiting for Chrome
  sync", an error in plain words), a meter ("34 of 100 KB") and the list of
  what doesn't travel.
- **Profiles**: rename, colour, reorder, new (empty or a copy of the current
  one), delete with Undo, and how much space each one takes.
- **This device**: its name, which profile it opens on, and the list of
  local-only items and overrides, each with a reset.
- **Devices**: the devices sync has seen, with "Forget" for old ones.

### Turning sync on

A backup is saved first, as in the old branch. If sync already holds data
from another device:

- **Use what's in sync**: this device takes the synced setup;
- **Merge**: both merge per field, nothing is dropped;
- **Replace sync with this device**: the synced setup is replaced.

## Reliability

- Writes are batched and sent at most every few seconds, well inside
  Chrome's rate limits.
- Each device's data is split into items under 8 KB.
- Close to 100 KB, sending stops with a message saying what to do (delete an
  old profile, or use smaller icons). Local edits are always kept, and sync
  never receives a cut-down board.
- A failed cloud write never rolls back a local edit.
- Damaged or unknown data in sync is validated and skipped, never applied.
- Backups are kept before turning sync on and before any replace; the last
  three are kept.
- Every tab goes through one queue, so a stale tab can't publish an old copy.

## Privacy

No new permission. With sync on, settings travel through the person's own
Chrome sync, which Google encrypts. PRIVACY.md and the store listing get a
section saying so, and saying that sync is off by default.

## Tests

- Unit, on the model: two and three devices merging in every order end in
  the same board; profiles (create, move a folder, delete, restore);
  local-only items and overrides; splitting into 8 KB items and the 100 KB
  stop; damaged sync data.
- UI: the switcher (pointer, keyboard, `> profile`), the "This device"
  menu, the settings section, and the three ways to turn sync on.
- Two tabs of the real extension on real `chrome.storage.sync`.
- The existing suite keeps passing.

## Order of work

1. Port the 2026-09-10 sync model and store onto the current `main`, with
   its tests.
2. Profiles in the model.
3. Local-only items and overrides.
4. The profile switcher on the new tab.
5. The settings section and the first-run choice.
6. Texts: PRIVACY.md, the store listing, the README.

## Not in this round

Switching profiles automatically by time or network, and syncing images
through chunked storage. Both can come later if people ask.
