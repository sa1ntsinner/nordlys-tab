/* The relay on Cloudflare Workers, with its pieces in D1 (schema.sql). */
import { handle, prune } from "./core.js";

const d1 = (db) => ({
  list: async (room) => (await db.prepare("SELECT device, piece, updated FROM pieces WHERE room = ?1").bind(room).all()).results,
  put: (room, device, piece, updated) => db.prepare(
    `INSERT INTO pieces (room, device, piece, updated) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (room, device) DO UPDATE SET piece = ?3, updated = MAX(?4, pieces.updated + 1)`
  ).bind(room, device, piece, updated).run(),
  remove: (room, device) => db.prepare("DELETE FROM pieces WHERE room = ?1 AND device = ?2").bind(room, device).run(),
  prune: (before) => db.prepare("DELETE FROM pieces WHERE updated < ?1").bind(before).run()
});

export default {
  async fetch(request, env) {
    try {
      return await handle(request, d1(env.DB));
    } catch (error) {
      return new Response(JSON.stringify({ error: "relay failed" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  },
  async scheduled(event, env, context) {
    context.waitUntil(prune(d1(env.DB)));
  }
};
