-- ============================================================================
-- Migración 0011: Secuencia del código de descuento (GS-DC-N)
-- ============================================================================
-- El código deja de escribirlo el admin (o de salir de un random en el cliente)
-- y pasa a ser una SECUENCIA del servidor: GS-DC-1, GS-DC-2, …
--
-- Por qué en la base y no en el backend: dos requests concurrentes que leyeran
-- "el último código" para sumarle 1 podrían calcular el mismo. `nextval()` es
-- atómico por definición, así que la unicidad la garantiza Postgres y no un
-- chequeo en TypeScript. Mismo criterio que `invoice_number_seq` (0007).
--
-- Un código legible y correlativo además es lo que el negocio necesita: se dicta
-- por teléfono o por WhatsApp, y "GS-DC-14" se transcribe sin errores. Un
-- `GYRO-A7K2QX` aleatorio no.
--
-- La secuencia NO se reinicia ni se reusa: si un código se borra, su número
-- queda quemado. Es lo correcto para algo que ya pudo haberse repartido.
-- ============================================================================

create sequence if not exists discount_code_seq;

alter table discount_codes
  alter column code set default ('GS-DC-' || nextval('discount_code_seq'));

-- ============================================================================
-- Cierre de archivo 0011_discount_code_sequence.sql
-- ============================================================================
