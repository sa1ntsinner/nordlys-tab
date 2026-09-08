/* Runs the actual unpacked extension in a throwaway Chromium profile.

   The ordinary fixture serves newtab.html over HTTP with a shim for chrome.*.
   That is fast and right for layout and most behaviour, but it is not the
   product: there is no content security policy, storage answers from a stub,
   and there is one page where the extension may have several. Anything that
   depends on those — script evaluation, real storage, real permissions — has
   to be proven here, by doing what a user does: typing into the field and
   looking at what appears. Calling a function through the debugger can pass
   where the same code fails under CSP. */
const { chromium } = require('@playwright/test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const EXTENSION_PATH = resolve(__dirname, '..', '..');

async function launchExtension() {
  const profile = mkdtempSync(join(tmpdir(), 'nordlys-extension-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
  });
  const page = context.pages()[0] || await context.newPage();

  const errors = [];
  const cspViolations = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto('chrome://newtab');
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  // The page reports its own CSP violations; recorded from inside so a blocked
  // eval shows up as a fact rather than as a missing result.
  await page.evaluate(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__cspViolations.push({ directive: event.violatedDirective, blocked: event.blockedURI, line: event.lineNumber });
    });
  });

  return {
    context, page, errors, cspViolations,
    extensionUrl: page.url(),
    async violations() { return page.evaluate(() => window.__cspViolations || []); },
    async close() {
      await context.close();
      rmSync(profile, { recursive: true, force: true });
    }
  };
}

module.exports = { launchExtension, EXTENSION_PATH };
