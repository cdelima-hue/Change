/**
 * config_paises.js — v4.1
 * ======================================================
 * CONFIGURACIÓN DINÁMICA DE PAÍSES
 * ======================================================
 * 
 * REGLA GLOBAL FIJA (NO configurable):
 *   Máximo 30 horas por Change. Si > 30h → Proyecto.
 *   Aplica a TODOS los países sin excepción.
 *
 * CONFIGURABLE POR PAÍS (desde la UI, sin tocar código):
 *   - Nombre del país
 *   - Horas disponibles mensuales
 *   - Color en gráficos
 *   - Estado activo/inactivo
 *
 * Los países se guardan en localStorage para que puedan
 * agregarse nuevos desde la aplicación sin modificar código.
 */

// ============================================================
// REGLA GLOBAL FIJA — NO MODIFICAR
// ============================================================
const REGLA_MAX_HORAS_CHANGE = 30;
// Si horasChange <= 30 → "Mejora (Change)"
// Si horasChange > 30 → "Proyecto"

// ============================================================
// PAÍSES POR DEFECTO (solo se usan la primera vez)
// Después se administran desde la UI y se guardan en localStorage
// ============================================================
const PAISES_DEFAULT = [
  { key: 'Brasil',    nombre: 'Brasil',    horasDisponibles: 160, color: '#2563eb', activo: true },
  { key: 'Mexico',    nombre: 'México',    horasDisponibles: 120, color: '#16a34a', activo: true },
  { key: 'Argentina', nombre: 'Argentina', horasDisponibles: 100, color: '#d97706', activo: true },
  { key: 'Colombia',  nombre: 'Colombia',  horasDisponibles: 80,  color: '#7c3aed', activo: true },
  { key: 'Chile',     nombre: 'Chile',     horasDisponibles: 80,  color: '#dc2626', activo: true },
];

// ============================================================
// GESTIÓN DE PAÍSES EN LOCALSTORAGE
// ============================================================

function cargarPaisesDesdeStorage() {
  const raw = localStorage.getItem('nestle_config_paises_v4');
  if (raw) {
    try { return JSON.parse(raw); } catch (_) {}
  }
  // Primera vez: usar defaults y guardar
  localStorage.setItem('nestle_config_paises_v4', JSON.stringify(PAISES_DEFAULT));
  return [...PAISES_DEFAULT];
}

function guardarPaisesEnStorage(paises) {
  localStorage.setItem('nestle_config_paises_v4', JSON.stringify(paises));
}

function obtenerPaisesActivos() {
  return cargarPaisesDesdeStorage().filter(p => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function obtenerTodosPaises() {
  return cargarPaisesDesdeStorage().sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function obtenerConfigPais(paisKey) {
  if (!paisKey || paisKey === 'todos') {
    const activos = obtenerPaisesActivos();
    return {
      nombre: 'Todos los Países',
      horasDisponibles: activos.reduce((s, p) => s + p.horasDisponibles, 0),
      color: '#64748b',
      activo: true,
    };
  }
  const paises = cargarPaisesDesdeStorage();
  const found = paises.find(p => p.key === paisKey);
  return found || { nombre: paisKey, horasDisponibles: 100, color: '#94a3b8', activo: true };
}

function agregarPais(nombre, horasDisponibles, color) {
  const paises = cargarPaisesDesdeStorage();
  const key = nombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  if (paises.find(p => p.key === key)) return false; // ya existe
  paises.push({ key, nombre, horasDisponibles: parseInt(horasDisponibles) || 100, color: color || '#64748b', activo: true });
  guardarPaisesEnStorage(paises);
  return true;
}

function actualizarPais(key, horasDisponibles, activo) {
  const paises = cargarPaisesDesdeStorage();
  const idx = paises.findIndex(p => p.key === key);
  if (idx === -1) return false;
  paises[idx].horasDisponibles = parseInt(horasDisponibles) || paises[idx].horasDisponibles;
  paises[idx].activo = activo !== undefined ? activo : paises[idx].activo;
  guardarPaisesEnStorage(paises);
  return true;
}

function eliminarPais(key) {
  let paises = cargarPaisesDesdeStorage();
  paises = paises.filter(p => p.key !== key);
  guardarPaisesEnStorage(paises);
}

/**
 * Clasifica una Change según la regla global de 30h.
 * @param {number} horas
 * @returns {string} "Mejora" | "Proyecto"
 */
function clasificarChange(horas) {
  return horas <= REGLA_MAX_HORAS_CHANGE ? 'Mejora' : 'Proyecto';
}
