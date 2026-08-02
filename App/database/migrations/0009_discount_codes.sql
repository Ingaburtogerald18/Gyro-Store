-- ============================================================================
-- Migración 0009: Códigos de descuento
-- ============================================================================
-- Portado de v1 (Firestore `discountCodes`, server/routes/discountCodes.js) al
-- modelo relacional. El admin emite códigos (ej. incentivo por reseña en
-- Google/Facebook) y el cliente los aplica en el checkout público, en una
-- factura POS o al registrar una venta.
--
-- El código en MAYÚSCULAS es la PRIMARY KEY natural → unicidad sin query extra,
-- igual que el doc id de v1. `max_uses = 0` significa usos ilimitados.
--
-- ── Por qué el enum es reintentable y la tabla NO ──
-- Un enum existe o no, con los mismos valores: saltearlo si ya está es seguro.
-- Una tabla, en cambio, puede existir con OTRA FORMA — y eso ya pasó acá: había
-- una `discount_codes` distinta en 0004 y el backend fallaba con "Could not find
-- the 'type' column". Con `create table if not exists` ese caso se saltea EN
-- SILENCIO y el error aparece después, en runtime. Sin él, revienta acá mismo,
-- que es donde se puede leer y arreglar. Si este archivo falla porque la tabla
-- ya existe, hay que borrarla a mano y volver a correrlo.

-- El enum se crea de forma reintentable: un `create type` pelado hace que
-- re-correr el archivo falle en la PRIMERA línea y deje todo a medio aplicar.
-- La tabla de abajo SÍ va sin `if not exists` a propósito (ver nota).
do $$ begin
  create type discount_type as enum ('percent', 'fixed');
exception
  when duplicate_object then null;
end $$;

create table discount_codes (
  code         text primary key,
  type         discount_type not null,
  value        numeric(12,2) not null check (value > 0),
  max_uses     integer not null default 1 check (max_uses >= 0), -- 0 = ilimitado
  used_count   integer not null default 0 check (used_count >= 0),
  active       boolean not null default true,
  expires_at   date,
  note         text default '',
  created_by   text default '',
  created_at   timestamptz not null default now()
);

-- La lista del admin ordena por fecha descendente; el índice evita el sort.
create index discount_codes_created_at_idx on discount_codes (created_at desc);

alter table discount_codes enable row level security;

-- ── Canje atómico ───────────────────────────────────────────────────────────
-- Revalida TODO e incrementa `used_count` en una sola transacción implícita.
-- Equivale a la `runTransaction` de Firestore de v1: dos pedidos concurrentes
-- nunca agotan de más un código de N usos (el `for update` serializa el acceso
-- a la fila). Devuelve una fila { ok, err, r_* }: se usa `ok=false` + mensaje en
-- vez de `raise exception` para que el borde dé un error de usuario limpio.
create or replace function redeem_discount_code(p_code text)
returns table (ok boolean, err text, r_code text, r_type discount_type, r_value numeric)
language plpgsql
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_row  discount_codes%rowtype;
begin
  if v_code = '' then
    return query select false, 'Código inválido.', null::text, null::discount_type, null::numeric; return;
  end if;

  select * into v_row from discount_codes where code = v_code for update;

  if not found then
    return query select false, 'Código inválido.', null::text, null::discount_type, null::numeric; return;
  end if;
  if not v_row.active then
    return query select false, 'Este código ya no está activo.', null::text, null::discount_type, null::numeric; return;
  end if;
  if v_row.expires_at is not null and v_row.expires_at < current_date then
    return query select false, 'Este código venció.', null::text, null::discount_type, null::numeric; return;
  end if;
  if v_row.max_uses > 0 and v_row.used_count >= v_row.max_uses then
    return query select false, 'Este código alcanzó su límite de usos.', null::text, null::discount_type, null::numeric; return;
  end if;

  update discount_codes set used_count = used_count + 1 where code = v_code;
  return query select true, null::text, v_row.code, v_row.type, v_row.value;
end;
$$;

-- ── Persistencia del canje en los documentos que lo consumen ─────────────────
-- El código y el monto descontado quedan guardados donde se aplicaron, para
-- trazabilidad (qué pedido/factura usó qué código).
alter table public_orders add column discount_code text;
alter table public_orders add column code_discount numeric(12,2) default 0;
alter table invoices      add column discount_code text;
