/* PlayZone v2 — navigation, accueil, liste des jeux, lecteur. */
(function () {
  "use strict";
  var PZ = window.PZ, icon = PZ.icon, esc = PZ.esc, T = window.PZTools;
  var $ = function (id) { return document.getElementById(id); };
  var SITE = (window.SITE_CONFIG && window.SITE_CONFIG.siteName) || "PlayZone";

  /* data/games.json contient plus de catégories que l'ancienne interface n'en affichait :
     on les regroupe ici pour que chaque jeu apparaisse dans une catégorie. */
  var GROUPS = [
    { id: "action", label: "Action", emoji: "💥" },
    { id: "arcade", label: "Arcade", emoji: "🕹️" },
    { id: "puzzle", label: "Puzzle", emoji: "🧩" },
    { id: "skill", label: "Adresse", emoji: "🎯" },
    { id: "adventure", label: "Aventure", emoji: "🧭" },
    { id: "racing", label: "Course", emoji: "🏁" },
    { id: "sports", label: "Sports", emoji: "⚽" },
    { id: "horror", label: "Horreur", emoji: "👻" },
    { id: "board", label: "Plateau et cartes", emoji: "♟️" },
    { id: "strategy", label: "Stratégie", emoji: "🏰" },
    { id: "casual", label: "Détente", emoji: "🍪" },
    { id: "multi", label: "Multijoueur", emoji: "🌐" },
    { id: "other", label: "Autres", emoji: "✨" }
  ];
  var MAP = {
    action: "action", tir: "action", arcade: "arcade", rythme: "arcade", puzzle: "puzzle", skill: "skill",
    adventure: "adventure", plateforme: "adventure", racing: "racing", driving: "racing", moto: "racing", voiture: "racing",
    sports: "sports", horror: "horror", board: "board", casino: "board", strategy: "strategy", "stratégie": "strategy",
    casual: "casual", idle: "casual", clicker: "casual", multiplayer: "multi", io: "multi"
  };
  var SPECIAL = [
    { id: "tous", label: "Tous" },
    { id: "populaires", label: "Populaires 🔥" },
    { id: "nouveaux", label: "Nouveaux" },
    { id: "favoris", label: "Favoris" }
  ];

  var games = [], byId = {}, loaded = false, loadError = false;
  var favs = PZ.store.get("pz:favs", []);
  if (!Array.isArray(favs)) favs = [];
  var query = "", focusSearch = false;
  var view = $("view"), current = null, currentKey = "", pageTitle = SITE + " – Jeux en ligne gratuits";
  var lastRoute = { name: "home" };

  function isFav(id) { return favs.indexOf(id) !== -1; }
  function groupLabel(id) { var g = GROUPS.filter(function (x) { return x.id === id; })[0]; return g ? g.label : id; }

  /* ---------- Thème ---------- */
  var THEMES = [
    { id: "rose", name: "Rose néon", c: "#ff3d8b" }, { id: "violet", name: "Violet", c: "#a78bfa" },
    { id: "bleu", name: "Bleu", c: "#4da3ff" }, { id: "vert", name: "Vert", c: "#3ee08f" }, { id: "orange", name: "Orange", c: "#ff9a3d" }
  ];
  var theme = PZ.store.get("pz:theme", null) || { color: "rose", motion: true };
  function applyTheme() {
    document.documentElement.dataset.theme = theme.color;
    document.documentElement.dataset.motion = theme.motion === false ? "off" : "on";
    PZ.store.set("pz:theme", theme);
  }
  function buildThemePop() {
    var pop = $("theme-pop");
    pop.innerHTML = '<h3>Thème</h3><div class="swatches">' + THEMES.map(function (t) {
      return '<button class="swatch" type="button" style="--c:' + t.c + '" data-theme="' + t.id + '" aria-label="' + esc(t.name) +
        '" aria-pressed="' + (t.id === theme.color) + '"></button>';
    }).join("") + '</div><label class="switch"><span>Fond animé</span><input type="checkbox" id="motion"' +
      (theme.motion === false ? "" : " checked") + "></label>";
  }

  /* ---------- Navigation ---------- */
  var NAV = [
    { id: "home", label: "Accueil", icon: "home", href: "#/" },
    { id: "games", label: "Jeux", icon: "gamepad", href: "#/jeux" },
    { id: "tools", label: "Outils", icon: "grid", href: "#/outils" },
    { id: "tutor", label: "Tuteur IA", icon: "bot", href: "#/outils/chat" },
    { id: "favs", label: "Favoris", icon: "heart", href: "#/jeux/favoris" }
  ];
  function buildNav() {
    $("nav").innerHTML =
      '<a class="nav-logo" href="#/" aria-label="' + esc(SITE) + ' – accueil">' + icon("play", 20) + "</a>" +
      '<span class="nav-sep"></span><nav class="nav-items" aria-label="Navigation principale">' + NAV.map(function (n) {
        return '<a class="nav-item" data-nav="' + n.id + '" href="' + n.href + '" title="' + esc(n.label) + '">' + icon(n.icon, 20) + "<span>" + esc(n.label) + "</span></a>";
      }).join("") + '</nav><span class="nav-sep"></span>' +
      '<button class="nav-item nav-tool" id="theme-btn" type="button" aria-label="Changer le thème" aria-expanded="false" title="Thème">' + icon("palette", 20) + "</button>";
    $("theme-btn").onclick = function (e) {
      e.stopPropagation();
      var pop = $("theme-pop"), open = pop.hidden;
      pop.hidden = !open; this.setAttribute("aria-expanded", String(open));
    };
  }
  function setActiveNav(route) {
    var id = "home";
    if (route.name === "games") id = route.cat === "favoris" ? "favs" : "games";
    else if (route.name === "tools") id = route.parts[0] === "chat" ? "tutor" : "tools";
    Array.prototype.forEach.call(document.querySelectorAll(".nav-item[data-nav]"), function (a) {
      var on = a.getAttribute("data-nav") === id;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  /* ---------- Tuiles ---------- */
  function tileHTML(g) {
    var th = g.thumb || {};
    var emo = th.emoji || "🎮";
    var art = th.img ? '<img src="' + esc(th.img) + '" alt="" loading="lazy" data-e="' + esc(emo) + '" onerror="this.parentNode.textContent=this.dataset.e">' : esc(emo);
    var badge = g.new ? '<span class="tile-badge">Nouveau</span>' : (g.popular ? '<span class="tile-badge">🔥</span>' : "");
    var fav = isFav(g.id);
    return '<div class="tile" style="--bg-art:' + esc(th.bg || "linear-gradient(135deg,#8b5cf6,#22d3ee)") + '">' +
      '<a class="tile-link" href="#play=' + encodeURIComponent(g.id) + '" aria-label="Jouer à ' + esc(g.title) + '">' +
      '<span class="tile-art">' + art + '</span><span class="tile-name">' + esc(g.title) + "</span></a>" + badge +
      '<button class="fav" type="button" data-fav="' + esc(g.id) + '" aria-pressed="' + fav + '" aria-label="' +
      (fav ? "Retirer " : "Ajouter ") + esc(g.title) + (fav ? " des favoris" : " aux favoris") + '">' + icon("heart", 18) + "</button></div>";
  }
  function rowHTML(title, list, href) {
    if (!list.length) return "";
    return '<section class="row"><div class="row-head"><h2>' + esc(title) + '</h2><div class="row-ctl">' +
      '<a class="more" href="' + href + '">Tout voir</a>' +
      '<button class="round" type="button" data-scroll="-1" aria-label="Précédent">‹</button>' +
      '<button class="round" type="button" data-scroll="1" aria-label="Suivant">›</button></div></div>' +
      '<div class="scroller">' + list.map(tileHTML).join("") + "</div></section>";
  }
  function footerHTML() {
    return '<div class="ad-slot" data-ad="bottom"></div><footer class="footer">© ' + new Date().getFullYear() + " " + esc(SITE) +
      ' · <a href="privacy.html">Politique de confidentialité</a></footer>';
  }

  /* ---------- Filtres ---------- */
  function matches(g, cat) {
    if (cat === "tous") return true;
    if (cat === "populaires") return !!g.popular;
    if (cat === "nouveaux") return !!g.new;
    if (cat === "favoris") return isFav(g.id);
    return g.group === cat;
  }
  function filtered(cat) {
    var q = query.trim().toLowerCase();
    return games.filter(function (g) {
      return matches(g, cat) && (!q || (g.title + " " + (g.tags || []).join(" ")).toLowerCase().indexOf(q) !== -1);
    });
  }
  function seeded(list, seed) { /* mélange stable pendant une journée */
    var a = list.slice(), s = seed;
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      var j = Math.floor(s / 233280 * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Vues ---------- */
  function renderHome() {
    var day = Math.floor(Date.now() / 864e5);
    var popular = seeded(games.filter(function (g) { return g.popular; }), day).slice(0, 18);
    var fresh = games.filter(function (g) { return g.new; }).slice(0, 18);
    var mine = games.filter(function (g) { return isFav(g.id); });
    view.innerHTML =
      '<div class="ad-slot" data-ad="top"></div>' +
      '<section class="hero"><h1 class="wordmark">' + esc(SITE.toLowerCase()) + "</h1>" +
      '<p class="tagline">Des jeux et des outils pour la pause et pour les études.</p>' +
      '<form class="searchbar" id="hs" role="search">' + icon("search", 20) +
      '<input id="hq" type="search" autocomplete="off" placeholder="Rechercher parmi ' + games.length + ' jeux…" aria-label="Rechercher un jeu"><kbd>/</kbd></form>' +
      '<div class="shortcuts">' + [
        ["#/jeux", "gamepad", "Jeux"], ["#/jeux/populaires", "dice", "Populaires"], ["#/outils/chat", "bot", "Tuteur IA"],
        ["#/outils/calc", "calc", "Calculatrice"], ["#/outils/minuteur", "timer", "Minuteur"], ["#/jeux/favoris", "heart", "Favoris"]
      ].map(function (s) {
        return '<a class="shortcut" href="' + s[0] + '"><span class="ico">' + icon(s[1], 24) + "</span>" + s[2] + "</a>";
      }).join("") + "</div></section>" +
      '<section class="widgets"><div class="glass"><div class="clock-time" id="c-time">--:--</div><div class="clock-date" id="c-date"></div>' +
      '<div class="meta-line" id="c-batt" hidden>' + icon("battery", 18) + '<span></span></div>' +
      '<div class="meta-line">' + icon("gamepad", 18) + "<span>" + games.length + " jeux disponibles</span></div></div>" +
      '<div class="glass dice-card"><div><h2>Pas d\'idée ?</h2><p>Laisse le hasard choisir ton prochain jeu.</p></div>' +
      '<button class="btn primary" type="button" data-random>' + icon("dice", 20) + " Jeu au hasard</button></div></section>" +
      rowHTML("Tes favoris", mine, "#/jeux/favoris") +
      rowHTML("Populaires", popular, "#/jeux/populaires") +
      rowHTML("Nouveautés", fresh, "#/jeux/nouveaux") +
      footerHTML();
    var hq = $("hq");
    $("hs").addEventListener("submit", function (e) { e.preventDefault(); if (hq.value.trim()) goSearch(hq.value); });
    hq.addEventListener("input", function () { goSearch(hq.value); });
    updateClock();
  }
  function goSearch(v) { query = v; focusSearch = true; location.hash = "#/jeux"; }

  function chipsHTML(active) {
    var counts = {};
    games.forEach(function (g) { counts[g.group] = (counts[g.group] || 0) + 1; });
    var items = SPECIAL.map(function (s) {
      var n = games.filter(function (g) { return matches(g, s.id); }).length;
      return { id: s.id, label: s.label, n: n };
    }).concat(GROUPS.filter(function (g) { return counts[g.id]; }).map(function (g) {
      return { id: g.id, label: g.emoji + " " + g.label, n: counts[g.id] };
    }));
    return items.map(function (c) {
      return '<a class="chip' + (c.id === active ? " active" : "") + '" href="#/jeux' + (c.id === "tous" ? "" : "/" + c.id) + '"' +
        (c.id === active ? ' aria-current="page"' : "") + ">" + esc(c.label) + ' <span class="n">' + c.n + "</span></a>";
    }).join("");
  }

  function renderGames(cat) {
    var title = "Jeux";
    var s = SPECIAL.filter(function (x) { return x.id === cat; })[0];
    if (cat !== "tous") title = s ? s.label.replace(" 🔥", "") : groupLabel(cat);
    view.innerHTML =
      '<div class="ad-slot" data-ad="top"></div>' +
      '<div class="page-head"><h1 class="page-title">' + esc(title) + ' <small id="cnt"></small></h1>' +
      '<label class="searchbar compact">' + icon("search", 18) + '<input id="q" type="search" autocomplete="off" placeholder="Rechercher un jeu…" aria-label="Rechercher un jeu" value="' + esc(query) + '"></label></div>' +
      '<div class="chips" id="chips" role="navigation" aria-label="Catégories">' + chipsHTML(cat) + "</div>" +
      '<div class="grid" id="grid"></div><p class="empty" id="empty" hidden></p>' + footerHTML();
    var q = $("q");
    function draw() {
      var list = filtered(cat);
      $("grid").innerHTML = list.map(tileHTML).join("");
      $("cnt").textContent = "(" + list.length + ")";
      var em = $("empty");
      em.hidden = list.length > 0;
      em.textContent = cat === "favoris" && !query.trim()
        ? "Aucun favori pour l'instant. Appuie sur le cœur d'un jeu pour l'ajouter ici."
        : "Aucun jeu trouvé. Essaie un autre mot ou une autre catégorie.";
    }
    q.addEventListener("input", function () { query = q.value; draw(); });
    view._redraw = draw;
    draw();
    if (focusSearch) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); focusSearch = false; }
    var active = view.querySelector(".chip.active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function renderLoading() {
    view.innerHTML = loadError
      ? '<p class="loading">Impossible de charger les jeux. Lance le site avec un petit serveur (voir le README).</p>'
      : '<p class="loading">Chargement des jeux…</p>';
  }

  /* ---------- Routeur ---------- */
  function parse() {
    var h = location.hash || "";
    var m = h.match(/^#play=(.+)$/);
    if (m) return { name: "play", id: decodeURIComponent(m[1]) };
    var p = h.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    if (p[0] === "jeux") return { name: "games", cat: p[1] || "tous" };
    if (p[0] === "outils") return { name: "tools", parts: p.slice(1) };
    return { name: "home" };
  }
  function setTitle(t) { pageTitle = t; document.title = t; }
  PZ.restoreTitle = function () { document.title = pageTitle; };

  function show(route) {
    if (current && current.name === "tools" && route.name !== "tools") T.unmount();
    lastRoute = route;
    setActiveNav(route);
    if (route.name === "tools") {
      setTitle(T.render(view, route.parts) + " – " + SITE);
    } else if (!loaded) {
      renderLoading(); setTitle(SITE + " – Jeux en ligne gratuits");
    } else if (route.name === "games") {
      renderGames(route.cat);
      setTitle((route.cat === "tous" ? "Jeux" : groupLabel(route.cat)) + " – " + SITE);
    } else {
      renderHome(); setTitle(SITE + " – Jeux en ligne gratuits");
    }
    current = route;
    if (window.initAdSlots) window.initAdSlots(view);
  }

  var scrollBefore = 0;
  function onRoute() {
    var r = parse();
    if (r.name === "play") {
      if (!current) { show({ name: "home" }); }
      scrollBefore = window.scrollY;
      openGame(r.id);
      return;
    }
    var key = JSON.stringify(r), wasOpen = !$("player").hidden;
    closeGame();
    if (wasOpen && key === currentKey) { window.scrollTo(0, scrollBefore); return; } /* retour du jeu : on garde la vue */
    currentKey = key;
    show(r);
    window.scrollTo(0, 0);
  }

  /* ---------- Lecteur de jeu ---------- */
  var playing = null;
  function openGame(id) {
    var g = byId[id];
    if (!g) { if (loaded) { location.replace("#/jeux"); } return; }
    playing = g;
    $("player-title").textContent = g.title;
    $("frame").src = g.url;
    $("player").hidden = false;
    syncPlayerFav();
    document.body.style.overflow = "hidden";
    document.title = g.title + " – " + SITE;
    if (window.initAdSlots) window.initAdSlots($("player"));
    $("back").focus();
  }
  function closeGame() {
    if ($("player").hidden) return;
    $("player").hidden = true;
    $("frame").src = "about:blank";
    document.body.style.overflow = "";
    document.title = pageTitle;
    playing = null;
  }
  function syncPlayerFav() {
    if (!playing) return;
    var on = isFav(playing.id), b = $("p-fav");
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris");
  }

  /* ---------- Favoris ---------- */
  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i === -1) favs.push(id); else favs.splice(i, 1);
    PZ.store.set("pz:favs", favs);
    var on = isFav(id);
    Array.prototype.forEach.call(document.querySelectorAll('[data-fav="' + id.replace(/"/g, "") + '"]'), function (b) {
      b.setAttribute("aria-pressed", String(on));
    });
    syncPlayerFav();
    PZ.toast(on ? "Ajouté aux favoris" : "Retiré des favoris");
    if (!$("player").hidden) return;
    if (lastRoute.name === "games" && (lastRoute.cat === "favoris") && view._redraw) { view._redraw(); }
    if (lastRoute.name === "games") { var c = $("chips"); if (c) c.innerHTML = chipsHTML(lastRoute.cat); }
  }

  /* ---------- Horloge ---------- */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function updateClock() {
    var t = $("c-time");
    if (!t) return;
    var d = new Date();
    t.textContent = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
    $("c-date").textContent = cap(d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }));
  }
  function watchBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(function (b) {
      function up() {
        var el = $("c-batt");
        if (!el) return;
        el.hidden = false;
        el.querySelector("span").textContent = "Batterie : " + Math.round(b.level * 100) + " %" + (b.charging ? " (en charge)" : "");
      }
      b.addEventListener("levelchange", up); b.addEventListener("chargingchange", up);
      window.addEventListener("hashchange", function () { setTimeout(up, 50); });
      up();
    }).catch(function () {});
  }

  /* ---------- Événements globaux ---------- */
  view.addEventListener("click", function (e) {
    var f = e.target.closest("[data-fav]");
    if (f) { e.preventDefault(); toggleFav(f.getAttribute("data-fav")); return; }
    var s = e.target.closest("[data-scroll]");
    if (s) {
      var sc = s.closest(".row").querySelector(".scroller");
      sc.scrollBy({ left: +s.getAttribute("data-scroll") * sc.clientWidth * 0.8, behavior: "smooth" });
      return;
    }
    if (e.target.closest("[data-random]") && games.length) {
      location.hash = "#play=" + encodeURIComponent(games[Math.floor(Math.random() * games.length)].id);
    }
  });
  document.addEventListener("click", function (e) {
    var pop = $("theme-pop");
    if (pop.hidden) return;
    if (e.target.closest("#theme-pop")) {
      var sw = e.target.closest(".swatch");
      if (sw) { theme.color = sw.getAttribute("data-theme"); applyTheme(); buildThemePop(); }
      return;
    }
    pop.hidden = true; $("theme-btn").setAttribute("aria-expanded", "false");
  });
  $("theme-pop").addEventListener("change", function (e) {
    if (e.target.id === "motion") { theme.motion = e.target.checked; applyTheme(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!$("player").hidden) { if (location.hash.indexOf("#play=") === 0) history.back(); else closeGame(); return; }
      var pop = $("theme-pop");
      if (!pop.hidden) { pop.hidden = true; $("theme-btn").setAttribute("aria-expanded", "false"); $("theme-btn").focus(); }
      return;
    }
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var t = e.target && e.target.tagName;
      if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || !$("player").hidden) return;
      var q = $("hq") || $("q");
      if (q) { e.preventDefault(); q.focus(); }
    }
  });

  $("back").innerHTML = icon("back", 18) + "<span>Retour</span>";
  $("back").onclick = function () { if (location.hash.indexOf("#play=") === 0) history.back(); else closeGame(); };
  $("p-fav").innerHTML = icon("heart", 20);
  $("p-fav").onclick = function () { if (playing) toggleFav(playing.id); };
  $("p-reload").innerHTML = icon("reload", 20);
  $("p-reload").onclick = function () {
    var f = $("frame"), u = f.getAttribute("src");
    f.src = "about:blank"; setTimeout(function () { f.src = u; }, 60);
  };
  $("fs").innerHTML = icon("expand", 20);
  $("fs").onclick = function () { var f = $("frame"); (f.requestFullscreen || f.webkitRequestFullscreen || function () {}).call(f); };
  window.addEventListener("hashchange", onRoute);

  /* ---------- Démarrage ---------- */
  applyTheme(); buildNav(); buildThemePop();
  setInterval(updateClock, 15000);
  watchBattery();
  onRoute();

  fetch("data/games.json").then(function (r) { return r.json(); }).then(function (data) {
    games = data.map(function (g) { g.group = MAP[g.category] || "other"; return g; });
    games.forEach(function (g) { byId[g.id] = g; });
    loaded = true;
    var r = parse();
    if (r.name === "play") { show({ name: "home" }); currentKey = JSON.stringify({ name: "home" }); openGame(r.id); }
    else if (r.name !== "tools") { currentKey = ""; onRoute(); }
  }).catch(function () { loadError = true; if (lastRoute.name !== "tools") renderLoading(); });
})();
