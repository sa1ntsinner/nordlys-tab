# The Nordlys sync relay

What "Sync with a code" talks to (`src/js/sync-relay.js`). A Cloudflare
Worker with one D1 table. It files sealed pieces under a room and hands them
back; it has no key and cannot read them. `src/core.js` is all of its rules,
and `tests/unit/sync-relay.test.cjs` runs them over a store in memory.

What it keeps, per device in a room: the room's name and the device's name
(both derived from the code on the device), the sealed piece, and when it
last changed. A piece nobody rewrote in 400 days is deleted by the nightly
cron. Logging is off (`observability.enabled: false`).

Limits: 12 devices in a room, 200,000 characters in a piece (a larger body
is refused by its `Content-Length` before it is read, or as soon as it goes
past the limit when it has none), and 240 writes a minute from one address
(`CF-Connecting-IP`), through the Workers rate limit binding `WRITES` in
`wrangler.jsonc`. That count is kept per Cloudflare location and is
approximate; a device's first sync sends its piece and up to ~100 icon
pictures in a burst, which stays well under it. Past it the relay answers 429
with `Retry-After`, and the extension tries again later. The binding's
`namespace_id` must be unique in the Cloudflare account.

## Run it here

```sh
cd relay
npm install
npx wrangler d1 execute nordlys-sync --local --file=schema.sql
npx wrangler dev
```

## Deploy

Once:

```sh
npx wrangler login
npx wrangler d1 create nordlys-sync      # put the database_id it prints into wrangler.jsonc
npm run schema
```

Then, and after every change:

```sh
npm run deploy
```

The address it prints must be the `URL` at the top of `src/js/sync-relay.js`,
and the one named in `PRIVACY.md` and `docs/store-listing.md`. An extension
already installed keeps asking the address it was built with, so the address
does not change once a release carries it.
