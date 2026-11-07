/* Onglet Outils : registre des outils + page d'accueil des outils.
   Pour ajouter un outil : crée js/tool-monoutil.js avec
     PZTools.register({ id, name, desc, icon, mount: function (el, arg) { ...; return function cleanup() {} } });
   puis ajoute le <script> dans index.html (avant js/app.js) et l'id dans ORDER ci-dessous. */
(function () {
  "use strict";
  var PZ = window.PZ, icon = PZ.icon, esc = PZ.esc;

  var SUBJECTS = [
    { id: "maths", name: "Maths", emoji: "🧮", desc: "Algèbre, fonctions, géométrie, calcul" },
    { id: "francais", name: "Français", emoji: "📖", desc: "Grammaire, orthographe, rédaction" },
    { id: "anglais", name: "Anglais", emoji: "🇬🇧", desc: "Vocabulaire, grammaire, corrections" },
    { id: "physique", name: "Physique", emoji: "⚡", desc: "Mouvement, énergie, électricité" },
    { id: "chimie", name: "Chimie", emoji: "🧪", desc: "Réactions, moles, solutions" },
    { id: "biologie", name: "Biologie", emoji: "🧬", desc: "Cellule, génétique, corps humain" },
    { id: "histoire", name: "Histoire", emoji: "🏛️", desc: "Québec, Canada, monde" },
    { id: "philo", name: "Philo", emoji: "💭", desc: "Idées, arguments, éthique" },
    { id: "informatique", name: "Informatique", emoji: "💻", desc: "Code, logique, erreurs" },
    { id: "libre", name: "Méthode", emoji: "🎒", desc: "Étudier, résumer, s'organiser" }
  ];

  var ORDER = ["chat", "calc", "minuteur", "moyenne", "convertisseur", "notes"];
  var tools = {};
  var cleanup = null;

  function register(t) { tools[t.id] = t; }

  function unmount() {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  }

  function hub(el) {
    var subj = SUBJECTS.map(function (s) {
      return '<a class="tcard" href="#/outils/chat/' + s.id + '"><span class="ico">' + s.emoji + '</span><div><b>' +
        esc(s.name) + '</b><span class="d">' + esc(s.desc) + "</span></div></a>";
    }).join("");
    var others = ORDER.filter(function (id) { return id !== "chat" && tools[id]; }).map(function (id) {
      var t = tools[id];
      return '<a class="tcard" href="#/outils/' + t.id + '"><span class="ico">' + icon(t.icon, 26) + '</span><div><b>' +
        esc(t.name) + '</b><span class="d">' + esc(t.desc) + "</span></div></a>";
    }).join("");
    el.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Outils</h1><p class="sub">Tout pour étudier, au même endroit.</p></div></div>' +
      '<h2 class="section-title">Tuteur IA par matière</h2><div class="cards">' + subj + "</div>" +
      '<h2 class="section-title">Outils</h2><div class="cards">' + others + "</div>" +
      '<div class="ad-slot" data-ad="bottom"></div>';
  }

  /* Affiche un outil (ou la page d'accueil des outils). Retourne le titre de la page. */
  function render(el, parts) {
    unmount();
    var id = parts && parts[0];
    var t = id && tools[id];
    if (!t) { hub(el); return "Outils"; }
    el.innerHTML =
      '<div class="tool-head"><a class="back" href="#/outils">' + icon(back(), 18) + ' Outils</a>' +
      '<h1 class="page-title">' + icon(t.icon, 32) + " " + esc(t.name) + '</h1><p class="sub">' + esc(t.desc) + "</p></div>" +
      '<div class="tool-body"></div>';
    cleanup = t.mount(el.querySelector(".tool-body"), parts[1]) || null;
    return t.name;
  }
  function back() { return "back"; }

  window.PZTools = { register: register, render: render, unmount: unmount, subjects: SUBJECTS, tools: tools, order: ORDER };
})();
