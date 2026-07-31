-- ============================================================================
-- Gyro Store v2 · Migración 0007 · Campos del panel de inventario (v1)
-- ============================================================================
-- El panel de inventario admin reciclado de v1 (frontend/app/store/api/
-- inventoryV1Api.ts, contrato real que consumen los componentes de
-- admin/inventory/) necesita columnas que 0002_inventory.sql no incluyó.
--
-- Alcance: `purchases` es el ledger real de FIFO (stock_reservations.purchase_id
-- ya referencia esta tabla, no `products`), así que ahí también persistimos el
-- costeo de doc 11 §1-2 (`costo_f_u`, `coste_final`; `costo_real_usd`/
-- `costo_real_cs` ya existían). `products` (stock por SKU, vista de bodega
-- para el catálogo — doc 03 B.3) queda sin tocar: nada en el contrato de
-- inventoryV1Api.ts vincula una compra a un SKU/catalog_item todavía, eso es
-- trabajo de `routes/catalog.ts` (doc 09 ítem 54).
--
-- Migración aditiva y idempotente (convención de 0005/0006): `if not exists`
-- en cada columna para poder re-correrla sin fallar.
-- ============================================================================

alter table purchases
  add column if not exists product_name    text not null default 'No Name',
  add column if not exists category        text,
  add column if not exists arrival_date    date,
  add column if not exists suggested_price numeric(12,2),
  add column if not exists costo_f_u       numeric(12,2),
  add column if not exists coste_final     numeric(12,2);

-- `migrated_inventory` está aislado de `purchases` (doc 03 B.3: costo real ya
-- dado, no corre FIFO), pero el contrato de la UI (MigratedItem/NewMigratedItem)
-- pide el mismo nivel de detalle que un lote: código, fechas, cantidades
-- vendidas/reservadas y el desglose de costo en USD.
alter table migrated_inventory
  add column if not exists status            text not null default 'received',
  add column if not exists lot               text,
  add column if not exists code              text,
  add column if not exists purchase_date     date not null,
  add column if not exists quantity_sold     integer not null default 0 check (quantity_sold >= 0),
  add column if not exists quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  add column if not exists cost_unit_usd     numeric(12,4),
  add column if not exists shipping_unit_usd numeric(12,4),
  add column if not exists suggested_price   numeric(12,2),
  add column if not exists comments          text;

-- ============================================================================
-- Cierre de archivo de migración 0007_inventory_v1_fields.sql
-- ============================================================================
