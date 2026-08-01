-- ============================================================================
-- Gyro Store v2 · Migración 0017 · Pago de comisiones a vendedores
-- ============================================================================
-- Porta el módulo de pagos de v1 (server/routes/sales/payments.js +
-- services/balance.js), que en v2 no existía.
--
-- ── Por qué una tabla nueva y no `payments` ──
-- `payments` (0004) es el pago de una CUOTA de un cliente: su FK es
-- `installment_id`. El pago de comisión es otra cosa: la tienda le paga a un
-- VENDEDOR por un conjunto de ventas. Meter las dos en la misma tabla obligaría
-- a dejar `installment_id` nulo y a distinguirlas por un flag — dos entidades
-- distintas compartiendo forma. Van separadas.
--
-- ── El modelo de cuenta corriente ──
-- Un lote de pago es INMUTABLE: registra lo que efectivamente se entregó. Si
-- después se edita una venta ya pagada, su comisión cambia y la diferencia NO
-- se reescribe sobre el lote histórico: se anota como un ajuste en
-- `commission_adjustments` y se salda en el próximo corte.
--   amount > 0 → saldo A FAVOR del vendedor (la tienda le debe)
--   amount < 0 → saldo EN CONTRA (cobró de más; lo devuelve)
--
-- Migración aditiva e idempotente, como el resto desde 0005.
-- ============================================================================

-- ── Lote de pago de comisiones ──
create table if not exists commission_payments (
  id                  uuid primary key default gen_random_uuid(),
  seller_uid          uuid references profiles(id) on delete set null,
  -- El email se guarda ADEMÁS del uid: si el perfil se borra, el histórico de
  -- pagos tiene que seguir diciendo a quién se le pagó (la FK queda en null).
  seller_email        text not null,
  seller_name         text,

  -- Ventas cubiertas por este lote. Se guarda el arreglo en vez de una tabla
  -- puente porque el lote es inmutable: nunca se agregan ni quitan ventas
  -- después de emitido, así que no hay nada que mantener.
  order_ids           uuid[] not null default '{}',

  gross_comision      numeric(12,2) not null default 0,  -- suma de comisiones del lote
  saldo_aplicado      numeric(12,2) not null default 0,  -- ajustes arrastrados
  total_comision      numeric(12,2) not null default 0,  -- lo efectivamente entregado

  -- Liquidación de saldo suelta, sin ventas asociadas (v1: `isSettlement`).
  is_settlement       boolean not null default false,

  payment_method      text not null default 'efectivo',
  receipt_url         text,
  -- Sin comprobante hay que justificar por qué: la ausencia queda explicada en
  -- el registro y no como un hueco silencioso.
  no_receipt_comment  text,

  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),

  constraint commission_payments_receipt_check
    check (receipt_url is not null or no_receipt_comment is not null)
);

create index if not exists commission_payments_seller_email_idx
  on commission_payments (seller_email, created_at desc);

-- rls: deny-all intencional (sin políticas definidas), como el resto del esquema
alter table commission_payments enable row level security;

-- ── Ajustes: lo que faltaba para la cuenta corriente ──
-- La tabla ya existía (0004) con seller_uid / order_id / amount / reason, pero
-- sin forma de saber si un ajuste ya fue saldado — sin eso se cobraría dos veces.
alter table commission_adjustments
  add column if not exists seller_email       text,
  add column if not exists seller_name        text,
  add column if not exists comision_vieja     numeric(12,2),
  add column if not exists comision_nueva     numeric(12,2),
  add column if not exists settled            boolean not null default false,
  add column if not exists settled_payment_id uuid references commission_payments(id) on delete set null,
  add column if not exists settled_at         timestamptz,
  add column if not exists created_by         uuid references profiles(id) on delete set null;

-- El saldo pendiente se consulta SIEMPRE filtrando por `settled = false`, que
-- es un subconjunto chico frente al histórico: índice parcial.
create index if not exists commission_adjustments_pending_idx
  on commission_adjustments (seller_email)
  where settled = false;

-- ============================================================================
-- Cierre de archivo de migración 0017_commission_payouts.sql
-- ============================================================================
