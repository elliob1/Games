/* Tuteur IA : un chatbot par matière. Les réponses viennent de la fonction Netlify
   netlify/functions/chat.js (la clé API reste côté serveur). */
(function () {
  "use strict";
  var PZ = window.PZ, esc = PZ.esc, icon = PZ.icon, T = window.PZTools;

  var SUGGESTIONS = {
    maths: ["Explique-moi comment résoudre une équation du 2e degré", "C'est quoi une dérivée ?", "Aide-moi avec les fractions"],
    francais: ["Quand accorder le participe passé ?", "Comment faire un bon plan de dissertation ?", "Explique la différence entre « leur » et « leurs »"],
    anglais: ["Explain the difference between « make » and « do »", "Quand utiliser le present perfect ?", "Corrige ce texte : I goed to school yesterday"],
    physique: ["C'est quoi la différence entre vitesse et accélération ?", "Comment utiliser F = ma ?", "Explique la loi d'Ohm"],
    chimie: ["Comment équilibrer une équation chimique ?", "C'est quoi une mole ?", "Quelle est la différence entre un acide et une base ?"],
    biologie: ["Explique la mitose", "Comment fonctionne l'ADN ?", "C'est quoi la photosynthèse ?"],
    histoire: ["Résume la Révolution tranquille", "Pourquoi la Conquête de 1760 est-elle importante ?", "Explique la Confédération de 1867"],
    philo: ["Explique l'allégorie de la caverne", "Comment construire un bon argument ?", "C'est quoi l'éthique ?"],
    informatique: ["Explique une boucle for en Python", "Pourquoi j'ai l'erreur « undefined » ?", "C'est quoi une fonction ?"],
    libre: ["Fais-moi un horaire d'étude pour mon examen", "Comment mieux mémoriser ?", "Comment résumer un chapitre ?"]
  };

  /* Mise en forme simple et sûre : on échappe tout le HTML avant d'ajouter nos propres balises. */
  function md(src) {
    var parts = esc(src).split("```"), out = "";
    parts.forEach(function (seg, i) {
      if (i % 2 === 1) { out += "<pre><code>" + seg.replace(/^[\w+-]*\n/, "") + "</code></pre>"; return; }
      var blocks = [], cur = null;
      seg.split("\n").forEach(function (line) {
        var ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
        if (ul || ol) {
          var type = ul ? "ul" : "ol";
          if (!cur || cur.t !== type) { cur = { t: type, items: [] }; blocks.push(cur); }
          cur.items.push((ul || ol)[1]);
        } else if (!line.trim()) { cur = null; }
        else {
          if (!cur || cur.t !== "p") { cur = { t: "p", items: [] }; blocks.push(cur); }
          cur.items.push(line.replace(/^#{1,4}\s+(.*)$/, "**$1**"));
        }
      });
      out += blocks.map(function (b) {
        var inner = function (s) {
          return s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        };
        if (b.t === "p") return "<p>" + b.items.map(inner).join("<br>") + "</p>";
        return "<" + b.t + ">" + b.items.map(function (x) { return "<li>" + inner(x) + "</li>"; }).join("") + "</" + b.t + ">";
      }).join("");
    });
    return out;
  }

  function mount(el, subjectId) {
    var subjects = T.subjects;
    var subj = subjects.filter(function (s) { return s.id === subjectId; })[0] ||
      subjects.filter(function (s) { return s.id === PZ.store.get("pz:chat:last", "maths"); })[0] || subjects[0];
    PZ.store.set("pz:chat:last", subj.id);

    var key = "pz:chat:" + subj.id;
    var msgs = PZ.store.get(key, []);
    if (!Array.isArray(msgs)) msgs = [];
    var busy = false, aborter = null;

    el.innerHTML =
      '<div class="subjects" role="navigation" aria-label="Matières">' + subjects.map(function (s) {
        return '<a class="chip' + (s.id === subj.id ? " active" : "") + '" href="#/outils/chat/' + s.id + '"' +
          (s.id === subj.id ? ' aria-current="page"' : "") + ">" + s.emoji + " " + esc(s.name) + "</a>";
      }).join("") + "</div>" +
      '<div class="panel chat-box">' +
      '<div class="chat-head"><span class="emo">' + subj.emoji + "</span><div><b>Tuteur de " + esc(subj.name.toLowerCase()) +
      "</b><small>" + esc(subj.desc) + '</small></div><button class="btn ghost small" type="button" id="clear">' + icon("trash", 16) + " Effacer</button></div>" +
      '<div class="msgs" id="msgs" aria-live="polite"></div>' +
      '<div class="suggest" id="suggest"></div>' +
      '<form class="composer" id="composer"><textarea id="input" rows="1" maxlength="2000" placeholder="Pose ta question de ' +
      esc(subj.name.toLowerCase()) + '…" aria-label="Ta question"></textarea>' +
      '<button class="send" id="send" type="submit" aria-label="Envoyer">' + icon("send", 20) + "</button></form>" +
      '<p class="fine">L\'IA peut se tromper : vérifie avec ton cours avant de remettre un travail.</p></div>';

    var msgsEl = el.querySelector("#msgs"), sugEl = el.querySelector("#suggest"),
      input = el.querySelector("#input"), sendBtn = el.querySelector("#send");

    function bubble(role, html) {
      var d = document.createElement("div");
      d.className = "msg " + role;
      if (role === "me") d.textContent = html; else d.innerHTML = html;
      msgsEl.appendChild(d);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      return d;
    }

    function paint() {
      msgsEl.innerHTML = "";
      bubble("bot", "<p>Salut ! Je suis ton tuteur de " + esc(subj.name.toLowerCase()) +
        ". Pose-moi une question ou choisis une suggestion.</p>");
      msgs.forEach(function (m) { bubble(m.role === "user" ? "me" : "bot", m.role === "user" ? m.content : md(m.content)); });
      sugEl.innerHTML = "";
      if (!msgs.length) {
        (SUGGESTIONS[subj.id] || []).forEach(function (s) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "chip"; b.textContent = s;
          b.onclick = function () { send(s); };
          sugEl.appendChild(b);
        });
      }
    }

    function save() { PZ.store.set(key, msgs.slice(-30)); }

    function explain(status, data) {
      if (data && data.error === "no_key") return "Le tuteur IA n'est pas encore configuré : il manque la clé API sur le serveur (voir le README).";
      if (data && data.message) return data.message;
      if (status === 404 || status === 501) return "Le tuteur IA fonctionne seulement sur le site déployé sur Netlify (voir le README).";
      return "Le tuteur IA est indisponible pour le moment. Réessaie plus tard.";
    }

    function send(text) {
      text = (text || "").trim();
      if (!text || busy) return;
      busy = true; sendBtn.disabled = true;
      msgs.push({ role: "user", content: text });
      save(); paint();
      var wait = bubble("bot", '<span class="typing"><i></i><i></i><i></i></span>');

      var payload = msgs.slice(-16);
      while (payload.length && payload[0].role !== "user") payload.shift();
      var cfg = (window.SITE_CONFIG && window.SITE_CONFIG.chat) || {};
      aborter = new AbortController();
      var timer = setTimeout(function () { aborter.abort(); }, 45000);

      fetch(cfg.endpoint || "/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subj.id, messages: payload }),
        signal: aborter.signal
      }).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) { return { res: res, data: data }; });
      }).then(function (r) {
        if (r.res.ok && r.data && r.data.reply) {
          msgs.push({ role: "assistant", content: r.data.reply });
          save(); paint();
        } else {
          msgs.pop(); save(); paint();
          input.value = text;
          bubble("err", esc(explain(r.res.status, r.data)));
        }
      }).catch(function (e) {
        msgs.pop(); save(); paint();
        input.value = text;
        bubble("err", esc(e && e.name === "AbortError" ? "La réponse prend trop de temps. Réessaie." : "Impossible de joindre le tuteur IA. Vérifie ta connexion."));
      }).then(function () {
        clearTimeout(timer); busy = false; sendBtn.disabled = false; aborter = null;
        if (wait.parentNode) wait.parentNode.removeChild(wait);
        autosize();
      });
      input.value = ""; autosize();
    }

    function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; }

    el.querySelector("#composer").addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
    input.addEventListener("input", autosize);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
    });
    el.querySelector("#clear").addEventListener("click", function () {
      if (!msgs.length || confirm("Effacer cette conversation ?")) { msgs = []; save(); paint(); }
    });

    paint();
    return function () { if (aborter) aborter.abort(); };
  }

  T.register({ id: "chat", name: "Tuteur IA", desc: "Un chatbot pour chaque matière", icon: "bot", mount: mount });
})();
