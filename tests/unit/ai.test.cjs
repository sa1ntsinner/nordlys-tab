const { test } = require('node:test');
const assert = require('node:assert');
const AI = require('../../src/js/ai.js');

test('server-sent events are cut into whole events, however the bytes arrive', () => {
  const reader = AI.sse();
  const out = [];
  out.push(...reader.push('data: {"a":1}\n\nda'));
  out.push(...reader.push('ta: {"a":2}\n'));
  out.push(...reader.push('\nevent: ping\ndata: {"a":3}\n\n'));
  assert.deepStrictEqual(out.map(e => e.data), ['{"a":1}', '{"a":2}', '{"a":3}']);
  assert.strictEqual(out[2].event, 'ping');
  assert.deepStrictEqual(reader.push('data: [DONE]\n\n').map(e => e.data), ['[DONE]']);
});

test('each provider is asked the way it expects', () => {
  const messages = [{ role: 'user', content: 'Hi' }];
  const openai = AI.request({ provider: 'openai', key: 'sk-1', model: 'gpt-4.1-mini' }, messages, 'Be brief.');
  assert.strictEqual(openai.url, 'https://api.openai.com/v1/chat/completions');
  assert.strictEqual(openai.headers.Authorization, 'Bearer sk-1');
  assert.deepStrictEqual(JSON.parse(openai.body).messages, [{ role: 'system', content: 'Be brief.' }, ...messages]);
  assert.strictEqual(JSON.parse(openai.body).stream, true);

  const anthropic = AI.request({ provider: 'anthropic', key: 'k', model: 'claude-haiku-4-5-20251001' }, messages, 'Be brief.');
  assert.strictEqual(anthropic.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(anthropic.headers['x-api-key'], 'k');
  assert.strictEqual(anthropic.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const body = JSON.parse(anthropic.body);
  assert.strictEqual(body.system, 'Be brief.');
  assert.ok(body.max_tokens > 0);

  const gemini = AI.request({ provider: 'gemini', key: 'g', model: 'gemini-2.5-flash' }, messages, 'Be brief.');
  assert.match(gemini.url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:streamGenerateContent\?alt=sse$/);
  assert.strictEqual(gemini.headers['x-goog-api-key'], 'g');
  assert.deepStrictEqual(JSON.parse(gemini.body).contents, [{ role: 'user', parts: [{ text: 'Hi' }] }]);

  const ollama = AI.request({ provider: 'ollama', model: 'llama3.2' }, messages, '');
  assert.strictEqual(ollama.url, 'http://localhost:11434/v1/chat/completions');
  assert.strictEqual(ollama.headers.Authorization, undefined, 'a local model needs no key');

  const custom = AI.request({ provider: 'custom', base: 'https://llm.example.com/v1/', key: 'x', model: 'm' }, messages, '');
  assert.strictEqual(custom.url, 'https://llm.example.com/v1/chat/completions');
});

test('the words of an answer are taken out of each provider\'s stream', () => {
  assert.strictEqual(AI.delta('openai', { choices: [{ delta: { content: 'Hel' } }] }), 'Hel');
  assert.strictEqual(AI.delta('openai', { choices: [{ delta: {} }] }), '');
  assert.strictEqual(AI.delta('anthropic', { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } }), 'lo');
  assert.strictEqual(AI.delta('anthropic', { type: 'message_start' }), '');
  assert.strictEqual(AI.delta('gemini', { candidates: [{ content: { parts: [{ text: ' there' }] } }] }), ' there');
});

test('a provider error is told plainly', () => {
  assert.strictEqual(AI.errorText(401, { error: { message: 'Incorrect API key' } }), 'The key was refused (401): Incorrect API key');
  assert.strictEqual(AI.errorText(429, {}), 'Too many requests right now (429). Try again in a moment.');
  assert.match(AI.errorText(500, 'oops'), /500/);
});

test('the address a provider needs permission for', () => {
  assert.strictEqual(AI.origin({ provider: 'openai' }), 'https://api.openai.com/*');
  assert.strictEqual(AI.origin({ provider: 'ollama' }), 'http://localhost/*');
  assert.strictEqual(AI.origin({ provider: 'custom', base: 'https://llm.example.com:8443/v1' }), 'https://llm.example.com/*');
  assert.strictEqual(AI.origin({ provider: 'custom', base: 'not a url' }), null);
  assert.strictEqual(AI.origin({ provider: 'chrome' }), null, 'the model in Chrome needs none');
});

test('a long conversation is trimmed to what is worth sending', () => {
  const history = Array.from({ length: 40 }, (v, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const kept = AI.trim(history, 12);
  assert.strictEqual(kept.length, 12);
  assert.strictEqual(kept[0].role, 'user', 'it starts with a question, never an answer');
  assert.strictEqual(kept[kept.length - 1].content, 'm39');
});
