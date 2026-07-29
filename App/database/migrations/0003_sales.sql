-- ============================================================================
-- Gyro Store v2 · Migración 0003 · Ventas y Órdenes
-- ============================================================================
-- Esta migración crea las tablas relacionadas a ventas, facturación e ítems,
-- incluyendo las tablas para órdenes públicas.
-- 
-- Principio de seguridad (doc 03): RLS en DENY-ALL. Nadie con la anon key
-- lee ni escribe. El backend usa la `service_role`, que IGNORA las RLS.
-- ============================================================================

-- ── Tabla: orders ──
create table orders (
  id              uuid primary key default gen_random_uuid(),
  status          order_status not null default 'pending_approval',
  sale_origin     sale_origin not null default 'native',
  seller_uid      uuid references profiles(id) on delete set null,
  seller_email    text,
  week_of         text,
  contact_id      uuid, -- FK a contacts se agrega en 0004 (ALTER TABLE)
  phone           text,
  total           numeric(12,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_seller_uid_week_of_idx on orders (seller_uid, week_of);
create index orders_status_idx on orders (status);

-- rls: deny-all intencional (sin políticas definidas)
alter table orders enable row level security;

create trigger orders_set_updated_at
  before update on orders
  for each row
  execute function set_updated_at();


-- ── Tabla: order_items ──
create table order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  sku               text,
  quantity          integer not null check (quantity > 0),
  precio_unit       numeric(12,2),
  coste_final_snap  numeric(12,2),
  utilidad_bruta    numeric(12,2),
  salary            numeric(12,2),
  utilidad_neta     numeric(12,2),
  comision          numeric(12,2),
  ganancia_tienda   numeric(12,2),
  pozos             jsonb,
  created_at        timestamptz not null default now()
);

-- Estas columnas financieras son un SNAPSHOT que llena el backend al aprobar la orden; esta migración solo las declara.
-- TODO(Claude): cálculo de estos valores (comisión, FIFO, costeo) lo hace otro módulo, no esta migración.

-- rls: deny-all intencional (sin políticas definidas)
alter table order_items enable row level security;


-- ── Tabla: order_reservations ──
create table order_reservations (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  purchase_id     uuid references purchases(id) on delete set null,
  code            text,
  quantity        integer not null check (quantity > 0),
  unit_final_usd  numeric(12,4),
  created_at      timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table order_reservations enable row level security;


-- ── Tabla: invoices ──
create sequence invoice_number_seq;

create table invoices (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid references orders(id) on delete set null,
  invoice_number  bigint default nextval('invoice_number_seq'),
  status          invoice_status not null default 'unlinked',
  method          payment_method,
  delivery_fee    numeric(12,2) default 0,
  total           numeric(12,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table invoices enable row level security;

create trigger invoices_set_updated_at
  before update on invoices
  for each row
  execute function set_updated_at();


-- ── Tabla: public_orders ──
create table public_orders (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid, -- FK a contacts se agrega en 0004 (ALTER TABLE)
  phone       text,
  total       numeric(12,2),
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table public_orders enable row level security;


-- ── Tabla: public_order_items ──
create table public_order_items (
  id                uuid primary key default gen_random_uuid(),
  public_order_id   uuid not null references public_orders(id) on delete cascade,
  sku               text,
  quantity          integer not null check (quantity > 0),
  precio_unit       numeric(12,2),
  created_at        timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table public_order_items enable row level security;


-- ============================================================================
-- ── Relaciones Pendientes ──
-- ============================================================================
-- Completa la FK que la migración 0002_inventory dejó pendiente para stock_reservations
alter table stock_reservations
  add constraint stock_reservations_order_fk
  foreign key (order_id) references orders(id) on delete cascade;

-- ============================================================================
-- Cierre de archivo de migración 0003_sales.sql
-- ============================================================================