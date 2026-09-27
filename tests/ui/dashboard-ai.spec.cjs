const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The Ask card over a model of the person's choosing. The providers are
   stood in for with page.route, answering in the stream format each one
   really uses. */

const ask = page => page.locator('#dash .dash-card[data-type="ai"]').first();
const sse = events => events.map(e => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');

test.beforeEach(async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); d.add('ai'); await d.render(); });
});

const NAMES = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini', ollama: 'Ollama (on this computer)' };
// The dialog draws its own list over the native select, as Settings does.
async function pick(page, provider) {
  await page.locator('#dash-ai-provider + .nl-select').click();
  await page.locator('.nl-select-list.open [role="option"]', { hasText: NAMES[provider] }).first().click();
}
async function openSetup(page) {
  await ask(page).hover();
  await ask(page).getByRole('button', { name: /options/ }).click();
  await page.locator('.dash-menu').getByRole('menuitem', { name: 'Settings' }).click();
}
async function choose(page, provider, key = 'sk-test') {
  await openSetup(page);
  const dialog = page.locator('.dash-dialog');
  await pick(page, provider);
  if (key) await dialog.locator('#dash-ai-key').fill(key);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
}

test('OpenAI: the key is sent to OpenAI only, the answer streams in, and the key is never in the config or a backup', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  let seen = null;
  await page.route('https://api.openai.com/v1/chat/completions', async route => {
    seen = { auth: route.request().headers().authorization, body: JSON.parse(route.request().postData()) };
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([{ choices: [{ delta: { content: 'Oslo is ' } }] }, { choices: [{ delta: { content: '**cold** in winter.' } }] }, '[DONE]']) });
  });
  await choose(page, 'openai');
  expect(await page.evaluate(() => window.__origins?.asked)).toEqual(['https://api.openai.com/*']);
  const input = ask(page).getByRole('textbox', { name: 'Ask anything' });
  await input.fill('Is Oslo cold?');
  await input.press('Enter');
  await expect(ask(page).locator('.dash-ai-msg.is-assistant .dash-ai-text')).toHaveText('Oslo is cold in winter.');
  await expect(ask(page).locator('.dash-ai-msg.is-assistant strong')).toHaveText('cold');
  expect(seen.auth).toBe('Bearer sk-test');
  expect(seen.body.messages.at(-1)).toEqual({ role: 'user', content: 'Is Oslo cold?' });
  expect(seen.body.messages[0].role).toBe('system');
  const config = await page.evaluate(() => JSON.stringify(window.Nordlys.config));
  const backup = await page.evaluate(() => JSON.stringify(window.Nordlys.settings.buildBackupPayload()));
  expect(config).not.toContain('sk-test');
  expect(backup).not.toContain('sk-test');
  expect(runtimeErrors).toEqual([]);
});

test('Anthropic and Gemini streams are read too', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.anthropic.com/v1/messages', route => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' },
    body: `event: message_start\ndata: {"type":"message_start"}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello from "}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude."}}\n\n` }));
  await choose(page, 'anthropic', 'ak');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).fill('Hi');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).press('Enter');
  await expect(ask(page).locator('.dash-ai-msg.is-assistant .dash-ai-text')).toHaveText('Hello from Claude.');
  // Switch to Gemini from the card's settings.
  await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([{ candidates: [{ content: { parts: [{ text: 'And from Gemini.' }] } }] }]) }));
  await openSetup(page);
  await pick(page, 'gemini');
  await page.locator('#dash-ai-key').fill('gk');
  await page.locator('.dash-dialog').getByRole('button', { name: 'Save' }).click();
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).fill('Again');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).press('Enter');
  await expect(ask(page).locator('.dash-ai-msg.is-assistant .dash-ai-text').last()).toHaveText('And from Gemini.');
});

test('a refused key is said plainly in the card', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.openai.com/**', route => route.fulfill({ status: 401, json: { error: { message: 'Incorrect API key provided' } } }));
  await choose(page, 'openai', 'bad');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).fill('Hi');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).press('Enter');
  await expect(ask(page).locator('.dash-ai-msg.is-error')).toContainText('The key was refused (401): Incorrect API key provided');
});

test('without leave to reach the provider nothing is saved and the dialog says why', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.__origins = { grant: false }; window.Nordlys.dashboard.aiSetup = null; });
  await openSetup(page);
  await pick(page, 'openai');
  await page.locator('#dash-ai-key').fill('k');
  await page.locator('.dash-dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.dash-dialog .dash-form-error')).toContainText('api.openai.com');
  expect(await page.evaluate(() => window.Nordlys.dashboard.aiSetup)).toBeNull();
});

test('"? question" in the search box asks the card', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.openai.com/**', route => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([{ choices: [{ delta: { content: 'Forty-two.' } }] }, '[DONE]']) }));
  await choose(page, 'openai');
  await page.locator('#q').click();
  await page.locator('#q').fill('? what is the answer');
  await page.locator('#q').press('Enter');
  await expect(ask(page).locator('.dash-ai-msg.is-user')).toHaveText('what is the answer');
  await expect(ask(page).locator('.dash-ai-msg.is-assistant .dash-ai-text')).toHaveText('Forty-two.');
});

test('an answer becomes a task in one click, and a new conversation starts clean', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.openai.com/**', route => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([{ choices: [{ delta: { content: 'Renew the passport\nIt runs out in May.' } }] }, '[DONE]']) }));
  await choose(page, 'openai');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).fill('What should I not forget?');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).press('Enter');
  await ask(page).locator('.dash-ai-msg.is-assistant').hover();
  await ask(page).getByRole('button', { name: 'Make it a task' }).click();
  await expect(page.locator('#dash .dash-card[data-type="tasks"] .dash-task-text')).toContainText(['Renew the passport']);
  await ask(page).getByRole('button', { name: 'New conversation' }).click();
  await expect(ask(page).locator('.dash-ai-msg')).toHaveCount(0);
});

test('whatever the model says is shown as text, never run as markup', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.openai.com/**', route => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([{ choices: [{ delta: { content: '<img src=x onerror="window.__owned=1"> and `<b>code</b>`' } }] }, '[DONE]']) }));
  await choose(page, 'openai');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).fill('hi');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).press('Enter');
  await expect(ask(page).locator('.dash-ai-msg.is-assistant .dash-ai-text')).toContainText('<img src=x');
  expect(await page.evaluate(() => window.__owned)).toBeUndefined();
  expect(await ask(page).locator('.dash-ai-msg.is-assistant img').count()).toBe(0);
});

test('where Chrome has its own model, the card uses it with no key and nothing sent', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  let asked = 0;
  await page.route('**/*', route => { if (/openai|anthropic|googleapis/.test(route.request().url())) asked++; return route.continue(); });
  await page.evaluate(() => {
    window.LanguageModel = { availability: async () => 'available', create: async () => ({ async *promptStreaming(text) { yield 'On '; yield 'this device.'; }, destroy() {} }) };
    window.Nordlys.dashboard.aiSetup = { provider: 'chrome' };
  });
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).fill('Where do you run?');
  await ask(page).getByRole('textbox', { name: 'Ask anything' }).press('Enter');
  await expect(ask(page).locator('.dash-ai-msg.is-assistant .dash-ai-text')).toHaveText('On this device.');
  expect(asked).toBe(0);
});
