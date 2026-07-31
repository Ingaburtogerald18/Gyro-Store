-- ============================================================================
-- Gyro Store v2 · Migración 0014 · Caja, Bancos y Movimientos
-- ============================================================================

do $$ begin
  create type cuenta_tipo as enum ('banco', 'efectivo');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type movimiento_tipo as enum ('ingreso', 'egreso');
exception
  when duplicate_object then null;
end $$;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo cuenta_tipo not null,
  moneda text not null default 'NIO',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists account_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete restrict,
  tipo movimiento_tipo not null,
  monto numeric(12,2) not null check (monto > 0),
  categoria text not null,
  descripcion text,
  salida_id uuid null references salidas(id) on delete set null,
  comprobante_url text,
  ocurrio_at timestamptz not null default now(),
  registrado_por uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Habilitar RLS (deny-all)
alter table accounts enable row level security;
alter table account_movements enable row level security;

-- Agregar FK en salidas hacia accounts
alter table salidas
  add constraint salidas_cuenta_deposito_id_fkey 
  foreign key (cuenta_deposito_id) references accounts(id) on delete set null;

-- Seed inicial de cuentas de ejemplo
insert into accounts (nombre, tipo, moneda) values 
  ('Caja Física (Córdobas)', 'efectivo', 'NIO'),
  ('BAC Córdobas', 'banco', 'NIO'),
  ('BAC Dólares', 'banco', 'USD')
on conflict do nothing;
