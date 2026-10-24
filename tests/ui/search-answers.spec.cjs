/* The answers the search box gives without searching (convert.js): a
   quantity in other units, the time elsewhere, and money. Only money reaches
   the network, for the day's rates, once a day, and only after an amount of
   money was typed. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function type(page, text) {
  await page.locator('#q').click();
  await page.locator('#q').fill(text);
}
const RATES = { result: 'success', time_last_update_unix: 1792713751, rates: { USD: 1, EUR: 0.9, AZN: 1.7 } };

test('a conversion and the time elsewhere are answered on the spot, and Enter takes the answer', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, '10 km in mi');
  await expect(page.locator('#sugg .sugg-units .calc-val')).toHaveText('10 km = 6.21371 mi');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#q')).toHaveValue('6.21371');
  await type(page, '1.234 kg to g');
  await expect(page.locator('#sugg .sugg-units .calc-val')).toHaveText('1.234 kg = 1,234 g');
  await type(page, 'time in tokyo');
  await expect(page.locator('#sugg .sugg-time .calc-val')).toContainText('Tokyo');
  await expect(page.locator('#sugg .sugg-time svg')).toHaveCount(1);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('money asks for the day\'s rates once, and says whose they are', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const asked = [];
  await page.route('https://open.er-api.com/**', (route) => {
    asked.push(route.request().url());
    return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(RATES) });
  });
  await type(page, 'what is the weather like');
  await page.waitForTimeout(400);
  expect(asked, 'a search asks for nothing').toEqual([]);
  await type(page, '100 usd to eur');
  await expect(page.locator('#sugg .sugg-money .calc-val')).toHaveText('$100.00 = €90.00');
  await expect(page.locator('#sugg .sugg-money .calc-note')).toContainText('ExchangeRate-API');
  await type(page, '20 eur in azn');
  await expect(page.locator('#sugg .sugg-money .calc-val')).toContainText('37.78');
  expect(asked).toEqual(['https://open.er-api.com/v6/latest/USD']);
  // Kept for the day: a new tab answers without asking again.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await type(page, '5 usd to eur');
  await expect(page.locator('#sugg .sugg-money .calc-val')).toHaveText('$5.00 = €4.50');
  expect(asked).toHaveLength(1);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('with no network and no rates kept, money is not answered and the search still goes', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://open.er-api.com/**', (route) => route.abort());
  await type(page, '100 usd to eur');
  await page.waitForTimeout(500);
  await expect(page.locator('#sugg .sugg-money')).toHaveCount(0);
  await page.locator('#q').press('Enter');
  await expect.poll(() => page.evaluate(() => (window.__searches || []).map((search) => search.text))).toEqual(['100 usd to eur']);
});
