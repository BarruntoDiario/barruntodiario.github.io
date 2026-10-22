// Ejecuta: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../js/logica.js");

const E = { correct: "🟩", present: "🟨", absent: "⬛" };
const emojis = (g, o) => L.puntuar(L.normalizar(g), L.normalizar(o)).map(x => E[x]).join("");

test("puntuación con letras repetidas", () => {
  assert.equal(emojis("LLAMA", "PLUMA"), "⬛🟩⬛🟩🟩");
  assert.equal(emojis("LIRIO", "CIRCO"), "⬛🟩🟩⬛🟩");
  assert.equal(emojis("VELLO", "LLAVE"), "🟨🟨🟨🟨⬛");
  assert.equal(emojis("PERLA", "PERLA"), "🟩🟩🟩🟩🟩");
  assert.equal(emojis("COCHE", "CIRCO"), "🟩🟨🟨⬛⬛");
});

test("normalización: sin tildes, Ñ propia", () => {
  assert.equal(L.normalizar("lémur"), "LEMUR");
  assert.equal(L.normalizar("ÁLBUM"), "ALBUM");
  assert.equal(L.normalizar("otoño"), "OTOÑO");
  assert.notEqual(L.normalizar("OTOÑO"), "OTONO");
});

test("escribir y borrar en la casilla elegida", () => {
  let r = L.escribirEnCasilla(["", "", "", "", ""], 2, "R");
  assert.deepEqual(r, { casillas: ["", "", "R", "", ""], pos: 3 });
  r = L.escribirEnCasilla(["", "", "R", "C", "O"], 4, "O");
  assert.equal(r.pos, 0); // vuelve al primer hueco
  r = L.escribirEnCasilla(["C", "I", "R", "C", "O"], 1, "A");
  assert.deepEqual(r, { casillas: ["C", "A", "R", "C", "O"], pos: 2 }); // sobrescribe
  assert.equal(L.escribirEnCasilla(["C", "I", "R", "C", ""], 4, "O").pos, 4);
  assert.deepEqual(L.borrarEnCasilla(["C", "I", "R", "", ""], 1), { casillas: ["C", "", "R", "", ""], pos: 1 });
  assert.deepEqual(L.borrarEnCasilla(["C", "I", "R", "", ""], 3), { casillas: ["C", "I", "", "", ""], pos: 2 });
  assert.deepEqual(L.borrarEnCasilla(["", "", "", "", ""], 0), { casillas: ["", "", "", "", ""], pos: 0 });
});

test("elección de partida por fecha local", () => {
  const ps = [{ numero: 1, fecha: "2026-10-23" }, { numero: 2, fecha: "2026-10-24" }];
  assert.equal(L.elegirPartida(ps, "2026-10-24").partida.numero, 2);
  const antes = L.elegirPartida(ps, "2026-10-22");
  assert.equal(antes.tipo, "ninguna"); assert.equal(antes.reciente, null); assert.equal(antes.proxima.numero, 1);
  const despues = L.elegirPartida(ps, "2026-12-01");
  assert.equal(despues.reciente.numero, 2); assert.equal(despues.proxima, null);
  assert.equal(L.fechaLocal(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(L.desplazarFecha("2026-11-01", -1), "2026-10-31");
});

test("texto para compartir", () => {
  const estado = { estado: "won", filas: [
    { tipo: "def", ok: true, puntos: ["correct", "absent", "present", "absent", "absent"] },
    { tipo: "def", ok: false },
    { tipo: "resolver", ok: false },
    { tipo: "resolver", ok: true },
  ] };
  assert.equal(L.textoCompartir(3, estado, "https://x.test/"),
    "Barrunto nº 3 · 4/6\n🟩⬛🟨⬛⬛\n⬜⬜⬜⬜⬜ ✗\n🟥🟥🟥🟥🟥\n🟩🟩🟩🟩🟩\nhttps://x.test/");
  assert.match(L.textoCompartir(3, { estado: "lost", filas: [] }), /^Barrunto nº 3 · X\/6$/);
});

test("estadísticas y rachas", () => {
  let e = L.registrarResultado(null, "2026-10-23", true, 4);
  e = L.registrarResultado(e, "2026-10-24", true, 3);
  assert.deepEqual([e.jugadas, e.ganadas, e.racha, e.mejorRacha], [2, 2, 2, 2]);
  assert.deepEqual(e.distribucion, [0, 0, 1, 1, 0, 0]);
  assert.equal(L.rachaVigente(e, "2026-10-25"), 2);
  assert.equal(L.rachaVigente(e, "2026-10-26"), 0);
  e = L.registrarResultado(e, "2026-10-26", true, 6); // se saltó un día
  assert.equal(e.racha, 1);
  e = L.registrarResultado(e, "2026-10-27", false, 6);
  assert.deepEqual([e.jugadas, e.racha, e.mejorRacha], [4, 0, 2]);
});

test("todas las partidas del JSON son válidas", () => {
  const datos = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "barrunto-partidas.json"), "utf8"));
  const fechas = new Set(), numeros = new Set();
  for (const p of datos.partidas) {
    assert.match(p.fecha, /^\d{4}-\d{2}-\d{2}$/, `fecha de la nº ${p.numero}`);
    assert.ok(!fechas.has(p.fecha), `fecha repetida ${p.fecha}`); fechas.add(p.fecha);
    assert.ok(!numeros.has(p.numero), `número repetido ${p.numero}`); numeros.add(p.numero);
    assert.match(L.normalizar(p.palabra), /^[A-ZÑ]{5}$/, `palabra de la nº ${p.numero}`);
    assert.equal(p.definiciones.length, 6, `nº ${p.numero}: hacen falta 6 definiciones`);
    for (const d of p.definiciones) {
      assert.match(L.normalizar(d.respuesta), /^[A-ZÑ]{5}$/, `nº ${p.numero}: «${d.respuesta}»`);
      assert.ok(d.pista && d.pista.trim(), `nº ${p.numero}: pista vacía`);
    }
  }
});
