const { test } = require('node:test');
const assert = require('node:assert/strict');
const convert = require('../../src/js/convert.js');

/* What the search box answers without searching (convert.js): units, the
   time elsewhere and money. Each reads only what it is sure of, so a search
   that merely looks like one stays a search. */

test('a quantity is shown in the unit asked for, or else in the other system', () => {
  assert.equal(convert.units('10 km in mi', 'en').text, '10 km = 6.21371 mi');
  assert.equal(convert.units('180 cm', 'en').text, '180 cm = 70.8661 in');
  assert.equal(convert.units('100 f to c', 'en').text, '100 °F = 37.7778 °C');
  assert.equal(convert.units('25 °c', 'en').text, '25 °C = 77 °F');
  assert.equal(convert.units('10 in in cm', 'en').text, '10 in = 25.4 cm', '"in" is the unit and the word');
  assert.equal(convert.units('16 gb in mib', 'en').answer, '15,258.8');
  assert.equal(convert.units('60 mph to km/h', 'en').text, '60 mph = 96.5606 km/h');
  assert.equal(convert.units('5 км в милях', 'ru').text, '5 km = 3,10686 mi');
  assert.equal(convert.units('3 pounds to kg', 'en').text, '3 lb = 1.36078 kg');
});

test('numbers are read the way they are written', () => {
  assert.equal(convert.numberOf('1,5'), 1.5);
  assert.equal(convert.numberOf('1.5'), 1.5);
  assert.equal(convert.numberOf('1,000'), 1000);
  assert.equal(convert.numberOf('1.000,25'), 1000.25);
  assert.equal(convert.numberOf('1 000'), 1000);
  assert.equal(convert.numberOf('12abc'), null);
});

test('what is not a conversion is left to the search', () => {
  for (const text of ['2 + 2', 'hello', '10 km in kg', '2025', 'best 5 km runs', '10 km in km', 'iphone 15 pro']) {
    assert.equal(convert.units(text, 'en'), null, text);
  }
});

const BERLIN = 'Europe/Berlin';
const AUTUMN = new Date('2026-10-23T10:00:00Z'); // Berlin on summer time, UTC+2
const MARCH = new Date('2026-03-20T10:00:00Z'); // New York on summer time, Berlin not yet

test('the time somewhere else, and how far it is from here', () => {
  const tokyo = convert.time('time in tokyo', { now: AUTUMN, lang: 'en-GB', here: BERLIN, hour12: false });
  assert.equal(tokyo.zone, 'Asia/Tokyo');
  assert.match(tokyo.text, /^Tokyo: Fri 19:00 \(\+7h\)$/);
  assert.equal(convert.time('tokyo time', { now: AUTUMN, here: BERLIN }).zone, 'Asia/Tokyo');
  assert.equal(convert.time('new york time', { now: AUTUMN, here: BERLIN }).zone, 'America/New_York');
  assert.equal(convert.time('время в баку', { now: AUTUMN, here: BERLIN }).zone, 'Asia/Baku');
  assert.match(convert.time('time in nyc', { now: AUTUMN, lang: 'en-GB', here: BERLIN, hour12: false }).text, /\(-6h\)$/);
});

test('an hour in one place is the hour it is in another, summer time included', () => {
  assert.equal(convert.time('15:00 berlin to baku', { now: AUTUMN, lang: 'en-GB', here: BERLIN, hour12: false }).text, '15:00 Berlin = Fri 17:00 Baku');
  assert.equal(convert.time('3pm london in tokyo', { now: AUTUMN, lang: 'en-GB', here: BERLIN, hour12: false }).text, '15:00 London = Fri 23:00 Tokyo');
  // In March the clocks have changed in New York and not yet in Berlin: five hours, not six.
  assert.equal(convert.time('15:00 berlin to new york', { now: MARCH, lang: 'en-GB', here: BERLIN, hour12: false }).answer, 'Fri 10:00');
  // An hour and a place alone: that hour there, here.
  assert.equal(convert.time('15:00 tokyo', { now: AUTUMN, lang: 'en-GB', here: BERLIN, hour12: false }).text, '15:00 Tokyo = Fri 08:00 Berlin');
});

test('a bare number and a place, or a film with time in its name, is a search', () => {
  for (const text of ['5 london', 'time machine', 'prime time', 'paris hilton', '25:00 berlin', '13pm london']) {
    assert.equal(convert.time(text, { now: AUTUMN, here: BERLIN }), null, text);
  }
});

const RATES = { updated: Date.UTC(2026, 9, 23), rates: { USD: 1, EUR: 0.9, AZN: 1.7, RUB: 81 } };

test('money is read in codes, signs and words, and changed at the rates of the day', () => {
  assert.deepEqual(convert.money('100 usd to eur'), { amount: 100, from: 'USD', to: 'EUR' });
  assert.deepEqual(convert.money('€20 in azn'), { amount: 20, from: 'EUR', to: 'AZN' });
  assert.deepEqual(convert.money('50 euro в рублях'), { amount: 50, from: 'EUR', to: 'RUB' });
  assert.deepEqual(convert.money('$1,250.50 to ₼'), { amount: 1250.5, from: 'USD', to: 'AZN' });
  assert.equal(convert.exchange(convert.money('100 usd to eur'), RATES, 'en-US').text, '$100.00 = €90.00');
  assert.equal(convert.exchange(convert.money('20 eur to azn'), RATES, 'en-US').answer, '37.78');
});

test('what is not money is not sent for rates', () => {
  for (const text of ['100 abc to xyz', '10 km in mi', '100 usd', 'usd to eur', '100 eur to eur', 'buy 100 shares to sell']) {
    assert.equal(convert.money(text), null, text);
  }
  assert.equal(convert.exchange({ amount: 1, from: 'USD', to: 'GBP' }, RATES, 'en-US'), null, 'a currency the rates lack');
  assert.equal(convert.exchange(convert.money('100 usd to eur'), null, 'en-US'), null, 'no rates yet');
});
