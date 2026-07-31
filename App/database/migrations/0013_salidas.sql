-- ============================================================================
-- Gyro Store v2 · Migración 0013 · Salidas de mercadería
-- ============================================================================

do $$ begin
  create type salida_destino as enum ('mostrador', 'delivery');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type salida_estado as enum ('facturada', 'pendiente_registro', 'registrada', 'devuelta');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type liquidacion_estado as enum ('no_aplica', 'pendiente', 'depositado', 'efectivo_recibido', 'recordar');
exception
  when duplicate_object then null;
end $$;

create table if not exists salidas (
  id uuid primary key default gen_random_uuid(),
  articulo text not null,
  destino salida_destino not null,
  invoice_id uuid null references invoices(id) on delete set null,
  order_id uuid null references orders(id) on delete set null,
  estado salida_estado not null default 'pendiente_registro',
  repartidor text,
  monto_esperado numeric(12,2),
  liquidacion liquidacion_estado not null default 'no_aplica',
  liquidado_at timestamptz,
  comprobante_url text,
  cuenta_deposito_id uuid, -- FK a accounts se agrega en la migración de caja (0014)
  nota text,
  salio_at timestamptz not null default now(),
  registrado_por uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS deny-all
alter table salidas enable row level security;

-- Trigger para updated_at (la funcion set_updated_at ya existe)
drop trigger if exists salidas_set_updated_at on salidas;
create trigger salidas_set_updated_at
  before update on salidas
  for each row
  execute function set_updated_at();

-- Índices requeridos
create index if not exists idx_salidas_estado on salidas (estado);
create index if not exists idx_salidas_liquidacion on salidas (liquidacion);
create index if not exists idx_salidas_salio_at on salidas (salio_at);
