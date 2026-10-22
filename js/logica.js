/* Barrunto: lógica pura del juego, sin DOM. Se usa en el navegador (window.BarruntoLogica) y en las pruebas de Node. */
(function (raiz) {
  "use strict";

  const FILAS = 6, LETRAS = 5;
  const EMOJI = { correct: "🟩", present: "🟨", absent: "⬛" };

  // Mayúsculas y sin tildes, pero la Ñ se conserva como letra propia.
  function normalizar(s) {
    return String(s).toUpperCase()
      .replace(/Ñ/g, "\u0001")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\u0001/g, "Ñ");
  }

  // Colores como en Wordle: primero los verdes y luego los ocres, sin reutilizar letras de la palabra oculta.
  function puntuar(intento, oculta) {
    const r = Array(LETRAS).fill("absent");
    const o = [...oculta], g = [...intento];
    for (let i = 0; i < LETRAS; i++) if (g[i] === o[i]) { r[i] = "correct"; o[i] = g[i] = null; }
    for (let i = 0; i < LETRAS; i++) {
      if (!g[i]) continue;
      const j = o.indexOf(g[i]);
      if (j > -1) { r[i] = "present"; o[j] = null; }
    }
    return r;
  }

  // Fechas como AAAA-MM-DD en hora local.
  function fechaLocal(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function desplazarFecha(fecha, dias) {
    const [a, m, d] = fecha.split("-").map(Number);
    return fechaLocal(new Date(a, m - 1, d + dias));
  }

  // Devuelve la partida de hoy, o la más reciente ya publicada si hoy no hay, o ninguna.
  function elegirPartida(partidas, hoy) {
    const orden = [...partidas].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const deHoy = orden.find(p => p.fecha === hoy);
    if (deHoy) return { tipo: "hoy", partida: deHoy };
    const pasadas = orden.filter(p => p.fecha < hoy);
    const futuras = orden.filter(p => p.fecha > hoy);
    return {
      tipo: "ninguna",
      reciente: pasadas[pasadas.length - 1] || null,
      proxima: futuras[0] || null,
    };
  }

  function lineaFila(f) {
    if (f.puntos) return f.puntos.map(x => EMOJI[x]).join("");
    if (f.tipo === "resolver") return f.ok ? "🟩🟩🟩🟩🟩" : "🟥🟥🟥🟥🟥";
    return "⬜⬜⬜⬜⬜ ✗";
  }
  function textoCompartir(numero, estado, enlace) {
    const marcador = estado.estado === "won" ? estado.filas.length : "X";
    const lineas = [`Barrunto nº ${numero} · ${marcador}/${FILAS}`, ...estado.filas.map(lineaFila)];
    if (enlace) lineas.push(enlace);
    return lineas.join("\n");
  }

  function estadisticasVacias() {
    return { jugadas: 0, ganadas: 0, racha: 0, mejorRacha: 0, distribucion: [0, 0, 0, 0, 0, 0], ultimaVictoria: null };
  }
  // La racha sigue si la victoria anterior fue en la partida del día anterior.
  function registrarResultado(est, fecha, gano, filasUsadas) {
    est = Object.assign(estadisticasVacias(), est);
    est.distribucion = [...est.distribucion];
    est.jugadas++;
    if (gano) {
      est.ganadas++;
      est.distribucion[filasUsadas - 1]++;
      est.racha = est.ultimaVictoria === desplazarFecha(fecha, -1) ? est.racha + 1 : 1;
      est.mejorRacha = Math.max(est.mejorRacha, est.racha);
      est.ultimaVictoria = fecha;
    } else {
      est.racha = 0;
    }
    return est;
  }
  // La racha mostrada se rompe si ayer no se ganó.
  function rachaVigente(est, hoy) {
    if (!est.ultimaVictoria) return 0;
    return est.ultimaVictoria >= desplazarFecha(hoy, -1) ? est.racha : 0;
  }

  const api = {
    FILAS, LETRAS, normalizar, puntuar, fechaLocal, desplazarFecha, elegirPartida,
    textoCompartir, estadisticasVacias, registrarResultado, rachaVigente,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BarruntoLogica = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
