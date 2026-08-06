-- ============================================================================
-- 0008_invoice_seller.sql — Vendedor asignado a la factura
-- ============================================================================
-- Hasta acá una factura `unlinked` no tenía dueño: nacía anónima en Caja y
-- recién se sabía "de quién era" cuando alguien la vinculaba a una venta
-- (orders.seller_uid). Eso rompe el flujo real: Caja emite el ticket PARA un
-- vendedor específico, y ese vendedor necesita poder ver SUS facturas (para
-- copiar el número y registrar la venta) antes de que exista ningún vínculo.
--
-- `seller_uid` lo elige Caja al emitir (INVOICE-EDITOR, selector "Vendedor").
-- Nullable a propósito: una factura sin vendedor asignado sigue siendo válida
-- (ticket genérico de mostrador), solo que nadie la verá en su "Mis Facturas".
--
-- Idempotente (IF NOT EXISTS): puede re-aplicarse sin romper. RLS ya queda en
-- deny-all desde el bucle de 0001.
-- ============================================================================

alter table invoices
  add column if not exists seller_uid uuid references profiles(id) on delete set null;

create index if not exists invoices_seller_uid_idx on invoices (seller_uid);
