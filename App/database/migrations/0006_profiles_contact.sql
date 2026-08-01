-- ============================================================================
-- Gyro Store v2 · 0006 · Datos de contacto y última conexión del staff
-- ============================================================================
-- Primera migración ADITIVA sobre el baseline (0001–0004). A diferencia de esos
-- archivos, esta es idempotente (`add column if not exists`): se aplica sobre
-- una base que ya existe, así que tiene que poder re-correrse sin fallar.
--
-- Qué agrega y por qué:
--
--   · `phone` / `personal_email` — el modal de «Editar Perfil» del panel ya
--     mostraba estos campos, pero no tenían dónde guardarse: quedaban
--     deshabilitados y marcados «Próximamente». Son el canal de contacto real
--     con el empleado cuando el correo corporativo no alcanza (el corporativo
--     lo administra Entra, no nosotros).
--
--   · `bank_account` — destino del pago de comisiones. Hoy `commission_payments`
--     registra QUÉ se pagó y con qué comprobante, pero no A DÓNDE: eso vivía en
--     una libreta aparte. Es dato sensible: solo sale por endpoints `requireAdmin`.
--
--     Es `jsonb` y no `text` porque son TRES datos, no uno:
--         { "bank": "lafise", "currency": "NIO", "number": "1234567890" }
--     Un string libre ("BAC 123456 córdobas") obliga a parsear con regex para
--     saber a qué banco transferir, y cada quien lo escribe distinto. Con el
--     objeto, el banco y la moneda son valores cerrados que el contrato Zod
--     valida (`PAYOUT_BANKS` / `PAYOUT_CURRENCIES` en shared/schemas.ts).
--     `null` = el empleado todavía no dio cuenta.
--
--   · `last_login` — cuándo entró por última vez. Sirve para detectar cuentas
--     inactivas antes de darlas de baja. Lo escribe `middleware/auth.ts` al
--     resolver el perfil, con throttle para no escribir en cada request.
--
-- Todas nullable y sin default: un perfil ya existente no tiene estos datos y
-- forzar un valor inventaría información que nadie cargó.
--
-- No toca RLS (la tabla ya la tiene en deny-all desde 0001) ni el trigger de
-- `updated_at` (sigue disparando en cada update, incluido el de `last_login`).
-- ============================================================================

alter table profiles
  add column if not exists phone           text,
  add column if not exists personal_email  text,
  add column if not exists bank_account    jsonb,
  add column if not exists last_login      timestamptz;

-- ============================================================================
-- Cierre de archivo 0006_profiles_contact.sql
-- ============================================================================
