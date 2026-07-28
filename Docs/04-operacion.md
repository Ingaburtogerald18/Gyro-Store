# Reglas de Operación, Mantenimiento y Riesgos - Gyro Store

## 1. Roles y Control de Acceso
El panel de administración (Back-office) utiliza un sistema de control de acceso basado en roles (`RequireRole.tsx`) para proteger las operaciones críticas del negocio.
*   **Permisos de Administración:** Ciertas rutas y vistas están restringidas a usuarios con privilegios elevados (ej. generados a través de `seedAdmin.js`). Estos usuarios pueden acceder a finanzas, presupuestos, pérdidas y ganancias.
*   **Seguridad de Capa:** Las protecciones del frontend deben estar siempre respaldadas por verificaciones equivalentes en el backend (`auth.js`) para evitar que peticiones directas a la API salten la seguridad.

## 2. Scripts de Mantenimiento y Automatización (`/scripts`)
El repositorio incluye un conjunto de utilidades para tareas operativas, de limpieza y de preparación de entorno, los cuales deben ejecutarse con precaución en producción:
*   **Mantenimiento de Medios:** Scripts como `optimizeExistingImages.js`, `cleanupStorage.js` y `resize-images.ps1` son vitales para mantener el peso de almacenamiento bajo control y garantizar que el storefront cargue rápidamente.
*   **Gestión de Catálogo e Inventario:** Herramientas para corregir discrepancias (ej. `fix_sku.js`, `check-az09.js`) y utilidades de migración de datos críticos (`migrateInventorySku.js`, `migrateFollowupsToContacts.js`).
*   **Poblado de Datos (Seeding):** Uso de scripts en `/seed/` para inicializar plantillas de productos estandarizadas rápidamente, tales como auriculares de la serie KZ o mouses con base de carga (`seedTemplateAttackSharkX11.js`).

## 3. Riesgos Técnicos y Reglas de Negocio
*   **Integridad del Canal de Ventas:** Todas las conversiones y flujos de seguimiento del CRM se unifican hacia el contacto oficial. Para evitar dispersión, las comunicaciones y flujos de WhatsApp se enrutan rígidamente al 85944758.
*   **Migración de Estructuras:** Cualquier modificación profunda a las colecciones de la base de datos (por ejemplo, alterar cómo se enlazan los contactos o cómo se cuenta el stock) requiere invariablemente la creación de un script en `scripts/migrations/` y su validación local antes de afectar producción.
*   **Deuda Técnica de Imágenes:** Si no se aplican rutinas regulares de compresión y redimensionamiento, el costo de transferencia de datos y la lentitud del cliente incrementarán de forma inaceptable. El uso de los scripts de optimización es obligatorio tras cargas masivas de catálogo.
