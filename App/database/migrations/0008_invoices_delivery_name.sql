-- ============================================================================
-- Migración 0008: Añadir repartidor (delivery_name) a invoices
-- ============================================================================

alter table invoices add column delivery_name text;
