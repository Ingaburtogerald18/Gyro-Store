# 09 · Orden de construcción — Gyro Store v2

> Este documento es mi **plan de armado archivo por archivo**. La idea: construir el repo **de abajo
> hacia arriba**, de modo que cuando cree un archivo, todo lo que necesita **ya exista**. Así lo voy
> haciendo con IA pero **poniendo yo cada pieza en su lugar y entendiéndola** antes de pasar a la
> siguiente. Nada de generar 40 archivos de una y perderme.

## Cómo leo esta lista
- El orden es **de dependencias**: primero lo que no depende de nada (config, tipos), después lo que
  se apoya en eso (middleware, servicios), y al final las rutas y la UI que usan todo.
- Cada fila: **archivo · qué hace · de qué depende**. Si un archivo depende de otro que todavía no
  existe, es señal de que lo estoy haciendo fuera de orden.
- Los hitos son los mismos del doc 08. **No arranco un hito sin cerrar el anterior.**
- Regla personal: **un archivo, lo entiendo, commit chico, siguiente.**

---

## HITO 0 — Fundación (nada funciona sin esto)

### 0.1 Configuración de proyecto y entorno
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 1 | `.gitignore` | ignora `node_modules`, builds, `.env*`, logs | — |
| 2 | `.env.example` | plantilla de TODAS las variables (doc 07) | — |
| 3 | `package.json` (root) | deps del backend + scripts (`dev`, `build`, `db:migrate`…) | — |
| 4 | `tsconfig.json` (root) | TS + ESM para el server | 3 |
| 5 | `render.yaml` | infra as code (build/start/health) | 3 |

### 0.2 Base de datos (Supabase) — el schema antes que el código
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 6 | `supabase/migrations/0001_init.sql` | tipos `enum` + tablas núcleo (`profiles`, `catalog_items`, `templates`, `combos`) + **RLS deny-all** | doc 03 |
| 7 | `supabase/migrations/0002_inventory.sql` | `purchases`, `products`, `migrated_inventory`, `stock_reservations` + `CHECK`s | 6 |
| 8 | `supabase/migrations/0003_sales.sql` | `orders`, `order_items`, `order_reservations`, `invoices`, `public_orders(+items)` | 7 |
| 9 | `supabase/migrations/0004_support.sql` | `app_config`, `losses`, `audit_logs`, `installments`, `payments`, `commission_adjustments`, `logistics_*`, `contacts(+activities)`, `followups`, `analytics_events`, `feedback`, `discount_codes` + sequences | 8 |
| 10 | `supabase/seed.sql` | data mínima de arranque para dev | 9 |

> Puedo empezar la migración 0001 con solo lo del storefront y crecerla por hito. Lo importante es que
> **la tabla exista antes que la ruta que la usa.**

### 0.3 Núcleo del backend (lo que todo el resto importa)
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 11 | `server/config.ts` | lee y valida env (roles, currency, R2, Supabase…) | 2 |
| 12 | `server/supabase.ts` | init cliente `service_role`; exporta `{ db, auth }` | 11 |
| 13 | `shared/schemas.ts` | schemas Zod compartidos front/back (contrato único) | — |
| 14 | `server/utils/asyncHandler.ts` | envuelve handlers async | — |
| 15 | `server/utils/logger.ts` | log JSON estructurado | — |
| 16 | `server/utils/dbError.ts` | mapea errores de Postgres → códigos legibles | — |
| 17 | `server/utils/sanitize.ts` | `sanitizeBody` | — |
| 18 | `server/utils/pagination.ts` | cursor sobre `created_at` | — |
| 19 | `server/utils/upload.ts` | multer + `fileFilter` de mimetype | — |
| 20 | `server/middleware/errorHandler.ts` | handler central (Zod/Multer/PG/status/500) | 15,16 |
| 21 | `server/middleware/rateLimiter.ts` | `apiLimiter` + `telemetryLimiter` | — |
| 22 | `server/middleware/auth.ts` | verifica JWT Supabase, resuelve rol, `requireRole` + atajos | 11,12 |

### 0.4 Arranque + primer endpoint
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 23 | `server/routes/health.ts` | `GET /api/health` | — |
| 24 | `server/index.ts` | monta Express, cadena de middleware, sirve Remix build | 14–23 |

**✅ Fin de Hito 0:** `npm run dev` levanta, `/api/health` en verde, migración inicial aplicada en el
Supabase de dev, y puedo autenticar con Entra y ver el rol resuelto.

---

## HITO 1 — Storefront (lo mínimo para abrir la tienda)

### 1.1 Backend público
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 25 | `server/services/config.ts` | expone currency, exchangeRate, whatsapp… | 11 |
| 26 | `server/routes/config.ts` | `/api/config` | 25 |
| 27 | `server/services/catalog.ts` | query de catálogo (+ caché opcional) | 12 |
| 28 | `server/routes/catalog.ts` | `/api/catalog` (público) | 27,13 |
| 29 | `server/services/combos.ts` | enriquecer combos | 12 |
| 30 | `server/routes/combos.ts` | `/api/combos` | 29 |
| 31 | `server/services/orders.ts` | crea `public_orders` con **recálculo de total** | 12,13 |
| 32 | `server/routes/orders.ts` | `POST /api/orders/public` (sin auth) | 31 |
| 33 | `server/services/crm.ts` | alta de contacto/lead | 12 |
| 34 | `server/routes/contact.ts` | `/api/contact` (público) | 33,13 |

### 1.2 Frontend base
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 35 | `frontend/package.json` + `tsconfig` | deps del front | — |
| 36 | `frontend/tailwind.config` + `app/styles` | Tailwind v4 + **tokens de DESIGN.md** | DESIGN.md |
| 37 | `frontend/components.json` + `app/components/ui/*` | init de **shadcn/ui** (primitivas base) | 36 |
| 38 | `frontend/app/lib/supabase.client.ts` | cliente de Auth (solo login) | — |
| 39 | `frontend/app/store/api/baseApi.ts` | RTK Query con `Bearer <JWT>` | 38 |
| 40 | `frontend/app/store/{store,hooks}.ts` + `slices` | store, cartSlice, uiSlice, authSlice | 39 |
| 41 | `frontend/app/root.tsx` + `hooks/useTheme.ts` | layout raíz + theming dark/light | 36 |

### 1.3 Storefront (páginas y componentes de marca)
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 42 | `store/api/catalogApi.ts` | slice del catálogo | 39 |
| 43 | `components/{catalog,product}/*` | `ProductCard`, `ProductGrid`, `Hero`… (DESIGN.md §7) | 37,42 |
| 44 | `routes/_index.tsx` | home | 43 |
| 45 | `routes/producto.$id.tsx` | PDP (variantes, precio, fotos) | 43 |
| 46 | `routes/combo.$id.tsx` | combo | 43 |
| 47 | `components/cart/*` + carrito → WhatsApp | mensaje pre-armado `wa.me/...` | 40 |
| 48 | `routes/contacto.tsx` | formulario → `/api/contact` | 34 |
| 49 | `routes/login.tsx` | login con Entra (Supabase) | 38 |

**✅ Fin de Hito 1:** un comprador entra, navega el catálogo real con fotos, arma carrito y pide por
WhatsApp; el staff puede loguearse. La tienda ya podría abrir.

---

## HITO 2 — Inventario y catálogo admin

| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 50 | `server/services/inventory.ts` | FIFO: `reserveForItems`, `takeFifo`, `consumeReservation` (TX SQL) | 12 |
| 51 | `server/routes/inventory.ts` | `/api/inventory` (admin) | 50,22 |
| 52 | `server/services/storage.ts` | Sharp→WebP, subir a R2 por hash, limpiar huérfanos | 11 |
| 53 | `server/routes/templates.ts` | `/api/templates` (admin) | 22 |
| 54 | `server/routes/catalog.ts` (admin) | CRUD de catálogo + subida de imágenes | 52,53 |
| 55 | Frontend `admin.tsx` (layout) + `RequireRole` | shell del back-office (UX de rol) | 41,37 |
| 56 | `store/api/{inventoryApi,catalogAdmin}` | slices admin | 39 |
| 57 | `routes/admin.inventario.tsx` | bodega / FIFO / KPIs | 56 |
| 58 | `routes/admin.catalogo.tsx` | modo edición (dnd-kit, CRUD, imágenes, promo) | 56 |

**✅ Fin de Hito 2:** cargo compras, las recibo (stock ↑ por transacción), y edito el catálogo con
imágenes optimizadas.

---

## HITO 3 — Ventas y facturación

| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 59 | `server/services/commission.ts` | escala progresiva (documentar tramos) | — |
| 60 | `server/services/sales.ts` + `routes/sales/*` | register/quotes/manage/payments/list/sellerPortal | 50,59 |
| 61 | `server/services/invoice.ts` | POS, numeración por **sequence**, vincular 1:1 (TX) | 12 |
| 62 | `server/routes/invoices.ts` | `/api/invoices` | 61 |
| 63 | `server/services/installments.ts` + `routes/installments.ts` | cuotas + pagos | 12 |
| 64 | Frontend `store/api/{salesApi,invoicesApi,installmentsApi}` | slices | 39 |
| 65 | `routes/admin.ventas.tsx` | cotizador, aprobar FIFO, pago semanal | 64 |
| 66 | `routes/admin.facturacion.tsx` | tickets 80mm (react-to-print) | 64 |
| 67 | `routes/admin.cuotas.tsx` | installments | 64 |

**✅ Fin de Hito 3:** el ciclo de venta completo (registrar → aprobar → facturar → pagar comisión).

---

## HITO 4 — Reportes, gastos, logística, CRM, feedback, telemetría

| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 68 | `server/services/reports.ts` | KPIs con **SQL/vistas**, pérdidas, gastos con pozos, export | 12 |
| 69 | `server/routes/reports.ts` | `/api/reports` | 68 |
| 70 | `server/services/logistics.ts` + `routes/logistics.ts` | envíos, timeline (`logistics_events`), email M365 | 12,73 |
| 71 | `server/routes/{feedback,discount-codes,search-events}.ts` | dominios de soporte | 22 |
| 72 | `server/routes/users.ts` | gestión + soft-delete (`deleted_at`) + invitación email | 22,73 |
| 73 | `server/services/email.ts` | Microsoft 365 (Graph o SMTP) | 11 |
| 74 | `server/services/crm.ts` (ampliado) + `routes/{contacts,followups}.ts` | **según decisión de CRM (abierta)** | 12 |
| 75 | Frontend `routes/admin.{reportes,logistica,usuarios,feedback,busquedas,codigos-descuento,crm}.tsx` | portales admin restantes | 64 |

**✅ Fin de Hito 4:** back-office completo. (El CRM queda en la forma que decida en su momento.)

---

## HITO 5 — Polish y QA de lanzamiento

| # | Tarea | Nota |
|---|---|---|
| 76 | `scripts/seed.ts` parametrizable | reemplaza los seeds sueltos de v1 |
| 77 | `server/cron/*` | purga papelera 30 días, limpieza de huérfanos R2 |
| 78 | Auditoría a11y/perf móvil | contraste AA, `prefers-reduced-motion`, peso de página |
| 79 | Endurecer COOP en helmet | si el login de Entra usa redirect (doc 03 §A.6) |
| 80 | Checklist de secretos + `/api/health` verde en prod | Supabase de prod, keys rotadas |

---

## Reglas transversales mientras construyo (para no romper el orden)
1. **La tabla antes que la ruta.** Ninguna ruta usa una tabla que no esté en una migración aplicada.
2. **El servicio antes que la ruta.** La ruta es fina; la lógica vive en `services/`.
3. **El schema Zod antes que el handler.** Valido en el borde siempre.
4. **Nada del cliente toca la base.** Si me tienta, es señal de que falta un endpoint.
5. **Un archivo por commit** cuando pueda; el mensaje dice qué dominio toca.
6. **Si el código y el doc discrepan, actualizo el doc en el mismo commit** (regla de oro del 00).
