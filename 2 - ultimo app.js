/**
 * app.js — Portal de Gestión de Changes v4.1
 * =====================================================
 * CAMBIOS v4.1:
 *  - Historial/auditoría con log campo por campo
 *  - Gráfica de horas por producto FILTRADA por país
 *  - Países configurables desde la UI (agregar/editar/eliminar)
 *  - Horas por país editables sin tocar código
 *  - 30h es regla GLOBAL fija para todos los países
 *  - Campos de horas y fecha obligatorios
 *  - Tab "Historial" para consultar audit log
 *  - Tab "Configuración" para gestionar países
 */

// ============================================================
// MAPA DE FASES (keys sin acentos)
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
  '1. Análisis Técnico','2. Diseño','3. Desarrollo Backend',
  '4. Desarrollo Frontend','5. Integración','6. Pruebas QA',
  '7. Pruebas UAT','8. Despliegue','9. Capacitación',
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
};

// Audit log
let auditLog = [];

// Historico mensual
let historialMensual = {};

// Charts
let charts = { gauge:null, prodDash:null, fasesDash:null, mesAnterior:null, mesActual:null };

// Drag
let draggedId = null, dragActive = false;

// Sync
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel('nestle_changes_v4');
  syncChannel.onmessage = () => { cargarDesdeStorage(); renderizarTodo(); };
} catch(_){}
window.addEventListener('storage', e => {
  if (e.key === 'nestle_changes_v4' && e.newValue) { cargarDesdeStorage(); renderizarTodo(); }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  inicializarMes();
  cargarDatos();
  poblarFiltroPaises();
  poblarSelectPaisFormulario();
  inicializarGraficoGauge();
  configurarEventos();
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
  const raw = localStorage.getItem('nestle_changes_v4');
  if (raw) {
    try { appState.changes = JSON.parse(raw).map(normalizarChange); }
    catch(_) { appState.changes = (typeof initialChangesData!=='undefined'?[...initialChangesData]:[]).map(normalizarChange); }
  } else if (typeof initialChangesData !== 'undefined') {
    appState.changes = initialChangesData.map(normalizarChange);
    guardarDatos(false);
  }
  // Audit log
  try { auditLog = JSON.parse(localStorage.getItem('nestle_audit_log_v4') || '[]'); } catch(_) { auditLog = []; }
  // Historial mensual
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
  localStorage.setItem('nestle_audit_log_v4', JSON.stringify(auditLog));
  guardarHistorialMensual();
  if (emitir && syncChannel) syncChannel.postMessage({type:'SYNC'});
  setTimeout(() => setIndicadorSync('live'), 400);
}

function cargarDesdeStorage() {
  try { appState.changes = JSON.parse(localStorage.getItem('nestle_changes_v4')||'[]').map(normalizarChange); } catch(_){}
  try { auditLog = JSON.parse(localStorage.getItem('nestle_audit_log_v4')||'[]'); } catch(_){}
}

// ============================================================
// AUDIT LOG — Registro campo por campo
// ============================================================
function registrarAudit(changeNum, campo, valorAnterior, valorNuevo, usuario) {
  if (String(valorAnterior) === String(valorNuevo)) return;
  auditLog.unshift({
    timestamp: new Date().toISOString(),
    usuario: usuario || appState.usuarioActual,
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
  sel.innerHTML = '<option value="todos">Todos los Países</option>';
  obtenerPaisesActivos().forEach(p => {
    sel.innerHTML += `<option value="${p.key}">${p.nombre}</option>`;
  });
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
    card.className = `kanban-card ${esP?'card-accent-excede':'card-accent-small'}`;
    card.draggable = true;
    card.dataset.id = idStr;
    card.innerHTML = `
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="font-bold text-xs text-blue-700 font-mono">${ch.numeroChange||'SIN-ID'}</span>
        <span class="text-[9px] font-bold px-1.5 rounded ${esP?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}">${h}h${esP?' ⚠️':''}</span>
      </div>
      <p class="text-[11px] font-medium text-slate-800 line-clamp-2 leading-snug mb-1.5">${ch.descripcion||'Sin descripción'}</p>
      <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span class="truncate max-w-[80px]"><i class="fa-solid fa-user text-[9px] text-slate-400 mr-0.5"></i>${ch.solicitante||'N/A'}</span>
        <div class="flex items-center gap-1">
          ${fIdx>0?`<button type="button" data-act="prev" data-id="${idStr}" class="w-4 h-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-[8px]"><i class="fa-solid fa-chevron-left"></i></button>`:''}
          <button type="button" data-act="open" data-id="${idStr}" class="text-blue-600 font-semibold hover:underline text-[10px]">Ver</button>
          ${fIdx<FASES.length-1?`<button type="button" data-act="next" data-id="${idStr}" class="w-4 h-4 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center text-[8px]"><i class="fa-solid fa-chevron-right"></i></button>`:''}
        </div>
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

    card.addEventListener('dragstart', e => {
      draggedId=idStr; dragActive=true; card.classList.add('dragging');
      e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',idStr);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-col').forEach(c=>c.classList.remove('drag-over'));
      setTimeout(()=>{dragActive=false;draggedId=null;},100);
    });

    col.appendChild(card);
  });

  FASES.forEach(f => { const b=document.getElementById(`badge-${f.key}`); if(b) b.textContent=cnt[f.key]||0; });
  configurarDropZones();
}

function configurarDropZones() {
  FASES.forEach(f => {
    const w = document.getElementById(`kanban-col-${f.key}`);
    if (!w) return;
    w.ondragenter = e => { e.preventDefault(); w.classList.add('drag-over'); };
    w.ondragleave = e => { if (!w.contains(e.relatedTarget)) w.classList.remove('drag-over'); };
    w.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; };
    w.ondrop = e => {
      e.preventDefault(); w.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain')||draggedId;
      if (id) moverChangeDeFase(id, f.key);
    };
  });
}

function moverChangeDeFase(changeId, nuevaFase) {
  nuevaFase = normalizarFaseKey(nuevaFase);
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(changeId));
  if (!ch || ch.faseAtual===nuevaFase) return;

  const anterior = ch.faseAtual;
  registrarAudit(ch.numeroChange, 'faseAtual', FASES_KEY_MAP[anterior]?.label||anterior, FASES_KEY_MAP[nuevaFase]?.label||nuevaFase);

  if (!ch.historialFases) ch.historialFases=[];
  ch.historialFases.push({de:anterior,a:nuevaFase,fecha:new Date().toISOString().split('T')[0],usuario:appState.usuarioActual});

  ch.faseAtual = nuevaFase;
  ch.ultimaModificacao = new Date().toISOString();
  ch.modificadoPor = appState.usuarioActual;

  const fo = FASES_KEY_MAP[nuevaFase];
  if (fo && !ch[fo.dKey]) ch[fo.dKey] = new Date().toISOString().split('T')[0];

  guardarDatos(true);
  if (appState.vistaActiva==='kanban') renderizarKanban();
  else if (appState.vistaActiva==='fases') renderizarMatriz();
  actualizarIndicadores();
  mostrarToast(`${ch.numeroChange} → "${FASES_KEY_MAP[nuevaFase]?.label||nuevaFase}"`, 'success');
}

function moverFaseRelativa(id, delta) {
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

  filtradas.forEach(ch => {
    const h = parseFloat(ch.horasEstimadas||0);
    const esP = h>REGLA_MAX_HORAS_CHANGE;
    const tr = document.createElement('tr');
    tr.className='hover:bg-slate-50 border-b border-slate-100';
    let fTds='';
    FASES.forEach(f => {
      const dv=ch[f.dKey]||'';
      const esCurr = ch.faseAtual===f.key;
      let icon;
      if (dv) icon=`<div class="phase-checkpoint completed"><i class="fa-solid fa-check"></i></div><span class="text-[9px] text-slate-500 font-mono mt-0.5">${dv.substring(5)}</span>`;
      else if (esCurr) icon=`<div class="phase-checkpoint current"><i class="fa-solid fa-spinner fa-spin"></i></div><span class="text-[9px] text-blue-600 font-bold mt-0.5">Actual</span>`;
      else icon=`<div class="phase-checkpoint pending"><i class="fa-regular fa-circle"></i></div><span class="text-[9px] text-slate-400 mt-0.5">—</span>`;
      fTds+=`<td class="p-2 text-center"><div class="flex flex-col items-center cursor-pointer hover:opacity-80" onclick="accionCheckpoint('${ch.id||ch.spId}','${f.dKey}','${f.key}')">${icon}</div></td>`;
    });
    tr.innerHTML=`<td class="p-2.5"><a href="javascript:void(0)" onclick="abrirModalEdicion('${ch.id||ch.spId}')" class="font-bold text-blue-700 font-mono hover:underline text-xs">${ch.numeroChange}</a><span class="block text-[10px] text-slate-400">${ch.pais||''}</span></td>
      <td class="p-2.5"><span class="block font-semibold text-xs">${ch.solicitante||'—'}</span><span class="text-[10px] text-blue-600">${ch.businessService||'—'}</span></td>
      <td class="p-2.5"><span class="block font-medium text-xs truncate max-w-[120px]">${ch.producto||'—'}</span></td>${fTds}`;
    tbody.appendChild(tr);
  });
}

function accionCheckpoint(chId, dKey, faseKey) {
  const ch = appState.changes.find(c=>String(c.id||c.spId)===String(chId));
  if (!ch) return;
  if (ch[dKey]) {
    registrarAudit(ch.numeroChange, dKey, ch[dKey], '(removido)');
    ch[dKey]=''; ch.ultimaModificacao=new Date().toISOString();
    guardarDatos(true); renderizarMatriz(); actualizarIndicadores();
  } else {
    ch[dKey]=new Date().toISOString().split('T')[0];
    moverChangeDeFase(chId, faseKey);
    if (appState.vistaActiva==='fases') renderizarMatriz();
  }
}

// ============================================================
// DASHBOARD CON GRÁFICOS POR PAÍS
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

  // Comparativo mensual
  renderizarComparativo();
}

function renderizarComparativo() {
  const pais=appState.filtroPais, mesAct=appState.mesActivo, mesAnt=obtenerMesAnteriorKey(mesAct);
  setText('lblMesActual',formatMes(mesAct)); setText('lblMesAnterior',formatMes(mesAnt));
  renderGrafComp('chartMesActual',charts.mesActual,obtenerSnapshotMes(mesAct,pais),formatMes(mesAct),pais,c=>{charts.mesActual=c;});
  renderGrafComp('chartMesAnterior',charts.mesAnterior,obtenerSnapshotMes(mesAnt,pais),formatMes(mesAnt),pais,c=>{charts.mesAnterior=c;});
}

function renderGrafComp(canvasId,exist,snap,label,pais,cb) {
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
  filtradas.forEach(ch=>{
    const h=parseFloat(ch.horasEstimadas||0), esP=h>REGLA_MAX_HORAS_CHANGE, fo=FASES_KEY_MAP[ch.faseAtual], cid=String(ch.id||ch.spId);
    const tr=document.createElement('tr'); tr.className='hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML=`<td class="p-2.5 font-bold text-blue-700 font-mono">${ch.numeroChange}</td>
      <td class="p-2.5">${ch.pais||'—'}</td><td class="p-2.5 font-medium">${ch.solicitante||'—'}</td>
      <td class="p-2.5">${ch.businessService||'—'}</td><td class="p-2.5 font-semibold">${ch.producto||'—'}</td>
      <td class="p-2.5 text-slate-600 max-w-xs truncate">${ch.descripcion||'—'}</td>
      <td class="p-2.5 text-center font-bold">${h}h</td>
      <td class="p-2.5 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${esP?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}">${esP?'Proyecto':'Mejora'}</span></td>
      <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">${fo?fo.label:ch.faseAtual}</span></td>
      <td class="p-2.5 text-center"><span class="px-1.5 py-0.5 rounded ${ch.statusAprovacao==='Aprovado'?'bg-emerald-100 text-emerald-800':ch.statusAprovacao==='Rejeitado'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800'} font-semibold text-[10px]">${ch.statusAprovacao||'Pendente'}</span></td>
      <td class="p-2.5 text-center"><div class="flex items-center justify-center gap-1.5">
        <button onclick="abrirModalEdicion('${cid}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded"><i class="fa-solid fa-pen text-[11px]"></i></button>
        <button onclick="eliminarChange('${cid}')" class="p-1 text-rose-600 hover:bg-rose-100 rounded"><i class="fa-solid fa-trash text-[11px]"></i></button>
      </div></td>`;
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
// CONFIGURACIÓN DE PAÍSES (desde la UI)
// ============================================================
function renderizarConfigPaises() {
  const tbody=document.getElementById('tbodyConfigPaises'); if(!tbody) return;
  tbody.innerHTML='';
  const paises=obtenerTodosPaises();
  paises.forEach(p => {
    const tr=document.createElement('tr'); tr.className='border-b border-slate-100 text-xs hover:bg-slate-50';
    tr.innerHTML=`<td class="p-2.5"><div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background:${p.color}"></span>
        <span class="font-bold text-slate-800">${p.nombre}</span></div></td>
      <td class="p-2.5 text-center"><input type="number" value="${p.horasDisponibles}" min="10" step="10"
        class="w-20 p-1 border border-slate-300 rounded text-center font-bold text-xs"
        onchange="onCambiarHorasPais('${p.key}',this.value)"></td>
      <td class="p-2.5 text-center font-bold text-slate-600">${REGLA_MAX_HORAS_CHANGE}h (global)</td>
      <td class="p-2.5 text-center"><label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" ${p.activo?'checked':''} class="sr-only peer" onchange="onTogglePaisActivo('${p.key}',this.checked)">
        <div class="w-9 h-5 bg-slate-300 peer-checked:bg-emerald-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
      </label></td>
      <td class="p-2.5 text-center"><button onclick="onEliminarPais('${p.key}')" class="p-1 text-rose-500 hover:bg-rose-50 rounded"><i class="fa-solid fa-trash-can text-[11px]"></i></button></td>`;
    tbody.appendChild(tr);
  });
}

function onCambiarHorasPais(key, val) {
  actualizarPais(key, parseInt(val));
  registrarAudit('CONFIG', `horasDisponibles (${key})`, '—', val);
  guardarDatos(true);
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  actualizarIndicadores();
  mostrarToast(`Horas de ${key} actualizadas a ${val}h`, 'success');
}

function onTogglePaisActivo(key, activo) {
  actualizarPais(key, undefined, activo);
  registrarAudit('CONFIG', `activo (${key})`, '—', activo?'Sí':'No');
  guardarDatos(true);
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  mostrarToast(`${key} ${activo?'activado':'desactivado'}`, 'info');
}

function onEliminarPais(key) {
  if (!confirm(`¿Eliminar el país "${key}" de la configuración?`)) return;
  eliminarPais(key);
  registrarAudit('CONFIG', 'eliminarPais', key, '(eliminado)');
  guardarDatos(true);
  poblarFiltroPaises(); poblarSelectPaisFormulario();
  renderizarConfigPaises();
  mostrarToast(`País ${key} eliminado`, 'warning');
}

function onAgregarPais() {
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
// FORMULARIO NUEVA / EDITAR CHANGE
// ============================================================
function abrirModalNuevaChange() {
  document.getElementById('modalTitulo').textContent='Nueva Solicitud de Change';
  document.getElementById('formChange').reset();
  document.getElementById('spItemId').value='';
  document.getElementById('d1').value=new Date().toISOString().split('T')[0];
  document.getElementById('inpPais').value='Brasil';
  cargarPasosEnFormulario([]);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
}

function abrirModalEdicion(idOrSpId) {
  const ch=appState.changes.find(c=>String(c.id||c.spId)===String(idOrSpId));
  if(!ch) return;
  document.getElementById('modalTitulo').textContent=`Editar: ${ch.numeroChange}`;
  document.getElementById('spItemId').value=String(ch.id||ch.spId);
  const sv=(id,v)=>{const el=document.getElementById(id);if(el) el.value=v||'';};
  sv('inpSolicitante',ch.solicitante); sv('inpPais',ch.pais||'Brasil');
  sv('inpBusinessService',ch.businessService); sv('inpChange',ch.numeroChange);
  sv('inpRitm',ch.ritm); sv('inpProduto',ch.producto); sv('inpDescricao',ch.descripcion);
  sv('inpEngenheiro',ch.engenheiro); sv('inpHorasEst',ch.horasEstimadas); sv('inpHorasApr',ch.horasAprovadas);
  sv('inpAnalise',ch.analise); sv('inpRollback',ch.rollback);
  sv('inpAprovadorNome',ch.aprovadorNome); sv('inpAprovadorEmail',ch.aprovadorEmail); sv('inpStatusAprov',ch.statusAprovacao);
  sv('d1',ch.d1);sv('d2',ch.d2);sv('d3',ch.d3);sv('d4',ch.d4);sv('d5',ch.d5);sv('d6',ch.d6);sv('d7',ch.d7);sv('d8',ch.d8);
  cargarPasosEnFormulario(ch.pasosImplementacion||[]);
  actualizarBadgeModal();
  document.getElementById('modalChange').classList.remove('hidden');
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
  const id=document.getElementById('spItemId').value;
  const isUpdate=id!=='';
  const gv=elId=>{const el=document.getElementById(elId);return el?el.value.trim():'';};
  const horasEst=parseFloat(gv('inpHorasEst'))||0;
  const horasApr=parseFloat(gv('inpHorasApr'))||0;
  const pais=gv('inpPais')||'Brasil';
  const tipo=clasificarChange(horasEst);
  const pasos=obtenerPasosDesdeFormulario();
  const d1v=gv('d1');

  const data={
    numeroChange:gv('inpChange'), ritm:gv('inpRitm'),
    solicitante:gv('inpSolicitante')||'Sin solicitante', pais,
    businessService:gv('inpBusinessService')||'General',
    producto:gv('inpProduto')||'General', descripcion:gv('inpDescricao'),
    engenheiro:gv('inpEngenheiro'), horasEstimadas:horasEst, horasAprovadas:horasApr,
    tipoChange:tipo, pasosImplementacion:pasos,
    analise:gv('inpAnalise'), rollback:gv('inpRollback'),
    aprovadorNome:gv('inpAprovadorNome'), aprovadorEmail:gv('inpAprovadorEmail'),
    statusAprovacao:gv('inpStatusAprov'),
    d1:d1v,d2:gv('d2'),d3:gv('d3'),d4:gv('d4'),d5:gv('d5'),d6:gv('d6'),d7:gv('d7'),d8:gv('d8'),
    ultimaModificacao:new Date().toISOString(), modificadoPor:appState.usuarioActual,
    mesAno:d1v?d1v.substring(0,7):appState.mesActivo,
  };
  data.faseAtual=determinarFasePorFechas(data);

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
      mostrarToast(`${data.numeroChange} actualizada ✅`,'success');
    }
  } else {
    data.id=`CHG-${Date.now()}`; data.spId=Date.now();
    data.historialFases=[{de:'',a:data.faseAtual,fecha:new Date().toISOString().split('T')[0],usuario:appState.usuarioActual}];
    data.fechaCreacion=d1v||new Date().toISOString().split('T')[0];
    data.fechaCierre='';
    data.teamsLink=generarEnlaceTeams(data);
    registrarAudit(data.numeroChange, 'CREACIÓN', '(nueva)', `${data.pais} / ${data.producto} / ${data.horasEstimadas}h`);
    appState.changes.unshift(data);
    mostrarToast(`${data.numeroChange} creada ✅`,'success');
  }
  guardarDatos(true); fecharModal(); renderizarTodo();
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
  tr.innerHTML=`<td class="p-1.5"><select class="paso-fase-sel w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]">${opts}</select></td>
    <td class="p-1.5"><input type="text" class="paso-accion-inp w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" placeholder="Tarea..." value="${accion}"></td>
    <td class="p-1.5 text-center"><input type="number" class="paso-horas-inp w-14 py-1 px-1 border border-slate-200 rounded-lg text-[11px] text-center font-bold" min="0" step="0.5" value="${horas}" required oninput="recalcularHorasDesdePasos()"></td>
    <td class="p-1.5"><input type="date" class="paso-fecha-inp w-full py-1 px-1 border border-slate-200 rounded-lg text-[11px]" value="${fecha}" required></td>
    <td class="p-1.5 text-center"><button type="button" onclick="this.closest('tr').remove();recalcularHorasDesdePasos()" class="p-1 text-rose-500 hover:bg-rose-50 rounded text-[10px]"><i class="fa-solid fa-trash-can"></i></button></td>`;
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
  else { agregarFilaPaso('1. Análisis Técnico','Levantamiento',2,''); agregarFilaPaso('3. Desarrollo Backend','Implementación',8,''); agregarFilaPaso('6. Pruebas QA','Pruebas',4,''); }
}

// ============================================================
// EXCEL IMPORT / EXPORT
// ============================================================
let excelParsedRows=[];

function abrirModalUploadExcel() {
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
    descripcion:String(fv('descripcion','description','resumen')||'Sin descripción').trim(),
    engenheiro:String(fv('ingeniero','engineer','responsable')||'').trim(),
    horasEstimadas:hE, horasAprovadas:parseFloat(fv('horas aprov')||hE),
    tipoChange:clasificarChange(hE),
    faseAtual:normalizarFaseKey(String(fv('fase','status','estado')||'Abertura')),
    statusAprovacao:String(fv('aprobacion','aprovacao')||'Pendente'),
    analise:'',rollback:'',pasosImplementacion:[],aprovadorNome:'',aprovadorEmail:'',
    d1:new Date().toISOString().split('T')[0],d2:'',d3:'',d4:'',d5:'',d6:'',d7:'',d8:'',
    mesAno:appState.mesActivo, teamsLink:'',
    historialFases:[{de:'',a:'Abertura',fecha:new Date().toISOString().split('T')[0],usuario:'Importación'}],
    fechaCreacion:new Date().toISOString().split('T')[0],fechaCierre:'',
    ultimaModificacao:new Date().toISOString(),modificadoPor:'Importación Excel'
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
  if(!excelParsedRows.length) return;
  const modo=document.querySelector('input[name="modoImportacion"]:checked')?.value||'anexar';
  if(modo==='reemplazar') appState.changes=[...excelParsedRows];
  else appState.changes=[...appState.changes,...excelParsedRows];
  registrarAudit('IMPORTACIÓN','backlog','—',`${excelParsedRows.length} registros (${modo})`);
  guardarDatos(true); fecharModalUploadExcel(); renderizarTodo();
  mostrarToast(`${excelParsedRows.length} changes importadas ✅`,'success');
}

function descargarPlantillaExcel() {
  const h=[['Número Change','RITM','Solicitante','País','Business Service','Producto','Descripción','Ingeniero','Horas Estimadas','Horas Aprobadas','Fase Actual','Status Aprobación']];
  const ej=[['CHG0099100','RITM0155001','Andrés Delgado','Brasil','E-Commerce','Nescafé','Mejora checkout','Carlos Mendoza',15,15,'Abertura','Pendente']];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([...h,...ej]),'Plantilla');
  XLSX.writeFile(wb,'Plantilla_Changes.xlsx');
}

function exportarExcel() {
  const f=obtenerChangesFiltradas();
  const ws=[['Change','RITM','Solicitante','País','Business Service','Producto','Descripción','Ingeniero','Horas Est.','Horas Apr.','Tipo','Fase','Status','Abertura','Reunião','Análise','Comitê','Apresentação','Aprovação','Execução','Conclusão']];
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
  if(!confirm('¿Eliminar esta Change?')) return;
  const idx=appState.changes.findIndex(c=>String(c.id||c.spId)===String(id));
  if(idx!==-1){
    const ch=appState.changes[idx];
    registrarAudit(ch.numeroChange,'ELIMINACIÓN',ch.numeroChange,'(eliminada)');
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
  // Dropzone
  const dz=document.getElementById('uploadDropzone');
  if(dz){
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag-active');}));
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
  ['kanban','fases','dashboard','tabla','historial','config'].forEach(v=>{
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
