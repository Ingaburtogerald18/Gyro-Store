-- ============================================================================
-- Gyro Store v2 · 0001 · Core (identidad + catálogo)
-- ============================================================================
-- Baseline del esquema. Identidad del staff (`profiles`) y el modelo de
-- catálogo completo:
--
--   categories    = la taxonomía pública.
--   templates     = el molde REUTILIZABLE. Define los ejes de variante
--                   (Color, Conector, Capacidad…) y las specs base.
--   catalog_items = el producto que se vende. Elige un molde, recorta qué
--                   opciones ofrece (`axis_options`) y mapea cada combinación
--                   exacta a lo que hay en bodega (`variant_mappings`).
--   combos        = agrupación de productos con precio propio.
--
-- Principio de seguridad (doc 02/03): RLS en DENY-ALL. Cada tabla del esquema
-- activa RLS SIN crear políticas, así que nadie con la anon/authenticated key
-- lee ni escribe. El backend usa la `service_role`, que IGNORA las RLS por
-- diseño. Esto aplica a TODAS las tablas de los archivos 0001–0004 y no se
-- vuelve a repetir en cada una.
-- ============================================================================

-- ── Función: mantener updated_at ──
-- La usan los triggers de toda tabla que tenga la columna.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Enums globales
-- ============================================================================
-- Se declaran todos acá aunque varios los consuman tablas de archivos
-- posteriores: un tipo es global a la base, y tenerlos juntos evita perseguir
-- en qué archivo nació cada uno.

-- Roles del sistema. global_admin = acceso total.
create type app_role as enum (
  'global_admin',
  'admin',
  'seller',
  'cashier',
  'logistics_admin',
  'logistics_customer'
);

create type purchase_status as enum ('china', 'pending', 'received');
create type order_status as enum ('pending_approval', 'approved', 'paid', 'rejected');
create type sale_origin as enum ('native', 'migrated');

-- 'void' = factura anulada. Borrar una factura emitida por error dejaría un
-- hueco en el correlativo, que es justo lo que un correlativo no puede tener:
-- el número se conserva y el documento queda marcado con quién y por qué.
create type invoice_status as enum ('unlinked', 'linked', 'void');

create type payment_method as enum ('efectivo', 'transferencia', 'tarjeta');
create type loss_category as enum ('robo', 'dano', 'devolucion', 'regalias');
create type feedback_type as enum ('bug', 'idea', 'product');
create type contact_origin as enum ('fb_ads', 'organic', 'whatsapp_link', 'referral', 'other');
create type follow_up_status as enum ('pending', 'completed', 'cancelled');
create type conversation_status as enum ('bot', 'needs_human', 'closed');
create type message_direction as enum ('inbound', 'outbound');

-- ============================================================================
-- Tabla: profiles
-- ============================================================================
-- Perfil de aplicación del staff, 1:1 con auth.users (Supabase Auth). Los roles
-- que no salen de la whitelist de env (ADMIN_EMAILS) viven acá (doc 03 §A.3).
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

alter table profiles enable row level security;

create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: categories
-- ============================================================================
-- Va antes de `templates` y `catalog_items` porque ambas la referencian.
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table categories enable row level security;

create trigger categories_set_updated_at
  before update on categories
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: templates
-- ============================================================================
-- El molde reutilizable. `category_id` filtra qué plantillas se ofrecen al
-- editar un producto de esa categoría.
create table templates (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  description  text,                              -- nota interna del molde
  category_id  uuid references categories(id) on delete set null,
  -- `axes` es un ARRAY ORDENADO: [{ key, label, options[], isColor }]. El orden
  -- importa porque define cómo se arma el nombre de la combinación ("Negro /
  -- Con micrófono"), y ese string es la LLAVE de `catalog_items.variant_mappings`.
  -- Un objeto jsonb no garantiza orden; un array sí. De ahí el default '[]'.
  axes         jsonb default '[]',
  options      jsonb default '{}',
  specs        jsonb default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index templates_category_id_idx on templates (category_id);

alter table templates enable row level security;

create trigger templates_set_updated_at
  before update on templates
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: catalog_items
-- ============================================================================
-- El producto que se vende.
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
  -- Nombre y descripción PROPIOS del producto, independientes del molde: como
  -- las plantillas son reutilizables, dos productos que comparten molde
  -- compartirían el nombre. "Plantilla Audífonos KZ" y "KZ ZSN Pro X" son cosas
  -- distintas, así que cada una vive en su tabla.
  name              text,
  description       text,
  category_id       uuid references categories(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index catalog_items_published_sort_order_idx on catalog_items (published, sort_order);
create index catalog_items_category_id_idx on catalog_items (category_id);

alter table catalog_items enable row level security;

create trigger catalog_items_set_updated_at
  before update on catalog_items
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: combos
-- ============================================================================
-- Agrupación de productos con precio propio. `items` guarda la composición.
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

alter table combos enable row level security;

create trigger combos_set_updated_at
  before update on combos
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Cierre de archivo 0001_core.sql
-- ============================================================================
