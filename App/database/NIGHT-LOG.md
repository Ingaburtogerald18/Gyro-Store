# Night Log - 2026-07-29

* **22:00** - `0001_init.sql` expandido: enums globales + templates + catalog_items + combos.
* **22:15** - `0002_inventory.sql`: creadas purchases, products, migrated_inventory, stock_reservations (FK a orders pendiente, se completa en 0003).
* **22:30** - `0003_sales.sql`: creadas orders, order_items, order_reservations, invoices (con invoice_number_seq), public_orders, public_order_items + completa FK de stock_reservations.order_id (FK a contacts pendiente, se completa en 0004).
* **22:45** - `0004_support.sql`: creadas 17 tablas de soporte/logística/CRM/WhatsApp + completa FKs de contact_id en orders y public_orders.
* **23:00** - `seed.sql`: creados valores financieros de doc 11 en app_config (exchange_rate, salary_pct, pozos, costo_fu_tiers, margenes, comision_scale, mayoreo).
* **23:15** - `utils/logger.ts`, `sanitize.ts`, `pagination.ts` creados.
* **23:30** - `middleware/rateLimiter.ts` creado (`apiLimiter`, `telemetryLimiter`) + `express-rate-limit` agregado a `package.json` (dependencies) — *PENDIENTE: correr `npm install` para instalarlo de verdad*.
* **23:45** - `services/config.ts` + `routes/config.ts` creados — *PENDIENTE: montar en index.ts con `app.use('/api/config', configRouter);` (requiere el import correspondiente), revisión manual antes de mergear*.

## Pendientes para la mañana
- Correr `npm install` (Node no estaba disponible en la máquina donde se hizo esta sesión, la instalación y `tsc --noEmit` quedan para verificar en casa).
- Revisar y aplicar las 4 migraciones + `seed.sql` en Supabase (SQL Editor), **EN ORDEN**, tras revisión humana — no se aplicó nada automáticamente.
- Montar `routes/config.ts` en `index.ts`.
- Conectar `apiLimiter` y `telemetryLimiter` en `index.ts` (no se conectaron, solo se exportaron).
- Ningún `TODO(Claude)` quedó pendiente de lógica de negocio en esta sesión (`order_items` de 0003 tiene un comentario `TODO(Claude)` sobre cálculo de comisión/FIFO/costeo, eso lo hace otro módulo más adelante).