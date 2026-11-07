/* Calculatrice scientifique (clavier + historique). Utilise js/calc-engine.js (pas de eval). */
(function () {
  "use strict";
  var PZ = window.PZ, CE = window.CalcEngine, esc = PZ.esc;

  var SCI = [
    ["sin", "sin("], ["cos", "cos("], ["tan", "tan("], ["π", "π"], ["e", "e"],
    ["ln", "ln("], ["log", "log("], ["√", "√("], ["x²", "^2"], ["xʸ", "^"],
    ["(", "("], [")", ")"], ["n!", "!"], ["%", "%"], ["Ans", "ans"]
  ];
  var BASIC = [
    ["AC", "clear", "fn"], ["⌫", "back", "fn"], ["÷", "÷", "op"], ["×", "×", "op"],
    ["7"], ["8"], ["9"], ["−", "−", "op"],
    ["4"], ["5"], ["6"], ["+", "+", "op"],
    ["1"], ["2"], ["3"], ["=", "=", "eq"],
    ["0", "0", "zero"], [",", ","]
  ];
  var CONTINUE = /^[÷×−+^!%]$|^\^2$/;

  function mount(el) {
    var expr = "", ans = 0, angle = "deg", justEval = false, history = [];

    el.innerHTML =
      '<div class="calc-wrap"><div class="panel calc">' +
      '<div class="calc-screen"><div class="calc-top"><button class="angle" type="button" id="angle" aria-label="Changer entre degrés et radians">DEG</button></div>' +
      '<div class="calc-expr blank" id="expr" aria-live="polite">0</div><div class="calc-res" id="res"></div></div>' +
      '<div class="keys sci">' + SCI.map(function (k) {
        return '<button class="key sci-k" type="button" data-k="' + esc(k[1]) + '">' + esc(k[0]) + "</button>";
      }).join("") + "</div>" +
      '<div class="keys basic">' + BASIC.map(function (k) {
        return '<button class="key ' + (k[2] || "") + '" type="button" data-k="' + esc(k[1] || k[0]) + '">' + esc(k[0]) + "</button>";
      }).join("") + "</div></div>" +
      '<div class="hist"><h3>Historique</h3><ul id="hist"></ul><p class="hint">Astuce : tu peux aussi utiliser le clavier (chiffres, + − * / ^ ( ), Entrée, Retour arrière, Échap).</p></div></div>';

    var exprEl = el.querySelector("#expr"), resEl = el.querySelector("#res"),
      histEl = el.querySelector("#hist"), angleEl = el.querySelector("#angle");

    function opts() { return { angle: angle, ans: ans }; }

    function paint() {
      exprEl.textContent = expr || "0";
      exprEl.classList.toggle("blank", !expr);
      resEl.classList.remove("err");
      var p = "";
      if (expr && !justEval) { try { p = "= " + CE.format(CE.evaluate(expr, opts())); } catch (e) { p = ""; } }
      resEl.textContent = p;
      exprEl.scrollLeft = exprEl.scrollWidth;
    }

    function paintHistory() {
      histEl.innerHTML = history.length ? history.map(function (h, i) {
        return '<li><button type="button" data-h="' + i + '"><small>' + esc(h.e) + "</small><b>" + esc(h.r) + "</b></button></li>";
      }).join("") : '<li class="hint">Tes calculs apparaîtront ici.</li>';
    }

    function press(v) {
      if (v === "clear") { expr = ""; justEval = false; }
      else if (v === "back") {
        if (justEval) { expr = ""; justEval = false; }
        else {
          /* retire une fonction entière ("sin(") d'un coup, sinon un seul caractère */
          var stripped = expr.replace(/(?:sin|cos|tan|asin|acos|atan|ln|log|√)\($/, "");
          expr = stripped.length !== expr.length ? stripped : expr.slice(0, -1);
        }
      } else if (v === "=") {
        if (!expr) return;
        try {
          var r = CE.evaluate(expr, opts()), f = CE.format(r);
          history.unshift({ e: expr, r: f });
          history = history.slice(0, 12);
          ans = r; expr = f; justEval = true;
          paintHistory();
        } catch (e) {
          resEl.textContent = e.message; resEl.classList.add("err");
          return;
        }
      } else {
        if (justEval) { if (!CONTINUE.test(v)) expr = ""; justEval = false; }
        expr += v;
      }
      paint();
    }

    function onClick(e) {
      var b = e.target.closest("button[data-k]");
      if (b) { press(b.getAttribute("data-k")); return; }
      var h = e.target.closest("button[data-h]");
      if (h) { expr = history[+h.getAttribute("data-h")].e; justEval = false; paint(); }
    }
    el.addEventListener("click", onClick);
    angleEl.addEventListener("click", function () {
      angle = angle === "deg" ? "rad" : "deg";
      angleEl.textContent = angle.toUpperCase();
      paint();
    });

    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var el = e.target, t = el && el.tagName;
      if (t === "TEXTAREA" || t === "SELECT" || (t === "INPUT" && el.type !== "checkbox" && el.type !== "button")) return;
      var k = e.key, map = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", "(": "(", ")": ")", "!": "!", "%": "%", ".": ",", ",": "," };
      if (/^[0-9]$/.test(k)) press(k);
      else if (map[k]) press(map[k]);
      else if (k === "Enter" || k === "=") press("=");
      else if (k === "Backspace") press("back");
      else if (k === "Escape" || k === "Delete") press("clear");
      else return;
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);

    paintHistory();
    paint();
    return function () { document.removeEventListener("keydown", onKey); };
  }

  window.PZTools.register({
    id: "calc", name: "Calculatrice", desc: "Scientifique, avec clavier et historique", icon: "calc", mount: mount
  });
})();
