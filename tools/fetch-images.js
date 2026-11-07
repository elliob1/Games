#!/usr/bin/env node
/* Cherche une image pour chaque jeu d'après son nom, la télécharge dans image/
   et l'ajoute dans data/games.json (thumb.img).

   À lancer sur TON ordinateur (il faut internet et Node 18+), depuis le dossier du site :
     node tools/fetch-images.js              # jeux qui n'ont pas encore d'image
     node tools/fetch-images.js --dry-run    # montre ce qui serait trouvé, sans rien écrire
     node tools/fetch-images.js --only snake,2048
     node tools/fetch-images.js --redo       # recommence même ceux qui ont déjà une image
     node tools/fetch-images.js --any        # accepte aussi les images non libres (voir plus bas)

   Source : API de Wikipédia (anglais, puis français), sans clé.
   Par défaut seules les images à licence LIBRE sont acceptées (pilicense=free), ce qui est le
   plus sûr pour un site avec des pubs. Beaucoup de jeux connus n'auront donc rien : ils gardent
   leur vignette emoji. Avec --any, Wikipédia renvoie aussi les pochettes « usage loyal » : elles
   ne sont PAS réutilisables hors de Wikipédia, à toi d'en assumer le risque.
   Les sources et licences sont notées dans image/CREDITS.md. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "games.json");
const OUT = path.join(ROOT, "image");
const args = process.argv.slice(2);
const flag = (n) => args.includes("--" + n);
const opt = (n) => { const i = args.indexOf("--" + n); return i !== -1 ? args[i + 1] : null; };
const DRY = flag("dry-run"), REDO = flag("redo"), ANY = flag("any");
const ONLY = opt("only") ? new Set(opt("only").split(",").map((s) => s.trim())) : null;
const LANGS = ["en", "fr"];
const UA = "PlayZoneImageFetcher/1.0 (site de jeux scolaire; script local)";
const MAX_BYTES = 2 * 1024 * 1024;
const GENERIC = new Set(["game", "games", "the", "of", "a", "an", "le", "la", "les", "de", "du", "des", "vs", "video", "classic", "lite", "online", "ia"]);

const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s) => norm(s).split(" ").filter((t) => t && !GENERIC.has(t));

/* Une page Wikipédia n'est retenue que si son titre ressemble vraiment au nom du jeu :
   évite d'afficher la photo d'un animal pour « Snake Classic ». */
const GAMEISH = /game|video|arcade|puzzle|series|franchise|app|mobile/i;
function similar(gameTitle, pageTitle, strict) {
  /* « Snake (animal) » : une précision entre parenthèses qui ne parle pas de jeu = mauvaise page.
     En mode strict (recherche sans « video game »), la page DOIT dire qu'elle parle d'un jeu. */
  const paren = /\(([^)]*)\)/.exec(pageTitle);
  if (paren ? !GAMEISH.test(paren[1]) : strict) return false;
  const g = tokens(gameTitle), p = tokens(pageTitle.replace(/\(.*?\)/g, ""));
  if (!g.length || !p.length) return false;
  const hit = g.filter((t) => p.includes(t)).length;
  return hit / g.length >= 0.75 && hit / p.length >= 0.5;
}

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function findOnWiki(lang, title) {
  const out = [];
  for (const [q, strict] of [[title + " video game", false], [title, true]]) {
    const url = "https://" + lang + ".wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=5" +
      "&gsrsearch=" + encodeURIComponent(q) + "&prop=pageimages&piprop=thumbnail&pithumbsize=480" +
      (ANY ? "" : "&pilicense=free");
    const j = await getJSON(url);
    const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
    for (const p of pages) if (p.thumbnail && similar(title, p.title, strict)) out.push({ lang, page: p.title, url: p.thumbnail.source });
    if (out.length) break;
  }
  return out;
}

async function download(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const type = (r.headers.get("content-type") || "").split(";")[0];
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[type];
  if (!ext) throw new Error("type non pris en charge : " + type);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("image trop lourde");
  return { buf, ext };
}

const safeName = (id) => String(id).replace(/[^a-z0-9._-]+/gi, "-");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const games = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const todo = games.filter((g) => (!ONLY || ONLY.has(g.id)) && (REDO || !(g.thumb && g.thumb.img) || (g.thumb && g.thumb.shot)));
  console.log(todo.length + " jeu(x) à traiter" + (DRY ? " (simulation)" : "") + (ANY ? " — images non libres autorisées" : " — images libres seulement"));
  if (!DRY) fs.mkdirSync(OUT, { recursive: true });

  const credits = [], missing = [];
  let found = 0, done = 0;
  const seenTitles = new Map(); /* jeux au même nom (ex. deux « Drive Mad Sugar Land ») : une seule recherche */

  for (const g of todo) {
    done++;
    const prefix = "[" + done + "/" + todo.length + "] " + g.title.padEnd(34);
    try {
      let hit = seenTitles.get(norm(g.title));
      if (hit === undefined) {
        hit = null;
        for (const lang of LANGS) {
          const r = await findOnWiki(lang, g.title);
          if (r.length) { hit = r[0]; break; }
          await sleep(150);
        }
        seenTitles.set(norm(g.title), hit);
      }
      if (!hit) { console.log(prefix + "— rien de fiable trouvé"); missing.push(g.title); continue; }
      if (DRY) { console.log(prefix + "→ " + hit.page + " (" + hit.lang + ")"); found++; continue; }
      const { buf, ext } = await download(hit.url);
      const file = safeName(g.id) + "." + ext;
      fs.writeFileSync(path.join(OUT, file), buf);
      g.thumb = Object.assign({}, g.thumb, { img: "image/" + file }); delete g.thumb.shot; /* remplace une éventuelle capture d'écran */
      credits.push("- **" + g.title + "** — page Wikipédia « " + hit.page + " » (https://" + hit.lang + ".wikipedia.org/wiki/" +
        encodeURIComponent(hit.page.replace(/ /g, "_")) + "), image " + (ANY ? "(licence à vérifier)" : "à licence libre"));
      console.log(prefix + "✓ " + hit.page);
      found++;
    } catch (e) {
      console.log(prefix + "✗ " + e.message);
      missing.push(g.title);
    }
    await sleep(250);
  }

  if (!DRY && found) {
    fs.copyFileSync(DATA, DATA + ".bak");
    fs.writeFileSync(DATA, JSON.stringify(games, null, 2) + "\n");
    const credFile = path.join(OUT, "CREDITS.md");
    const old = fs.existsSync(credFile) ? fs.readFileSync(credFile, "utf8").trim() + "\n" : "# Crédits des images\n\n";
    fs.writeFileSync(credFile, old + credits.join("\n") + "\n");
  }
  console.log("\n" + found + " image(s) " + (DRY ? "trouvée(s)" : "ajoutée(s)") + ", " + missing.length + " jeu(x) sans image (ils gardent leur emoji).");
  if (!DRY && found) console.log("data/games.json mis à jour (copie de sécurité : data/games.json.bak). Sources : image/CREDITS.md");
})().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
