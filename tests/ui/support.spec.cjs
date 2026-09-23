const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The Support section is the one place in the product that asks the user for
   something. Every test here exists to keep that ask honest: nothing is
   invented, nothing is requested, nothing nags, and nothing is unreachable
   from the keyboard. */

async function openSupport(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-support').click();
  await expect(page.locator('#sec-support')).toBeVisible();
}

/* Two addresses shaped like the real thing, used only to prove the section can
   render them. Nothing like this ships in SUPPORT_CONFIG. */
const TEST_WALLETS = [
  { id: 'btc', name: 'Bitcoin', address: 'bc1qtestaddressusedonlybythesuite000000000q' },
  { id: 'eth', name: 'Ethereum', address: '0x000000000000000000000000000000000000dEaD' }
];

async function configureWallets(page, wallets = TEST_WALLETS) {
  await page.evaluate(list => {
    window.NordlysSupportConfig.wallets = list;
    window.Nordlys.settings.support.render();
  }, wallets);
}

async function stubClipboard(page) {
  await page.evaluate(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: text => { window.__copied.push(text); return Promise.resolve(); } }
    });
  });
}

test('support is a section of the settings navigation, not a popup', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // Nothing may announce itself before the user goes looking for it.
  await expect(page.locator('#sec-support')).toBeHidden();
  await expect(page.locator('#cfg')).toHaveAttribute('aria-hidden', 'true');

  await page.locator('#gear').click();
  const tab = page.locator('#settings-tab-support');
  await expect(tab).toBeVisible();
  await expect(tab).toHaveAttribute('role', 'tab');
  await expect(tab).toHaveAttribute('aria-controls', 'sec-support');
  // The rail's icons are local decorative SVG, never an image or an emoji.
  await expect(tab.locator('svg.settings-tab-icon')).toHaveCount(1);

  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#sec-support')).toBeVisible();
  await expect(page.locator('#sec-appearance')).toBeHidden();
  await expect(page.locator('#sec-support')).toHaveAttribute('role', 'tabpanel');
});

test('the support tab is reachable with the arrow keys, its actions with Tab', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#settings-tab-support')).toBeFocused();
  await expect(page.locator('#sec-support')).toBeVisible();

  await configureWallets(page);
  await page.locator('.support-wallets > summary').click();

  const controls = await page.locator('#sec-support a[href], #sec-support button').count();
  expect(controls, 'the section has actions to reach').toBeGreaterThan(0);

  // Identity by position, not by class: the copy buttons are deliberately
  // identical, and a set keyed on their class would count them once.
  const reached = new Set();
  for (let step = 0; step < 24; step++) {
    await page.keyboard.press('Tab');
    const index = await page.evaluate(() => {
      const all = [...document.querySelectorAll('#sec-support a[href], #sec-support button')];
      const at = all.indexOf(document.activeElement);
      return at === -1 ? null : at;
    });
    if (index !== null) reached.add(index);
  }
  expect(reached.size, 'every action in the section is in the tab order').toBe(controls);
});

test('every link out of support opens safely and points somewhere real', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  const links = await page.locator('#sec-support a[href]').evaluateAll(items => items.map(item => ({
    href: item.getAttribute('href'),
    target: item.getAttribute('target'),
    rel: item.getAttribute('rel'),
    label: item.textContent.replace(/\s+/g, ' ').trim()
  })));

  expect(links.length, 'the section offers at least the non-payment actions').toBeGreaterThanOrEqual(3);
  for (const link of links) {
    expect(link.href, `${link.label} must be an https address`).toMatch(/^https:\/\//);
    expect(link.target, `${link.label} must open in a new tab`).toBe('_blank');
    expect(link.rel, `${link.label} must not hand over the opener`).toContain('noopener');
    expect(link.rel, `${link.label} must not leak the referrer`).toContain('noreferrer');
    // A screen reader is told where the link goes before it goes there.
    expect(link.label.length).toBeGreaterThan(0);
  }
});

test('opening support contacts nobody', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const outbound = [];
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) outbound.push(url);
  });
  await openSupport(page);
  await configureWallets(page);
  // Everything the section can unfold, unfolded: a request hiding behind a
  // disclosure is still a request the user did not ask for.
  await page.locator('.support-wallets > summary').click();
  await page.locator('.support-shortcuts > summary').click();
  await page.waitForTimeout(600);
  expect(outbound, 'no remote image, font or beacon may load with the section').toEqual([]);
});

test('a configuration value that is not an https address renders nothing', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  for (const bad of ['javascript:alert(1)', 'http://buymeacoffee.com/example', 'buymeacoffee.com/example', '   ']) {
    await page.evaluate(value => {
      window.NordlysSupportConfig.coffeeUrl = value;
      window.Nordlys.settings.support.render();
    }, bad);
    await expect(page.locator('.support-coffee'), `${bad} must not become a link`).toHaveCount(0);
    await expect(page.locator('.support-unavailable')).toBeVisible();
  }
});

test('an unconfigured coffee link renders an honest note, never a dead button', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  const configured = await page.evaluate(() => Boolean(window.NordlysSupportConfig.coffeeUrl));

  if (configured) {
    const coffee = page.locator('.support-coffee');
    await expect(coffee).toHaveCount(1);
    await expect(coffee).toHaveAttribute('href', /^https:\/\/(www\.)?buymeacoffee\.com\//);
  } else {
    await expect(page.locator('.support-coffee')).toHaveCount(0);
    await expect(page.locator('.support-unavailable')).toBeVisible();
    // A note, not a control: nothing here can be clicked into a dead end.
    expect(await page.locator('.support-unavailable').evaluate(node => node.textContent.trim().length)).toBeGreaterThan(0);
  }
});

test('no wallet configured means no crypto section and no address on screen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  expect(await page.evaluate(() => window.NordlysSupportConfig.wallets.length),
    'the shipped configuration invents no address').toBe(0);

  await expect(page.locator('.support-wallets')).toHaveCount(0);
  await expect(page.locator('.support-wallet')).toHaveCount(0);
  const text = await page.locator('#sec-support').innerText();
  expect(text, 'nothing that looks like a wallet address may be rendered').not.toMatch(/\b(bc1|0x[0-9a-f]{6}|[13][a-km-zA-HJ-NP-Z1-9]{25,})/i);
});

test('a configured wallet copies its address and says so out loud', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  await stubClipboard(page);
  await configureWallets(page);

  const wallets = page.locator('.support-wallet');
  await expect(wallets).toHaveCount(2);
  // Collapsed by default: crypto is an option, not the headline.
  await expect(page.locator('.support-wallets')).not.toHaveAttribute('open', '');
  await page.locator('.support-wallets > summary').click();

  const first = wallets.first();
  await expect(first).toContainText('Bitcoin');
  await expect(first.locator('.support-wallet-address')).toHaveText(TEST_WALLETS[0].address);

  const copy = first.locator('.support-copy');
  await expect(copy).toHaveAttribute('aria-label', /Bitcoin/);
  await copy.focus();
  await page.keyboard.press('Enter');

  await expect.poll(() => page.evaluate(() => window.__copied)).toEqual([TEST_WALLETS[0].address]);
  await expect(copy).toHaveText(/Copied/i);
  await expect.poll(() => page.locator('#nl-live-region').textContent())
    .toMatch(/Bitcoin address copied/i);
  // The word on the button is the word a speech-input user says, so the
  // accessible name has to follow it into the confirmed state.
  await expect(copy).toHaveAttribute('aria-label', /copied/i);

  // The confirmation is temporary; the button goes back to offering the action.
  await expect.poll(() => copy.textContent(), { timeout: 8000 }).toMatch(/^\s*Copy\s*$/i);
  await expect(copy).toHaveAttribute('aria-label', /^Copy the Bitcoin address$/);
});

/* ── About ─────────────────────────────────────────────────────────────────
   The half of the section that is worth opening when the answer to the ask is
   no. It may not invent a version, link anywhere unverified, or grow loud. */

test('the version on screen is the one the app is running, not a copy', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  const running = await page.evaluate(() => window.Nordlys.defaultConfig.version);
  expect(running, 'the app knows its own version').toMatch(/^\d+\.\d+\.\d+$/);
  await expect(page.locator('.support-version')).toHaveText(new RegExp(`\\b${running.replace(/\./g, '\\.')}\\b`));

  // Changing the source changes the screen: nothing here holds its own number.
  await page.evaluate(() => {
    window.Nordlys.defaultConfig.version = '9.8.7';
    window.Nordlys.settings.support.render();
  });
  await expect(page.locator('.support-version')).toContainText('9.8.7');
});

test('the changelog link points at the changelog and opens like every other link', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  const link = page.locator('.support-about-link');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', /^https:\/\/github\.com\/.+\/CHANGELOG\.md$/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toHaveAttribute('rel', /noreferrer/);
  await expect(link).toContainText('Changelog');

  // Same fail-closed rule as the donation link: unverified renders as nothing.
  for (const bad of ['http://github.com/x/CHANGELOG.md', 'javascript:alert(1)', '']) {
    await page.evaluate(value => {
      window.NordlysSupportConfig.changelogUrl = value;
      window.Nordlys.settings.support.render();
    }, bad);
    await expect(page.locator('.support-about-link'), `${bad} must not become a link`).toHaveCount(0);
  }
});

test('the shortcut legend is collapsed, complete, and describes the keys that exist', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  const legend = page.locator('.support-shortcuts');
  await expect(legend).toHaveCount(1);
  // Secondary means closed: nobody opening Support is looking for a key chart.
  await expect(legend).not.toHaveAttribute('open', '');
  await expect(page.locator('.support-shortcut').first()).toBeHidden();

  await page.locator('.support-shortcuts > summary').click();
  const rows = page.locator('.support-shortcut');
  await expect(rows).toHaveCount(9);

  const keys = await rows.locator('.support-shortcut-keys').allInnerTexts();
  const expected = await page.evaluate(() => (navigator.platform || '').toUpperCase().includes('MAC') ? ['⌘', '⌥'] : ['Ctrl', 'Alt']);
  expect(keys[0].trim()).toBe('/');
  expect(keys[1].trim()).toBe('>');
  expect(keys[2]).toContain(expected[0]);
  expect(keys[2]).toContain('K');
  expect(keys[3]).toContain(',');
  expect(keys[4]).toContain(expected[1]);
  expect(keys[5]).toContain('←→↑↓');
  expect(keys[5]).toContain(expected[1]);
  expect(keys[6]).toContain('Enter');
  expect(keys[6]).toContain('←→↑↓');
  expect(keys[7]).toContain('F10');
  expect(keys[7]).toContain('Menu');

  // Every cap is a <kbd>, and every row says what the cap does.
  expect(await rows.locator('kbd').count()).toBeGreaterThanOrEqual(8);
  for (const meaning of await rows.locator('.support-shortcut-what').allInnerTexts()) {
    expect(meaning.trim().length, 'a key with no meaning beside it').toBeGreaterThan(0);
  }
});

/* One of the five is the one the legend is most likely to get wrong, because it
   is the only one whose modifier differs by platform. */
test('the legend prints the modifier the handler actually listens for', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSupport(page);
  await page.locator('.support-shortcuts > summary').click();
  const printed = (await page.locator('.support-shortcut-keys').nth(2).innerText()).replace(/\s+/g, '');
  const mac = await page.evaluate(() => (navigator.platform || '').toUpperCase().includes('MAC'));
  expect(printed).toBe(mac ? '⌘K' : 'CtrlK');

  // Pressed where the legend claims it works: on the page, not inside the modal
  // drawer, which holds its own focus for as long as it is open.
  await page.locator('#cfgx').click();
  await expect(page.locator('#cfg')).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press(mac ? 'Meta+K' : 'Control+K');
  await expect(page.locator('#q')).toBeFocused();
});

test('every locale translates the About block and the legend', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const keys = ['support.intro', 'support.aboutTitle', 'support.changelog', 'support.shortcuts',
    'support.keySearch', 'support.keyCommand', 'support.keySearchAnywhere', 'support.keySettings', 'support.keyBookmark', 'support.keyBoard', 'support.keyMenu', 'support.keyUndo'];

  const report = await page.evaluate(wanted => {
    const missing = [], untranslated = [];
    for (const [locale, messages] of Object.entries(window.I18N.translations)) {
      for (const key of wanted) {
        const value = messages[key];
        if (typeof value !== 'string' || !value.trim()) missing.push(`${locale}/${key}`);
        else if (locale !== 'en' && value === window.I18N.translations.en[key]) untranslated.push(`${locale}/${key}`);
      }
    }
    return { locales: Object.keys(window.I18N.translations).length, missing, untranslated };
  }, keys);

  expect(report.locales, 'the product ships eight locales').toBe(8);
  expect(report.missing, 'About prose a locale never got').toEqual([]);
  expect(report.untranslated, 'About prose left in English').toEqual([]);

  // And the prose on screen follows the language, not the language it loaded in.
  await openSupport(page);
  const english = await page.locator('#sec-support').innerText();
  await page.locator('#cfg-language-select').evaluate(select => {
    select.value = 'de'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('.support-shortcuts')).toContainText('Tastenkürzel');
  await page.locator('.support-shortcuts > summary').click();
  await expect(page.locator('.support-shortcut-what').first()).toContainText('Suchfeld');
  expect(await page.locator('#sec-support').innerText()).not.toBe(english);
  // The parameterised version line survives the rebuild rather than printing {version}.
  await expect(page.locator('.support-version')).not.toContainText('{version}');
});

test('nothing in support runs off a 320px sheet, unfolded or not', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 320, height: 640 });
  await openSupport(page);
  await configureWallets(page);
  await page.locator('.support-wallets > summary').click();
  await page.locator('.support-shortcuts > summary').click();
  await page.waitForTimeout(120);

  const escaped = await page.evaluate(() => {
    const body = document.querySelector('#cfg .cbody');
    const sheet = body.getBoundingClientRect();
    return [...body.querySelectorAll('#sec-support a, #sec-support button, #sec-support .support-wallet-address, #sec-support summary, #sec-support .support-version, #sec-support .support-shortcut-keys, #sec-support .support-shortcut-what')]
      .filter(node => node.getClientRects().length && !node.closest('[hidden],[inert],[aria-hidden="true"]'))
      .filter(node => {
        const box = node.getBoundingClientRect();
        return box.left < sheet.left - 1 || box.right > sheet.right + 1;
      })
      .map(node => (node.getAttribute('aria-label') || node.textContent || node.className).trim().slice(0, 28));
  });
  expect(escaped, 'support controls hanging outside the settings sheet').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

/* The section may not become a channel: no counter, no badge on the rail, no
   loop to catch the eye, and no reason to reopen it. */
test('support asks once, quietly, and never animates for attention', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  const badge = await page.locator('#settings-tab-support').evaluate(tab => ({
    text: tab.textContent.replace(/\s+/g, ' ').trim(),
    marker: Boolean(tab.querySelector('.badge, .dot, [data-count]')),
    animation: getComputedStyle(tab, '::after').animationName
  }));
  expect(badge.marker, 'the rail item carries no badge').toBe(false);
  expect(badge.text).toBe('Support');
  expect(['none', ''], 'nothing on the rail loops for attention').toContain(badge.animation);

  await page.locator('#settings-tab-support').click();
  const looping = await page.evaluate(() => [...document.querySelectorAll('#sec-support *')]
    .filter(node => {
      const style = getComputedStyle(node);
      return style.animationName !== 'none' && style.animationIterationCount === 'infinite';
    }).length);
  expect(looping, 'nothing in the section animates on a loop').toBe(0);
});
