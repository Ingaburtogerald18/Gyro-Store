# 05 · Frontend — Gyro Store

> El frontend es lo que **menos cambia** con v2: Remix + RTK Query siguen igual. Los cambios reales
> son tres: (1) el cliente de auth pasa de Firebase a **Supabase**, (2) adopto **shadcn/ui** como
> base de componentes, y (3) todo el shared/schemas pasa a `.ts`. El diseño visual sigue viviendo en
> `DESIGN.md` (Editorial Dark) — este doc no lo repite.

---

## 1. Stack [se mantiene de v1 + shadcn/ui]
Remix (React, **TypeScript**) · **Tailwind v4** · **shadcn/ui** [v2] · **Redux Toolkit + RTK Query** ·
Framer Motion · Lucide · TanStack Table · React Hook Form + Zod · dnd-kit · Recharts · Sonner.
Dos pieles: storefront (Editorial Dark) y admin (Obsidian/Esmeralda).

### Sobre shadcn/ui [v2]
Elegí shadcn/ui porque **no impone estilo**: el CLI me copia el código de cada componente (Dialog,
Dropdown, Tabs, Command, Table, etc.) dentro de `app/components/ui/`, construido sobre Radix
(accesible por defecto), y yo lo pinto con **mis tokens** de `DESIGN.md`. No es una librería que
"se ve como shadcn"; es mi propio design system con la parte tediosa (foco, teclado, ARIA) resuelta.
- Para **charts del admin** sigo con **Recharts** (o Tremor si quiero KPIs listos); shadcn no hace charts.
- Regla: **ningún componente de `ui/` usa colores crudos**; todo sale de tokens (`bg-bg`, `text-accent`,
  `border-border`), así el flip dark↔light y el skin store/admin siguen funcionando.

## 2. Rutas reales (Remix, convención plana) [se mantiene]

**Públicas:**
`_index.tsx` (home) · `producto.$id.tsx` (PDP) · `combo.$id.tsx` (combo) · `contacto.tsx` · `login.tsx`

> `login.tsx` ahora dispara el flujo de **Supabase Auth + Microsoft Entra** (redirect al tenant y
> vuelta con sesión). Es la única página pública que toca auth. [v2]

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
| `admin.crm` / `admin.seguimientos` | CRM (contactos / followups) — forma final = decisión abierta |
| `admin.feedback` | feedback de usuarios |
| `admin.busquedas` | telemetría de búsquedas |
| `admin.configuracion` | config del negocio |

## 3. Estado — RTK Query en todo [se mantiene]
El frontend usa **RTK Query** para casi todo el dato (no es loaders-first).

- **`store/api/baseApi.ts`** — base con `baseQuery` que inyecta el `Bearer <JWT de Supabase>`. [v2]
- **API slices por dominio:** `catalogApi`, `ordersApi`, `salesApi`, `inventoryApi`, `invoicesApi`,
  `reportsApi`, `usersApi`, `logisticsApi`, `installmentsApi`, `contactsApi`, `followupsApi`,
  `discountCodesApi`, `feedbackApi`, `searchAnalyticsApi`.
- **Slices de UI/estado:** `authSlice`, `cartSlice` (carrito local del storefront), `uiSlice`.
- `store/store.ts` (configureStore) + `store/hooks.ts` (typed hooks).

> **[CAMBIO v2?]** Si quiero SSR/SEO más fuerte en el storefront, puedo mover home/PDP a **loaders de
> Remix** y dejar RTK Query solo para el admin. Lo dejo anotado; por ahora sigue parejo.

## 4. Lib [se mantiene, con el cliente de auth cambiado]
`supabase.client.ts` (solo Auth) [v2 — antes `firebase.client.ts`], `authStrategies.ts`,
`categories.ts`, `combo.ts`, `constants.ts`, `chipStyles.ts`, `detailMotion.ts`,
`searchTelemetry.ts`, `storeLinks.ts`, `trustSignals.ts`, `utils.ts`.

## 5. Hooks [se mantiene]
`useAuth`, `useTheme`, `useCatalogFilter`, `useOrderCalculator`, `useElementInView`, `useMediaQuery`,
`useIdleTimeout` (auto-logout por inactividad), `usePageviewTelemetry`, `useSearchTelemetry` +
subcarpetas `reports/` y `sales/` (lógica de dominio).

## 6. Schemas de frontend [se mantiene, ahora .ts]
Los forms extienden los schemas base de **`shared/schemas.ts`** (contrato único front/back). Locales:
`schemas/expenses.ts`, `schemas/losses.ts`, `schemas/validators.ts`. Regla: nunca re-declarar campos
comunes; extender la base compartida. Con todo en TS, los tipos de esos schemas fluyen al backend también.

## 7. Theming [se mantiene]
`useTheme` con toggle en `PublicSidebar`/`UserMenu`. `data-theme` en `<html>`, `data-skin="store"` en
el wrapper público. Oscuro por defecto; claro "Daylight" calibrado. Todo componente (incluidos los de
shadcn/ui) consume **tokens** (`bg-bg`, `text-accent`, `border-border`).

## 8. Accesibilidad y rendimiento [se mantiene]
Contraste AA, foco visible, `prefers-reduced-motion`, touch ≥44px. shadcn/ui (sobre Radix) me da gran
parte de la a11y de teclado/ARIA gratis. Imágenes WebP optimizadas (Sharp server-side) + blur-up +
lazy. `useIdleTimeout` para seguridad de sesión en admin.

## 9. Componentes del storefront
Contratos completos en `DESIGN.md` §7: `ProductCard`, `ProductGrid` (bento asimétrico), `Hero`,
`ProductCarousel`, `CategoryChips` (portal+fixed), `BrandStrip`, `QuickAddSheet`, `PublicSidebar`.
Estos son **míos** (marca fuerte); shadcn/ui lo uso para las primitivas de UI (diálogos, menús,
tablas del admin, command palette), no para las piezas de marca del storefront.

## 10. Convenciones [se fijan en v2]
- TS estricto, sin `any`; un componente por archivo, props tipadas.
- Lógica de negocio en hooks/servicios, no en componentes.
- Validación compartida vía `shared/` (una sola fuente de verdad).
- Componentes de `ui/` (shadcn) sin colores crudos: solo tokens.
