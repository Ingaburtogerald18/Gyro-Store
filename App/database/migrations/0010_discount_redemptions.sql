-- ============================================================================
-- Migración 0010: Libro de canjes de códigos de descuento
-- ============================================================================
-- Se guarda el rastro de CADA vez que se canjea un código de descuento.
-- Esto permite armar el panel de uso, saber en qué factura se aplicó, etc.

do $$ begin
  create type redemption_source as enum ('checkout', 'invoice', 'sale');
exception
  when duplicate_object then null;
end $$;

create table discount_code_redemptions (
  id              uuid primary key default gen_random_uuid(),
  code            text not null references discount_codes(code) on delete cascade,
  source          redemption_source not null,
  reference_id    uuid,
  reference_label text,
  method          payment_method,
  amount          numeric(12,2) not null default 0,
  redeemed_by     text,
  redeemed_at     timestamptz not null default now()
);

create index discount_code_redemptions_code_idx on discount_code_redemptions (code);
create index discount_code_redemptions_redeemed_at_idx on discount_code_redemptions (redeemed_at desc);

alter table discount_code_redemptions enable row level security;

-- ── Nueva función de canje atómico con tracking ──────────────────────────────
drop function if exists redeem_discount_code(text);

create or replace function redeem_discount_code(
  p_code text,
  p_source redemption_source,
  p_reference_id uuid,
  p_reference_label text,
  p_method payment_method,
  p_amount numeric,
  p_redeemed_by text
)
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
    return query select false, 'Este código ya fue canjeado.', null::text, null::discount_type, null::numeric; return;
  end if;

  -- 1. Incrementar contador
  update discount_codes set used_count = used_count + 1 where code = v_code;
  
  -- 2. Registrar el canje
  insert into discount_code_redemptions (
    code, source, reference_id, reference_label, method, amount, redeemed_by
  ) values (
    v_row.code, p_source, p_reference_id, p_reference_label, p_method, p_amount, p_redeemed_by
  );

  return query select true, null::text, v_row.code, v_row.type, v_row.value;
end;
$$;
