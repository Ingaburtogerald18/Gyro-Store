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

-- ============================================================================
-- Nota: la creación automática del profile al registrarse un usuario de Entra
-- se puede hacer con un trigger sobre auth.users, o dejar que el backend haga
-- el "upsert de perfil" en el primer login (como en la v1). Lo definimos al
-- portar /api/auth. Por ahora, la whitelist de env (ADMIN_EMAILS) permite
-- entrar al global_admin sin depender de esta tabla.
-- ============================================================================
