# 06 · Dominios funcionales — Gyro Store

> Las **8 fases** del sistema, cada una como un dominio. Los nombres y flujos macro están
> `[CONFIRMADO]` por el README; el detalle interno es `[PROPUESTO]` para que lo ajustes.

---

## Fase 1 · Fundación [CONFIRMADO]
Scaffolding, autenticación (Google/Email/Microsoft), layouts base (storefront + admin).

**Entregables v2:**
- Monolito Express + Remix corriendo con `npm run dev` (concurrently). [CONFIRMADO scripts]
- Auth funcionando end-to-end (login cliente → verify servidor → rol).
- Dos pieles de layout (store / admin) con theming.
- Middleware base: `requireAuth`, `requireRole`, `validate`, `asyncHandler`, `errorHandler`.

---

## Fase 2 · Catálogo público [CONFIRMADO]
Grid con filtros/búsqueda, detalle (PDP), carrito + checkout WhatsApp, contacto.

**Flujo del comprador:**
```
Home ──▶ filtra/busca ──▶ PDP (variantes, precio, fotos) ──▶ Agregar al carrito (local)
                                                               └──▶ Carrito ──▶ "Pedir por WhatsApp"
                                                                        (arma mensaje con items + total)
```
- Carrito **local**, sin backend. El botón WhatsApp abre `wa.me/<WHATSAPP_NUMBER>` con el
  mensaje pre-armado. [CONFIRMADO concepto]
- Contacto captura lead → `contacts` (CRM). [PROPUESTO enlace]
- **Regla:** el catálogo público consume **DTO recortado** (sin costos). [MEJORA]

---

## Fase 3 · Inventario [CONFIRMADO]
Compras a China, flujo `china → pending → received`, KPIs, inventario actual.

**Máquina de estados de compra:**
```
[china] ──(en tránsito)──▶ [pending] ──(recibido en bodega)──▶ [received]
                                                                   │
                                              incrementa stock en catalog (TRANSACCIÓN) [MEJORA]
```
- KPIs: unidades en tránsito, valor de inventario, productos bajo mínimo. [PROPUESTO detalle]
- **Invariante:** el stock solo cambia por eventos (compra recibida ↑, venta aprobada ↓),
  nunca por edición manual libre (o si se permite, queda auditado). [MEJORA]

---

## Fase 4 · Ventas [CONFIRMADO]
Cotizador en vivo, comisiones (escala progresiva), aprobación FIFO, pago semanal.

**Flujo:**
```
Seller: cotizador en vivo (items + precio) ──▶ registra venta [cotizacion]
Admin:  aprueba en orden FIFO ──▶ [aprobada] + decremento de stock ATÓMICO [MEJORA]
Sistema: calcula comisión por ESCALA PROGRESIVA
Admin:  liquidación SEMANAL ──▶ [pagada]
```
- **Comisión escala progresiva** [CONFIRMADO]: definir tramos (ej.: 0–X → a%, X–Y → b%…).
  *Documentá los tramos reales acá cuando los definas.* [PROPUESTO valores]
- **Aprobación FIFO** [CONFIRMADO]: se aprueban en orden de llegada (evita que dos vendedores
  peleen el mismo stock; el primero en la cola gana). Ligado a la transacción de stock.
- **Pago semanal** [CONFIRMADO]: corte semanal de comisiones aprobadas.

---

## Fase 5 · Facturación [CONFIRMADO]
Tickets POS 80mm (react-to-print), vinculación ticket ↔ venta.

- Ticket de **80mm** imprimible con `react-to-print`. [CONFIRMADO]
- Cada ticket referencia su `saleId` (1:1 con la venta). [CONFIRMADO]
- **[PROPUESTO]** numeración correlativa (`0001`, `0002`…), reimpresión, datos del negocio
  en encabezado.

---

## Fase 6 · Reportes [CONFIRMADO]
KPIs, gráficos Recharts, pérdidas, exportación Excel/PDF.

- Dashboard con KPIs (ventas, utilidad, pérdidas) y gráficos Recharts. [CONFIRMADO]
- Exportación **Excel/PDF**. [CONFIRMADO]
- **[MEJORA]** decidir si los agregados se calculan on-the-fly o se materializan
  (`metrics/daily`) para performance.

---

## Fase 7 · Usuarios + Logística [CONFIRMADO]

### Usuarios
- CRUD con **papelera de 30 días** (soft-delete + cron de purga). [CONFIRMADO]
- Invitación por email (link con `APP_URL`). [CONFIRMADO]
- `PROTECTED_ADMIN_EMAIL` no se puede degradar/borrar. [CONFIRMADO]
- **[MEJORA]** el cambio de rol setea **custom claim** (no solo Firestore).

### Gyro Logistics
- Gestión de envíos con **timeline** de estados y **emails** de notificación. [CONFIRMADO]
- Roles `logistics_admin` (gestiona) y `logistics_customer` (sigue su envío). [CONFIRMADO]

---

## Fase 8 · Polish [CONFIRMADO]
Modo edición del catálogo (drag & drop, CRUD de productos, imágenes, promo), cron de limpieza.

- **Modo edición del catálogo:** reordenar con **dnd-kit**, CRUD de productos, subir/gestionar
  imágenes, marcar promos. [CONFIRMADO]
- **Cron de limpieza:** purga papelera 30 días (y lo que agregues). [CONFIRMADO]

---

## Dominio transversal · CRM / Seguimientos [CONFIRMADO existe]
- `contacts` + `activities` para captar y dar seguimiento a leads de Instagram/Facebook/
  WhatsApp con cadencia de multi-touch. [CONFIRMADO colección; cadencia PROPUESTA]
- Pipeline por `stage` (nuevo → contactado → interesado → cerrado). [PROPUESTO]
- **[PROPUESTO]** integrar con n8n / Notion como discutiste, o mantenerlo nativo en el admin.

---

## Matriz dominio × rol (quién hace qué) [PROPUESTO — ajustar]

| Dominio | global_admin | admin | seller | cashier | logistics_admin | logistics_customer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Catálogo (edición) | ✅ | ✅ | — | — | — | — |
| Inventario | ✅ | ✅ | — | — | — | — |
| Ventas | ✅ | ✅ (aprueba) | ✅ (crea) | — | — | — |
| Facturación | ✅ | ✅ | — | ✅ | — | — |
| Reportes | ✅ | ✅ | ver propios | — | — | — |
| Usuarios | ✅ | ✅ | — | — | — | — |
| Logística | ✅ | ✅ | — | — | ✅ | ver el suyo |
| CRM | ✅ | ✅ | ✅ | — | — | — |

---

## ADENDA — Dominios reales que el README no listaba [CONFIRMADO en código]

> Al leer el repo aparecieron dominios más allá de las "8 fases". Documentados acá para que
> el rebuild los contemple.

### Combos (`/api/combos`, `combos`)
Paquetes con precio propio; se enriquecen en el checkout público (`getComboEnrichedById`).

### Órdenes públicas / checkout WhatsApp (`public_orders`)
El catálogo arma el pedido → `POST /api/orders/public` (sin auth) **recalcula el total en
servidor** → genera link de WhatsApp. Cierre y cobro manuales; luego se registra la venta real
que descuenta stock. (ADR-004.) Doble entrada posible (pedido público vs. venta) = trade-off aceptado.

### Cuotas / Installments (`/api/installments`, `installments` + `payments`)
Ventas fraccionadas: 2–24 cuotas, monto por cuota, fecha de primer pago, pagos parciales
(`efectivo`/`transferencia`/`tarjeta`), notas. Saldo y ajustes en `commission_adjustments`.

### Pérdidas (`losses`)
Categorías: `robo`, `daño`, `devolucion`, `regalias`. **Consumen costo FIFO** (por eso no se
edita producto/cantidad de una pérdida — no es reversible con exactitud). Entran a reportes.

### Gastos operativos con "pozos" (`reports`/`app_config`)
Grupos budgeted (`publicidad`, `servicios`, `utiles`, `garantias`) con reserva mensual de
costos fijos; el gasto no baja la ganancia hasta superar su pozo. `varios` no tiene pozo. Ver doc 03 §B.5.

### Códigos de descuento (`/api/discount-codes`, `discount_codes`)
Códigos aplicables (validación y cálculo en servidor).

### Auditoría (`audit_logs`)
Registra ediciones/eliminaciones de ventas: motivo, autor, montos antes/después. Obligatorio
para rechazo/eliminación.

### Feedback (`/api/feedback`, `feedback`)
Reportes de usuarios: `bug` | `idea` | `product`, con teléfono opcional.

### Telemetría (`/api/search-events`, `analytics_events`)
Eventos de búsqueda y "populares". `telemetryLimiter` solo en POST de escritura; los GET
(`/popular`, `/analytics`) quedan bajo el límite general (para no compartir cupo con el SSR de home).

### Contactos vs Followups (unificar en v2)
Coexisten `contacts` (+ subcol. `activities`) y `followups`; hubo migración parcial
(`scripts/migrations/migrateFollowupsToContacts.js`). **[CAMBIO v2?]** unificar en `contacts`.
