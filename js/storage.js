/* =========================================================
   STORAGE: guarda datos en el navegador (localStorage).
   Si el navegador no lo permite, la app sigue funcionando sin guardar.
   ========================================================= */

export function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; }
}

export function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ }
}

/* El avance se guarda por separado para cada carrera y cada plan */
export const claveAvance = (carreraId, planId) => `malla:${carreraId}:${planId}:aprobadas`;

export function leerAvance(carreraId, planId) {
  return new Set(leer(claveAvance(carreraId, planId)) || []);
}

export function guardarAvance(carreraId, planId, aprobadas) {
  guardar(claveAvance(carreraId, planId), [...aprobadas]);
}
