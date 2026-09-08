/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - ARITHMETIC FOR THE SEARCH BOX
   ═══════════════════════════════════════════════════════════════════

   A small expression evaluator, written by hand because the alternative does
   not work here. The extension's content security policy is script-src 'self'
   with no 'unsafe-eval', which is the right policy for an extension page and
   also means new Function() and eval() throw. The previous calculator was built
   on new Function(); it passed every test in the HTTP fixture, where there is
   no CSP, and silently did nothing in the real extension. Typing 2+2 produced
   no answer, and the store listing promised one.

   Grammar, lowest precedence first:

     expression := term (('+' | '-') term)*
     term       := factor (('*' | '/' | 'x') factor | factor)*   implicit product
     factor     := ('-' | '+') factor | power                       sign is loosest
     power      := postfix ('^' factor)?                            right-assoc
     postfix    := primary ('%')*                                   percent → /100
     primary    := number | constant | name '(' expression (',' expression)* ')'
                 | '(' expression ')'

   "15% of 200" reads "of" as multiplication, so the percent grammar covers it.
   Only known names are accepted: an unknown word anywhere means the text is a
   search, not a sum, and the answer is null. A bare number is not a sum either
   — nobody typing 2025 wants to be told it equals 2025. */
(function () {
  "use strict";

  const FUNCTIONS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
    log: Math.log, ln: Math.log, log2: Math.log2, log10: Math.log10,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
    min: Math.min, max: Math.max
  };
  const CONSTANTS = { pi: Math.PI, e: Math.E };

  /* Splits the text into tokens, or returns null when a character or word has
     no meaning in arithmetic. Typographic operators are accepted as typed. */
  function tokenize(text) {
    const source = text
      .replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")
      .replace(/\s+of\s+/gi, " * ");
    const tokens = [];
    let at = 0;
    while (at < source.length) {
      const char = source[at];
      if (/\s/.test(char)) { at++; continue; }
      if (/[0-9.]/.test(char)) {
        const match = /^(\d+\.?\d*|\.\d+)/.exec(source.slice(at));
        if (!match || match[0] === ".") return null;
        tokens.push({ type: "number", value: Number(match[0]) });
        at += match[0].length;
        continue;
      }
      if (/[a-z]/i.test(char)) {
        /* "2x3" and "10x10": an x between a value and a digit or bracket is the
           multiplication sign people type, not the start of a word. */
        const previous = tokens[tokens.length - 1];
        const afterValue = previous && (previous.type === "number" || previous.type === "constant" || (previous.type === "op" && previous.value === ")"));
        if (/[xX]/.test(char) && afterValue && /[\d(.]/.test(source[at + 1] || "")) {
          tokens.push({ type: "op", value: "*" });
          at++;
          continue;
        }
        const match = /^[a-z][a-z0-9]*/i.exec(source.slice(at));
        const word = match[0].toLowerCase();
        /* "1e", "3e-2": a digit glued to an e is exponent notation, which this
           does not read — better no answer than 3·e−2 offered as one. */
        if (word === "e" && at > 0 && /\d/.test(source[at - 1])) return null;
        if (word === "x") tokens.push({ type: "op", value: "*" });
        else if (word in FUNCTIONS) tokens.push({ type: "function", value: word });
        else if (word in CONSTANTS) tokens.push({ type: "constant", value: word });
        else return null;
        at += match[0].length;
        continue;
      }
      if ("+-*/^%(),".includes(char)) {
        tokens.push({ type: "op", value: char });
        at++;
        continue;
      }
      return null;
    }
    return tokens;
  }

  /* A recursive-descent parser that evaluates as it goes. Any structural error
     throws; the caller turns that into null. */
  function evaluateTokens(tokens) {
    let position = 0;
    const peek = () => tokens[position];
    const take = () => tokens[position++];
    const isOp = (value) => peek() && peek().type === "op" && peek().value === value;
    const expect = (value) => { if (!isOp(value)) throw new SyntaxError(`expected ${value}`); take(); };

    function expression() {
      let left = term();
      while (isOp("+") || isOp("-")) {
        const operator = take().value;
        const right = term();
        left = operator === "+" ? left + right : left - right;
      }
      return left;
    }

    /* A factor that starts without an operator — 2(3+4), 2pi, (2)(3) — is an
       implicit product, the way it is written on paper. Two bare numbers side by
       side are not: "2 3" is a typo, not six. */
    const startsFactor = () => {
      const next = peek();
      if (!next) return false;
      if (next.type === "constant" || next.type === "function") return true;
      if (next.type === "op") return next.value === "(";
      const previous = tokens[position - 1];
      return next.type === "number" && previous?.type === "op" && previous.value === ")";
    };

    function term() {
      let left = factor();
      for (;;) {
        if (isOp("*") || isOp("/")) {
          const operator = take().value;
          const right = factor();
          left = operator === "*" ? left * right : left / right;
        } else if (startsFactor()) {
          left = left * factor();
        } else {
          return left;
        }
      }
    }

    function factor() {
      if (isOp("-")) { take(); return -factor(); }
      if (isOp("+")) { take(); return factor(); }
      return power();
    }

    /* The exponent is a factor, so it may carry its own sign: 2^-1. */
    function power() {
      const base = postfix();
      if (isOp("^")) { take(); return Math.pow(base, factor()); }
      return base;
    }

    function postfix() {
      let value = primary();
      while (isOp("%")) { take(); value = value / 100; }
      return value;
    }

    function primary() {
      const token = take();
      if (!token) throw new SyntaxError("unexpected end");
      if (token.type === "number") return token.value;
      if (token.type === "constant") return CONSTANTS[token.value];
      if (token.type === "function") {
        expect("(");
        const args = [expression()];
        while (isOp(",")) { take(); args.push(expression()); }
        expect(")");
        return FUNCTIONS[token.value](...args);
      }
      if (token.type === "op" && token.value === "(") {
        const inner = expression();
        expect(")");
        return inner;
      }
      throw new SyntaxError(`unexpected ${token.value}`);
    }

    const result = expression();
    if (position !== tokens.length) throw new SyntaxError("trailing input");
    return result;
  }

  /* True when the tokens describe a calculation rather than a number someone is
     searching for: there has to be something to do — an operator, a function
     call, or a percent sign. */
  function isCalculation(tokens) {
    const operates = tokens.some((token) =>
      token.type === "function" ||
      (token.type === "op" && "+-*/^%".includes(token.value)));
    // An implicit product — 2pi, (2)(3) — has no operator token but two values.
    const values = tokens.filter((token) => token.type === "number" || token.type === "constant").length;
    return operates || values >= 2;
  }

  /* Rounded the way a person would read it: ten decimals at most, and no
     0.30000000000000004. Very large results keep their magnitude and lose the
     digits nobody can check. */
  function tidy(value) {
    if (Math.abs(value) >= 1e12) return Number(value.toPrecision(12));
    return Math.round(value * 1e10) / 1e10;
  }

  /* The number the text works out to, or null when the text is not a sum. */
  function evaluate(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const tokens = tokenize(raw);
    if (!tokens || !tokens.length || !isCalculation(tokens)) return null;
    try {
      const value = evaluateTokens(tokens);
      return typeof value === "number" && Number.isFinite(value) ? tidy(value) : null;
    } catch (error) {
      return null;
    }
  }

  /* What the search box shows: the text as typed and its answer. */
  function describe(text) {
    const value = evaluate(text);
    return value === null ? null : `${String(text).trim()} = ${value}`;
  }

  const NordlysCalc = { evaluate, describe, tokenize };
  if (typeof window !== "undefined") window.NordlysCalc = NordlysCalc;
  if (typeof module === "object" && module.exports) module.exports = NordlysCalc;
})();
