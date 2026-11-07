/* Petits outils : minuteur Pomodoro, calculateur de moyenne, convertisseur d'unités, bloc-notes. */
(function () {
  "use strict";
  var PZ = window.PZ, T = window.PZTools, esc = PZ.esc, icon = PZ.icon;
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ================= Minuteur Pomodoro ================= */
  /* L'état est gardé hors de l'écran : le minuteur continue si tu changes d'onglet du site. */
  var MODES = { focus: { label: "Concentration", min: 25 }, court: { label: "Pause courte", min: 5 }, long: { label: "Pause longue", min: 15 } };
  var P = { mode: "focus", remaining: 25 * 60, running: false, endAt: 0, timer: null, done: 0, ui: null };
  var C = 2 * Math.PI * 100;

  function fmt(s) { return pad(Math.floor(s / 60)) + ":" + pad(s % 60); }
  function beep() {
    try {
      var A = window.AudioContext || window.webkitAudioContext, ctx = new A();
      [0, 0.35, 0.7].forEach(function (d) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.2, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.25);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.3);
      });
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
  function pomoPaint() {
    var total = MODES[P.mode].min * 60;
    if (P.ui) {
      P.ui.time.firstChild.nodeValue = fmt(P.remaining);
      P.ui.label.textContent = P.remaining === 0 ? "Terminé !" : MODES[P.mode].label;
      P.ui.bar.style.strokeDashoffset = String(C * (1 - P.remaining / total));
      P.ui.go.innerHTML = P.running ? icon("pause", 18) + " Pause" : icon("play", 18) + (P.remaining < total && P.remaining > 0 ? " Reprendre" : " Démarrer");
      P.ui.count.textContent = P.done + (P.done > 1 ? " sessions terminées" : " session terminée");
      Array.prototype.forEach.call(P.ui.segs, function (b) { b.classList.toggle("active", b.getAttribute("data-m") === P.mode); });
    }
    if (P.running) document.title = fmt(P.remaining) + " – " + MODES[P.mode].label;
    else PZ.restoreTitle();
  }
  function pomoStop() { P.running = false; clearInterval(P.timer); }
  function pomoTick() {
    P.remaining = Math.max(0, Math.round((P.endAt - Date.now()) / 1000));
    if (P.remaining === 0) { pomoStop(); if (P.mode === "focus") P.done++; beep(); }
    pomoPaint();
  }
  function pomoToggle() {
    if (P.running) { pomoStop(); pomoPaint(); return; }
    if (P.remaining === 0) P.remaining = MODES[P.mode].min * 60;
    P.endAt = Date.now() + P.remaining * 1000;
    P.running = true;
    P.timer = setInterval(pomoTick, 250);
    pomoPaint();
  }
  function pomoMode(m) { pomoStop(); P.mode = m; P.remaining = MODES[m].min * 60; pomoPaint(); }

  function mountPomo(el) {
    el.innerHTML =
      '<div class="panel pomo"><div class="segs" id="segs">' + Object.keys(MODES).map(function (m) {
        return '<button class="chip" type="button" data-m="' + m + '">' + esc(MODES[m].label) + " · " + MODES[m].min + " min</button>";
      }).join("") + "</div>" +
      '<div class="ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="track" cx="110" cy="110" r="100"/>' +
      '<circle class="bar" cx="110" cy="110" r="100" stroke-dasharray="' + C.toFixed(2) + '"/></svg>' +
      '<div class="ring-t" role="timer"><span id="t">00:00</span><small id="lbl"></small></div></div>' +
      '<div class="row-btns"><button class="btn primary" type="button" id="go"></button>' +
      '<button class="btn ghost" type="button" id="reset">' + icon("reload", 18) + " Recommencer</button></div>" +
      '<p class="hint" id="cnt"></p></div>';
    P.ui = {
      time: el.querySelector("#t"), label: el.querySelector("#lbl"), bar: el.querySelector(".bar"),
      go: el.querySelector("#go"), count: el.querySelector("#cnt"), segs: el.querySelectorAll("#segs .chip")
    };
    P.ui.go.onclick = pomoToggle;
    el.querySelector("#reset").onclick = function () { pomoMode(P.mode); };
    Array.prototype.forEach.call(P.ui.segs, function (b) { b.onclick = function () { pomoMode(b.getAttribute("data-m")); }; });
    pomoPaint();
    return function () { P.ui = null; };
  }

  /* ================= Calculateur de moyenne ================= */
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; }
  function fmtN(n) { return (Math.round(n * 100) / 100).toLocaleString("fr-CA"); }

  function mountGrades(el) {
    var rows = PZ.store.get("pz:grades", null);
    if (!Array.isArray(rows) || !rows.length) rows = [{ n: "Examen 1", g: "", w: "" }, { n: "Travail 1", g: "", w: "" }];
    var target = PZ.store.get("pz:grades:target", "");

    el.innerHTML =
      '<div class="panel split"><div><div class="grades" id="rows"></div>' +
      '<button class="btn ghost small" type="button" id="add">' + icon("plus", 16) + ' Ajouter une note</button></div>' +
      '<div><div class="result" id="avg"></div><div class="field" style="margin-top:16px"><span>Note visée pour le cours (%)</span>' +
      '<input class="input" id="target" inputmode="decimal" placeholder="ex. 75" value="' + esc(target) + '"></div>' +
      '<div class="result" id="need" style="margin-top:12px"></div>' +
      '<p class="hint">La pondération est le poids de chaque évaluation dans la note finale, en %.</p></div></div>';

    var rowsEl = el.querySelector("#rows"), avgEl = el.querySelector("#avg"), needEl = el.querySelector("#need");

    function drawRows() {
      rowsEl.innerHTML = '<div class="grade-row head"><span>Évaluation</span><span>Note (%)</span><span>Poids (%)</span><span></span></div>' +
        rows.map(function (r, i) {
          return '<div class="grade-row"><input class="input" data-i="' + i + '" data-k="n" value="' + esc(r.n) + '" aria-label="Nom">' +
            '<input class="input" data-i="' + i + '" data-k="g" inputmode="decimal" value="' + esc(r.g) + '" aria-label="Note en pourcentage">' +
            '<input class="input" data-i="' + i + '" data-k="w" inputmode="decimal" value="' + esc(r.w) + '" aria-label="Pondération en pourcentage">' +
            '<button class="x" type="button" data-del="' + i + '" aria-label="Supprimer">' + icon("close", 16) + "</button></div>";
        }).join("");
    }

    function compute() {
      var acquired = 0, weight = 0;
      rows.forEach(function (r) {
        var g = num(r.g), w = num(r.w);
        if (g !== null && w !== null && w > 0) { acquired += g * w / 100; weight += w; }
      });
      avgEl.innerHTML = weight > 0
        ? "<b>" + fmtN(acquired / weight * 100) + " %</b><p>Moyenne actuelle sur " + fmtN(weight) + " % de la note finale (" + fmtN(acquired) + " points acquis).</p>"
        : "<b>–</b><p>Entre au moins une note avec sa pondération.</p>";

      var t = num(target), left = 100 - weight;
      if (t === null) needEl.innerHTML = "<b>–</b><p>Entre la note que tu vises pour voir ce qu'il te faut.</p>";
      else if (weight <= 0) needEl.innerHTML = "<b>–</b><p>Ajoute d'abord tes notes déjà reçues.</p>";
      else if (left <= 0) needEl.innerHTML = "<b>" + fmtN(acquired) + " %</b><p>Toutes les évaluations sont entrées : ta note finale est de " + fmtN(acquired) + " %.</p>";
      else {
        var need = (t - acquired) * 100 / left;
        if (need <= 0) needEl.innerHTML = "<b>Objectif atteint</b><p>Même avec 0 % sur les " + fmtN(left) + " % restants, tu garderais au moins " + fmtN(acquired) + " %.</p>";
        else if (need > 100) needEl.innerHTML = "<b>Hors de portée</b><p>Même avec 100 % sur les " + fmtN(left) + " % restants, tu finirais à " + fmtN(acquired + left) + " % au maximum.</p>";
        else needEl.innerHTML = "<b>" + fmtN(need) + " %</b><p>C'est la note qu'il te faut sur les " + fmtN(left) + " % restants pour finir à " + fmtN(t) + " %.</p>";
      }
    }

    el.addEventListener("input", function (e) {
      var t = e.target;
      if (t.id === "target") { target = t.value; PZ.store.set("pz:grades:target", target); compute(); return; }
      var i = t.getAttribute("data-i");
      if (i === null) return;
      rows[+i][t.getAttribute("data-k")] = t.value;
      PZ.store.set("pz:grades", rows); compute();
    });
    el.addEventListener("click", function (e) {
      var d = e.target.closest("[data-del]");
      if (d) { rows.splice(+d.getAttribute("data-del"), 1); PZ.store.set("pz:grades", rows); drawRows(); compute(); return; }
      if (e.target.closest("#add")) {
        rows.push({ n: "Évaluation " + (rows.length + 1), g: "", w: "" });
        PZ.store.set("pz:grades", rows); drawRows(); compute();
      }
    });
    drawRows(); compute();
  }

  /* ================= Convertisseur d'unités ================= */
  var UNITS = {
    "Longueur": { base: "m", u: { "mm": 0.001, "cm": 0.01, "m": 1, "km": 1000, "pouce (po)": 0.0254, "pied (pi)": 0.3048, "verge (vg)": 0.9144, "mille (mi)": 1609.344 } },
    "Masse": { base: "kg", u: { "mg": 1e-6, "g": 0.001, "kg": 1, "tonne (t)": 1000, "once (oz)": 0.028349523125, "livre (lb)": 0.45359237 } },
    "Volume": { base: "L", u: { "mL": 0.001, "c. à thé (5 mL)": 0.005, "c. à soupe (15 mL)": 0.015, "tasse (250 mL)": 0.25, "L": 1, "m³": 1000, "gallon US": 3.785411784, "gallon impérial": 4.54609 } },
    "Vitesse": { base: "m/s", u: { "m/s": 1, "km/h": 1 / 3.6, "mi/h": 0.44704, "nœud": 0.5144444 } },
    "Temps": { base: "s", u: { "ms": 0.001, "s": 1, "min": 60, "h": 3600, "jour": 86400, "semaine": 604800 } },
    "Aire": { base: "m²", u: { "cm²": 1e-4, "m²": 1, "hectare (ha)": 1e4, "km²": 1e6, "pi²": 0.09290304, "acre": 4046.8564224 } },
    "Données": { base: "o", u: { "octet (o)": 1, "Ko": 1e3, "Mo": 1e6, "Go": 1e9, "To": 1e12 } },
    "Température": { temp: true, u: { "°C": 1, "°F": 1, "K": 1 } }
  };
  function toBase(cat, unit, v) {
    if (!UNITS[cat].temp) return v * UNITS[cat].u[unit];
    return unit === "°C" ? v : unit === "°F" ? (v - 32) * 5 / 9 : v - 273.15;
  }
  function fromBase(cat, unit, v) {
    if (!UNITS[cat].temp) return v / UNITS[cat].u[unit];
    return unit === "°C" ? v : unit === "°F" ? v * 9 / 5 + 32 : v + 273.15;
  }

  function mountConv(el) {
    var cats = Object.keys(UNITS);
    el.innerHTML =
      '<div class="panel conv"><label class="field"><span>Type de mesure</span><select class="input" id="cat">' +
      cats.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Valeur</span><input class="input" id="val" inputmode="decimal" value="1"></label>' +
      '<div class="conv-row"><label class="field"><span>De</span><select class="input" id="from"></select></label>' +
      '<button class="round" type="button" id="swap" aria-label="Inverser les unités">' + icon("swap", 20) + "</button>" +
      '<label class="field"><span>Vers</span><select class="input" id="to"></select></label></div>' +
      '<div class="result conv-out" id="out" aria-live="polite"></div></div>';

    var cat = el.querySelector("#cat"), val = el.querySelector("#val"), from = el.querySelector("#from"),
      to = el.querySelector("#to"), out = el.querySelector("#out");

    function fill() {
      var names = Object.keys(UNITS[cat.value].u);
      var opts = names.map(function (n) { return "<option>" + esc(n) + "</option>"; }).join("");
      from.innerHTML = opts; to.innerHTML = opts;
      from.selectedIndex = Math.min(2, names.length - 1);
      to.selectedIndex = Math.min(3, names.length - 1);
      if (UNITS[cat.value].temp) { from.selectedIndex = 0; to.selectedIndex = 1; }
      calc();
    }
    function show(n) { return Number(n.toPrecision(10)).toLocaleString("fr-CA", { maximumFractionDigits: 8 }); }
    function calc() {
      var v = parseFloat(String(val.value).replace(",", "."));
      if (!isFinite(v)) { out.innerHTML = "<small>Entre un nombre.</small>"; return; }
      var r = fromBase(cat.value, to.value, toBase(cat.value, from.value, v));
      out.innerHTML = show(r) + " " + esc(to.value) + "<small>" + show(v) + " " + esc(from.value) + " =</small>";
    }
    cat.onchange = fill;
    val.oninput = calc; from.onchange = calc; to.onchange = calc;
    el.querySelector("#swap").onclick = function () {
      var f = from.selectedIndex; from.selectedIndex = to.selectedIndex; to.selectedIndex = f; calc();
    };
    fill();
  }

  /* ================= Bloc-notes ================= */
  function mountNotes(el) {
    el.innerHTML =
      '<div class="panel notes"><textarea id="note" placeholder="Écris tes idées, tes formules, ta liste de choses à faire…" aria-label="Bloc-notes"></textarea>' +
      '<div class="notes-bar"><span id="stats"></span><span class="sp"></span>' +
      '<button class="btn ghost small" type="button" id="copy">' + icon("copy", 16) + " Copier</button>" +
      '<button class="btn ghost small" type="button" id="dl">' + icon("download", 16) + " Télécharger</button>" +
      '<button class="btn ghost small" type="button" id="wipe">' + icon("trash", 16) + " Effacer</button></div>" +
      '<p class="hint">Enregistré automatiquement dans ce navigateur seulement (pas sur un serveur).</p></div>';
    var ta = el.querySelector("#note"), stats = el.querySelector("#stats"), t;
    ta.value = PZ.store.get("pz:notes", "");
    function count() {
      var w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
      stats.textContent = w + (w > 1 ? " mots" : " mot") + " · " + ta.value.length + " caractères";
    }
    ta.addEventListener("input", function () {
      count(); clearTimeout(t); t = setTimeout(function () { PZ.store.set("pz:notes", ta.value); }, 300);
    });
    el.querySelector("#copy").onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(function () { PZ.toast("Copié !"); }, function () { PZ.toast("Copie impossible"); });
    };
    el.querySelector("#dl").onclick = function () {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ta.value], { type: "text/plain;charset=utf-8" }));
      a.download = "notes.txt"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    el.querySelector("#wipe").onclick = function () {
      if (!ta.value || confirm("Effacer tout le bloc-notes ?")) { ta.value = ""; PZ.store.set("pz:notes", ""); count(); }
    };
    count();
    return function () { clearTimeout(t); PZ.store.set("pz:notes", ta.value); };
  }

  T.register({ id: "minuteur", name: "Minuteur Pomodoro", desc: "Concentration 25 min, pause 5 min", icon: "timer", mount: mountPomo });
  T.register({ id: "moyenne", name: "Calculateur de moyenne", desc: "Notes pondérées et note visée à l'examen", icon: "percent", mount: mountGrades });
  T.register({ id: "convertisseur", name: "Convertisseur", desc: "Longueurs, masses, températures et plus", icon: "swap", mount: mountConv });
  T.register({ id: "notes", name: "Bloc-notes", desc: "Sauvegardé automatiquement dans ton navigateur", icon: "notes", mount: mountNotes });
})();
