# Base de Datos y Migraciones

Este directorio contiene la estructura de la base de datos y scripts de inicialización.

## Orden de Migraciones

El esquema es un **baseline canónico**: los 5 archivos de `App/database/migrations/`
describen el estado final de la base y se aplican sobre una base **limpia**,
**estrictamente en orden**. No son migraciones incrementales — cada tabla nace
en su forma definitiva, sin `ALTER TABLE` posteriores para completar FKs ni
backfills.

1. `0001_core.sql`: función `set_updated_at()`, enums globales, `profiles`,
   `categories`, `templates`, `catalog_items`, `combos`.
2. `0002_crm.sql`: `contacts`, `contact_activities`, `follow_ups`,
   `whatsapp_conversations`, `whatsapp_messages`.
3. `0003_operations.sql`: `purchases`, `products`, `migrated_inventory`,
   `orders`, `order_items`, `stock_reservations`, `invoices`, `public_orders`,
   `public_order_items`, `installments`, `payments`, `accounts`,
   `commission_payments`, `commission_adjustments`, `salidas`,
   `account_movements`.
4. `0004_support_reports.sql`: `app_config`, `losses`, `audit_logs`,
   `logistics_*`, `analytics_events`, `feedback`, `discount_codes`, `expenses`,
   los RPCs de reportes (`get_financial_kpis`, `get_expenses_by_pozo`), la vista
   `sales_export_view` y el bucket de Storage `public-assets`.
5. `0005_seed.sql`: datos de arranque (categorías, plantillas, cuentas y
   configuración financiera).

**El orden es una dependencia real, no una convención:**

- `0002` va antes que `0003` porque `orders` y `public_orders` referencian
  `contacts`.
- Dentro de `0001`, `categories` va antes que `templates` y `catalog_items`
  porque ambas la referencian.
- Dentro de `0003`, `accounts` va antes que `salidas` (FK `cuenta_deposito_id`)
  y `salidas` antes que `account_movements` (FK `salida_id`).

Los archivos `0001`–`0004` usan `create table` / `create type` pelados: **no son
idempotentes**, y re-correrlos sobre una base ya creada falla. Es lo correcto
para un baseline. `0005_seed.sql` **sí** es idempotente (`on conflict` /
`where not exists`) porque el seed puede volver a correrse.

## Migraciones posteriores al baseline

Del `0006` en adelante sí son **incrementales**: cambios que llegaron después de
que el baseline ya estaba aplicado en una base con datos, así que no se pueden
plegar hacia atrás sin recrear la base. Se aplican una vez, en orden.

6. `0006_profiles_contact.sql`: `profiles.phone`, `personal_email`,
   `bank_account` (jsonb) y `last_login`.
7. `0007_invoices_v2.sql`: factura primero → venta ligada. `invoice_items`,
   datos de cliente/subtotal/descuento en `invoices`.
8. `0008_invoices_delivery_name.sql`: `invoices.delivery_name` (repartidor).
9. `0009_discount_codes.sql`: `discount_codes` + `redeem_discount_code()`.
10. `0010_discount_redemptions.sql`: `discount_code_redemptions` y el canje con
    trazabilidad.
11. `0011_discount_code_sequence.sql`: correlativo `GS-DC-N` por secuencia.
12. `0012_invoice_code.sql`: `invoices.invoice_code` generada (`GS-PR-N`). El
    `invoice_number::text` es obligatorio: sin el cast la expresión no es
    IMMUTABLE y Postgres rechaza la columna generada.
13. `0013_reports_rpc.sql`: RPCs de reportería de ventas (`get_sales_trend`,
    `get_seller_performance`, `get_top_products`, `get_sales_breakdown`,
    `get_delivery_summary`). Es `create or replace` en todo, así que **sí** es
    re-ejecutable.
14. `0014_drop_salidas.sql`: elimina el módulo Salidas (tabla, enums y la
    columna `account_movements.salida_id`). **Irreversible.**
15. `0015_sales_ledger_rpc.sql`: `get_sales_ledger` y `get_delivery_invoices`,
    que alimentan los pop-ups de drilldown de Reportería. Re-ejecutable.
16. `0016_drop_migrated_inventory.sql`: elimina `migrated_inventory`. El
    sistema pasa a manejar solo inventario nuevo. La tabla era una hoja —
    nunca se pudo vender desde ella— así que no arrastra nada. El valor
    `'migrated'` del enum `sale_origin` **se conserva**: marca ventas viejas y
    borrarlo rompería órdenes ya cerradas. **Irreversible.**

## Cómo Aplicarlas

Aplicar una por una secuencialmente:

- Vía **SQL Editor** en el Dashboard de Supabase (copiar y pegar).
- Vía **Supabase CLI**.

## Seed de Desarrollo

`migrations/0005_seed.sql` es parte del esquema base: carga las categorías, las
8 plantillas heredadas de v1, las cuentas de caja/banco y la configuración
financiera de `app_config`. Revisar los valores financieros antes de aplicarlo
en producción.

Para ver el storefront con contenido hay además un seed **solo de desarrollo**
que inserta productos de prueba y los slides del hero:

```bash
cd App && npx tsx database/seed-catalog.dev.mts
```

Usa UUIDs fijos + upsert, así que es re-ejecutable sin duplicar. **Nunca correrlo
contra producción.** Sus imágenes quedaron vacías a propósito: hay que subir los
assets a Supabase Storage y poner ahí la URL pública.

## Seguridad (RLS)

**TODAS las tablas tienen Row Level Security (RLS) en `deny-all`** (sin políticas
creadas). Nadie desde el cliente tiene acceso directo; solo el backend operando
con la `service_role` key puede leer y escribir.

La única excepción son las políticas sobre `storage.objects` en
`0004_support_reports.sql`: el bucket `public-assets` sirve las fotos del
catálogo público, así que su lectura es abierta y la escritura queda restringida
a usuarios autenticados.
