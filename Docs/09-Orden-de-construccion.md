# 09 · Orden de construcción — Gyro Store v2

> Este documento es mi **plan de armado archivo por archivo**. La idea: construir el repo **de abajo
> hacia arriba**, de modo que cuando cree un archivo, todo lo que necesita **ya exista**. Así lo voy
> haciendo con IA pero **poniendo yo cada pieza en su lugar y entendiéndola** antes de pasar a la
> siguiente. Nada de generar 40 archivos de una y perderme.

## Cómo usar esta lista con tu IA Local (Paso a Paso)
Como tu IA local generará los archivos uno por uno, **NO le pidas que haga todo el hito de golpe**. Usa esta estrategia:
1. Pásale el contexto del proyecto (usando el documento 12 o el resumen de arquitectura).
2. Dile: *"Vamos a trabajar en el Hito 0. Genera únicamente el código para el archivo #1 (`.gitignore`)."*
3. Una vez que te dé el archivo #1, cópialo en tu proyecto.
4. Luego dile: *"Perfecto, ahora genera el archivo #2 (`.env.example`)."*
5. Si un archivo depende de otro (mira la columna "Depende de"), asegúrate de que tu IA tenga en cuenta los archivos anteriores.

## Reglas de la lista
- El orden es **de dependencias**: primero lo que no depende de nada (config, tipos), después lo que
  se apoya en eso (middleware, servicios), y al final las rutas y la UI que usan todo.
- Cada fila: **archivo · qué hace · de qué depende**. 
- Los hitos siguen al doc 08. **No arranco un hito sin cerrar el anterior.**
- Regla personal: **un archivo, lo pruebo, lo entiendo, hago commit, y le pido el siguiente a la IA.**

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
| 8 | `supabase/migrations/0003_sales.sql` | `orders`, `order_items`, `invoices`, `public_orders(+items)` (creó también `order_reservations`, duplicado de `stock_reservations`/0002 — eliminado en 0008, doc 09 ítem 60) | 7 |
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
| 49.5 | `supabase/migrations/00XX_appconfig.sql` + `server/services/finance.ts` | tablas config del doc 11 (tiers F/U, 7 pozos, márgenes, comisión, mayoreo, salary, tasa) + cálculos de costeo/PVP | doc 11 |
| 50 | `server/services/inventory.ts` | FIFO: `reserveForItems`, `takeFifo`, `consumeReservation` (TX SQL) | 12 |
| 51 | `server/routes/inventory.ts` | `/api/inventory` (admin) — al recibir compra: costo real, F/U, pozos, coste final (doc 11 §1-2) | 50,49.5,22 |
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
| 59 | `server/services/commission.ts` | cadena utilidad→salary→comisión→ganancia + escala + mayoreo; **snapshot al aprobar** (doc 11 §4-5) | 49.5 |
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

## HITO 4 — Reportes, gastos, logística, feedback, telemetría

| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 68 | `server/services/reports.ts` | KPIs con **SQL/vistas**, pérdidas, gastos con pozos, export | 12 |
| 69 | `server/routes/reports.ts` | `/api/reports` | 68 |
| 70 | `server/services/email.ts` | Microsoft 365 (Graph o SMTP) | 11 |
| 71 | `server/services/logistics.ts` + `routes/logistics.ts` | envíos, timeline (`logistics_events`), email M365 | 12,70 |
| 72 | `server/routes/{feedback,discount-codes,search-events}.ts` | dominios de soporte | 22 |
| 73 | `server/routes/users.ts` | gestión + soft-delete (`deleted_at`) + invitación email | 22,70 |
| 74 | Frontend `routes/admin.{reportes,logistica,usuarios,feedback,busquedas,codigos-descuento}.tsx` | portales admin restantes | 64 |

**✅ Fin de Hito 4:** back-office operativo completo (sin el CRM, que es el hito propio de abajo).

---

## HITO 5 — Polish y QA de lanzamiento

| # | Tarea | Nota |
|---|---|---|
| 75 | `scripts/seed.ts` parametrizable | reemplaza los seeds sueltos de v1 |
| 76 | `server/cron/*` | purga papelera 30 días, limpieza de huérfanos R2 |
| 77 | Auditoría a11y/perf móvil | contraste AA, `prefers-reduced-motion`, peso de página |
| 78 | Endurecer COOP en helmet | si el login de Entra usa redirect (doc 03 §A.6) |
| 79 | Checklist de secretos + `/api/health` verde en prod | Supabase de prod, keys rotadas |

**✅ Fin de Hito 5:** listo para lanzar (ver doc 08 §8). El CRM de abajo puede ir post-lanzamiento.

---

## HITO 6 — CRM y WhatsApp (doc 10) — puede ir post-lanzamiento

> Por fases, para no depender de Meta al arrancar. **CRM-A entrega valor solo**, aunque cargue todo a mano.

### Fase CRM-A — base de datos + panel (sin Meta)
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 80 | `supabase/migrations/00XX_crm.sql` | tablas `follow_ups`, `whatsapp_conversations`, `whatsapp_messages` + enums + `contact_id`/`phone` en `orders`/`public_orders` | doc 10 §5 |
| 81 | `server/services/crm.ts` (ampliado) | contactos, follow-ups, **ficha 360** (JOIN pedidos+ventas+chat) | 80 |
| 82 | `server/routes/crm.ts` (parte admin) | `/api/crm/contacts/:id`, `/follow-ups`, `/conversations` | 81,22 |
| 83 | Frontend `store/api/crmApi.ts` | slice del CRM | 39 |
| 84 | `routes/admin.crm.tsx` — Ficha 360 + Agenda (kanban) | vistas base con shadcn/ui | 83 |

### Fase CRM-B — WhatsApp Cloud API (necesita número dedicado + setup Meta)
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 85 | `server/services/whatsapp.ts` | verificar firma, enviar mensaje/plantilla (Graph API), parsear webhook | 11 |
| 86 | `server/routes/crm.ts` (webhook) | `GET/POST /api/crm/webhook` (verify token + firma de Meta) | 85 |
| 87 | `routes/admin.crm.tsx` — Inbox | bandeja tipo WhatsApp Web para chats `needs_human`, responder | 84,85 |

### Fase CRM-C — bot y automatización
| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 88 | `server/services/whatsapp.ts` (bot) | FAQ, ruteo por origen (ads/links), handover a humano | 86 |
| 89 | `server/cron/followupsOutbound.ts` | cron diario: `follow_ups` de hoy → plantilla saliente | 81,85 |

### Fase CRM-D (opcional, futuro)
| # | Tarea | Nota |
|---|---|---|
| 90 | Meter **n8n** self-hosted | solo si los flujos se complican; consume los endpoints ya hechos |

---

## HITO 7 — Cuentas de Comprador y Lealtad (doc 14) [transversal, no bloquea el lanzamiento]

> Capa opcional sobre el storefront ya construido. Depende de que `contacts` y `discount_codes` ya
> existan (Hito 4/6), y de `orders`/`public_orders` (Hito 1/3). Puede ir post-lanzamiento o en
> paralelo si hay ancho de banda (doc 08 §7).

| # | Archivo | Qué hace | Depende de |
|---|---|---|---|
| 91 | `supabase/migrations/00XX_accounts.sql` | `contacts.auth_user_id` (FK nullable `unique` → `auth.users`) + campos UTM en `contacts`/`analytics_events` + extensión de `discount_codes` (`campaign`, `contact_id`, `single_use`, `expires_at`, `redeemed_at`, `channel`) + campo de aprobación de mayorista + estado de pedido de cara al cliente en `orders`/`public_orders` | `contacts` (80), `discount_codes` (9), `orders`/`public_orders` (8) |
| 92 | `shared/schemas.ts` (ampliado) | schemas Zod de OTP/registro, "mis pedidos", "mis códigos" | 13 |
| 93 | `server/middleware/requireCustomer.ts` | verifica JWT de comprador, resuelve a **contacto** (nunca `AppRole`) | 91, 12 |
| 94 | `server/services/account.ts` | OTP (solicitar/verificar), perfil, "mis pedidos" (atribución por teléfono) | 91, 92, 12 |
| 95 | `server/routes/account.ts` | `/api/account` (otp, verify, me, orders, codes) | 94, 93 |
| 96 | `server/services/loyalty.ts` | contador de compras entregadas, generación de código cada 3, ciclo de vida (uso/vencimiento) | 91, 92, 12 |
| 97 | `server/routes/discount-codes.ts` (ampliado) | validar/canjear código de lealtad y de campaña | 96, 92 |
| 98 | `server/services/crm.ts` (ampliado) | panel de intención (orden por "a quién llamar hoy"), señales de intención sobre `analytics_events` | 91, 80 |
| 99 | `server/routes/crm.ts` (ampliado) | endpoints del panel de clientes/intención + gestión de códigos de campaña | 98, 97 |
| 100 | Frontend `store/api/{accountApi,loyaltyApi}.ts` | slices RTK del dominio | 39 |
| 101 | Frontend `routes/mi-cuenta.*.tsx` | login OTP, resumen, mis pedidos, mis códigos, `[PROPUESTO]` wishlist | 100 |
| 102 | Frontend `routes/admin.crm.clientes.tsx` + `admin.crm.campanas.tsx` | panel de intención + gestión de campañas | 100 |

**✅ Fin de Hito 7:** un comprador puede crear cuenta con OTP, ver sus pedidos y su progreso de
lealtad; el staff ve el panel de intención y gestiona códigos de campaña. No bloquea "listo para
lanzar" (doc 08 §8).

---

## Reglas transversales mientras construyo (para no romper el orden)
1. **La tabla antes que la ruta.** Ninguna ruta usa una tabla que no esté en una migración aplicada.
2. **El servicio antes que la ruta.** La ruta es fina; la lógica vive en `services/`.
3. **El schema Zod antes que el handler.** Valido en el borde siempre.
4. **Nada del cliente toca la base.** Si me tienta, es señal de que falta un endpoint.
5. **Un archivo por commit** cuando pueda; el mensaje dice qué dominio toca.
6. **Si el código y el doc discrepan, actualizo el doc en el mismo commit** (regla de oro del 00).
