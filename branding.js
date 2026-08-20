/**
 * branding.js — Gestión de Logo Corporativo e Identidad Visual
 */

const BRANDING_CONFIG = {
  STORAGE_KEY_LOGO: 'nestle_custom_logo_v5',
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  DEFAULT_LOGO_SVG: `
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
      <rect width="48" height="48" rx="14" fill="url(#logo_grad)" />
      <path d="M14 17C14 15.3431 15.3431 14 17 14H31C32.6569 14 34 15.3431 34 17V21C34 22.6569 32.6569 24 31 24H21C19.3431 24 18 25.3431 18 27V31C18 32.6569 19.3431 34 21 34H31C32.6569 34 34 32.6569 34 31" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="33" cy="19" r="2.5" fill="#93C5FD"/>
      <circle cx="15" cy="29" r="2.5" fill="#93C5FD"/>
      <defs>
        <linearGradient id="logo_grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stop-color="#1D4ED8"/>
          <stop offset="1" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
    </svg>
  `
};

class BrandingManager {
  constructor() {
    this.customLogoBase64 = localStorage.getItem(BRANDING_CONFIG.STORAGE_KEY_LOGO) || null;
  }

  inicializar() {
    this.aplicarLogoEnDOM();
  }

  aplicarLogoEnDOM() {
    const contenedores = document.querySelectorAll('.app-branding-logo-container');
    contenedores.forEach(c => {
      if (this.customLogoBase64) {
        c.innerHTML = `<img src="${this.customLogoBase64}" alt="Logo Corporativo" class="max-h-10 max-w-[140px] object-contain rounded-lg shadow-xs" />`;
      } else {
        c.innerHTML = BRANDING_CONFIG.DEFAULT_LOGO_SVG;
      }
    });

    const contenedoresGrandes = document.querySelectorAll('.app-branding-logo-large');
    contenedoresGrandes.forEach(c => {
      if (this.customLogoBase64) {
        c.innerHTML = `<img src="${this.customLogoBase64}" alt="Logo Corporativo" class="max-h-16 max-w-[200px] object-contain rounded-xl shadow-sm mx-auto" />`;
      } else {
        c.innerHTML = `
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center text-white text-3xl shadow-lg mx-auto">
            <i class="fa-solid fa-layer-group"></i>
          </div>`;
      }
    });
  }

  guardarLogo(base64Data) {
    this.customLogoBase64 = base64Data;
    localStorage.setItem(BRANDING_CONFIG.STORAGE_KEY_LOGO, base64Data);
    this.aplicarLogoEnDOM();
  }

  restablecerLogoDefault() {
    this.customLogoBase64 = null;
    localStorage.removeItem(BRANDING_CONFIG.STORAGE_KEY_LOGO);
    this.aplicarLogoEnDOM();
  }

  procesarArchivoLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error('No se seleccionó ningún archivo.'));
      }

      // Validar tipo
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        return reject(new Error('Formato no permitido. Utiliza PNG, JPG o SVG.'));
      }

      // Validar tamaño
      if (file.size > BRANDING_CONFIG.MAX_FILE_SIZE_BYTES) {
        return reject(new Error('El archivo excede el tamaño máximo permitido de 2MB.'));
      }

      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Error al leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
}

const brandingService = new BrandingManager();
