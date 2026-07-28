# 04 · Backend (API) — Gyro Store

> **Actualizado con el código real** (`server/index.js`, `server/routes/*`, `middleware/auth.js`).
> Los 19 grupos de rutas y el middleware son `[CONFIRMADO]`. El detalle interno de algunos
> endpoints es `[PROPUESTO]` (no leí todos los handlers) — verificá contra el código.

---

## 1. Convenciones [CONFIRMADO]
- **Prefijo:** `/api`. Todo lo no-API lo sirve Remix (SSR). Health: `GET /api/health`.
- **Auth:** `Authorization: Bearer <Firebase ID token>` en lo no público.
- **Errores:** handler central. `ZodError`→400 `{ error, issues }`; `MulterError`→400;
  status explícito respetado; resto→500 genérico. 404 API → `{ error }`.
- **Validación:** Zod desde `shared/schemas.mjs` (contrato compartido front/back) + schemas
  de servidor. Subidas con `multer` + `fileFilter` de mimetype (`utils/upload.js`).
- **Sanitización:** `sanitizeBody` global. **Rate limit:** `apiLimiter` global.
- **Paginación:** por cursor sobre `createdAt` en listados públicos (`utils/pagination.js`).

## 2. Cadena de middleware [CONFIRMADO — `index.js`]
```
helmet(COOP relajado) → compression → express.json(5mb) → urlencoded → sanitizeBody →
cors(prod restringido) → morgan(logger) → apiLimiter → [requireRole/atajos] → handler →
errorHandler central
```
`trust proxy = 1` (Render detrás de proxy).

## 3. Atajos de rol [CONFIRMADO — `middleware/auth.js`]
`requireAdmin` · `requireSeller` (admin+seller) · `requireCashier` (admin+cashier) ·
`requireLogisticsAdmin` · `requireLogisticsAny` · `requireAnyRole`. `global_admin` pasa siempre.

---

## 4. Los 19 grupos de rutas montados [CONFIRMADO — `index.js`]

| Ruta base | Dominio | Notas |
|---|---|---|
| `GET /api/health` | sistema | healthcheck Render |
| `/api/auth` | autenticación | `/me` usa `requireAnyRole` |
| `/api/config` | config pública | expone currency, exchangeRate, whatsapp, etc. |
| `/api/catalog` | catálogo público | trae todo + templates, **cachea en memoria** |
| `/api/templates` | plantillas de variantes | admin |
| `/api/combos` | paquetes/combos | público (checkout) + admin |
| `/api/orders` | pedidos | incluye `public_orders` del checkout WhatsApp |
| `/api/contact` | formulario de contacto | público (`contactSchema`) |
| `/api/inventory` | bodega / FIFO | admin |
| `/api/sales` | ventas | **sub-módulos** (ver §5) |
| `/api/invoices` | facturación POS | caja / admin |
| `/api/reports` | reportes | KPIs, pérdidas, gastos, export |
| `/api/users` | usuarios | admin; papelera `users_deleted` |
| `/api/logistics` | Gyro Logistics | timeline + emails |
| `/api/installments` | cuotas | `installmentSchema` |
| `/api/followups` | seguimientos CRM | (migrado hacia `contacts`) |
| `/api/contacts` | CRM contactos + activities | |
| `/api/feedback` | feedback de usuarios | `bug`\|`idea`\|`product` |
| `/api/discount-codes` | códigos de descuento | |
| `/api/search-events` | telemetría | `telemetryLimiter` solo en POST |

> **Nota de rediseño [CAMBIO v2?]:** hay `followups` **y** `contacts` (hubo una migración,
> `scripts/migrations/migrateFollowupsToContacts.js`). En el rebuild podés **unificar en
> `contacts`** y jubilar `followups`.

---

## 5. Ventas — sub-módulos [CONFIRMADO — `routes/sales/*`]
`routes/sales/` está partido (buena señal SR): `index.js` (router), `register.js` (registrar
→ reserva stock), `quotes.js` (cotizador), `manage.js` (approve/reject/edit/delete),
`payments.js` (pagar / pagar-semana), `list.js` (listados), `sellerPortal.js` (portal del
vendedor), `helpers.js`. Máquina de estados en doc 06.

Endpoints núcleo (de las máquinas de estado):
- `POST /api/sales` · seller · registra venta → **reserva stock** (`runTransaction`).
- `POST /api/sales/:id/approve` · admin · consume reserva → vendido; **fija comisión/utilidad**.
- `POST /api/sales/:id/reject` · admin · libera reserva (exige motivo).
- `PUT /api/sales/:id` · admin · re-reserva + recalcula comisión + `audit_logs`.
- `DELETE /api/sales/:id` · admin · libera/devuelve stock según estado (exige motivo).
- `POST /api/sales/:id/pay` · `/pay-week` · admin · liquidación (por semana ISO).

## 6. Checkout público [CONFIRMADO — ADR-004]
`POST /api/orders/public` · sin auth · recibe el pedido del catálogo, **recalcula el total en
servidor**, crea `public_orders`, y el frontend arma el **link de WhatsApp**. El cierre/cobro
es manual; luego el admin registra la venta real (que sí descuenta stock).

## 7. Servicios internos [CONFIRMADO — `server/services/*`]
`auth · balance · catalog · combos · commission · config · crm · email · installments ·
inventory · invoice · logistics · orders · reports · sales · storage · telemetry`.

- **`storage` (R2):** `@aws-sdk/client-s3`; optimiza con **Sharp** a **WebP**, nombra por
  **hash de contenido** (subidas idempotentes, sin duplicados); limpia huérfanos al borrar
  (ADR-009). → Ya hace lo que tu `resize-images.ps1` hacía a mano.
- **`commission`:** escala progresiva; se fija al aprobar, se recalcula al editar.
- **`inventory`:** FIFO — `reserveForItems`, `consumeReservation`, `reserveForMigratedItems`,
  `takeFifo`, todo en `runTransaction`.
- **`email`:** nodemailer SMTP; invitaciones + notificaciones de logística.

## 8. Utilidades [CONFIRMADO — `server/utils/*`]
`asyncHandler · logger` (JSON estructurado en prod) `· pagination` (cursor) `· sanitize ·
upload` (multer + fileFilter) `· validators · zodError`.

## 9. Lo que faltaría documentar endpoint-por-endpoint [PROPUESTO]
No leí cada handler. Para el rebuild conviene extraer la firma exacta (método, path, rol,
schema Zod, respuesta) de cada `routes/*.js`. Si querés, en el siguiente paso genero esa
tabla completa leyendo archivo por archivo.
