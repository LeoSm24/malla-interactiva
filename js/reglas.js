/* =========================================================
   REGLAS: toda la lógica de la malla, sin tocar el HTML.
   - Arma el "modelo" a partir del JSON de un plan
   - Decide qué materias están aprobadas, disponibles o bloqueadas
   - Calcula el tiempo restante y el plan mes a mes
   ========================================================= */

/* Convierte el JSON de un plan en un modelo fácil de consultar */
export function crearModelo(plan) {
  const reglas = plan.reglas || {};
  const materias = {};

  plan.semestres.forEach((sem, i) => {
    sem.materias.forEach(m => {
      materias[m.id] = { ...m, requiere: [...(m.requiere || [])], semestre: i, habilita: [], porRegla: false };
    });
  });

  // Reglas por tipo: p. ej. electivas y prácticas requieren TODAS las materias hasta cierto semestre.
  // Se suman a los prerrequisitos propios de la materia (ej. Práctica II también pide Práctica I).
  const porTipo = reglas.requiereHastaSemestre || {};
  Object.values(materias).forEach(m => {
    m.directos = [...m.requiere];
    const hasta = porTipo[m.tipo];
    if (!hasta) return;
    const previas = Object.values(materias).filter(x => x.semestre < hasta && !porTipo[x.tipo]).map(x => x.id);
    m.requiere = [...new Set([...previas, ...m.directos])];
    m.porRegla = true;
    m.hastaSemestre = hasta;
  });

  // Validación: avisa en consola si un JSON pide una materia que no existe
  Object.values(materias).forEach(m => m.requiere.forEach(r => {
    if (!materias[r]) console.warn(`[malla] "${m.nombre}" requiere "${r}", que no existe en el plan`);
  }));

  // Relación inversa: qué materias habilita cada una
  Object.values(materias).forEach(m => m.requiere.forEach(r => materias[r]?.habilita.push(m.id)));

  return {
    plan,
    materias,
    ids: Object.keys(materias),
    meses: id => reglas.duraciones?.[id] ?? reglas.mesesPorMateria ?? 1,
  };
}

export const disponible = (modelo, aprobadas, id) =>
  modelo.materias[id].requiere.every(r => aprobadas.has(r));

export const estado = (modelo, aprobadas, id) =>
  aprobadas.has(id) ? "approved" : disponible(modelo, aprobadas, id) ? "available" : "locked";

/* Aprueba una materia y devuelve las que se desbloquearon */
export function aprobar(modelo, aprobadas, id) {
  const antes = new Set(modelo.ids.filter(x => disponible(modelo, aprobadas, x)));
  aprobadas.add(id);
  return modelo.ids.filter(x => !aprobadas.has(x) && !antes.has(x) && disponible(modelo, aprobadas, x));
}

/* Quita una materia y, en cadena, las que dependían de ella */
export function desaprobar(modelo, aprobadas, id) {
  const quitadas = [];
  (function quitar(x) {
    if (!aprobadas.has(x)) return;
    aprobadas.delete(x);
    quitadas.push(x);
    modelo.materias[x].habilita.forEach(quitar);
  })(id);
  return quitadas;
}

export const mesesRestantes = (modelo, aprobadas) =>
  modelo.ids.filter(id => !aprobadas.has(id)).reduce((t, id) => t + modelo.meses(id), 0);

/* Plan sugerido: 1 materia a la vez, siempre la disponible del semestre más bajo */
export function planMesAMes(modelo, aprobadas) {
  const hechas = new Set(aprobadas);
  const pendientes = modelo.ids.filter(id => !hechas.has(id));
  const plan = [];
  let mes = 0;
  while (plan.length < pendientes.length) {
    const siguiente = pendientes
      .filter(id => !hechas.has(id) && modelo.materias[id].requiere.every(r => hechas.has(r)))
      .sort((a, b) => modelo.materias[a].semestre - modelo.materias[b].semestre)[0];
    if (!siguiente) break;
    const duracion = modelo.meses(siguiente);
    plan.push({ id: siguiente, desde: mes + 1, hasta: mes + duracion, meses: duracion });
    mes += duracion;
    hechas.add(siguiente);
  }
  return plan;
}
