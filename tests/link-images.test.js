const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "tools", "link-images.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "linkimg-"));
fs.mkdirSync(path.join(root, "data")); fs.mkdirSync(path.join(root, "image"));

const g = (id, title, thumb) => ({ id, title, category: "arcade", url: "games/" + id + "/index.html", thumb: Object.assign({ emoji: "🎮" }, thumb) });
const games = [
  g("snake", "Snake Classic"),
  g("2048", "2048"),
  g("demineur", "Démineur"),
  g("dm1", "Drive Mad"), g("dm2", "Drive Mad"),
  g("both", "Both Formats"),
  g("stale", "Stale", { img: "image/old-removed.jpg" }),
  g("shot", "Screenshot Game", { img: "img/games/shot.jpg", shot: true }),
  g("pong", "Neon Pong"),
  g("tetris", "Block Drop"),
];
const write = (f, size) => fs.writeFileSync(path.join(root, "image", f), Buffer.alloc(size || 10));
write("snake.JPG");                 /* majuscules dans l'extension */
write("2048.webp");
write("Démineur.png");              /* titre avec accent */
write("Drive Mad.png");             /* titre ambigu */
write("both.png"); write("both.webp"); /* deux formats : webp gagne */
write("Snake Classic.png");         /* même jeu que snake.JPG : double */
write("pnog.png");                  /* faute de frappe de « pong » */
write("notes.txt");                 /* pas une image : ignoré */
write("block-drop.jpg", 400 * 1024);/* titre avec tiret + image lourde */
fs.writeFileSync(path.join(root, "data", "games.json"), JSON.stringify(games, null, 2));

const run = (...a) => spawnSync("node", [script, "--root", root, ...a], { encoding: "utf8" });
const load = () => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, "data", "games.json"), "utf8")).map((x) => [x.id, x]));

// simulation : rien d'écrit
const before = fs.readFileSync(path.join(root, "data", "games.json"), "utf8");
let r = run("--dry-run");
assert.strictEqual(r.status, 0, r.stderr);
assert.strictEqual(fs.readFileSync(path.join(root, "data", "games.json"), "utf8"), before, "--dry-run n'écrit rien");

r = run();
assert.strictEqual(r.status, 0, r.stderr);
const d = load();
assert.strictEqual(d.snake.thumb.img, "image/snake.JPG", "par id");
assert.strictEqual(d["2048"].thumb.img, "image/2048.webp");
assert.strictEqual(d.demineur.thumb.img, "image/D%C3%A9mineur.png", "par titre, accent, URL encodée");
assert.strictEqual(d.dm1.thumb.img, undefined, "titre ambigu : aucun jeu choisi au hasard");
assert.strictEqual(d.both.thumb.img, "image/both.webp", "webp prioritaire sur png");
assert.strictEqual(d.stale.thumb.img, undefined, "image disparue : retirée");
assert.strictEqual(d.shot.thumb.img, undefined, "ancienne capture retirée, emoji gardé");
assert.strictEqual(d.shot.thumb.shot, undefined);
assert.strictEqual(d.pong.thumb.img, undefined, "faute de frappe : pas d'association devinée");
assert.strictEqual(d.tetris.thumb.img, "image/block-drop.jpg", "block-drop.jpg = titre « Block Drop » normalisé");
assert.strictEqual(d.snake.thumb.emoji, "🎮", "l'emoji reste toujours");
assert(/Nom ambigu.*Drive Mad\.png/s.test(r.stdout), "ambigu signalé");
assert(/pnog\.png.*pong/.test(r.stdout), "suggestion pour la faute de frappe : " + r.stdout);
assert(/Plusieurs fichiers.*Snake Classic\.png/.test(r.stdout), "double signalé");
assert(!/notes\.txt/.test(r.stdout), "fichier non image ignoré");

assert(/lourdes.*block-drop\.jpg/.test(r.stdout), "image lourde signalée");

// idempotent
r = run();
assert(/déjà à jour/.test(r.stdout), "2e passage : rien à changer");

// image ajoutée puis fichier supprimé
write("pong.png");
run(); assert.strictEqual(load().pong.thumb.img, "image/pong.png");
fs.unlinkSync(path.join(root, "image", "pong.png"));
run(); assert.strictEqual(load().pong.thumb.img, undefined, "fichier supprimé -> emoji");

// --keep-other garde les images venant d'ailleurs
const j = JSON.parse(fs.readFileSync(path.join(root, "data", "games.json"), "utf8"));
j.find((x) => x.id === "shot").thumb.img = "img/other/shot.jpg";
fs.writeFileSync(path.join(root, "data", "games.json"), JSON.stringify(j));
run("--keep-other"); assert.strictEqual(load().shot.thumb.img, "img/other/shot.jpg");

// sans dossier image/
fs.rmSync(path.join(root, "image"), { recursive: true });
r = run(); assert.strictEqual(r.status, 0); assert(/n'existe pas/.test(r.stdout));
assert(Object.values(load()).every((x) => !x.thumb.img || x.id === "shot"), "emoji pour tous");

// --list
r = run("--list"); assert(/snake\s+Snake Classic/.test(r.stdout));

// données illisibles
fs.writeFileSync(path.join(root, "data", "games.json"), "{pas du json");
r = run(); assert.notStrictEqual(r.status, 0);

fs.rmSync(root, { recursive: true });
console.log("link-images : tous les tests passent");
