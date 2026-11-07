#!/usr/bin/env node
/* Associe les images du dossier image/ aux jeux de data/games.json.

   COMMENT NOMMER TES IMAGES
   - Mets-les dans le dossier  image/  (à la racine du site).
   - Le nom du fichier = l'id du jeu :  snake.jpg, 2048.webp, drivemadsugarland.png …
     (le titre exact marche aussi : "Snake Classic.png"). Majuscules, accents et espaces sont tolérés.
   - Format conseillé : carré 480 x 480 px, JPG ou WebP, moins de 100 Ko (les tuiles sont carrées).
     Acceptés : jpg, jpeg, png, webp, gif, avif.
   - Les ids de tous les jeux : node tools/link-images.js --list

   CE QUE FAIT LE SCRIPT
   - Jeu avec une image dans image/  -> thumb.img est rempli.
   - Jeu sans image                  -> son thumb.img est retiré : le site affiche l'emoji.
   - Il n'efface ni ne déplace jamais tes fichiers, il ne modifie que data/games.json.
   - Il signale les fichiers qui ne correspondent à aucun jeu (avec le nom le plus proche).

   Options : --dry-run (ne rien écrire)  --list  --quiet  --keep-other (garde les images des jeux
   qui ne viennent pas du dossier image/)  --root <dossier> (pour les tests)
   Netlify le lance automatiquement à chaque déploiement (voir netlify.toml). */
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const flag = (n) => args.includes("--" + n);
const ri = args.indexOf("--root");
const ROOT = path.resolve(ri !== -1 ? args[ri + 1] : path.join(__dirname, ".."));
const DATA = path.join(ROOT, "data", "games.json");
const DIR = path.join(ROOT, "image");
const DIRNAME = "image";
const EXT_ORDER = [".webp", ".jpg", ".jpeg", ".png", ".avif", ".gif"]; /* si plusieurs fichiers pour un jeu : le premier gagne */
const BIG = 300 * 1024;
const QUIET = flag("quiet"), DRY = flag("dry-run");
const say = (...a) => { if (!QUIET) console.log(...a); };

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function distance(a, b) { /* Levenshtein, pour suggérer le jeu le plus proche d'un nom de fichier */
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function main() {
  let games;
  try { games = JSON.parse(fs.readFileSync(DATA, "utf8")); }
  catch (e) { console.error("Impossible de lire data/games.json : " + e.message); process.exit(1); }

  if (flag("list")) {
    const w = Math.max.apply(null, games.map((g) => g.id.length));
    games.forEach((g) => console.log(g.id.padEnd(w + 2) + g.title));
    return;
  }

  const ids = new Map(); /* id normalisé -> jeux */
  const titles = new Map(); /* titre normalisé -> jeux */
  const push = (m, k, g) => { if (!m.has(k)) m.set(k, []); m.get(k).push(g); };
  games.forEach((g) => { push(ids, norm(g.id), g); push(titles, norm(g.title), g); });
  const dupIds = [...new Set(games.map((g) => g.id))].filter((id) => games.filter((g) => g.id === id).length > 1);
  if (dupIds.length) console.warn("⚠ Id en double dans games.json : " + dupIds.join(", ") + " (un id doit être unique)");

  let files = [];
  if (fs.existsSync(DIR)) {
    files = fs.readdirSync(DIR).filter((f) => EXT_ORDER.includes(path.extname(f).toLowerCase()) && fs.statSync(path.join(DIR, f)).isFile());
  } else say("Le dossier image/ n'existe pas encore : tous les jeux gardent leur emoji.");
  files.sort((a, b) => EXT_ORDER.indexOf(path.extname(a).toLowerCase()) - EXT_ORDER.indexOf(path.extname(b).toLowerCase()) || a.localeCompare(b));

  const chosen = new Map(); /* jeu -> fichier */
  const unmatched = [], ambiguous = [], doubles = [], heavy = [];
  for (const f of files) {
    const key = norm(path.basename(f, path.extname(f)));
    let hit = ids.get(key);
    if (!hit) {
      const byTitle = titles.get(key);
      if (byTitle && byTitle.length > 1) { ambiguous.push(f); continue; }
      hit = byTitle;
    }
    if (!hit) { unmatched.push(f); continue; }
    for (const g of hit) {
      if (chosen.has(g)) { doubles.push(f + " (déjà " + chosen.get(g) + ")"); continue; }
      chosen.set(g, f);
    }
    if (fs.statSync(path.join(DIR, f)).size > BIG) heavy.push(f);
  }

  let linked = 0, cleared = 0, changed = 0;
  for (const g of games) {
    g.thumb = g.thumb || {};
    const before = JSON.stringify(g.thumb);
    const f = chosen.get(g);
    if (f) { g.thumb.img = DIRNAME + "/" + encodeURIComponent(f).replace(/%2F/g, "/"); delete g.thumb.shot; linked++; }
    else if (g.thumb.img && !(flag("keep-other") && !g.thumb.img.startsWith(DIRNAME + "/"))) { delete g.thumb.img; delete g.thumb.shot; cleared++; }
    if (JSON.stringify(g.thumb) !== before) changed++;
  }

  const missing = games.filter((g) => !chosen.has(g));
  say("Images associées : " + linked + " / " + games.length + " jeux  ·  emoji gardé pour " + missing.length);
  if (cleared) say("Ancienne image retirée (fichier absent de image/) pour " + cleared + " jeu(x).");
  if (unmatched.length) {
    say("\nFichiers sans jeu correspondant (renomme-les avec l'id du jeu) :");
    const all = games.map((g) => [g, norm(g.id)]).concat(games.map((g) => [g, norm(g.title)]));
    unmatched.forEach((f) => {
      const k = norm(path.basename(f, path.extname(f)));
      let best = null;
      all.forEach(([g, n]) => { const d = distance(k, n); if (!best || d < best.d) best = { d, g }; });
      say("  " + f + (best && best.d <= Math.max(2, Math.ceil(k.length / 3)) ? "   → peut-être « " + best.g.id + " » (" + best.g.title + ")" : ""));
    });
  }
  if (ambiguous.length) say("\nNom ambigu (plusieurs jeux ont ce titre, utilise l'id) : " + ambiguous.join(", "));
  if (doubles.length) say("\nPlusieurs fichiers pour un même jeu, un seul est utilisé : " + doubles.join(", "));
  if (heavy.length) say("\nImages lourdes (> 300 Ko), le site sera plus lent : " + heavy.join(", "));
  if (!QUIET && missing.length && missing.length <= 40) say("\nJeux sans image : " + missing.map((g) => g.id).join(", "));

  if (DRY) { say("\n(simulation : rien n'a été écrit)"); return; }
  if (changed) { fs.writeFileSync(DATA, JSON.stringify(games, null, 2) + "\n"); say("\ndata/games.json mis à jour (" + changed + " jeu(x) modifié(s))."); }
  else say("\ndata/games.json déjà à jour.");
}

main();
