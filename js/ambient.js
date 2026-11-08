/* Effets d'ambiance (canvas) :
   1. Petites étoiles à 4 branches, en dégradé gris teinté du thème, autour du curseur.
      Plus grandes près de la souris, de plus en plus petites en s'éloignant, jamais au-delà de 2,5 cm,
      et elles suivent la souris. Visibles seulement quand la souris est sur le FOND (pas sur les jeux,
      cartes, boutons, menus…).
   2. Petites feuilles de formes différentes, dans la couleur du fond, qui tombent derrière le contenu,
      et quelques-unes par-dessus tout le site.
   Désactivés par l'interrupteur « Fond animé » (menu thème) et par prefers-reduced-motion.
   Réglages : voir les constantes juste en dessous. */
(function () {
  "use strict";

  var CM = 96 / 2.54;                 /* 1 cm CSS en pixels */
  var RADIUS = 2.5 * CM;              /* rayon maximal des étoiles : 2,5 cm */
  var STARS = 16;                     /* nombre d'étoiles autour du curseur */
  var STAR_MAX = 9, STAR_MIN = 2;     /* rayon (px) d'une étoile au curseur / au bord du cercle */
  var LEAVES_BACK = [10, 26];         /* nombre de feuilles derrière le contenu (min, max selon la largeur) */
  var LEAVES_FRONT = [3, 7];          /* nombre de feuilles par-dessus le site */
  var TAU = Math.PI * 2;

  /* Tout ce qui n'est PAS « le fond » : l'étoile se cache quand la souris est dessus. */
  var CONTENT = "a, button, input, textarea, select, label, .tile, .glass, .panel, .tcard, .shortcut, " +
    ".pill-nav, .theme-pop, .player, .toast, .scroller, .msg, .result, .chat-box";

  var root = document.documentElement;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var hoverCap = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : { matches: true };

  function mk(cls) {
    var c = document.createElement("canvas");
    c.className = "fx " + cls;
    c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    return c;
  }
  var back = mk("fx-back"), front = mk("fx-front");
  var bx = back.getContext("2d"), fx = front.getContext("2d");
  if (!bx || !fx) return;

  var W = 0, H = 0, dpr = 1;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- Couleurs : dérivées de la couleur d'accent du thème ---------- */
  var col = {};
  function parse(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 61, 139];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a + ")"; }
  function readColors() {
    var accent = parse(getComputedStyle(root).getPropertyValue("--accent"));
    col.accent = accent;
    col.starA = mix([238, 236, 244], accent, 0.10);   /* gris clair, à peine teinté */
    col.starB = mix([128, 124, 142], accent, 0.22);   /* gris plus sombre teinté */
    col.leaf = [mix([0, 0, 0], accent, 0.45), mix([0, 0, 0], accent, 0.62), mix([0, 0, 0], accent, 0.80)];
    [bx, fx].forEach(function (c) { c.__grad = null; });
  }
  function starGradient(c) {
    if (!c.__grad) {
      var g = c.createLinearGradient(-1, -1, 1, 1);   /* en unités de l'étoile : suit la mise à l'échelle */
      g.addColorStop(0, rgba(col.starA, 0.95));
      g.addColorStop(1, rgba(col.starB, 0.45));
      c.__grad = g;
    }
    return c.__grad;
  }

  /* ---------- Formes (rayon 1, pointe vers le haut) ---------- */
  var STAR = new Path2D();
  STAR.moveTo(0, -1); STAR.quadraticCurveTo(0.1, -0.1, 1, 0); STAR.quadraticCurveTo(0.1, 0.1, 0, 1);
  STAR.quadraticCurveTo(-0.1, 0.1, -1, 0); STAR.quadraticCurveTo(-0.1, -0.1, 0, -1); STAR.closePath();

  function leafPath(build) { var p = new Path2D(); build(p); return p; }
  var VEIN = leafPath(function (p) { p.moveTo(0, -0.8); p.lineTo(0, 1.18); });
  var SHAPES = [
    { /* feuille pointue classique */ sx: 0.62, path: leafPath(function (p) {
      p.moveTo(0, -1); p.bezierCurveTo(0.8, -0.5, 0.75, 0.45, 0, 1); p.bezierCurveTo(-0.75, 0.45, -0.8, -0.5, 0, -1); }) },
    { /* feuille ronde (bouleau) */ sx: 0.82, path: leafPath(function (p) {
      p.moveTo(0, -1); p.bezierCurveTo(0.95, -0.55, 1.0, 0.5, 0, 0.95); p.bezierCurveTo(-1.0, 0.5, -0.95, -0.55, 0, -1); }) },
    { /* feuille fine (saule) */ sx: 0.3, path: leafPath(function (p) {
      p.moveTo(0, -1); p.bezierCurveTo(0.34, -0.5, 0.34, 0.5, 0, 1); p.bezierCurveTo(-0.34, 0.5, -0.34, -0.5, 0, -1); }) },
    { /* feuille d'érable simplifiée */ sx: 0.95, path: leafPath(function (p) {
      var r = [[0, -1], [0.2, -0.62], [0.62, -0.78], [0.5, -0.26], [0.98, -0.1], [0.5, 0.16], [0.56, 0.52], [0.12, 0.42], [0, 0.95]];
      p.moveTo(r[0][0], r[0][1]);
      for (var i = 1; i < r.length; i++) p.lineTo(r[i][0], r[i][1]);
      for (var j = r.length - 2; j >= 0; j--) p.lineTo(-r[j][0], r[j][1]);
      p.closePath(); }) },
    { /* éventail (ginkgo) */ sx: 0.95, path: leafPath(function (p) {
      p.moveTo(0, 1); p.lineTo(-0.85, -0.35); p.quadraticCurveTo(-0.45, -1, 0, -0.55);
      p.quadraticCurveTo(0.45, -1, 0.85, -0.35); p.closePath(); }) }
  ];

  /* ---------- Feuilles ---------- */
  var leavesBack = [], leavesFront = [];
  function newLeaf(front, anywhere) {
    var l = {
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: front ? rand(8, 13) : rand(7, 15),            /* demi-longueur en px */
      bx: rand(0, W), y: anywhere ? rand(-20, H) : rand(-60, -20),
      vy: front ? rand(30, 58) : rand(20, 46),
      drift: rand(-6, 6), amp: rand(14, 42), f: rand(0.5, 1.2), ph: rand(0, TAU),
      t: rand(0, 50), r0: rand(0, TAU), spin: rand(-0.5, 0.5), ff: rand(0.8, 2.0),
      tone: Math.floor(Math.random() * 3),
      alpha: front ? rand(0.16, 0.26) : rand(0.2, 0.42),
      x: 0, rot: 0, flip: 1
    };
    l.x = l.bx;
    return l;
  }
  function populate() {
    var nb = Math.round(clamp(W / 70, LEAVES_BACK[0], LEAVES_BACK[1]));
    var nf = Math.round(clamp(W / 200, LEAVES_FRONT[0], LEAVES_FRONT[1]));
    while (leavesBack.length < nb) leavesBack.push(newLeaf(false, true));
    while (leavesFront.length < nf) leavesFront.push(newLeaf(true, true));
    leavesBack.length = nb; leavesFront.length = nf;
  }
  function stepLeaf(l, dt, wind) {
    l.t += dt;
    l.y += l.vy * dt;
    l.bx += (l.drift + wind) * dt;
    l.x = l.bx + Math.sin(l.t * l.f + l.ph) * l.amp;
    l.rot = l.r0 + Math.sin(l.t * l.f * 0.9 + l.ph) * 0.7 + l.t * l.spin * 0.25;
    l.flip = Math.max(0.28, Math.abs(Math.cos(l.t * l.ff + l.ph)));
    if (l.y > H + 40) { l.y = rand(-60, -20); l.bx = rand(0, W); }
    if (l.bx < -80) l.bx = W + 60; else if (l.bx > W + 80) l.bx = -60;
  }
  function drawLeaf(c, l) {
    var color = col.leaf[l.tone];
    c.save();
    c.translate(l.x, l.y);
    c.rotate(l.rot);
    c.scale(l.size * l.shape.sx * l.flip, l.size);
    c.fillStyle = rgba(color, l.alpha);
    c.fill(l.shape.path);
    c.lineWidth = 0.07 / Math.max(0.3, l.shape.sx * l.flip) * 0.8;
    c.strokeStyle = rgba(color, Math.min(1, l.alpha + 0.18));
    c.stroke(VEIN);
    c.restore();
  }

  /* ---------- Étoiles autour du curseur ---------- */
  var mx = -999, my = -999;
  var inside = false, overBg = false, vis = 0, lastCheck = 0;
  var stars = [];
  function spawn(s, staggered) {
    s.a = rand(0, TAU);
    s.r = RADIUS * Math.pow(Math.random(), 1.25);      /* un peu plus dense près de la souris */
    s.orbit = rand(-0.5, 0.5);
    s.k = rand(4, 9);                                  /* « mollesse » du suivi : chaque étoile traîne différemment */
    s.max = rand(1.1, 2.4);
    s.life = staggered ? rand(0, s.max) : 0;
    s.tw = rand(0, TAU); s.rot = rand(-0.5, 0.5); s.spin = rand(-0.7, 0.7);
    s.x = mx + Math.cos(s.a) * s.r; s.y = my + Math.sin(s.a) * s.r;
    return s;
  }
  function resetStars() { stars.length = 0; for (var i = 0; i < STARS; i++) stars.push(spawn({}, true)); }

  function stepStars(dt, now) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.life += dt; s.a += s.orbit * dt; s.rot += s.spin * dt;
      if (s.life >= s.max) spawn(s, false);
      var tx = mx + Math.cos(s.a) * s.r, ty = my + Math.sin(s.a) * s.r;
      var e = 1 - Math.exp(-s.k * dt);
      s.x += (tx - s.x) * e; s.y += (ty - s.y) * e;
      var dx = s.x - mx, dy = s.y - my, d = Math.sqrt(dx * dx + dy * dy);
      if (d > RADIUS) { s.x = mx + dx / d * RADIUS; s.y = my + dy / d * RADIUS; }   /* jamais plus loin que 2,5 cm */
    }
  }
  function drawStars(c, now) {
    if (vis < 0.01) return;
    c.shadowColor = rgba(col.starA, 0.45);
    c.shadowBlur = 7;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var d = Math.min(1, Math.sqrt((s.x - mx) * (s.x - mx) + (s.y - my) * (s.y - my)) / RADIUS);
      var env = Math.pow(Math.max(0, Math.sin(Math.PI * s.life / s.max)), 0.6);        /* apparition / disparition */
      var alpha = env * vis * (0.5 + 0.5 * (1 - d));
      if (alpha < 0.01) continue;
      var size = (STAR_MAX + (STAR_MIN - STAR_MAX) * Math.pow(d, 0.75)) *              /* grand au curseur, petit au loin */
        (0.85 + 0.15 * Math.sin(now * 0.005 + s.tw)) * (0.55 + 0.45 * env);
      c.save();
      c.globalAlpha = alpha;
      c.translate(s.x, s.y); c.rotate(s.rot); c.scale(size, size);
      c.fillStyle = starGradient(c);
      c.fill(STAR);
      c.restore();
    }
    c.shadowBlur = 0;
  }

  /* ---------- La souris est-elle sur le fond ? ---------- */
  function isBackground(el) { return !!el && !(el.closest && el.closest(CONTENT)); }
  function onMove(e) {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") { inside = false; return; }
    mx = e.clientX; my = e.clientY; inside = true;
    overBg = isBackground(e.target);
    lastCheck = performance.now();
  }
  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerdown", onMove, { passive: true });
  root.addEventListener("mouseleave", function () { inside = false; });
  window.addEventListener("blur", function () { inside = false; });

  /* ---------- Boucle ---------- */
  var running = false, raf = 0, last = 0;
  function enabled() { return !reduce.matches && root.dataset.motion !== "off" && !document.hidden; }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;

    /* le contenu sous la souris peut changer sans mouvement (défilement, nouvelle page) */
    if (inside && now - lastCheck > 150) {
      lastCheck = now;
      overBg = isBackground(document.elementFromPoint(mx, my));
    }
    var want = inside && overBg && hoverCap.matches;
    var prev = vis;
    vis += ((want ? 1 : 0) - vis) * (1 - Math.exp(-(want ? 9 : 12) * dt));
    if (vis < 0.003) vis = 0;
    if (prev === 0 && vis > 0) resetStars();           /* réapparition : tout repart du curseur */
    if (vis > 0) stepStars(dt, now);

    var wind = Math.sin(now * 0.0002) * 8;
    var i;
    for (i = 0; i < leavesBack.length; i++) stepLeaf(leavesBack[i], dt, wind);
    for (i = 0; i < leavesFront.length; i++) stepLeaf(leavesFront[i], dt, wind);

    bx.setTransform(dpr, 0, 0, dpr, 0, 0); bx.clearRect(0, 0, W, H);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
    for (i = 0; i < leavesBack.length; i++) drawLeaf(bx, leavesBack[i]);
    drawStars(bx, now);
    for (i = 0; i < leavesFront.length; i++) drawLeaf(fx, leavesFront[i]);
  }

  function clearAll() {
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, back.width, back.height);
    fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, front.width, front.height);
  }
  function sync() {
    if (enabled() && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    else if (!enabled() && running) { running = false; cancelAnimationFrame(raf); vis = 0; clearAll(); }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [back, front].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    populate();
  }

  resize(); readColors(); sync();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  if (reduce.addEventListener) reduce.addEventListener("change", sync);
  new MutationObserver(function () { readColors(); sync(); }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });

  /* utilisé par les tests */
  window.PZAmbient = {
    radius: RADIUS,
    state: function () {
      return {
        running: running, vis: vis, over: overBg,
        leavesBack: leavesBack.length, leavesFront: leavesFront.length,
        starDistances: stars.map(function (s) { return Math.sqrt((s.x - mx) * (s.x - mx) + (s.y - my) * (s.y - my)); })
      };
    }
  };
})();
