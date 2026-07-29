-- ============================================================================
-- Gyro Store v2 · Migración 0002 · Inventario
-- ============================================================================
-- Esta migración crea las tablas base para la gestión de inventario, incluyendo
-- lotes de compra, productos individuales, reservas de stock y datos migrados.
-- 
-- Principio de seguridad (doc 03): RLS en DENY-ALL. Nadie con la anon key
-- lee ni escribe. El backend usa la `service_role`, que IGNORA las RLS.
-- ============================================================================

-- ── Tabla: purchases ──
create table purchases (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  lot                 text,
  status              purchase_status not null default 'china',
  purchase_date       date not null,
  quantity            integer not null check (quantity >= 0),
  quantity_sold       integer not null default 0 check (quantity_sold >= 0),
  quantity_reserved   integer not null default 0 check (quantity_reserved >= 0),
  costo_china_usd     numeric(12,4),
  impuesto_unit_usd   numeric(12,4) default 0,
  envio_unit_usd      numeric(12,4) default 0,
  exchange_rate       numeric(8,4),
  costo_real_usd      numeric(12,4),
  costo_real_cs       numeric(12,2),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint purchases_stock_check check (quantity_sold + quantity_reserved <= quantity)
);

create index purchases_purchase_date_idx on purchases (purchase_date);
create index purchases_status_idx on purchases (status);

-- rls: deny-all intencional (sin políticas definidas)
alter table purchases enable row level security;

create trigger purchases_set_updated_at
  before update on purchases
  for each row
  execute function set_updated_at();

-- ── Tabla: products ──
create table products (
  id                uuid primary key default gen_random_uuid(),
  sku               text not null unique,
  code              text,
  catalog_item_id   uuid references catalog_items (id) on delete set null,
  stock             integer not null default 0 check (stock >= 0),
  costo_f_u         numeric(12,2),
  coste_final       numeric(12,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index products_sku_idx on products (sku);

-- rls: deny-all intencional (sin políticas definidas)
alter table products enable row level security;

create trigger products_set_updated_at
  before update on products
  for each row
  execute function set_updated_at();

-- ── Tabla: migrated_inventory ──
create table migrated_inventory (
  id              uuid primary key default gen_random_uuid(),
  sku             text,
  name            text,
  origin          text not null default 'migrated',
  quantity        integer not null default 0,
  costo_real_cs   numeric(12,2),
  created_at      timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table migrated_inventory enable row level security;

-- ── Tabla: stock_reservations ──
create table stock_reservations (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid, -- FK a orders se agrega en 0003 (ALTER TABLE)
  purchase_id     uuid not null references purchases (id) on delete cascade,
  code            text,
  quantity        integer not null check (quantity > 0),
  unit_final_usd  numeric(12,4),
  status          text not null default 'active',
  created_at      timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table stock_reservations enable row level security;

-- ============================================================================
-- Cierre de archivo de migración 0002_inventory.sql
-- ============================================================================