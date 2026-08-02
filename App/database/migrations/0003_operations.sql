-- ============================================================================
-- Gyro Store v2 · 0003 · Operaciones (inventario, ventas, facturas, caja)
-- ============================================================================
-- El núcleo transaccional del negocio, en orden de dependencia:
--
--   purchases          = el ledger REAL del FIFO. Cada lote comprado en China
--                        con su costeo (doc 11 §1-2). Es lo que se reserva y se
--                        descuenta al vender, no `products`.
--   products           = stock por SKU, vista de bodega para el catálogo.
--   migrated_inventory = histórico del Excel viejo. Aislado del FIFO: su costo
--                        real ya viene dado, no se recalcula (doc 03 B.3).
--   orders             = la venta del panel, con su snapshot financiero.
--   invoices           = numera una venta YA aprobada (modelo inverso al POS).
--   public_orders      = el pedido del checkout público.
--   salidas / accounts = mercadería que sale y el dinero que entra por ella.
--   commission_*       = la cuenta corriente con cada vendedor.
-- ============================================================================

-- ── Enums propios de operaciones ──
create type salida_destino as enum ('mostrador', 'delivery');
create type salida_estado as enum ('facturada', 'pendiente_registro', 'registrada', 'devuelta');
create type liquidacion_estado as enum ('no_aplica', 'pendiente', 'depositado', 'efectivo_recibido', 'recordar');
create type cuenta_tipo as enum ('banco', 'efectivo');
create type movimiento_tipo as enum ('ingreso', 'egreso');

-- ============================================================================
-- Tabla: purchases
-- ============================================================================
-- El lote de compra. `quantity_sold` y `quantity_reserved` se mueven contra
-- `quantity`; el check de tabla garantiza que nunca se comprometa más stock del
-- que existe, aunque dos requests concurrentes pasen la validación de TypeScript.
create table purchases (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  lot                 text,
  status              purchase_status not null default 'china',
  purchase_date       date not null,
  quantity            integer not null check (quantity >= 0),
  quantity_sold       integer not null default 0 check (quantity_sold >= 0),
  quantity_reserved   integer not null default 0 check (quantity_reserved >= 0),
  costo_china_usd     numeric(12,4),
  impuesto_unit_usd   numeric(12,4) default 0,
  envio_unit_usd      numeric(12,4) default 0,
  exchange_rate       numeric(8,4),
  costo_real_usd      numeric(12,4),
  costo_real_cs       numeric(12,2),
  product_name        text not null default 'No Name',
  category            text,
  arrival_date        date,
  suggested_price     numeric(12,2),
  costo_f_u           numeric(12,2),
  coste_final         numeric(12,2),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint purchases_stock_check check (quantity_sold + quantity_reserved <= quantity)
);

create index purchases_purchase_date_idx on purchases (purchase_date);
create index purchases_status_idx on purchases (status);

alter table purchases enable row level security;

create trigger purchases_set_updated_at
  before update on purchases
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: products
-- ============================================================================
create table products (
  id                uuid primary key default gen_random_uuid(),
  sku               text not null unique,
  code              text,
  catalog_item_id   uuid references catalog_items (id) on delete set null,
  stock             integer not null default 0 check (stock >= 0),
  costo_f_u         numeric(12,2),
  coste_final       numeric(12,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index products_sku_idx on products (sku);
create index products_catalog_item_id_idx on products (catalog_item_id);

alter table products enable row level security;

create trigger products_set_updated_at
  before update on products
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: migrated_inventory
-- ============================================================================
-- Histórico cargado a mano desde el Excel viejo. No corre FIFO ni participa del
-- costeo, pero el panel pide el mismo nivel de detalle que un lote: código,
-- fechas, cantidades comprometidas y desglose de costo en USD.
create table migrated_inventory (
  id                 uuid primary key default gen_random_uuid(),
  sku                text,
  name               text,
  origin             text not null default 'migrated',
  quantity           integer not null default 0,
  costo_real_cs      numeric(12,2),
  status             text not null default 'received',
  lot                text,
  code               text,
  purchase_date      date not null,
  quantity_sold      integer not null default 0 check (quantity_sold >= 0),
  quantity_reserved  integer not null default 0 check (quantity_reserved >= 0),
  cost_unit_usd      numeric(12,4),
  shipping_unit_usd  numeric(12,4),
  suggested_price    numeric(12,2),
  comments           text,
  created_at         timestamptz not null default now()
);

alter table migrated_inventory enable row level security;

-- ============================================================================
-- Tabla: orders
-- ============================================================================
create table orders (
  id              uuid primary key default gen_random_uuid(),
  status          order_status not null default 'pending_approval',
  sale_origin     sale_origin not null default 'native',
  seller_uid      uuid references profiles(id) on delete set null,
  seller_email    text,
  week_of         text,
  contact_id      uuid references contacts(id) on delete set null,
  phone           text,
  total           numeric(12,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_seller_uid_week_of_idx on orders (seller_uid, week_of);
create index orders_status_idx on orders (status);

alter table orders enable row level security;

create trigger orders_set_updated_at
  before update on orders
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: order_items
-- ============================================================================
-- Las columnas financieras (coste_final_snap, utilidad_*, salary, comision,
-- ganancia_tienda, pozos) son un SNAPSHOT que llena el backend al APROBAR la
-- orden. Se congelan a propósito: si después cambia la tasa de cambio o la
-- escala de comisiones, una venta ya aprobada no puede recalcularse sola.
create table order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  sku               text,
  quantity          integer not null check (quantity > 0),
  precio_unit       numeric(12,2),
  coste_final_snap  numeric(12,2),
  utilidad_bruta    numeric(12,2),
  salary            numeric(12,2),
  utilidad_neta     numeric(12,2),
  comision          numeric(12,2),
  ganancia_tienda   numeric(12,2),
  pozos             jsonb,
  created_at        timestamptz not null default now()
);

-- Todo reporte se une por order_id; sin este índice cada KPI hace scan completo.
create index order_items_order_id_idx on order_items (order_id);

alter table order_items enable row level security;

-- ============================================================================
-- Tabla: stock_reservations
-- ============================================================================
-- Reserva FIFO contra un lote concreto de `purchases`.
create table stock_reservations (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references orders(id) on delete cascade,
  purchase_id     uuid not null references purchases (id) on delete cascade,
  code            text,
  quantity        integer not null check (quantity > 0),
  unit_final_usd  numeric(12,4),
  status          text not null default 'active',
  created_at      timestamptz not null default now()
);

create index stock_reservations_order_id_idx on stock_reservations (order_id);
create index stock_reservations_purchase_id_idx on stock_reservations (purchase_id);

alter table stock_reservations enable row level security;

-- ============================================================================
-- Tabla: invoices
-- ============================================================================
-- El correlativo de factura es un REQUISITO LEGAL: no puede duplicarse ni tener
-- huecos. De ahí los dos UNIQUE — el de `invoice_number` protege el correlativo
-- en sí, y el de `sale_id` impide que dos requests concurrentes emitan dos
-- facturas (dos números quemados) para la misma venta. La validación en
-- TypeScript es check-then-insert y no es atómica; esto sí.
create sequence invoice_number_seq;

create table invoices (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid references orders(id) on delete set null,
  invoice_number  bigint default nextval('invoice_number_seq'),
  status          invoice_status not null default 'unlinked',
  method          payment_method,
  delivery_fee    numeric(12,2) default 0,
  total           numeric(12,2),
  voided_at       timestamptz,
  voided_by       uuid references profiles(id) on delete set null,
  void_reason     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_invoice_number_unique unique (invoice_number),
  constraint invoices_sale_id_unique unique (sale_id)
);

-- El listado del panel filtra por estado y ordena por número descendente.
create index invoices_status_number_idx on invoices (status, invoice_number desc);

alter table invoices enable row level security;

create trigger invoices_set_updated_at
  before update on invoices
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: public_orders
-- ============================================================================
-- El pedido del checkout público. Guarda a dónde hay que despachar: el pedido
-- se cierra por WhatsApp, pero el panel necesita el destino sin depender de ese
-- mensaje.
create table public_orders (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid references contacts(id) on delete set null,
  phone            text,
  total            numeric(12,2),
  status           text not null default 'new',
  customer_name    text,
  delivery_method  text check (delivery_method in ('retiro', 'envio')),
  address          text,
  location_url     text,
  note             text,
  created_at       timestamptz not null default now()
);

-- Se listan por fecha descendente; el índice evita el sort completo al crecer.
create index public_orders_created_at_idx on public_orders (created_at desc);

alter table public_orders enable row level security;

-- ============================================================================
-- Tabla: public_order_items
-- ============================================================================
create table public_order_items (
  id                uuid primary key default gen_random_uuid(),
  public_order_id   uuid not null references public_orders(id) on delete cascade,
  sku               text,
  quantity          integer not null check (quantity > 0),
  precio_unit       numeric(12,2),
  created_at        timestamptz not null default now()
);

create index public_order_items_public_order_id_idx on public_order_items (public_order_id);

alter table public_order_items enable row level security;

-- ============================================================================
-- Tabla: installments
-- ============================================================================
-- Plan de cuotas sobre una venta aprobada. El UNIQUE en `order_id` es la misma
-- defensa que el de invoices: impide dos planes para el mismo pedido cuando dos
-- requests concurrentes pasan el SELECT previo.
create table installments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id) on delete cascade,
  total       numeric(12,2),
  num_cuotas  integer,
  first_due   date,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint installments_order_id_unique unique (order_id)
);

create index installments_order_id_idx on installments (order_id);

alter table installments enable row level security;

create trigger installments_set_updated_at
  before update on installments
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: payments
-- ============================================================================
-- Pago de una CUOTA de un cliente. No confundir con `commission_payments`, que
-- es la tienda pagándole a un vendedor.
create table payments (
  id              uuid primary key default gen_random_uuid(),
  installment_id  uuid not null references installments(id) on delete cascade,
  amount          numeric(12,2),
  method          payment_method,
  paid_at         timestamptz,
  note            text,
  created_at      timestamptz not null default now()
);

create index payments_installment_id_idx on payments (installment_id);

alter table payments enable row level security;

-- ============================================================================
-- Tabla: accounts
-- ============================================================================
-- Caja física y cuentas bancarias. `on delete restrict` en los movimientos:
-- una cuenta con historial no se borra.
create table accounts (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  tipo        cuenta_tipo not null,
  moneda      text not null default 'NIO',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table accounts enable row level security;

-- ============================================================================
-- Tabla: commission_payments
-- ============================================================================
-- Lote de pago de comisiones a un vendedor. Es INMUTABLE: registra lo que
-- efectivamente se entregó. Si después se edita una venta ya pagada, su
-- comisión cambia y la diferencia NO se reescribe sobre el lote histórico —
-- se anota en `commission_adjustments` y se salda en el próximo corte.
--
-- Va en tabla propia y no en `payments` porque son entidades distintas: aquella
-- es la cuota de un cliente y su FK es `installment_id`. Compartir tabla
-- obligaría a dejar esa FK nula y distinguirlas por un flag.
create table commission_payments (
  id                  uuid primary key default gen_random_uuid(),
  seller_uid          uuid references profiles(id) on delete set null,
  -- El email se guarda ADEMÁS del uid: si el perfil se borra, el histórico de
  -- pagos tiene que seguir diciendo a quién se le pagó (la FK queda en null).
  seller_email        text not null,
  seller_name         text,

  -- Ventas cubiertas por este lote. Se guarda el arreglo en vez de una tabla
  -- puente porque el lote es inmutable: nunca se agregan ni quitan ventas
  -- después de emitido, así que no hay nada que mantener.
  order_ids           uuid[] not null default '{}',

  gross_comision      numeric(12,2) not null default 0,  -- suma de comisiones del lote
  saldo_aplicado      numeric(12,2) not null default 0,  -- ajustes arrastrados
  total_comision      numeric(12,2) not null default 0,  -- lo efectivamente entregado

  -- Liquidación de saldo suelta, sin ventas asociadas.
  is_settlement       boolean not null default false,

  payment_method      text not null default 'efectivo',
  receipt_url         text,
  -- Sin comprobante hay que justificar por qué: la ausencia queda explicada en
  -- el registro y no como un hueco silencioso.
  no_receipt_comment  text,

  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),

  constraint commission_payments_receipt_check
    check (receipt_url is not null or no_receipt_comment is not null)
);

create index commission_payments_seller_email_idx
  on commission_payments (seller_email, created_at desc);

alter table commission_payments enable row level security;

-- ============================================================================
-- Tabla: commission_adjustments
-- ============================================================================
-- La cuenta corriente con el vendedor:
--   amount > 0 → saldo A FAVOR del vendedor (la tienda le debe)
--   amount < 0 → saldo EN CONTRA (cobró de más; lo devuelve)
-- `settled` evita cobrar dos veces el mismo ajuste.
create table commission_adjustments (
  id                  uuid primary key default gen_random_uuid(),
  seller_uid          uuid references profiles(id) on delete set null,
  order_id            uuid references orders(id) on delete cascade,
  amount              numeric(12,2),
  reason              text,
  seller_email        text,
  seller_name         text,
  comision_vieja      numeric(12,2),
  comision_nueva      numeric(12,2),
  settled             boolean not null default false,
  settled_payment_id  uuid references commission_payments(id) on delete set null,
  settled_at          timestamptz,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index commission_adjustments_seller_uid_idx on commission_adjustments (seller_uid);

-- El saldo pendiente se consulta SIEMPRE filtrando por `settled = false`, que
-- es un subconjunto chico frente al histórico: índice parcial.
create index commission_adjustments_pending_idx
  on commission_adjustments (seller_email)
  where settled = false;

create index commission_adjustments_order_id_idx on commission_adjustments (order_id);

alter table commission_adjustments enable row level security;

-- ============================================================================
-- Tabla: salidas
-- ============================================================================
-- Mercadería que sale del local (mostrador o delivery) y el estado de su
-- liquidación: qué se esperaba cobrar, si ya se depositó y en qué cuenta.
create table salidas (
  id                  uuid primary key default gen_random_uuid(),
  articulo            text not null,
  destino             salida_destino not null,
  invoice_id          uuid references invoices(id) on delete set null,
  order_id            uuid references orders(id) on delete set null,
  estado              salida_estado not null default 'pendiente_registro',
  repartidor          text,
  monto_esperado      numeric(12,2),
  liquidacion         liquidacion_estado not null default 'no_aplica',
  liquidado_at        timestamptz,
  comprobante_url     text,
  cuenta_deposito_id  uuid references accounts(id) on delete set null,
  nota                text,
  salio_at            timestamptz not null default now(),
  registrado_por      uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index salidas_estado_idx on salidas (estado);
create index salidas_liquidacion_idx on salidas (liquidacion);
create index salidas_salio_at_idx on salidas (salio_at);
create index salidas_invoice_id_idx on salidas (invoice_id);
create index salidas_order_id_idx on salidas (order_id);
create index salidas_cuenta_deposito_id_idx on salidas (cuenta_deposito_id);

alter table salidas enable row level security;

create trigger salidas_set_updated_at
  before update on salidas
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: account_movements
-- ============================================================================
-- Libro diario de ingresos y egresos. `salida_id` enlaza el movimiento con la
-- entrega que lo originó, cuando la hay.
create table account_movements (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id) on delete restrict,
  tipo             movimiento_tipo not null,
  monto            numeric(12,2) not null check (monto > 0),
  categoria        text not null,
  descripcion      text,
  salida_id        uuid references salidas(id) on delete set null,
  comprobante_url  text,
  ocurrio_at       timestamptz not null default now(),
  registrado_por   uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index account_movements_account_id_idx on account_movements (account_id);
create index account_movements_salida_id_idx on account_movements (salida_id);

alter table account_movements enable row level security;

-- ============================================================================
-- Cierre de archivo 0003_operations.sql
-- ============================================================================
