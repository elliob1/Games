#!/usr/bin/env node
/* Ouvre chaque jeu du dossier games/ dans Chrome, capture son écran et l'utilise comme vignette.
   Nécessite Playwright (npm i playwright) et un Chrome/Chromium.
     node tools/screenshot-games.js                # jeux sans image
     node tools/screenshot-games.js --only snake,2048
     node tools/screenshot-games.js --redo         # refait aussi les captures déjà prises
   Variables : CHROME_PATH (chemin de Chrome si Playwright ne le trouve pas), WAIT_MS (attente avant la capture, 1500 par défaut ; un écran vide est repris après 5 s de plus).
   Les écrans vides (jeu qui n'a pas chargé) sont ignorés : ces jeux gardent leur emoji.
   Les captures sont marquées thumb.shot = true : tools/fetch-images.js peut ensuite les remplacer
   par une meilleure image trouvée en ligne. */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");

let playwright;
try { playwright = require("playwright"); } catch (e) { console.error("Playwright introuvable : npm i playwright"); process.exit(1); }

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "games.json");
const OUT = path.join(ROOT, "image");
const args = process.argv.slice(2);
const REDO = args.includes("--redo");
const oi = args.indexOf("--only");
const ONLY = oi !== -1 ? new Set(args[oi + 1].split(",").map((s) => s.trim())) : null;
const WAIT = parseInt(process.env.WAIT_MS || "1500", 10), RETRY_WAIT = 5000;
const CONCURRENCY = 5, SIZE = 480;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".wasm": "application/wasm", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain", ".xml": "text/xml", ".data": "application/octet-stream" };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      let f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      fs.readFile(f, (err, buf) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
        res.end(buf);
      });
    }).listen(0, "127.0.0.1", () => resolve(srv));
  });
}

(async () => {
  const games = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const todo = games.filter((g) => (!ONLY || ONLY.has(g.id)) && g.url && !/^https?:/.test(g.url) && (REDO || !(g.thumb && g.thumb.img)));
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox", "--mute-audio", "--autoplay-policy=no-user-gesture-required"] });
  console.log(todo.length + " jeu(x) à capturer");

  let ok = 0, blank = 0, failed = 0, next = 0;
  async function worker() {
    const ctx = await browser.newContext({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
    for (;;) {
      const g = todo[next++];
      if (!g) break;
      const label = "[" + next + "/" + todo.length + "] " + g.title.padEnd(34);
      const page = await ctx.newPage();
      try {
        page.on("dialog", (d) => d.dismiss().catch(() => {}));
        page.on("popup", (p) => p.close().catch(() => {}));
        /* un jeu dont des fichiers n'ont pas chargé (CDN injoignable, page 404…) affiche une page d'erreur :
           on le repère pour ne pas en faire une vignette. Les pubs et statistiques bloquées sont ignorées. */
        const AD = /google|doubleclick|googlesyndication|analytics|gtag|facebook|adservice|adsystem|cloudflareinsights/i;
        const bad = [];
        page.on("requestfailed", (r) => { if (!AD.test(r.url()) && !/^data:|^blob:/.test(r.url())) bad.push(r.url()); });
        page.on("response", (r) => { if (r.status() >= 400 && !AD.test(r.url()) && !/favicon|\.ico$/i.test(r.url())) bad.push(r.status() + " " + r.url()); });
        await page.goto(base + g.url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
        async function shot() {
          const buf = await page.screenshot({ type: "jpeg", quality: 72 });
          /* écran vide ? on mesure la variété des couleurs sur un échantillon réduit */
          const varied = await page.evaluate(async (b64) => {
            const img = new Image(); img.src = "data:image/jpeg;base64," + b64; await img.decode();
            const c = document.createElement("canvas"); c.width = c.height = 24;
            const x = c.getContext("2d"); x.drawImage(img, 0, 0, 24, 24);
            const d = x.getImageData(0, 0, 24, 24).data, seen = new Set();
            for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4));
            return seen.size;
          }, buf.toString("base64")).catch(() => 0);
          return { buf, varied };
        }
        await page.waitForTimeout(WAIT);
        let { buf, varied } = await shot();
        if (bad.length) { console.log(label + "— fichiers manquants (" + bad.length + "), ignoré : " + bad[0].slice(0, 70)); blank++; }
        else if (varied < 6) { await page.waitForTimeout(RETRY_WAIT); ({ buf, varied } = await shot()); }
        if (bad.length) { console.log(label + "— fichiers manquants (" + bad.length + "), ignoré : " + bad[0].slice(0, 70)); blank++; }
        else if (varied < 6) { console.log(label + "— écran vide, ignoré"); blank++; }
        else {
          const file = String(g.id).replace(/[^a-z0-9._-]+/gi, "-") + ".jpg";
          fs.writeFileSync(path.join(OUT, file), buf);
          g.thumb = Object.assign({}, g.thumb, { img: "image/" + file, shot: true });
          console.log(label + "✓"); ok++;
        }
      } catch (e) { console.log(label + "✗ " + e.message.split("\n")[0]); failed++; }
      await page.close().catch(() => {});
    }
    await ctx.close();
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close(); srv.close();

  if (ok) { fs.copyFileSync(DATA, DATA + ".bak"); fs.writeFileSync(DATA, JSON.stringify(games, null, 2) + "\n"); }
  console.log("\n" + ok + " capture(s) ajoutée(s), " + blank + " jeu(x) ignoré(s) (écran vide ou fichiers manquants), " + failed + " échec(s). Les autres gardent leur emoji.");
})().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
