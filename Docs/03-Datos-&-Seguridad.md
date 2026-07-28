# 03 · Datos y seguridad — Gyro Store

> **Actualizado con el código real** (`shared/schemas.mjs`, `server/config.js`,
> `server/middleware/auth.js`, `docs/05_modelo_datos_firestore.md`, ADRs). Casi todo aquí
> es ahora `[CONFIRMADO]`. Marcadores `[CAMBIO v2?]` = decisión que podés cambiar en el rebuild.

---

## PARTE A — Seguridad y autenticación

### A.1 Modelo de acceso [CONFIRMADO — `firestore.rules`, ADR-003/008]
Deny-all total. El navegador **solo** usa Firebase **Auth**; todo dato pasa por Express con
el Admin SDK, que ignora las rules. Reglas versionadas (`firebase deploy --only firestore:rules`).

### A.2 Autenticación real [CONFIRMADO — `middleware/auth.js`]
1. Login en el cliente (Google/Microsoft/Email) → ID token.
2. `Authorization: Bearer <token>` a la API.
3. `auth.verifyIdToken(token)` en el server.
4. **Verificación de email:** internos `@gyrostore.com` se consideran verificados por dominio;
   externos deben tener `email_verified`. [CONFIRMADO]
5. **Sync de perfil:** al autenticar, sincroniza `photoURL`/`name` del proveedor a Firestore
   (para verlos en Gestión de Usuarios). [CONFIRMADO]

### A.3 Roles [CONFIRMADO — `config.js`]
`global_admin · admin · seller · cashier · logistics_admin · logistics_customer`.
- **Multi-rol:** el usuario tiene un **array** `roles`; el "rol primario" se elige por
  `rolePriority`. [CONFIRMADO]
- `global_admin` = acceso total a todo portal. [CONFIRMADO]
- **Resolución por request:** whitelist env (`ADMIN_EMAILS`/`SELLER_EMAILS`) → si no, doc de
  `users` en Firestore (una sola lectura, deduplicada). [CONFIRMADO — ADR-006]
- `protectedEmail` (primer `ADMIN_EMAILS` o `PROTECTED_ADMIN_EMAIL`) no se puede editar/borrar. [CONFIRMADO]

### A.4 Autorización [CONFIRMADO — `middleware/auth.js`]
Factory `requireRole(...allowed)` + atajos por portal:
`requireAdmin`, `requireSeller` (admin+seller), `requireCashier` (admin+cashier),
`requireLogisticsAdmin`, `requireLogisticsAny`, `requireAnyRole`.
Deja pasar si el usuario es `global_admin` **o** tiene alguno de los roles permitidos.
El `<RequireRole>` del frontend es solo UX; la barrera real es el servidor.

### A.5 Custom claims — la única deuda de auth [CONFIRMADO abierta — ADR-006]
Hoy NO se usan custom claims (decisión deliberada: cambios de rol con efecto inmediato).
Costo: una lectura de `users` por request autenticado. **[CAMBIO v2?]** Si migrás a custom
claims eliminás esa lectura, pero perdés el efecto inmediato (hay que refrescar token). ADR-006
lo difiere "hasta que el costo lo justifique". Decidí en v2.

### A.6 Hardening HTTP [CONFIRMADO — `index.js`]
- `helmet` con dos ajustes finos: `contentSecurityPolicy:false` (se afina al desplegar) y
  `crossOriginOpenerPolicy: 'same-origin-allow-popups'` (si no, rompe `signInWithPopup` de
  Google → `popup-closed-by-user`). **Ojo con esto en el rebuild.** [CONFIRMADO]
- `compression`, `express.json({limit:'5mb'})`, `sanitizeBody` global, `cors` restringido en
  prod (`corsOrigin` = `RENDER_EXTERNAL_URL`/`CORS_ORIGIN`).
- `app.set('trust proxy', 1)` — sin esto, `express-rate-limit` ve la IP del proxy de Render y
  comparte el límite entre todos. [CONFIRMADO]
- Rate limit: `apiLimiter` global + `telemetryLimiter` solo en POST de escritura de telemetría.

### A.7 Manejo de errores central [CONFIRMADO — `index.js`]
Un handler final: `ZodError`→400 con `issues`; `MulterError`→400 (tamaño/tipo); errores con
`status` explícito respetan su código; el resto → 500 con mensaje genérico (no filtra detalles).
404 de API → `{ error: 'Endpoint no encontrado.' }`.

---

## PARTE B — Modelo de datos real (Firestore)

> Fuente única de nombres: `server/config.js → collections`. **25 colecciones.** El modelado
> está orientado a **patrones de acceso del backend** (NoSQL), no a normalización SQL.
> Convención: 🔑 = se consulta por este campo · 🧮 = se calcula/deriva · ⚠️ = costo/riesgo.

### B.0 Todas las colecciones [CONFIRMADO — `config.js`]
`catalog · templates · combos · products · purchases · migrated_inventory · orders ·
public_orders · invoices · users · users_deleted · logistics_shipments · app_config · losses ·
installments · stock_reservations · audit_logs · followups · contacts · payments ·
commission_adjustments · counters · analytics_events · feedback · discount_codes`

### B.1 Catálogo público
**`catalog`** — ítems publicados [CONFIRMADO — doc 05]
| Campo | Notas |
|---|---|
| `templateId` 🔑 | referencia a `templates` |
| `basePrice`/`price` | precio base; override por variante en `variantMappings` |
| `variantMappings` (map) | `"opt / opt": { sku, price? }` → combinación → SKU de bodega |
| `axisOptions` (map) | qué opciones ofrece por eje |
| `images`, `imagesByColor` | URLs en R2 |
| `published`, `isPromo`, `order` 🔑 | filtros de la lista |

> **Patrón clave [CONFIRMADO]:** `GET /api/catalog` trae **toda** la colección + `templates`
> **una vez** y la cachea en memoria (`catalogCache`), filtra en memoria, invalida al escribir.
> ⚠️ Es la mejor optimización para los límites de lectura de **Spark**. Caché por-instancia,
> no expira por tiempo. **[CAMBIO v2?]** si crecés, evaluar caché compartido / plan Blaze.

**`templates`** — plantillas de variantes (ejes/opciones/specs). Producto cartesiano de
variantes. Se leen junto al catálogo (mismo caché). [CONFIRMADO]

**`combos`** — paquetes con precio propio (`getComboEnrichedById` en checkout público). [CONFIRMADO]

### B.2 Inventario (bodega) — con contabilidad FIFO
**`purchases`** — lotes de compra (inventario **NATIVO**) [CONFIRMADO]
| Campo | Notas |
|---|---|
| `code` 🔑 | se consulta por código (FIFO) — formato `IN\d+` (ej. IN13) |
| `lot` | formato `LT\d+` (ej. LT4) |
| `status` 🔑 | `china`\|`pending`\|`received` — solo `received` es vendible |
| `purchaseDate` 🔑 | orden **FIFO** + filtro `?period=YYYY-MM` |
| `quantity`, `quantitySold`, `quantityReserved` 🧮 | `available = quantity − sold − reserved` |
| `priceUnit`, `shippingUnit` (USD) | costo real × tipo de cambio |

**`products`** — stock por SKU (vista de bodega). `code`/`sku` 🔑, `stock` 🧮 descontado
atómicamente al aprobar. Detalle de catálogo resuelve stock con `where('sku','in',<=10)` por
lotes (límite de Firestore). [CONFIRMADO]

**`migrated_inventory`** — inventario histórico (Excel viejo), `origin:'migrated'`, costo real
ya dado (no corre FIFO). Aislado de `purchases`. [CONFIRMADO]

### B.3 Ventas y facturación
**`orders`** — ventas registradas [CONFIRMADO]
| Campo | Notas |
|---|---|
| `status` 🔑 | `pending_approval`→`approved`→`paid` / `rejected` (ver doc 06) |
| `saleOrigin` | `native`\|`migrated` |
| `reservations` (array) | `{ lotId, code, quantity, unitFinalUsd }` — enlaza venta ↔ stock reservado |
| `items` (array) | líneas con precio, **costo (solo admin)**, comisión |
| `sellerUid`/`sellerEmail`, `weekOf` 🔑 | pagos agrupados por **semana ISO** |

> Costos se filtran (`publicItems`) antes de responder a no-admin. [CONFIRMADO]

**`invoices`** — tickets POS (caja). `status`: `unlinked`→`linked`. La vinculación a una venta
corre en `runTransaction` → **1 ticket = 1 uso**. Métodos: Efectivo/Transferencia/Tarjeta.
`deliveryFee` es **solo informativo** (se imprime, no entra al total ni a comisiones). [CONFIRMADO]

**`public_orders`** — pedidos del catálogo (checkout WhatsApp). Se crean **sin auth**; el total
se **recalcula en servidor**. Admin los lista con paginación por cursor sobre `createdAt`. [CONFIRMADO]

### B.4 Soporte
| Colección | Uso |
|---|---|
| `users` / `users_deleted` 🔑 email | roles fuera de whitelist env; papelera de borrados |
| `app_config` | doc `pricing` (descuentos por volumen), costos fijos |
| `audit_logs` | ediciones/eliminaciones de ventas (motivo, autor, montos) |
| `losses` | pérdidas: `robo`\|`daño`\|`devolucion`\|`regalias` (consumen costo FIFO) |
| `installments` / `payments` / `commission_adjustments` | cuotas, pagos, ajustes de saldo |
| `stock_reservations` | reservas de stock |
| `contacts` (+ subcol. `activities`) / `followups` | CRM ligero |
| `logistics_shipments` | logística China→Nicaragua (timeline + emails) |
| `counters` | numeración correlativa |
| `analytics_events` | telemetría (búsquedas, populares) |
| `feedback` | reportes de usuarios: `bug`\|`idea`\|`product` |
| `discount_codes` | códigos de descuento |

### B.5 Gastos operativos y "pozos" presupuestados [CONFIRMADO — `config.js`]
Grupos: `publicidad`, `servicios`, `utiles`, `garantias` (**budgeted:true**) + `varios`
(**budgeted:false**). Los budgeted tienen "pozo" = reserva mensual de costos fijos
(`costosFijos`: publicidad 10%, servicios 5%, utiles 5%, garantias 5%). Mientras el gasto no
supere su pozo **no baja la ganancia** (ya estaba reservado); solo el excedente la reduce.
`varios` no tiene pozo: todo baja la ganancia directo. **[Documentá los % reales que quieras
en v2.]**

---

## B.6 Reglas de integridad (ya garantizadas en el servidor) [CONFIRMADO]
1. **Stock nunca sobrevendido** — `takeFifo` verifica `available ≥ q` DENTRO de `runTransaction`.
2. **Costos privados** — `publicItems` filtra costo/comisión para no-admin.
3. **Transiciones válidas** — venta y lote con máquinas de estado estrictas (doc 06).
4. **Soft-delete** — usuarios a `users_deleted`; cron purga (ver doc 07).
5. **Auditoría** — `audit_logs` en ediciones/eliminaciones de venta, con motivo y autor.

## B.7 Deuda de datos real (de los ADRs/docs internos, no inventada) [CONFIRMADO]
- Paginación por cursor existe (`utils/pagination.js`) pero varios listados aún hacen `.get()`
  completo (inventario, ventas) — adoptar cuando crezca el volumen.
- Caché backend hoy solo cubre catálogo; extensible a `templates`/`app_config`.
- Custom claims (ADR-006) — ver A.5.
