-- ============================================================================
-- 0009_pending_role_grants.sql — Roles reservados para gente que aún no inició sesión
-- ============================================================================
-- El bug de fondo: "Personal → Agregar usuario" creaba una identidad de
-- Supabase Auth con email+contraseña random (`auth.admin.createUser`) para
-- poder tener una fila en `profiles` de inmediato. Pero el login real del
-- staff SIEMPRE es por Microsoft/Azure (doc 03), y Azure —al ser un proveedor
-- distinto— genera SU PROPIA identidad de Auth, con otro `id`, aunque el
-- correo sea el mismo. Cuando esa persona entraba por primera vez, el
-- auto-registro de `middleware/auth.ts` intentaba insertar OTRA fila en
-- `profiles` con ese correo, chocaba contra el `unique` de `profiles.email` (ya
-- ocupado por la identidad fantasma), fallaba, y la persona quedaba sin
-- perfil → sin roles → "Esta cuenta no tiene permisos asignados." para
-- siempre, aunque un admin ya le hubiera asignado un rol.
--
-- La corrección: dejar de pre-crear una identidad de Auth. En su lugar, el
-- rol elegido se reserva ACÁ, por correo (sin FK a `auth.users`, porque esa
-- fila todavía no existe). Cuando la persona entra de verdad por primera vez,
-- `middleware/auth.ts` consume esta fila (le copia los roles a su perfil
-- recién creado) y la borra — mismo criterio que un código de invitación de
-- un solo uso.
-- ============================================================================

create table if not exists pending_role_grants (
  email       text primary key,
  -- Nombre tipeado por el admin al reservar el rol: solo para reconocerlo en
  -- la lista de Personal antes de que la persona haya iniciado sesión (su
  -- nombre REAL, el de `user_metadata` de Azure, lo pisa en cuanto entra).
  name        text,
  roles       app_role[] not null default '{}',
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Tabla nueva por fuera del baseline: el bucle de RLS de 0001 solo corre en
-- una instalación limpia, así que acá se activa a mano, deny-all igual que el
-- resto de `public`.
alter table pending_role_grants enable row level security;
