-- ============================================================================
-- Gyro Store v2 · Migración 0019 · Anulación de facturas
-- ============================================================================
-- Una factura emitida por error hoy no tiene salida: `invoice_status` solo
-- admite ('unlinked','linked') y `services/invoice.ts` no expone forma de
-- revertirla. Borrarla tampoco sirve — dejaría un hueco en el correlativo, que
-- es justo lo que un correlativo no puede tener.
--
-- La anulación es el mecanismo correcto: el número se conserva, el documento
-- queda marcado como anulado y se registra QUIÉN y POR QUÉ.
--
-- Esto NO trae el modelo de facturación de v1 (ticket POS que nace antes de la
-- venta y reserva stock FIFO). v2 eligió a propósito el modelo inverso — la
-- factura numera una venta ya aprobada — y eso sigue igual. Acá solo se agrega
-- lo que falta en cualquiera de los dos modelos: poder anular.
-- ============================================================================

-- `add value if not exists` es idempotente. Postgres NO permite USAR un valor
-- de enum recién agregado dentro de la misma transacción que lo agrega, así que
-- esta migración solo lo declara; el código lo usa después.
alter type invoice_status add value if not exists 'void';

alter table invoices
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references profiles(id) on delete set null,
  add column if not exists void_reason text;

-- El listado del panel filtra por estado y ordena por número descendente.
create index if not exists invoices_status_number_idx
  on invoices (status, invoice_number desc);

-- ============================================================================
-- Cierre de archivo de migración 0019_invoice_void.sql
-- ============================================================================
