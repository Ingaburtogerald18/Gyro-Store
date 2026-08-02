-- ============================================================================
-- Migración 0014: Eliminar módulo Salidas
-- ============================================================================
-- El módulo "Salidas" se elimina por completo: la funcionalidad de tracking de
-- mercadería que sale de la tienda ya no es necesaria. La información de
-- delivery ahora se obtiene directamente de las facturas (invoices.delivery_fee).
--
-- ORDEN DE OPERACIONES:
-- 1. Soltar la FK/columna salida_id de account_movements primero
-- 2. Luego DROP TABLE salidas CASCADE
-- 3. Finalmente los tipos ENUM que ya no se usan

-- ── 1. Limpiar la referencia en account_movements ──
ALTER TABLE account_movements DROP COLUMN IF EXISTS salida_id;

-- ── 2. Eliminar la tabla ──
DROP TABLE IF EXISTS salidas CASCADE;

-- ── 3. Eliminar los tipos enum ──
DROP TYPE IF EXISTS salida_destino;
DROP TYPE IF EXISTS salida_estado;
DROP TYPE IF EXISTS liquidacion_estado;

-- PostgREST cachea el esquema: sin esto las rutas que tocaban salidas
-- seguirían intentando resolverla.
NOTIFY pgrst, 'reload schema';
