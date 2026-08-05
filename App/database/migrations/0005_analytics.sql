-- ============================================================================
-- 0005_analytics.sql — Telemetría propia del storefront
-- ============================================================================
-- Extiende el scaffold `analytics_events` (creado VACÍO en 0001) para soportar el
-- embudo completo: page_view · product_view · search · checkout_start ·
-- order_created. Se agregan columnas de PRIMERA CLASE (`session_id`, `path`) para
-- poder armar embudos por sesión y filtrar por ruta sin escarbar el jsonb en cada
-- query, más un CHECK que acota los tipos válidos (un evento con type fuera de la
-- lista es basura o un cliente viejo, y no debe entrar).
--
-- Idempotente a propósito (IF NOT EXISTS + DO-block para la constraint): puede
-- re-aplicarse sin romper. RLS ya quedó en deny-all desde el bucle de 0001, así
-- que la tabla sigue cerrada al cliente; solo el backend con service_role escribe.
--
-- NOTA de retención: los eventos crudos crecen sin techo. A la escala de la
-- tienda no es urgente, pero cuando lo sea, la purga va en un archivo nuevo
-- (p. ej. `delete from analytics_events where created_at < now() - interval '12 months'`)
-- o un rollup nocturno a una tabla agregada. Hoy los reportes consultan por rango
-- de fechas acotado, cubierto por los índices de abajo.

alter table analytics_events add column if not exists session_id text;
alter table analytics_events add column if not exists path text;

-- Tipos permitidos = el embudo completo. Fuera de esta lista no se persiste.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'analytics_events_type_check'
  ) then
    alter table analytics_events
      add constraint analytics_events_type_check
      check (type in ('page_view', 'product_view', 'search', 'checkout_start', 'order_created'));
  end if;
end $$;

-- Los reportes filtran por type + rango de fechas; el embudo agrupa por sesión.
-- El índice de (type) suelto ya existe de 0001; estos cubren los otros patrones.
create index if not exists analytics_events_created_at_idx on analytics_events (created_at desc);
create index if not exists analytics_events_type_created_idx on analytics_events (type, created_at desc);
create index if not exists analytics_events_session_id_idx on analytics_events (session_id);
