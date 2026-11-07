/* Moteur de calcul sécurisé (aucun eval) — utilisé par la calculatrice.
   Syntaxe : + - × ÷ * / ^ ! %  ( )  π e ans  sin cos tan asin acos atan ln log sqrt √ cbrt abs exp
   Multiplication implicite : 2π, 3(4+5), 2sin(30). */
(function (root) {
  "use strict";

  var FUNCS = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, ln: 1, log: 1, sqrt: 1, cbrt: 1, abs: 1, exp: 1 };
  var CONSTS = { pi: Math.PI, e: Math.E };

  function fail(msg) { throw new Error(msg); }

  function tokenize(src, ans) {
    var s = String(src)
      .replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")
      .replace(/,/g, ".").replace(/\s+/g, "");
    var out = [], i = 0, m;
    while (i < s.length) {
      var rest = s.slice(i), c = s[i];
      if ((m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(rest))) {
        out.push({ t: "num", v: parseFloat(m[0]) }); i += m[0].length;
      } else if (c === "π") { out.push({ t: "num", v: Math.PI }); i++;
      } else if (c === "√") { out.push({ t: "func", v: "sqrt" }); i++;
      } else if ((m = /^[a-zA-Z]+/.exec(rest))) {
        var w = m[0].toLowerCase();
        if (w === "ans") out.push({ t: "num", v: ans });
        else if (CONSTS.hasOwnProperty(w)) out.push({ t: "num", v: CONSTS[w] });
        else if (FUNCS.hasOwnProperty(w)) out.push({ t: "func", v: w });
        else fail("Fonction inconnue : " + m[0]);
        i += m[0].length;
      } else if ("+-*/^!%()".indexOf(c) !== -1) { out.push({ t: "op", v: c }); i++;
      } else fail("Caractère non valide : " + c);
    }
    return out;
  }

  function factorial(n) {
    if (n < 0 || Math.floor(n) !== n || n > 170) fail("Factorielle impossible");
    var r = 1;
    for (var k = 2; k <= n; k++) r *= k;
    return r;
  }

  function evaluate(src, opts) {
    opts = opts || {};
    var deg = opts.angle !== "rad";
    var tokens = tokenize(src, opts.ans || 0), pos = 0;
    if (!tokens.length) fail("Expression vide");

    function peek() { return tokens[pos]; }
    function isOp(t, v) { return t && t.t === "op" && t.v === v; }
    function startsValue(t) { return t && (t.t === "num" || t.t === "func" || isOp(t, "(")); }
    function toRad(x) { return deg ? x * Math.PI / 180 : x; }
    function fromRad(x) { return deg ? x * 180 / Math.PI : x; }
    function clean(v) { return Math.abs(v) < 1e-12 ? 0 : v; }

    function applyFunc(name, x) {
      switch (name) {
        case "sin": return clean(Math.sin(toRad(x)));
        case "cos": return clean(Math.cos(toRad(x)));
        case "tan":
          if (deg && ((x % 180) + 180) % 180 === 90) fail("Tangente indéfinie");
          return clean(Math.tan(toRad(x)));
        case "asin": if (x < -1 || x > 1) fail("Hors domaine"); return fromRad(Math.asin(x));
        case "acos": if (x < -1 || x > 1) fail("Hors domaine"); return fromRad(Math.acos(x));
        case "atan": return fromRad(Math.atan(x));
        case "ln": if (x <= 0) fail("Hors domaine"); return Math.log(x);
        case "log": if (x <= 0) fail("Hors domaine"); return clean(Math.log10(x));
        case "sqrt": if (x < 0) fail("Racine d'un négatif"); return Math.sqrt(x);
        case "cbrt": return Math.cbrt(x);
        case "abs": return Math.abs(x);
        case "exp": return Math.exp(x);
      }
      fail("Fonction inconnue");
    }

    function expectClose() {
      if (pos >= tokens.length) return; /* parenthèses non fermées en fin d'expression : tolérées */
      if (isOp(peek(), ")")) { pos++; return; }
      fail("Parenthèse manquante");
    }

    function parseExpr() {
      var v = parseTerm();
      while (isOp(peek(), "+") || isOp(peek(), "-")) {
        var op = tokens[pos++].v, r = parseTerm();
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }
    function parseTerm() {
      var v = parseUnary();
      for (;;) {
        var t = peek();
        if (isOp(t, "*")) { pos++; v *= parseUnary(); }
        else if (isOp(t, "/")) { pos++; var d = parseUnary(); if (d === 0) fail("Division par zéro"); v /= d; }
        else if (startsValue(t)) { v *= parseUnary(); }
        else break;
      }
      return v;
    }
    function parseUnary() {
      if (isOp(peek(), "-")) { pos++; return -parseUnary(); }
      if (isOp(peek(), "+")) { pos++; return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      var base = parsePostfix();
      if (isOp(peek(), "^")) { pos++; return Math.pow(base, parseUnary()); }
      return base;
    }
    function parsePostfix() {
      var v = parsePrimary();
      for (;;) {
        if (isOp(peek(), "!")) { pos++; v = factorial(v); }
        else if (isOp(peek(), "%")) { pos++; v = v / 100; }
        else break;
      }
      return v;
    }
    function parsePrimary() {
      var t = tokens[pos++];
      if (!t) fail("Expression incomplète");
      if (t.t === "num") return t.v;
      if (t.t === "func") {
        var arg;
        if (isOp(peek(), "(")) { pos++; arg = parseExpr(); expectClose(); }
        else if (peek() && (peek().t === "num" || peek().t === "func" || isOp(peek(), "-"))) arg = parseUnaryArg();
        else fail("Expression incomplète");
        return applyFunc(t.v, arg);
      }
      if (isOp(t, "(")) { var v = parseExpr(); expectClose(); return v; }
      fail("Syntaxe invalide");
    }
    function parseUnaryArg() {
      if (isOp(peek(), "-")) { pos++; return -parseUnaryArg(); }
      return parsePostfix();
    }

    var result = parseExpr();
    if (pos < tokens.length) fail("Syntaxe invalide");
    if (!isFinite(result)) fail("Résultat trop grand");
    return result;
  }

  function format(n, comma) {
    if (n === 0) return "0";
    var a = Math.abs(n), s;
    if (a >= 1e15 || a < 1e-9) s = n.toExponential(8).replace(/\.?0+e/, "e").replace("e+", "e");
    else s = String(parseFloat(n.toPrecision(12)));
    return comma === false ? s : s.replace(".", ",");
  }

  var api = { evaluate: evaluate, format: format };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CalcEngine = api;
})(typeof window !== "undefined" ? window : this);
