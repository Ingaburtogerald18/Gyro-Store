-- ============================================================================
-- 0006_caja_extended.sql — Caja y Bancos: saldo inicial, traspasos y cierres
-- ============================================================================
-- Extiende el módulo de Caja para operar un negocio real:
--
--   1. `accounts.saldo_inicial` — el dinero con el que ARRANCA cada cuenta, para
--      que el saldo refleje la realidad sin inventar un movimiento "de apertura".
--
--   2. `account_movements.transfer_id` — liga las DOS patas de un traspaso entre
--      cuentas (egreso de una + ingreso de otra). Sin este vínculo, mover
--      efectivo al banco eran dos movimientos sueltos y si faltaba uno, los
--      saldos mentían.
--
--   3. `cash_closures` — el arqueo/cierre del día PERSISTIDO: lo que el sistema
--      esperaba vs lo que se contó físicamente, con la diferencia. El cuadre en
--      vivo no dejaba rastro; esto sí, para poder revisar cierres pasados.
--
-- Idempotente a propósito (IF NOT EXISTS): puede re-aplicarse sin romper. RLS de
-- las tablas de caja sigue en deny-all desde 0001; solo el backend con
-- service_role escribe.

-- ── 1. Saldo inicial por cuenta ──
alter table accounts
  add column if not exists saldo_inicial numeric(12,2) not null default 0;

-- ── 2. Vínculo de traspaso entre las dos patas del movimiento ──
alter table account_movements
  add column if not exists transfer_id uuid;

create index if not exists account_movements_transfer_id_idx
  on account_movements (transfer_id)
  where transfer_id is not null;

-- ── 3. Cierres de caja (arqueo) ──
-- `saldo_esperado` es una FOTO del saldo calculado al momento del cierre; se
-- guarda y no se recalcula, porque los movimientos posteriores no deben cambiar
-- lo que se contó esa noche. `diferencia = contado - esperado` (positiva =
-- sobrante, negativa = faltante). El backend, al cerrar, registra un movimiento
-- de ajuste por esa diferencia para que el saldo del libro quede igual al conteo
-- (el conteo físico manda); ese ajuste vive en account_movements, no acá.
create table if not exists cash_closures (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete restrict,
  fecha           date not null default (now() at time zone 'utc')::date,
  saldo_esperado  numeric(12,2) not null,
  saldo_contado   numeric(12,2) not null,
  diferencia      numeric(12,2) not null,
  notas           text,
  cerrado_por     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Un cierre por cuenta y día: re-cerrar el mismo día SOBREESCRIBE (upsert),
  -- no acumula arqueos duplicados.
  unique (account_id, fecha)
);

create index if not exists cash_closures_fecha_idx on cash_closures (fecha desc);

-- RLS deny-all, igual que el resto de tablas internas (el bucle de 0001 solo
-- cubrió las tablas que existían entonces; esta es nueva y hay que cerrarla acá).
alter table cash_closures enable row level security;

-- Cierre de 0006_caja_extended.sql
