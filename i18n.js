/**
 * i18n.js — Sistema Centralizado de Internacionalización (Multidioma)
 * Idiomas soportados: Español (ES), Português (PT), English (EN)
 */

const I18N_IDIOMAS = {
  es: { nombre: 'Español', flag: '🇪🇸', code: 'es' },
  pt: { nombre: 'Português', flag: '🇧🇷', code: 'pt' },
  en: { nombre: 'English', flag: '🇺🇸', code: 'en' },
};

const DICCIONARIO = {
  // Autenticación / Login
  'login.titulo': {
    es: 'Portal de Gestión de Changes',
    pt: 'Portal de Gestão de Changes',
    en: 'Change Management Portal'
  },
  'login.subtitulo': {
    es: 'Inicia sesión para acceder al sistema de gestión y capacidad',
    pt: 'Faça login para acessar o sistema de gestão e capacidade',
    en: 'Sign in to access change and capacity management'
  },
  'login.usuario': {
    es: 'Usuario o Correo Electrónico',
    pt: 'Usuário ou E-mail',
    en: 'Username or Email'
  },
  'login.usuario_placeholder': {
    es: 'usuario@nestle.com o nombre de usuario',
    pt: 'usuario@nestle.com ou nome de usuário',
    en: 'user@nestle.com or username'
  },
  'login.password': {
    es: 'Contraseña',
    pt: 'Senha',
    en: 'Password'
  },
  'login.password_placeholder': {
    es: '••••••••',
    pt: '••••••••',
    en: '••••••••'
  },
  'login.boton_entrar': {
    es: 'Iniciar Sesión',
    pt: 'Entrar no Sistema',
    en: 'Sign In'
  },
  'login.olvido_password': {
    es: '¿Olvidaste tu contraseña?',
    pt: 'Esqueceu sua senha?',
    en: 'Forgot your password?'
  },
  'login.error_credenciales': {
    es: 'Usuario o contraseña incorrectos. Por favor verifica tus datos.',
    pt: 'Usuário ou senha incorretos. Por favor verifique seus dados.',
    en: 'Invalid username or password. Please verify your credentials.'
  },
  'login.error_inactivo': {
    es: 'Tu cuenta está inactiva. Contacta al Administrador.',
    pt: 'Sua conta está inativa. Entre em contato com o Administrador.',
    en: 'Your account is inactive. Please contact an Administrator.'
  },
  'login.demo_credentials': {
    es: 'Credenciales de demostración rápida:',
    pt: 'Credenciais de demonstração rápida:',
    en: 'Quick demo credentials:'
  },
  'login.primer_acceso_titulo': {
    es: 'Cambio Obligatorio de Contraseña',
    pt: 'Troca Obrigatória de Senha',
    en: 'Mandatory Password Change'
  },
  'login.primer_acceso_subtitulo': {
    es: 'Por seguridad institucional, debes actualizar tu contraseña temporal antes de continuar.',
    pt: 'Por segurança institucional, você deve atualizar sua senha temporária antes de continuar.',
    en: 'For institutional security, please update your temporary password before proceeding.'
  },
  'login.pass_actual': {
    es: 'Contraseña Actual / Temporal',
    pt: 'Senha Atual / Temporária',
    en: 'Current / Temporary Password'
  },
  'login.pass_nueva': {
    es: 'Nueva Contraseña',
    pt: 'Nova Senha',
    en: 'New Password'
  },
  'login.pass_confirmar': {
    es: 'Confirmar Nueva Contraseña',
    pt: 'Confirmar Nova Senha',
    en: 'Confirm New Password'
  },
  'login.pass_requisitos': {
    es: 'Mínimo 8 caracteres, al menos 1 número y 1 letra mayúscula.',
    pt: 'Mínimo 8 caracteres, pelo menos 1 número e 1 letra maiúscula.',
    en: 'Minimum 8 characters, at least 1 number and 1 uppercase letter.'
  },
  'login.btn_guardar_pass': {
    es: 'Actualizar Contraseña e Ingresar',
    pt: 'Atualizar Senha e Entrar',
    en: 'Update Password & Enter'
  },
  'login.logout_confirm_titulo': {
    es: '¿Desea realmente cerrar sesión?',
    pt: 'Deseja realmente sair do sistema?',
    en: 'Do you really want to sign out?'
  },
  'login.logout_confirm_desc': {
    es: 'Se cerrará tu sesión activa y tendrás que volver a autenticarte.',
    pt: 'Sua sessão ativa será encerrada e você precisará se autenticar novamente.',
    en: 'Your active session will be ended and you will need to sign in again.'
  },
  'login.btn_cancelar': {
    es: 'Cancelar',
    pt: 'Cancelar',
    en: 'Cancel'
  },
  'login.btn_cerrar_sesion': {
    es: 'Cerrar Sesión',
    pt: 'Sair da Conta',
    en: 'Sign Out'
  },

  // Header y Menú
  'header.portal_titulo': {
    es: 'Portal Gestión de Changes',
    pt: 'Portal Gestão de Changes',
    en: 'Change Management Portal'
  },
  'header.subtitulo': {
    es: 'Regla global: máx. 30h por Change • Control de Roles Activo',
    pt: 'Regra global: máx. 30h por Change • Controle de Perfis Ativo',
    en: 'Global rule: max 30h per Change • Active Role Controls'
  },
  'header.periodo': {
    es: 'Periodo:',
    pt: 'Período:',
    en: 'Period:'
  },
  'header.sync': {
    es: 'Sincronizar',
    pt: 'Sincronizar',
    en: 'Sync'
  },
  'header.excel': {
    es: 'Cargar Excel',
    pt: 'Importar Excel',
    en: 'Upload Excel'
  },
  'header.exportar': {
    es: 'Exportar',
    pt: 'Exportar',
    en: 'Export'
  },
  'header.nueva_change': {
    es: '+ Change',
    pt: '+ Change',
    en: '+ Change'
  },
  'header.online': {
    es: 'En línea',
    pt: 'Online',
    en: 'Online'
  },
  'header.mi_perfil': {
    es: 'Mi Perfil',
    pt: 'Meu Perfil',
    en: 'My Profile'
  },
  'header.cambiar_pass': {
    es: 'Cambiar Contraseña',
    pt: 'Alterar Senha',
    en: 'Change Password'
  },

  // Tabs de navegación
  'nav.kanban': {
    es: 'Kanban',
    pt: 'Kanban',
    en: 'Kanban'
  },
  'nav.matriz': {
    es: 'Matriz',
    pt: 'Matriz',
    en: 'Matrix'
  },
  'nav.dashboard': {
    es: 'Dashboard',
    pt: 'Dashboard',
    en: 'Dashboard'
  },
  'nav.backlog': {
    es: 'Backlog',
    pt: 'Backlog',
    en: 'Backlog'
  },
  'nav.historial': {
    es: 'Historial',
    pt: 'Histórico',
    en: 'Audit History'
  },
  'nav.paises': {
    es: 'Países',
    pt: 'Países',
    en: 'Countries'
  },
  'nav.usuarios': {
    es: 'Usuarios',
    pt: 'Usuários',
    en: 'Users & Roles'
  },
  'nav.branding': {
    es: 'Logo & Marca',
    pt: 'Logo e Marca',
    en: 'Logo & Branding'
  },

  // Filtros
  'filtro.buscar': {
    es: 'Buscar...',
    pt: 'Pesquisar...',
    en: 'Search...'
  },
  'filtro.todos_paises': {
    es: 'Todos los Países',
    pt: 'Todos os Países',
    en: 'All Countries'
  },
  'filtro.todos_solicitantes': {
    es: 'Solicitantes',
    pt: 'Solicitantes',
    en: 'Requesters'
  },
  'filtro.todos_services': {
    es: 'Business Services',
    pt: 'Business Services',
    en: 'Business Services'
  },
  'filtro.todos_productos': {
    es: 'Productos',
    pt: 'Produtos',
    en: 'Products'
  },
  'filtro.todos_estados': {
    es: 'Estados',
    pt: 'Status',
    en: 'Status'
  },

  // Fases
  'fase.1_abertura': { es: '1. Abertura', pt: '1. Abertura', en: '1. Opening' },
  'fase.2_reuniao': { es: '2. Reunião', pt: '2. Reunião', en: '2. Meeting' },
  'fase.3_analise': { es: '3. Análise', pt: '3. Análise', en: '3. Analysis' },
  'fase.4_comite': { es: '4. Comitê', pt: '4. Comitê', en: '4. Committee' },
  'fase.5_apresentacao': { es: '5. Apresentação', pt: '5. Apresentação', en: '5. Presentation' },
  'fase.6_aprovacao': { es: '6. Aprovação', pt: '6. Aprovação', en: '6. Approval' },
  'fase.7_execucao': { es: '7. Execução', pt: '7. Execução', en: '7. Execution' },
  'fase.8_concluida': { es: '8. Concluída', pt: '8. Concluída', en: '8. Completed' },

  // KPIs
  'kpi.capacidad_mes': { es: 'Capacidad del Mes', pt: 'Capacidade do Mês', en: 'Monthly Capacity' },
  'kpi.disponibles': { es: 'Disponibles', pt: 'Disponíveis', en: 'Available' },
  'kpi.utilizadas': { es: 'Utilizadas', pt: 'Utilizadas', en: 'Used' },
  'kpi.restantes': { es: 'Restantes', pt: 'Restantes', en: 'Remaining' },
  'kpi.pct_uso': { es: '% Uso', pt: '% Uso', en: '% Used' },
  'kpi.comprometidas': { es: 'Comprometidas', pt: 'Comprometidas', en: 'Committed' },
  'kpi.total_changes': { es: 'Changes', pt: 'Changes', en: 'Changes' },
  'kpi.promedio': { es: 'Promedio', pt: 'Média', en: 'Average' },
  'kpi.sobre_limite': { es: 'Sobre Límite', pt: 'Acima do Limite', en: 'Over Limit' },
  'kpi.mejoras': { es: 'Mejoras', pt: 'Melhorias', en: 'Enhancements' },
  'kpi.distribucion_prod': { es: 'Distribución por Producto', pt: 'Distribuição por Produto', en: 'Distribution by Product' },
  'kpi.sobrecapacidad_alerta': { es: '¡Capacidad excedida! Exceso:', pt: 'Capacidade excedida! Excesso:', en: 'Capacity exceeded! Overrun:' },

  // Dashboard - Acumulado Total
  'dash.acumulado_titulo': {
    es: 'Acumulado Total del Período / Histórico',
    pt: 'Acumulado Total do Período / Histórico',
    en: 'Total Accumulated Period / Historical'
  },
  'dash.acumulado_sub': {
    es: 'Muestra el consolidado acumulado de todos los períodos registrados para el país seleccionado.',
    pt: 'Mostra o consolidado acumulado de todos os períodos registrados para o país selecionado.',
    en: 'Displays the accumulated consolidated metrics for the selected country.'
  },
  'dash.horas_acumuladas': { es: 'Horas Acumuladas', pt: 'Horas Acumuladas', en: 'Accumulated Hours' },
  'dash.capacidad_acumulada': { es: 'Capacidad Total', pt: 'Capacidade Total', en: 'Total Capacity' },
  'dash.consumo_acumulado': { es: '% Consumo Acum.', pt: '% Consumo Acum.', en: '% Accum. Used' },
  'dash.changes_acumuladas': { es: 'Changes Acumuladas', pt: 'Changes Acumuladas', en: 'Accumulated Changes' },
  'dash.promedio_mensual': { es: 'Promedio Mensual', pt: 'Média Mensal', en: 'Monthly Average' },
  'dash.comparativo_mensual': { es: 'Comparativo Mensual de Capacidad y Uso', pt: 'Comparativo Mensal de Capacidade e Uso', en: 'Monthly Capacity & Usage Comparison' },
  'dash.mes_anterior': { es: 'Mes Anterior', pt: 'Mês Anterior', en: 'Previous Month' },
  'dash.mes_actual': { es: 'Mes Actual', pt: 'Mês Atual', en: 'Current Month' },

  // Formulario Change
  'form.titulo_nuevo': { es: '+ Nueva Solicitud de Change', pt: '+ Nova Solicitação de Change', en: '+ New Change Request' },
  'form.titulo_editar': { es: 'Editar Change', pt: 'Editar Change', en: 'Edit Change' },
  'form.titulo_consulta': { es: 'Consulta de Change (Solo Lectura)', pt: 'Consulta de Change (Somente Leitura)', en: 'Change Details (Read Only)' },
  'form.subtitulo_obligatorios': { es: 'Los 5 campos marcados con (*) son obligatorios', pt: 'Os 5 campos marcados com (*) são obrigatórios', en: 'The 5 fields marked with (*) are required' },
  'form.solicitante': { es: '1. Solicitante *', pt: '1. Solicitante *', en: '1. Requester *' },
  'form.number': { es: '2. Number (Ticket Change) *', pt: '2. Number (Ticket Change) *', en: '2. Number (Change Ticket) *' },
  'form.business_service': { es: '3. Business Service *', pt: '3. Business Service *', en: '3. Business Service *' },
  'form.short_description': { es: '4. Short Description (Descripción / Resumen) *', pt: '4. Short Description (Descrição / Resumo) *', en: '4. Short Description *' },
  'form.assigned_to': { es: '5. Assigned To (Ingeniero Responsable) *', pt: '5. Assigned To (Engenheiro Responsável) *', en: '5. Assigned To (Engineer) *' },
  'form.pais': { es: 'País *', pt: 'País *', en: 'Country *' },
  'form.producto': { es: 'Producto / Línea *', pt: 'Produto / Linha *', en: 'Product / Line *' },
  'form.ritm': { es: 'RITM / Ticket Relacionado', pt: 'RITM / Ticket Relacionado', en: 'Related RITM / Ticket' },
  'form.pasos_titulo': { es: 'Pasos de Implementación por Fase', pt: 'Etapas de Implementação por Fase', en: 'Implementation Steps by Phase' },
  'form.btn_agregar_paso': { es: 'Agregar Paso', pt: 'Adicionar Etapa', en: 'Add Step' },
  'form.horas_estimadas': { es: 'Total Horas Estimadas *', pt: 'Total Horas Estimadas *', en: 'Total Estimated Hours *' },
  'form.horas_aprobadas': { es: 'Horas Aprobadas (Comité) *', pt: 'Horas Aprovadas (Comitê) *', en: 'Approved Hours (Committee) *' },
  'form.entendimiento_tecnico': { es: 'Entendimiento Técnico', pt: 'Entendimento Técnico', en: 'Technical Understanding' },
  'form.rollback': { es: 'Plan de Rollback', pt: 'Plano de Rollback', en: 'Rollback Plan' },
  'form.aprobador_nombre': { es: 'Nombre Aprobador', pt: 'Nome do Aprovador', en: 'Approver Name' },
  'form.aprobador_email': { es: 'Email Aprobador', pt: 'E-mail do Aprovador', en: 'Approver Email' },
  'form.aprobador_estado': { es: 'Estado Aprobación', pt: 'Status Aprovação', en: 'Approval Status' },
  'form.cronograma_fases': { es: 'Cronograma de Fases (Fechas Efectivas)', pt: 'Cronograma de Fases (Datas Efetivas)', en: 'Phase Timeline (Effective Dates)' },
  'form.btn_guardar': { es: 'Guardar Change', pt: 'Salvar Change', en: 'Save Change' },
  'form.btn_cerrar': { es: 'Cerrar', pt: 'Fechar', en: 'Close' },

  // Usuarios
  'usr.titulo': { es: 'Control de Usuarios y Permisos', pt: 'Controle de Usuários e Permissões', en: 'User & Role Management' },
  'usr.subtitulo': { es: 'Administra cuentas, contraseñas y asigna roles: Administrador, Edición o Lectura.', pt: 'Gerencie contas, senhas e atribua perfis: Administrador, Edição ou Leitura.', en: 'Manage accounts, passwords, and assign roles: Admin, Editor, or Reader.' },
  'usr.nombre': { es: 'Nombre', pt: 'Nome', en: 'First Name' },
  'usr.apellido': { es: 'Apellido', pt: 'Sobrenome', en: 'Last Name' },
  'usr.usuario': { es: 'Usuario', pt: 'Usuário', en: 'Username' },
  'usr.email': { es: 'Correo Electrónico', pt: 'E-mail', en: 'Email' },
  'usr.rol': { es: 'Perfil / Rol', pt: 'Perfil / Função', en: 'Role / Profile' },
  'usr.idioma': { es: 'Idioma Preferido', pt: 'Idioma Preferido', en: 'Preferred Language' },
  'usr.pass_inicial': { es: 'Contraseña Inicial', pt: 'Senha Inicial', en: 'Initial Password' },
  'usr.pass_confirmar': { es: 'Confirmar Contraseña', pt: 'Confirmar Senha', en: 'Confirm Password' },
  'usr.estado': { es: 'Estado', pt: 'Status', en: 'Status' },
  'usr.activo': { es: 'Activo', pt: 'Ativo', en: 'Active' },
  'usr.inactivo': { es: 'Inactivo', pt: 'Inativo', en: 'Inactive' },
  'usr.btn_crear': { es: 'Registrar Usuario', pt: 'Cadastrar Usuário', en: 'Register User' },
  'usr.rol_admin': { es: '🛡️ Administrador', pt: '🛡️ Administrador', en: '🛡️ Administrator' },
  'usr.rol_editor': { es: '✏️ Edición', pt: '✏️ Edição', en: '✏️ Editor' },
  'usr.rol_lector': { es: '👁️ Lectura', pt: '👁️ Leitura', en: '👁️ Reader' },

  // Perfil de Usuario
  'perfil.titulo': { es: 'Mi Perfil de Usuario', pt: 'Meu Perfil de Usuário', en: 'My User Profile' },
  'perfil.info_personal': { es: 'Información Personal', pt: 'Informações Pessoais', en: 'Personal Information' },
  'perfil.seguridad': { es: 'Seguridad y Contraseña', pt: 'Segurança e Senha', en: 'Security & Password' },
  'perfil.preferencias': { es: 'Preferencias', pt: 'Preferências', en: 'Preferences' },
  'perfil.btn_guardar': { es: 'Guardar Cambios', pt: 'Salvar Alterações', en: 'Save Changes' },

  // Logo & Branding
  'brand.titulo': { es: 'Logo y Branding Corporativo', pt: 'Logo e Identidade Visual', en: 'Logo & Corporate Branding' },
  'brand.subtitulo': { es: 'Personaliza el logo de la aplicación visible en el header y pantallas de acceso.', pt: 'Personalize o logotipo visível no cabeçalho e telas de login.', en: 'Customize the corporate logo displayed in the header and login screens.' },
  'brand.subir_logo': { es: 'Subir Nuevo Logo (PNG, JPG, SVG - Máx. 2MB)', pt: 'Enviar Novo Logo (PNG, JPG, SVG - Máx. 2MB)', en: 'Upload New Logo (PNG, JPG, SVG - Max 2MB)' },
  'brand.preview': { es: 'Vista Previa del Logo', pt: 'Pré-visualização do Logo', en: 'Logo Preview' },
  'brand.btn_guardar_logo': { es: 'Aplicar Logo', pt: 'Aplicar Logotipo', en: 'Apply Logo' },
  'brand.btn_restablecer': { es: 'Restablecer al Logo Predeterminado', pt: 'Restaurar Logo Padrão', en: 'Reset to Default Logo' },

  // Notificaciones Toast y Feedback
  'toast.cambio_guardado': { es: 'Cambios guardados correctamente ✅', pt: 'Alterações salvas com sucesso ✅', en: 'Changes saved successfully ✅' },
  'toast.acceso_denegado': { es: 'Acceso denegado: Tu perfil es de Solo Lectura ⚠️', pt: 'Acesso negado: Seu perfil é Somente Leitura ⚠️', en: 'Access Denied: Read-only profile ⚠️' },
  'toast.solo_admin': { es: 'Función exclusiva de Administrador 🛡️', pt: 'Função exclusiva de Administrador 🛡️', en: 'Administrator privilege required 🛡️' },
  'toast.sesion_iniciada': { es: 'Bienvenido/a al Portal 👋', pt: 'Bem-vindo(a) ao Portal 👋', en: 'Welcome to the Portal 👋' },
  'toast.sesion_cerrada': { es: 'Sesión cerrada correctamente.', pt: 'Sessão encerrada com sucesso.', en: 'Signed out successfully.' }
};

// Variable de idioma activo
let idiomaActual = localStorage.getItem('nestle_app_idioma') || 'es';

/**
 * Función principal de traducción.
 * @param {string} key - Clave del diccionario
 * @param {string} fallback - Texto de respaldo
 * @returns {string} Texto traducido
 */
function t(key, fallback = '') {
  if (DICCIONARIO[key] && DICCIONARIO[key][idiomaActual]) {
    return DICCIONARIO[key][idiomaActual];
  }
  if (DICCIONARIO[key] && DICCIONARIO[key]['es']) {
    return DICCIONARIO[key]['es'];
  }
  return fallback || key;
}

/**
 * Cambia el idioma activo de la aplicación y actualiza toda la interfaz.
 * @param {string} nuevoIdioma - 'es' | 'pt' | 'en'
 */
function cambiarIdiomaApp(nuevoIdioma) {
  if (!I18N_IDIOMAS[nuevoIdioma]) return;
  idiomaActual = nuevoIdioma;
  localStorage.setItem('nestle_app_idioma', nuevoIdioma);

  // Actualizar atributo lang del html
  document.documentElement.lang = nuevoIdioma;

  // Actualizar selector en header
  actualizarBotonIdiomaHeader();

  // Traducir todos los elementos con atributo data-i18n
  traducirTodaLaInterfaz();

  // Re-renderizar vistas activas (Kanban, Matriz, Dashboard, etc.)
  if (typeof renderizarTodo === 'function') {
    renderizarTodo();
  }

  // Notificar si está disponible
  if (typeof mostrarToast === 'function') {
    const nombres = { es: 'Español 🇪🇸', pt: 'Português 🇧🇷', en: 'English 🇺🇸' };
    mostrarToast(`Idioma: ${nombres[nuevoIdioma]}`, 'info');
  }
}

function actualizarBotonIdiomaHeader() {
  const btn = document.getElementById('btnSelectorIdioma');
  const sel = document.getElementById('selectIdiomaHeader');
  if (btn) {
    const info = I18N_IDIOMAS[idiomaActual];
    btn.innerHTML = `<span>${info.flag}</span> <span class="hidden sm:inline">${info.nombre}</span> <i class="fa-solid fa-chevron-down text-[9px] opacity-70"></i>`;
  }
  if (sel) {
    sel.value = idiomaActual;
  }
}

/**
 * Itera el DOM y traduce automáticamente los elementos con data-i18n y data-i18n-placeholder.
 */
function traducirTodaLaInterfaz() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key, el.textContent);
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key, el.getAttribute('placeholder') || ''));
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', t(key, el.getAttribute('title') || ''));
    }
  });
}
