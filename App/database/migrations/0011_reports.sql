-- ============================================================================
-- Gyro Store v2 · Migración 0011 · Reportes y Gastos
-- ============================================================================

-- 1. Tabla de Gastos Operativos (expenses)
-- Registra el dinero extraído/gastado de los 7 pozos de la tienda.
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

-- RLS: deny-all intencional (accedido solo por service_role)
alter table expenses enable row level security;

-- 2. RPC: get_financial_kpis
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

-- 3. Vista: sales_export_view
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

-- 4. RPC: get_expenses_by_pozo
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
