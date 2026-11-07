// Ouvre le site dans Chrome, capture des écrans et signale les erreurs JS.
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const out = process.argv[2] || "/tmp/pz-shots";
require("fs").mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const errors = [];
  async function page(w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
    return p;
  }
  const base = "http://localhost:8765/index.html";

  const d = await page(1360, 860);
  await d.goto(base); await d.waitForSelector(".tile");
  await d.screenshot({ path: out + "/home.png" });
  await d.goto(base + "#/jeux/racing"); await d.waitForSelector(".grid .tile");
  await d.screenshot({ path: out + "/jeux-course.png" });
  await d.goto(base + "#/outils"); await d.waitForSelector(".tcard");
  await d.screenshot({ path: out + "/outils.png" });
  await d.goto(base + "#/outils/calc"); await d.waitForSelector(".calc");
  for (const k of ["2", "+", "3", "×", "4"]) await d.keyboard.press(k === "×" ? "*" : k);
  await d.keyboard.press("Enter");
  await d.screenshot({ path: out + "/calc.png" });
  console.log("calc 2+3*4 =>", await d.textContent("#expr"));
  await d.goto(base + "#/outils/chat/maths"); await d.waitForSelector(".chat-box");
  await d.click(".suggest .chip");
  await d.waitForSelector(".msg.err");
  await d.screenshot({ path: out + "/chat.png" });
  console.log("chat erreur locale =>", await d.textContent(".msg.err"));
  await d.goto(base + "#/outils/moyenne"); await d.waitForSelector(".grades");
  await d.screenshot({ path: out + "/moyenne.png" });
  await d.goto(base + "#/outils/minuteur"); await d.waitForSelector(".ring");
  await d.screenshot({ path: out + "/minuteur.png" });
  await d.goto(base + "#/outils/convertisseur"); await d.waitForSelector(".conv");
  console.log("convertisseur =>", (await d.textContent("#out")).replace(/\s+/g, " "));
  await d.goto(base + "#play=snake"); await d.waitForSelector("#player:not([hidden])");
  await d.waitForTimeout(500);
  await d.screenshot({ path: out + "/jeu.png" });
  await d.keyboard.press("Escape"); await d.waitForTimeout(300);
  console.log("après Escape, lecteur caché =>", await d.$eval("#player", (e) => e.hidden), "hash =>", await d.evaluate(() => location.hash));

  const m = await page(390, 800);
  await m.goto(base); await m.waitForSelector(".tile");
  await m.screenshot({ path: out + "/mobile-home.png" });
  await m.goto(base + "#/jeux"); await m.waitForSelector(".grid .tile");
  await m.screenshot({ path: out + "/mobile-jeux.png" });
  await m.goto(base + "#/outils/calc"); await m.waitForSelector(".calc");
  await m.screenshot({ path: out + "/mobile-calc.png" });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log("débordement horizontal mobile (px) =>", overflow);

  await browser.close();
  console.log(errors.length ? "ERREURS:\n" + errors.join("\n") : "aucune erreur JS");
})().catch((e) => { console.error(e); process.exit(1); });
