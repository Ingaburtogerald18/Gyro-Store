-- ============================================================================
-- Gyro Store v2 · Migración 0012 · Categorías del Catálogo
-- ============================================================================

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS deny-all para que solo el backend pueda acceder
alter table categories enable row level security;

-- Trigger para updated_at (la funcion set_updated_at ya existe)
drop trigger if exists categories_set_updated_at on categories;
create trigger categories_set_updated_at
  before update on categories
  for each row
  execute function set_updated_at();

-- Añadir category_id a los items de catálogo
alter table catalog_items
  add column if not exists category_id uuid references categories(id) on delete set null;

-- Insertar la categoría requerida por defecto
insert into categories (name, slug) 
values ('Audífonos KZ', 'audifonos-kz') 
on conflict (slug) do nothing;
