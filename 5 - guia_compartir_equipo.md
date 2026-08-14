# 🚀 Guía: Cómo Compartir el Portal con tu Equipo de Trabajo

Esta guía explica las mejores opciones para poner el **Portal de Gestión de Changes y Capacidad** a disposición de todos los miembros de tu equipo, permitiendo que varios usuarios visualicen, creen y actualicen changes simultáneamente.

---

## 🏢 Opción 1: Publicar en Microsoft SharePoint / Teams (Recomendada para Nestlé)

Dado que ya tienes configurada la lista `Control_de_Changes` en SharePoint, esta es la opción más directa y segura dentro de la red corporativa:

### Pasos:
1. **Subir los Archivos a SharePoint**:
   - Entra a tu sitio de SharePoint de Nestlé (o Teams).
   - Ve a **Documentos** (o cualquier biblioteca de documentos compartida con tu equipo).
   - Crea una carpeta llamada `Portal_Control_Changes`.
   - Sube los siguientes 4 archivos:
     - `index.html`
     - `styles.css`
     - `app.js`
     - `sample_data.js`
2. **Obtener el Enlace Compartido**:
   - Haz clic derecho sobre `index.html` $\rightarrow$ **Copiar vínculo**.
   - Configura el permiso: *"Cualquier persona de Nestlé con el vínculo puede ver/editar"*.
3. **Incrustar en Microsoft Teams**:
   - Ve al canal de Teams de tu equipo.
   - Haz clic en el botón **`+` (Agregar pestaña)** en la parte superior.
   - Selecciona **Sitio Web** (o *Documento*).
   - Pega el vínculo de `index.html` y nómbralo **"Gestión de Changes"**.
   - ¡Listo! Todo el equipo tendrá la herramienta integrada directamente en Teams.

---

## 📁 Opción 2: Carpeta Compartida en Red / OneDrive Corporativo

Si tu equipo trabaja en una misma red o comparten una carpeta de OneDrive:

### Pasos:
1. Copia la carpeta completa `change-management-portal` a tu **OneDrive Compartido** o a una ruta de red de la empresa (ej. `\\servidor_nestle\equipos\Control_Changes`).
2. Comparte la carpeta con los correos de tu equipo.
3. Cada miembro solo debe abrir el archivo:
   - `Abrir_Portal_Changes.bat` (Doble clic) o `index.html` en su navegador.
4. **Sincronización**: Al estar en la misma red/OneDrive o usar la sincronización con SharePoint, los datos se mantienen actualizados.

---

## 🌐 Opción 3: Publicar como Servidor Web Interno / Nube

Como la herramienta está construida en **HTML5, CSS y JavaScript modernos sin dependencias pesadas**, puede publicarse en cualquier servidor web corporativo:

- **GitHub Enterprise / GitLab Pages**: Subes los archivos a un repositorio interno y activas *Pages* para obtener una URL fija (ej. `https://pages.nestle.com/changes-portal`).
- **Azure Static Web Apps / Firebase Hosting**: Se despliega en 1 minuto de forma gratuita y entrega una URL segura HTTPS.

---

## 👥 ¿Cómo colabora el equipo simultáneamente?

1. **Filtro por Solicitante**: Cada miembro del equipo selecciona su nombre en la barra superior para ver de inmediato sus requerimientos.
2. **Actualizaciones en Tiempo Real**: Al mover una tarjeta en el Kanban o editar una Change, el botón **Sincronizar** actualiza los datos contra la lista oficial.
3. **Carga y Descarga Masiva**: Cualquier usuario puede exportar el reporte a Excel o subir archivos de Backlog con el botón **Cargar Backlog (Excel)**.
