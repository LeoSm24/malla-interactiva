/* =========================================================
   APP: punto de entrada
   - Carga el catálogo de carreras (data/carreras.json)
   - Maneja los selectores de carrera y plan
   - Conecta los clics con las reglas y el dibujo
   ========================================================= */
import { leer, guardar, leerAvance, guardarAvance } from "./storage.js";
import { crearModelo, estado, disponible, aprobar, desaprobar, mesesRestantes, planMesAMes } from "./reglas.js";
import { dibujarMalla, pintarEstados, enfocar, tarjeta } from "./malla.js";

const $ = id => document.getElementById(id);
const grid = $("grid"), svg = $("links"), info = $("info");

/* Estado de la app */
let catalogo = null;   // contenido de carreras.json
let carrera = null;    // carrera elegida
let planId = null;     // plan elegido
let modelo = null;     // plan convertido por crearModelo()
let aprobadas = new Set();
let fijada = null;     // materia seleccionada con clic
const cache = {};      // planes ya descargados

/* ---------- Utilidades de tiempo ---------- */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const sumarMeses = n => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d; };
const fmtMes = d => `${MESES[d.getMonth()]} ${d.getFullYear()}`;
function fmtDuracion(m) {
  const a = Math.floor(m / 12), r = m % 12, partes = [];
  if (a) partes.push(`${a} año${a > 1 ? "s" : ""}`);
  if (r) partes.push(`${r} mes${r > 1 ? "es" : ""}`);
  return partes.join(" y ") || "0 meses";
}

/* ---------- Avisos ---------- */
let tAviso;
function aviso(html, alerta = false) {
  const t = $("toast");
  t.innerHTML = html;
  t.classList.toggle("warn", alerta);
  t.classList.add("show");
  clearTimeout(tAviso);
  tAviso = setTimeout(() => t.classList.remove("show"), 2600);
}
const repetir = (el, clase) => { if (!el) return; el.classList.remove(clase); void el.offsetWidth; el.classList.add(clase); };
const animarDesbloqueo = ids => ids.forEach((id, i) => setTimeout(() => repetir(tarjeta(grid, id), "unlocking"), 120 + i * 110));
const nombre = id => modelo.materias[id].nombre;

/* ---------- Pintar resumen y plan ---------- */
function actualizar() {
  pintarEstados(grid, modelo, aprobadas);

  const total = modelo.ids.length, hechas = aprobadas.size, faltan = total - hechas;
  const ahora = modelo.ids.filter(id => estado(modelo, aprobadas, id) === "available")
    .sort((a, b) => modelo.materias[a].semestre - modelo.materias[b].semestre);
  const pct = Math.round(hechas / total * 100);

  $("kPct").textContent = pct + "%";
  $("bar").style.width = pct + "%";
  $("kApproved").textContent = `${hechas} de ${total} materias aprobadas`;
  $("kLeft").textContent = `${faltan} materia${faltan === 1 ? "" : "s"}`;
  $("kNow").textContent = `${ahora.length} disponible${ahora.length === 1 ? "" : "s"} para cursar ahora`;

  const meses = mesesRestantes(modelo, aprobadas);
  if (faltan === 0) {
    $("kTime").textContent = "¡Listo!";
    $("kDate").textContent = "Aprobaste todas las materias";
    $("planLead").innerHTML = "";
    $("timeline").innerHTML = `<p class="done-msg">🎓 ¡Felicidades, completaste la malla!</p>`;
  } else {
    const fin = sumarMeses(meses);
    $("kTime").textContent = fmtDuracion(meses);
    $("kDate").textContent = `Graduación estimada: ${fmtMes(fin)}`;
    const durs = Object.entries(modelo.plan.reglas?.duraciones || {})
      .filter(([id]) => modelo.materias[id]).map(([id, d]) => `${nombre(id)}: ${d} meses`).join(", ");
    $("planLead").innerHTML = `Te faltan <b>${faltan} materias</b>. A 1 mes por materia${durs ? ` (${durs})` : ""}, terminas en <b>${fmtDuracion(meses)}</b>, alrededor de <b>${fmtMes(fin)}</b>.`;
    const plan = planMesAMes(modelo, aprobadas);
    $("timeline").innerHTML = plan.map((p, i) => {
      const desde = sumarMeses(p.desde), hasta = sumarMeses(p.hasta), ultimo = i === plan.length - 1;
      const cuando = p.meses > 1 ? `${MESES[desde.getMonth()]}–${fmtMes(hasta)}` : fmtMes(desde);
      return `<li class="${i === 0 ? "go" : ""} ${ultimo ? "last" : ""}"><span>${cuando}</span>
        <b>${nombre(p.id)}${p.meses > 1 ? ` <em>· ${p.meses} meses</em>` : ""}${ultimo ? " 🎓" : ""}</b></li>`;
    }).join("");
  }
  $("nowLabel").style.display = ahora.length ? "" : "none";
  $("nowList").innerHTML = ahora.map(id => `<button class="chip" data-code="${id}">${nombre(id)}</button>`).join("");
}

const foco = id => enfocar(grid, svg, info, modelo, aprobadas, id);
const guardarTodo = () => guardarAvance(carrera.id, planId, aprobadas);

/* ---------- Aprobar / desaprobar una materia ---------- */
function alternar(id) {
  const st = estado(modelo, aprobadas, id);
  if (st === "locked") {
    repetir(tarjeta(grid, id), "shake");
    const faltan = modelo.materias[id].requiere.filter(r => !aprobadas.has(r));
    if (modelo.materias[id].porRegla) aviso(`🔒 Las electivas requieren todo hasta el semestre ${modelo.plan.reglas.electivas.requiereHastaSemestre} · te faltan <b>${faltan.length} materias</b>`, true);
    else aviso(`🔒 Primero aprueba: <b>${faltan.map(nombre).join(", ")}</b>`, true);
  } else if (st === "available") {
    const nuevas = aprobar(modelo, aprobadas, id);
    actualizar();
    repetir(tarjeta(grid, id), "approving");
    animarDesbloqueo(nuevas);
    aviso(nuevas.length ? `🔓 Desbloqueaste: <b>${nuevas.map(nombre).join(", ")}</b>` : `✓ <b>${nombre(id)}</b> aprobada`);
  } else {
    const quitadas = desaprobar(modelo, aprobadas, id);
    actualizar();
    aviso(quitadas.length > 1 ? `↩ Se quitó <b>${nombre(id)}</b> y ${quitadas.length - 1} que dependían de ella` : `↩ <b>${nombre(id)}</b> desmarcada`, true);
  }
  guardarTodo();
  fijada = id;
  foco(id);
}

/* ---------- Aprobar un semestre completo ---------- */
function alternarSemestre(cabecera) {
  const ids = modelo.plan.semestres[cabecera.dataset.sem].materias.map(m => m.id);
  const titulo = cabecera.textContent;
  if (ids.every(id => aprobadas.has(id))) {
    ids.forEach(id => desaprobar(modelo, aprobadas, id));
    actualizar();
    aviso(`↩ ${titulo} desmarcado`, true);
  } else {
    let nuevas = [], bloqueadas = 0;
    ids.forEach(id => {
      if (aprobadas.has(id)) return;
      if (disponible(modelo, aprobadas, id)) nuevas.push(...aprobar(modelo, aprobadas, id)); else bloqueadas++;
    });
    nuevas = [...new Set(nuevas)].filter(id => !aprobadas.has(id));
    actualizar();
    animarDesbloqueo(nuevas);
    aviso(bloqueadas ? `Aprobadas las disponibles · <b>${bloqueadas}</b> siguen bloqueadas` : `✓ ${titulo} aprobado`, !!bloqueadas);
  }
  guardarTodo();
  fijada = null;
  foco(null);
}

/* ---------- Carga de carrera y plan ---------- */
async function cargarPlan(nuevaCarreraId, nuevoPlanId) {
  carrera = catalogo.carreras.find(c => c.id === nuevaCarreraId) || catalogo.carreras[0];
  const planInfo = carrera.planes.find(p => p.id === nuevoPlanId)
    || carrera.planes.find(p => p.id === carrera.planPorDefecto) || carrera.planes[0];
  planId = planInfo.id;

  // Selectores
  $("careerSelect").value = carrera.id;
  $("planSeg").innerHTML = carrera.planes
    .map(p => `<button data-plan="${p.id}" class="${p.id === planId ? "on" : ""}">${p.nombre}</button>`).join("");
  $("planSeg").style.display = carrera.planes.length > 1 ? "" : "none";

  // Descarga el JSON del plan (solo la primera vez)
  if (!cache[planInfo.archivo]) {
    const resp = await fetch("data/" + planInfo.archivo, { cache: "no-cache" }); // siempre la versión más reciente
    if (!resp.ok) throw new Error(`No se encontró data/${planInfo.archivo}`);
    cache[planInfo.archivo] = await resp.json();
  }
  const plan = cache[planInfo.archivo];

  modelo = crearModelo(plan);
  aprobadas = new Set([...leerAvance(carrera.id, planId)].filter(id => modelo.materias[id]));
  fijada = null;

  $("planSub").textContent = `${catalogo.universidad || "Malla interactiva"} · ${plan.descripcion || plan.plan}`;
  document.title = `${carrera.nombre} — ${planInfo.nombre}`;
  $("status").style.display = "none";

  dibujarMalla(grid, modelo);
  actualizar();
  foco(null);
  repetir(grid, "switching");

  guardar("malla:ultima", { carrera: carrera.id, plan: planId });
  history.replaceState(null, "", `#${carrera.id}--${planId}`);
}

function leerHash() {
  const [c, p] = location.hash.slice(1).split("--");
  return c ? { carrera: c, plan: p } : null;
}

/* ---------- Eventos ---------- */
function conectarEventos() {
  grid.addEventListener("click", e => {
    const card = e.target.closest(".card");
    if (card) return alternar(card.dataset.code);
    const sem = e.target.closest(".sem");
    if (sem) return alternarSemestre(sem);
    fijada = null; foco(null);
  });
  grid.addEventListener("mouseover", e => { const c = e.target.closest(".card"); if (c) foco(c.dataset.code); });
  grid.addEventListener("mouseleave", () => foco(fijada));

  $("nowList").addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    alternar(chip.dataset.code);
    tarjeta(grid, chip.dataset.code)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  });

  $("careerSelect").addEventListener("change", e => cargarPlan(e.target.value).catch(mostrarError));
  $("planSeg").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b && b.dataset.plan !== planId) cargarPlan(carrera.id, b.dataset.plan).catch(mostrarError);
  });

  $("btnReset").addEventListener("click", () => {
    aprobadas.clear(); guardarTodo(); actualizar(); fijada = null; foco(null);
    aviso("Malla reiniciada", true);
  });
  $("btnTheme").addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    guardar("malla:tema", t);
  });
  window.addEventListener("resize", () => modelo && foco(fijada));
  window.addEventListener("hashchange", () => {
    const h = leerHash();
    if (h && (h.carrera !== carrera?.id || h.plan !== planId)) cargarPlan(h.carrera, h.plan).catch(mostrarError);
  });
}

function mostrarError(err) {
  console.error(err);
  $("status").style.display = "";
  $("status").innerHTML = `<b>No se pudo cargar la malla.</b><br>
    Si abriste el archivo con doble clic, ábrelo con un servidor (por ejemplo <code>Live Server</code> en VS Code).<br>
    <span style="font-size:12px">${err.message}</span>`;
}

/* Copia el avance guardado por la versión de un solo archivo (si existe) */
function migrarAvanceAnterior() {
  [["antigua", "antiguo"], ["nueva", "nuevo"]].forEach(([viejo, nuevo]) => {
    const datos = leer("malla-aprobadas-" + viejo);
    if (datos && !leer(`malla:ingenieria-sistemas:${nuevo}:aprobadas`)) guardar(`malla:ingenieria-sistemas:${nuevo}:aprobadas`, datos);
  });
}

/* ---------- Inicio ---------- */
async function iniciar() {
  document.documentElement.dataset.theme = leer("malla:tema") || "dark";
  conectarEventos();
  migrarAvanceAnterior();
  const resp = await fetch("data/carreras.json", { cache: "no-cache" });
  if (!resp.ok) throw new Error("No se encontró data/carreras.json");
  catalogo = await resp.json();

  $("careerSelect").innerHTML = catalogo.carreras.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
  const inicio = leerHash() || leer("malla:ultima") || {};
  await cargarPlan(inicio.carrera, inicio.plan);
}

iniciar().catch(mostrarError);
