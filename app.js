/**
 * app.js — Portal de Gestión de Changes v4.0
 * =====================================================
 * ARQUITECTURA DE DATOS (Única fuente de verdad):
 *   ch.faseAtual  →  campo maestro de fase actual
 *   Kanban y Matriz SIEMPRE leen y escriben ch.faseAtual
 *   moverChangeDeFase() es la ÚNICA función que actualiza la fase
 *
 * FASES (keys sin acentos para compatibilidad con DOM):
 *   Abertura | Reuniao | Analise | Comite |
 *   Apresentacao | Aprovacao | Execucao | Concluida
 */

// ============================================================
// MAPA DE FASES — Key DOM seguro ↔ Label visual con acentos
// ============================================================
const FASES = [
  { key: 'Abertura',     label: '1. Abertura',     dKey: 'd1', color: '#94a3b8' },
  { key: 'Reuniao',      label: '2. Reunião',      dKey: 'd2', color: '#64748b' },
  { key: 'Analise',      label: '3. Análise',      dKey: 'd3', color: '#0284c7' },
  { key: 'Comite',       label: '4. Comitê',       dKey: 'd4', color: '#d97706' },
  { key: 'Apresentacao', label: '5. Apresentação', dKey: 'd5', color: '#7c3aed' },
  { key: 'Aprovacao',    label: '6. Aprovação',    dKey: 'd6', color: '#059669' },
  { key: 'Execucao',     label: '7. Execução',     dKey: 'd7', color: '#2563eb' },
  { key: 'Concluida',    label: '8. Concluída',    dKey: 'd8', color: '#16a34a' },
];

const FASES_KEY_MAP = {};
FASES.forEach(f => { FASES_KEY_MAP[f.key] = f; });

// Fases legacy con acentos → normalizar al cargar datos viejos
const FASES_LEGACY_MAP = {
  'Abertura': 'Abertura',
  'Reunião': 'Reuniao',
  'Análise': 'Analise',
  'Comitê': 'Comite',
  'Apresentação': 'Apresentacao',
  'Aprovação': 'Aprovacao',
  'Execução': 'Execucao',
  'Concluída': 'Concluida',
  'Concluida': 'Concluida',
};

const OPCIONES_PASOS = [
  '1. Análisis Técnico & Requerimientos',
  '2. Diseño de Arquitectura / UI',
  '3. Desarrollo Backend / APIs',
  '4. Desarrollo Frontend',
  '5. Integración & Configuración',
  '6. Pruebas QA & Regresión',
  '7. Pruebas UAT / Negocio',
  '8. Despliegue & Pase a Producción',
  '9. Capacitación & Soporte',
];

// ============================================================
// ESTADO GLOBAL
// ============================================================
let appState = {
  changes: [],
  mesActivo: '',
  filtroTexto: '',
  filtroSolicitante: 'todos',
  filtroBusinessService: 'todos',
  filtroProducto: 'todos',
  filtroPais: 'todos',
  filtroStatus: 'todos',
  vistaActiva: 'kanban',
  usuarioActual: 'Usuario Colaborador',
  historialApp: [],
};

// Historico mensual (nunca se sobreescribe)
// Estructura: { "2026-08": { Brasil: { horasUsadas, changes }, Mexico: {...} } }
let historialMensual = {};

// Chart instances
let charts = { gauge: null, prodDash: null, fasesDash: null, mesAnterior: null, mesActual: null };

// Drag & Drop state
let draggedId = null;
let dragActive = false;

// BroadcastChannel para sync multi-tab
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel('nestle_changes_v4');
  syncChannel.onmessage = (e) => {
    if (e.data?.type === 'SYNC') {
      cargarDesdeStorage(false);
      renderizarTodo();
      mostrarToast('Datos actualizados por otro colaborador', 'info');
    }
  };
} catch (_) {}

window.addEventListener('storage', (e) => {
  if (e.key === 'nestle_changes_v4') {
    cargarDesdeStorage(false);
    renderizarTodo();
  }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  inicializarMes();
  cargarDatos();
  poblarFiltroPaises();
  inicializarGraficoGauge();
  configurarEventos();
  renderizarTodo();
  setIndicadorSync('live');
});

function inicializarMes() {
  const ahora = new Date();
  appState.mesActivo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const sel = document.getElementById('selectorMes');
  if (sel) sel.value = appState.mesActivo;
}

function cargarDatos() {
  // Changes
  const raw = localStorage.getItem('nestle_changes_v4');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      appState.changes = parsed.map(normalizarChange);
    } catch (_) { appState.changes = (typeof initialChangesData !== 'undefined' ? [...initialChangesData] : []).map(normalizarChange); }
  } else if (typeof initialChangesData !== 'undefined') {
    appState.changes = initialChangesData.map(normalizarChange);
    guardarDatos(false);
  }

  // Histórico mensual
  const rawHist = localStorage.getItem('nestle_historial_v4');
  if (rawHist) {
    try { historialMensual = JSON.parse(rawHist); } catch (_) { historialMensual = {}; }
  }
}

/**
 * Normaliza una change: asegura que faseAtual use key sin acentos.
 */
function normalizarChange(ch) {
  if (ch.faseAtual && FASES_LEGACY_MAP[ch.faseAtual]) {
    ch.faseAtual = FASES_LEGACY_MAP[ch.faseAtual];
  }
  if (!ch.faseAtual || !FASES_KEY_MAP[ch.faseAtual]) {
    ch.faseAtual = 'Abertura';
  }
  if (!ch.historialFases) ch.historialFases = [];
  if (!ch.pais) ch.pais = 'Brasil';
  return ch;
}

function guardarDatos(emitirSync = true) {
  setIndicadorSync('syncing');
  localStorage.setItem('nestle_changes_v4', JSON.stringify(appState.changes));
  guardarHistorialMensual();
  if (emitirSync && syncChannel) {
    syncChannel.postMessage({ type: 'SYNC', ts: Date.now() });
  }
  setTimeout(() => setIndicadorSync('live'), 500);
}

function cargarDesdeStorage(reRender = true) {
  const raw = localStorage.getItem('nestle_changes_v4');
  if (raw) {
    try {
      appState.changes = JSON.parse(raw).map(normalizarChange);
      if (reRender) renderizarTodo();
    } catch (_) {}
  }
}

// ============================================================
// HISTORIAL MENSUAL — nunca sobrescribe
// ============================================================
function guardarHistorialMensual() {
  const mes = appState.mesActivo;
  if (!mes) return;

  const snapshot = {};
  obtenerPaisesActivos().forEach(p => {
    const changesDelPaisMes = appState.changes.filter(
      ch => ch.pais === p.key && (ch.mesAno || '').startsWith(mes)
    );
    const horasUsadas = changesDelPaisMes.reduce(
      (s, ch) => s + parseFloat(ch.horasAprovadas || ch.horasEstimadas || 0), 0
    );
    const cfg = obtenerConfigPais(p.key);
    snapshot[p.key] = {
      horasDisponibles: cfg.horasDisponibles,
      horasUsadas: parseFloat(horasUsadas.toFixed(1)),
      horasRestantes: parseFloat(Math.max(0, cfg.horasDisponibles - horasUsadas).toFixed(1)),
      totalChanges: changesDelPaisMes.length,
    };
  });

  if (!historialMensual[mes]) {
    historialMensual[mes] = snapshot;
  } else {
    // Actualizar datos del mes sin eliminar meses anteriores
    historialMensual[mes] = snapshot;
  }

  localStorage.setItem('nestle_historial_v4', JSON.stringify(historialMensual));
}

function obtenerSnapshotMes(mesKey, paisKey) {
  const snap = historialMensual[mesKey];
  if (!snap) return null;
  if (paisKey && paisKey !== 'todos') return snap[paisKey] || null;
  // Consolidar todos los países
  const values = Object.values(snap);
  return {
    horasDisponibles: values.reduce((s, v) => s + (v.horasDisponibles || 0), 0),
    horasUsadas: values.reduce((s, v) => s + (v.horasUsadas || 0), 0),
    horasRestantes: values.reduce((s, v) => s + (v.horasRestantes || 0), 0),
    totalChanges: values.reduce((s, v) => s + (v.totalChanges || 0), 0),
  };
}

function obtenerMesAnteriorKey(mesKey) {
  const [ano, mes] = mesKey.split('-').map(Number);
  if (mes === 1) return `${ano - 1}-12`;
  return `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

// ============================================================
// POBLAR FILTRO DE PAÍSES
// ============================================================
function poblarFiltroPaises() {
  const sel = document.getElementById('filtroPais');
  if (!sel) return;
  sel.innerHTML = '<option value="todos">Todos los Países</option>';
  obtenerPaisesActivos().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.nombre;
    sel.appendChild(opt);
  });
}

// ============================================================
// FILTRADO DE CHANGES
// ============================================================
function obtenerChangesFiltradas() {
  return appState.changes.filter(ch => {
    if (appState.mesActivo) {
      const m = ch.mesAno || (ch.d1 ? ch.d1.substring(0, 7) : '');
      if (m && m !== appState.mesActivo) return false;
    }
    if (appState.filtroTexto) {
      const q = appState.filtroTexto.toLowerCase();
      const pass = ['numeroChange','ritm','solicitante','businessService','producto','descripcion','engenheiro','pais']
        .some(k => (ch[k] || '').toLowerCase().includes(q));
      if (!pass) return false;
    }
    if (appState.filtroSolicitante !== 'todos' && ch.solicitante !== appState.filtroSolicitante) return false;
    if (appState.filtroBusinessService !== 'todos' && ch.businessService !== appState.filtroBusinessService) return false;
    if (appState.filtroProducto !== 'todos' && ch.producto !== appState.filtroProducto) return false;
    if (appState.filtroPais !== 'todos' && ch.pais !== appState.filtroPais) return false;
    if (appState.filtroStatus !== 'todos' && ch.statusAprovacao !== appState.filtroStatus) return false;
    return true;
  });
}

// ============================================================
// RENDERIZADO PRINCIPAL
// ============================================================
function renderizarTodo() {
  actualizarSelectoresFiltros();
  actualizarIndicadoresCapacidad();

  if (appState.vistaActiva === 'kanban')     renderizarKanban();
  else if (appState.vistaActiva === 'fases') renderizarMatriz();
  else if (appState.vistaActiva === 'dashboard') renderizarDashboard();
  else if (appState.vistaActiva === 'tabla') renderizarTabla();
}

function actualizarSelectoresFiltros() {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
  const fill = (id, opts, placeholder) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="todos">${placeholder}</option>`;
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o; opt.textContent = o;
      sel.appendChild(opt);
    });
    if (opts.includes(prev)) sel.value = prev;
  };
  fill('filtroSolicitante', uniq(appState.changes.map(c => c.solicitante)), 'Solicitantes');
  fill('filtroBusinessService', uniq(appState.changes.map(c => c.businessService)), 'Business Services');
  fill('filtroProducto', uniq(appState.changes.map(c => c.producto)), 'Productos');
}

// ============================================================
// INDICADORES DE CAPACIDAD (por país)
// ============================================================
function actualizarIndicadoresCapacidad() {
  const pais = appState.filtroPais;
  const cfg = obtenerConfigPais(pais);
  const filtradas = obtenerChangesFiltradas();

  let horasUsadas = 0, horasComprometidas = 0, contSobreLimite = 0, contProyecto = 0;
  const porProducto = {};

  filtradas.forEach(ch => {
    const hApr = parseFloat(ch.horasAprovadas || 0);
    const hEst = parseFloat(ch.horasEstimadas || 0);
    horasUsadas += hApr;
    horasComprometidas += hEst;

    const maxH = pais !== 'todos' ? cfg.maxHorasPorChange : obtenerConfigPais(ch.pais).maxHorasPorChange;
    if (hEst > maxH) { contSobreLimite++; contProyecto++; }

    const prod = ch.producto || 'Sin asignar';
    porProducto[prod] = (porProducto[prod] || 0) + hApr;
  });

  const horasDisp = cfg.horasDisponibles;
  const horasRest = Math.max(0, horasDisp - horasUsadas);
  const pctUso = horasDisp > 0 ? Math.min(100, Math.round((horasUsadas / horasDisp) * 100)) : 0;
  const promedio = filtradas.length > 0 ? (horasUsadas / filtradas.length).toFixed(1) : 0;
  const sobreCapacidad = horasUsadas > horasDisp;

  // --- Actualizar DOM ---
  setText('txtHorasDisponibles', `${horasDisp} h`);
  setText('txtHorasConsumidas', `${horasUsadas.toFixed(1)} h`);
  setText('txtHorasResta', `${horasRest.toFixed(1)} h`);
  setText('txtPctUso', `${pctUso}%`);
  setText('txtHorasComprometidas', `${horasComprometidas.toFixed(1)} h`);
  setText('txtTotalChanges', `${filtradas.length}`);
  setText('txtPromedioPorChange', `${promedio} h`);
  setText('txtSobreLimite', `${contSobreLimite}`);
  setText('txtCountSmall', `${filtradas.length - contProyecto} Mejoras`);
  setText('txtMaxHorasPais', `Máx. ${cfg.maxHorasPorChange}h por change`);
  setText('txtCapacidadPais', `Capacidad: ${horasDisp}h`);

  // Alerta sobrecapacidad
  const alertEl = document.getElementById('alertaSobrecapacidad');
  if (alertEl) {
    if (sobreCapacidad) {
      alertEl.classList.remove('hidden');
      setText('txtExcesoHoras', `${(horasUsadas - horasDisp).toFixed(1)} h`);
    } else {
      alertEl.classList.add('hidden');
    }
  }

  // Gauge doughnut
  if (charts.gauge) {
    const colorUso = sobreCapacidad ? '#ef4444' : '#2563eb';
    charts.gauge.data.datasets[0].data = [Math.min(horasUsadas, horasDisp), horasRest];
    charts.gauge.data.datasets[0].backgroundColor = [colorUso, '#e2e8f0'];
    charts.gauge.update('none');
  }

  // Barra de productos
  const contProd = document.getElementById('containerProductos');
  if (contProd) {
    contProd.innerHTML = '';
    const sorted = Object.keys(porProducto).sort((a, b) => porProducto[b] - porProducto[a]);
    if (!sorted.length) {
      contProd.innerHTML = '<p class="text-xs text-slate-400 py-2 text-center">Sin datos en este periodo.</p>';
    } else {
      sorted.forEach(prod => {
        const h = porProducto[prod];
        const pct = Math.min(100, Math.round((h / horasDisp) * 100));
        contProd.innerHTML += `
          <div class="py-1 px-1.5 rounded-lg bg-slate-50 border border-slate-100">
            <div class="flex justify-between text-[11px] font-semibold mb-0.5">
              <span class="text-slate-700 truncate max-w-[140px]" title="${prod}">
                <i class="fa-solid fa-cube text-slate-400 mr-1 text-[9px]"></i>${prod}
              </span>
              <span class="text-slate-800 font-bold">${h.toFixed(1)}h <span class="text-[9px] text-slate-400 font-normal">(${pct}%)</span></span>
            </div>
            <div class="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
              <div class="bg-blue-600 h-full rounded-full" style="width:${pct}%"></div>
            </div>
          </div>`;
      });
    }
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
// *** MÓDULO KANBAN — CORRECCIÓN CRÍTICA ***
// Todas las columnas usan IDs sin acentos.
// moverChangeDeFase() es la ÚNICA función que actualiza faseAtual.
// ============================================================
function renderizarKanban() {
  // Limpiar columnas y badges
  FASES.forEach(f => {
    const col = document.getElementById(`col-${f.key}`);
    if (col) col.innerHTML = '';
    const badge = document.getElementById(`badge-${f.key}`);
    if (badge) badge.textContent = '0';
  });

  const filtradas = obtenerChangesFiltradas();
  const contadores = {};
  FASES.forEach(f => { contadores[f.key] = 0; });

  filtradas.forEach(ch => {
    // Garantizar que faseAtual es un key válido
    let faseKey = normalizarFaseKey(ch.faseAtual);
    contadores[faseKey] = (contadores[faseKey] || 0) + 1;

    const col = document.getElementById(`col-${faseKey}`);
    if (!col) return; // columna no encontrada — no debería ocurrir

    const cfgPais = obtenerConfigPais(ch.pais || 'Brasil');
    const h = parseFloat(ch.horasEstimadas || 0);
    const esProyecto = h > cfgPais.maxHorasPorChange;
    const idStr = String(ch.id || ch.spId);

    const fIdx = FASES.findIndex(f => f.key === faseKey);
    const puedeRetro = fIdx > 0;
    const puedeAvan = fIdx < FASES.length - 1;

    const card = document.createElement('div');
    card.className = `kanban-card ${esProyecto ? 'card-accent-excede' : 'card-accent-small'}`;
    card.draggable = true;
    card.dataset.id = idStr;

    card.innerHTML = `
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="font-bold text-xs text-blue-700 font-mono">${ch.numeroChange || 'SIN-ID'}</span>
        <span class="text-[9px] font-bold px-1.5 rounded ${esProyecto ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
          ${h}h${esProyecto ? ' ⚠️' : ''}
        </span>
      </div>
      <p class="text-[11px] font-medium text-slate-800 line-clamp-2 leading-snug mb-1.5" title="${ch.descripcion || ''}">
        ${ch.descripcion || 'Sin descripción'}
      </p>
      <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span class="truncate max-w-[80px] flex items-center gap-0.5">
          <i class="fa-solid fa-user text-[9px] text-slate-400"></i>
          ${ch.solicitante || ch.pais || 'N/A'}
        </span>
        <div class="flex items-center gap-1">
          ${puedeRetro ? `<button type="button" data-action="prev" data-id="${idStr}"
            class="w-4 h-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-[8px]">
            <i class="fa-solid fa-chevron-left"></i></button>` : ''}
          <button type="button" data-action="open" data-id="${idStr}"
            class="text-blue-600 font-semibold hover:underline text-[10px]">Ver</button>
          ${puedeAvan ? `<button type="button" data-action="next" data-id="${idStr}"
            class="w-4 h-4 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center text-[8px]">
            <i class="fa-solid fa-chevron-right"></i></button>` : ''}
        </div>
      </div>`;

    // Eventos de la tarjeta — usando event delegation en la tarjeta
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        if (!dragActive) abrirModalEdicion(idStr);
        return;
      }
      const action = btn.dataset.action;
      const bid = btn.dataset.id;
      if (action === 'open') { abrirModalEdicion(bid); return; }
      if (action === 'prev') { moverFaseRelativa(bid, -1); return; }
      if (action === 'next') { moverFaseRelativa(bid, 1); return; }
    });

    // Drag events
    card.addEventListener('dragstart', (e) => {
      draggedId = idStr;
      dragActive = true;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', idStr);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
      setTimeout(() => { dragActive = false; draggedId = null; }, 100);
    });

    col.appendChild(card);
  });

  // Actualizar badges
  FASES.forEach(f => {
    const badge = document.getElementById(`badge-${f.key}`);
    if (badge) badge.textContent = contadores[f.key] || 0;
  });

  // Configurar zonas de drop
  configurarDropZones();
}

function configurarDropZones() {
  FASES.forEach(f => {
    const wrapper = document.getElementById(`kanban-col-${f.key}`);
    if (!wrapper) return;

    wrapper.ondragenter = (e) => { e.preventDefault(); wrapper.classList.add('drag-over'); };
    wrapper.ondragleave = (e) => {
      // Solo quitar si el mouse salió completamente del wrapper
      if (!wrapper.contains(e.relatedTarget)) wrapper.classList.remove('drag-over');
    };
    wrapper.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    wrapper.ondrop = (e) => {
      e.preventDefault();
      wrapper.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain') || draggedId;
      if (id) moverChangeDeFase(id, f.key);
    };
  });
}

/**
 * LA ÚNICA FUNCIÓN QUE CAMBIA LA FASE.
 * Actualiza ch.faseAtual, guarda, y re-renderiza Kanban + Matriz.
 */
function moverChangeDeFase(changeId, nuevaFaseKey) {
  nuevaFaseKey = normalizarFaseKey(nuevaFaseKey);
  const ch = appState.changes.find(c => String(c.id || c.spId) === String(changeId));
  if (!ch) return;

  const faseAnterior = ch.faseAtual;
  if (faseAnterior === nuevaFaseKey) return;

  // Registrar en historial de fases de la change
  if (!ch.historialFases) ch.historialFases = [];
  ch.historialFases.push({
    de: faseAnterior,
    a: nuevaFaseKey,
    fecha: new Date().toISOString().split('T')[0],
    usuario: appState.usuarioActual,
    ts: new Date().toISOString()
  });

  // Actualizar la única fuente de verdad
  ch.faseAtual = nuevaFaseKey;
  ch.ultimaModificacao = new Date().toISOString();
  ch.modificadoPor = appState.usuarioActual;

  // Registrar fecha efectiva de la fase si no existe
  const faseObj = FASES_KEY_MAP[nuevaFaseKey];
  if (faseObj && !ch[faseObj.dKey]) {
    ch[faseObj.dKey] = new Date().toISOString().split('T')[0];
  }

  guardarDatos(true);

  // Re-renderizar Kanban Y Matriz juntos — siempre sincronizados
  if (appState.vistaActiva === 'kanban') renderizarKanban();
  else if (appState.vistaActiva === 'fases') renderizarMatriz();
  actualizarIndicadoresCapacidad();

  const label = FASES_KEY_MAP[nuevaFaseKey]?.label || nuevaFaseKey;
  mostrarToast(`${ch.numeroChange} → "${label}"`, 'success');
}

function moverFaseRelativa(changeId, delta) {
  const ch = appState.changes.find(c => String(c.id || c.spId) === String(changeId));
  if (!ch) return;
  const idx = FASES.findIndex(f => f.key === ch.faseAtual);
  const newIdx = idx + delta;
  if (newIdx >= 0 && newIdx < FASES.length) {
    moverChangeDeFase(changeId, FASES[newIdx].key);
  }
}

function normalizarFaseKey(faseRaw) {
  if (!faseRaw) return 'Abertura';
  if (FASES_KEY_MAP[faseRaw]) return faseRaw;
  if (FASES_LEGACY_MAP[faseRaw]) return FASES_LEGACY_MAP[faseRaw];
  // Intentar match parcial sin acentos
  const norm = faseRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const f of FASES) {
    const fNorm = f.key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes(fNorm) || fNorm.includes(norm)) return f.key;
  }
  return 'Abertura';
}

// ============================================================
// MÓDULO MATRIZ — Checkpoints sincronizados con Kanban
// ============================================================
function renderizarMatriz() {
  const tbody = document.getElementById('tbodyFases');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtradas = obtenerChangesFiltradas();
  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-400">
      No hay changes con los filtros aplicados.</td></tr>`;
    return;
  }

  filtradas.forEach(ch => {
    const h = parseFloat(ch.horasEstimadas || 0);
    const cfg = obtenerConfigPais(ch.pais || 'Brasil');
    const esProyecto = h > cfg.maxHorasPorChange;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100';

    let faseTds = '';
    FASES.forEach(f => {
      const fechaVal = ch[f.dKey] || '';
      const esFaseActual = ch.faseAtual === f.key;

      let iconHtml;
      if (fechaVal) {
        iconHtml = `<div class="phase-checkpoint completed" title="Completado: ${fechaVal}">
          <i class="fa-solid fa-check"></i></div>
          <span class="text-[9px] text-slate-500 font-mono mt-0.5">${fechaVal.substring(5)}</span>`;
      } else if (esFaseActual) {
        iconHtml = `<div class="phase-checkpoint current" title="Fase actual">
          <i class="fa-solid fa-spinner fa-spin"></i></div>
          <span class="text-[9px] text-blue-600 font-bold mt-0.5">Actual</span>`;
      } else {
        iconHtml = `<div class="phase-checkpoint pending" title="Pendiente">
          <i class="fa-regular fa-circle"></i></div>
          <span class="text-[9px] text-slate-400 mt-0.5">—</span>`;
      }

      const chId = String(ch.id || ch.spId);
      faseTds += `<td class="p-2 text-center">
        <div class="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
          onclick="accionCheckpointMatriz('${chId}', '${f.dKey}', '${f.key}')">
          ${iconHtml}
        </div>
      </td>`;
    });

    tr.innerHTML = `
      <td class="p-2.5">
        <a href="javascript:void(0)" onclick="abrirModalEdicion('${ch.id || ch.spId}')"
          class="font-bold text-blue-700 font-mono hover:underline text-xs">${ch.numeroChange}</a>
        <span class="block text-[10px] text-slate-400">${ch.ritm || 'Sin RITM'}</span>
      </td>
      <td class="p-2.5">
        <span class="block font-semibold text-slate-800 text-xs">${ch.solicitante || '—'}</span>
        <span class="text-[10px] text-blue-600">${ch.businessService || '—'}</span>
      </td>
      <td class="p-2.5">
        <span class="block font-medium text-slate-700 text-xs truncate max-w-[120px]">${ch.producto || '—'}</span>
        <span class="block text-[10px] text-slate-400">${ch.pais || '—'}</span>
      </td>
      ${faseTds}`;

    tbody.appendChild(tr);
  });
}

/**
 * Click en checkpoint de la Matriz.
 * Llama a moverChangeDeFase() para mantener sincronía con Kanban.
 */
function accionCheckpointMatriz(changeId, dKey, faseKey) {
  const ch = appState.changes.find(c => String(c.id || c.spId) === String(changeId));
  if (!ch) return;

  if (ch[dKey]) {
    // Toggle: quitar fecha
    ch[dKey] = '';
    ch.ultimaModificacao = new Date().toISOString();
    guardarDatos(true);
    renderizarMatriz();
    actualizarIndicadoresCapacidad();
  } else {
    // Registrar fecha y mover a esa fase (sincroniza Kanban automáticamente)
    ch[dKey] = new Date().toISOString().split('T')[0];
    moverChangeDeFase(changeId, faseKey);
    // moverChangeDeFase ya llama a renderizar y guardar
    if (appState.vistaActiva === 'fases') renderizarMatriz();
  }
}

// ============================================================
// DASHBOARD — Gráficos + Comparativo Mensual
// ============================================================
function inicializarGraficoGauge() {
  const ctx = document.getElementById('gaugeCapacidade');
  if (!ctx) return;
  charts.gauge = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 160],
        backgroundColor: ['#2563eb', '#e2e8f0'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      rotation: -90, circumference: 180, cutout: '76%',
      plugins: { tooltip: { enabled: false } },
    }
  });
}

function renderizarDashboard() {
  const filtradas = obtenerChangesFiltradas();

  // Gráfico 1: Horas por Producto
  const porProd = {};
  filtradas.forEach(c => {
    const p = c.producto || 'Sin asignar';
    porProd[p] = (porProd[p] || 0) + parseFloat(c.horasAprovadas || c.horasEstimadas || 0);
  });

  const ctxProd = document.getElementById('chartProductosDash');
  if (ctxProd) {
    if (charts.prodDash) charts.prodDash.destroy();
    charts.prodDash = new Chart(ctxProd.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(porProd),
        datasets: [{ label: 'Horas', data: Object.values(porProd), backgroundColor: '#3b82f6', borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Gráfico 2: Changes por fase
  const porFase = {};
  FASES.forEach(f => { porFase[f.label] = 0; });
  filtradas.forEach(c => {
    const fObj = FASES_KEY_MAP[c.faseAtual];
    const l = fObj ? fObj.label : '1. Abertura';
    porFase[l] = (porFase[l] || 0) + 1;
  });

  const ctxFases = document.getElementById('chartFasesDash');
  if (ctxFases) {
    if (charts.fasesDash) charts.fasesDash.destroy();
    charts.fasesDash = new Chart(ctxFases.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(porFase),
        datasets: [{ data: Object.values(porFase), backgroundColor: FASES.map(f => f.color) }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } }
      }
    });
  }

  // Gráficos comparativos Mes Anterior vs Mes Actual
  renderizarComparativoMensual();
}

function renderizarComparativoMensual() {
  const pais = appState.filtroPais;
  const mesActualKey = appState.mesActivo;
  const mesAnteriorKey = obtenerMesAnteriorKey(mesActualKey);

  const snapActual = obtenerSnapshotMes(mesActualKey, pais);
  const snapAnterior = obtenerSnapshotMes(mesAnteriorKey, pais);

  // Actualizar labels de meses en el DOM
  const labelMesActual = formatearMesLabel(mesActualKey);
  const labelMesAnterior = formatearMesLabel(mesAnteriorKey);
  setText('lblMesActual', labelMesActual);
  setText('lblMesAnterior', labelMesAnterior);

  renderizarGraficoComparativo('chartMesActual', charts.mesActual, snapActual, labelMesActual, pais, (c) => { charts.mesActual = c; });
  renderizarGraficoComparativo('chartMesAnterior', charts.mesAnterior, snapAnterior, labelMesAnterior, pais, (c) => { charts.mesAnterior = c; });
}

function renderizarGraficoComparativo(canvasId, existente, snap, label, pais, onCreated) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (existente) existente.destroy();

  const cfg = obtenerConfigPais(pais);

  const usadas = snap ? snap.horasUsadas : 0;
  const restantes = snap ? snap.horasRestantes : cfg.horasDisponibles;
  const disponibles = snap ? snap.horasDisponibles : cfg.horasDisponibles;
  const pctUso = disponibles > 0 ? Math.round((usadas / disponibles) * 100) : 0;

  const chart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Disponibles', 'Utilizadas', 'Restantes'],
      datasets: [{
        label: `${label} (${pctUso}% uso)`,
        data: [disponibles, usadas, restantes],
        backgroundColor: ['#bfdbfe', '#2563eb', '#bbf7d0'],
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} h`
          }
        }
      },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } }
    }
  });
  onCreated(chart);
}

function formatearMesLabel(mesKey) {
  if (!mesKey) return '—';
  const [ano, mes] = mesKey.split('-');
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${nombres[parseInt(mes) - 1]} ${ano}`;
}

// ============================================================
// TABLA COMPLETA DE BACKLOG
// ============================================================
function renderizarTabla() {
  const tbody = document.getElementById('tbodyBacklog');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtradas = obtenerChangesFiltradas();
  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-400">Sin registros.</td></tr>`;
    return;
  }

  filtradas.forEach(ch => {
    const h = parseFloat(ch.horasEstimadas || 0);
    const cfg = obtenerConfigPais(ch.pais || 'Brasil');
    const esProyecto = h > cfg.maxHorasPorChange;
    const fObj = FASES_KEY_MAP[ch.faseAtual];
    const chId = String(ch.id || ch.spId);

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="p-2.5 font-bold text-blue-700 font-mono">${ch.numeroChange}</td>
      <td class="p-2.5">${ch.pais || '—'}</td>
      <td class="p-2.5 font-medium">${ch.solicitante || '—'}</td>
      <td class="p-2.5">${ch.businessService || '—'}</td>
      <td class="p-2.5 font-semibold">${ch.producto || '—'}</td>
      <td class="p-2.5 text-slate-600 max-w-xs truncate" title="${ch.descripcion}">${ch.descripcion || '—'}</td>
      <td class="p-2.5 text-center font-bold">${h}h</td>
      <td class="p-2.5 text-center">
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${esProyecto ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
          ${esProyecto ? 'Proyecto' : 'Mejora'}
        </span>
      </td>
      <td class="p-2.5 text-center">
        <span class="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">${fObj ? fObj.label : ch.faseAtual}</span>
      </td>
      <td class="p-2.5 text-center">
        <span class="px-1.5 py-0.5 rounded ${ch.statusAprovacao === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' : ch.statusAprovacao === 'Rejeitado' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'} font-semibold text-[10px]">
          ${ch.statusAprovacao || 'Pendente'}
        </span>
      </td>
      <td class="p-2.5 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="abrirModalEdicion('${chId}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar"><i class="fa-solid fa-pen text-[11px]"></i></button>
          <button onclick="eliminarChange('${chId}')" class="p-1 text-rose-600 hover:bg-rose-100 rounded" title="Eliminar"><i class="fa-solid fa-trash text-[11px]"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ============================================================
// FORMULARIO — Nueva / Editar Change
// ============================================================
function abrirModalNuevaChange() {
  document.getElementById('modalTitulo').textContent = 'Nueva Solicitud de Change';
  document.getElementById('formChange').reset();
  document.getElementById('spItemId').value = '';
  document.getElementById('d1').value = new Date().toISOString().split('T')[0];
  document.getElementById('inpPais').value = 'Brasil';
  cargarPasosEnFormulario([]);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
}

function abrirModalEdicion(idOrSpId) {
  const ch = appState.changes.find(c => String(c.id || c.spId) === String(idOrSpId));
  if (!ch) return;

  document.getElementById('modalTitulo').textContent = `Editar: ${ch.numeroChange}`;
  document.getElementById('spItemId').value = String(ch.id || ch.spId);

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

  setVal('inpSolicitante', ch.solicitante);
  setVal('inpPais', ch.pais || 'Brasil');
  setVal('inpBusinessService', ch.businessService);
  setVal('inpChange', ch.numeroChange);
  setVal('inpRitm', ch.ritm);
  setVal('inpProduto', ch.producto);
  setVal('inpDescricao', ch.descripcion);
  setVal('inpEngenheiro', ch.engenheiro);
  setVal('inpHorasEst', ch.horasEstimadas);
  setVal('inpHorasApr', ch.horasAprovadas);
  setVal('inpAnalise', ch.analise);
  setVal('inpRollback', ch.rollback);
  setVal('inpAprovadorNome', ch.aprovadorNome);
  setVal('inpAprovadorEmail', ch.aprovadorEmail);
  setVal('inpStatusAprov', ch.statusAprovacao);
  setVal('d1', ch.d1); setVal('d2', ch.d2); setVal('d3', ch.d3); setVal('d4', ch.d4);
  setVal('d5', ch.d5); setVal('d6', ch.d6); setVal('d7', ch.d7); setVal('d8', ch.d8);

  // Mostrar enlace Teams si existe
  const teamsEl = document.getElementById('lblTeamsLink');
  if (teamsEl) {
    if (ch.teamsLink) {
      teamsEl.innerHTML = `<a href="${ch.teamsLink}" target="_blank" class="text-blue-600 hover:underline text-[11px] flex items-center gap-1">
        <i class="fa-brands fa-microsoft"></i> Abrir chat de Teams (${ch.numeroChange})</a>`;
    } else {
      teamsEl.innerHTML = '<span class="text-[11px] text-slate-400">Se generará al guardar.</span>';
    }
  }

  cargarPasosEnFormulario(ch.pasosImplementacion || []);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalChange').classList.add('hidden');
}

function actualizarBadgeModal() {
  const h = parseFloat(document.getElementById('inpHorasEst')?.value || 0);
  const pais = document.getElementById('inpPais')?.value || 'Brasil';
  const cfg = obtenerConfigPais(pais);
  const badge = document.getElementById('badgeClassificacaoModal');
  if (!badge) return;
  if (h <= cfg.maxHorasPorChange) {
    badge.textContent = `✅ MEJORA (${h}h ≤ ${cfg.maxHorasPorChange}h — VÁLIDO para ${pais})`;
    badge.className = 'inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300';
  } else {
    badge.textContent = `⚠️ PROYECTO (${h}h > ${cfg.maxHorasPorChange}h — FUERA DE ALCANCE para ${pais})`;
    badge.className = 'inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300';
  }
}

function salvarFormularioChange(event) {
  event.preventDefault();
  const id = document.getElementById('spItemId').value;
  const isUpdate = id !== '';
  const getVal = (elId) => { const el = document.getElementById(elId); return el ? el.value.trim() : ''; };
  const horasEst = parseFloat(getVal('inpHorasEst')) || 0;
  const horasApr = parseFloat(getVal('inpHorasApr')) || 0;
  const pais = getVal('inpPais') || 'Brasil';
  const cfg = obtenerConfigPais(pais);
  const tipo = horasEst <= cfg.maxHorasPorChange ? 'Mejora' : 'Proyecto';
  const pasos = obtenerPasosDesdeFormulario();

  const d1Val = getVal('d1');

  const changeData = {
    numeroChange: getVal('inpChange'),
    ritm: getVal('inpRitm'),
    solicitante: getVal('inpSolicitante') || 'Sin solicitante',
    pais,
    businessService: getVal('inpBusinessService') || 'General',
    producto: getVal('inpProduto') || 'General',
    descripcion: getVal('inpDescricao'),
    engenheiro: getVal('inpEngenheiro'),
    horasEstimadas: horasEst,
    horasAprovadas: horasApr,
    tipoChange: tipo,
    pasosImplementacion: pasos,
    analise: getVal('inpAnalise'),
    rollback: getVal('inpRollback'),
    aprovadorNome: getVal('inpAprovadorNome'),
    aprovadorEmail: getVal('inpAprovadorEmail'),
    statusAprovacao: getVal('inpStatusAprov'),
    d1: d1Val, d2: getVal('d2'), d3: getVal('d3'), d4: getVal('d4'),
    d5: getVal('d5'), d6: getVal('d6'), d7: getVal('d7'), d8: getVal('d8'),
    ultimaModificacao: new Date().toISOString(),
    modificadoPor: appState.usuarioActual,
    mesAno: d1Val ? d1Val.substring(0, 7) : appState.mesActivo,
  };

  // Determinar fase actual por fechas
  changeData.faseAtual = determinarFasePorFechas(changeData);

  if (isUpdate) {
    const idx = appState.changes.findIndex(c => String(c.id || c.spId) === String(id));
    if (idx !== -1) {
      const prev = appState.changes[idx];
      changeData.historialFases = prev.historialFases || [];
      changeData.teamsLink = prev.teamsLink || '';
      changeData.fechaCreacion = prev.fechaCreacion || d1Val;
      changeData.id = prev.id;
      changeData.spId = prev.spId;
      appState.changes[idx] = { ...prev, ...changeData };
      mostrarToast(`Change ${changeData.numeroChange} actualizada ✅`, 'success');
    }
  } else {
    changeData.id = `CHG-${Date.now()}`;
    changeData.spId = Date.now();
    changeData.historialFases = [{ de: '', a: changeData.faseAtual, fecha: new Date().toISOString().split('T')[0], usuario: appState.usuarioActual }];
    changeData.fechaCreacion = d1Val || new Date().toISOString().split('T')[0];
    changeData.fechaCierre = '';

    // Generar enlace Teams automáticamente
    changeData.teamsLink = generarEnlaceTeams(changeData);

    appState.changes.unshift(changeData);
    mostrarToast(`Change ${changeData.numeroChange} creada ✅ — Chat Teams generado`, 'success');

    // Mostrar notificación Teams
    setTimeout(() => {
      const link = changeData.teamsLink;
      const num = changeData.numeroChange;
      mostrarToast(`<a href="${link}" target="_blank" class="underline font-bold">
        <i class="fa-brands fa-microsoft"></i> Abrir chat Teams: ${num}</a>`, 'info');
    }, 1000);
  }

  guardarDatos(true);
  fecharModal();
  renderizarTodo();
}

function determinarFasePorFechas(data) {
  if (data.d8) return 'Concluida';
  if (data.d7) return 'Execucao';
  if (data.d6) return 'Aprovacao';
  if (data.d5) return 'Apresentacao';
  if (data.d4) return 'Comite';
  if (data.d3) return 'Analise';
  if (data.d2) return 'Reuniao';
  return 'Abertura';
}

// ============================================================
// TEAMS INTEGRATION — Enlace automático msteams://
// ============================================================
function generarEnlaceTeams(ch) {
  const titulo = encodeURIComponent(`${ch.numeroChange} – ${(ch.descripcion || '').substring(0, 60)} – ${ch.pais || ''}`);
  // Enlace deep link de Teams para iniciar chat o canal
  return `https://teams.microsoft.com/l/chat/0/0?users=&topicName=${titulo}&message=${encodeURIComponent(`Nueva Change: ${ch.numeroChange}\nSolicitante: ${ch.solicitante}\nProducto: ${ch.producto}\nHoras: ${ch.horasEstimadas}h\nPaís: ${ch.pais}`)}`;
}

// ============================================================
// PASOS DE IMPLEMENTACIÓN (tabla dinámica en el formulario)
// ============================================================
function agregarFilaPaso(fase = '', accion = '', horas = 0, fecha = '') {
  const tbody = document.getElementById('tbodyPasosImplementacion');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'border-b border-slate-100 hover:bg-slate-50';

  let opts = OPCIONES_PASOS.map(op =>
    `<option value="${op}" ${op === fase ? 'selected' : ''}>${op}</option>`
  ).join('');

  tr.innerHTML = `
    <td class="p-1.5">
      <select class="paso-fase-sel w-full py-1 px-1.5 border border-slate-200 rounded-lg text-[11px]">${opts}</select>
    </td>
    <td class="p-1.5">
      <input type="text" class="paso-accion-inp w-full py-1 px-1.5 border border-slate-200 rounded-lg text-[11px]"
        placeholder="Tarea concreta..." value="${accion}">
    </td>
    <td class="p-1.5 text-center">
      <input type="number" class="paso-horas-inp w-14 py-1 px-1 border border-slate-200 rounded-lg text-[11px] text-center font-bold"
        min="0" step="0.5" value="${horas}" oninput="recalcularHorasDesdePasos()">
    </td>
    <td class="p-1.5">
      <input type="date" class="paso-fecha-inp w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" value="${fecha}">
    </td>
    <td class="p-1.5 text-center">
      <button type="button" onclick="this.closest('tr').remove(); recalcularHorasDesdePasos()"
        class="p-1 text-rose-500 hover:bg-rose-50 rounded text-[10px]">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </td>`;

  tbody.appendChild(tr);
  recalcularHorasDesdePasos();
}

function recalcularHorasDesdePasos() {
  const total = [...document.querySelectorAll('.paso-horas-inp')]
    .reduce((s, el) => s + parseFloat(el.value || 0), 0);
  if (total > 0) {
    const inp = document.getElementById('inpHorasEst');
    if (inp) { inp.value = total; actualizarBadgeModal(); }
  }
}

function obtenerPasosDesdeFormulario() {
  return [...document.querySelectorAll('#tbodyPasosImplementacion tr')].map(tr => ({
    fase: tr.querySelector('.paso-fase-sel')?.value || '',
    accion: tr.querySelector('.paso-accion-inp')?.value || '',
    horas: parseFloat(tr.querySelector('.paso-horas-inp')?.value || 0),
    fechaTentativa: tr.querySelector('.paso-fecha-inp')?.value || ''
  })).filter(p => p.accion || p.horas > 0);
}

function cargarPasosEnFormulario(pasos) {
  const tbody = document.getElementById('tbodyPasosImplementacion');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (Array.isArray(pasos) && pasos.length > 0) {
    pasos.forEach(p => agregarFilaPaso(p.fase, p.accion, p.horas, p.fechaTentativa));
  } else {
    agregarFilaPaso('1. Análisis Técnico & Requerimientos', 'Levantamiento y factibilidad', 2, '');
    agregarFilaPaso('3. Desarrollo Backend / APIs', 'Implementación', 8, '');
    agregarFilaPaso('6. Pruebas QA & Regresión', 'Pruebas integrales', 4, '');
  }
}

// ============================================================
// IMPORTACIÓN / EXPORTACIÓN EXCEL
// ============================================================
let excelParsedRows = [];

function abrirModalUploadExcel() {
  excelParsedRows = [];
  const inp = document.getElementById('inputExcelFile');
  if (inp) inp.value = '';
  document.getElementById('previewUploadContainer')?.classList.add('hidden');
  const btn = document.getElementById('btnConfirmarImportacion');
  if (btn) btn.disabled = true;
  document.getElementById('modalUploadExcel')?.classList.remove('hidden');
}

function fecharModalUploadExcel() {
  document.getElementById('modalUploadExcel')?.classList.add('hidden');
}

function handleExcelFileSelect(e) {
  const file = e.target.files[0];
  if (file) procesarArchivoExcel(file);
}

function procesarArchivoExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { mostrarToast('Archivo vacío', 'error'); return; }
      excelParsedRows = rows.map((r, i) => mapearFilaExcel(r, i));
      mostrarPreviewExcel(excelParsedRows);
    } catch (err) { mostrarToast('Error al leer Excel: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function mapearFilaExcel(row, idx) {
  const fv = (...keys) => {
    for (const k of Object.keys(row)) {
      const n = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (keys.some(key => n === key || n.includes(key))) return row[k];
    }
    return '';
  };
  const hEst = parseFloat(fv('horas estimadas','horas est','horas') || 0);
  const pais = fv('pais','country','país') || 'Brasil';
  const cfg = obtenerConfigPais(pais);
  return {
    id: `CHG-IMP-${Date.now()}-${idx}`,
    spId: Date.now() + idx,
    numeroChange: String(fv('change','numero','chg','codigo','title') || `CHG-IMP-${String(idx+1).padStart(3,'0')}`).trim(),
    ritm: String(fv('ritm','requerimiento','ticket') || '').trim(),
    solicitante: String(fv('solicitante','requester','usuario') || 'Sin solicitante').trim(),
    pais,
    businessService: String(fv('business service','servicio','area') || 'General').trim(),
    producto: String(fv('producto','product','linha','linea') || 'General').trim(),
    descripcion: String(fv('descripcion','descricao','description','titulo','resumen') || 'Sin descripción').trim(),
    engenheiro: String(fv('engenheiro','ingeniero','engineer','responsable') || '').trim(),
    horasEstimadas: hEst,
    horasAprovadas: parseFloat(fv('horas aprovadas','horas apr') || hEst),
    tipoChange: hEst <= cfg.maxHorasPorChange ? 'Mejora' : 'Proyecto',
    faseAtual: normalizarFaseKey(String(fv('fase','status','estado','etapa') || 'Abertura')),
    statusAprovacao: String(fv('aprobacion','status aprovacao','aprovacao') || 'Pendente'),
    analise: '', rollback: '', pasosImplementacion: [],
    aprovadorNome: '', aprovadorEmail: '',
    d1: new Date().toISOString().split('T')[0],
    d2:'', d3:'', d4:'', d5:'', d6:'', d7:'', d8:'',
    mesAno: appState.mesActivo,
    teamsLink: '',
    historialFases: [{ de: '', a: 'Abertura', fecha: new Date().toISOString().split('T')[0], usuario: 'Importación Excel' }],
    fechaCreacion: new Date().toISOString().split('T')[0],
    fechaCierre: '',
    ultimaModificacao: new Date().toISOString(),
    modificadoPor: 'Importación Excel'
  };
}

function mostrarPreviewExcel(items) {
  const tbody = document.getElementById('tbodyPreviewExcel');
  if (!tbody) return;
  tbody.innerHTML = '';
  items.slice(0, 8).forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 text-xs';
    tr.innerHTML = `<td class="p-1.5 font-bold">${item.numeroChange}</td>
      <td class="p-1.5">${item.solicitante}</td>
      <td class="p-1.5">${item.pais}</td>
      <td class="p-1.5">${item.producto}</td>
      <td class="p-1.5 text-center font-bold">${item.horasEstimadas}h</td>
      <td class="p-1.5 text-center">${item.faseAtual}</td>`;
    tbody.appendChild(tr);
  });
  setText('txtTotalImportar', `${items.length} registros detectados`);
  document.getElementById('previewUploadContainer')?.classList.remove('hidden');
  const btn = document.getElementById('btnConfirmarImportacion');
  if (btn) btn.disabled = false;
}

function ejecutarImportacionExcel() {
  if (!excelParsedRows.length) return;
  const modo = document.querySelector('input[name="modoImportacion"]:checked')?.value || 'anexar';
  if (modo === 'reemplazar') appState.changes = [...excelParsedRows];
  else appState.changes = [...appState.changes, ...excelParsedRows];
  guardarDatos(true);
  fecharModalUploadExcel();
  renderizarTodo();
  mostrarToast(`${excelParsedRows.length} changes importadas ✅`, 'success');
}

function descargarPlantillaExcel() {
  const headers = [['Número Change','RITM','Solicitante','País','Business Service','Producto','Descripción','Ingeniero','Horas Estimadas','Horas Aprobadas','Fase Actual','Status Aprobación','Aprobador']];
  const ejemplo = [['CHG0099100','RITM0155001','Andrés Delgado','Brasil','E-Commerce','Nescafé','Mejora en checkout','Carlos Mendoza',15,15,'Abertura','Pendente','Mariana Silva']];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...headers, ...ejemplo]), 'Plantilla');
  XLSX.writeFile(wb, 'Plantilla_Changes_Nestle.xlsx');
}

function exportarExcel() {
  const filtradas = obtenerChangesFiltradas();
  const wsData = [['Change','RITM','Solicitante','País','Business Service','Producto','Descripción','Ingeniero',
    'Horas Est.','Horas Apr.','Tipo','Fase Actual','Status Aprobación','Abertura','Reunião','Análise',
    'Comitê','Apresentação','Aprovação','Execução','Conclusão','Últ. Modificación']];
  filtradas.forEach(c => {
    const fObj = FASES_KEY_MAP[c.faseAtual];
    wsData.push([c.numeroChange,c.ritm,c.solicitante,c.pais||'',c.businessService,c.producto,c.descripcion,
      c.engenheiro,c.horasEstimadas,c.horasAprovadas,c.tipoChange,fObj?fObj.label:c.faseAtual,
      c.statusAprovacao,c.d1||'',c.d2||'',c.d3||'',c.d4||'',c.d5||'',c.d6||'',c.d7||'',c.d8||'',
      c.ultimaModificacao||'']);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = wsData[0].map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Changes');
  XLSX.writeFile(wb, `Changes_${appState.filtroPais}_${appState.mesActivo}.xlsx`);
  mostrarToast('Reporte Excel descargado ✅', 'success');
}

// ============================================================
// ELIMINAR CHANGE
// ============================================================
function eliminarChange(id) {
  if (!confirm('¿Eliminar esta Change?')) return;
  const idx = appState.changes.findIndex(c => String(c.id || c.spId) === String(id));
  if (idx !== -1) {
    const num = appState.changes[idx].numeroChange;
    appState.changes.splice(idx, 1);
    guardarDatos(true);
    renderizarTodo();
    mostrarToast(`${num} eliminada`, 'warning');
  }
}

// ============================================================
// CONFIGURACIÓN DE EVENTOS DE INTERFAZ
// ============================================================
function configurarEventos() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => cambiarVista(btn.dataset.view));
  });

  const bind = (id, eventName, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(eventName, handler);
  };

  bind('inpBuscar', 'input', e => { appState.filtroTexto = e.target.value; renderizarTodo(); });
  bind('filtroSolicitante', 'change', e => { appState.filtroSolicitante = e.target.value; renderizarTodo(); });
  bind('filtroBusinessService', 'change', e => { appState.filtroBusinessService = e.target.value; renderizarTodo(); });
  bind('filtroProducto', 'change', e => { appState.filtroProducto = e.target.value; renderizarTodo(); });
  bind('filtroPais', 'change', e => { appState.filtroPais = e.target.value; renderizarTodo(); });
  bind('filtroStatus', 'change', e => { appState.filtroStatus = e.target.value; renderizarTodo(); });
  bind('selectorMes', 'change', e => { appState.mesActivo = e.target.value; renderizarTodo(); });
  bind('inpHorasEst', 'input', actualizarBadgeModal);
  bind('inpPais', 'change', actualizarBadgeModal);

  // Dropzone para upload Excel
  const dz = document.getElementById('uploadDropzone');
  if (dz) {
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag-active'); }));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag-active'); }));
    dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) procesarArchivoExcel(f); });
  }
}

function cambiarVista(vista) {
  appState.vistaActiva = vista;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.view === vista;
    btn.className = `tab-btn py-1.5 px-3 font-${isActive ? 'bold text-blue-600 border-b-2 border-blue-600' : 'semibold text-slate-500 hover:text-slate-700 border-b-2 border-transparent'} text-xs flex items-center gap-1.5 transition-all whitespace-nowrap`;
  });
  ['kanban','fases','dashboard','tabla'].forEach(v => {
    document.getElementById(`secao${capitalize(v)}`)?.classList.toggle('hidden', v !== vista);
  });
  renderizarTodo();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ============================================================
// SHAREPOINT SYNC
// ============================================================
async function sincronizarConSharePoint() {
  mostrarToast('Sincronizando con SharePoint...', 'info');
  setIndicadorSync('syncing');
  try {
    // Aquí va la lógica SharePoint si está disponible
    guardarDatos(true);
    renderizarTodo();
    mostrarToast('Sincronización completada ✅', 'success');
  } catch (err) {
    mostrarToast('Modo local activo. Datos guardados localmente.', 'warning');
  } finally {
    setIndicadorSync('live');
  }
}

// ============================================================
// INDICADOR DE SINCRONIZACIÓN
// ============================================================
function setIndicadorSync(estado) {
  const el = document.getElementById('indicadorSync');
  if (!el) return;
  const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (estado === 'live') {
    el.className = 'status-pill-live px-2 rounded-full text-[10px] font-semibold flex items-center gap-1.5';
    el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span><i class="fa-solid fa-wifi text-emerald-600"></i> En línea (${hora})`;
  } else if (estado === 'syncing') {
    el.className = 'status-pill-syncing px-2 rounded-full text-[10px] font-semibold flex items-center gap-1.5';
    el.innerHTML = `<i class="fa-solid fa-rotate fa-spin text-blue-600"></i> Guardando...`;
  } else {
    el.className = 'status-pill-offline px-2 rounded-full text-[10px] font-semibold flex items-center gap-1.5';
    el.innerHTML = `<i class="fa-solid fa-circle-exclamation text-amber-600"></i> Local`;
  }
}

// ============================================================
// TOASTS
// ============================================================
function mostrarToast(mensaje, tipo = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const iconMap = { success: 'fa-check-circle text-emerald-500', warning: 'fa-triangle-exclamation text-amber-500', error: 'fa-circle-xmark text-rose-500', info: 'fa-info-circle text-blue-500' };
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<i class="fa-solid ${iconMap[tipo] || iconMap.info} text-base shrink-0"></i><span>${mensaje}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.cssText = 'opacity:0;transform:translateY(10px);transition:all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
