-- ============================================================================
-- Migración 0007: Invertir facturación (Factura primero -> Venta ligada)
-- ============================================================================

-- 1. Alterar invoices para alojar más datos independientes (recibo autocontenido)
-- Como el campo ya permitía nulos por el "on delete set null" y no tenía NOT NULL, solo alteramos la restricción unique.
alter table invoices drop constraint invoices_sale_id_unique;
-- Solo puede haber 1 factura ligada a 1 venta
create unique index invoices_sale_id_unique_idx on invoices (sale_id) where sale_id is not null;

alter table invoices add column customer_name text;
alter table invoices add column phone text;
alter table invoices add column subtotal numeric(12,2);
alter table invoices add column discount numeric(12,2) default 0;

-- 2. Crear invoice_items para guardar las líneas antes de ligar la venta
create table invoice_items (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references invoices(id) on delete cascade,
  sku            text,
  quantity       int not null check (quantity > 0),
  unit_price     numeric(12,2),
  line_total     numeric(12,2),
  created_at     timestamptz not null default now()
);

create index invoice_items_invoice_id_idx on invoice_items (invoice_id);

alter table invoice_items enable row level security;
