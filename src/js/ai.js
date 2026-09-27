/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - TALKING TO A LANGUAGE MODEL
   ═══════════════════════════════════════════════════════════════════

   The person's own choice of model: the one built into Chrome (on the
   device, no key), a provider with their own key, or a model running on
   their machine. Nordlys has no server in between and no key of its own.

   Pure parts (tested): how each provider is asked, how its stream of
   events is read, what an error means, which address it needs leave to
   reach. The page part is ask(), which does the fetch and streams words
   to a callback as they arrive.                                         */
(function (root) {
  "use strict";

  const PROVIDERS = {
    chrome: { name: "Chrome (on this device)", model: "", key: false },
    openai: { name: "OpenAI", base: "https://api.openai.com/v1", model: "gpt-4.1-mini", key: true, kind: "openai" },
    anthropic: { name: "Anthropic", base: "https://api.anthropic.com/v1", model: "claude-haiku-4-5-20251001", key: true, kind: "anthropic" },
    gemini: { name: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", key: true, kind: "gemini" },
    openrouter: { name: "OpenRouter", base: "https://openrouter.ai/api/v1", model: "openrouter/auto", key: true, kind: "openai" },
    ollama: { name: "Ollama (on this computer)", base: "http://localhost:11434/v1", model: "llama3.2", key: false, kind: "openai" },
    custom: { name: "Another OpenAI-compatible server", base: "", model: "", key: true, kind: "openai" }
  };
  const kindOf = (provider) => PROVIDERS[provider]?.kind || "openai";
  const baseOf = (setup) => String(setup.base || PROVIDERS[setup.provider]?.base || "").replace(/\/+$/, "");

  /* Server-sent events, cut into whole events whatever size the chunks
     of bytes arrive in. */
  function sse() {
    let buffer = "";
    return {
      push(text) {
        buffer += text.replace(/\r\n/g, "\n");
        const events = [];
        let at;
        while ((at = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, at);
          buffer = buffer.slice(at + 2);
          const event = { event: "message", data: "" };
          const data = [];
          for (const line of block.split("\n")) {
            if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
            else if (line.startsWith("event:")) event.event = line.slice(6).trim();
          }
          if (!data.length) continue;
          event.data = data.join("\n");
          events.push(event);
        }
        return events;
      }
    };
  }

  function request(setup, messages, system) {
    const kind = kindOf(setup.provider);
    const model = setup.model || PROVIDERS[setup.provider]?.model || "";
    const base = baseOf(setup);
    if (kind === "anthropic") {
      return {
        url: `${base}/messages`,
        headers: { "content-type": "application/json", "x-api-key": setup.key || "", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: 1024, stream: true, ...(system ? { system } : {}), messages })
      };
    }
    if (kind === "gemini") {
      return {
        url: `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        headers: { "content-type": "application/json", "x-goog-api-key": setup.key || "" },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }))
        })
      };
    }
    const headers = { "content-type": "application/json" };
    if (setup.key) headers.Authorization = `Bearer ${setup.key}`;
    return { url: `${base}/chat/completions`, headers, body: JSON.stringify({ model, stream: true, messages: [...(system ? [{ role: "system", content: system }] : []), ...messages] }) };
  }

  function delta(provider, event) {
    const kind = kindOf(provider);
    if (kind === "anthropic") return event?.type === "content_block_delta" ? event.delta?.text || "" : "";
    if (kind === "gemini") return (event?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    return event?.choices?.[0]?.delta?.content || "";
  }

  function errorText(status, body) {
    const said = typeof body === "object" ? body?.error?.message || body?.message || "" : String(body || "").slice(0, 160);
    if (status === 401 || status === 403) return `The key was refused (${status})${said ? `: ${said}` : "."}`;
    if (status === 429) return `Too many requests right now (${status}). Try again in a moment.`;
    if (status === 404) return `That model or address was not found (${status})${said ? `: ${said}` : "."}`;
    return `The model answered with an error (${status})${said ? `: ${said}` : "."}`;
  }

  // The site a provider lives on, as a host permission to ask for.
  function origin(setup) {
    if (setup.provider === "chrome") return null;
    try {
      const url = new URL(baseOf(setup));
      if (!/^https?:$/.test(url.protocol)) return null;
      return `${url.protocol}//${url.hostname}/*`;
    } catch (error) { return null; }
  }

  // The last few turns, beginning with a question.
  function trim(history, max = 12) {
    const kept = history.slice(-max);
    while (kept.length && kept[0].role !== "user") kept.shift();
    return kept;
  }

  /* Asks, and hands each piece of the answer to onText as it comes. */
  async function ask(setup, history, { system = "", onText = () => {}, signal } = {}) {
    const messages = trim(history).map((m) => ({ role: m.role, content: m.content }));
    if (setup.provider === "chrome") {
      const LM = root.LanguageModel;
      if (!LM) throw new Error("This Chrome has no built-in model. Chrome 138 or later on a desktop with enough memory has one.");
      const available = await LM.availability?.();
      if (available === "unavailable") throw new Error("Chrome's built-in model isn't available on this device.");
      const session = await LM.create({ initialPrompts: [...(system ? [{ role: "system", content: system }] : []), ...messages.slice(0, -1)] });
      let text = "";
      for await (const chunk of session.promptStreaming(messages[messages.length - 1].content, { signal })) {
        // Early builds sent the whole answer so far; later ones send only the new part.
        const piece = chunk.startsWith(text) ? chunk.slice(text.length) : chunk;
        text += piece;
        onText(piece);
      }
      session.destroy?.();
      return text;
    }
    const req = request(setup, messages, system);
    const response = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal });
    if (!response.ok) {
      // Read once: an answer that isn't JSON is still worth showing as text.
      const raw = await response.text().catch(() => "");
      let body = raw;
      try { body = JSON.parse(raw); } catch (error) { /* plain text it is */ }
      throw new Error(errorText(response.status, body));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const events = sse();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const event of events.push(decoder.decode(value, { stream: true }))) {
        if (event.data === "[DONE]") continue;
        let json;
        try { json = JSON.parse(event.data); } catch (error) { continue; }
        if (json.error) throw new Error(errorText(json.error.code || 500, json));
        const piece = delta(setup.provider, json);
        if (piece) { text += piece; onText(piece); }
      }
    }
    return text;
  }

  const api = { PROVIDERS, sse, request, delta, errorText, origin, trim, ask };
  root.NordlysAI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
