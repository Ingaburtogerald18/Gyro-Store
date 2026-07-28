# 05 · Frontend — Gyro Store

> **Actualizado con el código real** (`frontend/app/routes`, `store`, `lib`, `hooks`).
> El diseño visual vive en `DESIGN.md` (Editorial Dark) — este doc no lo repite.

---

## 1. Stack [CONFIRMADO — `README.md` + código]
Remix (React, **TypeScript**) · **Tailwind v4** · **Redux Toolkit + RTK Query** · Framer
Motion · Lucide · TanStack Table · React Hook Form + Zod · dnd-kit · Recharts · Sonner.
Dos pieles: storefront (Editorial Dark) y admin (Obsidian/Esmeralda).

## 2. Rutas reales (Remix, convención plana) [CONFIRMADO]

**Públicas:**
`_index.tsx` (home) · `producto.$id.tsx` (PDP) · `combo.$id.tsx` (combo) · `contacto.tsx` · `login.tsx`

**Admin** (layout `admin.tsx` + hijas `admin.*`):
| Ruta | Portal |
|---|---|
| `admin._index` | dashboard |
| `admin.catalogo` | modo edición del catálogo |
| `admin.inventario` | bodega / FIFO |
| `admin.ventas` | ventas |
| `admin.facturacion` | POS / tickets |
| `admin.pedidos` | pedidos públicos (checkout WhatsApp) |
| `admin.reportes` | KPIs / pérdidas / gastos |
| `admin.usuarios` | gestión de usuarios |
| `admin.logistica` | Gyro Logistics |
| `admin.cuotas` | installments |
| `admin.codigos-descuento` | discount codes |
| `admin.crm` / `admin.seguimientos` | CRM (contactos / followups) |
| `admin.feedback` | feedback de usuarios |
| `admin.busquedas` | telemetría de búsquedas |
| `admin.configuracion` | config del negocio |

> **[CAMBIO v2?]** `admin.crm` **y** `admin.seguimientos` coexisten (espejo del `contacts`/
> `followups` del backend). Unificar en el rebuild.

## 3. Estado — RTK Query en todo [CONFIRMADO — `store/`]
No es loaders-first: el frontend usa **RTK Query** para casi todo el dato.

- **`store/api/baseApi.ts`** — base con `baseQuery` que inyecta el `Bearer <ID token>`.
- **15 API slices por dominio:** `catalogApi`, `ordersApi`, `salesApi`, `inventoryApi`,
  `invoicesApi`, `reportsApi`, `usersApi`, `logisticsApi`, `installmentsApi`, `contactsApi`,
  `followupsApi`, `discountCodesApi`, `feedbackApi`, `searchAnalyticsApi`. [CONFIRMADO]
- **Slices de UI/estado:** `authSlice`, `cartSlice` (carrito local del storefront), `uiSlice`.
- `store/store.ts` (configureStore) + `store/hooks.ts` (typed hooks).

> **[CAMBIO v2?]** Si querés SSR/SEO más fuerte en storefront, podés mover home/PDP a
> **loaders de Remix** y dejar RTK Query solo para el admin. Hoy es RTK Query parejo.

## 4. Lib [CONFIRMADO — `lib/`]
`firebase.client.ts` (solo Auth), `authStrategies.ts`, `categories.ts`, `combo.ts`,
`constants.ts`, `chipStyles.ts`, `detailMotion.ts`, `searchTelemetry.ts`, `storeLinks.ts`,
`trustSignals.ts`, `utils.ts`.

## 5. Hooks [CONFIRMADO — `hooks/`]
`useAuth`, `useTheme`, `useCatalogFilter`, `useOrderCalculator`, `useElementInView`,
`useMediaQuery`, `useIdleTimeout` (auto-logout por inactividad), `usePageviewTelemetry`,
`useSearchTelemetry` + subcarpetas `reports/` y `sales/` (lógica de dominio).

## 6. Schemas de frontend [CONFIRMADO — `schemas/` + `shared/`]
Los forms extienden los schemas base de **`shared/schemas.mjs`** (contrato único front/back).
Locales: `schemas/expenses.ts`, `schemas/losses.ts`, `schemas/validators.ts`. Regla: nunca
re-declarar campos comunes; extender la base compartida.

## 7. Theming [CONFIRMADO — `DESIGN.md` §2.1 + `useTheme`]
`useTheme` con toggle en `PublicSidebar`/`UserMenu`. `data-theme` en `<html>`,
`data-skin="store"` en el wrapper público (selector descendiente). Oscuro por defecto; claro
"Daylight" calibrado. Todo componente consume **tokens** (`bg-bg`, `text-accent`, `border-border`).

## 8. Accesibilidad y rendimiento [CONFIRMADO — `DESIGN.md` §9]
Contraste AA, foco visible, `prefers-reduced-motion`, touch ≥44px. Imágenes WebP optimizadas
(Sharp server-side) + blur-up + lazy. `useIdleTimeout` para seguridad de sesión en admin.

## 9. Componentes del storefront
Contratos completos en `DESIGN.md` §7: `ProductCard`, `ProductGrid` (bento asimétrico),
`Hero`, `ProductCarousel`, `CategoryChips` (portal+fixed), `BrandStrip`, `QuickAddSheet`,
`PublicSidebar`. Estructura real en `frontend/app/components/{catalog,product,public,cart,layout,ui,...}`.

## 10. Convenciones [MEJORA — fijar en v2]
- TS estricto, sin `any`; un componente por archivo, props tipadas.
- Lógica de negocio en hooks/servicios, no en componentes.
- Validación compartida vía `shared/` (una sola fuente de verdad).

