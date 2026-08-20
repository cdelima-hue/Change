/**
 * app.js — Portal de Gestión de Changes v4.2
 * =====================================================
 * NUEVAS MEJORAS v4.2:
 *  1. Gestión de Usuarios y Permisos (Administrador, Edición, Lectura).
 *  2. Reconfiguración "+ Change" con los 5 campos obligatorios:
 *     - Solicitante, Number, Business Service, Short Description, Assigned To.
 *     - Todos los campos editables en modo Edición / Administrador.
 *  3. Dashboard con indicador y comparativo de "Acumulado Total".
 *  4. Control estricto de permisos en Kanban, Matriz, Modales, Configuración y Usuarios.
 *  5. Historial/auditoría completo no destructivo.
 */

// ============================================================
// MAPA DE FASES (keys sin acentos para DOM)
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

const FASES_LEGACY_MAP = {
  'Reunião':'Reuniao','Análise':'Analise','Comitê':'Comite',
  'Apresentação':'Apresentacao','Aprovação':'Aprovacao',
  'Execução':'Execucao','Concluída':'Concluida','Concluida':'Concluida','Abertura':'Abertura'
};

const OPCIONES_PASOS = [
  '1. Análisis Técnico & Requerimientos',
  '2. Diseño de Arquitectura / UI',
  '3. Desarrollo Backend / APIs',
  '4. Desarrollo Frontend',
  '5. Integración & Configuración',
  '6. Pruebas QA & Regresión',
  '7. Pruebas UAT / Negocio',
  '8. Despliegue & Producción',
  '9. Capacitación & Soporte',
];

// ============================================================
// GESTIÓN DE USUARIOS Y ROLES (DEFAULT)
// ============================================================
const USUARIOS_DEFAULT = [
  { id: 'usr-1', nombre: 'Admin Nestlé (IT)', email: 'admin.it@nestle.com', rol: 'Administrador', activo: true },
  { id: 'usr-2', nombre: 'Carlos Mendoza (Ingeniero)', email: 'carlos.mendoza@nestle.com', rol: 'Edición', activo: true },
  { id: 'usr-3', nombre: 'Mariana Silva (Negocio / Lector)', email: 'mariana.silva@nestle.com', rol: 'Lectura', activo: true }
];

// ============================================================
// ESTADO GLOBAL
// ============================================================
let appState = {
  changes: [],
  usuarios: [],
  usuarioActualId: 'usr-1',
  mesActivo: '',
  filtroTexto: '',
  filtroSolicitante: 'todos',
  filtroBusinessService: 'todos',
  filtroProducto: 'todos',
  filtroPais: 'todos',
  filtroStatus: 'todos',
  vistaActiva: 'kanban',
};

// Audit log
let auditLog = [];

// Histórico mensual
let historialMensual = {};

// Charts instances
let charts = {
  gauge: null,
  prodDash: null,
  fasesDash: null,
  mesAnterior: null,
  mesActual: null,
  acumuladoTotal: null
};

// Drag state
let draggedId = null, dragActive = false;

// Sync multi-tab
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel('nestle_changes_v4');
  syncChannel.onmessage = () => { cargarDesdeStorage(); renderizarTodo(); };
} catch(_){}
window.addEventListener('storage', e => {
  if ((e.key === 'nestle_changes_v4' || e.key === 'nestle_usuarios_v4') && e.newValue) {
    cargarDesdeStorage(); renderizarTodo();
  }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  inicializarMes();
  cargarDatos();
  poblarSelectorUsuariosHeader();
  poblarFiltroPaises();
  poblarSelectPaisFormulario();
  inicializarGraficoGauge();
  configurarEventos();
  aplicarPermisosUI();
  renderizarTodo();
  setIndicadorSync('live');
});

function inicializarMes() {
  const now = new Date();
  appState.mesActivo = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const sel = document.getElementById('selectorMes');
  if (sel) sel.value = appState.mesActivo;
}

function cargarDatos() {
  // 1. Changes
  const raw = localStorage.getItem('nestle_changes_v4');
  if (raw) {
    try { appState.changes = JSON.parse(raw).map(normalizarChange); }
    catch(_) { appState.changes = (typeof initialChangesData!=='undefined'?[...initialChangesData]:[]).map(normalizarChange); }
  } else if (typeof initialChangesData !== 'undefined') {
    appState.changes = initialChangesData.map(normalizarChange);
    guardarDatos(false);
  }

  // 2. Usuarios
  const rawUsers = localStorage.getItem('nestle_usuarios_v4');
  if (rawUsers) {
    try { appState.usuarios = JSON.parse(rawUsers); } catch(_) { appState.usuarios = [...USUARIOS_DEFAULT]; }
  } else {
    appState.usuarios = [...USUARIOS_DEFAULT];
    localStorage.setItem('nestle_usuarios_v4', JSON.stringify(appState.usuarios));
  }

  // Usuario actual seleccionado
  const savedUserId = localStorage.getItem('nestle_active_user_id');
  if (savedUserId && appState.usuarios.some(u => u.id === savedUserId)) {
    appState.usuarioActualId = savedUserId;
  } else {
    appState.usuarioActualId = appState.usuarios[0]?.id || 'usr-1';
  }

  // 3. Audit log
  try { auditLog = JSON.parse(localStorage.getItem('nestle_audit_log_v4') || '[]'); } catch(_) { auditLog = []; }

  // 4. Histórico mensual
  try { historialMensual = JSON.parse(localStorage.getItem('nestle_historial_v4') || '{}'); } catch(_) { historialMensual = {}; }
}

function normalizarChange(ch) {
  if (ch.faseAtual && FASES_LEGACY_MAP[ch.faseAtual]) ch.faseAtual = FASES_LEGACY_MAP[ch.faseAtual];
  if (!ch.faseAtual || !FASES_KEY_MAP[ch.faseAtual]) ch.faseAtual = 'Abertura';
  if (!ch.historialFases) ch.historialFases = [];
  if (!ch.pais) ch.pais = 'Brasil';
  return ch;
}

function guardarDatos(emitir = true) {
  setIndicadorSync('syncing');
  localStorage.setItem('nestle_changes_v4', JSON.stringify(appState.changes));
  localStorage.setItem('nestle_usuarios_v4', JSON.stringify(appState.usuarios));
  localStorage.setItem('nestle_active_user_id', appState.usuarioActualId);
  localStorage.setItem('nestle_audit_log_v4', JSON.stringify(auditLog));
  guardarHistorialMensual();
  if (emitir && syncChannel) syncChannel.postMessage({type:'SYNC'});
  setTimeout(() => setIndicadorSync('live'), 400);
}

function cargarDesdeStorage() {
  try { appState.changes = JSON.parse(localStorage.getItem('nestle_changes_v4')||'[]').map(normalizarChange); } catch(_){}
  try { appState.usuarios = JSON.parse(localStorage.getItem('nestle_usuarios_v4')||'[]'); } catch(_){}
  try { auditLog = JSON.parse(localStorage.getItem('nestle_audit_log_v4')||'[]'); } catch(_){}
}

// ============================================================
// CONTROL DE PERMISOS
// ============================================================
function obtenerUsuarioActual() {
  return appState.usuarios.find(u => u.id === appState.usuarioActualId) || appState.usuarios[0] || {
    id: 'usr-1', nombre: 'Usuario', rol: 'Lectura'
  };
}

function esAdmin() {
  return obtenerUsuarioActual().rol === 'Administrador';
}

function puedeEditar() {
  const rol = obtenerUsuarioActual().rol;
  return rol === 'Administrador' || rol === 'Edición';
}

function esLectura() {
  return obtenerUsuarioActual().rol === 'Lectura';
}

function cambiarUsuarioActivo(userId) {
  if (!appState.usuarios.some(u => u.id === userId)) return;
  appState.usuarioActualId = userId;
  localStorage.setItem('nestle_active_user_id', userId);
  aplicarPermisosUI();
  renderizarTodo();
  const u = obtenerUsuarioActual();
  mostrarToast(`Sesión cambiada a: ${u.nombre} (${u.rol})`, 'info');
}

function poblarSelectorUsuariosHeader() {
  const sel = document.getElementById('selectUsuarioSesion');
  if (!sel) return;
  sel.innerHTML = '';
  appState.usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.nombre} [${u.rol}]`;
    if (u.id === appState.usuarioActualId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function aplicarPermisosUI() {
  const u = obtenerUsuarioActual();
  const badge = document.getElementById('badgeRolUsuario');
  if (badge) {
    badge.textContent = u.rol;
    if (u.rol === 'Administrador') badge.className = 'badge-role-admin px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1';
    else if (u.rol === 'Edición') badge.className = 'badge-role-edit px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1';
    else badge.className = 'badge-role-read px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1';
  }

  // Deshabilitar / Ocultar botones según rol
  const btnNuevaChange = document.getElementById('btnNuevaChangeHeader');
  if (btnNuevaChange) {
    if (puedeEditar()) {
      btnNuevaChange.classList.remove('opacity-40', 'cursor-not-allowed');
      btnNuevaChange.removeAttribute('disabled');
      btnNuevaChange.title = 'Crear nueva solicitud de Change';
    } else {
      btnNuevaChange.classList.add('opacity-40', 'cursor-not-allowed');
      btnNuevaChange.setAttribute('disabled', 'true');
      btnNuevaChange.title = 'Acceso solo lectura: no puedes crear changes';
    }
  }

  const btnCargarExcel = document.getElementById('btnCargarExcelHeader');
  if (btnCargarExcel) {
    if (puedeEditar()) {
      btnCargarExcel.classList.remove('opacity-40', 'cursor-not-allowed');
      btnCargarExcel.removeAttribute('disabled');
    } else {
      btnCargarExcel.classList.add('opacity-40', 'cursor-not-allowed');
      btnCargarExcel.setAttribute('disabled', 'true');
    }
  }
}

// ============================================================
// AUDIT LOG
// ============================================================
function registrarAudit(changeNum, campo, valorAnterior, valorNuevo, usuario) {
  if (String(valorAnterior) === String(valorNuevo)) return;
  const u = usuario || obtenerUsuarioActual().nombre;
  auditLog.unshift({
    timestamp: new Date().toISOString(),
    usuario: u,
    changeNum: changeNum || '—',
    campo,
    valorAnterior: String(valorAnterior || '(vacío)'),
    valorNuevo: String(valorNuevo || '(vacío)'),
  });
  if (auditLog.length > 500) auditLog = auditLog.slice(0, 500);
}

function registrarAuditCambios(changeNum, datosAnteriores, datosNuevos, camposAuditar) {
  camposAuditar.forEach(campo => {
    const prev = datosAnteriores[campo];
    const curr = datosNuevos[campo];
    if (String(prev||'') !== String(curr||'')) {
      registrarAudit(changeNum, campo, prev, curr);
    }
  });
}

// ============================================================
// HISTORIAL MENSUAL
// ============================================================
function guardarHistorialMensual() {
  const mes = appState.mesActivo;
  if (!mes) return;
  const snap = {};
  obtenerPaisesActivos().forEach(p => {
    const chs = appState.changes.filter(ch => ch.pais === p.key && (ch.mesAno||'').startsWith(mes));
    const h = chs.reduce((s,c) => s + parseFloat(c.horasAprovadas||c.horasEstimadas||0), 0);
    snap[p.key] = { horasDisponibles: p.horasDisponibles, horasUsadas: +h.toFixed(1), totalChanges: chs.length };
  });
  historialMensual[mes] = snap;
  localStorage.setItem('nestle_historial_v4', JSON.stringify(historialMensual));
}

function obtenerSnapshotMes(mesKey, paisKey) {
  const s = historialMensual[mesKey];
  if (!s) return null;
  if (paisKey && paisKey !== 'todos') return s[paisKey] || null;
  const vals = Object.values(s);
  return {
    horasDisponibles: vals.reduce((a,v) => a+(v.horasDisponibles||0), 0),
    horasUsadas: vals.reduce((a,v) => a+(v.horasUsadas||0), 0),
    totalChanges: vals.reduce((a,v) => a+(v.totalChanges||0), 0),
  };
}

function obtenerMesAnteriorKey(m) {
  const [a, mm] = m.split('-').map(Number);
  return mm===1 ? `${a-1}-12` : `${a}-${String(mm-1).padStart(2,'0')}`;
}

// ============================================================
// POBLAR SELECTS DE PAÍSES
// ============================================================
function poblarFiltroPaises() {
  const sel = document.getElementById('filtroPais');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="todos">Todos los Países</option>';
  obtenerPaisesActivos().forEach(p => {
    sel.innerHTML += `<option value="${p.key}">${p.nombre}</option>`;
  });
  if (prev) sel.value = prev;
}

function poblarSelectPaisFormulario() {
  const sel = document.getElementById('inpPais');
  if (!sel) return;
  sel.innerHTML = '';
  obtenerPaisesActivos().forEach(p => {
    sel.innerHTML += `<option value="${p.key}">${p.nombre}</option>`;
  });
}

// ============================================================
// FILTRADO
// ============================================================
function obtenerChangesFiltradas() {
  return appState.changes.filter(ch => {
    if (appState.mesActivo) {
      const m = ch.mesAno || (ch.d1 ? ch.d1.substring(0,7) : '');
      if (m && m !== appState.mesActivo) return false;
    }
    if (appState.filtroTexto) {
      const q = appState.filtroTexto.toLowerCase();
      if (!['numeroChange','ritm','solicitante','businessService','producto','descripcion','engenheiro','pais']
        .some(k => (ch[k]||'').toLowerCase().includes(q))) return false;
    }
    if (appState.filtroSolicitante!=='todos' && ch.solicitante!==appState.filtroSolicitante) return false;
    if (appState.filtroBusinessService!=='todos' && ch.businessService!==appState.filtroBusinessService) return false;
    if (appState.filtroProducto!=='todos' && ch.producto!==appState.filtroProducto) return false;
    if (appState.filtroPais!=='todos' && ch.pais!==appState.filtroPais) return false;
    if (appState.filtroStatus!=='todos' && ch.statusAprovacao!==appState.filtroStatus) return false;
    return true;
  });
}

// ============================================================
// RENDERIZADO PRINCIPAL
// ============================================================
function renderizarTodo() {
  actualizarSelectoresFiltros();
  actualizarIndicadores();
  const v = appState.vistaActiva;
  if (v==='kanban') renderizarKanban();
  else if (v==='fases') renderizarMatriz();
  else if (v==='dashboard') renderizarDashboard();
  else if (v==='tabla') renderizarTabla();
  else if (v==='historial') renderizarHistorial();
  else if (v==='config') renderizarConfigPaises();
  else if (v==='usuarios') renderizarUsuarios();
}

function actualizarSelectoresFiltros() {
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort();
  const fill = (id, opts, ph) => {
    const s = document.getElementById(id); if (!s) return;
    const prev = s.value;
    s.innerHTML = `<option value="todos">${ph}</option>`;
    opts.forEach(o => { s.innerHTML += `<option value="${o}">${o}</option>`; });
    if (opts.includes(prev)) s.value = prev;
  };
  fill('filtroSolicitante', uniq(appState.changes.map(c=>c.solicitante)), 'Solicitantes');
  fill('filtroBusinessService', uniq(appState.changes.map(c=>c.businessService)), 'Services');
  fill('filtroProducto', uniq(appState.changes.map(c=>c.producto)), 'Productos');
}

// ============================================================
// INDICADORES DE CAPACIDAD
// ============================================================
function actualizarIndicadores() {
  const pais = appState.filtroPais;
  const cfg = obtenerConfigPais(pais);
  const filtradas = obtenerChangesFiltradas();
  let horasUsadas=0, horasCompr=0, sobreLim=0, proy=0;
  const porProd = {};

  filtradas.forEach(ch => {
    const hA = parseFloat(ch.horasAprovadas||0);
    const hE = parseFloat(ch.horasEstimadas||0);
    horasUsadas += hA;
    horasCompr += hE;
    if (hE > REGLA_MAX_HORAS_CHANGE) { sobreLim++; proy++; }
    const prod = ch.producto||'Sin asignar';
    porProd[prod] = (porProd[prod]||0) + hA;
  });

  const horasDisp = cfg.horasDisponibles;
  const horasRest = Math.max(0, horasDisp - horasUsadas);
  const pct = horasDisp>0 ? Math.min(100, Math.round(horasUsadas/horasDisp*100)) : 0;
  const prom = filtradas.length>0 ? (horasUsadas/filtradas.length).toFixed(1) : 0;
  const sobre = horasUsadas > horasDisp;

  setText('txtHorasDisponibles', `${horasDisp} h`);
  setText('txtHorasConsumidas', `${horasUsadas.toFixed(1)} h`);
  setText('txtHorasResta', `${horasRest.toFixed(1)} h`);
  setText('txtPctUso', `${pct}%`);
  setText('txtHorasComprometidas', `${horasCompr.toFixed(1)} h`);
  setText('txtTotalChanges', `${filtradas.length}`);
  setText('txtPromedioPorChange', `${prom} h`);
  setText('txtSobreLimite', `${sobreLim}`);
  setText('txtCountSmall', `${filtradas.length-proy} Mejoras`);
  setText('txtMaxHorasPais', `Máx. ${REGLA_MAX_HORAS_CHANGE}h por change (global)`);
  setText('txtCapacidadPais', `${cfg.nombre}: ${horasDisp}h/mes`);

  const alEl = document.getElementById('alertaSobrecapacidad');
  if (alEl) {
    if (sobre) { alEl.classList.remove('hidden'); setText('txtExcesoHoras', `${(horasUsadas-horasDisp).toFixed(1)}h`); }
    else alEl.classList.add('hidden');
  }

  if (charts.gauge) {
    charts.gauge.data.datasets[0].data = [Math.min(horasUsadas,horasDisp), horasRest];
    charts.gauge.data.datasets[0].backgroundColor = [sobre?'#ef4444':'#2563eb', '#e2e8f0'];
    charts.gauge.update('none');
  }

  // Productos
  const cp = document.getElementById('containerProductos');
  if (cp) {
    cp.innerHTML = '';
    const sorted = Object.keys(porProd).sort((a,b)=>porProd[b]-porProd[a]);
    if (!sorted.length) cp.innerHTML = '<p class="text-xs text-slate-400 py-2 text-center">Sin datos.</p>';
    else sorted.forEach(prod => {
      const h = porProd[prod], pc = Math.min(100, Math.round(h/horasDisp*100));
      cp.innerHTML += `<div class="py-1 px-1.5 rounded-lg bg-slate-50 border border-slate-100">
        <div class="flex justify-between text-[11px] font-semibold mb-0.5">
          <span class="text-slate-700 truncate max-w-[140px]"><i class="fa-solid fa-cube text-slate-400 mr-1 text-[9px]"></i>${prod}</span>
          <span class="text-slate-800 font-bold">${h.toFixed(1)}h <span class="text-[9px] text-slate-400">(${pc}%)</span></span>
        </div>
        <div class="w-full bg-slate-200 h-1 rounded-full"><div class="bg-blue-600 h-full rounded-full" style="width:${pc}%"></div></div>
      </div>`;
    });
  }
}

function setText(id,v) { const el=document.getElementById(id); if(el) el.textContent=v; }

// ============================================================
// KANBAN
// ============================================================
function renderizarKanban() {
  FASES.forEach(f => {
    const col = document.getElementById(`col-${f.key}`); if(col) col.innerHTML='';
    const b = document.getElementById(`badge-${f.key}`); if(b) b.textContent='0';
  });
  const filtradas = obtenerChangesFiltradas();
  const cnt = {}; FASES.forEach(f=>{cnt[f.key]=0;});
  const editAllowed = puedeEditar();

  filtradas.forEach(ch => {
    let fk = normalizarFaseKey(ch.faseAtual);
    cnt[fk]=(cnt[fk]||0)+1;
    const col = document.getElementById(`col-${fk}`);
    if (!col) return;
    const h = parseFloat(ch.horasEstimadas||0);
    const esP = h > REGLA_MAX_HORAS_CHANGE;
    const idStr = String(ch.id||ch.spId);
    const fIdx = FASES.findIndex(f=>f.key===fk);

    const card = document.createElement('div');
    card.className = `kanban-card ${esP?'card-accent-excede':'card-accent-small'} ${!editAllowed?'readonly-card':''}`;
    card.draggable = editAllowed;
    card.dataset.id = idStr;

    let actionButtonsHtml = '';
    if (editAllowed) {
      actionButtonsHtml = `
        <div class="flex items-center gap-1">
          ${fIdx>0?`<button type="button" data-act="prev" data-id="${idStr}" class="w-4 h-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-[8px]" title="Mover a fase anterior"><i class="fa-solid fa-chevron-left"></i></button>`:''}
          <button type="button" data-act="open" data-id="${idStr}" class="text-blue-600 font-semibold hover:underline text-[10px]">Editar</button>
          ${fIdx<FASES.length-1?`<button type="button" data-act="next" data-id="${idStr}" class="w-4 h-4 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center text-[8px]" title="Mover a siguiente fase"><i class="fa-solid fa-chevron-right"></i></button>`:''}
        </div>`;
    } else {
      actionButtonsHtml = `
        <div class="flex items-center gap-1">
          <button type="button" data-act="open" data-id="${idStr}" class="text-slate-600 font-semibold hover:underline text-[10px]"><i class="fa-solid fa-eye mr-0.5"></i>Ver</button>
        </div>`;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="font-bold text-xs text-blue-700 font-mono">${ch.numeroChange||'SIN-ID'}</span>
        <span class="text-[9px] font-bold px-1.5 rounded ${esP?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}">${h}h${esP?' ⚠️':''}</span>
      </div>
      <p class="text-[11px] font-medium text-slate-800 line-clamp-2 leading-snug mb-1.5">${ch.descripcion||'Sin descripción'}</p>
      <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span class="truncate max-w-[80px]" title="${ch.solicitante||''}"><i class="fa-solid fa-user text-[9px] text-slate-400 mr-0.5"></i>${ch.solicitante||'N/A'}</span>
        ${actionButtonsHtml}
      </div>`;

    card.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) { if (!dragActive) abrirModalEdicion(idStr); return; }
      e.stopPropagation();
      const a=btn.dataset.act, bid=btn.dataset.id;
      if (a==='open') abrirModalEdicion(bid);
      else if (a==='prev') moverFaseRelativa(bid,-1);
      else if (a==='next') moverFaseRelativa(bid,1);
    });

    if (editAllowed) {
      card.addEventListener('dragstart', e => {
        draggedId=idStr; dragActive=true; card.classList.add('dragging');
        e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',idStr);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.kanban-col').forEach(c=>c.classList.remove('drag-over'));
        setTimeout(()=>{dragActive=false;draggedId=null;},100);
      });
    }

    col.appendChild(card);
  });

  FASES.forEach(f => { const b=document.getElementById(`badge-${f.key}`); if(b) b.textContent=cnt[f.key]||0; });
  if (editAllowed) configurarDropZones();
}

function configurarDropZones() {
  FASES.forEach(f => {
    const w = document.getElementById(`kanban-col-${f.key}`);
    if (!w) return;
    w.ondragenter = e => { e.preventDefault(); if (puedeEditar()) w.classList.add('drag-over'); };
    w.ondragleave = e => { if (!w.contains(e.relatedTarget)) w.classList.remove('drag-over'); };
    w.ondragover = e => { e.preventDefault(); if (puedeEditar()) e.dataTransfer.dropEffect='move'; };
    w.ondrop = e => {
      e.preventDefault(); w.classList.remove('drag-over');
      if (!puedeEditar()) { mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning'); return; }
      const id = e.dataTransfer.getData('text/plain')||draggedId;
      if (id) moverChangeDeFase(id, f.key);
    };
  });
}

function moverChangeDeFase(changeId, nuevaFase) {
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }
  nuevaFase = normalizarFaseKey(nuevaFase);
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(changeId));
  if (!ch || ch.faseAtual===nuevaFase) return;

  const anterior = ch.faseAtual;
  const user = obtenerUsuarioActual().nombre;
  registrarAudit(ch.numeroChange, 'faseAtual', FASES_KEY_MAP[anterior]?.label||anterior, FASES_KEY_MAP[nuevaFase]?.label||nuevaFase, user);

  if (!ch.historialFases) ch.historialFases=[];
  ch.historialFases.push({de:anterior,a:nuevaFase,fecha:new Date().toISOString().split('T')[0],usuario:user});

  ch.faseAtual = nuevaFase;
  ch.ultimaModificacao = new Date().toISOString();
  ch.modificadoPor = user;

  const fo = FASES_KEY_MAP[nuevaFase];
  if (fo && !ch[fo.dKey]) ch[fo.dKey] = new Date().toISOString().split('T')[0];

  guardarDatos(true);
  if (appState.vistaActiva==='kanban') renderizarKanban();
  else if (appState.vistaActiva==='fases') renderizarMatriz();
  actualizarIndicadores();
  mostrarToast(`${ch.numeroChange} → "${FASES_KEY_MAP[nuevaFase]?.label||nuevaFase}"`, 'success');
}

function moverFaseRelativa(id, delta) {
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(id));
  if (!ch) return;
  const idx = FASES.findIndex(f=>f.key===ch.faseAtual);
  const ni = idx+delta;
  if (ni>=0 && ni<FASES.length) moverChangeDeFase(id, FASES[ni].key);
}

function normalizarFaseKey(raw) {
  if (!raw) return 'Abertura';
  if (FASES_KEY_MAP[raw]) return raw;
  if (FASES_LEGACY_MAP[raw]) return FASES_LEGACY_MAP[raw];
  return 'Abertura';
}

// ============================================================
// MATRIZ DE FASES
// ============================================================
function renderizarMatriz() {
  const tbody = document.getElementById('tbodyFases'); if (!tbody) return;
  tbody.innerHTML='';
  const filtradas = obtenerChangesFiltradas();
  if (!filtradas.length) { tbody.innerHTML=`<tr><td colspan="11" class="p-8 text-center text-slate-400">Sin datos.</td></tr>`; return; }
  const editAllowed = puedeEditar();

  filtradas.forEach(ch => {
    const tr = document.createElement('tr');
    tr.className='hover:bg-slate-50 border-b border-slate-100';
    let fTds='';
    FASES.forEach(f => {
      const dv=ch[f.dKey]||'';
      const esCurr = ch.faseAtual===f.key;
      let icon;
      if (dv) icon=`<div class="phase-checkpoint completed" title="Completado: ${dv}"><i class="fa-solid fa-check"></i></div><span class="text-[9px] text-slate-500 font-mono mt-0.5">${dv.substring(5)}</span>`;
      else if (esCurr) icon=`<div class="phase-checkpoint current" title="Fase Actual"><i class="fa-solid fa-spinner fa-spin"></i></div><span class="text-[9px] text-blue-600 font-bold mt-0.5">Actual</span>`;
      else icon=`<div class="phase-checkpoint pending" title="Pendiente"><i class="fa-regular fa-circle"></i></div><span class="text-[9px] text-slate-400 mt-0.5">—</span>`;
      
      const cursorClass = editAllowed ? 'cursor-pointer hover:opacity-80' : 'cursor-default';
      const clickHandler = editAllowed ? `onclick="accionCheckpoint('${ch.id||ch.spId}','${f.dKey}','${f.key}')"` : `onclick="mostrarToast('Modo Lectura: No puedes modificar fases','info')"`;
      fTds+=`<td class="p-2 text-center"><div class="flex flex-col items-center ${cursorClass}" ${clickHandler}>${icon}</div></td>`;
    });
    tr.innerHTML=`<td class="p-2.5"><a href="javascript:void(0)" onclick="abrirModalEdicion('${ch.id||ch.spId}')" class="font-bold text-blue-700 font-mono hover:underline text-xs">${ch.numeroChange}</a><span class="block text-[10px] text-slate-400">${ch.pais||''}</span></td>
      <td class="p-2.5"><span class="block font-semibold text-xs">${ch.solicitante||'—'}</span><span class="text-[10px] text-blue-600">${ch.businessService||'—'}</span></td>
      <td class="p-2.5"><span class="block font-medium text-xs truncate max-w-[120px]">${ch.producto||'—'}</span></td>${fTds}`;
    tbody.appendChild(tr);
  });
}

function accionCheckpoint(chId, dKey, faseKey) {
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(chId));
  if (!ch) return;
  const user = obtenerUsuarioActual().nombre;
  if (ch[dKey]) {
    registrarAudit(ch.numeroChange, dKey, ch[dKey], '(removido)', user);
    ch[dKey]=''; ch.ultimaModificacao=new Date().toISOString(); ch.modificadoPor=user;
    guardarDatos(true); renderizarMatriz(); actualizarIndicadores();
  } else {
    ch[dKey]=new Date().toISOString().split('T')[0];
    moverChangeDeFase(chId, faseKey);
    if (appState.vistaActiva==='fases') renderizarMatriz();
  }
}

// ============================================================
// DASHBOARD CON ACUMULADO TOTAL
// ============================================================
function inicializarGraficoGauge() {
  const ctx = document.getElementById('gaugeCapacidade');
  if (!ctx) return;
  charts.gauge = new Chart(ctx.getContext('2d'), {
    type:'doughnut', data:{datasets:[{data:[0,160],backgroundColor:['#2563eb','#e2e8f0'],borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,rotation:-90,circumference:180,cutout:'76%',plugins:{tooltip:{enabled:false}}}
  });
}

function renderizarDashboard() {
  const filtradas = obtenerChangesFiltradas();
  const pais = appState.filtroPais;

  // Gráfico 1: Horas por Producto (filtrado por país)
  const porProd = {};
  filtradas.forEach(c => {
    const prod = c.producto||'Sin asignar';
    porProd[prod] = (porProd[prod]||0) + parseFloat(c.horasAprovadas||c.horasEstimadas||0);
  });
  const ctxP = document.getElementById('chartProductosDash');
  if (ctxP) {
    if (charts.prodDash) charts.prodDash.destroy();
    const paisLabel = pais==='todos' ? 'Todos los Países' : obtenerConfigPais(pais).nombre;
    charts.prodDash = new Chart(ctxP.getContext('2d'), {
      type:'bar',
      data:{labels:Object.keys(porProd),datasets:[{label:`Horas (${paisLabel})`,data:Object.values(porProd),backgroundColor:'#3b82f6',borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{font:{size:10}}}},scales:{y:{beginAtZero:true}}}
    });
  }

  // Gráfico 2: Changes por fase
  const porFase = {}; FASES.forEach(f=>{porFase[f.label]=0;});
  filtradas.forEach(c => { const fo=FASES_KEY_MAP[c.faseAtual]; porFase[fo?fo.label:'1. Abertura']=(porFase[fo?fo.label:'1. Abertura']||0)+1; });
  const ctxF = document.getElementById('chartFasesDash');
  if (ctxF) {
    if (charts.fasesDash) charts.fasesDash.destroy();
    charts.fasesDash = new Chart(ctxF.getContext('2d'), {
      type:'doughnut',
      data:{labels:Object.keys(porFase),datasets:[{data:Object.values(porFase),backgroundColor:FASES.map(f=>f.color)}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:10}}}}}
    });
  }

  // Comparativo mensual y Acumulado Total
  renderizarComparativoYAcumulado();
}

function renderizarComparativoYAcumulado() {
  const pais = appState.filtroPais;
  const mesAct = appState.mesActivo;
  const mesAnt = obtenerMesAnteriorKey(mesAct);

  // Datos mes anterior y actual
  const snapAnt = obtenerSnapshotMes(mesAnt, pais);
  const snapAct = obtenerSnapshotMes(mesAct, pais);

  setText('lblMesActual', formatMes(mesAct));
  setText('lblMesAnterior', formatMes(mesAnt));

  renderGrafComp('chartMesAnterior', charts.mesAnterior, snapAnt, formatMes(mesAnt), pais, c => { charts.mesAnterior = c; });
  renderGrafComp('chartMesActual', charts.mesActual, snapAct, formatMes(mesAct), pais, c => { charts.mesActual = c; });

  // CÁLCULO DEL ACUMULADO TOTAL (YTD / Todo el histórico)
  let totalHorasAcumuladas = 0;
  let totalChangesAcumuladas = 0;
  let totalCapacidadAcumulada = 0;
  const mesesRegistrados = Object.keys(historialMensual);

  // Si hay historial mensual guardado
  if (mesesRegistrados.length > 0) {
    mesesRegistrados.forEach(mKey => {
      const snap = obtenerSnapshotMes(mKey, pais);
      if (snap) {
        totalHorasAcumuladas += (snap.horasUsadas || 0);
        totalChangesAcumuladas += (snap.totalChanges || 0);
        totalCapacidadAcumulada += (snap.horasDisponibles || 0);
      }
    });
  } else {
    // Si no hay snapshot, acumular directo del dataset
    const chs = pais === 'todos' ? appState.changes : appState.changes.filter(c => c.pais === pais);
    totalHorasAcumuladas = chs.reduce((s, c) => s + parseFloat(c.horasAprovadas || c.horasEstimadas || 0), 0);
    totalChangesAcumuladas = chs.length;
    const cfg = obtenerConfigPais(pais);
    totalCapacidadAcumulada = cfg.horasDisponibles;
  }

  const numMeses = Math.max(1, mesesRegistrados.length);
  const promedioMensualAcum = (totalHorasAcumuladas / numMeses).toFixed(1);
  const pctAcumulado = totalCapacidadAcumulada > 0 ? Math.round((totalHorasAcumuladas / totalCapacidadAcumulada) * 100) : 0;

  // Actualizar KPIs de Acumulado Total en el DOM
  setText('txtAcumuladoHorasTotales', `${totalHorasAcumuladas.toFixed(1)} h`);
  setText('txtAcumuladoTotalChanges', `${totalChangesAcumuladas}`);
  setText('txtAcumuladoPromedioMensual', `${promedioMensualAcum} h/mes`);
  setText('txtAcumuladoPctUso', `${pctAcumulado}%`);
  setText('txtAcumuladoCapacidadTotal', `${totalCapacidadAcumulada} h`);

  // Gráfico Acumulado Total vs Capacidad
  const ctxAcum = document.getElementById('chartAcumuladoTotal');
  if (ctxAcum) {
    if (charts.acumuladoTotal) charts.acumuladoTotal.destroy();
    charts.acumuladoTotal = new Chart(ctxAcum.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Capacidad Total Acumulada', 'Horas Totales Utilizadas', 'Horas Remanentes'],
        datasets: [{
          label: `Acumulado (${numMeses} períodos) - ${pctAcumulado}% Uso`,
          data: [totalCapacidadAcumulada, totalHorasAcumuladas, Math.max(0, totalCapacidadAcumulada - totalHorasAcumuladas)],
          backgroundColor: ['#93c5fd', '#2563eb', '#86efac'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { font: { size: 10 } } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} h` } }
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } }
      }
    });
  }
}

function renderGrafComp(canvasId, exist, snap, label, pais, cb) {
  const ctx=document.getElementById(canvasId); if(!ctx) return;
  if(exist) exist.destroy();
  const cfg=obtenerConfigPais(pais);
  const u=snap?snap.horasUsadas:0, d=snap?snap.horasDisponibles:cfg.horasDisponibles, r=Math.max(0,d-u);
  const pct=d>0?Math.round(u/d*100):0;
  cb(new Chart(ctx.getContext('2d'),{
    type:'bar',data:{labels:['Disponibles','Utilizadas','Restantes'],datasets:[{label:`${label} (${pct}%)`,data:[d,u,r],backgroundColor:['#bfdbfe','#2563eb','#bbf7d0'],borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{font:{size:10}}}},scales:{y:{beginAtZero:true}}}
  }));
}

function formatMes(m) {
  if(!m) return '—';
  const [a,mm]=m.split('-'); const n=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${n[parseInt(mm)-1]} ${a}`;
}

// ============================================================
// TABLA BACKLOG
// ============================================================
function renderizarTabla() {
  const tbody=document.getElementById('tbodyBacklog'); if(!tbody) return;
  tbody.innerHTML='';
  const filtradas=obtenerChangesFiltradas();
  if(!filtradas.length){tbody.innerHTML=`<tr><td colspan="11" class="p-8 text-center text-slate-400">Sin registros.</td></tr>`;return;}
  const editAllowed = puedeEditar();

  filtradas.forEach(ch=>{
    const h=parseFloat(ch.horasEstimadas||0), esP=h>REGLA_MAX_HORAS_CHANGE, fo=FASES_KEY_MAP[ch.faseAtual], cid=String(ch.id||ch.spId);
    const tr=document.createElement('tr'); tr.className='hover:bg-slate-50 border-b border-slate-100 text-xs';
    
    let actionsHtml = '';
    if (editAllowed) {
      actionsHtml = `
        <button onclick="abrirModalEdicion('${cid}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar"><i class="fa-solid fa-pen text-[11px]"></i></button>
        <button onclick="eliminarChange('${cid}')" class="p-1 text-rose-600 hover:bg-rose-100 rounded" title="Eliminar"><i class="fa-solid fa-trash text-[11px]"></i></button>`;
    } else {
      actionsHtml = `
        <button onclick="abrirModalEdicion('${cid}')" class="p-1 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalles"><i class="fa-solid fa-eye text-[11px]"></i></button>`;
    }

    tr.innerHTML=`<td class="p-2.5 font-bold text-blue-700 font-mono">${ch.numeroChange}</td>
      <td class="p-2.5">${ch.pais||'—'}</td><td class="p-2.5 font-medium">${ch.solicitante||'—'}</td>
      <td class="p-2.5">${ch.businessService||'—'}</td><td class="p-2.5 font-semibold">${ch.producto||'—'}</td>
      <td class="p-2.5 text-slate-600 max-w-xs truncate">${ch.descripcion||'—'}</td>
      <td class="p-2.5 text-center font-bold">${h}h</td>
      <td class="p-2.5 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${esP?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}">${esP?'Proyecto':'Mejora'}</span></td>
      <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">${fo?fo.label:ch.faseAtual}</span></td>
      <td class="p-2.5 text-center"><span class="px-1.5 py-0.5 rounded ${ch.statusAprovacao==='Aprovado'?'bg-emerald-100 text-emerald-800':ch.statusAprovacao==='Rejeitado'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800'} font-semibold text-[10px]">${ch.statusAprovacao||'Pendente'}</span></td>
      <td class="p-2.5 text-center"><div class="flex items-center justify-center gap-1.5">${actionsHtml}</div></td>`;
    tbody.appendChild(tr);
  });
}

// ============================================================
// HISTORIAL / AUDIT LOG VIEW
// ============================================================
function renderizarHistorial() {
  const tbody=document.getElementById('tbodyHistorial'); if(!tbody) return;
  tbody.innerHTML='';
  if (!auditLog.length) { tbody.innerHTML=`<tr><td colspan="6" class="p-8 text-center text-slate-400">Sin registros de auditoría.</td></tr>`; return; }
  auditLog.forEach(log => {
    const tr=document.createElement('tr'); tr.className='border-b border-slate-100 text-xs hover:bg-slate-50';
    const ts = new Date(log.timestamp);
    const fecha = ts.toLocaleDateString('es',{day:'2-digit',month:'short',year:'numeric'});
    const hora = ts.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    tr.innerHTML=`<td class="p-2 font-mono text-slate-500 whitespace-nowrap">${fecha} ${hora}</td>
      <td class="p-2 font-semibold text-slate-700">${log.usuario}</td>
      <td class="p-2 font-bold text-blue-700 font-mono">${log.changeNum}</td>
      <td class="p-2 font-medium text-slate-800">${log.campo}</td>
      <td class="p-2 text-rose-600 line-through">${log.valorAnterior}</td>
      <td class="p-2 text-emerald-700 font-semibold">${log.valorNuevo}</td>`;
    tbody.appendChild(tr);
  });
}

// ============================================================
// SECCIÓN USUARIOS Y PERMISOS
// ============================================================
function renderizarUsuarios() {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;
  tbody.innerHTML = '';

  const admin = esAdmin();
  const alertEl = document.getElementById('alertaPermisoUsuarios');
  if (alertEl) {
    if (!admin) {
      alertEl.classList.remove('hidden');
      alertEl.innerHTML = `<i class="fa-solid fa-lock text-amber-600 mr-1.5"></i> Solo el <b>Administrador</b> puede crear nuevos usuarios o modificar roles.`;
    } else {
      alertEl.classList.add('hidden');
    }
  }

  appState.usuarios.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 text-xs hover:bg-slate-50';
    
    let roleBadgeClass = 'badge-role-read';
    if (u.rol === 'Administrador') roleBadgeClass = 'badge-role-admin';
    else if (u.rol === 'Edición') roleBadgeClass = 'badge-role-edit';

    let roleControlHtml = '';
    if (admin) {
      roleControlHtml = `
        <select onchange="onCambiarRolUsuario('${u.id}', this.value)" class="p-1 border border-slate-300 rounded font-semibold text-xs bg-white">
          <option value="Administrador" ${u.rol==='Administrador'?'selected':''}>🛡️ Administrador</option>
          <option value="Edición" ${u.rol==='Edición'?'selected':''}>✏️ Edición</option>
          <option value="Lectura" ${u.rol==='Lectura'?'selected':''}>👁️ Lectura</option>
        </select>`;
    } else {
      roleControlHtml = `<span class="${roleBadgeClass} px-2 py-0.5 rounded text-[10px] font-bold">${u.rol}</span>`;
    }

    let deleteBtnHtml = '';
    if (admin && appState.usuarios.length > 1) {
      deleteBtnHtml = `<button onclick="onEliminarUsuario('${u.id}')" class="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Eliminar usuario"><i class="fa-solid fa-trash-can text-[11px]"></i></button>`;
    }

    tr.innerHTML = `
      <td class="p-2.5 font-mono text-slate-500">${u.id}</td>
      <td class="p-2.5 font-bold text-slate-800">${u.nombre} ${u.id === appState.usuarioActualId ? '<span class="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px]">Tú</span>' : ''}</td>
      <td class="p-2.5 text-slate-600">${u.email}</td>
      <td class="p-2.5 text-center">${roleControlHtml}</td>
      <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Activo</span></td>
      <td class="p-2.5 text-center">${deleteBtnHtml}</td>`;
    tbody.appendChild(tr);
  });
}

function onAgregarUsuario() {
  if (!esAdmin()) {
    mostrarToast('Solo el Administrador puede agregar usuarios', 'warning');
    return;
  }
  const nombre = document.getElementById('inpNuevoUsuarioNombre')?.value?.trim();
  const email = document.getElementById('inpNuevoUsuarioEmail')?.value?.trim();
  const rol = document.getElementById('inpNuevoUsuarioRol')?.value || 'Edición';

  if (!nombre || !email) {
    mostrarToast('Ingresa nombre y correo electrónico', 'error');
    return;
  }

  const id = `usr-${Date.now()}`;
  appState.usuarios.push({ id, nombre, email, rol, activo: true });
  registrarAudit('USUARIOS', 'CREACIÓN_USUARIO', '(nuevo)', `${nombre} [${rol}]`);
  guardarDatos(true);
  poblarSelectorUsuariosHeader();
  renderizarUsuarios();

  document.getElementById('inpNuevoUsuarioNombre').value = '';
  document.getElementById('inpNuevoUsuarioEmail').value = '';
  mostrarToast(`Usuario ${nombre} agregado con rol "${rol}" ✅`, 'success');
}

function onCambiarRolUsuario(userId, nuevoRol) {
  if (!esAdmin()) {
    mostrarToast('Solo el Administrador puede cambiar roles', 'warning');
    return;
  }
  const u = appState.usuarios.find(x => x.id === userId);
  if (!u) return;
  const prevRol = u.rol;
  u.rol = nuevoRol;
  registrarAudit('USUARIOS', `CAMBIO_ROL (${u.nombre})`, prevRol, nuevoRol);
  guardarDatos(true);
  poblarSelectorUsuariosHeader();
  aplicarPermisosUI();
  renderizarUsuarios();
  mostrarToast(`Rol de ${u.nombre} actualizado a "${nuevoRol}"`, 'success');
}

function onEliminarUsuario(userId) {
  if (!esAdmin()) {
    mostrarToast('Solo el Administrador puede eliminar usuarios', 'warning');
    return;
  }
  const u = appState.usuarios.find(x => x.id === userId);
  if (!u) return;
  if (!confirm(`¿Eliminar al usuario "${u.nombre}"?`)) return;

  appState.usuarios = appState.usuarios.filter(x => x.id !== userId);
  if (appState.usuarioActualId === userId) {
    appState.usuarioActualId = appState.usuarios[0]?.id || 'usr-1';
  }
  registrarAudit('USUARIOS', 'ELIMINACIÓN_USUARIO', u.nombre, '(eliminado)');
  guardarDatos(true);
  poblarSelectorUsuariosHeader();
  aplicarPermisosUI();
  renderizarUsuarios();
  mostrarToast(`Usuario eliminado`, 'warning');
}

// ============================================================
// CONFIGURACIÓN DE PAÍSES (desde la UI)
// ============================================================
function renderizarConfigPaises() {
  const tbody=document.getElementById('tbodyConfigPaises'); if(!tbody) return;
  tbody.innerHTML='';
  const admin = esAdmin();
  const paises=obtenerTodosPaises();

  paises.forEach(p => {
    const tr=document.createElement('tr'); tr.className='border-b border-slate-100 text-xs hover:bg-slate-50';
    let horasInputHtml = '';
    let toggleActiveHtml = '';
    let deleteBtnHtml = '';

    if (admin) {
      horasInputHtml = `<input type="number" value="${p.horasDisponibles}" min="10" step="10"
        class="w-20 p-1 border border-slate-300 rounded text-center font-bold text-xs"
        onchange="onCambiarHorasPais('${p.key}',this.value)">`;
      toggleActiveHtml = `<label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" ${p.activo?'checked':''} class="sr-only peer" onchange="onTogglePaisActivo('${p.key}',this.checked)">
        <div class="w-9 h-5 bg-slate-300 peer-checked:bg-emerald-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
      </label>`;
      deleteBtnHtml = `<button onclick="onEliminarPais('${p.key}')" class="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Eliminar país"><i class="fa-solid fa-trash-can text-[11px]"></i></button>`;
    } else {
      horasInputHtml = `<span class="font-bold text-xs">${p.horasDisponibles} h</span>`;
      toggleActiveHtml = `<span class="text-[10px] font-bold ${p.activo?'text-emerald-700':'text-slate-400'}">${p.activo?'Activo':'Inactivo'}</span>`;
    }

    tr.innerHTML=`<td class="p-2.5"><div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background:${p.color}"></span>
        <span class="font-bold text-slate-800">${p.nombre}</span></div></td>
      <td class="p-2.5 text-center">${horasInputHtml}</td>
      <td class="p-2.5 text-center font-bold text-slate-600">${REGLA_MAX_HORAS_CHANGE}h (global)</td>
      <td class="p-2.5 text-center">${toggleActiveHtml}</td>
      <td class="p-2.5 text-center">${deleteBtnHtml}</td>`;
    tbody.appendChild(tr);
  });
}

function onCambiarHorasPais(key, val) {
  if (!esAdmin()) { mostrarToast('Solo el Administrador puede configurar países', 'warning'); return; }
  actualizarPais(key, parseInt(val));
  registrarAudit('CONFIG', `horasDisponibles (${key})`, '—', val);
  guardarDatos(true);
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  actualizarIndicadores();
  mostrarToast(`Horas de ${key} actualizadas a ${val}h`, 'success');
}

function onTogglePaisActivo(key, activo) {
  if (!esAdmin()) { mostrarToast('Solo el Administrador puede configurar países', 'warning'); return; }
  actualizarPais(key, undefined, activo);
  registrarAudit('CONFIG', `activo (${key})`, '—', activo?'Sí':'No');
  guardarDatos(true);
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  mostrarToast(`${key} ${activo?'activado':'desactivado'}`, 'info');
}

function onEliminarPais(key) {
  if (!esAdmin()) { mostrarToast('Solo el Administrador puede eliminar países', 'warning'); return; }
  if (!confirm(`¿Eliminar el país "${key}" de la configuración?`)) return;
  eliminarPais(key);
  registrarAudit('CONFIG', 'eliminarPais', key, '(eliminado)');
  guardarDatos(true);
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  renderizarConfigPaises();
  mostrarToast(`País ${key} eliminado`, 'warning');
}

function onAgregarPais() {
  if (!esAdmin()) { mostrarToast('Solo el Administrador puede agregar países', 'warning'); return; }
  const nombre = document.getElementById('inpNuevoPaisNombre')?.value?.trim();
  const horas = parseInt(document.getElementById('inpNuevoPaisHoras')?.value) || 100;
  const color = document.getElementById('inpNuevoPaisColor')?.value || '#64748b';
  if (!nombre) { mostrarToast('Ingresa el nombre del país','error'); return; }
  if (agregarPais(nombre, horas, color)) {
    registrarAudit('CONFIG', 'agregarPais', '(nuevo)', `${nombre} (${horas}h)`);
    guardarDatos(true);
    poblarFiltroPaises(); poblarSelectPaisFormulario();
    renderizarConfigPaises();
    document.getElementById('inpNuevoPaisNombre').value='';
    document.getElementById('inpNuevoPaisHoras').value='100';
    mostrarToast(`País "${nombre}" agregado con ${horas}h/mes ✅`, 'success');
  } else {
    mostrarToast('Ese país ya existe','error');
  }
}

// ============================================================
// FORMULARIO "+ CHANGE" (RECONFIGURADO CON LOS 5 CAMPOS OBLIGATORIOS)
// ============================================================
function abrirModalNuevaChange() {
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }
  document.getElementById('modalTitulo').textContent = '+ Nueva Solicitud de Change';
  document.getElementById('modalSubtitulo').textContent = 'Los 5 campos marcados con (*) son obligatorios';
  document.getElementById('formChange').reset();
  document.getElementById('spItemId').value = '';
  document.getElementById('d1').value = new Date().toISOString().split('T')[0];
  document.getElementById('inpPais').value = 'Brasil';

  habilitarCamposFormulario(true);
  document.getElementById('btnGuardarModalChange').classList.remove('hidden');

  cargarPasosEnFormulario([]);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
}

function abrirModalEdicion(idOrSpId) {
  const ch = appState.changes.find(c => String(c.id||c.spId) === String(idOrSpId));
  if (!ch) return;

  const editable = puedeEditar();
  document.getElementById('modalTitulo').textContent = editable ? `Editar Change: ${ch.numeroChange}` : `Consulta de Change: ${ch.numeroChange} (Solo Lectura)`;
  document.getElementById('modalSubtitulo').textContent = editable ? 'Todos los campos están habilitados para edición' : 'Modo de solo lectura activo para este usuario';
  document.getElementById('spItemId').value = String(ch.id||ch.spId);

  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };

  // 5 Campos principales
  sv('inpSolicitante', ch.solicitante);
  sv('inpChange', ch.numeroChange);
  sv('inpBusinessService', ch.businessService);
  sv('inpDescricao', ch.descripcion);
  sv('inpEngenheiro', ch.engenheiro);

  // Demás campos
  sv('inpPais', ch.pais || 'Brasil');
  sv('inpRitm', ch.ritm);
  sv('inpProduto', ch.producto);
  sv('inpHorasEst', ch.horasEstimadas);
  sv('inpHorasApr', ch.horasAprovadas);
  sv('inpAnalise', ch.analise);
  sv('inpRollback', ch.rollback);
  sv('inpAprovadorNome', ch.aprovadorNome);
  sv('inpAprovadorEmail', ch.aprovadorEmail);
  sv('inpStatusAprov', ch.statusAprovacao);

  sv('d1', ch.d1); sv('d2', ch.d2); sv('d3', ch.d3); sv('d4', ch.d4);
  sv('d5', ch.d5); sv('d6', ch.d6); sv('d7', ch.d7); sv('d8', ch.d8);

  habilitarCamposFormulario(editable);

  const btnGuardar = document.getElementById('btnGuardarModalChange');
  if (btnGuardar) {
    if (editable) btnGuardar.classList.remove('hidden');
    else btnGuardar.classList.add('hidden');
  }

  cargarPasosEnFormulario(ch.pasosImplementacion || []);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
}

function habilitarCamposFormulario(habilitar) {
  const form = document.getElementById('formChange');
  if (!form) return;
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(el => {
    if (el.id === 'spItemId') return;
    if (habilitar) {
      el.removeAttribute('disabled');
      el.removeAttribute('readonly');
      el.classList.remove('bg-slate-100', 'text-slate-500');
    } else {
      el.setAttribute('disabled', 'true');
      el.classList.add('bg-slate-100', 'text-slate-500');
    }
  });

  const btnAddPaso = document.getElementById('btnAgregarPasoModal');
  if (btnAddPaso) {
    if (habilitar) btnAddPaso.classList.remove('hidden');
    else btnAddPaso.classList.add('hidden');
  }
}

function fecharModal() { document.getElementById('modalChange').classList.add('hidden'); }

function actualizarBadgeModal() {
  const h=parseFloat(document.getElementById('inpHorasEst')?.value||0);
  const badge=document.getElementById('badgeClassificacaoModal'); if(!badge) return;
  if (h<=REGLA_MAX_HORAS_CHANGE) {
    badge.textContent=`✅ MEJORA (${h}h ≤ ${REGLA_MAX_HORAS_CHANGE}h)`;
    badge.className='inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300';
  } else {
    badge.textContent=`⚠️ PROYECTO (${h}h > ${REGLA_MAX_HORAS_CHANGE}h — fuera de alcance)`;
    badge.className='inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300';
  }
}

function salvarFormularioChange(event) {
  event.preventDefault();
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }

  const id=document.getElementById('spItemId').value;
  const isUpdate=id!=='';
  const gv=elId=>{const el=document.getElementById(elId);return el?el.value.trim():'';};

  // Validar obligatoriedad estricta de los 5 campos exigidos:
  const solicitante = gv('inpSolicitante');
  const numeroChange = gv('inpChange');
  const businessService = gv('inpBusinessService');
  const shortDescription = gv('inpDescricao');
  const assignedTo = gv('inpEngenheiro');

  if (!solicitante || !numeroChange || !businessService || !shortDescription || !assignedTo) {
    mostrarToast('Por favor completa los 5 campos obligatorios: Solicitante, Number, Business Service, Short Description y Assigned To', 'error');
    return;
  }

  const horasEst=parseFloat(gv('inpHorasEst'))||0;
  const horasApr=parseFloat(gv('inpHorasApr'))||0;
  const pais=gv('inpPais')||'Brasil';
  const tipo=clasificarChange(horasEst);
  const pasos=obtenerPasosDesdeFormulario();
  const d1v=gv('d1');
  const user = obtenerUsuarioActual().nombre;

  const data={
    numeroChange,
    ritm: gv('inpRitm'),
    solicitante,
    pais,
    businessService,
    producto: gv('inpProduto') || 'General',
    descripcion: shortDescription,
    engenheiro: assignedTo,
    horasEstimadas: horasEst,
    horasAprovadas: horasApr,
    tipoChange: tipo,
    pasosImplementacion: pasos,
    analise: gv('inpAnalise'),
    rollback: gv('inpRollback'),
    aprovadorNome: gv('inpAprovadorNome'),
    aprovadorEmail: gv('inpAprovadorEmail'),
    statusAprovacao: gv('inpStatusAprov'),
    d1: d1v, d2: gv('d2'), d3: gv('d3'), d4: gv('d4'),
    d5: gv('d5'), d6: gv('d6'), d7: gv('d7'), d8: gv('d8'),
    ultimaModificacao: new Date().toISOString(),
    modificadoPor: user,
    mesAno: d1v ? d1v.substring(0,7) : appState.mesActivo,
  };
  data.faseAtual = determinarFasePorFechas(data);

  const camposAudit=['numeroChange','solicitante','pais','businessService','producto','descripcion','engenheiro','horasEstimadas','horasAprovadas','statusAprovacao','faseAtual'];

  if (isUpdate) {
    const idx=appState.changes.findIndex(c=>String(c.id||c.spId)===String(id));
    if(idx!==-1){
      const prev=appState.changes[idx];
      registrarAuditCambios(data.numeroChange, prev, data, camposAudit);
      data.historialFases=prev.historialFases||[];
      data.teamsLink=prev.teamsLink||'';
      data.fechaCreacion=prev.fechaCreacion||d1v;
      data.id=prev.id; data.spId=prev.spId;
      appState.changes[idx]={...prev,...data};
      mostrarToast(`Change ${data.numeroChange} actualizada ✅`,'success');
    }
  } else {
    data.id=`CHG-${Date.now()}`; data.spId=Date.now();
    data.historialFases=[{de:'',a:data.faseAtual,fecha:new Date().toISOString().split('T')[0],usuario:user}];
    data.fechaCreacion=d1v||new Date().toISOString().split('T')[0];
    data.fechaCierre='';
    data.teamsLink=generarEnlaceTeams(data);
    registrarAudit(data.numeroChange, 'CREACIÓN', '(nueva)', `${data.pais} / ${data.producto} / ${data.horasEstimadas}h`, user);
    appState.changes.unshift(data);
    mostrarToast(`Change ${data.numeroChange} creada ✅`,'success');
  }

  guardarDatos(true);
  fecharModal();
  renderizarTodo();
}

function determinarFasePorFechas(d) {
  if(d.d8) return 'Concluida'; if(d.d7) return 'Execucao'; if(d.d6) return 'Aprovacao';
  if(d.d5) return 'Apresentacao'; if(d.d4) return 'Comite'; if(d.d3) return 'Analise';
  if(d.d2) return 'Reuniao'; return 'Abertura';
}

function generarEnlaceTeams(ch) {
  const t=encodeURIComponent(`${ch.numeroChange} – ${(ch.descripcion||'').substring(0,50)} – ${ch.pais||''}`);
  return `https://teams.microsoft.com/l/chat/0/0?topicName=${t}`;
}

// ============================================================
// PASOS DE IMPLEMENTACIÓN
// ============================================================
function agregarFilaPaso(fase='',accion='',horas=0,fecha='') {
  const tbody=document.getElementById('tbodyPasosImplementacion'); if(!tbody) return;
  const tr=document.createElement('tr'); tr.className='border-b border-slate-100 hover:bg-slate-50';
  const opts=OPCIONES_PASOS.map(o=>`<option value="${o}" ${o===fase?'selected':''}>${o}</option>`).join('');
  const editAllowed = puedeEditar();

  tr.innerHTML=`<td class="p-1.5"><select class="paso-fase-sel w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" ${!editAllowed?'disabled':''}>${opts}</select></td>
    <td class="p-1.5"><input type="text" class="paso-accion-inp w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" placeholder="Tarea..." value="${accion}" ${!editAllowed?'readonly':''}></td>
    <td class="p-1.5 text-center"><input type="number" class="paso-horas-inp w-14 py-1 px-1 border border-slate-200 rounded-lg text-[11px] text-center font-bold" min="0" step="0.5" value="${horas}" ${!editAllowed?'readonly':''} oninput="recalcularHorasDesdePasos()"></td>
    <td class="p-1.5"><input type="date" class="paso-fecha-inp w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" value="${fecha}" ${!editAllowed?'readonly':''}></td>
    <td class="p-1.5 text-center">${editAllowed?`<button type="button" onclick="this.closest('tr').remove();recalcularHorasDesdePasos()" class="p-1 text-rose-500 hover:bg-rose-50 rounded text-[10px]"><i class="fa-solid fa-trash-can"></i></button>`:''}</td>`;
  tbody.appendChild(tr);
  recalcularHorasDesdePasos();
}

function recalcularHorasDesdePasos() {
  const t=[...document.querySelectorAll('.paso-horas-inp')].reduce((s,el)=>s+parseFloat(el.value||0),0);
  if(t>0){const inp=document.getElementById('inpHorasEst');if(inp){inp.value=t;actualizarBadgeModal();}}
}

function obtenerPasosDesdeFormulario() {
  return [...document.querySelectorAll('#tbodyPasosImplementacion tr')].map(tr=>({
    fase:tr.querySelector('.paso-fase-sel')?.value||'', accion:tr.querySelector('.paso-accion-inp')?.value||'',
    horas:parseFloat(tr.querySelector('.paso-horas-inp')?.value||0), fechaTentativa:tr.querySelector('.paso-fecha-inp')?.value||''
  })).filter(p=>p.accion||p.horas>0);
}

function cargarPasosEnFormulario(pasos) {
  const tbody=document.getElementById('tbodyPasosImplementacion'); if(!tbody) return;
  tbody.innerHTML='';
  if(Array.isArray(pasos)&&pasos.length>0) pasos.forEach(p=>agregarFilaPaso(p.fase,p.accion,p.horas,p.fechaTentativa));
  else { agregarFilaPaso('1. Análisis Técnico & Requerimientos','Levantamiento inicial',2,''); agregarFilaPaso('3. Desarrollo Backend / APIs','Implementación',8,''); agregarFilaPaso('6. Pruebas QA & Regresión','Pruebas',4,''); }
}

// ============================================================
// EXCEL IMPORT / EXPORT
// ============================================================
let excelParsedRows=[];

function abrirModalUploadExcel() {
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }
  excelParsedRows=[];
  const inp=document.getElementById('inputExcelFile'); if(inp) inp.value='';
  document.getElementById('previewUploadContainer')?.classList.add('hidden');
  const btn=document.getElementById('btnConfirmarImportacion'); if(btn) btn.disabled=true;
  document.getElementById('modalUploadExcel')?.classList.remove('hidden');
}
function fecharModalUploadExcel() { document.getElementById('modalUploadExcel')?.classList.add('hidden'); }
function handleExcelFileSelect(e) { const f=e.target.files[0]; if(f) procesarArchivoExcel(f); }

function procesarArchivoExcel(file) {
  const r=new FileReader();
  r.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      if(!rows.length){mostrarToast('Archivo vacío','error');return;}
      excelParsedRows=rows.map((r,i)=>mapearFila(r,i));
      mostrarPreview(excelParsedRows);
    }catch(err){mostrarToast('Error: '+err.message,'error');}
  };
  r.readAsArrayBuffer(file);
}

function mapearFila(row,idx) {
  const fv=(...keys)=>{for(const k of Object.keys(row)){const n=k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(keys.some(c=>n.includes(c)))return row[k];}return '';};
  const hE=parseFloat(fv('horas estimadas','horas est','horas')||0);
  const pais=fv('pais','country')||'Brasil';
  return {
    id:`CHG-IMP-${Date.now()}-${idx}`,spId:Date.now()+idx,
    numeroChange:String(fv('change','numero','chg','titulo')||`CHG-IMP-${String(idx+1).padStart(3,'0')}`).trim(),
    ritm:String(fv('ritm','requerimiento')||'').trim(),
    solicitante:String(fv('solicitante','requester')||'Sin solicitante').trim(), pais,
    businessService:String(fv('business service','servicio')||'General').trim(),
    producto:String(fv('producto','product')||'General').trim(),
    descripcion:String(fv('descripcion','description','resumen','short description')||'Sin descripción').trim(),
    engenheiro:String(fv('ingeniero','engineer','responsable','assigned to')||'').trim(),
    horasEstimadas:hE, horasAprovadas:parseFloat(fv('horas aprov')||hE),
    tipoChange:clasificarChange(hE),
    faseAtual:normalizarFaseKey(String(fv('fase','status','estado')||'Abertura')),
    statusAprovacao:String(fv('aprobacion','aprovacao')||'Pendente'),
    analise:'',rollback:'',pasosImplementacion:[],aprovadorNome:'',aprovadorEmail:'',
    d1:new Date().toISOString().split('T')[0],d2:'',d3:'',d4:'',d5:'',d6:'',d7:'',d8:'',
    mesAno:appState.mesActivo, teamsLink:'',
    historialFases:[{de:'',a:'Abertura',fecha:new Date().toISOString().split('T')[0],usuario:'Importación'}],
    fechaCreacion:new Date().toISOString().split('T')[0],fechaCierre:'',
    ultimaModificacao:new Date().toISOString(),modificadoPor:obtenerUsuarioActual().nombre
  };
}

function mostrarPreview(items) {
  const tbody=document.getElementById('tbodyPreviewExcel'); if(!tbody) return;
  tbody.innerHTML='';
  items.slice(0,8).forEach(it=>{
    const tr=document.createElement('tr'); tr.className='border-b border-slate-100 text-xs';
    tr.innerHTML=`<td class="p-1.5 font-bold">${it.numeroChange}</td><td class="p-1.5">${it.solicitante}</td><td class="p-1.5">${it.pais}</td><td class="p-1.5">${it.producto}</td><td class="p-1.5 text-center font-bold">${it.horasEstimadas}h</td>`;
    tbody.appendChild(tr);
  });
  setText('txtTotalImportar',`${items.length} registros`);
  document.getElementById('previewUploadContainer')?.classList.remove('hidden');
  const btn=document.getElementById('btnConfirmarImportacion'); if(btn) btn.disabled=false;
}

function ejecutarImportacionExcel() {
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }
  if(!excelParsedRows.length) return;
  const modo=document.querySelector('input[name="modoImportacion"]:checked')?.value||'anexar';
  if(modo==='reemplazar') appState.changes=[...excelParsedRows];
  else appState.changes=[...appState.changes,...excelParsedRows];
  registrarAudit('IMPORTACIÓN','backlog','—',`${excelParsedRows.length} registros (${modo})`, obtenerUsuarioActual().nombre);
  guardarDatos(true); fecharModalUploadExcel(); renderizarTodo();
  mostrarToast(`${excelParsedRows.length} changes importadas ✅`,'success');
}

function descargarPlantillaExcel() {
  const h=[['Número Change','RITM','Solicitante','País','Business Service','Producto','Short Description','Assigned To','Horas Estimadas','Horas Aprobadas','Fase Actual','Status Aprobación']];
  const ej=[['CHG0099100','RITM0155001','Andrés Delgado','Brasil','E-Commerce','Nescafé','Optimización checkout B2B','Carlos Mendoza',15,15,'Abertura','Pendente']];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([...h,...ej]),'Plantilla');
  XLSX.writeFile(wb,'Plantilla_Changes.xlsx');
}

function exportarExcel() {
  const f=obtenerChangesFiltradas();
  const ws=[['Change','RITM','Solicitante','País','Business Service','Producto','Short Description','Assigned To','Horas Est.','Horas Apr.','Tipo','Fase','Status','Abertura','Reunião','Análise','Comitê','Apresentação','Aprovação','Execução','Conclusão']];
  f.forEach(c=>{const fo=FASES_KEY_MAP[c.faseAtual]; ws.push([c.numeroChange,c.ritm,c.solicitante,c.pais,c.businessService,c.producto,c.descripcion,c.engenheiro,c.horasEstimadas,c.horasAprovadas,c.tipoChange,fo?fo.label:c.faseAtual,c.statusAprovacao,c.d1||'',c.d2||'',c.d3||'',c.d4||'',c.d5||'',c.d6||'',c.d7||'',c.d8||'']);});
  const wb=XLSX.utils.book_new(); const s=XLSX.utils.aoa_to_sheet(ws); s['!cols']=ws[0].map(()=>({wch:18}));
  XLSX.utils.book_append_sheet(wb,s,'Changes');
  XLSX.writeFile(wb,`Changes_${appState.filtroPais}_${appState.mesActivo}.xlsx`);
  mostrarToast('Excel descargado ✅','success');
}

// ============================================================
// ELIMINAR / SYNC / EVENTOS
// ============================================================
function eliminarChange(id) {
  if (!puedeEditar()) {
    mostrarToast('Acceso denegado: Usuario en modo Lectura', 'warning');
    return;
  }
  if(!confirm('¿Eliminar esta Change?')) return;
  const idx=appState.changes.findIndex(c=>String(c.id||c.spId)===String(id));
  if(idx!==-1){
    const ch=appState.changes[idx];
    registrarAudit(ch.numeroChange,'ELIMINACIÓN',ch.numeroChange,'(eliminada)', obtenerUsuarioActual().nombre);
    appState.changes.splice(idx,1);
    guardarDatos(true); renderizarTodo(); mostrarToast(`${ch.numeroChange} eliminada`,'warning');
  }
}

async function sincronizarConSharePoint() {
  mostrarToast('Sincronizando...','info'); setIndicadorSync('syncing');
  try { guardarDatos(true); renderizarTodo(); mostrarToast('Sincronización completada ✅','success'); }
  catch(_){ mostrarToast('Modo local activo','warning'); }
  finally { setIndicadorSync('live'); }
}

function configurarEventos() {
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>cambiarVista(btn.dataset.view));
  });
  const bind=(id,ev,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(ev,fn);};
  bind('inpBuscar','input',e=>{appState.filtroTexto=e.target.value;renderizarTodo();});
  bind('filtroSolicitante','change',e=>{appState.filtroSolicitante=e.target.value;renderizarTodo();});
  bind('filtroBusinessService','change',e=>{appState.filtroBusinessService=e.target.value;renderizarTodo();});
  bind('filtroProducto','change',e=>{appState.filtroProducto=e.target.value;renderizarTodo();});
  bind('filtroPais','change',e=>{appState.filtroPais=e.target.value;renderizarTodo();});
  bind('filtroStatus','change',e=>{appState.filtroStatus=e.target.value;renderizarTodo();});
  bind('selectorMes','change',e=>{appState.mesActivo=e.target.value;renderizarTodo();});
  bind('inpHorasEst','input',actualizarBadgeModal);
  bind('selectUsuarioSesion','change',e=>cambiarUsuarioActivo(e.target.value));

  // Dropzone
  const dz=document.getElementById('uploadDropzone');
  if(dz){
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();if(puedeEditar())dz.classList.add('drag-active');}));
    ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag-active');}));
    dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)procesarArchivoExcel(f);});
  }
}

function cambiarVista(vista) {
  appState.vistaActiva=vista;
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    const act=btn.dataset.view===vista;
    btn.className=`tab-btn py-1.5 px-3 font-${act?'bold text-blue-600 border-b-2 border-blue-600':'semibold text-slate-500 hover:text-slate-700 border-b-2 border-transparent'} text-xs flex items-center gap-1.5 whitespace-nowrap`;
  });
  ['kanban','fases','dashboard','tabla','historial','config','usuarios'].forEach(v=>{
    const el=document.getElementById('secao'+v.charAt(0).toUpperCase()+v.slice(1));
    if(el) el.classList.toggle('hidden',v!==vista);
  });
  renderizarTodo();
}

function setIndicadorSync(st) {
  const el=document.getElementById('indicadorSync'); if(!el) return;
  const h=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if(st==='live'){el.className='status-pill-live px-2 rounded-full text-[10px] font-semibold flex items-center gap-1';el.innerHTML=`<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span><i class="fa-solid fa-wifi text-emerald-600"></i> (${h})`;}
  else if(st==='syncing'){el.className='status-pill-syncing px-2 rounded-full text-[10px] font-semibold flex items-center gap-1';el.innerHTML=`<i class="fa-solid fa-rotate fa-spin text-blue-600"></i> Guardando...`;}
  else{el.className='status-pill-offline px-2 rounded-full text-[10px] font-semibold flex items-center gap-1';el.innerHTML=`<i class="fa-solid fa-circle-exclamation text-amber-600"></i> Local`;}
}

function mostrarToast(msg,tipo='info') {
  const c=document.getElementById('toast-container'); if(!c) return;
  const t=document.createElement('div');
  const icons={success:'fa-check-circle text-emerald-500',warning:'fa-triangle-exclamation text-amber-500',error:'fa-circle-xmark text-rose-500',info:'fa-info-circle text-blue-500'};
  t.className=`toast toast-${tipo}`;
  t.innerHTML=`<i class="fa-solid ${icons[tipo]||icons.info} text-base shrink-0"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{t.style.cssText='opacity:0;transform:translateY(10px);transition:all .3s';setTimeout(()=>t.remove(),300);},4000);
}
