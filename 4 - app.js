/**
 * Portal de Gestión de Changes, Capacidad y Backlog
 * Nestlé / Global IT / Product Operations
 * 
 * Reglas de Negocio:
 * - Capacidad Mensual: 160h fijas
 * - Regla Fundamental: Máximo 30h por Change (<= 30h aceptable, > 30h fuera de alcance)
 * - Kanban Limpio con Drag & Drop interactivo
 * - Pasos estructurados por Fase con suma automática de horas
 * - Filtros por Solicitante, Business Service, Producto y Estado
 * - Sincronización Multi-Usuario y Exportación/Importación Excel
 */

// Constantes de Configuración
const FASES_ORDEN = [
    { key: 'Abertura', id: 1, label: '1. Abertura', dKey: 'd1', desc: 'Solicitud e ingreso' },
    { key: 'Reunião', id: 2, label: '2. Reunião', dKey: 'd2', desc: 'Alineación inicial' },
    { key: 'Análise', id: 3, label: '3. Análise', dKey: 'd3', desc: 'Factibilidad técnica' },
    { key: 'Comitê', id: 4, label: '4. Comitê', dKey: 'd4', desc: 'Evaluación de comité' },
    { key: 'Apresentação', id: 5, label: '5. Apresentação', dKey: 'd5', desc: 'Presentación de propuesta' },
    { key: 'Aprovação', id: 6, label: '6. Aprovação', dKey: 'd6', desc: 'Aprobación del PO' },
    { key: 'Execução', id: 7, label: '7. Execução', dKey: 'd7', desc: 'Desarrollo y pruebas' },
    { key: 'Concluída', id: 8, label: '8. Concluída', dKey: 'd8', desc: 'Despliegue y pase a prod' }
];

const OPCIONES_FASES_PASOS = [
    "1. Análisis Técnico & Requerimientos",
    "2. Diseño de Arquitectura / UI",
    "3. Desarrollo Backend / APIs",
    "4. Desarrollo Frontend",
    "5. Integración & Configuración",
    "6. Pruebas QA & Regresión",
    "7. Pruebas UAT / Negocio",
    "8. Despliegue & Pase a Producción",
    "9. Capacitación & Soporte"
];

const CAPACIDAD_MENSUAL_META = 160; // Horas mensuales
const LIMITE_MAX_HORAS = 30; // 30h es el límite máximo aceptable (<= 30h)

// Estado Global de la Aplicación
let appState = {
    changes: [],
    mesActivo: '',
    filtroTexto: '',
    filtroSolicitante: 'todos',
    filtroBusinessService: 'todos',
    filtroProducto: 'todos',
    filtroStatusAprov: 'todos',
    vistaActiva: 'kanban',
    usuarioActual: 'Usuario Colaborador',
    configSync: {
        sharepointSite: "https://nestle-my.sharepoint.com/personal/claudio_de_mx_nestle_com",
        listaNome: "Control_de_Changes",
        autoSync: true,
        intervaloSegundos: 15
    },
    historialCambios: []
};

// Instancias de Gráficos Chart.js
let charts = {
    gauge: null,
    distribucionProductos: null,
    fasesChart: null
};

// Variable Global para Drag & Drop
let currentDraggedId = null;
let isDraggingActive = false;

// Canal de Sincronización en Tiempo Real
let syncChannel = null;
if (typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel('nestle_changes_sync_bus');
    syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'SYNC_CHANGES') {
            console.log('📡 Sincronización en tiempo real recibida:', event.data.origen);
            cargarDesdeStorage(false);
            mostrarToast('Datos actualizados por otro usuario en tiempo real', 'info');
        }
    };
}

window.addEventListener('storage', (e) => {
    if (e.key === 'nestle_changes_data' && e.newValue) {
        cargarDesdeStorage(false);
    }
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarMesActual();
    cargarDatosIniciales();
    inicializarGraficos();
    configurarEventosUI();
    renderizarTodo();
    actualizarIndicadorSync('live');
});

// ==========================================
// GESTIÓN DE DATOS Y SINCRONIZACIÓN
// ==========================================

function inicializarMesActual() {
    const ahora = new Date();
    const ano = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    appState.mesActivo = `${ano}-${mes}`;
    
    const selectorMes = document.getElementById('selectorMes');
    if (selectorMes) {
        selectorMes.value = appState.mesActivo;
    }
}

function cargarDatosIniciales() {
    const guardado = localStorage.getItem('nestle_changes_data');
    const guardadoHistorial = localStorage.getItem('nestle_changes_history');
    
    if (guardado) {
        try {
            appState.changes = JSON.parse(guardado);
        } catch (e) {
            console.error('Error parseando localStorage:', e);
            appState.changes = [...initialChangesData];
        }
    } else if (typeof initialChangesData !== 'undefined' && initialChangesData.length > 0) {
        appState.changes = [...initialChangesData];
        guardarEnStorage(false);
    } else {
        appState.changes = [];
    }

    if (guardadoHistorial) {
        try {
            appState.historialCambios = JSON.parse(guardadoHistorial);
        } catch (e) {
            appState.historialCambios = [];
        }
    }
}

function guardarEnStorage(emitirSync = true) {
    actualizarIndicadorSync('syncing');
    localStorage.setItem('nestle_changes_data', JSON.stringify(appState.changes));
    localStorage.setItem('nestle_changes_history', JSON.stringify(appState.historialCambios));
    
    if (emitirSync && syncChannel) {
        syncChannel.postMessage({
            type: 'SYNC_CHANGES',
            timestamp: new Date().toISOString(),
            origen: appState.usuarioActual
        });
    }

    setTimeout(() => {
        actualizarIndicadorSync('live');
    }, 400);
}

function cargarDesdeStorage(reRender = true) {
    const guardado = localStorage.getItem('nestle_changes_data');
    if (guardado) {
        try {
            appState.changes = JSON.parse(guardado);
            if (reRender) renderizarTodo();
        } catch (e) {
            console.error(e);
        }
    }
}

function actualizarIndicadorSync(estado) {
    const el = document.getElementById('indicadorSync');
    if (!el) return;

    const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (estado === 'live') {
        el.className = 'status-pill-live px-2 py-0.2 rounded-full text-[10px] font-semibold flex items-center gap-1.5 shadow-sm';
        el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span><i class="fa-solid fa-wifi text-emerald-600"></i> En línea (${ahora})`;
    } else if (estado === 'syncing') {
        el.className = 'status-pill-syncing px-2 py-0.2 rounded-full text-[10px] font-semibold flex items-center gap-1.5 shadow-sm';
        el.innerHTML = `<i class="fa-solid fa-rotate fa-spin text-blue-600"></i> Guardando...`;
    } else {
        el.className = 'status-pill-offline px-2 py-0.2 rounded-full text-[10px] font-semibold flex items-center gap-1.5 shadow-sm';
        el.innerHTML = `<i class="fa-solid fa-circle-exclamation text-amber-600"></i> Local (${ahora})`;
    }
}

// ==========================================
// REGLA DE 30 HORAS (<= 30h ACEPTABLE)
// ==========================================

function calcularTipoChange(horasEstimadas) {
    const h = parseFloat(horasEstimadas) || 0;
    return h <= LIMITE_MAX_HORAS ? 'SMALL ENHANCEMENT' : 'EXCEDE 30H (PROYECTO)';
}

function calcularPorcentajeAvance(faseKey) {
    const faseIndex = FASES_ORDEN.findIndex(f => f.key === faseKey);
    if (faseIndex === -1) return 10;
    return Math.round(((faseIndex + 1) / FASES_ORDEN.length) * 100);
}

function obtenerChangesFiltradas() {
    return appState.changes.filter(ch => {
        if (appState.mesActivo) {
            const mesCh = ch.mesAno || (ch.d1 ? ch.d1.substring(0, 7) : '');
            if (mesCh && mesCh !== appState.mesActivo) return false;
        }

        if (appState.filtroTexto) {
            const q = appState.filtroTexto.toLowerCase();
            const coincide = 
                (ch.numeroChange && ch.numeroChange.toLowerCase().includes(q)) ||
                (ch.ritm && ch.ritm.toLowerCase().includes(q)) ||
                (ch.solicitante && ch.solicitante.toLowerCase().includes(q)) ||
                (ch.businessService && ch.businessService.toLowerCase().includes(q)) ||
                (ch.producto && ch.producto.toLowerCase().includes(q)) ||
                (ch.descripcion && ch.descripcion.toLowerCase().includes(q)) ||
                (ch.engenheiro && ch.engenheiro.toLowerCase().includes(q));
            if (!coincide) return false;
        }

        if (appState.filtroSolicitante !== 'todos' && ch.solicitante !== appState.filtroSolicitante) {
            return false;
        }

        if (appState.filtroBusinessService !== 'todos' && ch.businessService !== appState.filtroBusinessService) {
            return false;
        }

        if (appState.filtroProducto !== 'todos' && ch.producto !== appState.filtroProducto) {
            return false;
        }

        if (appState.filtroStatusAprov !== 'todos' && ch.statusAprovacao !== appState.filtroStatusAprov) {
            return false;
        }

        return true;
    });
}

// ==========================================
// RENDERIZADO PRINCIPAL DE LA INTERFAZ
// ==========================================

function renderizarTodo() {
    actualizarSelectoresFiltros();
    actualizarMetricasCapacidad();
    
    if (appState.vistaActiva === 'kanban') {
        renderizarKanban();
    } else if (appState.vistaActiva === 'fases') {
        renderizarMatrizFases();
    } else if (appState.vistaActiva === 'dashboard') {
        renderizarDashboardGraficos();
    } else if (appState.vistaActiva === 'tabla') {
        renderizarTablaBacklog();
    }
}

function actualizarSelectoresFiltros() {
    const selectSol = document.getElementById('filtroSolicitante');
    if (selectSol) {
        const solicitantesUnicos = Array.from(new Set(appState.changes.map(c => c.solicitante).filter(Boolean))).sort();
        const prevSol = selectSol.value;
        selectSol.innerHTML = '<option value="todos">Todos los Solicitantes</option>';
        solicitantesUnicos.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            selectSol.appendChild(opt);
        });
        if (solicitantesUnicos.includes(prevSol)) selectSol.value = prevSol;
    }

    const selectBs = document.getElementById('filtroBusinessService');
    if (selectBs) {
        const bsUnicos = Array.from(new Set(appState.changes.map(c => c.businessService).filter(Boolean))).sort();
        const prevBs = selectBs.value;
        selectBs.innerHTML = '<option value="todos">Todos los Services</option>';
        bsUnicos.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            selectBs.appendChild(opt);
        });
        if (bsUnicos.includes(prevBs)) selectBs.value = prevBs;
    }

    const selectProd = document.getElementById('filtroProducto');
    if (selectProd) {
        const productosUnicos = Array.from(new Set(appState.changes.map(c => c.producto).filter(Boolean))).sort();
        const prevProd = selectProd.value;
        selectProd.innerHTML = '<option value="todos">Todos los Productos</option>';
        productosUnicos.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            selectProd.appendChild(opt);
        });
        if (productosUnicos.includes(prevProd)) selectProd.value = prevProd;
    }
}

function actualizarMetricasCapacidad() {
    const filtradas = obtenerChangesFiltradas();
    
    let horasConsumidasTotal = 0;
    let smallCount = 0;
    let smallHoras = 0;
    const porProducto = {};

    filtradas.forEach(ch => {
        const h = parseFloat(ch.horasAprovadas || ch.horasEstimadas || 0);
        horasConsumidasTotal += h;
        smallCount++;
        smallHoras += h;

        if (ch.producto) {
            porProducto[ch.producto] = (porProducto[ch.producto] || 0) + h;
        }
    });

    const horasRestantes = Math.max(0, CAPACIDAD_MENSUAL_META - horasConsumidasTotal);
    const estaSobreCapacidad = horasConsumidasTotal > CAPACIDAD_MENSUAL_META;

    document.getElementById('txtHorasConsumidas').innerText = `${horasConsumidasTotal.toFixed(1)} h`;
    document.getElementById('txtHorasResta').innerText = `${horasRestantes.toFixed(1)} h`;
    document.getElementById('txtTotalChanges').innerText = `${filtradas.length}`;

    const containerAlerta = document.getElementById('alertaSobrecapacidad');
    if (containerAlerta) {
        if (estaSobreCapacidad) {
            containerAlerta.classList.remove('hidden');
            const exceso = (horasConsumidasTotal - CAPACIDAD_MENSUAL_META).toFixed(1);
            document.getElementById('txtExcesoHoras').innerText = `${exceso} h`;
        } else {
            containerAlerta.classList.add('hidden');
        }
    }

    if (charts.gauge) {
        const colorConsumo = estaSobreCapacidad ? '#ef4444' : '#2563eb';
        charts.gauge.data.datasets[0].backgroundColor = [colorConsumo, '#e2e8f0'];
        charts.gauge.data.datasets[0].data = [Math.min(horasConsumidasTotal, CAPACIDAD_MENSUAL_META), horasRestantes];
        charts.gauge.update();
    }

    document.getElementById('countSmall').innerText = `${smallCount} changes (${smallHoras} h aprobadas)`;

    const cProd = document.getElementById('containerProductos');
    if (cProd) {
        cProd.innerHTML = '';
        const productosKeys = Object.keys(porProducto);
        if (productosKeys.length === 0) {
            cProd.innerHTML = '<p class="text-xs text-slate-400 py-2 text-center">Sin consumo en este periodo.</p>';
        } else {
            productosKeys.sort((a, b) => porProducto[b] - porProducto[a]).forEach(p => {
                const h = porProducto[p];
                const pct = Math.min(100, Math.round((h / CAPACIDAD_MENSUAL_META) * 100));
                cProd.innerHTML += `
                    <div class="p-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                        <div class="flex justify-between text-[11px] font-semibold mb-1">
                            <span class="text-slate-700 truncate max-w-[150px]" title="${p}"><i class="fa-solid fa-cube text-slate-400 mr-1"></i>${p}</span>
                            <span class="text-slate-800 font-bold">${h.toFixed(1)} h <span class="text-[9px] text-slate-400 font-normal">(${pct}%)</span></span>
                        </div>
                        <div class="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                            <div class="bg-blue-600 h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            });
        }
    }
}

// =======================================================
// VISTA: TABLERO KANBAN CON DRAG & DROP ROBUSTO
// =======================================================

function renderizarKanban() {
    const filtradas = obtenerChangesFiltradas();
    
    // Limpiar columnas
    FASES_ORDEN.forEach(fase => {
        const colEl = document.getElementById(`col-${fase.key}`);
        if (colEl) colEl.innerHTML = '';
        const badgeEl = document.getElementById(`badge-${fase.key}`);
        if (badgeEl) badgeEl.innerText = '0';
    });

    const contadores = {};
    FASES_ORDEN.forEach(f => contadores[f.key] = 0);

    filtradas.forEach(ch => {
        let fase = ch.faseAtual || 'Abertura';
        if (!contadores.hasOwnProperty(fase)) fase = 'Abertura';
        contadores[fase]++;

        const h = ch.horasAprovadas || ch.horasEstimadas || 0;
        const excedeLimite = h > LIMITE_MAX_HORAS;
        const cardAccent = excedeLimite ? 'card-accent-excede' : 'card-accent-small';
        const badgeClass = excedeLimite ? 'badge-excede-limite' : 'badge-small-enhancement';
        const badgeTexto = excedeLimite ? `>30h (${h}h)` : `${h}h`;

        const changeIdStr = String(ch.id || ch.spId);

        // TARJETA COMPACTA, LIMPIA Y ARRASTRABLE
        const card = document.createElement('div');
        card.className = `kanban-card ${cardAccent}`;
        card.draggable = true;
        card.setAttribute('draggable', 'true');
        card.dataset.changeId = changeIdStr;

        const faseIdx = FASES_ORDEN.findIndex(f => f.key === fase);
        const puedeRetroceder = faseIdx > 0;
        const puedeAvanzar = faseIdx < FASES_ORDEN.length - 1;

        card.innerHTML = `
            <div class="flex items-center justify-between gap-1 mb-1 pointer-events-none">
                <span class="font-bold text-xs text-blue-700 font-mono tracking-tight">${ch.numeroChange || 'SIN CÓDIGO'}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${badgeClass}">
                    ${badgeTexto}
                </span>
            </div>

            <p class="text-[11px] font-medium text-slate-800 line-clamp-2 leading-snug mb-1.5 pointer-events-none" title="${ch.descripcion || ''}">
                ${ch.descripcion || 'Sin descripción detallada'}
            </p>

            <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                <span class="truncate max-w-[90px] text-slate-600 font-medium pointer-events-none" title="Solicitante: ${ch.solicitante || 'N/A'}">
                    <i class="fa-solid fa-user text-[9px] text-slate-400 mr-0.5"></i>${ch.solicitante || ch.producto || 'N/A'}
                </span>
                
                <div class="flex items-center gap-1">
                    ${puedeRetroceder ? `<button type="button" onclick="event.stopPropagation(); moverFaseRelativa('${changeIdStr}', -1)" class="w-4 h-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-[8px]" title="Mover a fase anterior"><i class="fa-solid fa-chevron-left"></i></button>` : ''}
                    <button type="button" onclick="event.stopPropagation(); abrirModalEdicion('${changeIdStr}')" class="text-blue-600 font-semibold hover:underline text-[10px]">
                        Ver
                    </button>
                    ${puedeAvanzar ? `<button type="button" onclick="event.stopPropagation(); moverFaseRelativa('${changeIdStr}', 1)" class="w-4 h-4 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center text-[8px]" title="Avanzar a siguiente fase"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
                </div>
            </div>
        `;

        // Eventos Drag nativos
        card.addEventListener('dragstart', (e) => {
            currentDraggedId = changeIdStr;
            isDraggingActive = true;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', changeIdStr);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            currentDraggedId = null;
            setTimeout(() => { isDraggingActive = false; }, 50);
            document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
        });

        // Click solo si no estábamos arrastrando
        card.addEventListener('click', (e) => {
            if (isDraggingActive) return;
            abrirModalEdicion(changeIdStr);
        });

        const colEl = document.getElementById(`col-${fase}`);
        if (colEl) colEl.appendChild(card);
    });

    FASES_ORDEN.forEach(fase => {
        const badgeEl = document.getElementById(`badge-${fase.key}`);
        if (badgeEl) badgeEl.innerText = contadores[fase.key] || 0;
    });

    configurarZonasKanban();
}

function configurarZonasKanban() {
    FASES_ORDEN.forEach(fase => {
        const colWrapper = document.getElementById(`kanban-col-${fase.key}`);
        if (!colWrapper) return;

        colWrapper.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            colWrapper.classList.add('drag-over');
        };

        colWrapper.ondragenter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            colWrapper.classList.add('drag-over');
        };

        colWrapper.ondragleave = (e) => {
            e.preventDefault();
            // Solo quitar si salimos del wrapper principal
            const rect = colWrapper.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
                colWrapper.classList.remove('drag-over');
            }
        };

        colWrapper.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            colWrapper.classList.remove('drag-over');

            const changeId = e.dataTransfer.getData('text/plain') || currentDraggedId;
            if (!changeId) return;

            moverChangeDeFase(changeId, fase.key);
        };
    });
}

function moverFaseRelativa(changeId, delta) {
    const ch = appState.changes.find(c => String(c.id || c.spId) === String(changeId));
    if (!ch) return;

    const faseActual = ch.faseAtual || 'Abertura';
    const currIdx = FASES_ORDEN.findIndex(f => f.key === faseActual);
    const newIdx = currIdx + delta;

    if (newIdx >= 0 && newIdx < FASES_ORDEN.length) {
        moverChangeDeFase(changeId, FASES_ORDEN[newIdx].key);
    }
}

function moverChangeDeFase(changeId, nuevaFase) {
    const ch = appState.changes.find(c => String(c.id || c.spId) === String(changeId));
    if (!ch) return;

    if (ch.faseAtual === nuevaFase) return;

    const faseAnterior = ch.faseAtual;
    ch.faseAtual = nuevaFase;
    ch.ultimaModificacao = new Date().toISOString();
    ch.modificadoPor = appState.usuarioActual;

    const faseObj = FASES_ORDEN.find(f => f.key === nuevaFase);
    if (faseObj && !ch[faseObj.dKey]) {
        ch[faseObj.dKey] = new Date().toISOString().split('T')[0];
    }

    registrarHistorial(`Fase cambiada de "${faseAnterior}" a "${nuevaFase}"`, ch.numeroChange);

    guardarEnStorage(true);
    renderizarTodo();
    mostrarToast(`Change ${ch.numeroChange} movida a "${nuevaFase}"`, 'success');
}

// ====================================================
// TABLA DINÁMICA DE PASOS DE IMPLEMENTACIÓN POR FASE
// ====================================================

function agregarFilaPaso(fase = '', accion = '', horas = 0, fechaTentativa = '') {
    const tbody = document.getElementById('tbodyPasosImplementacion');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";

    let selectFasesHtml = `<select class="paso-fase-sel">`;
    OPCIONES_FASES_PASOS.forEach(f => {
        const isSelected = f === fase || (fase && f.toLowerCase().includes(fase.toLowerCase()));
        selectFasesHtml += `<option value="${f}" ${isSelected ? 'selected' : ''}>${f}</option>`;
    });
    selectFasesHtml += `</select>`;

    tr.innerHTML = `
        <td class="p-1.5">${selectFasesHtml}</td>
        <td class="p-1.5">
            <input type="text" class="paso-accion-inp" placeholder="Describir acción técnica..." value="${accion}">
        </td>
        <td class="p-1.5 text-center">
            <input type="number" class="paso-horas-inp font-bold text-center" min="0" step="0.5" value="${horas}" oninput="recalcularHorasDesdePasos()">
        </td>
        <td class="p-1.5">
            <input type="date" class="paso-fecha-inp" value="${fechaTentativa}">
        </td>
        <td class="p-1.5 text-center">
            <button type="button" onclick="eliminarFilaPaso(this)" class="text-rose-500 hover:text-rose-700 text-xs p-1 rounded hover:bg-rose-50" title="Eliminar">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);
    recalcularHorasDesdePasos();
}

function eliminarFilaPaso(btn) {
    const row = btn.closest('tr');
    if (row) {
        row.remove();
        recalcularHorasDesdePasos();
    }
}

function recalcularHorasDesdePasos() {
    const inputsHoras = document.querySelectorAll('.paso-horas-inp');
    let totalHoras = 0;
    inputsHoras.forEach(inp => {
        totalHoras += parseFloat(inp.value || 0);
    });

    if (totalHoras > 0) {
        const inpEst = document.getElementById('inpHorasEst');
        if (inpEst) {
            inpEst.value = totalHoras;
            actualizarClassificacaoModal();
        }
    }
}

function obtenerPasosDesdeFormulario() {
    const filas = document.querySelectorAll('#tbodyPasosImplementacion tr');
    const pasos = [];

    filas.forEach(tr => {
        const fase = tr.querySelector('.paso-fase-sel')?.value || '';
        const accion = tr.querySelector('.paso-accion-inp')?.value || '';
        const horas = parseFloat(tr.querySelector('.paso-horas-inp')?.value || 0);
        const fechaTentativa = tr.querySelector('.paso-fecha-inp')?.value || '';

        if (accion || horas > 0) {
            pasos.push({ fase, accion, horas, fechaTentativa });
        }
    });

    return pasos;
}

function cargarPasosEnFormulario(pasos) {
    const tbody = document.getElementById('tbodyPasosImplementacion');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (Array.isArray(pasos) && pasos.length > 0) {
        pasos.forEach(p => {
            agregarFilaPaso(p.fase, p.accion, p.horas, p.fechaTentativa);
        });
    } else {
        agregarFilaPaso("1. Análisis Técnico & Requerimientos", "Levantamiento y factibilidad", 2, "");
        agregarFilaPaso("3. Desarrollo Backend / APIs", "Implementación del requerimiento", 8, "");
        agregarFilaPaso("6. Pruebas QA & Regresión", "Pruebas integrales", 4, "");
    }
}

// ==========================================
// VISTA: MATRIZ TABULAR DE FASES Y CHECKPOINTS
// ==========================================

function renderizarMatrizFases() {
    const tbody = document.getElementById('tbodyFases');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtradas = obtenerChangesFiltradas();

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-400">No se encontraron changes con los filtros aplicados.</td></tr>`;
        return;
    }

    filtradas.forEach(ch => {
        const h = ch.horasEstimadas || 0;
        const excede = h > LIMITE_MAX_HORAS;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";

        let fasesTdHtml = '';
        FASES_ORDEN.forEach(fase => {
            const fechaVal = ch[fase.dKey];
            const esFaseActual = ch.faseAtual === fase.key;
            
            let badgeIcon = '';
            if (fechaVal) {
                badgeIcon = `<div class="phase-checkpoint completed" title="Completado el ${fechaVal}"><i class="fa-solid fa-check"></i></div>`;
            } else if (esFaseActual) {
                badgeIcon = `<div class="phase-checkpoint current" title="Fase Actual"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
            } else {
                badgeIcon = `<div class="phase-checkpoint pending" title="Pendiente"><i class="fa-regular fa-circle"></i></div>`;
            }

            fasesTdHtml += `
                <td class="p-2 text-center">
                    <div class="flex flex-col items-center gap-0.5 cursor-pointer" onclick="toggleFechaFase('${ch.id || ch.spId}', '${fase.dKey}', '${fase.key}')">
                        ${badgeIcon}
                        <span class="text-[9px] text-slate-500 font-mono">${fechaVal ? fechaVal.substring(5) : '-'}</span>
                    </div>
                </td>
            `;
        });

        tr.innerHTML = `
            <td class="p-2.5">
                <div class="font-bold text-slate-800 flex items-center gap-1.5">
                    <a href="javascript:void(0)" onclick="abrirModalEdicion('${ch.id || ch.spId}')" class="text-blue-600 hover:underline font-mono">${ch.numeroChange}</a>
                    <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${excede ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                        ${h}h
                    </span>
                </div>
                <span class="text-[10px] text-slate-400">${ch.ritm || 'Sin RITM'}</span>
            </td>
            <td class="p-2.5 text-slate-700">
                <span class="font-semibold block text-slate-800 text-xs">${ch.solicitante || 'Sin solicitante'}</span>
                <span class="text-[10px] text-blue-600 font-medium">${ch.businessService || 'General'}</span>
            </td>
            <td class="p-2.5 text-slate-700">
                <span class="block truncate max-w-[130px] font-medium text-xs" title="${ch.producto}">${ch.producto || '-'}</span>
                <span class="text-[10px] text-slate-400">${ch.engenheiro || 'Sin asignar'}</span>
            </td>
            ${fasesTdHtml}
        `;
        tbody.appendChild(tr);
    });
}

function toggleFechaFase(changeId, dKey, faseKey) {
    const ch = appState.changes.find(c => String(c.id || c.spId) === String(changeId));
    if (!ch) return;

    if (ch[dKey]) {
        ch[dKey] = '';
    } else {
        ch[dKey] = new Date().toISOString().split('T')[0];
        ch.faseAtual = faseKey;
    }

    ch.ultimaModificacao = new Date().toISOString();
    ch.modificadoPor = appState.usuarioActual;

    guardarEnStorage(true);
    renderizarTodo();
    mostrarToast(`Actualizado checkpoint de ${faseKey} en ${ch.numeroChange}`, 'info');
}

// ==========================================
// VISTA: TABLA COMPLETA DE BACKLOG
// ==========================================

function renderizarTablaBacklog() {
    const tbody = document.getElementById('tbodyBacklog');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtradas = obtenerChangesFiltradas();

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">No hay registros para mostrar.</td></tr>`;
        return;
    }

    filtradas.forEach(ch => {
        const h = ch.horasEstimadas || 0;
        const excede = h > LIMITE_MAX_HORAS;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 text-xs";

        tr.innerHTML = `
            <td class="p-2.5 font-bold text-blue-700 font-mono">${ch.numeroChange}</td>
            <td class="p-2.5 font-medium text-slate-800">${ch.solicitante || '-'}</td>
            <td class="p-2.5 text-slate-600">${ch.businessService || '-'}</td>
            <td class="p-2.5 font-semibold text-slate-800">${ch.producto || '-'}</td>
            <td class="p-2.5 text-slate-600 max-w-xs truncate" title="${ch.descripcion}">${ch.descripcion || '-'}</td>
            <td class="p-2.5 text-center font-bold">${h} h</td>
            <td class="p-2.5 text-center font-bold text-blue-700">${ch.horasAprovadas || 0} h</td>
            <td class="p-2.5 text-center">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${excede ? 'bg-rose-100 text-rose-800' : 'badge-small-enhancement'}">
                    ${excede ? 'EXCEDE 30H' : 'SMALL (<=30h)'}
                </span>
            </td>
            <td class="p-2.5 text-center">
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">${ch.faseAtual || 'Abertura'}</span>
            </td>
            <td class="p-2.5 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="abrirModalEdicion('${ch.id || ch.spId}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="duplicarChange('${ch.id || ch.spId}')" class="p-1 text-slate-600 hover:bg-slate-100 rounded" title="Duplicar"><i class="fa-regular fa-copy"></i></button>
                    <button onclick="eliminarChange('${ch.id || ch.spId}')" class="p-1 text-rose-600 hover:bg-rose-100 rounded" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// VISTA: DASHBOARD Y ANALÍTICA (CHART.JS)
// ==========================================

function inicializarGraficos() {
    const ctxGauge = document.getElementById('gaugeCapacidade');
    if (ctxGauge) {
        charts.gauge = new Chart(ctxGauge.getContext('2d'), {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, CAPACIDAD_MENSUAL_META],
                    backgroundColor: ['#2563eb', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180,
                cutout: '75%',
                plugins: {
                    tooltip: { enabled: false }
                }
            }
        });
    }
}

function renderizarDashboardGraficos() {
    const filtradas = obtenerChangesFiltradas();

    const ctxProd = document.getElementById('chartProductosDashboard');
    if (ctxProd) {
        const porProd = {};
        filtradas.forEach(c => {
            const p = c.producto || 'Sin asignar';
            porProd[p] = (porProd[p] || 0) + parseFloat(c.horasAprovadas || c.horasEstimadas || 0);
        });

        if (charts.distribucionProductos) charts.distribucionProductos.destroy();
        charts.distribucionProductos = new Chart(ctxProd.getContext('2d'), {
            type: 'bar',
            data: {
                labels: Object.keys(porProd),
                datasets: [{
                    label: 'Horas Aprobadas',
                    data: Object.values(porProd),
                    backgroundColor: '#3b82f6',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    const ctxFases = document.getElementById('chartFasesDashboard');
    if (ctxFases) {
        const porFase = {};
        FASES_ORDEN.forEach(f => porFase[f.label] = 0);
        filtradas.forEach(c => {
            const fMatch = FASES_ORDEN.find(f => f.key === c.faseAtual);
            const l = fMatch ? fMatch.label : '1. Abertura';
            porFase[l] = (porFase[l] || 0) + 1;
        });

        if (charts.fasesChart) charts.fasesChart.destroy();
        charts.fasesChart = new Chart(ctxFases.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(porFase),
                datasets: [{
                    data: Object.values(porFase),
                    backgroundColor: [
                        '#94a3b8', '#64748b', '#0284c7', '#f59e0b',
                        '#8b5cf6', '#10b981', '#2563eb', '#059669'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }
}

// ==========================================
// IMPORTACIÓN / CARGA MASIVA DE EXCEL (UPLOAD)
// ==========================================

let excelParsedData = [];

function abrirModalUploadExcel() {
    excelParsedData = [];
    document.getElementById('inputExcelFile').value = '';
    document.getElementById('previewUploadContainer').classList.add('hidden');
    document.getElementById('btnConfirmarImportacion').disabled = true;
    document.getElementById('modalUploadExcel').classList.remove('hidden');
}

function fecharModalUploadExcel() {
    document.getElementById('modalUploadExcel').classList.add('hidden');
}

function handleExcelFileSelect(event) {
    const file = event.target.files[0];
    if (file) procesarArchivoExcel(file);
}

function procesarArchivoExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!rawJson || rawJson.length === 0) {
                mostrarToast('El archivo Excel está vacío.', 'error');
                return;
            }

            excelParsedData = rawJson.map((row, idx) => mapearFilaExcel(row, idx));
            mostrarPreviewExcel(excelParsedData);
        } catch (err) {
            console.error(err);
            mostrarToast('Error al leer Excel: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function mapearFilaExcel(row, idx) {
    const findVal = (claves) => {
        for (let k of Object.keys(row)) {
            const norm = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            for (let c of claves) {
                if (norm === c || norm.includes(c)) return row[k];
            }
        }
        return '';
    };

    const numChange = findVal(['change', 'numero', 'chg', 'codigo', 'title']) || `CHG-IMP-${String(idx + 1).padStart(3, '0')}`;
    const ritm = findVal(['ritm', 'requerimiento', 'ticket', 'req']) || '';
    const solicitante = findVal(['solicitante', 'requester', 'usuario', 'solicitado por']) || 'Sin solicitante';
    const businessService = findVal(['business service', 'servicio', 'area', 'servicio de negocio']) || 'General';
    const producto = findVal(['producto', 'product', 'linha', 'linea', 'sistema']) || 'General';
    const descripcion = findVal(['descripcion', 'descricao', 'description', 'titulo', 'resumen', 'detalle']) || 'Sin descripción';
    const engenheiro = findVal(['engenheiro', 'ingeniero', 'engineer', 'responsable', 'dev']) || '';
    
    let horasEst = parseFloat(findVal(['horas estimadas', 'estimadas', 'horas est', 'est horas', 'horas']) || 0);
    let horasApr = parseFloat(findVal(['horas aprovadas', 'aprovadas', 'horas apr', 'apr horas']) || horasEst);

    const tipo = calcularTipoChange(horasEst);
    const fase = findVal(['fase', 'status', 'estado', 'etapa']) || 'Abertura';
    const statusAprov = findVal(['aprobacion', 'status aprovacao', 'aprovacao']) || 'Pendente';

    return {
        id: `CHG-${Date.now()}-${idx}`,
        spId: Date.now() + idx,
        numeroChange: String(numChange).trim(),
        ritm: String(ritm).trim(),
        solicitante: String(solicitante).trim(),
        businessService: String(businessService).trim(),
        producto: String(producto).trim(),
        descripcion: String(descripcion).trim(),
        engenheiro: String(engenheiro).trim(),
        horasEstimadas: horasEst,
        horasAprovadas: horasApr,
        tipoChange: tipo,
        faseAtual: normalizarNombreFase(fase),
        statusAprovacao: statusAprov,
        analise: findVal(['analisis', 'analise']) || '',
        pasosImplementacion: [],
        oQueFazer: findVal(['etapas', 'tareas']) || '',
        rollback: findVal(['rollback']) || '',
        aprovadorNome: findVal(['aprobador', 'aprovador', 'po']) || '',
        aprovadorEmail: findVal(['email', 'correo']) || '',
        d1: findVal(['d1', 'abertura', 'fecha apertura', 'fecha inicio']) || new Date().toISOString().split('T')[0],
        d2: findVal(['d2', 'reuniao']) || '',
        d3: findVal(['d3', 'analise']) || '',
        d4: findVal(['d4', 'comite']) || '',
        d5: findVal(['d5', 'apresentacao']) || '',
        d6: findVal(['d6', 'aprovacao']) || '',
        d7: findVal(['d7', 'execucao']) || '',
        d8: findVal(['d8', 'conclusao', 'concluida']) || '',
        ultimaModificacao: new Date().toISOString(),
        modificadoPor: appState.usuarioActual
    };
}

function normalizarNombreFase(nombre) {
    if (!nombre) return 'Abertura';
    const n = nombre.toLowerCase();
    if (n.includes('conclu') || n.includes('final') || n.includes('termin')) return 'Concluída';
    if (n.includes('exec') || n.includes('desa') || n.includes('prog')) return 'Execução';
    if (n.includes('aprov') || n.includes('po')) return 'Aprovação';
    if (n.includes('apresent') || n.includes('pres')) return 'Apresentação';
    if (n.includes('comit')) return 'Comitê';
    if (n.includes('anal')) return 'Análise';
    if (n.includes('reun')) return 'Reunião';
    return 'Abertura';
}

function mostrarPreviewExcel(items) {
    const previewContainer = document.getElementById('previewUploadContainer');
    const tbody = document.getElementById('tbodyPreviewExcel');
    tbody.innerHTML = '';

    items.forEach((item, i) => {
        if (i < 8) {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 text-xs";
            tr.innerHTML = `
                <td class="p-1.5 font-bold text-slate-800">${item.numeroChange}</td>
                <td class="p-1.5">${item.solicitante}</td>
                <td class="p-1.5">${item.producto}</td>
                <td class="p-1.5 font-bold text-center">${item.horasEstimadas} h</td>
                <td class="p-1.5 text-center">${item.faseAtual}</td>
            `;
            tbody.appendChild(tr);
        }
    });

    document.getElementById('txtTotalImportar').innerText = `${items.length} items detectados`;
    document.getElementById('txtResumenImportar').innerText = `(Todos se validan bajo la regla de <= 30h)`;

    previewContainer.classList.remove('hidden');
    document.getElementById('btnConfirmarImportacion').disabled = false;
}

function ejecutarImportacionExcel() {
    if (excelParsedData.length === 0) return;

    const modo = document.querySelector('input[name="modoImportacion"]:checked').value;

    if (modo === 'reemplazar') {
        appState.changes = [...excelParsedData];
        registrarHistorial(`Reemplazo total del backlog con ${excelParsedData.length} items`);
    } else {
        appState.changes = [...appState.changes, ...excelParsedData];
        registrarHistorial(`Importación de ${excelParsedData.length} items anexados`);
    }

    guardarEnStorage(true);
    fecharModalUploadExcel();
    renderizarTodo();
    mostrarToast(`✅ ${excelParsedData.length} changes importadas con éxito!`, 'success');
}

function descargarPlantillaExcel() {
    const plantillaHeaders = [
        ["Número Change", "RITM", "Solicitante", "Business Service", "Producto", "Descripción", "Ingeniero", "Horas Estimadas", "Horas Aprobadas", "Fase Actual", "Status Aprobación", "Aprobador", "Fecha Apertura"],
        ["CHG0099100", "RITM0155001", "Andrés Delgado", "E-Commerce & Sales", "Nescafé", "Mejora en cálculo de descuentos", "Carlos Mendoza", 15, 15, "Abertura", "Pendente", "Mariana Silva", "2026-08-14"],
        ["CHG0099101", "RITM0155002", "Camila Restrepo", "Customer Experience", "Purina", "Alertas de stock automático", "Lucía Fernández", 28, 28, "Análise", "Pendente", "Roberto Gómez", "2026-08-14"]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(plantillaHeaders);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Backlog");
    XLSX.writeFile(wb, "Plantilla_Control_de_Changes_Nestle.xlsx");
}

// ==========================================
// EXPORTACIÓN A EXCEL (.XLSX)
// ==========================================

function exportarExcel() {
    const filtradas = obtenerChangesFiltradas();
    
    const wsData = [
        [
            "ID Change", "RITM", "Solicitante", "Business Service", "Producto / Línea", "Descripción", "Ingeniero",
            "Horas Estimadas", "Horas Aprobadas", "Clasificación (<=30h)", "Fase Actual",
            "Avance %", "Status Aprobación", "Aprobador", "1. Abertura", "2. Reunión",
            "3. Análisis", "4. Comité", "5. Presentación", "6. Aprobación", "7. Ejecución",
            "8. Conclusión", "Última Modificación", "Modificado Por"
        ]
    ];

    filtradas.forEach(c => {
        wsData.push([
            c.numeroChange,
            c.ritm,
            c.solicitante || '',
            c.businessService || '',
            c.producto,
            c.descripcion,
            c.engenheiro,
            c.horasEstimadas,
            c.horasAprovadas,
            c.tipoChange,
            c.faseAtual,
            `${calcularPorcentajeAvance(c.faseAtual)}%`,
            c.statusAprovacao,
            c.aprovadorNome,
            c.d1 || '',
            c.d2 || '',
            c.d3 || '',
            c.d4 || '',
            c.d5 || '',
            c.d6 || '',
            c.d7 || '',
            c.d8 || '',
            c.ultimaModificacao || '',
            c.modificadoPor || ''
        ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!cols'] = [
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 40 }, { wch: 18 },
        { wch: 15 }, { wch: 15 }, { wch: 24 }, { wch: 15 }, { wch: 10 },
        { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 22 }, { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Changes_Control");
    
    const mesNom = appState.mesActivo || 'General';
    XLSX.writeFile(wb, `Reporte_Changes_Capacidad_${mesNom}.xlsx`);
    mostrarToast('📊 Reporte Excel generado y descargado', 'success');
}

// ==========================================
// MODAL DE CREACIÓN / EDICIÓN DE CHANGE
// ==========================================

function abrirModalNuevaChange() {
    document.getElementById('modalTitulo').innerText = "Nueva Solicitud de Change";
    document.getElementById('formChange').reset();
    document.getElementById('spItemId').value = "";
    document.getElementById('d1').value = new Date().toISOString().split('T')[0];
    
    cargarPasosEnFormulario([]);
    actualizarClassificacaoModal();
    document.getElementById('modalChange').classList.remove('hidden');
}

function abrirModalEdicion(idOrSpId) {
    const ch = appState.changes.find(c => String(c.id || c.spId) === String(idOrSpId));
    if (!ch) return;

    document.getElementById('modalTitulo').innerText = `Editar Change: ${ch.numeroChange}`;
    document.getElementById('spItemId').value = ch.id || ch.spId;
    
    document.getElementById('inpChange').value = ch.numeroChange || '';
    document.getElementById('inpRitm').value = ch.ritm || '';
    document.getElementById('inpSolicitante').value = ch.solicitante || '';
    document.getElementById('inpBusinessService').value = ch.businessService || '';
    document.getElementById('inpProduto').value = ch.producto || '';
    document.getElementById('inpDescricao').value = ch.descripcion || '';
    
    document.getElementById('inpEngenheiro').value = ch.engenheiro || '';
    document.getElementById('inpHorasEst').value = ch.horasEstimadas || 0;
    document.getElementById('inpHorasApr').value = ch.horasAprovadas || 0;
    
    document.getElementById('inpAnalise').value = ch.analise || '';
    document.getElementById('inpRollback').value = ch.rollback || '';
    
    document.getElementById('inpAprovadorNome').value = ch.aprovadorNome || '';
    document.getElementById('inpAprovadorEmail').value = ch.aprovadorEmail || '';
    document.getElementById('inpStatusAprov').value = ch.statusAprovacao || 'Pendente';
    
    document.getElementById('d1').value = ch.d1 || '';
    document.getElementById('d2').value = ch.d2 || '';
    document.getElementById('d3').value = ch.d3 || '';
    document.getElementById('d4').value = ch.d4 || '';
    document.getElementById('d5').value = ch.d5 || '';
    document.getElementById('d6').value = ch.d6 || '';
    document.getElementById('d7').value = ch.d7 || '';
    document.getElementById('d8').value = ch.d8 || '';

    cargarPasosEnFormulario(ch.pasosImplementacion || []);

    actualizarClassificacaoModal();
    document.getElementById('modalChange').classList.remove('hidden');
}

function fecharModal() {
    document.getElementById('modalChange').classList.add('hidden');
}

function actualizarClassificacaoModal() {
    const h = parseFloat(document.getElementById('inpHorasEst').value || 0);
    const badge = document.getElementById('badgeClassificacaoModal');

    if (h <= LIMITE_MAX_HORAS) {
        badge.innerText = `SMALL ENHANCEMENT (<= 30h - VÁLIDO)`;
        badge.className = "inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300";
    } else {
        badge.innerText = `⚠️ EXCEDE LÍMITE (${h}h > 30h - FUERA DE ALCANCE)`;
        badge.className = "inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300";
    }
}

function salvarFormularioChange(event) {
    event.preventDefault();

    const id = document.getElementById('spItemId').value;
    const isUpdate = id !== '';
    const horasEst = parseFloat(document.getElementById('inpHorasEst').value || 0);
    const horasApr = parseFloat(document.getElementById('inpHorasApr').value || 0);
    const tipo = calcularTipoChange(horasEst);
    const pasos = obtenerPasosDesdeFormulario();

    const changeData = {
        numeroChange: document.getElementById('inpChange').value.trim(),
        ritm: document.getElementById('inpRitm').value.trim(),
        solicitante: document.getElementById('inpSolicitante').value.trim() || 'Sin solicitante',
        businessService: document.getElementById('inpBusinessService').value.trim() || 'General',
        producto: document.getElementById('inpProduto').value.trim() || 'General',
        descripcion: document.getElementById('inpDescricao').value.trim(),
        engenheiro: document.getElementById('inpEngenheiro').value.trim(),
        horasEstimadas: horasEst,
        horasAprovadas: horasApr,
        tipoChange: tipo,
        pasosImplementacion: pasos,
        analise: document.getElementById('inpAnalise').value.trim(),
        rollback: document.getElementById('inpRollback').value.trim(),
        aprovadorNome: document.getElementById('inpAprovadorNome').value.trim(),
        aprovadorEmail: document.getElementById('inpAprovadorEmail').value.trim(),
        statusAprovacao: document.getElementById('inpStatusAprov').value,
        d1: document.getElementById('d1').value || '',
        d2: document.getElementById('d2').value || '',
        d3: document.getElementById('d3').value || '',
        d4: document.getElementById('d4').value || '',
        d5: document.getElementById('d5').value || '',
        d6: document.getElementById('d6').value || '',
        d7: document.getElementById('d7').value || '',
        d8: document.getElementById('d8').value || '',
        ultimaModificacao: new Date().toISOString(),
        modificadoPor: appState.usuarioActual
    };

    changeData.faseAtual = determinarFasePorFechas(changeData);
    changeData.mesAno = changeData.d1 ? changeData.d1.substring(0, 7) : appState.mesActivo;

    if (isUpdate) {
        const index = appState.changes.findIndex(c => String(c.id || c.spId) === String(id));
        if (index !== -1) {
            appState.changes[index] = { ...appState.changes[index], ...changeData };
            registrarHistorial(`Change ${changeData.numeroChange} editada`);
        }
    } else {
        changeData.id = `CHG-${Date.now()}`;
        changeData.spId = Date.now();
        appState.changes.unshift(changeData);
        registrarHistorial(`Nueva Change: ${changeData.numeroChange}`);
    }

    guardarEnStorage(true);
    fecharModal();
    renderizarTodo();
    mostrarToast(`✅ Change ${changeData.numeroChange} guardada correctamente!`, 'success');
}

function determinarFasePorFechas(data) {
    if (data.d8) return 'Concluída';
    if (data.d7) return 'Execução';
    if (data.d6) return 'Aprovação';
    if (data.d5) return 'Apresentação';
    if (data.d4) return 'Comitê';
    if (data.d3) return 'Análise';
    if (data.d2) return 'Reunião';
    return 'Abertura';
}

function duplicarChange(id) {
    const ch = appState.changes.find(c => String(c.id || c.spId) === String(id));
    if (!ch) return;

    const copia = JSON.parse(JSON.stringify(ch));
    copia.id = `CHG-${Date.now()}`;
    copia.spId = Date.now();
    copia.numeroChange = `${ch.numeroChange}-COPY`;
    copia.faseAtual = 'Abertura';
    copia.d1 = new Date().toISOString().split('T')[0];
    copia.d2 = ''; copia.d3 = ''; copia.d4 = ''; copia.d5 = ''; copia.d6 = ''; copia.d7 = ''; copia.d8 = '';
    copia.ultimaModificacao = new Date().toISOString();
    copia.modificadoPor = appState.usuarioActual;

    appState.changes.unshift(copia);
    guardarEnStorage(true);
    renderizarTodo();
    mostrarToast(`Copia creada: ${copia.numeroChange}`, 'success');
}

function eliminarChange(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta Change?')) return;

    const index = appState.changes.findIndex(c => String(c.id || c.spId) === String(id));
    if (index !== -1) {
        const num = appState.changes[index].numeroChange;
        appState.changes.splice(index, 1);
        registrarHistorial(`Change ${num} eliminada`);
        guardarEnStorage(true);
        renderizarTodo();
        mostrarToast(`Change eliminada con éxito`, 'warning');
    }
}

// ==========================================
// CONECTOR SHAREPOINT REST API
// ==========================================

async function sincronizarConSharePoint() {
    const siteUrl = appState.configSync.sharepointSite;
    const listName = appState.configSync.listaNome;

    mostrarToast('Iniciando sincronización con SharePoint...', 'info');
    actualizarIndicadorSync('syncing');

    try {
        const url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items?$top=1000`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json;odata=verbose' }
        });

        if (!response.ok) {
            throw new Error(`SharePoint HTTP Status ${response.status}`);
        }

        const data = await response.json();
        const items = data.d ? data.d.results : (data.value || []);

        if (items && items.length > 0) {
            const spMapped = items.map(item => ({
                spId: item.ID,
                id: `SP-${item.ID}`,
                numeroChange: item.Title || '',
                ritm: item.RITM || '',
                solicitante: item.Solicitante || 'Sin solicitante',
                businessService: item.BusinessService || 'General',
                descripcion: item.Descricao || '',
                producto: item.Produto || 'General',
                engenheiro: item.Engenheiro || '',
                horasEstimadas: parseFloat(item.HorasEstimadas || 0),
                horasAprovadas: parseFloat(item.HorasAprovadas || 0),
                tipoChange: item.TipoChange || calcularTipoChange(item.HorasEstimadas),
                faseAtual: item.FaseAtual || 'Abertura',
                analise: item.AnaliseTecnica || '',
                pasosImplementacion: [],
                oQueFazer: item.OQueFazer || '',
                rollback: item.PlanoRollback || '',
                aprovadorNome: item.AprovadorNome || '',
                aprovadorEmail: item.AprovadorEmail || '',
                statusAprovacao: item.StatusAprovacao || 'Pendente',
                d1: formatarDataInput(item.DataAbertura),
                d2: formatarDataInput(item.DataReuniao),
                d3: formatarDataInput(item.DataAnalise),
                d4: formatarDataInput(item.DataComite),
                d5: formatarDataInput(item.DataApresentacao),
                d6: formatarDataInput(item.DataAprovisao),
                d7: formatarDataInput(item.DataExecucao),
                d8: formatarDataInput(item.DataConclusao),
                ultimaModificacao: new Date().toISOString(),
                modificadoPor: 'SharePoint Sync'
            }));

            appState.changes = spMapped;
            guardarEnStorage(true);
            renderizarTodo();
            mostrarToast(`✅ Sincronizados ${spMapped.length} registros desde SharePoint`, 'success');
        } else {
            mostrarToast('Conexión exitosa. Lista de SharePoint vacía.', 'info');
        }
    } catch (err) {
        console.warn('SharePoint sync:', err.message);
        mostrarToast('Modo Offline/Local sincronizado. Para SharePoint directo valida tu sesión corporativa.', 'warning');
    } finally {
        actualizarIndicadorSync('live');
    }
}

function formatarDataInput(dtStr) {
    if (!dtStr) return '';
    return dtStr.split('T')[0];
}

// ==========================================
// CONFIGURACIÓN DE EVENTOS DE INTERFAZ
// ==========================================

function configurarEventosUI() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const vista = this.dataset.view;
            cambiarVista(vista);
        });
    });

    const inpBuscar = document.getElementById('inpBuscar');
    if (inpBuscar) {
        inpBuscar.addEventListener('input', (e) => {
            appState.filtroTexto = e.target.value;
            renderizarTodo();
        });
    }

    const selSol = document.getElementById('filtroSolicitante');
    if (selSol) {
        selSol.addEventListener('change', (e) => {
            appState.filtroSolicitante = e.target.value;
            renderizarTodo();
        });
    }

    const selBs = document.getElementById('filtroBusinessService');
    if (selBs) {
        selBs.addEventListener('change', (e) => {
            appState.filtroBusinessService = e.target.value;
            renderizarTodo();
        });
    }

    const selProd = document.getElementById('filtroProducto');
    if (selProd) {
        selProd.addEventListener('change', (e) => {
            appState.filtroProducto = e.target.value;
            renderizarTodo();
        });
    }

    const selStatus = document.getElementById('filtroStatus');
    if (selStatus) {
        selStatus.addEventListener('change', (e) => {
            appState.filtroStatusAprov = e.target.value;
            renderizarTodo();
        });
    }

    const selMes = document.getElementById('selectorMes');
    if (selMes) {
        selMes.addEventListener('change', (e) => {
            appState.mesActivo = e.target.value;
            renderizarTodo();
        });
    }

    const dropzone = document.getElementById('uploadDropzone');
    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('drag-active');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) procesarArchivoExcel(files[0]);
        }, false);
    }
}

function cambiarVista(vista) {
    appState.vistaActiva = vista;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.view === vista) {
            btn.className = "tab-btn py-1.5 px-3 font-bold text-xs text-blue-600 border-b-2 border-blue-600 flex items-center gap-1.5 transition-all whitespace-nowrap";
        } else {
            btn.className = "tab-btn py-1.5 px-3 font-semibold text-xs text-slate-500 hover:text-slate-700 border-b-2 border-transparent flex items-center gap-1.5 transition-all whitespace-nowrap";
        }
    });

    document.getElementById('secaoKanban').classList.toggle('hidden', vista !== 'kanban');
    document.getElementById('secaoFases').classList.toggle('hidden', vista !== 'fases');
    document.getElementById('secaoDashboard').classList.toggle('hidden', vista !== 'dashboard');
    document.getElementById('secaoTabla').classList.toggle('hidden', vista !== 'tabla');

    renderizarTodo();
}

function registrarHistorial(accion, chNum = '') {
    appState.historialCambios.unshift({
        fecha: new Date().toISOString(),
        usuario: appState.usuarioActual,
        accion: accion,
        change: chNum
    });
    if (appState.historialCambios.length > 50) appState.historialCambios.pop();
}

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    let icono = 'fa-info-circle text-blue-500';
    if (tipo === 'success') icono = 'fa-check-circle text-emerald-500';
    if (tipo === 'warning') icono = 'fa-triangle-exclamation text-amber-500';
    if (tipo === 'error') icono = 'fa-circle-xmark text-rose-500';

    toast.innerHTML = `<i class="fa-solid ${icono} text-base"></i><span>${mensaje}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
