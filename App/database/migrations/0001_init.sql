-- ============================================================================
-- Gyro Store v2 · Migración 0001 · Fundación (auth / profiles)
-- ============================================================================
-- Esta migración crea lo mínimo para autenticar staff y resolver su rol.
-- El catálogo, inventario, ventas, etc. entran en migraciones siguientes.
--
-- Principio de seguridad (doc 02/03): RLS en DENY-ALL. Nadie con la anon key
-- lee ni escribe. El backend usa la `service_role`, que IGNORA las RLS.
-- ============================================================================

-- ── Tipos enum ──
-- Roles del sistema. global_admin = acceso total.
create type app_role as enum (
  'global_admin',
  'admin',
  'seller',
  'cashier',
  'logistics_admin',
  'logistics_customer'
);

-- ── Tabla: profiles ──
-- Perfil de aplicación del staff. Se enlaza 1:1 con auth.users (Supabase Auth).
-- Los roles fuera de la whitelist de env viven acá (doc 03 §A.3).
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  name        text,
  avatar_url  text,
  roles       app_role[] not null default '{}',
  status      text not null default 'active',   -- 'active' | 'disabled'
  deleted_at  timestamptz,                       -- soft-delete (papelera 30 días)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_email_idx on profiles (email);

-- ── RLS: deny-all ──
-- Activamos RLS SIN crear políticas => nadie con anon/authenticated key accede.
-- El backend (service_role) pasa por encima de RLS por diseño.
alter table profiles enable row level security;

-- ── Trigger: mantener updated_at ──
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- ── Enums globales adicionales ──
create type purchase_status as enum ('china', 'pending', 'received');
create type order_status as enum ('pending_approval', 'approved', 'paid', 'rejected');
create type sale_origin as enum ('native', 'migrated');
create type invoice_status as enum ('unlinked', 'linked');
create type payment_method as enum ('efectivo', 'transferencia', 'tarjeta');
create type loss_category as enum ('robo', 'dano', 'devolucion', 'regalias');
create type feedback_type as enum ('bug', 'idea', 'product');
create type contact_origin as enum ('fb_ads', 'organic', 'whatsapp_link', 'referral', 'other');
create type follow_up_status as enum ('pending', 'completed', 'cancelled');
create type conversation_status as enum ('bot', 'needs_human', 'closed');
create type message_direction as enum ('inbound', 'outbound');

-- ── Tabla: templates ──
create table templates (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  axes        jsonb default '{}',
  options     jsonb default '{}',
  specs       jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── RLS: deny-all (templates) ──
-- Activamos RLS SIN crear políticas => nadie con anon/authenticated key accede.
alter table templates enable row level security;

create trigger templates_set_updated_at
  before update on templates
  for each row
  execute function set_updated_at();

-- ── Tabla: catalog_items ──
create table catalog_items (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid references templates(id) on delete set null,
  base_price        numeric(12,2),
  price             numeric(12,2),
  precio_sugerido   numeric(12,2),
  precio_tentativo  numeric(12,2),
  variant_mappings  jsonb default '{}',
  axis_options      jsonb default '{}',
  images            jsonb default '[]',
  images_by_color   jsonb default '{}',
  published         boolean not null default false,
  is_promo          boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index catalog_items_published_sort_order_idx on catalog_items (published, sort_order);

-- ── RLS: deny-all (catalog_items) ──
-- Activamos RLS SIN crear políticas => nadie con anon/authenticated key accede.
alter table catalog_items enable row level security;

create trigger catalog_items_set_updated_at
  before update on catalog_items
  for each row
  execute function set_updated_at();

-- ── Tabla: combos ──
create table combos (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  price       numeric(12,2),
  items       jsonb default '[]',
  images      jsonb default '[]',
  published   boolean not null default false,
  sort_order  integer default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── RLS: deny-all (combos) ──
-- Activamos RLS SIN crear políticas => nadie con anon/authenticated key accede.
alter table combos enable row level security;

create trigger combos_set_updated_at
  before update on combos
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Nota: la creación automática del profile al registrarse un usuario de Entra
-- se puede hacer con un trigger sobre auth.users, o dejar que el backend haga
-- el "upsert de perfil" en el primer login (como en la v1). Lo definimos al
-- portar /api/auth. Por ahora, la whitelist de env (ADMIN_EMAILS) permite
-- entrar al global_admin sin depender de esta tabla.
-- ============================================================================
