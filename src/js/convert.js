/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHAT THE SEARCH BOX ANSWERS WITHOUT SEARCHING
   ═══════════════════════════════════════════════════════════════════

   A quantity in other units ("10 km in mi", "180 cm"), the time somewhere
   else ("time in tokyo", "15:00 berlin to baku") and an amount in another
   currency ("100 usd to eur", "€20 in azn").

   Only reading the text and the arithmetic live here. Nothing is fetched:
   the currency rates are handed in by the page (widgets.js), which asks for
   them only once somebody has typed an amount of money. A text that is not
   one of these comes back null, so a search stays a search. */
(function () {
  "use strict";

  /* Every unit in its dimension, as how many of the dimension's base unit
     one of it is. Temperature is not a factor and is converted on its own. */
  const UNITS = {
    length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852 },
    mass: { mg: 0.001, g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237, st: 6350.29318 },
    volume: { ml: 0.001, cl: 0.01, dl: 0.1, l: 1, tsp: 0.00492892159375, tbsp: 0.01478676478125, floz: 0.0295735295625, cup: 0.2365882365, pt: 0.473176473, qt: 0.946352946, gal: 3.785411784 },
    speed: { "m/s": 1, "km/h": 1 / 3.6, mph: 0.44704, kn: 1852 / 3600 },
    area: { cm2: 1e-4, m2: 1, ha: 1e4, km2: 1e6, ft2: 0.09290304, acre: 4046.8564224 },
    data: { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 },
    time: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 },
    temperature: { c: null, f: null, k: null }
  };
  // What people type for a unit, folded to lower case.
  const ALIASES = {
    millimeter: "mm", millimeters: "mm", millimetre: "mm", millimetres: "mm", мм: "mm",
    centimeter: "cm", centimeters: "cm", centimetre: "cm", centimetres: "cm", см: "cm",
    meter: "m", meters: "m", metre: "m", metres: "m", м: "m",
    kilometer: "km", kilometers: "km", kilometre: "km", kilometres: "km", км: "km",
    inch: "in", inches: "in", '"': "in", дюйм: "in", дюйма: "in", дюймов: "in",
    foot: "ft", feet: "ft", "'": "ft", фут: "ft", фута: "ft", футов: "ft",
    yard: "yd", yards: "yd", mile: "mi", miles: "mi", миля: "mi", мили: "mi", миль: "mi", милях: "mi",
    "nautical mile": "nmi", "nautical miles": "nmi",
    milligram: "mg", milligrams: "mg", мг: "mg", gram: "g", grams: "g", gramme: "g", grammes: "g", г: "g", гр: "g",
    kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg", кг: "kg",
    tonne: "t", tonnes: "t", ton: "t", tons: "t", т: "t",
    ounce: "oz", ounces: "oz", pound: "lb", pounds: "lb", lbs: "lb", фунт: "lb", фунта: "lb", фунтов: "lb", stone: "st", stones: "st",
    milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml", мл: "ml",
    liter: "l", liters: "l", litre: "l", litres: "l", л: "l",
    teaspoon: "tsp", teaspoons: "tsp", tablespoon: "tbsp", tablespoons: "tbsp",
    "fl oz": "floz", "fluid ounce": "floz", "fluid ounces": "floz", cups: "cup",
    pint: "pt", pints: "pt", quart: "qt", quarts: "qt", gallon: "gal", gallons: "gal",
    kmh: "km/h", kph: "km/h", "km/ч": "km/h", "км/ч": "km/h", mps: "m/s", "м/с": "m/s", knot: "kn", knots: "kn", kt: "kn",
    "m²": "m2", sqm: "m2", "km²": "km2", "cm²": "cm2", "ft²": "ft2", sqft: "ft2", hectare: "ha", hectares: "ha", acres: "acre",
    byte: "b", bytes: "b", kilobyte: "kb", kilobytes: "kb", megabyte: "mb", megabytes: "mb", gigabyte: "gb", gigabytes: "gb", terabyte: "tb", terabytes: "tb",
    millisecond: "ms", milliseconds: "ms", second: "s", seconds: "s", sec: "s", secs: "s", сек: "s",
    minute: "min", minutes: "min", mins: "min", мин: "min",
    hour: "h", hours: "h", hr: "h", hrs: "h", ч: "h", час: "h", часа: "h", часов: "h",
    day: "d", days: "d", дн: "d", день: "d", дня: "d", дней: "d", week: "wk", weeks: "wk", нед: "wk",
    "°c": "c", celsius: "c", "°f": "f", fahrenheit: "f", kelvin: "k", "°к": "k"
  };
  // A quantity typed alone is shown in the other system.
  const OTHER = { km: "mi", mi: "km", m: "ft", ft: "m", cm: "in", in: "cm", kg: "lb", lb: "kg", g: "oz", oz: "g", l: "gal", gal: "l", ml: "floz", floz: "ml", c: "f", f: "c", "km/h": "mph", mph: "km/h", m2: "ft2", ft2: "m2", ha: "acre", acre: "ha" };
  // The words between two units or two currencies, in the languages Nordlys speaks.
  const JOINERS = ["to", "in", "into", "as", "=", "->", "→", "в", "во", "на", "nach", "zu", "en", "a", "à", "vers"];

  const SHOWN = { floz: "fl oz", c: "°C", f: "°F", k: "K", m2: "m²", km2: "km²", cm2: "cm²", ft2: "ft²", b: "B", kb: "kB", mb: "MB", gb: "GB", tb: "TB", kib: "KiB", mib: "MiB", gib: "GiB", tib: "TiB" };

  function unitOf(word) {
    const folded = String(word || "").trim().toLowerCase().replace(/\s+/g, " ");
    const id = ALIASES[folded] || folded;
    for (const [dimension, units] of Object.entries(UNITS)) {
      if (Object.prototype.hasOwnProperty.call(units, id)) return { id, dimension };
    }
    return null;
  }

  // The mark a language writes before decimals: "." in English, "," in German.
  function decimalMark(lang) {
    try { return new Intl.NumberFormat(lang || "en").formatToParts(1.5).find((part) => part.type === "decimal").value; }
    catch (error) { return "."; }
  }

  /* "1,5" and "1.5" are one and a half; "1,000", "1.000,25" and "1 000" a
     thousand and more. "1.234" alone could be either, and is read the way
     the language writes decimals. */
  function numberOf(text, lang) {
    let value = String(text).trim().replace(/\s/g, "");
    const either = /^[+-]?[1-9]\d{0,2}([.,])\d{3}$/.exec(value);
    if (either) value = either[1] === decimalMark(lang) ? value.replace(",", ".") : value.replace(either[1], "");
    else if (/^[+-]?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(value)) value = value.replace(/,/g, "");
    else if (/^[+-]?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(value)) value = value.replace(/\./g, "").replace(",", ".");
    else value = value.replace(",", ".");
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function temperature(value, from, to) {
    const celsius = from === "c" ? value : from === "f" ? (value - 32) * 5 / 9 : value - 273.15;
    return to === "c" ? celsius : to === "f" ? celsius * 9 / 5 + 32 : celsius + 273.15;
  }

  function format(value, lang, digits = 6) {
    const rounded = Number(value.toPrecision(digits));
    try { return rounded.toLocaleString(lang || undefined, { maximumFractionDigits: 6 }); }
    catch (error) { return String(rounded); }
  }

  const NUMBER = String.raw`[+-]?\d[\d\s.,]*|[+-]?\.\d+`;
  const joinerPattern = () => JOINERS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  /* "10 km in mi", "100 f to c", "5'": a number, a unit, and the unit to show
     it in, or none for the other system's. */
  function units(text, lang) {
    const match = new RegExp(`^\\s*(${NUMBER})\\s*([^\\d\\s][^\\d]*?)(?:\\s+(?:${joinerPattern()})\\s+([^\\d]+?))?\\s*$`, "iu").exec(String(text || ""));
    if (!match) return null;
    const value = numberOf(match[1], lang);
    const from = unitOf(match[2]);
    if (value === null || !from) return null;
    const to = match[3] ? unitOf(match[3]) : (OTHER[from.id] ? unitOf(OTHER[from.id]) : null);
    if (!to || to.dimension !== from.dimension || to.id === from.id) return null;
    const result = from.dimension === "temperature"
      ? temperature(value, from.id, to.id)
      : value * UNITS[from.dimension][from.id] / UNITS[to.dimension][to.id];
    const name = (id) => SHOWN[id] || id;
    return { value: result, unit: to.id, text: `${format(value, lang)} ${name(from.id)} = ${format(result, lang)} ${name(to.id)}`, answer: format(result, lang) };
  }

  /* ── The time somewhere else ─────────────────────────────────── */
  // Cities by the names people use, where the zone is named after another.
  const PLACES = {
    nyc: "America/New_York", "new york": "America/New_York", "нью-йорк": "America/New_York", washington: "America/New_York", boston: "America/New_York", miami: "America/New_York",
    la: "America/Los_Angeles", "san francisco": "America/Los_Angeles", sf: "America/Los_Angeles", seattle: "America/Los_Angeles",
    beijing: "Asia/Shanghai", пекин: "Asia/Shanghai", delhi: "Asia/Kolkata", "new delhi": "Asia/Kolkata", mumbai: "Asia/Kolkata", bangalore: "Asia/Kolkata",
    kyiv: "Europe/Kyiv", kiev: "Europe/Kyiv", киев: "Europe/Kyiv", київ: "Europe/Kyiv",
    munich: "Europe/Berlin", frankfurt: "Europe/Berlin", hamburg: "Europe/Berlin", cologne: "Europe/Berlin", dortmund: "Europe/Berlin", düsseldorf: "Europe/Berlin", берлин: "Europe/Berlin",
    москва: "Europe/Moscow", "санкт-петербург": "Europe/Moscow", "st petersburg": "Europe/Moscow", petersburg: "Europe/Moscow",
    баку: "Asia/Baku", лондон: "Europe/London", париж: "Europe/Paris", токио: "Asia/Tokyo", стамбул: "Europe/Istanbul", istanbul: "Europe/Istanbul",
    дубай: "Asia/Dubai", тбилиси: "Asia/Tbilisi", алматы: "Asia/Almaty", ереван: "Asia/Yerevan", минск: "Europe/Minsk",
    utc: "UTC", gmt: "UTC", z: "UTC",
    est: "America/New_York", edt: "America/New_York", et: "America/New_York", cst: "America/Chicago", cdt: "America/Chicago", ct: "America/Chicago",
    mst: "America/Denver", pst: "America/Los_Angeles", pdt: "America/Los_Angeles", pt: "America/Los_Angeles",
    cet: "Europe/Berlin", cest: "Europe/Berlin", bst: "Europe/London", msk: "Europe/Moscow", ist: "Asia/Kolkata", jst: "Asia/Tokyo", kst: "Asia/Seoul", aest: "Australia/Sydney"
  };
  let zones = null;
  // A zone this engine knows: Kyiv was Kiev in older ones.
  const known = (zone) => {
    for (const name of zone === "Europe/Kyiv" ? [zone, "Europe/Kiev"] : [zone]) {
      try { new Intl.DateTimeFormat("en", { timeZone: name }); return name; } catch (error) { /* not this one */ }
    }
    return null;
  };
  function zoneOf(word) {
    const folded = String(word || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!folded) return null;
    if (PLACES[folded]) return known(PLACES[folded]);
    if (!zones) {
      zones = new Map();
      let all = [];
      try { all = Intl.supportedValuesOf("timeZone"); } catch (error) { /* an older engine: the places above only */ }
      for (const zone of all) {
        const city = zone.split("/").pop().replace(/_/g, " ").toLowerCase();
        if (!zones.has(city)) zones.set(city, zone);
      }
    }
    return zones.get(folded) || null;
  }
  const placeName = (zone, typed) => {
    const words = String(typed || "").trim();
    if (words.length > 3) return words.replace(/(^|[\s-])(\p{L})/gu, (all, gap, letter) => gap + letter.toUpperCase());
    return zone === "UTC" ? "UTC" : zone.split("/").pop().replace(/_/g, " ");
  };

  // How far ahead of UTC a zone's clock is at a moment, in minutes.
  function offsetOf(zone, at) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second) - at.getTime()) / 60000);
  }

  function clock(at, zone, lang, hour12) {
    return new Intl.DateTimeFormat(lang || undefined, { timeZone: zone, hour: "2-digit", minute: "2-digit", weekday: "short", ...(hour12 === undefined ? {} : { hour12 }) }).format(at);
  }
  function hoursApart(minutes, lang) {
    const hours = Math.round(minutes / 6) / 10;
    try { return new Intl.NumberFormat(lang || undefined, { style: "unit", unit: "hour", unitDisplay: "narrow", signDisplay: "exceptZero" }).format(hours); }
    catch (error) { return `${hours > 0 ? "+" : ""}${hours}h`; }
  }

  const TIME_WORDS = "time|now|время|сейчас|zeit|uhrzeit|hora|heure|saat|時間|时间";
  // An hour is "15:00", "3pm" or "3:30 pm": a bare number is too often a search.
  const HOUR = String.raw`(\d{1,2})(?:[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?|\s*(am|pm|a\.m\.|p\.m\.))`;

  /* "time in tokyo", "tokyo time", "15:00 tokyo" (there, and here), and
     "3pm london to new york". */
  function time(text, { now = new Date(), lang, hour12, here } = {}) {
    const typed = String(text || "").trim();
    const local = here || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let match = new RegExp(`^(?:(?:${TIME_WORDS})\\s+(?:in|at|в|во|in|en|à|a)?\\s*(.+?)|(.+?)\\s+(?:${TIME_WORDS}))\\s*\\??$`, "iu").exec(typed);
    if (match) {
      const words = match[1] || match[2];
      const zone = zoneOf(words);
      if (!zone) return null;
      const apart = offsetOf(zone, now) - offsetOf(local, now);
      return { zone, text: `${placeName(zone, words)}: ${clock(now, zone, lang, hour12)} (${hoursApart(apart, lang)})`, answer: clock(now, zone, lang, hour12) };
    }
    match = new RegExp(`^${HOUR}\\s+(.+?)(?:\\s+(?:${joinerPattern()})\\s+(.+?))?\\s*$`, "iu").exec(typed);
    if (!match) return null;
    const [, hh, mm = "0", halfAfterMinutes, halfAlone, fromWords, toWords] = match;
    const half = halfAfterMinutes || halfAlone;
    const from = zoneOf(fromWords);
    const to = toWords ? zoneOf(toWords) : local;
    if (!from || !to) return null;
    let hour = Number(hh);
    const minute = Number(mm);
    if (half) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (/^p/i.test(half) ? 12 : 0);
    }
    if (hour > 23 || minute > 59) return null;
    // That hour on today's date where it is, as a moment.
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: from, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
    const wall = Date.UTC(day[0], day[1] - 1, day[2], hour, minute);
    let at = new Date(wall - offsetOf(from, new Date(wall)) * 60000);
    at = new Date(wall - offsetOf(from, at) * 60000);
    const there = new Intl.DateTimeFormat(lang || undefined, { hour: "2-digit", minute: "2-digit", timeZone: from, ...(hour12 === undefined ? {} : { hour12 }) }).format(at);
    return { zone: to, text: `${there} ${placeName(from, fromWords)} = ${clock(at, to, lang, hour12)} ${placeName(to, toWords || "")}`, answer: clock(at, to, lang, hour12) };
  }

  /* ── Money ───────────────────────────────────────────────────── */
  const CODES = new Set(("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW").split(" "));
  const MONEY = {
    $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₽": "RUB", "₼": "AZN", "₺": "TRY", "₹": "INR", "₩": "KRW", "₴": "UAH", "₸": "KZT", "₾": "GEL", "zł": "PLN",
    dollar: "USD", dollars: "USD", bucks: "USD", доллар: "USD", доллара: "USD", долларов: "USD", долларах: "USD",
    euro: "EUR", euros: "EUR", евро: "EUR", pound: "GBP", pounds: "GBP", фунт: "GBP", фунтов: "GBP",
    yen: "JPY", иена: "JPY", иен: "JPY", yuan: "CNY", rmb: "CNY", юань: "CNY", юаней: "CNY",
    ruble: "RUB", rubles: "RUB", rouble: "RUB", roubles: "RUB", рубль: "RUB", рубля: "RUB", рублей: "RUB", рублях: "RUB", руб: "RUB",
    manat: "AZN", манат: "AZN", маната: "AZN", манатов: "AZN", lira: "TRY", лира: "TRY", лиры: "TRY", лир: "TRY",
    rupee: "INR", rupees: "INR", won: "KRW", hryvnia: "UAH", гривна: "UAH", гривны: "UAH", гривен: "UAH",
    franc: "CHF", francs: "CHF", франк: "CHF", франков: "CHF", zloty: "PLN", tenge: "KZT", тенге: "KZT", lari: "GEL", лари: "GEL"
  };
  function currencyOf(word) {
    const folded = String(word || "").trim().toLowerCase();
    if (MONEY[folded]) return MONEY[folded];
    const code = folded.toUpperCase();
    return /^[A-Z]{3}$/.test(code) && CODES.has(code) ? code : null;
  }

  // "100 usd to eur", "€20 in azn", "50 euro в рублях": the amount and both currencies.
  function money(text, lang) {
    const typed = String(text || "").trim();
    const match = new RegExp(`^(\\S*?)\\s*(${NUMBER})\\s*(\\S*?)\\s+(?:${joinerPattern()})\\s+(\\S+)$`, "iu").exec(typed);
    if (!match) return null;
    const [, before, digits, after, target] = match;
    if (before && after) return null;
    const amount = numberOf(digits, lang);
    const from = currencyOf(before || after);
    const to = currencyOf(target);
    if (amount === null || !from || !to || from === to) return null;
    return { amount, from, to };
  }

  /* With the rates of a day ({ base, rates: { CODE: per base }, date }), the
     amount in the other currency. */
  function exchange(query, table, lang) {
    if (!query || !table?.rates) return null;
    const { rates } = table;
    if (!rates[query.from] || !rates[query.to]) return null;
    const value = query.amount / rates[query.from] * rates[query.to];
    const cash = (amount, code) => {
      try { return new Intl.NumberFormat(lang || undefined, { style: "currency", currency: code, maximumFractionDigits: amount !== 0 && Math.abs(amount) < 1 ? 4 : 2 }).format(amount); }
      catch (error) { return `${format(amount, lang)} ${code}`; }
    };
    return { value, text: `${cash(query.amount, query.from)} = ${cash(value, query.to)}`, answer: format(Number(value.toFixed(Math.abs(value) < 1 ? 4 : 2)), lang) };
  }

  const api = { units, time, money, exchange, numberOf, unitOf, zoneOf, offsetOf, currencyOf, UNITS };
  if (typeof window !== "undefined") window.NordlysConvert = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
