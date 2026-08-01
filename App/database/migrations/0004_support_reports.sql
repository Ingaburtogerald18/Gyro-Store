-- ============================================================================
-- Gyro Store v2 · 0004 · Soporte, analítica, reportes y storage
-- ============================================================================
-- Lo que rodea al núcleo transaccional: configuración del negocio, pérdidas,
-- auditoría, logística, analítica, gastos operativos, y los objetos de lectura
-- (RPCs + vista) que alimentan el módulo de reportes.
--
-- Los reportes se resuelven en la base y no en el backend: agregar decenas de
-- miles de `order_items` en TypeScript obligaría a traerlos todos a memoria.
-- Las funciones son `security definer` porque leen tablas con RLS deny-all.
-- ============================================================================

-- ============================================================================
-- Tabla: app_config
-- ============================================================================
-- Parámetros del negocio editables desde la UI (tasa de cambio, pozos, escalas
-- de costeo/margen/comisión). Clave-valor jsonb para no migrar el esquema cada
-- vez que cambia una escala.
create table app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table app_config enable row level security;

create trigger app_config_set_updated_at
  before update on app_config
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: losses
-- ============================================================================
-- Mermas: robo, daño, devolución y regalías.
create table losses (
  id          uuid primary key default gen_random_uuid(),
  category    loss_category,
  sku         text,
  quantity    integer,
  costo_cs    numeric(12,2),
  reason      text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index losses_sku_idx on losses (sku);

alter table losses enable row level security;

-- ============================================================================
-- Tabla: audit_logs
-- ============================================================================
-- Rastro de cambios sensibles. `before`/`after` guardan el estado completo en
-- jsonb: la entidad auditada puede cambiar de forma y el histórico se conserva
-- tal como era en su momento.
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  entity      text,
  entity_id   uuid,
  action      text,
  reason      text,
  author_uid  uuid references profiles(id) on delete set null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_entity_id_idx on audit_logs (entity_id);

alter table audit_logs enable row level security;

-- ============================================================================
-- Tabla: logistics_shipments
-- ============================================================================
create table logistics_shipments (
  id            uuid primary key default gen_random_uuid(),
  code          text,
  origin        text,
  status        text not null default 'created',
  customer_uid  uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index logistics_shipments_code_idx on logistics_shipments (code);

alter table logistics_shipments enable row level security;

create trigger logistics_shipments_set_updated_at
  before update on logistics_shipments
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: logistics_events
-- ============================================================================
-- Línea de tiempo del envío: cada cambio de estado es una fila, no un update
-- sobre el envío, para poder reconstruir el recorrido completo.
create table logistics_events (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references logistics_shipments(id) on delete cascade,
  status      text,
  note        text,
  created_at  timestamptz not null default now()
);

create index logistics_events_shipment_id_idx on logistics_events (shipment_id);

alter table logistics_events enable row level security;

-- ============================================================================
-- Tabla: analytics_events
-- ============================================================================
create table analytics_events (
  id          uuid primary key default gen_random_uuid(),
  type        text,
  payload     jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index analytics_events_type_idx on analytics_events (type);

alter table analytics_events enable row level security;

-- ============================================================================
-- Tabla: feedback
-- ============================================================================
create table feedback (
  id          uuid primary key default gen_random_uuid(),
  type        feedback_type,
  message     text,
  phone       text,
  created_at  timestamptz not null default now()
);

alter table feedback enable row level security;

-- ============================================================================
-- Tabla: discount_codes
-- ============================================================================
create table discount_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  kind        text,
  value       numeric(12,2),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table discount_codes enable row level security;

-- ============================================================================
-- Tabla: expenses
-- ============================================================================
-- Registra el dinero extraído/gastado de los 7 pozos de la tienda. El check
-- fija los pozos válidos: son los mismos que la clave `pozos` de `app_config`.
create table expenses (
  id          uuid primary key default gen_random_uuid(),
  pozo        text not null check (pozo in ('publicidad', 'mantenimiento', 'utiles', 'garantias', 'prestamos', 'suscripciones', 'servicios')),
  monto_cs    numeric(12,2) not null check (monto_cs > 0),
  category    text,
  description text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index expenses_created_at_idx on expenses(created_at);

alter table expenses enable row level security;

-- ============================================================================
-- RPC: get_financial_kpis
-- ============================================================================
-- Calcula KPIs (Ventas, Utilidades, Comisiones, Pozos) en crudo, sin cargar a memoria.
-- Solo toma en cuenta órdenes 'approved' (ya que las pending no tienen el snapshot firme
-- o no son ventas definitivas, según la lógica del Hito 3).
create or replace function get_financial_kpis(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_seller_uid uuid default null
) returns table (
  total_ventas bigint,
  total_unidades bigint,
  total_vendido numeric,
  coste_total numeric,
  comision_total numeric,
  ganancia_tienda_total numeric,
  salary_acumulado numeric,
  pozos_recogidos jsonb
) language plpgsql security definer as $$
declare
  v_pozos_json jsonb;
begin
  -- Agregación de pozos (extraer keys, sumar por key, y volver a jsonb)
  select jsonb_object_agg(p.key, p.total_monto)
  into v_pozos_json
  from (
    select pozo.key, sum((pozo.value)::numeric) as total_monto
    from orders o
    join order_items oi on o.id = oi.order_id
    cross join lateral jsonb_each_text(oi.pozos) as pozo
    where o.status in ('approved','paid')
      and (p_start_date is null or o.created_at >= p_start_date)
      and (p_end_date is null or o.created_at <= p_end_date)
      and (p_seller_uid is null or o.seller_uid = p_seller_uid)
      and oi.pozos is not null
    group by pozo.key
  ) p;

  return query
  select
    count(distinct o.id)::bigint as total_ventas,
    coalesce(sum(oi.quantity), 0)::bigint as total_unidades,
    coalesce(sum(oi.quantity * coalesce(oi.precio_unit, 0)), 0) as total_vendido,
    coalesce(sum(oi.quantity * coalesce(oi.coste_final_snap, 0)), 0) as coste_total,
    coalesce(sum(oi.comision), 0) as comision_total,
    coalesce(sum(oi.ganancia_tienda), 0) as ganancia_tienda_total,
    coalesce(sum(oi.salary), 0) as salary_acumulado,
    coalesce(v_pozos_json, '{}'::jsonb) as pozos_recogidos
  from orders o
  left join order_items oi on o.id = oi.order_id
  where o.status in ('approved','paid')
    and (p_start_date is null or o.created_at >= p_start_date)
    and (p_end_date is null or o.created_at <= p_end_date)
    and (p_seller_uid is null or o.seller_uid = p_seller_uid);
end;
$$;

-- ============================================================================
-- Vista: sales_export_view
-- ============================================================================
-- Join plano de ventas para exportación (orders + order_items + invoices).
-- Contiene las columnas necesarias para filtrar y armar un CSV detallado.
create or replace view sales_export_view as
select
  o.id as order_id,
  o.status as order_status,
  o.created_at as created_at,
  o.seller_email as seller_email,
  o.phone as customer_phone,
  i.invoice_number as invoice_number,
  i.status as invoice_status,
  i.method as payment_method,
  oi.sku as item_sku,
  oi.quantity as item_quantity,
  oi.precio_unit as item_price,
  oi.coste_final_snap as item_cost,
  oi.utilidad_bruta as item_utilidad_bruta,
  oi.salary as item_salary,
  oi.utilidad_neta as item_utilidad_neta,
  oi.comision as item_comision,
  oi.ganancia_tienda as item_ganancia_tienda
from orders o
join order_items oi on o.id = oi.order_id
left join invoices i on o.id = i.sale_id
where o.status in ('approved','paid');

-- ============================================================================
-- RPC: get_expenses_by_pozo
-- ============================================================================
-- Suma expenses.monto_cs agrupado por pozo en un rango de fechas.
create or replace function get_expenses_by_pozo(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
) returns table (
  pozo text,
  total_gastado numeric
) language sql security definer as $$
  select
    pozo,
    sum(monto_cs) as total_gastado
  from expenses
  where (p_start_date is null or created_at >= p_start_date)
    and (p_end_date is null or created_at <= p_end_date)
  group by pozo;
$$;

-- ============================================================================
-- Storage: bucket de assets públicos
-- ============================================================================
-- Este bloque es idempotente aunque el resto del archivo no lo sea: Postgres no
-- soporta `CREATE POLICY IF NOT EXISTS`, así que hacemos DROP ... IF EXISTS
-- antes de cada CREATE. `storage.objects` es una tabla de Supabase que ya trae
-- RLS activo, por eso acá SÍ se definen políticas — es la excepción al
-- deny-all, y a propósito: el bucket sirve las fotos del catálogo público.
-- ============================================================================

-- Bucket público (upsert por id).
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do update set public = true;

-- Lectura pública.
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" on storage.objects
  for select
  using (bucket_id = 'public-assets');

-- Escritura solo para usuarios autenticados.
drop policy if exists "Authenticated users can upload" on storage.objects;
create policy "Authenticated users can upload" on storage.objects
  for insert
  with check (bucket_id = 'public-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update" on storage.objects;
create policy "Authenticated users can update" on storage.objects
  for update
  using (bucket_id = 'public-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete" on storage.objects;
create policy "Authenticated users can delete" on storage.objects
  for delete
  using (bucket_id = 'public-assets' and auth.role() = 'authenticated');

-- ============================================================================
-- Cierre de archivo 0004_support_reports.sql
-- ============================================================================
