-- ============================================================================
-- 0004 — sales_export_view: SECURITY INVOKER
-- ============================================================================
-- Fix de seguridad (Supabase Advisor: "Security Definer View", CRÍTICO).
--
-- En Postgres 15+ una vista corre, por defecto, con los permisos de su DUEÑO
-- (el rol `postgres`), que salta RLS. Eso significa que `sales_export_view`
-- expondría ventas/utilidades a cualquier rol con acceso a la vista (p. ej. un
-- JWT `authenticated` vía PostgREST), sin pasar por las políticas RLS de
-- `orders` / `order_items` / `invoices`.
--
-- `security_invoker = on` hace que la vista corra con los permisos de QUIEN la
-- consulta, respetando RLS. El backend usa la `service_role key` (ver
-- server/supabase.ts), que ignora RLS de todos modos, así que la exportación de
-- CSV sigue funcionando igual; lo que cambia es que un usuario normal ya no
-- puede leer la vista por fuera.
--
-- Idempotente: `alter view ... set` se puede reaplicar sin efecto.

alter view public.sales_export_view set (security_invoker = on);

-- Recargar el esquema de PostgREST para que tome el cambio.
notify pgrst, 'reload schema';
