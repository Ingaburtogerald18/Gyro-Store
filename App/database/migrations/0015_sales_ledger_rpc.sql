-- ============================================================================
-- Migración 0015: Ledger de ventas y facturas con envío (drilldown)
-- ============================================================================
-- Alimenta los pop-ups de las StatCards de Reportería. Los KPIs de arriba dan
-- el agregado; estos RPCs dan las FILAS que lo componen, para poder auditar de
-- dónde salió cada número sin salir de la pantalla.
--
-- `get_sales_ledger` devuelve las tres cifras (vendido, coste, ganancia) en la
-- MISMA fila a propósito: los pop-ups de Total Vendido, Coste y Ganancia miran
-- el mismo dataset. Tres RPCs separados serían tres round-trips y tres veces el
-- mismo escaneo de `orders` para mostrar la misma lista con otra columna.
--
-- ── Sensible ──
-- `coste` y `ganancia` son la estructura de costos de la tienda. La ruta que lo
-- expone es `requireAdmin`, no `requireSeller`.
-- ============================================================================

-- ============================================================================
-- RPC: get_sales_ledger
-- ============================================================================
-- Una fila por ORDEN (no por línea): el agregado de `order_items` se hace acá
-- adentro, o el join multiplicaría las filas y el total del pie no cuadraría
-- con el KPI de arriba.
--
-- `cliente` sale de `contacts.name` y cae al teléfono de la orden: es lo que
-- identifica al comprador en el mostrador cuando nadie cargó el contacto.
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
    -- El código impreso (`GS-PR-12`) es lo que el usuario ve en el papel; el
    -- número pelado queda de respaldo para las facturas anteriores a 0012.
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
-- Las facturas con envío del periodo, una por fila, para el pop-up de Delivery
-- del banner. Mismo criterio que `get_delivery_summary` (0013): entran TODAS,
-- anuladas incluidas, porque anular el papel no devuelve la plata del envío que
-- ya salió.
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

-- PostgREST cachea la firma de las funciones: sin esto el primer `db.rpc()`
-- responde "Could not find the function public.get_sales_ledger".
notify pgrst, 'reload schema';
