const assert = require("assert");
const { evaluate, format } = require("../js/calc-engine.js");

const ok = (expr, expected, opts) => {
  const got = evaluate(expr, opts);
  assert(Math.abs(got - expected) < 1e-9, `${expr} => ${got}, attendu ${expected}`);
};
const bad = (expr, opts) => assert.throws(() => evaluate(expr, opts), `${expr} devrait échouer`);

ok("2+3*4", 14);
ok("(2+3)*4", 20);
ok("2^3^2", 512);
ok("-2^2", -4);
ok("2^-1", 0.5);
ok("10/4", 2.5);
ok("10÷4", 2.5);
ok("6×7", 42);
ok("3,5+1,5", 5);
ok("sin(30)", 0.5);
ok("cos(60)", 0.5);
ok("sin(180)", 0);
ok("tan(45)", 1);
ok("sin(pi/2)", 1, { angle: "rad" });
ok("asin(0.5)", 30);
ok("sqrt(16)", 4);
ok("√9", 3);
ok("√(2+2)", 2);
ok("3!", 6);
ok("5!/3!", 20);
ok("50%", 0.5);
ok("2π", 2 * Math.PI);
ok("3(4+5)", 27);
ok("2sin(30)", 1);
ok("ln(e)", 1);
ok("log(1000)", 3);
ok("abs(-5)", 5);
ok("2e3", 2000);
ok("(2+3", 5);
ok("ans*2", 20, { ans: 10 });
ok("2*-3", -6);
ok("sin30", 0.5);

bad("1/0");
bad("2+");
bad(")");
bad("2++*3");
bad("foo(2)");
bad("sqrt(-1)");
bad("tan(90)");
bad("(-1)!");
bad("");
bad("2$3");
bad("5!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

assert.strictEqual(format(0.1 + 0.2), "0,3");
assert.strictEqual(format(0.1 + 0.2, false), "0.3");
assert.strictEqual(format(1 / 3), "0,333333333333");
assert.strictEqual(format(1e21), "1e21");
assert.strictEqual(format(-12), "-12");

console.log("calc-engine : tous les tests passent");
