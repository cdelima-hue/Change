/**
 * config_paises.js
 * ======================================================
 * CONFIGURACIÓN DE REGLAS DE NEGOCIO POR PAÍS
 * Portal de Gestión de Changes y Capacidad — Nestlé
 * ======================================================
 *
 * INSTRUCCIONES PARA ADMINISTRADORES:
 * Este archivo es la ÚNICA fuente de configuración de reglas por país.
 * Para modificar la capacidad de un país o agregar uno nuevo,
 * edita ÚNICAMENTE este archivo. No es necesario tocar app.js.
 *
 * ESTRUCTURA DE CADA PAÍS:
 * {
 *   nombre:             string  — Nombre visible en la UI
 *   horasDisponibles:   number  — Capacidad mensual total en horas
 *   maxHorasPorChange:  number  — Límite máximo de horas por Change
 *   activo:             boolean — Si aparece en los filtros del portal
 *   color:              string  — Color identificador en gráficos (hex)
 *   zona:               string  — Zona horaria principal del equipo
 * }
 *
 * REGLA UNIVERSAL (aplica a todos los países):
 *   horasChange <= maxHorasPorChange  →  "Small Enhancement (Mejora)"
 *   horasChange >  maxHorasPorChange  →  "Proyecto (fuera de alcance)"
 */

const CONFIG_PAISES = {
  Brasil: {
    nombre: 'Brasil',
    horasDisponibles: 160,
    maxHorasPorChange: 30,
    activo: true,
    color: '#2563eb',
    zona: 'America/Sao_Paulo',
    descripcion: 'Capacidad estándar región LAC.'
  },

  Mexico: {
    nombre: 'México',
    horasDisponibles: 120,
    maxHorasPorChange: 25,
    activo: true,
    color: '#16a34a',
    zona: 'America/Mexico_City',
    descripcion: 'Capacidad asignada para operaciones México.'
  },

  Argentina: {
    nombre: 'Argentina',
    horasDisponibles: 100,
    maxHorasPorChange: 20,
    activo: true,
    color: '#d97706',
    zona: 'America/Argentina/Buenos_Aires',
    descripcion: 'Capacidad asignada para operaciones Argentina.'
  },

  Colombia: {
    nombre: 'Colombia',
    horasDisponibles: 80,
    maxHorasPorChange: 20,
    activo: true,
    color: '#7c3aed',
    zona: 'America/Bogota',
    descripcion: 'Capacidad asignada para operaciones Colombia.'
  },

  Chile: {
    nombre: 'Chile',
    horasDisponibles: 80,
    maxHorasPorChange: 20,
    activo: true,
    color: '#dc2626',
    zona: 'America/Santiago',
    descripcion: 'Capacidad asignada para operaciones Chile.'
  },

  // -------------------------------------------------------
  // PARA AGREGAR UN NUEVO PAÍS, COPIA EL BLOQUE DE ABAJO:
  // -------------------------------------------------------
  // NuevoPais: {
  //   nombre: 'Nombre del País',
  //   horasDisponibles: 100,
  //   maxHorasPorChange: 25,
  //   activo: true,
  //   color: '#0891b2',
  //   zona: 'America/...',
  //   descripcion: 'Descripción opcional.'
  // },
};

/**
 * Obtiene la configuración de un país por su key.
 * Si el país no existe o es "todos", devuelve configuración global.
 * @param {string} paisKey — Key del país (ej. "Brasil", "Mexico")
 * @returns {object} Config del país
 */
function obtenerConfigPais(paisKey) {
  if (paisKey && paisKey !== 'todos' && CONFIG_PAISES[paisKey]) {
    return CONFIG_PAISES[paisKey];
  }
  // Si es "todos los países", se devuelve la suma de todos los activos
  const activos = Object.values(CONFIG_PAISES).filter(p => p.activo);
  return {
    nombre: 'Todos los Países',
    horasDisponibles: activos.reduce((s, p) => s + p.horasDisponibles, 0),
    maxHorasPorChange: Math.min(...activos.map(p => p.maxHorasPorChange)),
    activo: true,
    color: '#64748b',
    zona: 'UTC',
    descripcion: 'Consolidado de todos los países activos.'
  };
}

/**
 * Devuelve array de países activos ordenados por nombre.
 * @returns {Array<{key, config}>}
 */
function obtenerPaisesActivos() {
  return Object.entries(CONFIG_PAISES)
    .filter(([, cfg]) => cfg.activo)
    .sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre))
    .map(([key, cfg]) => ({ key, ...cfg }));
}

/**
 * Clasifica una Change según las reglas del país.
 * @param {number} horas — Horas estimadas
 * @param {string} paisKey — Key del país
 * @returns {string} "Mejora" | "Proyecto"
 */
function clasificarChange(horas, paisKey) {
  const cfg = obtenerConfigPais(paisKey);
  return horas <= cfg.maxHorasPorChange ? 'Mejora' : 'Proyecto';
}
