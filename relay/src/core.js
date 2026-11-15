/* The relay for "Sync with a code" (src/js/sync-relay.js).

   It files sealed pieces under a room and hands them back. It cannot read
   them: the key never leaves the devices. It knows a room's name, how many
   devices write to it, how large their pieces are and when they changed.
   Nothing else is kept, and nothing is logged.

     GET    /v1/r/<room>            every device's piece, with an ETag
     PUT    /v1/r/<room>/<device>   this device's piece
     DELETE /v1/r/<room>/<device>

   The store is passed in, so the rules here are tested without Cloudflare. */

export const LIMITS = {
  piece: 200000,      // characters of base64 in one device's piece
  devices: 12,        // devices in a room
  idleDays: 400       // a piece nobody rewrote in this long is dropped
};

const NAME = /^[0-9a-f]{32}$/;
const PIECE = /^[A-Za-z0-9+/]+={0,2}$/;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
  "Access-Control-Expose-Headers": "ETag",
  "Access-Control-Max-Age": "86400"
};

const answer = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), {
  status,
  headers: { ...CORS, "Cache-Control": "no-store", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers }
});

async function etagOf(rows) {
  const text = rows.map((row) => `${row.device}:${row.updated}`).sort().join(",");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `"${[...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("")}"`;
}

/* The body, unless it is larger than a piece can be: refused by what it says
   it is before anything is read, and read no further than the limit when it
   says nothing. A piece is base64, so its bytes are its characters. */
async function readPiece(request) {
  const said = request.headers.get("Content-Length");
  if (said !== null && !(Number(said) <= LIMITS.piece)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMITS.piece) { await reader.cancel(); return null; }
    parts.push(value);
  }
  return new Blob(parts).text();
}

/* allow(key) answers whether this address may write now (the rate limit
   binding on Cloudflare); without one, every write is allowed. */
export async function handle(request, store, now = Date.now(), allow = null) {
  if (request.method === "OPTIONS") return answer(204);
  const match = /^\/v1\/r\/([^/]+)(?:\/([^/]+))?$/.exec(new URL(request.url).pathname);
  if (!match) return answer(404, { error: "not found" });
  const [, room, device] = match;
  if (!NAME.test(room) || (device !== undefined && !NAME.test(device))) return answer(400, { error: "bad name" });

  if (request.method === "GET" && device === undefined) {
    const rows = await store.list(room);
    const etag = await etagOf(rows);
    if (request.headers.get("If-None-Match") === etag) return answer(304, undefined, { ETag: etag });
    return answer(200, { v: 1, items: Object.fromEntries(rows.map((row) => [row.device, row.piece])) }, { ETag: etag });
  }

  if (request.method === "PUT" && device !== undefined) {
    if (allow && !(await allow(request.headers.get("CF-Connecting-IP") || ""))) return answer(429, { error: "later" }, { "Retry-After": "60" });
    const piece = await readPiece(request);
    if (!piece || piece.length > LIMITS.piece || !PIECE.test(piece)) return answer(413, { error: "bad piece" });
    const rows = await store.list(room);
    if (!rows.some((row) => row.device === device) && rows.length >= LIMITS.devices) return answer(409, { error: "room full" });
    await store.put(room, device, piece, now);
    return answer(204);
  }

  if (request.method === "DELETE" && device !== undefined) {
    await store.remove(room, device);
    return answer(204);
  }

  return answer(405, { error: "not allowed" });
}

export const prune = (store, now = Date.now()) => store.prune(now - LIMITS.idleDays * 86400000);

// The same store in memory, for the tests and for nothing else.
export function memoryStore() {
  const rows = new Map();
  const id = (room, device) => `${room}/${device}`;
  return {
    rows,
    list: async (room) => [...rows.values()].filter((row) => row.room === room).map((row) => ({ ...row })),
    put: async (room, device, piece, updated) => {
      const before = rows.get(id(room, device));
      // Two writes in one millisecond are still two versions.
      rows.set(id(room, device), { room, device, piece, updated: before && before.updated >= updated ? before.updated + 1 : updated });
    },
    remove: async (room, device) => { rows.delete(id(room, device)); },
    prune: async (before) => { for (const [key, row] of rows) if (row.updated < before) rows.delete(key); }
  };
}
