-- ============================================================================
-- Gyro Store v2 · 0002 · Funciones, RPCs y vistas
-- ============================================================================
-- Todo lo que se ejecuta EN la base: los RPCs de reportería, la vista de
-- exportación y el canje atómico de códigos de descuento.
--
-- ── Por qué los reportes viven acá y no en el backend ──
-- Agregar decenas de miles de `order_items` en TypeScript obligaría a traerlos
-- todos a memoria. Postgres devuelve la fila ya sumada. Son `security definer`
-- porque leen tablas con RLS deny-all.
--
-- Todos son `create or replace`, así que este archivo SÍ es re-ejecutable.
--
-- El universo de "venta" es siempre el mismo: `orders` con status en
-- ('approved','paid'), fechado por `orders.created_at`. Las pendientes de
-- aprobación no son ventas todavía y las rechazadas nunca lo fueron.
-- ============================================================================

-- ============================================================================
-- RPC: get_financial_kpis
-- ============================================================================
-- KPIs del periodo MÁS los del periodo inmediatamente anterior de igual
-- duración. Un número sin contexto es un dato, no un reporte: "C$1.4M" no dice
-- si el mes fue bueno; "C$1.4M, +12,4 %" sí.
--
-- Las dos ventanas se resuelven en UN escaneo con `FILTER`. Dos queries
-- separadas serían dos round-trips y dos veces el mismo escaneo de `orders`.
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
  -- Periodo anterior. Ceros si el rango es abierto: sin fechas no hay
  -- "anterior" que calcular.
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
  if p_start_date is not null and p_end_date is not null then
    v_prev_end   := p_start_date;
    v_prev_start := p_start_date - (p_end_date - p_start_date);
  end if;

  -- Pozos: solo del periodo actual. La tarjeta muestra proporción, no evolución.
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
  -- Marca cada orden como del periodo actual, del anterior, o de ninguno.
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
    -- Sin esto el escaneo traería TODO el histórico para descartarlo después.
    and (w.cur or w.prv);
end;
$$;

-- ============================================================================
-- RPC: get_sales_trend
-- ============================================================================
-- Serie temporal para el gráfico de tendencia. `p_bucket` viene de la UI según
-- el largo del rango (un año en barras diarias serían 365 barras ilegibles).
--
-- El `case` no es decorativo: `date_trunc` acepta cualquier texto y explota si
-- no reconoce el campo. Al reducir la entrada a tres valores conocidos, un
-- `p_bucket` basura degrada a 'month' en vez de romper.
--
-- `date_trunc` sobre timestamptz usa el TimeZone de la sesión (UTC en Supabase).
-- Para Nicaragua (UTC-6) eso mueve las ventas de las últimas 6 horas del mes al
-- siguiente — se acepta: es un reporte de tendencia, no contable.
create or replace function get_sales_trend(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_bucket text default 'month',
  p_seller_uid uuid default null
) returns table (
  bucket_start timestamptz,
  total_vendido numeric,
  ganancia numeric,
  comision numeric,
  num_ventas bigint
) language sql security definer as $$
  select
    date_trunc(
      case lower(coalesce(p_bucket, 'month'))
        when 'day'  then 'day'
        when 'week' then 'week'
        else 'month'
      end,
      o.created_at
    ) as bucket_start,
    coalesce(sum(oi.quantity * coalesce(oi.precio_unit, 0)), 0) as total_vendido,
    coalesce(sum(oi.ganancia_tienda), 0) as ganancia,
    coalesce(sum(oi.comision), 0) as comision,
    count(distinct o.id)::bigint as num_ventas
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.status in ('approved', 'paid')
    and (p_start_date is null or o.created_at >= p_start_date)
    and (p_end_date is null or o.created_at <= p_end_date)
    and (p_seller_uid is null or o.seller_uid = p_seller_uid)
  group by 1
  order by 1;
$$;

-- ============================================================================
-- RPC: get_seller_performance
-- ============================================================================
-- Ranking del equipo. NO recibe `p_seller_uid` a propósito: es un reporte
-- comparativo entre vendedores y no hay caso en que uno deba pedirlo "para sí
-- mismo". La ruta lo bloquea con 403 para los no-admin.
--
-- Se agrupa por (seller_uid, seller_email) y no solo por uid: las ventas viejas
-- pueden traer el correo sin el uid resuelto, y colapsarlas en un único grupo
-- `null` mezclaría gente distinta.
create or replace function get_seller_performance(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
) returns table (
  seller_uid uuid,
  seller_email text,
  seller_name text,
  total_vendido numeric,
  comision numeric,
  num_ventas bigint,
  unidades bigint
) language sql security definer as $$
  select
    o.seller_uid,
    coalesce(o.seller_email, '') as seller_email,
    coalesce(max(p.name), '') as seller_name,
    coalesce(sum(oi.quantity * coalesce(oi.precio_unit, 0)), 0) as total_vendido,
    coalesce(sum(oi.comision), 0) as comision,
    count(distinct o.id)::bigint as num_ventas,
    coalesce(sum(oi.quantity), 0)::bigint as unidades
  from orders o
  left join order_items oi on oi.order_id = o.id
  left join profiles p on p.id = o.seller_uid
  where o.status in ('approved', 'paid')
    and (p_start_date is null or o.created_at >= p_start_date)
    and (p_end_date is null or o.created_at <= p_end_date)
  group by o.seller_uid, o.seller_email
  order by 4 desc;
$$;

-- ============================================================================
-- RPC: get_top_products
-- ============================================================================
-- Top por INGRESO, no por unidades: veinte accesorios baratos no valen más que
-- tres productos caros a la hora de decidir qué reponer.
create or replace function get_top_products(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_seller_uid uuid default null,
  p_limit integer default 10
) returns table (
  sku text,
  unidades bigint,
  ingreso numeric
) language sql security definer as $$
  select
    oi.sku,
    coalesce(sum(oi.quantity), 0)::bigint as unidades,
    coalesce(sum(oi.quantity * coalesce(oi.precio_unit, 0)), 0) as ingreso
  from orders o
  join order_items oi on oi.order_id = o.id
  where o.status in ('approved', 'paid')
    and oi.sku is not null
    and (p_start_date is null or o.created_at >= p_start_date)
    and (p_end_date is null or o.created_at <= p_end_date)
    and (p_seller_uid is null or o.seller_uid = p_seller_uid)
  group by oi.sku
  order by 3 desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

-- ============================================================================
-- RPC: get_sales_breakdown
-- ============================================================================
-- Los cinco cortes del periodo en UN solo jsonb. Cinco RPCs serían cinco
-- round-trips y cinco veces el mismo escaneo de `orders`; acá el CTE `base` se
-- recorre una vez.
--
-- El monto sale de `orders.total` y NO de sumar `order_items`: `total` refleja
-- lo realmente cobrado (incluye el descuento de factura prorrateado), y sumar
-- las líneas multiplicaría filas al cruzar con `invoices` e `installments`.
--
-- `orders` no tiene `discount_code` — el código vive en la factura. Por eso una
-- venta sin factura nunca cuenta como "con código", que es correcto: el canje
-- se registra al facturar.
create or replace function get_sales_breakdown(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_seller_uid uuid default null
) returns jsonb language sql security definer as $$
  with base as (
    select
      o.id,
      coalesce(o.total, 0) as total,
      o.sale_origin::text as origin,
      (i.id is not null) as invoiced,
      coalesce(i.method::text, 'sin_metodo') as method,
      (i.discount_code is not null and btrim(i.discount_code) <> '') as has_discount,
      exists (select 1 from installments ins where ins.order_id = o.id) as is_installment
    from orders o
    -- Una factura anulada no cuenta como facturada: el papel se invalidó.
    left join invoices i on i.sale_id = o.id and i.status <> 'void'
    where o.status in ('approved', 'paid')
      and (p_start_date is null or o.created_at >= p_start_date)
      and (p_end_date is null or o.created_at <= p_end_date)
      and (p_seller_uid is null or o.seller_uid = p_seller_uid)
  )
  select jsonb_build_object(
    -- Solo sobre ventas facturadas: una venta sin factura no tiene método de pago.
    'by_method', (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', key, 'count', c, 'total', t) order by t desc),
        '[]'::jsonb
      )
      from (
        select method as key, count(*)::bigint as c, sum(total) as t
        from base where invoiced group by method
      ) q
    ),
    'by_origin', (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', key, 'count', c, 'total', t) order by t desc),
        '[]'::jsonb
      )
      from (
        select origin as key, count(*)::bigint as c, sum(total) as t
        from base group by origin
      ) q
    ),
    'by_invoiced', (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', key, 'count', c, 'total', t) order by t desc),
        '[]'::jsonb
      )
      from (
        select case when invoiced then 'con_factura' else 'sin_factura' end as key,
               count(*)::bigint as c, sum(total) as t
        from base group by 1
      ) q
    ),
    'by_discount', (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', key, 'count', c, 'total', t) order by t desc),
        '[]'::jsonb
      )
      from (
        select case when has_discount then 'con_codigo' else 'sin_codigo' end as key,
               count(*)::bigint as c, sum(total) as t
        from base group by 1
      ) q
    ),
    'by_installment', (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', key, 'count', c, 'total', t) order by t desc),
        '[]'::jsonb
      )
      from (
        select case when is_installment then 'a_cuotas' else 'contado' end as key,
               count(*)::bigint as c, sum(total) as t
        from base group by 1
      ) q
    )
  );
$$;

-- ============================================================================
-- RPC: get_delivery_summary
-- ============================================================================
-- Cuánto dinero se movió en envíos y por manos de quién. `delivery_fee` es lo
-- que se le cobró al cliente en la factura, que en la práctica es el monto que
-- termina yendo al repartidor. NO es un costo registrado de forma
-- independiente: si algún día se le paga algo distinto de lo cobrado, hay que
-- registrarlo aparte y este reporte deja de alcanzar.
--
-- Entran TODAS las facturas, incluidas las anuladas: anular el papel no
-- devuelve la plata del envío que ya salió. Excluirlas subestimaría justo lo
-- que se quiere monitorear. Igual viajan aparte para que el número sea
-- auditable.
create or replace function get_delivery_summary(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
) returns table (
  total_delivery numeric,
  num_deliveries bigint,
  total_anulado numeric,
  num_anuladas bigint,
  by_repartidor jsonb
) language sql security definer as $$
  with base as (
    select
      coalesce(i.delivery_fee, 0) as fee,
      (i.status = 'void') as anulada,
      coalesce(nullif(btrim(i.delivery_name), ''), 'Sin asignar') as repartidor
    from invoices i
    -- Único filtro: una factura con envío en 0 no tuvo delivery, y contarla
    -- inflaría el número de entregas sin sumar un peso.
    where coalesce(i.delivery_fee, 0) > 0
      and (p_start_date is null or i.created_at >= p_start_date)
      and (p_end_date is null or i.created_at <= p_end_date)
  )
  select
    coalesce((select sum(fee) from base), 0) as total_delivery,
    coalesce((select count(*) from base), 0)::bigint as num_deliveries,
    coalesce((select sum(fee) from base where anulada), 0) as total_anulado,
    coalesce((select count(*) from base where anulada), 0)::bigint as num_anuladas,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('repartidor', repartidor, 'total', t, 'count', c)
        order by t desc
      )
      from (
        select repartidor, sum(fee) as t, count(*)::bigint as c
        from base group by repartidor
      ) q
    ), '[]'::jsonb) as by_repartidor;
$$;

-- ============================================================================
-- RPC: get_sales_ledger
-- ============================================================================
-- Las FILAS detrás de los KPIs: una por venta, con vendido, coste, comisión y
-- ganancia en la MISMA fila. Los pop-ups de Total Vendido, Coste y Ganancia
-- miran este mismo dataset y solo cambian la columna que imprimen.
--
-- Una fila por ORDEN, no por línea: el agregado de `order_items` se hace acá
-- adentro o el join multiplicaría filas y el total del pie no cuadraría con el
-- KPI de arriba.
--
-- SENSIBLE: `coste` y `ganancia` son la estructura de costos de la tienda. La
-- ruta que lo expone es `requireAdmin`.
create or replace function get_sales_ledger(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_seller_uid uuid default null
) returns table (
  order_id uuid,
  created_at timestamptz,
  cliente text,
  invoice_number text,
  total_vendido numeric,
  coste numeric,
  comision numeric,
  ganancia numeric
) language sql security definer as $$
  select
    o.id as order_id,
    o.created_at,
    coalesce(nullif(btrim(c.name), ''), nullif(btrim(o.phone), '')) as cliente,
    -- El código impreso (`GS-PR-12`) es lo que el usuario ve en el papel.
    coalesce(i.invoice_code, i.invoice_number::text) as invoice_number,
    coalesce(sum(oi.quantity * coalesce(oi.precio_unit, 0)), 0) as total_vendido,
    coalesce(sum(oi.quantity * coalesce(oi.coste_final_snap, 0)), 0) as coste,
    coalesce(sum(oi.comision), 0) as comision,
    coalesce(sum(oi.ganancia_tienda), 0) as ganancia
  from orders o
  left join order_items oi on oi.order_id = o.id
  left join contacts c on c.id = o.contact_id
  -- Una factura anulada no aporta su número: la venta sigue existiendo, el
  -- papel no.
  left join invoices i on i.sale_id = o.id and i.status <> 'void'
  where o.status in ('approved', 'paid')
    and (p_start_date is null or o.created_at >= p_start_date)
    and (p_end_date is null or o.created_at <= p_end_date)
    and (p_seller_uid is null or o.seller_uid = p_seller_uid)
  group by o.id, o.created_at, c.name, o.phone, i.invoice_code, i.invoice_number
  order by o.created_at desc;
$$;

-- ============================================================================
-- RPC: get_delivery_invoices
-- ============================================================================
-- Las facturas con envío del periodo, una por fila. Mismo criterio que
-- `get_delivery_summary`: entran todas, anuladas incluidas.
create or replace function get_delivery_invoices(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
) returns table (
  invoice_number text,
  delivery_fee numeric,
  delivery_name text,
  created_at timestamptz
) language sql security definer as $$
  select
    coalesce(i.invoice_code, i.invoice_number::text) as invoice_number,
    coalesce(i.delivery_fee, 0) as delivery_fee,
    nullif(btrim(i.delivery_name), '') as delivery_name,
    i.created_at
  from invoices i
  where coalesce(i.delivery_fee, 0) > 0
    and (p_start_date is null or i.created_at >= p_start_date)
    and (p_end_date is null or i.created_at <= p_end_date)
  order by i.created_at desc;
$$;

-- ============================================================================
-- RPC: get_expenses_by_pozo
-- ============================================================================
-- Suma `expenses.monto_cs` agrupado por pozo en un rango de fechas.
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
-- Vista: sales_export_view
-- ============================================================================
-- Join plano de ventas para exportación (orders + order_items + invoices).
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
-- RPC: redeem_discount_code
-- ============================================================================
-- Canje ATÓMICO: revalida todo, incrementa `used_count` y deja el rastro en
-- `discount_code_redemptions`, en una sola transacción implícita. El
-- `for update` serializa el acceso a la fila, así que dos pedidos concurrentes
-- nunca agotan de más un código de N usos.
--
-- Devuelve una fila `{ ok, err, r_* }` en vez de `raise exception` para que el
-- borde pueda dar un error de usuario limpio en lugar de un 500.
create or replace function redeem_discount_code(
  p_code text,
  p_source redemption_source,
  p_reference_id uuid,
  p_reference_label text,
  p_method payment_method,
  p_amount numeric,
  p_redeemed_by text
)
returns table (ok boolean, err text, r_code text, r_type discount_type, r_value numeric)
language plpgsql
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_row  discount_codes%rowtype;
begin
  if v_code = '' then
    return query select false, 'Código inválido.', null::text, null::discount_type, null::numeric; return;
  end if;

  select * into v_row from discount_codes where code = v_code for update;

  if not found then
    return query select false, 'Código inválido.', null::text, null::discount_type, null::numeric; return;
  end if;
  if not v_row.active then
    return query select false, 'Este código ya no está activo.', null::text, null::discount_type, null::numeric; return;
  end if;
  if v_row.expires_at is not null and v_row.expires_at < current_date then
    return query select false, 'Este código venció.', null::text, null::discount_type, null::numeric; return;
  end if;
  if v_row.max_uses > 0 and v_row.used_count >= v_row.max_uses then
    return query select false, 'Este código ya fue canjeado.', null::text, null::discount_type, null::numeric; return;
  end if;

  -- 1. Incrementar contador
  update discount_codes set used_count = used_count + 1 where code = v_code;

  -- 2. Registrar el canje
  insert into discount_code_redemptions (
    code, source, reference_id, reference_label, method, amount, redeemed_by
  ) values (
    v_row.code, p_source, p_reference_id, p_reference_label, p_method, p_amount, p_redeemed_by
  );

  return query select true, null::text, v_row.code, v_row.type, v_row.value;
end;
$$;

-- PostgREST cachea la firma de las funciones: sin esto el primer `db.rpc()`
-- responde "Could not find the function … in the schema cache".
notify pgrst, 'reload schema';

-- ============================================================================
-- Cierre de 0002_functions.sql
-- ============================================================================
