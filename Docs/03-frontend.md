# Guías de Diseño y Frontend (UI/UX) - Gyro Store

## 1. Sistema de Diseño y Estilos
*   **Framework CSS:** Todo el estilizado se maneja mediante clases utilitarias de Tailwind CSS, configuradas globalmente en `styles/globals.css`.
*   **Temas (Theming):** Soporte para modos visuales estructurados a través del hook `useTheme.ts`, garantizando un contraste adecuado tanto en el storefront público como en el panel administrativo.
*   **Responsividad:** Diseño "Mobile First". Se utilizan componentes específicos para optimizar la experiencia en pantallas pequeñas (ej. `MobileStoreActions`, `MobileBuyBar`), asegurando que la interfaz se adapte sin problemas desde un teléfono móvil hasta configuraciones avanzadas de múltiples monitores de escritorio.

## 2. Biblioteca de Componentes Base (`components/ui/`)
Se mantiene una colección centralizada de componentes primitivos y reutilizables para garantizar consistencia visual y reducir la duplicación de código:
*   **Contenedores y Modales:** `Modal`, `Drawer` (con su variante `FormDrawerLayout`), `Sheet` y `AnimatedTabs`.
*   **Entradas y Formularios:** `Autocomplete`, `ComboBox`, `Select`, `DatePicker`, `MonthPicker` y campos dinámicos como `FloatingField`.
*   **Visualización de Datos:** `DataTable` (estandarizado para tablas administrativas), `StatusBadge` y `CountUp`.
*   **Feedback Visual:** `Skeleton` para estados de carga (loading states) y envoltorios de animación en `Motion.tsx` para transiciones fluidas.

## 3. Layouts Principales (`components/layout/`)
La aplicación separa estructuralmente sus "envolturas" (shells) dependiendo del contexto de uso:
*   **Storefront (Público):** Orquestado por `StorefrontShell`, cuenta con un `PublicHeader` responsivo, `MegaMenuPanel` para la navegación de categorías en escritorio, y `PublicSidebar` para móviles.
*   **Back-office (Admin):** Utiliza `AppShell` y `PageShell`, integrando controles de navegación lateral (`RailControls`, `RailPanelContent`), notificaciones y el menú de configuración de usuario (`UserMenu`).

## 4. Patrones de Experiencia de Usuario (UX)
*   **Fricción Cero en Compras:** Se emplea el `QuickAddSheet` y el `CartDrawer` para permitir a los usuarios gestionar sus productos y combos sin abandonar su contexto de navegación actual.
*   **Acceso Directo a Soporte:** Botones de acción flotantes (`WhatsAppButton`, `WhatsAppIcon`, `CartFab`) siempre visibles. Las interacciones de soporte y cierre de ventas redirigen invariablemente a la línea oficial de atención (85944758).
*   **Descubrimiento de Productos:** Implementación de barras de búsqueda reactivas (`SearchBar`), etiquetas de categorías (`CategoryChips`) y paneles de filtrado (`FilterSidebar`) para localizar rápidamente desde accesorios generales hasta mouses gaming con base de carga.
