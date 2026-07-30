-- ============================================================================
-- Gyro Store v2 · Migración 0008 · Elimina el duplicado order_reservations
-- ============================================================================
-- 0002_inventory.sql ya creó `stock_reservations` (order_id nullable, +status,
-- FK a orders completada en 0003) como LA tabla de reservas de stock — doc 03
-- B.3 la describe explícitamente así. 0003_sales.sql volvió a crear el mismo
-- concepto bajo otro nombre (`order_reservations`, sin status, order_id not
-- null) sin repasar que 0002 ya lo cubría. Nunca se usó: el FIFO de Hito 2
-- (server/services/inventory.ts, en main) escribe en `stock_reservations`, y
-- Hito 3 (server/services/sales.ts) sigue ese mismo camino.
--
-- Tabla vacía (nada del proyecto llegó a escribirle una fila), así que el
-- drop no pierde datos.
-- ============================================================================

drop table if exists order_reservations;

-- ============================================================================
-- Cierre de archivo de migración 0008_drop_order_reservations.sql
-- ============================================================================
