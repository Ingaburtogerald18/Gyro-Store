-- ============================================================================
-- Gyro Store v2 · Migración 0009 · UNIQUE en invoices.invoice_number
-- ============================================================================
-- `invoice_number` (0003_sales.sql) se llena por `default nextval(...)`, que
-- en operación normal nunca repite — pero no había ningún constraint que lo
-- garantizara a nivel de base. El correlativo de factura no puede duplicarse
-- (requisito legal, doc 09 ítem 61): este UNIQUE es la última línea de
-- defensa, además de la validación en server/services/invoice.ts que evita
-- llamar al nextval() de la columna hasta confirmar que la factura se va a
-- crear de verdad.
--
-- Migración aditiva e idempotente (convención de 0005/0006/0007): Postgres no
-- soporta `ADD CONSTRAINT IF NOT EXISTS`, así que se chequea contra
-- pg_constraint antes de agregarlo.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_invoice_number_unique'
  ) then
    alter table invoices add constraint invoices_invoice_number_unique unique (invoice_number);
  end if;
end $$;

-- ============================================================================
-- Cierre de archivo de migración 0009_invoices_unique_number.sql
-- ============================================================================
