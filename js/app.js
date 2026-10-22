/* Barrunto: interfaz. La lógica pura está en logica.js. */
(function () {
  "use strict";
  const L = window.BarruntoLogica;
  const { FILAS, LETRAS } = L;
  const ROMANOS = ["I", "II", "III", "IV", "V", "VI"];
  const CLAVE_ESTADISTICAS = "barrunto-estadisticas";
  const CLAVE_AYUDA = "barrunto-ayuda-vista";
  const $ = id => document.getElementById(id);

  // ?fecha=AAAA-MM-DD fuerza otro día (útil para probar partidas futuras).
  const forzada = new URLSearchParams(location.search).get("fecha");
  const FECHA_FORZADA = /^\d{4}-\d{2}-\d{2}$/.test(forzada || "") ? forzada : null;
  const HOY = FECHA_FORZADA || L.fechaLocal();

  let PARTIDAS = [];
  let P = null;          // partida en juego, con respuestas normalizadas
  let S = null;          // estado guardado: { palabra, filas, estado, contada }
  let sel = null;        // índice de definición, "solve" o null
  let buf = [], pos = 0; // casillas de la fila en curso y casilla elegida
  let filaRevelar = -1, filaSacudir = -1;

  // ---------- almacenamiento ----------
  function leer(clave) { try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; } }
  function escribir(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {} }
  const claveEstado = () => "barrunto-partida-" + P.numero;
  const guardar = () => escribir(claveEstado(), S);

  // ---------- arranque ----------
  async function iniciar() {
    if (!leer(CLAVE_AYUDA)) { $("help").open = true; escribir(CLAVE_AYUDA, true); }
    $("btn-stats").addEventListener("click", abrirEstadisticas);
    document.addEventListener("keydown", teclaFisica);
    setInterval(tic, 1000);

    try {
      const res = await fetch("barrunto-partidas.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      PARTIDAS = (await res.json()).partidas || [];
    } catch (e) {
      aviso("No se han podido cargar las partidas", "Comprueba la conexión y vuelve a intentarlo.");
      return;
    }

    const eleccion = L.elegirPartida(PARTIDAS, HOY);
    if (eleccion.tipo === "hoy") jugar(eleccion.partida);
    else sinPartida(eleccion);
  }

  function jugar(partida) {
    P = {
      numero: partida.numero, fecha: partida.fecha, palabra: partida.palabra,
      oculta: L.normalizar(partida.palabra),
      defs: partida.definiciones.map(d => ({ pista: d.pista, respuesta: d.respuesta, clave: L.normalizar(d.respuesta) })),
    };
    S = leer(claveEstado());
    if (!S || S.palabra !== P.oculta || !Array.isArray(S.filas)) S = { palabra: P.oculta, filas: [], estado: "playing", contada: false };
    $("num").textContent = P.numero;
    $("num-box").hidden = false;
    document.title = "Barrunto nº " + P.numero;
    sel = null; vaciar();
    autoSeleccionar();
    render();
    window.scrollTo(0, 0);
  }

  function sinPartida(eleccion) {
    const { reciente, proxima } = eleccion;
    let texto;
    if (proxima) texto = `La próxima partida, Barrunto nº ${proxima.numero}, llega ${proxima.fecha === L.desplazarFecha(HOY, 1) ? "mañana" : "el " + fechaBonita(proxima.fecha)}.`;
    else texto = "Todavía no hay más partidas programadas. Vuelve pronto.";
    const card = aviso(reciente ? "Hoy no hay partida nueva" : "Barrunto aún no ha empezado", texto);
    if (proxima) { const nx = el("div", "next"); nx.id = "next"; card.appendChild(nx); tic(); }
    if (reciente) {
      const b = el("button", "btn", `Jugar la más reciente (nº ${reciente.numero})`);
      b.addEventListener("click", () => jugar(reciente));
      const acc = el("div", "actions"); acc.appendChild(b); card.appendChild(acc);
    }
  }

  function aviso(titulo, texto) {
    const card = el("div", "card");
    card.appendChild(el("h2", null, titulo));
    card.appendChild(el("p", null, texto));
    $("main").replaceChildren(card);
    $("kb").hidden = true;
    return card;
  }

  // ---------- estado ----------
  const filasRestantes = () => FILAS - S.filas.length;
  function autoSeleccionar() { if (S.estado === "playing" && filasRestantes() === 1) sel = "solve"; }
  function vaciar() { buf = Array(LETRAS).fill(""); pos = 0; }
  function filaDeDef(i) { return S.filas.find(f => f.tipo === "def" && f.def === i); }

  // Las teclas solo se colorean con las definiciones acertadas.
  function estadoLetras() {
    const rango = { absent: 1, present: 2, correct: 3 }, m = {};
    S.filas.forEach(f => {
      if (!f.puntos) return;
      [...f.palabra].forEach((c, i) => { const v = f.puntos[i]; if (!m[c] || rango[v] > rango[m[c]]) m[c] = v; });
    });
    return m;
  }

  // ---------- render ----------
  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function render() {
    const tablero = el("section", "board");
    tablero.setAttribute("aria-label", "Tablero");
    for (let i = 0; i < FILAS; i++) tablero.appendChild(renderFila(i));
    const panel = el("section");
    panel.appendChild(S.estado === "playing" ? renderDefiniciones() : renderFinal());
    $("main").replaceChildren(tablero, panel);
    if (filaSacudir > -1) tablero.children[filaSacudir].classList.add("shake");
    filaRevelar = filaSacudir = -1;
    renderTeclado();
  }

  function renderFila(i) {
    const f = S.filas[i];
    const row = el("div", "row"), tiles = el("div", "tiles"), cap = el("div", "cap");
    let letras = "", clases = Array(LETRAS).fill(""), activa = false;
    if (f) {
      letras = f.palabra;
      if (f.puntos) clases = f.puntos;
      else if (f.tipo === "resolver" && f.ok) clases = Array(LETRAS).fill("correct");
      else clases = Array(LETRAS).fill("void");
      if (f.tipo === "def") {
        cap.textContent = (f.ok ? "" : "✗ ") + P.defs[f.def].pista;
        cap.title = P.defs[f.def].pista;
      } else {
        cap.textContent = f.ok ? "La palabra oculta" : "✗ Intento de resolver";
      }
      if (!f.ok) cap.classList.add("fail");
    } else if (i === S.filas.length && S.estado === "playing") {
      row.classList.add("active");
      letras = buf;
      activa = true;
      cap.classList.add("lead");
      if (sel === "solve") cap.textContent = "Resolver: escribe la palabra oculta";
      else if (sel != null) { cap.textContent = P.defs[sel].pista; cap.title = P.defs[sel].pista; }
      else cap.textContent = "Elige una definición o resuelve";
    }
    for (let k = 0; k < LETRAS; k++) {
      const t = el("div", "tile" + (clases[k] ? " " + clases[k] : "") + (letras[k] && !clases[k] ? " filled" : ""), letras[k] || "");
      if (i === filaRevelar && clases[k] && clases[k] !== "void") { t.classList.add("flip"); t.style.animationDelay = k * 90 + "ms"; }
      if (activa) {
        // Se puede tocar cualquier casilla para escribir en ella.
        if (sel != null && k === pos) t.classList.add("cursor");
        t.addEventListener("click", () => { pos = k; render(); });
      }
      tiles.appendChild(t);
    }
    row.append(tiles, cap);
    return row;
  }

  function renderDefiniciones() {
    const quedan = filasRestantes();
    const wrap = el("div", "pick");
    const h = el("h2", null, "Definiciones ");
    h.appendChild(el("span", null, `${quedan} ${quedan === 1 ? "fila" : "filas"} · 5 letras cada una`));
    wrap.appendChild(h);
    const lista = el("div", "defs");
    P.defs.forEach((d, i) => {
      const hecha = filaDeDef(i);
      const b = el("button", "def");
      b.type = "button";
      const st = el("span", "st");
      b.append(el("span", "txt", d.pista), st);
      if (hecha) { b.disabled = true; b.classList.add(hecha.ok ? "done" : "lost"); st.textContent = hecha.ok ? hecha.palabra : "Fallada"; }
      else if (quedan === 1) { b.disabled = true; st.textContent = "—"; }
      else st.textContent = ROMANOS[i];
      if (sel === i) { b.classList.add("sel"); b.setAttribute("aria-pressed", "true"); }
      b.addEventListener("click", () => { sel = i; vaciar(); render(); });
      lista.appendChild(b);
    });
    const r = el("button", "def solve" + (sel === "solve" ? " sel" : ""));
    r.type = "button";
    r.append(el("span", "txt", "Resolver la palabra oculta"), el("span", "st", quedan === 1 ? "Última fila" : ""));
    r.addEventListener("click", () => { sel = "solve"; vaciar(); render(); });
    lista.appendChild(r);
    wrap.appendChild(lista);
    return wrap;
  }

  function tituloFinal() {
    if (S.estado !== "won") return "Hoy no ha podido ser";
    const n = S.filas.length;
    return n <= 2 ? "¡Magistral!" : n <= 4 ? "¡Bien barruntado!" : n === 5 ? "¡Resuelto!" : "¡Por los pelos!";
  }

  function renderFinal() {
    const c = el("div", "card");
    c.appendChild(el("h2", null, tituloFinal()));
    const p = el("p", null, "La palabra oculta era ");
    p.appendChild(el("span", "word", P.palabra));
    if (S.estado === "won") p.append(` · ${S.filas.length}/${FILAS}`);
    c.appendChild(p);

    const ul = el("ul");
    P.defs.forEach((d, i) => {
      const f = filaDeDef(i);
      const li = el("li");
      li.appendChild(el("b", null, d.respuesta.toLowerCase()));
      li.append(" · " + d.pista);
      if (!f) li.appendChild(el("span", "tag-unused", " (sin usar)"));
      else if (!f.ok) li.appendChild(el("span", "tag-fail", " (fallada)"));
      ul.appendChild(li);
    });
    c.appendChild(ul);

    const acc = el("div", "actions");
    const copiar = el("button", "btn", "Copiar resultado");
    copiar.addEventListener("click", () => compartir(copiar, c));
    const stats = el("button", "btn ghost", "Estadísticas");
    stats.addEventListener("click", abrirEstadisticas);
    acc.append(copiar, stats);
    c.appendChild(acc);

    const nx = el("div", "next"); nx.id = "next";
    c.appendChild(nx);
    setTimeout(tic);
    return c;
  }

  function renderTeclado() {
    const kb = $("kb");
    kb.hidden = false;
    kb.replaceChildren();
    const st = estadoLetras(), fin = S.estado !== "playing";
    ["QWERTYUIOP", "ASDFGHJKLÑ", "+ZXCVBNM-"].forEach(linea => {
      const r = el("div", "kr");
      [...linea].forEach(ch => {
        const k = el("button", "key");
        k.type = "button";
        k.disabled = fin;
        if (ch === "+") { k.textContent = "ENVIAR"; k.classList.add("wide"); k.onclick = enviar; }
        else if (ch === "-") { k.textContent = "⌫"; k.classList.add("wide"); k.setAttribute("aria-label", "Borrar"); k.onclick = borrar; }
        else { k.textContent = ch; if (st[ch]) k.classList.add(st[ch]); k.onclick = () => escribirLetra(ch); }
        r.appendChild(k);
      });
      kb.appendChild(r);
    });
  }

  // ---------- jugadas ----------
  let toastT;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), 1900);
  }
  function sacudirActiva() {
    const r = document.querySelector(".row.active");
    if (!r) return;
    r.classList.remove("shake"); void r.offsetWidth; r.classList.add("shake");
  }

  function escribirLetra(ch) {
    if (!S || S.estado !== "playing") return;
    if (sel == null) { toast("Primero elige una definición"); sacudirActiva(); return; }
    ({ casillas: buf, pos } = L.escribirEnCasilla(buf, pos, ch));
    render();
  }
  function borrar() {
    if (!S || S.estado !== "playing" || buf.every(c => !c)) return;
    ({ casillas: buf, pos } = L.borrarEnCasilla(buf, pos));
    render();
  }
  function moverCursor(d) {
    if (!S || S.estado !== "playing") return;
    pos = Math.max(0, Math.min(LETRAS - 1, pos + d));
    render();
  }
  function enviar() {
    if (!S || S.estado !== "playing") return;
    if (sel == null) { toast("Primero elige una definición"); sacudirActiva(); return; }
    if (buf.some(c => !c)) { toast("Faltan letras"); sacudirActiva(); return; }
    const palabra = buf.join("");
    const idx = S.filas.length;
    let ok;
    if (sel === "solve") {
      ok = palabra === P.oculta;
      S.filas.push({ tipo: "resolver", palabra, ok });
      if (ok) S.estado = "won"; else toast("No es la palabra oculta");
    } else {
      ok = palabra === P.defs[sel].clave;
      S.filas.push(ok ? { tipo: "def", def: sel, palabra, ok, puntos: L.puntuar(palabra, P.oculta) }
                      : { tipo: "def", def: sel, palabra, ok });
      if (!ok) toast("No es la respuesta: pierdes la fila");
    }
    if (S.estado === "playing" && filasRestantes() === 0) S.estado = "lost";
    if (ok) filaRevelar = idx; else filaSacudir = idx;
    sel = null; vaciar();
    autoSeleccionar();
    if (S.estado !== "playing" && !S.contada) {
      escribir(CLAVE_ESTADISTICAS, L.registrarResultado(leer(CLAVE_ESTADISTICAS), P.fecha, S.estado === "won", S.filas.length));
      S.contada = true;
      setTimeout(abrirEstadisticas, ok ? 1300 : 900);
    }
    guardar();
    render();
  }

  function teclaFisica(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("textarea,input,dialog")) return;
    if (e.key === "Enter") {
      // Si el foco está en un botón, Enter lo pulsa; si no, envía.
      if (e.target.closest && e.target.closest("button,summary")) return;
      e.preventDefault(); enviar();
    } else if (e.key === "Backspace") { e.preventDefault(); borrar(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (e.target.closest && e.target.closest("button,summary")) return;
      e.preventDefault(); moverCursor(e.key === "ArrowLeft" ? -1 : 1);
    }
    else if (/^[a-zñáéíóúü]$/i.test(e.key)) escribirLetra(L.normalizar(e.key));
  }

  // ---------- compartir ----------
  function enlaceJuego() { return location.origin + location.pathname; }
  async function compartir(btn, card) {
    const txt = L.textoCompartir(P.numero, S, enlaceJuego());
    try {
      await navigator.clipboard.writeText(txt);
      btn.textContent = "¡Copiado!";
      setTimeout(() => (btn.textContent = "Copiar resultado"), 1600);
      return;
    } catch (e) {}
    if (navigator.share) {
      try { await navigator.share({ text: txt }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    let ta = card.querySelector("textarea");
    if (!ta) {
      ta = el("textarea", "share-text");
      ta.readOnly = true; ta.rows = txt.split("\n").length;
      ta.value = txt;
      btn.parentNode.after(ta);
    }
    ta.focus(); ta.select();
    toast("Selecciona y copia el texto");
  }

  // ---------- estadísticas ----------
  function abrirEstadisticas() {
    const est = Object.assign(L.estadisticasVacias(), leer(CLAVE_ESTADISTICAS));
    const pct = est.jugadas ? Math.round(100 * est.ganadas / est.jugadas) : 0;
    const datos = [[est.jugadas, "Jugadas"], [pct, "% victorias"], [L.rachaVigente(est, HOY), "Racha actual"], [est.mejorRacha, "Mejor racha"]];
    $("stat-grid").replaceChildren(...datos.map(([v, t]) => { const d = el("div"); d.append(el("b", null, v), el("span", null, t)); return d; }));
    const max = Math.max(1, ...est.distribucion);
    const actual = S && S.estado === "won" ? S.filas.length : 0;
    $("dist").replaceChildren(...est.distribucion.map((n, i) => {
      const r = el("div", "dist-row");
      const bar = el("div", "dist-bar" + (i + 1 === actual ? " hot" : ""), n);
      bar.style.width = `${(100 * n / max).toFixed(1)}%`;
      r.append(el("span", null, i + 1), bar);
      return r;
    }));
    const d = $("stats");
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
  }

  // ---------- cuenta atrás y cambio de día ----------
  function fechaBonita(f) {
    const [a, m, d] = f.split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  }
  function tic() {
    if (!FECHA_FORZADA && L.fechaLocal() !== HOY) { location.reload(); return; }
    const nx = $("next");
    if (!nx) return;
    const manana = L.desplazarFecha(HOY, 1);
    const prox = PARTIDAS.filter(p => p.fecha >= manana).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    if (!prox) { nx.textContent = "No hay más partidas programadas por ahora."; return; }
    if (prox.fecha !== manana) { nx.textContent = `Siguiente Barrunto el ${fechaBonita(prox.fecha)}.`; return; }
    const ahora = new Date(), medianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    const s = Math.max(0, Math.floor((medianoche - ahora) / 1000));
    const dd = n => String(n).padStart(2, "0");
    nx.textContent = `Siguiente Barrunto en ${dd(Math.floor(s / 3600))}:${dd(Math.floor(s % 3600 / 60))}:${dd(s % 60)}`;
  }

  // ---------- service worker ----------
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  iniciar();
})();
