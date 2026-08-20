/**
 * auth.js — Módulo de Autenticación, Hashing Criptográfico y Gestión de Sesiones
 * Utiliza Web Crypto API (SHA-256 + Salt) para no almacenar contraseñas en texto plano.
 */

const AUTH_CONFIG = {
  SALT_GLOBAL: 'NESTLE_CHANGE_MGMT_V5_SALT_KEY',
  STORAGE_KEY_USERS: 'nestle_usuarios_v5',
  STORAGE_KEY_SESSION: 'nestle_sesion_activa_v5',
  MIN_PASS_LENGTH: 8
};

/**
 * Función criptográfica segura para generar hash SHA-256 de una contraseña.
 * @param {string} password 
 * @returns {Promise<string>} Hash hexadecimal
 */
async function generarHashPassword(password) {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + AUTH_CONFIG.SALT_GLOBAL);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Usuarios iniciales con contraseñas pre-hasheadas (SHA-256 de 'Nestle2026!')
 */
const USUARIOS_SEMILLA = [
  {
    id: 'usr-admin',
    nombre: 'Claudio',
    apellido: 'Lima',
    usuario: 'admin',
    email: 'admin.it@nestle.com',
    passwordHash: 'e6378a7c2966144e12c1c68e3f9a7d2e8b9a1c0d4e5f6a7b8c9d0e1f2a3b4c5d', // Se regenera en init
    rol: 'Administrador', // 'Administrador' | 'Edición' | 'Lectura'
    idioma: 'es',
    activo: true,
    primerAcceso: false,
    fechaCreacion: '2026-08-01'
  },
  {
    id: 'usr-editor',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    usuario: 'cmendoza',
    email: 'carlos.mendoza@nestle.com',
    passwordHash: '',
    rol: 'Edición',
    idioma: 'es',
    activo: true,
    primerAcceso: true, // Debe cambiar contraseña en primer login
    fechaCreacion: '2026-08-10'
  },
  {
    id: 'usr-lector',
    nombre: 'Mariana',
    apellido: 'Silva',
    usuario: 'msilva',
    email: 'mariana.silva@nestle.com',
    passwordHash: '',
    rol: 'Lectura',
    idioma: 'pt',
    activo: true,
    primerAcceso: false,
    fechaCreacion: '2026-08-12'
  }
];

class AuthManager {
  constructor() {
    this.usuarios = [];
    this.sesionActiva = null;
  }

  async inicializar() {
    // Cargar o inicializar usuarios con hash seguro
    const rawUsers = localStorage.getItem(AUTH_CONFIG.STORAGE_KEY_USERS);
    if (rawUsers) {
      try {
        this.usuarios = JSON.parse(rawUsers);
      } catch (_) {
        await this.restaurarSemilla();
      }
    } else {
      await this.restaurarSemilla();
    }

    // Cargar sesión activa
    const rawSession = sessionStorage.getItem(AUTH_CONFIG.STORAGE_KEY_SESSION);
    if (rawSession) {
      try {
        this.sesionActiva = JSON.parse(rawSession);
        // Validar que el usuario de la sesión siga existiendo y activo
        const u = this.usuarios.find(x => x.id === this.sesionActiva.id);
        if (!u || !u.activo) {
          this.cerrarSesionSinConfirmar();
        } else {
          this.sesionActiva = { ...u };
        }
      } catch (_) {
        this.sesionActiva = null;
      }
    }
  }

  async restaurarSemilla() {
    const hashDefault = await generarHashPassword('Nestle2026!');
    this.usuarios = USUARIOS_SEMILLA.map(u => ({
      ...u,
      passwordHash: hashDefault
    }));
    this.guardarUsuarios();
  }

  guardarUsuarios() {
    localStorage.setItem(AUTH_CONFIG.STORAGE_KEY_USERS, JSON.stringify(this.usuarios));
  }

  guardarSesion(usuario) {
    this.sesionActiva = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      usuario: usuario.usuario,
      email: usuario.email,
      rol: usuario.rol,
      idioma: usuario.idioma || 'es',
      primerAcceso: usuario.primerAcceso
    };
    sessionStorage.setItem(AUTH_CONFIG.STORAGE_KEY_SESSION, JSON.stringify(this.sesionActiva));
  }

  /**
   * Intento de login.
   * @param {string} identificador - Usuario o Email
   * @param {string} passwordPlano - Contraseña ingresada
   */
  async login(identificador, passwordPlano) {
    if (!identificador || !passwordPlano) {
      return { exito: false, mensaje: t('login.error_credenciales') };
    }

    const cleanId = identificador.trim().toLowerCase();
    const hashIngresado = await generarHashPassword(passwordPlano);

    const user = this.usuarios.find(u => 
      (u.usuario.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) &&
      u.passwordHash === hashIngresado
    );

    if (!user) {
      return { exito: false, mensaje: t('login.error_credenciales') };
    }

    if (!user.activo) {
      return { exito: false, mensaje: t('login.error_inactivo') };
    }

    // Verificar si es primer acceso obligatorio
    if (user.primerAcceso) {
      return {
        exito: true,
        requiereCambioPassword: true,
        usuarioId: user.id,
        nombreUsuario: `${user.nombre} ${user.apellido || ''}`.trim()
      };
    }

    // Sesión exitosa
    this.guardarSesion(user);
    if (user.idioma) {
      cambiarIdiomaApp(user.idioma);
    }

    return { exito: true, requiereCambioPassword: false, usuario: this.sesionActiva };
  }

  /**
   * Actualiza la contraseña en el primer acceso o voluntariamente.
   */
  async cambiarPassword(usuarioId, passActualPlano, passNuevaPlano, esForzado = false) {
    const user = this.usuarios.find(u => u.id === usuarioId);
    if (!user) {
      return { exito: false, mensaje: 'Usuario no encontrado.' };
    }

    // Verificar contraseña actual
    const hashActual = await generarHashPassword(passActualPlano);
    if (user.passwordHash !== hashActual) {
      return { exito: false, mensaje: 'La contraseña actual no es correcta.' };
    }

    // Validar requisitos de seguridad
    if (passNuevaPlano.length < AUTH_CONFIG.MIN_PASS_LENGTH) {
      return { exito: false, mensaje: `La nueva contraseña debe tener al menos ${AUTH_CONFIG.MIN_PASS_LENGTH} caracteres.` };
    }
    if (!/[A-Z]/.test(passNuevaPlano) || !/[0-9]/.test(passNuevaPlano)) {
      return { exito: false, mensaje: 'La contraseña debe incluir al menos una letra mayúscula y un número.' };
    }
    if (passActualPlano === passNuevaPlano) {
      return { exito: false, mensaje: 'La nueva contraseña debe ser diferente de la contraseña anterior.' };
    }

    // Guardar nuevo hash
    user.passwordHash = await generarHashPassword(passNuevaPlano);
    user.primerAcceso = false;
    this.guardarUsuarios();

    // Actualizar sesión activa
    this.guardarSesion(user);

    return { exito: true, mensaje: 'Contraseña actualizada correctamente.' };
  }

  /**
   * Crear nuevo usuario (Solo Admin).
   */
  async crearUsuario(datos) {
    const { nombre, apellido, usuario, email, password, rol, idioma, activo } = datos;
    if (!nombre || !usuario || !email || !password) {
      return { exito: false, mensaje: 'Todos los campos obligatorios deben ser completados.' };
    }

    const cleanUser = usuario.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Validar duplicados
    if (this.usuarios.some(u => u.usuario.toLowerCase() === cleanUser)) {
      return { exito: false, mensaje: `El nombre de usuario "${usuario}" ya está en uso.` };
    }
    if (this.usuarios.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { exito: false, mensaje: `El correo "${email}" ya está registrado.` };
    }

    const passwordHash = await generarHashPassword(password);
    const nuevoUsuario = {
      id: `usr-${Date.now()}`,
      nombre: nombre.trim(),
      apellido: (apellido || '').trim(),
      usuario: cleanUser,
      email: cleanEmail,
      passwordHash,
      rol: rol || 'Lectura',
      idioma: idioma || 'es',
      activo: activo !== undefined ? activo : true,
      primerAcceso: true, // Obligado a cambiar en primer acceso
      fechaCreacion: new Date().toISOString().split('T')[0]
    };

    this.usuarios.push(nuevoUsuario);
    this.guardarUsuarios();

    return { exito: true, usuario: nuevoUsuario };
  }

  async actualizarUsuario(id, datosActualizados) {
    const idx = this.usuarios.findIndex(u => u.id === id);
    if (idx === -1) return { exito: false, mensaje: 'Usuario no encontrado.' };

    const u = this.usuarios[idx];
    if (datosActualizados.nombre) u.nombre = datosActualizados.nombre.trim();
    if (datosActualizados.apellido !== undefined) u.apellido = datosActualizados.apellido.trim();
    if (datosActualizados.rol) u.rol = datosActualizados.rol;
    if (datosActualizados.idioma) u.idioma = datosActualizados.idioma;
    if (datosActualizados.activo !== undefined) u.activo = datosActualizados.activo;

    if (datosActualizados.nuevaPassword) {
      u.passwordHash = await generarHashPassword(datosActualizados.nuevaPassword);
      u.primerAcceso = true; // Reiniciar requerimiento
    }

    this.guardarUsuarios();

    if (this.sesionActiva && this.sesionActiva.id === id) {
      this.guardarSesion(u);
    }

    return { exito: true, usuario: u };
  }

  eliminarUsuario(id) {
    if (this.usuarios.length <= 1) {
      return { exito: false, mensaje: 'No puedes eliminar el único usuario del sistema.' };
    }
    if (this.sesionActiva && this.sesionActiva.id === id) {
      return { exito: false, mensaje: 'No puedes eliminar tu propio usuario en sesión activa.' };
    }
    this.usuarios = this.usuarios.filter(u => u.id !== id);
    this.guardarUsuarios();
    return { exito: true };
  }

  cerrarSesionSinConfirmar() {
    this.sesionActiva = null;
    sessionStorage.removeItem(AUTH_CONFIG.STORAGE_KEY_SESSION);
  }

  estaAutenticado() {
    return !!this.sesionActiva && !!this.sesionActiva.id;
  }

  obtenerUsuarioActual() {
    return this.sesionActiva || { rol: 'Lectura', nombre: 'Invitado' };
  }

  esAdmin() {
    return this.sesionActiva && this.sesionActiva.rol === 'Administrador';
  }

  puedeEditar() {
    return this.sesionActiva && (this.sesionActiva.rol === 'Administrador' || this.sesionActiva.rol === 'Edición');
  }

  esLectura() {
    return !this.sesionActiva || this.sesionActiva.rol === 'Lectura';
  }
}

// Instancia global
const authService = new AuthManager();
