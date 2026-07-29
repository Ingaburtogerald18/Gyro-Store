# 03 · Datos y seguridad — Gyro Store

> Este es el documento que más cambia con v2, porque **paso de Firestore (NoSQL) a Postgres (SQL)**.
> El modelo de datos deja de estar orientado a "patrones de acceso" y pasa a ser **relacional de
> verdad**: tablas, claves foráneas, tipos `enum`, `CHECK constraints` y transacciones. La parte de
> seguridad conserva la misma filosofía de v1 (todo por el servidor), reimplementada sobre Supabase.
> Marcador `[v2]` = cambio de esta versión.

---

## PARTE A — Seguridad y autenticación

### A.1 Modelo de acceso [v2 — equivalente a v1]
**RLS en deny-all.** El navegador **solo** usa Supabase **Auth**; todo dato pasa por Express con la
**`service_role key`**, que ignora las RLS. Las políticas RLS de cada tabla quedan restrictivas por
defecto (sin `policy` = sin acceso con la `anon`/`authenticated` key). Es el mismo deny-all de v1,
ahora en Postgres. El schema y las políticas se versionan como **migraciones SQL** en git.

### A.2 Autenticación real [v2]
1. Login en el cliente con **Supabase Auth + proveedor Microsoft (Azure/Entra)** → el staff entra
   con su cuenta `@gyrostorenic.com`. Supabase devuelve un **JWT**.
2. `Authorization: Bearer <JWT>` a la API.
3. El server **verifica el JWT** (con el secret del proyecto Supabase o `auth.getUser(jwt)`).
4. **Verificación de dominio:** solo se aceptan cuentas del tenant `gyrostorenic.com`
   (`INTERNAL_DOMAIN`). Un correo fuera del dominio no es staff. [v2 — antes `gyrostore.com`]
5. **Sync de perfil:** al autenticar por primera vez, creo/actualizo la fila en `profiles`
   (nombre, foto, email) para verlo en Gestión de Usuarios.

> **Compradores:** no se autentican. El storefront es 100% público. Entra existe solo para el staff.

### A.3 Roles [se mantiene el set de v1]
`global_admin · admin · seller · cashier · logistics_admin · logistics_customer`.
- **Multi-rol:** cada usuario tiene un **array** `roles` (columna `text[]` o tabla `user_roles`); el
  "rol primario" se elige por `rolePriority`.
- `global_admin` = acceso total a todo el portal.
- **Resolución del rol por request:** whitelist de env (`ADMIN_EMAILS`/`SELLER_EMAILS`) → si no,
  fila de `profiles` en Postgres (una sola lectura, barata). [v2 — antes era un doc de Firestore]
- `protectedEmail` (primer `ADMIN_EMAILS` o `PROTECTED_ADMIN_EMAIL`) no se puede editar ni borrar.

### A.4 Autorización [se mantiene]
Factory `requireRole(...allowed)` + atajos por portal:
`requireAdmin`, `requireSeller` (admin+seller), `requireCashier` (admin+cashier),
`requireLogisticsAdmin`, `requireLogisticsAny`, `requireAnyRole`.
Deja pasar si el usuario es `global_admin` **o** tiene alguno de los roles permitidos. El
`<RequireRole>` del frontend es solo UX; la barrera real es el servidor.

### A.5 Dónde vive el rol — la decisión de siempre, en términos de Supabase [v2]
En v1 esto era el ADR-006 (custom claims sí/no). En Supabase tengo dos caminos:
- **(a) Leer `profiles` por request** — barato en Postgres, con **efecto inmediato** (cambio un rol
  y aplica en el siguiente request, sin refrescar token). *Es mi opción por defecto.*
- **(b) Meter el rol en el JWT con un *custom access token hook*** de Supabase — elimina la lectura,
  pero el cambio de rol no aplica hasta refrescar el token.

**Decisión v2:** arranco con **(a)** por el efecto inmediato y porque en Postgres el costo es
despreciable. Si algún día el volumen lo justifica, evalúo (b). [v2 · decisión tomada, reversible]

### A.6 Hardening HTTP [se mantiene, con una verificación]
- `helmet`. En v1 tenía `crossOriginOpenerPolicy: 'same-origin-allow-popups'` para no romper el
  popup de login de Firebase. **Con Supabase + Entra, si uso el flujo de redirect, puedo endurecer
  el COOP.** Lo verifico al implementar el login. [v2 · a verificar]
- `compression`, `express.json({limit:'5mb'})`, `sanitizeBody` global, `cors` restringido en prod
  (`corsOrigin` = `RENDER_EXTERNAL_URL`/`CORS_ORIGIN`).
- `app.set('trust proxy', 1)` — sin esto `express-rate-limit` ve la IP del proxy de Render.
- Rate limit: `apiLimiter` global + `telemetryLimiter` solo en POST de escritura de telemetría.

### A.7 Manejo de errores central [se mantiene, + errores de Postgres]
Un handler final: `ZodError`→400 con `issues`; `MulterError`→400; errores con `status` explícito
respetan su código; **errores de Postgres** (violación de FK, `unique`, `CHECK`) se mapean a un
código legible; el resto → 500 genérico (no filtra detalles). 404 de API → `{ error }`. [v2]

---

## PARTE B — Modelo de datos relacional (Postgres)

> En v1 esto eran **25 colecciones Firestore** modeladas por patrones de acceso. En v2 las convierto
> en **tablas Postgres normalizadas**, con relaciones reales. Varias cosas que antes eran arrays
> embebidos (items de una venta, reservas, actividades de un contacto) ahora son **tablas hijas con
> FK** — más limpio de consultar y con integridad garantizada por la base. Los `counters` de v1 los
> reemplazo por **sequences** nativas de Postgres. [v2]
>
> Convención: 🔑 = índice / se consulta por acá · 🧮 = derivado/calculado · FK = clave foránea.

### B.0 Mapa de tablas (de colección Firestore → tabla Postgres)

| Dominio | Tablas Postgres v2 | Venía de (colección v1) |
|---|---|---|
| Catálogo | `catalog_items`, `templates`, `combos` | catalog, templates, combos |
| Inventario | `purchases`, `products`, `migrated_inventory`, `stock_reservations` | idem |
| Ventas | `orders`, `order_items`, `order_reservations` | orders (arrays embebidos → tablas hijas) |
| Facturación | `invoices` | invoices |
| Pedidos públicos | `public_orders`, `public_order_items` | public_orders |
| Cuotas | `installments`, `payments` | installments, payments |
| Comisiones | `commission_adjustments` | commission_adjustments |
| Usuarios | `profiles` (+ `deleted_at` para soft-delete) | users, users_deleted |
| Config | `app_config` | app_config |
| Pérdidas / auditoría | `losses`, `audit_logs` | losses, audit_logs |
| Logística | `logistics_shipments`, `logistics_events` | logistics_shipments (timeline → tabla hija) |
| CRM | `contacts`, `contact_activities`, `followups` | contacts + activities, followups |
| Telemetría | `analytics_events` | analytics_events |
| Feedback | `feedback` | feedback |
| Descuentos | `discount_codes` | discount_codes |

> **`counters` desaparece:** la numeración correlativa (tickets, lotes, etc.) la hago con
> **`sequences` de Postgres**, que son atómicas por diseño. [v2]
> **CRM:** `followups` sigue listado por compatibilidad, pero su destino (unificar en `contacts` o
> llevarlo a algo más interesante) es **decisión abierta** — lo trabajo aparte.

### B.1 Tipos `enum` que definо (integridad desde la base) [v2]
```sql
purchase_status   : 'china' | 'pending' | 'received'
order_status      : 'pending_approval' | 'approved' | 'paid' | 'rejected'
sale_origin       : 'native' | 'migrated'
invoice_status    : 'unlinked' | 'linked'
payment_method    : 'efectivo' | 'transferencia' | 'tarjeta'
loss_category     : 'robo' | 'dano' | 'devolucion' | 'regalias'
feedback_type     : 'bug' | 'idea' | 'product'
app_role          : 'global_admin' | 'admin' | 'seller' | 'cashier' | 'logistics_admin' | 'logistics_customer'
```

### B.2 Catálogo público
**`catalog_items`** — ítems publicados
| Campo | Tipo / nota |
|---|---|
| `id` | PK |
| `template_id` FK → `templates` 🔑 | plantilla de variantes |
| `base_price`, `price` | precio base; override por variante en `variant_mappings` |
| `variant_mappings` | `jsonb` → `"opt / opt": { sku, price? }` (combinación → SKU de bodega) |
| `axis_options` | `jsonb` → qué opciones ofrece por eje |
| `images`, `images_by_color` | `jsonb`/`text[]` → URLs en R2 |
| `published`, `is_promo`, `sort_order` 🔑 | filtros de la lista |

> **Patrón de lectura [v2]:** en v1 traía toda la colección + templates a memoria por los límites de
> Spark. En Postgres puedo consultar directo con `WHERE published = true ORDER BY sort_order`, con
> índices. El caché en memoria queda como optimización **opcional**, no como necesidad.

**`templates`** — plantillas de variantes (ejes/opciones/specs en `jsonb`). Producto cartesiano de
variantes. Se leen junto al catálogo (join o segundo query).

**`combos`** — paquetes con precio propio; se enriquecen en el checkout público.

### B.3 Inventario (bodega) — con contabilidad FIFO
**`purchases`** — lotes de compra (inventario **NATIVO**)
| Campo | Tipo / nota |
|---|---|
| `id` | PK |
| `code` 🔑 | código de compra (FIFO), formato `IN\d+` (ej. IN13) — `unique` |
| `lot` | formato `LT\d+` |
| `status` | `purchase_status` (`china`\|`pending`\|`received`); solo `received` es vendible |
| `purchase_date` 🔑 | orden **FIFO** + filtro por período |
| `quantity`, `quantity_sold`, `quantity_reserved` | `CHECK (quantity_sold + quantity_reserved <= quantity)` 🧮 `available = quantity - sold - reserved` |
| `price_unit`, `shipping_unit` (USD) | costo real × tipo de cambio |

**`products`** — stock por SKU (vista de bodega). `sku`/`code` 🔑 (`unique`), `stock` 🧮 descontado
atómicamente. En Postgres el detalle de catálogo resuelve stock con un `JOIN` normal (adiós al
`where('sku','in',<=10)` por lotes que imponía Firestore). [v2]

**`migrated_inventory`** — inventario histórico (Excel viejo), `origin='migrated'`, costo real ya
dado (no corre FIFO). Aislado de `purchases`.

**`stock_reservations`** — reservas de stock. En v2 es una **tabla con FK** a `orders` y `purchases`,
no un array suelto; la integridad la garantiza la base.

### B.4 Ventas y facturación
**`orders`** — cabecera de la venta
| Campo | Tipo / nota |
|---|---|
| `id` | PK |
| `status` | `order_status` (`pending_approval`→`approved`→`paid` / `rejected`) |
| `sale_origin` | `sale_origin` (`native`\|`migrated`) |
| `seller_uid` FK → `profiles`, `seller_email`, `week_of` 🔑 | pagos agrupados por **semana ISO** |

**`order_items`** — líneas de la venta (**tabla hija**, antes array embebido)
`order_id` FK, `sku`, `price`, `cost` (solo admin), `commission`, `quantity`. [v2]

**`order_reservations`** — enlaza venta ↔ stock reservado (**tabla hija**, antes array embebido)
`order_id` FK, `purchase_id` FK, `code`, `quantity`, `unit_final_usd`. [v2]

> Los costos (`cost`, `commission`) se filtran (`publicItems`) antes de responder a no-admin. Con
> tablas separadas es aún más fácil: el `SELECT` para no-admin simplemente no trae esas columnas.

**`invoices`** — tickets POS (caja). `status` = `invoice_status` (`unlinked`→`linked`). La
vinculación a una venta corre en **transacción** → **1 ticket = 1 uso**. `method` = `payment_method`.
`delivery_fee` es **solo informativo** (se imprime, no entra al total ni a comisiones).

**`public_orders`** + **`public_order_items`** — pedidos del catálogo (checkout WhatsApp). Se crean
**sin auth**; el total se **recalcula en el servidor**. Admin los lista paginando por `created_at`.

### B.5 Soporte
| Tabla | Uso |
|---|---|
| `profiles` (+ `deleted_at`) 🔑 email | roles fuera de whitelist env; soft-delete con papelera de 30 días |
| `app_config` | doc `pricing` (descuentos por volumen), costos fijos |
| `audit_logs` | ediciones/eliminaciones de ventas (motivo, autor, montos antes/después) |
| `losses` | `loss_category` (`robo`\|`dano`\|`devolucion`\|`regalias`) — consumen costo FIFO |
| `installments` / `payments` / `commission_adjustments` | cuotas, pagos, ajustes de saldo |
| `contacts` (+ `contact_activities`) / `followups` | CRM ligero (forma final = decisión abierta) |
| `logistics_shipments` (+ `logistics_events`) | logística China→Nicaragua (timeline + emails) |
| `analytics_events` | telemetría (búsquedas, populares) — consultable con SQL directo |
| `feedback` | `feedback_type` (`bug`\|`idea`\|`product`) |
| `discount_codes` | códigos de descuento |

### B.6 Gastos operativos y "pozos" presupuestados [se mantiene la lógica de v1]
Grupos: `publicidad`, `servicios`, `utiles`, `garantias` (**budgeted:true**) + `varios`
(**budgeted:false**). Los budgeted tienen "pozo" = reserva mensual de costos fijos (publicidad 10%,
servicios 5%, utiles 5%, garantias 5% — **confirmar los % reales**). Mientras el gasto no supere su
pozo **no baja la ganancia** (ya estaba reservado); solo el excedente la reduce. `varios` no tiene
pozo: todo baja la ganancia directo. En Postgres esto lo puedo calcular con una vista.

---

## B.7 Reglas de integridad — ahora repartidas entre base y servidor [v2]

En v1 **toda** la integridad la garantizaba el servidor (Firestore no tiene constraints). En v2
**muevo lo que puedo a la base** (más difícil de romper) y dejo en el servidor lo que necesita lógica:

| Regla | Quién la garantiza en v2 |
|---|---|
| Stock nunca sobrevendido | Servidor (transacción + `SELECT FOR UPDATE`) **+** `CHECK (sold+reserved<=quantity)` en la base |
| Costos privados a no-admin | Servidor (`publicItems` / `SELECT` sin columnas de costo) |
| Transiciones de estado válidas | Servidor (máquina de estados) — el `enum` limita los valores posibles |
| Relación venta↔ítems↔reservas | Base (**FK** con `ON DELETE`), antes eran arrays sin integridad |
| Soft-delete de usuarios | `deleted_at` + vista; cron purga a los 30 días |
| Numeración correlativa | **`sequence`** de Postgres (atómica), antes colección `counters` |
| Auditoría de ventas | Servidor escribe `audit_logs` en edición/eliminación, con motivo y autor |

## B.8 Deuda de datos que arrastro o resuelvo [v2]
- **Se resuelve solo:** race conditions de stock (transacción SQL), agregados de reportes (SQL/vistas
  en vez de cachear), límites de Spark (ya no existen), lecturas `in` por lotes de ≤10 (ya no existen).
- **Queda pendiente:** definir bien índices y `EXPLAIN` de los listados grandes (inventario, ventas)
  cuando el volumen crezca; decidir si algunos reportes van a **materialized view**.
- **CRM:** `followups` vs `contacts` — decisión abierta, la trabajo aparte.
