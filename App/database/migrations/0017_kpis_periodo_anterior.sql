-- ============================================================================
-- Migración 0017: KPIs con comparación contra el periodo anterior
-- ============================================================================
-- Un número sin contexto es un dato, no un reporte. "Vendiste C$1.4M" no dice
-- si el mes fue bueno; "C$1.4M, +12,4 % vs el mes pasado" sí.
--
-- `get_financial_kpis` pasa a devolver, junto a cada KPI, el valor del periodo
-- INMEDIATAMENTE ANTERIOR de igual duración. Si el rango es del 1 al 31 de
-- marzo, el anterior es del 29 de enero al 1 de marzo — misma cantidad de días,
-- que es lo único que hace comparable la cifra.
--
-- ── Por qué en el mismo RPC y no en uno nuevo ──
-- Las dos ventanas se resuelven en UN escaneo de `orders` con `FILTER`. Un
-- segundo RPC significaría dos round-trips y dos veces el mismo escaneo para
-- responder la misma pregunta.
--
-- ⚠️ Cambia la firma de retorno: hay que soltar la función antes. `create or
--    replace` no puede alterar el `returns table`.
-- ============================================================================

drop function if exists get_financial_kpis(timestamptz, timestamptz, uuid);

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
  pozos_recogidos jsonb,
  -- Periodo anterior de igual duración. Nulos/ceros si el rango es abierto:
  -- sin fechas no hay "anterior" que calcular.
  total_ventas_prev bigint,
  total_unidades_prev bigint,
  total_vendido_prev numeric,
  coste_total_prev numeric,
  comision_total_prev numeric,
  ganancia_tienda_total_prev numeric
) language plpgsql security definer as $$
declare
  v_pozos_json jsonb;
  v_prev_start timestamptz;
  v_prev_end   timestamptz;
begin
  -- La ventana anterior solo existe si el rango actual está acotado por ambos
  -- extremos. Con "historial completo" no hay contra qué comparar.
  if p_start_date is not null and p_end_date is not null then
    v_prev_end   := p_start_date;
    v_prev_start := p_start_date - (p_end_date - p_start_date);
  end if;

  -- Pozos: solo del periodo actual. No se compara el reparto de costos fijos
  -- contra el mes pasado — la tarjeta muestra proporción, no evolución.
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
    count(distinct o.id) filter (where w.cur)::bigint,
    coalesce(sum(oi.quantity) filter (where w.cur), 0)::bigint,
    coalesce(sum(oi.quantity * coalesce(oi.precio_unit, 0)) filter (where w.cur), 0),
    coalesce(sum(oi.quantity * coalesce(oi.coste_final_snap, 0)) filter (where w.cur), 0),
    coalesce(sum(oi.comision) filter (where w.cur), 0),
    coalesce(sum(oi.ganancia_tienda) filter (where w.cur), 0),
    coalesce(sum(oi.salary) filter (where w.cur), 0),
    coalesce(v_pozos_json, '{}'::jsonb),

    count(distinct o.id) filter (where w.prv)::bigint,
    coalesce(sum(oi.quantity) filter (where w.prv), 0)::bigint,
    coalesce(sum(oi.quantity * coalesce(oi.precio_unit, 0)) filter (where w.prv), 0),
    coalesce(sum(oi.quantity * coalesce(oi.coste_final_snap, 0)) filter (where w.prv), 0),
    coalesce(sum(oi.comision) filter (where w.prv), 0),
    coalesce(sum(oi.ganancia_tienda) filter (where w.prv), 0)
  from orders o
  left join order_items oi on o.id = oi.order_id
  -- Marca cada orden como del periodo actual, del anterior, o de ninguno. El
  -- `lateral` evita repetir estas condiciones en cada `FILTER` de arriba.
  cross join lateral (
    select
      ((p_start_date is null or o.created_at >= p_start_date)
        and (p_end_date is null or o.created_at <= p_end_date)) as cur,
      (v_prev_start is not null
        and o.created_at >= v_prev_start
        and o.created_at < v_prev_end) as prv
  ) w
  where o.status in ('approved','paid')
    and (p_seller_uid is null or o.seller_uid = p_seller_uid)
    -- Sin esto el escaneo traería TODO el histórico para descartarlo en los
    -- FILTER: acota a las dos ventanas que importan.
    and (w.cur or w.prv);
end;
$$;

notify pgrst, 'reload schema';
