-- ============================================================================
-- Migración 0012: Código legible de factura (GS-PR-N)
-- ============================================================================
-- La factura pasa a identificarse como `GS-PR-1`, `GS-PR-2`, … en el ticket, el
-- panel y al ligar una venta.
--
-- ── Por qué una columna DERIVADA y no cambiar `invoice_number` a texto ──
-- `invoice_number` es el correlativo legal: numérico, único y sin huecos. Si se
-- convirtiera a texto se romperían dos cosas silenciosamente:
--
--   1. EL ORDEN. `order by invoice_number desc` sobre texto es lexicográfico:
--      'GS-PR-9' quedaría por ENCIMA de 'GS-PR-10'. El listado de facturación
--      ordena justo por ese campo, así que a partir de la décima factura la
--      lista se vería desordenada sin ningún error visible.
--   2. La garantía de unicidad y continuidad del correlativo, que hoy la da la
--      secuencia + el UNIQUE sobre un entero.
--
-- Con una columna generada el código NO puede desincronizarse del número: no se
-- escribe, se calcula. Y el UNIQUE del número sigue cubriendo al código.
-- ============================================================================

-- OJO con el `::text`: Postgres exige que la expresión de una columna generada
-- sea IMMUTABLE. Sin el cast, `'GS-PR-' || invoice_number` (text || bigint)
-- resuelve al operador `anytextcat`, que es STABLE, y el ALTER falla con
-- "generation expression is not immutable". Con ambos lados en text usa
-- `textcat`, que sí es inmutable.
alter table invoices
  add column if not exists invoice_code text
    generated always as ('GS-PR-' || invoice_number::text) stored;

-- El vendedor busca su factura por el código impreso en el ticket.
create index if not exists invoices_invoice_code_idx on invoices (invoice_code);

-- ============================================================================
-- Cierre de archivo 0012_invoice_code.sql
-- ============================================================================
