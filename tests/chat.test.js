const assert = require("assert");
const chat = require("../netlify/functions/chat.js");

const call = (body, over) =>
  chat.handler(Object.assign({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "t" + Math.random() }, body: JSON.stringify(body) }, over));

(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  assert.strictEqual((await call({})).statusCode, 503, "sans clé => 503");

  process.env.ANTHROPIC_API_KEY = "test-key";
  let seen;
  global.fetch = async (url, opts) => {
    seen = { url, opts, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "Bonjour !" }] }) };
  };

  assert.strictEqual((await chat.handler({ httpMethod: "GET", headers: {} })).statusCode, 405);
  assert.strictEqual((await call({ subject: "x", messages: [{ role: "user", content: "a" }] })).statusCode, 400, "matière inconnue");
  assert.strictEqual((await call({ subject: "__proto__", messages: [{ role: "user", content: "a" }] })).statusCode, 400, "__proto__ refusé");
  assert.strictEqual((await call({ subject: "maths", messages: [] })).statusCode, 400);
  assert.strictEqual((await call({ subject: "maths", messages: [{ role: "assistant", content: "a" }] })).statusCode, 400, "doit finir par user");
  assert.strictEqual((await call({ subject: "maths", messages: [{ role: "system", content: "a" }] })).statusCode, 400, "rôle invalide");
  assert.strictEqual((await call({ subject: "maths", messages: [{ role: "user", content: "x".repeat(2001) }] })).statusCode, 400, "trop long");
  assert.strictEqual((await chat.handler({ httpMethod: "POST", headers: {}, body: "pas du json" })).statusCode, 400);

  const r = await call({ subject: "maths", messages: [{ role: "user", content: "Combien font 2+2 ?" }] });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(JSON.parse(r.body).reply, "Bonjour !");
  assert.strictEqual(seen.url, "https://api.anthropic.com/v1/messages");
  assert.strictEqual(seen.opts.headers["x-api-key"], "test-key");
  assert.strictEqual(seen.body.model, "claude-haiku-5-5");
  assert(seen.body.system.includes("mathématiques"));
  assert(!r.body.includes("test-key"), "la clé ne fuit pas");

  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.strictEqual((await call({ subject: "maths", messages: [{ role: "user", content: "a" }] })).statusCode, 502);

  global.fetch = async () => { throw new Error("réseau"); };
  assert.strictEqual((await call({ subject: "maths", messages: [{ role: "user", content: "a" }] })).statusCode, 502);

  global.fetch = async () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "ok" }] }) });
  const ip = { headers: { "x-nf-client-connection-ip": "meme-ip" } };
  let last;
  for (let i = 0; i < 14; i++) last = await call({ subject: "maths", messages: [{ role: "user", content: "a" }] }, ip);
  assert.strictEqual(last.statusCode, 429, "limite de débit");

  console.log("chat function : tous les tests passent");
})().catch((e) => { console.error(e); process.exit(1); });
