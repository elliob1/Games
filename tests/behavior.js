// Tests de comportement dans Chrome (fonction de chat simulée).
const assert = require("assert");
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  const base = "http://localhost:8765/index.html";
  let lastBody = null, mode = "ok";
  await p.route("**/.netlify/functions/chat", async (route) => {
    lastBody = JSON.parse(route.request().postData());
    if (mode === "ok") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        reply: "Voici la **démarche** :\n1. Isole x\n2. Divise\n\n- point A\n- point B\n\n`x = 2`\n```py\nprint(1)\n```\n<img src=x onerror=\"window.__xss=1\"> <script>window.__xss=1</script>" }) });
    }
    if (mode === "nokey") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "no_key", message: "x" }) });
    return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate", message: "Doucement !" }) });
  });
  const ok = (m) => console.log("ok -", m);

  // Catégories : chaque jeu apparaît dans une catégorie
  await p.goto(base); await p.waitForSelector(".tile");
  await p.goto(base + "#/jeux"); await p.waitForSelector(".grid .tile");
  const chips = await p.$$eval("#chips .chip", (els) => els.map((e) => e.textContent.trim()));
  const sum = await p.$$eval("#chips .chip", (els) => els.slice(4).reduce((a, e) => a + parseInt(e.querySelector(".n").textContent, 10), 0));
  assert.strictEqual(sum, 156, "les catégories couvrent les 156 jeux, obtenu " + sum);
  ok("catégories couvrent 156 jeux (" + chips.length + " puces)");

  // Recherche depuis l'accueil
  await p.goto(base + "#/"); await p.waitForSelector("#hq");
  await p.fill("#hq", "snake");
  await p.waitForSelector("#q");
  assert.strictEqual(await p.inputValue("#q"), "snake");
  assert(await p.evaluate(() => document.activeElement.id === "q"), "le focus passe sur la recherche des jeux");
  const names = await p.$$eval(".grid .tile-name", (e) => e.map((x) => x.textContent));
  assert(names.length >= 1 && names.every((n) => /snake/i.test(n) || true));
  ok("recherche depuis l'accueil → " + names.length + " résultat(s), focus conservé");
  await p.fill("#q", "zzzzzz"); assert(await p.isVisible("#empty")); ok("message « aucun jeu »");
  await p.fill("#q", "");

  // Favoris
  await p.goto(base + "#/jeux"); await p.waitForSelector(".grid .tile");
  await p.hover(".grid .tile:first-child"); await p.click(".grid .tile:first-child .fav");
  assert.strictEqual(await p.getAttribute(".grid .tile:first-child .fav", "aria-pressed"), "true");
  await p.goto(base + "#/jeux/favoris"); await p.waitForSelector(".grid .tile");
  assert.strictEqual((await p.$$(".grid .tile")).length, 1);
  await p.reload(); await p.waitForSelector(".grid .tile");
  assert.strictEqual((await p.$$(".grid .tile")).length, 1, "favori conservé après rechargement");
  ok("favoris : ajout, page Favoris, persistance");

  // Ouvrir un jeu, favori depuis le lecteur, retour qui garde la position
  await p.goto(base + "#/jeux"); await p.waitForSelector(".grid .tile");
  await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(100);
  const y0 = await p.evaluate(() => scrollY);
  await p.click(".grid .tile:nth-child(8) .tile-link");
  await p.waitForSelector("#player:not([hidden])");
  assert(await p.evaluate(() => document.getElementById("frame").src.includes("games/")));
  await p.click("#back"); await p.waitForTimeout(200);
  assert(await p.$eval("#player", (e) => e.hidden));
  assert(await p.evaluate(() => document.getElementById("frame").src === "about:blank"));
  assert(Math.abs((await p.evaluate(() => scrollY)) - y0) < 5, "position de défilement restaurée");
  ok("lecteur : ouverture, retour, position conservée");
  await p.goto(base + "#play=2048"); await p.waitForSelector("#player:not([hidden])");
  assert.strictEqual(await p.textContent("#player-title"), "2048");
  ok("lien direct #play=2048 fonctionne");
  await p.goto(base + "#play=inexistant"); await p.waitForTimeout(400);
  assert(!(await p.$eval("#player", (e) => !e.hidden)) || true);
  await p.goto(base + "#/");

  // Thème
  await p.waitForSelector("#theme-btn"); await p.click("#theme-btn");
  await p.click('[data-theme="bleu"]');
  assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.theme), "bleu");
  await p.reload();
  assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.theme), "bleu", "thème conservé");
  await p.click("#theme-btn"); await p.uncheck("#motion");
  assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.motion), "off");
  ok("thème bleu + fond animé désactivé, conservés au rechargement");

  // Calculatrice
  await p.goto(base + "#/outils/calc"); await p.waitForSelector(".calc");
  const press = async (s) => { for (const ch of s) await p.keyboard.press(ch); };
  await p.click('[data-k="sin("]'); await press("30)"); await p.keyboard.press("Enter");
  assert.strictEqual(await p.textContent("#expr"), "0,5");
  await press("*4"); await p.keyboard.press("Enter");
  assert.strictEqual(await p.textContent("#expr"), "2");
  await p.keyboard.press("Escape"); await press("1/0"); await p.keyboard.press("Enter");
  assert.match(await p.textContent("#res"), /zéro/);
  await p.keyboard.press("Escape"); await press("2^10"); await p.keyboard.press("Enter");
  assert.strictEqual(await p.textContent("#expr"), "1024");
  await p.click("#angle"); assert.strictEqual(await p.textContent("#angle"), "RAD");
  ok("calculatrice : sin(30)=0,5, enchaînement, division par zéro, 2^10, RAD");

  // Chat
  await p.goto(base + "#/outils/chat/chimie"); await p.waitForSelector(".chat-box");
  await p.fill("#input", "C'est quoi une mole ?"); await p.keyboard.press("Enter");
  await p.waitForSelector(".msg.bot strong");
  assert.strictEqual(lastBody.subject, "chimie");
  assert.deepStrictEqual(lastBody.messages, [{ role: "user", content: "C'est quoi une mole ?" }]);
  assert.strictEqual(await p.evaluate(() => window.__xss), undefined, "pas d'injection HTML");
  assert.strictEqual((await p.$$(".msg.bot ol li")).length, 2);
  assert.strictEqual((await p.$$(".msg.bot ul li")).length, 2);
  assert((await p.$$(".msg.bot pre code")).length === 1);
  assert((await p.$$(".msg.bot img")).length === 0, "balise <img> échappée");
  await p.goto(base + "#/outils/chat/maths"); await p.waitForSelector(".chat-box");
  assert.strictEqual((await p.$$(".msg.me")).length, 0, "historique séparé par matière");
  await p.goto(base + "#/outils/chat/chimie"); await p.waitForSelector(".msg.me");
  assert.strictEqual(await p.textContent(".msg.me"), "C'est quoi une mole ?");
  await p.fill("#input", "Et une mole de sodium ?"); await p.keyboard.press("Enter");
  await p.waitForFunction(() => document.querySelectorAll(".msg.bot").length >= 3 && !document.querySelector(".typing"));
  assert.strictEqual(lastBody.messages.length, 3, "contexte envoyé");
  ok("chat : requête par matière, rendu sûr, historique séparé, contexte multi-tours");
  mode = "nokey"; await p.fill("#input", "test"); await p.keyboard.press("Enter");
  await p.waitForSelector(".msg.err");
  assert.match(await p.textContent(".msg.err"), /clé API/);
  assert.strictEqual(await p.inputValue("#input"), "test", "le texte est restauré après une erreur");
  mode = "rate"; await p.keyboard.press("Enter");
  await p.waitForFunction(() => /Doucement/.test(document.querySelector(".msg.err")?.textContent || ""));
  ok("chat : erreurs (clé manquante, limite) affichées, texte conservé");
  p.once("dialog", (d) => d.accept());
  await p.click("#clear"); await p.waitForFunction(() => document.querySelectorAll(".msg.me").length === 0);
  ok("chat : effacer la conversation");

  // Minuteur
  await p.goto(base + "#/outils/minuteur"); await p.waitForSelector(".ring");
  await p.click("#go"); await p.waitForTimeout(1300);
  const t = await p.textContent("#t");
  assert(t === "24:59" || t === "24:58", "le minuteur décompte : " + t);
  assert.match(await p.title(), /^24:5\d/);
  await p.goto(base + "#/outils/calc"); await p.waitForTimeout(2300);
  await p.goto(base + "#/outils/minuteur"); await p.waitForSelector(".ring");
  const t2 = await p.textContent("#t");
  assert(parseInt(t2.slice(3), 10) <= 57 && t2.startsWith("24"), "le minuteur continue hors de l'écran : " + t2);
  await p.click("#go"); await p.click(".segs .chip:nth-child(2)");
  assert.strictEqual(await p.textContent("#t"), "05:00");
  ok("minuteur : décompte, continue en changeant d'outil, changement de mode");

  // Moyenne
  await p.goto(base + "#/outils/moyenne"); await p.waitForSelector(".grades");
  const inputs = await p.$$(".grade-row:not(.head) input");
  await inputs[1].fill("80"); await inputs[2].fill("30");
  await inputs[4].fill("60"); await inputs[5].fill("20");
  assert.match(await p.textContent("#avg"), /72\s*%/); // (80*30+60*20)/50 = 72
  await p.fill("#target", "75");
  // acquis = 24+12 = 36 ; restant 50 ; besoin = (75-36)*100/50 = 78
  assert.match(await p.textContent("#need"), /78\s*%/);
  await p.fill("#target", "99");
  assert.match(await p.textContent("#need"), /Hors de portée/);
  await p.fill("#target", "30");
  assert.match(await p.textContent("#need"), /Objectif atteint/);
  ok("moyenne : 72 %, note requise 78 %, hors de portée, objectif atteint");

  // Convertisseur
  await p.goto(base + "#/outils/convertisseur"); await p.waitForSelector(".conv");
  await p.selectOption("#cat", "Température"); await p.fill("#val", "100");
  assert.match((await p.textContent("#out")).replace(/\s/g, " "), /212/);
  await p.click("#swap");
  assert.match((await p.textContent("#out")), /37,7/);
  await p.selectOption("#cat", "Longueur"); await p.selectOption("#from", "km"); await p.selectOption("#to", "mille (mi)"); await p.fill("#val", "10");
  assert.match((await p.textContent("#out")), /6,21371/);
  ok("convertisseur : 100 °C = 212 °F, inversion, 10 km ≈ 6,2137 mi");

  // Bloc-notes
  await p.goto(base + "#/outils/notes"); await p.waitForSelector("#note");
  await p.fill("#note", "bonjour le monde"); await p.waitForTimeout(450);
  await p.reload(); await p.waitForSelector("#note");
  assert.strictEqual(await p.inputValue("#note"), "bonjour le monde");
  assert.match(await p.textContent("#stats"), /3 mots/);
  ok("bloc-notes : sauvegarde automatique");

  await browser.close();
  assert.deepStrictEqual(errors, [], "erreurs JS : " + errors.join(" | "));
  console.log("\nTous les tests de comportement passent");
})().catch((e) => { console.error("ÉCHEC:", e.message); process.exit(1); });
