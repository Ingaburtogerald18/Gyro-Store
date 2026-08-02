-- ============================================================================
-- Migración 0013: RPCs de reportería de ventas
-- ============================================================================
-- Extiende el módulo de reportes (0004) con los cortes que pide el Dashboard:
-- tendencia temporal, ranking de vendedores, top de productos, desgloses
-- (método/origen/facturación/descuento/cuotas) y delivery.
--
-- Igual que `get_financial_kpis`, todo se resuelve EN LA BASE. Agregar decenas
-- de miles de `order_items` en TypeScript obligaría a traerlos a memoria; acá
-- Postgres devuelve la fila ya sumada. Son `security definer` porque leen
-- tablas con RLS deny-all (el backend entra con service_role, pero la función
-- tiene que poder leer igual si algún día se llama con otro rol).
--
-- El universo de "venta" es SIEMPRE el mismo: `orders` con status en
-- ('approved','paid'), fechado por `orders.created_at`. Las pendientes de
-- aprobación no son ventas todavía y las rechazadas nunca lo fueron.
--
-- OJO con `p_seller_uid`: es el mecanismo que permite que un vendedor vea
-- SOLO lo suyo. La ruta lo fuerza a `req.user.uid` para los no-admin; acá
-- simplemente se respeta el filtro.
-- ============================================================================

-- ============================================================================
-- RPC: get_sales_trend
-- ============================================================================
-- Serie temporal para el gráfico de tendencia. `p_bucket` viene de la UI según
-- el largo del rango elegido (un rango de un año en barras diarias serían 365
-- barras ilegibles).
--
-- El `case` no es decorativo: `date_trunc` acepta cualquier texto y explota con
-- un error de Postgres si no reconoce el campo. Al reducir la entrada a tres
-- valores conocidos, un `p_bucket` basura degrada a 'month' en vez de romper.
--
-- `date_trunc` sobre timestamptz usa el TimeZone de la sesión (UTC en Supabase),
-- así que los cortes de mes/semana son en UTC. Para Nicaragua (UTC-6) eso mueve
-- las ventas de las últimas 6 horas del mes al mes siguiente — se acepta: el
-- reporte es de tendencia, no contable.
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
-- comparativo entre vendedores, y no hay ningún caso en que un vendedor deba
-- pedirlo "para sí mismo" — para eso están los KPIs. La ruta lo bloquea con
-- 403 para los no-admin.
--
-- Se agrupa por (seller_uid, seller_email) y no solo por uid: las ventas viejas
-- pueden traer el correo sin el uid resuelto, y colapsarlas todas en un único
-- grupo `null` mezclaría a gente distinta. `seller_name` sale de `profiles`
-- porque es el nombre registrado en el sistema, que es lo que el dueño quiere
-- leer en los reportes (el correo queda como identificador de respaldo).
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
-- tres productos caros a la hora de decidir qué reponer. Las unidades igual
-- viajan en la fila para poder leer las dos cosas.
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
-- Los cinco cortes por los que el dueño quiere partir el periodo, en UN solo
-- jsonb. Cinco RPCs separados serían cinco round-trips y cinco veces el mismo
-- escaneo de `orders`; acá el CTE `base` se recorre una vez.
--
-- El monto de cada corte sale de `orders.total` y NO de sumar `order_items`:
-- `total` ya refleja el total real cobrado (incluye el descuento de la factura
-- prorrateado), y sumar las líneas multiplicaría las filas al cruzar con
-- `invoices` e `installments`.
--
-- Nota sobre el descuento: `orders` no tiene `discount_code` — el código vive
-- en la factura (0009). Por eso una venta sin factura nunca puede contar como
-- "con código", que es correcto: el canje se registra al facturar.
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
-- que se le cobró al cliente en la factura por el envío — que es exactamente el
-- número que el dueño quiere monitorear (lo que entra por delivery y termina
-- saliendo hacia el repartidor). NO es un costo registrado de forma
-- independiente: si algún día se paga al repartidor un monto distinto del
-- cobrado, hay que registrarlo aparte y este reporte deja de alcanzar.
--
-- Se agrupa por `delivery_name`, con las facturas sin repartidor asignado bajo
-- un rótulo propio en vez de desaparecer: son justo las que hay que perseguir.
--
-- ── Por qué entran TODAS las facturas, incluidas las anuladas ──
-- El total es el delivery pagado en todas las facturas del periodo. Anular una
-- factura no devuelve la plata del envío: si el paquete salió y al repartidor
-- ya se le pagó, ese gasto ocurrió aunque el papel se haya invalidado después.
-- Excluirlas subestimaría justo lo que se quiere monitorear. Igual viajan
-- aparte (`total_anulado` / `num_anuladas`) para que el número sea auditable y
-- no esconda nada.
drop function if exists get_delivery_summary(timestamptz, timestamptz);

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
    -- El único filtro que queda: una factura con envío en 0 no tuvo delivery,
    -- y contarla inflaría el número de entregas sin sumar un peso.
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

-- PostgREST cachea la firma de las funciones: sin esto, el primer `db.rpc()`
-- responde "Could not find the function public.get_sales_trend in the schema
-- cache" aunque la función ya exista.
notify pgrst, 'reload schema';
