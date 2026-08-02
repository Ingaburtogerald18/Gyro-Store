-- ============================================================================
-- Migración 0016: Eliminar el inventario migrado
-- ============================================================================
-- `migrated_inventory` guardaba el histórico cargado a mano desde el Excel
-- viejo. Se elimina porque el sistema pasa a manejar SOLO inventario nuevo.
--
-- ── Por qué se puede borrar sin romper nada ──
-- La tabla estaba aislada: nunca se pudo VENDER desde ahí. `services/sales.ts`
-- consume únicamente `purchases` vía FIFO, así que ninguna `order_items`
-- apunta a un ítem migrado. Tampoco hay FKs entrantes: es una tabla hoja.
--
-- ── Qué NO toca esta migración ──
-- El enum `sale_origin` conserva su valor 'migrated' y la columna
-- `orders.sale_origin` queda intacta. Son cosas distintas: ese valor marca
-- ventas que se registraron como provenientes del histórico, y borrarlo
-- rompería órdenes ya cerradas. El desglose por origen de Reportería lo sigue
-- mostrando.
--
-- ⚠️  IRREVERSIBLE. Si hay histórico que valga la pena conservar, sacá el
--     backup ANTES de correr esto.
-- ============================================================================

drop table if exists migrated_inventory cascade;

-- PostgREST cachea el esquema: sin esto seguiría anunciando una tabla que ya
-- no existe.
notify pgrst, 'reload schema';
