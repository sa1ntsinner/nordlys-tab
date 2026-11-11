/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SYNC WITH A CODE
   ═══════════════════════════════════════════════════════════════════

   Some browsers carry nothing between devices: Safari keeps storage.sync on
   the device, and a Chromium without an account has nowhere to send it. For
   them, and for two different browsers, the same sync items (sync-model.js)
   travel through a small relay instead (relay/ in this repository).

   The code is the only secret, and it never leaves the device. Three things
   are derived from it: the room the relay files the items under, a name for
   each device in that room, and the key the items are locked with before they
   are sent. The relay holds what it cannot read.

   To the engine this is one more storage area: get(null), set, remove. */
(function (root) {
  "use strict";

  const URL = "https://nordlys-sync.imslide.workers.dev";
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const LENGTH = 20;
  const TIMEOUT = 8000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const toBase64 = (bytes) => { let text = ""; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); };
  const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

  // 100 bits, in letters and digits that are not mistaken for one another.
  function newCode() {
    const bytes = root.crypto.getRandomValues(new Uint8Array(LENGTH));
    return [...bytes].map((byte) => ALPHABET[byte % 32]).join("");
  }

  /* What a person typed, as the code it stands for: any case, with or
     without the dashes, and the letters people read as digits. Null when it
     cannot be a code. */
  function readCode(text) {
    const code = String(text || "").toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
    return code.length === LENGTH && [...code].every((char) => ALPHABET.includes(char)) ? code : null;
  }

  const showCode = (code) => String(code || "").replace(/(.{5})(?=.)/g, "$1-");

  async function derive(code) {
    const subtle = root.crypto.subtle;
    const material = await subtle.importKey("raw", encoder.encode(code), "HKDF", false, ["deriveBits", "deriveKey"]);
    const params = (info) => ({ name: "HKDF", hash: "SHA-256", salt: encoder.encode("nordlys-relay-1"), info: encoder.encode(info) });
    return {
      room: hex(await subtle.deriveBits(params("room"), material, 128)),
      key: await subtle.deriveKey(params("key"), material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
      names: await subtle.deriveKey(params("names"), material, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"])
    };
  }

  // nl.sync.2.<device>.<index>: the device an item belongs to.
  const deviceOf = (key) => key.split(".").slice(-2, -1)[0] || "";

  class NordlysRelay {
    constructor({ code, url = URL, fetchImpl } = {}) {
      this.code = code;
      this.url = url;
      this.fetch = fetchImpl || ((...args) => root.fetch(...args));
      this.devices = {};
      this.etag = null;
    }

    secrets() { return (this.derived ||= derive(this.code)); }

    async tag(device) {
      const { names } = await this.secrets();
      return hex(await root.crypto.subtle.sign("HMAC", names, encoder.encode(device))).slice(0, 32);
    }

    async lock(device, items) {
      const { key, room } = await this.secrets();
      const iv = root.crypto.getRandomValues(new Uint8Array(12));
      const text = encoder.encode(JSON.stringify({ v: 1, d: device, e: items }));
      const sealed = new Uint8Array(await root.crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(room) }, key, text));
      const out = new Uint8Array(iv.length + sealed.length);
      out.set(iv);
      out.set(sealed, iv.length);
      return toBase64(out);
    }

    // Null for anything this code does not open: it is not ours to read.
    async open(blob) {
      try {
        const { key, room } = await this.secrets();
        const bytes = fromBase64(blob);
        const text = await root.crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: encoder.encode(room) }, key, bytes.slice(12));
        const value = JSON.parse(decoder.decode(text));
        return value && value.v === 1 && typeof value.d === "string" && value.e && typeof value.e === "object" ? value : null;
      } catch (error) { return null; }
    }

    async ask(path, options = {}) {
      const { room } = await this.secrets();
      const answer = await this.fetch(`${this.url}/v1/r/${room}${path}`, {
        ...options, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
        signal: root.AbortSignal?.timeout ? root.AbortSignal.timeout(TIMEOUT) : undefined
      });
      if (!answer.ok && answer.status !== 304) throw new Error(`The sync relay answered ${answer.status}.`);
      return answer;
    }

    async get() {
      const answer = await this.ask("", this.etag ? { headers: { "If-None-Match": this.etag } } : {});
      if (answer.status !== 304) {
        const body = await answer.json();
        const devices = {};
        for (const blob of Object.values(body?.items || {})) {
          const value = await this.open(blob);
          if (value) devices[value.d] = value.e;
        }
        this.devices = devices;
        this.etag = answer.headers.get("ETag");
      }
      return JSON.parse(JSON.stringify(Object.assign({}, ...Object.values(this.devices))));
    }

    // Each device's items travel as one sealed piece, so a change sends its device's whole.
    async write(changed) {
      // Whatever happens next, what is remembered here is no longer what the relay has.
      this.etag = null;
      for (const device of changed) {
        const items = this.devices[device] || {};
        const path = `/${await this.tag(device)}`;
        if (Object.keys(items).length) await this.ask(path, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: await this.lock(device, items) });
        else { await this.ask(path, { method: "DELETE" }); delete this.devices[device]; }
      }
    }

    async set(items) {
      const changed = new Set();
      for (const [key, value] of Object.entries(items)) {
        const device = deviceOf(key);
        (this.devices[device] ||= {})[key] = JSON.parse(JSON.stringify(value));
        changed.add(device);
      }
      await this.write(changed);
    }

    async remove(keys) {
      const changed = new Set();
      for (const key of [].concat(keys)) {
        const device = deviceOf(key);
        if (this.devices[device] && key in this.devices[device]) { delete this.devices[device][key]; changed.add(device); }
      }
      await this.write(changed);
    }
  }

  const api = { URL, NordlysRelay, newCode, readCode, showCode, create: (code, options) => new NordlysRelay({ code, ...options }) };
  root.NordlysSyncRelay = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
