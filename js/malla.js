/* =========================================================
   MALLA: todo lo que se dibuja en pantalla
   - Columnas de semestres y tarjetas de materias
   - Colores según estado
   - Líneas de conexión al pasar el mouse
   ========================================================= */
import { estado } from "./reglas.js?v=6";

const ICONOS = {
  locked: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  available: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
  approved: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

export const tarjeta = (grid, id) => grid.querySelector(`.card[data-code="${CSS.escape(id)}"]`);

const tituloSemestre = nombre => /^[IVXL]+$/.test(nombre) ? `SEMESTRE ${nombre}` : nombre.toUpperCase();

/* Dibuja todas las columnas y tarjetas de un plan */
export function dibujarMalla(grid, modelo) {
  grid.querySelectorAll(".col").forEach(c => c.remove());
  grid.style.gridTemplateColumns = `repeat(${modelo.plan.semestres.length}, minmax(132px, 1fr))`;
  grid.style.minWidth = `${modelo.plan.semestres.length * 150}px`;

  modelo.plan.semestres.forEach((sem, i) => {
    const col = document.createElement("div");
    col.className = "col";
    const tarjetas = sem.materias.map(m => {
      const meses = modelo.meses(m.id);
      const detalle = [
        modelo.plan.mostrarCodigos ? m.id : (m.cr ? `${m.cr} créditos` : ""),
        meses > 1 ? `${meses} meses` : "",
      ].filter(Boolean).join(" · ");
      return `<div class="card" data-code="${m.id}">
        <span class="ico-slot"></span>
        <div class="name">${m.nombre}</div>
        <div class="code">${detalle}</div>
      </div>`;
    }).join("");
    col.innerHTML = `<div class="sem" data-sem="${i}">${tituloSemestre(sem.nombre)}</div>${tarjetas}`;
    grid.appendChild(col);
  });
}

/* Actualiza colores e íconos según lo aprobado */
export function pintarEstados(grid, modelo, aprobadas) {
  modelo.ids.forEach(id => {
    const st = estado(modelo, aprobadas, id);
    const el = tarjeta(grid, id);
    el.classList.remove("approved", "available", "locked");
    el.classList.add(st);
    el.querySelector(".ico-slot").innerHTML = ICONOS[st];
  });
  grid.querySelectorAll(".sem").forEach(h => {
    const ids = modelo.plan.semestres[h.dataset.sem].materias.map(m => m.id);
    h.classList.toggle("done", ids.every(id => aprobadas.has(id)));
  });
}

/* Curva entre dos tarjetas (por el costado si están en la misma columna) */
function curva(grid, modelo, desde, hasta) {
  const g = grid.getBoundingClientRect();
  const a = tarjeta(grid, desde).getBoundingClientRect();
  const b = tarjeta(grid, hasta).getBoundingClientRect();
  const y1 = a.top + a.height / 2 - g.top, y2 = b.top + b.height / 2 - g.top;
  const x2 = b.left - g.left;
  if (modelo.materias[desde].semestre === modelo.materias[hasta].semestre) {
    const x = a.left - g.left;
    return `M${x},${y1} C${x - 14},${y1} ${x2 - 14},${y2} ${x2},${y2}`;
  }
  const x1 = a.right - g.left, dx = Math.max(30, (x2 - x1) * .45);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

/* Resalta una materia, lo que necesita y lo que habilita */
export function enfocar(grid, svg, info, modelo, aprobadas, id) {
  grid.querySelectorAll(".is-focus,.is-pre,.is-next").forEach(e => e.classList.remove("is-focus", "is-pre", "is-next"));
  grid.classList.toggle("focusing", !!id);
  svg.setAttribute("width", grid.scrollWidth);
  svg.setAttribute("height", grid.scrollHeight);

  if (!id) {
    svg.innerHTML = "";
    info.textContent = "Pasa el mouse sobre una materia para ver qué necesita y qué habilita.";
    return;
  }

  const m = modelo.materias[id];
  // Solo se dibujan los prerrequisitos directos (no las ~30 líneas de una regla por semestre)
  const habilita = m.habilita.filter(h => modelo.materias[h].directos.includes(id));
  tarjeta(grid, id).classList.add("is-focus");
  m.directos.forEach(r => tarjeta(grid, r).classList.add("is-pre"));
  habilita.forEach(h => tarjeta(grid, h).classList.add("is-next"));

  svg.innerHTML =
    m.directos.map(r => `<path class="pre" d="${curva(grid, modelo, r, id)}"/>`).join("") +
    habilita.map(h => `<path class="next" d="${curva(grid, modelo, id, h)}"/>`).join("");

  const partes = [];
  if (m.porRegla) {
    const previas = m.requiere.filter(r => !m.directos.includes(r));
    const ok = previas.filter(r => aprobadas.has(r)).length;
    partes.push(`<span class="${ok === previas.length ? "p" : "x"}">todas las materias hasta el semestre ${m.hastaSemestre} (${ok}/${previas.length} aprobadas)</span>`);
  }
  m.directos.forEach(r => {
    const ok = aprobadas.has(r);
    partes.push(`<span class="${ok ? "p" : "x"}">${ok ? "✓" : "✗"} ${modelo.materias[r].nombre}</span>`);
  });
  const necesita = partes.join(", ") || "nada";
  const habilitaTxt = habilita.length ? habilita.map(h => modelo.materias[h].nombre).join(", ") : "ninguna materia";
  info.innerHTML = `<strong>${m.nombre}</strong><span>Necesita: ${necesita}</span><span class="n">Habilita: ${habilitaTxt}</span>`;
}
