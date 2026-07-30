-- ============================================================================
-- Gyro Store v2 · Migración 0010 · UNIQUE en invoices.sale_id / installments.order_id
-- ============================================================================
-- server/services/invoice.ts (createInvoice) y server/services/installments.ts
-- (createInstallmentPlan) validan "¿esta venta ya tiene factura/plan?" con un
-- SELECT antes del INSERT — pero eso es check-then-insert en TypeScript, no
-- atómico: dos requests concurrentes para la misma venta pueden pasar el
-- SELECT los dos antes de que cualquiera termine el INSERT, y quedar dos
-- facturas (dos correlativos legales quemados para una sola venta) o dos
-- planes de cuotas para el mismo pedido.
--
-- Este UNIQUE es la última línea de defensa a nivel de base — mismo
-- principio que el UNIQUE de invoice_number en la migración 0009 (el
-- correlativo de factura es un requisito legal, doc 09 ítem 61). NULL no
-- rompe nada: Postgres nunca considera dos NULL iguales para UNIQUE, así que
-- sigue sin problema el hecho de que ambas columnas admiten null.
--
-- Migración aditiva e idempotente (convención de 0005/0006/0007/0009):
-- Postgres no soporta `ADD CONSTRAINT IF NOT EXISTS`, así que se chequea
-- contra pg_constraint antes de agregar cada uno.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_sale_id_unique'
  ) then
    alter table invoices add constraint invoices_sale_id_unique unique (sale_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'installments_order_id_unique'
  ) then
    alter table installments add constraint installments_order_id_unique unique (order_id);
  end if;
end $$;

-- ============================================================================
-- Cierre de archivo de migración 0010_unique_sale_links.sql
-- ============================================================================
