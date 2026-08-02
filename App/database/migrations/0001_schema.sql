-- ============================================================================
-- Gyro Store v2 · 0001 · Esquema completo
-- ============================================================================
-- BASELINE EN ESTADO FINAL. Este archivo describe la base tal como debe quedar
-- en una instalación NUEVA — no es un historial. Las 17 migraciones
-- incrementales que lo precedieron se colapsaron acá: cada tabla se define una
-- sola vez, ya con todas sus columnas.
--
-- ⚠️  NO re-aplicar sobre la base de producción, que ya está migrada.
--     Los cambios futuros van en un archivo incremental nuevo (`0004_…`).
--
-- Orden del archivo: función de utilidad → enums → secuencias → tablas (en
-- orden de dependencia de FK) → Storage → RLS → triggers.
--
-- ── Principio de seguridad (doc 02/03) ──
-- RLS en DENY-ALL sobre TODAS las tablas de `public`, sin políticas: nadie con
-- la anon/authenticated key lee ni escribe. El backend usa la `service_role`,
-- que ignora RLS por diseño. La única excepción son las políticas de
-- `storage.objects`, y es deliberada: el bucket sirve las fotos del catálogo
-- público.
-- ============================================================================

-- ── Función: mantener updated_at ──
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Enums
-- ============================================================================
-- Un tipo es global a la base, así que van todos juntos en vez de repartidos
-- por el archivo.

-- Roles del sistema. global_admin = acceso total.
create type app_role as enum (
  'global_admin',
  'admin',
  'seller',
  'cashier',
  'logistics_admin',
  'logistics_customer'
);

create type purchase_status as enum ('china', 'pending', 'received');
create type order_status as enum ('pending_approval', 'approved', 'paid', 'rejected');

-- 'migrated' marca las ventas registradas como provenientes del histórico
-- viejo. El módulo de inventario migrado se eliminó, pero el valor se conserva:
-- hay órdenes cerradas que lo usan.
create type sale_origin as enum ('native', 'migrated');

-- 'void' = factura anulada. Borrar una factura emitida por error dejaría un
-- hueco en el correlativo, que es justo lo que un correlativo no puede tener:
-- el número se conserva y el documento queda marcado con quién y por qué.
create type invoice_status as enum ('unlinked', 'linked', 'void');

create type payment_method as enum ('efectivo', 'transferencia', 'tarjeta');
create type loss_category as enum ('robo', 'dano', 'devolucion', 'regalias');
create type feedback_type as enum ('bug', 'idea', 'product');
create type contact_origin as enum ('fb_ads', 'organic', 'whatsapp_link', 'referral', 'other');
create type follow_up_status as enum ('pending', 'completed', 'cancelled');
create type conversation_status as enum ('bot', 'needs_human', 'closed');
create type message_direction as enum ('inbound', 'outbound');
create type cuenta_tipo as enum ('banco', 'efectivo');
create type movimiento_tipo as enum ('ingreso', 'egreso');
create type discount_type as enum ('percent', 'fixed');
create type redemption_source as enum ('checkout', 'invoice', 'sale');

-- ============================================================================
-- Secuencias
-- ============================================================================
-- Van antes de las tablas que las usan en su `default`.
--
-- Los dos correlativos son atómicos por diseño: dos requests concurrentes que
-- leyeran "el último número" para sumarle 1 podrían calcular el mismo.
-- `nextval()` no. Y ninguna se reinicia: un número descartado queda quemado,
-- que es lo correcto para algo que ya pudo haberse impreso o repartido.
create sequence invoice_number_seq;
create sequence discount_code_seq;

-- ============================================================================
-- Tabla: profiles
-- ============================================================================
-- Perfil de aplicación del staff, 1:1 con auth.users (Supabase Auth). Los roles
-- que no salen de la whitelist de env (ADMIN_EMAILS) viven acá (doc 03 §A.3).
--
-- `bank_account` es jsonb y no text porque son TRES datos, no uno:
--     { "bank": "lafise", "currency": "NIO", "number": "1234567890" }
-- Un string libre ("BAC 123456 córdobas") obliga a parsear con regex para saber
-- a qué banco transferir, y cada quien lo escribe distinto. Es dato sensible:
-- solo sale por endpoints `requireAdmin`.
--
-- `last_login` sirve para detectar cuentas inactivas antes de darlas de baja.
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null unique,
  name            text,
  avatar_url      text,
  roles           app_role[] not null default '{}',
  status          text not null default 'active',   -- 'active' | 'disabled'
  deleted_at      timestamptz,                       -- soft-delete (papelera 30 días)
  phone           text,
  personal_email  text,
  bank_account    jsonb,
  last_login      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_email_idx on profiles (email);

-- ============================================================================
-- Tabla: categories
-- ============================================================================
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- Tabla: templates
-- ============================================================================
-- El molde reutilizable. `category_id` filtra qué plantillas se ofrecen al
-- editar un producto de esa categoría.
create table templates (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  description  text,                              -- nota interna del molde
  category_id  uuid references categories(id) on delete set null,
  -- `axes` es un ARRAY ORDENADO: [{ key, label, options[], isColor }]. El orden
  -- importa porque define cómo se arma el nombre de la combinación ("Negro /
  -- Con micrófono"), y ese string es la LLAVE de `catalog_items.variant_mappings`.
  -- Un objeto jsonb no garantiza orden; un array sí. De ahí el default '[]'.
  axes         jsonb default '[]',
  specs        jsonb default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index templates_category_id_idx on templates (category_id);

-- ============================================================================
-- Tabla: catalog_items
-- ============================================================================
-- El producto que se vende.
create table catalog_items (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid references templates(id) on delete set null,
  base_price        numeric(12,2),
  price             numeric(12,2),
  precio_sugerido   numeric(12,2),
  precio_tentativo  numeric(12,2),
  variant_mappings  jsonb default '{}',
  axis_options      jsonb default '{}',
  images            jsonb default '[]',
  images_by_color   jsonb default '{}',
  published         boolean not null default false,
  is_promo          boolean not null default false,
  sort_order        integer not null default 0,
  -- Nombre y descripción PROPIOS del producto, independientes del molde: como
  -- las plantillas son reutilizables, dos productos que comparten molde
  -- compartirían el nombre. "Plantilla Audífonos KZ" y "KZ ZSN Pro X" son cosas
  -- distintas, así que cada una vive en su tabla.
  name              text,
  description       text,
  category_id       uuid references categories(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index catalog_items_published_sort_order_idx on catalog_items (published, sort_order);
create index catalog_items_category_id_idx on catalog_items (category_id);

-- ============================================================================
-- Tabla: combos
-- ============================================================================
create table combos (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  price       numeric(12,2),
  items       jsonb default '[]',
  images      jsonb default '[]',
  published   boolean not null default false,
  sort_order  integer default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- Tabla: contacts
-- ============================================================================
-- `phone` es la identidad natural del contacto (es el canal por el que se
-- cierra la venta), de ahí el UNIQUE.
create table contacts (
  id          uuid primary key default gen_random_uuid(),
  phone       text unique,
  name        text,
  origin      contact_origin not null default 'other',
  stage       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- El unique ya implica índice sobre phone; `stage` es el otro campo de filtro.
create index contacts_stage_idx on contacts (stage);

-- ============================================================================
-- Tabla: contact_activities
-- ============================================================================
create table contact_activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  type        text,
  note        text,
  created_at  timestamptz not null default now()
);

create index contact_activities_contact_id_idx on contact_activities (contact_id);

-- ============================================================================
-- Tabla: follow_ups
-- ============================================================================
create table follow_ups (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references contacts(id) on delete cascade,
  scheduled_date  date,
  reason          text,
  status          follow_up_status not null default 'pending',
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index follow_ups_contact_id_idx on follow_ups (contact_id);
create index follow_ups_status_idx on follow_ups (status);

-- ============================================================================
-- Tabla: whatsapp_conversations
-- ============================================================================
-- `contact_id` admite null y es `on delete set null`: una conversación puede
-- entrar de un número que todavía no está dado de alta como contacto, y borrar
-- el contacto no debe borrar el historial. Por eso también se guarda `phone`.
create table whatsapp_conversations (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid references contacts(id) on delete set null,
  phone            text,
  status           conversation_status not null default 'bot',
  assigned_to      uuid references profiles(id) on delete set null,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

create index whatsapp_conversations_contact_id_idx on whatsapp_conversations (contact_id);
create index whatsapp_conversations_phone_idx on whatsapp_conversations (phone);

-- ============================================================================
-- Tabla: whatsapp_messages
-- ============================================================================
-- `wa_message_id` es el id que devuelve la API de WhatsApp: permite conciliar
-- los callbacks de estado (entregado / leído) con el mensaje local.
create table whatsapp_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references whatsapp_conversations(id) on delete cascade,
  direction        message_direction,
  body             text,
  wa_message_id    text,
  template_name    text,
  status           text,
  created_at       timestamptz not null default now()
);

create index whatsapp_messages_conversation_id_idx on whatsapp_messages (conversation_id);

-- ============================================================================
-- Tabla: purchases
-- ============================================================================
-- El ledger REAL del FIFO: cada lote comprado en China con su costeo
-- (doc 11 §1-2). Es lo que se reserva y se descuenta al vender, no `products`.
--
-- `quantity_sold` y `quantity_reserved` se mueven contra `quantity`; el check
-- de tabla garantiza que nunca se comprometa más stock del que existe, aunque
-- dos requests concurrentes pasen la validación de TypeScript.
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

-- ============================================================================
-- Tabla: invoices
-- ============================================================================
-- El correlativo de factura es un REQUISITO LEGAL: no puede duplicarse ni tener
-- huecos. El UNIQUE de `invoice_number` protege el correlativo en sí; el índice
-- único PARCIAL sobre `sale_id` impide que dos requests concurrentes emitan dos
-- facturas (dos números quemados) para la misma venta, sin bloquear las
-- facturas todavía sin vincular (`sale_id is null`, que pueden ser muchas).
-- La validación en TypeScript es check-then-insert y no es atómica; esto sí.
--
-- `invoice_code` es GENERADA: el código legible que se imprime y que el
-- vendedor tipea (`GS-PR-12`). El cast `::text` es obligatorio — sin él la
-- concatenación usa `anytextcat`, que es STABLE y no IMMUTABLE, y Postgres
-- rechaza la columna generada.
create table invoices (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid references orders(id) on delete set null,
  invoice_number  bigint default nextval('invoice_number_seq'),
  invoice_code    text generated always as ('GS-PR-' || invoice_number::text) stored,
  status          invoice_status not null default 'unlinked',
  method          payment_method,
  customer_name   text,
  phone           text,
  subtotal        numeric(12,2),
  discount        numeric(12,2) default 0,
  discount_code   text,
  delivery_fee    numeric(12,2) default 0,
  delivery_name   text,
  total           numeric(12,2),
  voided_at       timestamptz,
  voided_by       uuid references profiles(id) on delete set null,
  void_reason     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_invoice_number_unique unique (invoice_number)
);

-- El listado del panel filtra por estado y ordena por número descendente.
create index invoices_status_number_idx on invoices (status, invoice_number desc);
create index invoices_invoice_code_idx on invoices (invoice_code);
create unique index invoices_sale_id_unique_idx on invoices (sale_id) where sale_id is not null;

-- ============================================================================
-- Tabla: invoice_items
-- ============================================================================
-- Las líneas de la factura, que existen ANTES de que haya una venta vinculada
-- (modelo inverso al POS: primero se emite el ticket, después se registra la
-- venta con ese número).
create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  sku         text,
  quantity    int not null check (quantity > 0),
  unit_price  numeric(12,2),
  line_total  numeric(12,2),
  created_at  timestamptz not null default now()
);

create index invoice_items_invoice_id_idx on invoice_items (invoice_id);

-- ============================================================================
-- Tabla: public_orders
-- ============================================================================
-- El pedido del checkout público. Guarda a dónde hay que despachar: el pedido
-- se cierra por WhatsApp, pero el panel necesita el destino sin depender de ese
-- mensaje. `discount_code` / `code_discount` dejan el rastro del canje.
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
  discount_code    text,
  code_discount    numeric(12,2) default 0,
  created_at       timestamptz not null default now()
);

-- Se listan por fecha descendente; el índice evita el sort completo al crecer.
create index public_orders_created_at_idx on public_orders (created_at desc);

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

-- ============================================================================
-- Tabla: account_movements
-- ============================================================================
-- Libro diario de ingresos y egresos de las cuentas.
create table account_movements (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id) on delete restrict,
  tipo             movimiento_tipo not null,
  monto            numeric(12,2) not null check (monto > 0),
  categoria        text not null,
  descripcion      text,
  comprobante_url  text,
  ocurrio_at       timestamptz not null default now(),
  registrado_por   uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index account_movements_account_id_idx on account_movements (account_id);

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

create index expenses_created_at_idx on expenses (created_at);

-- ============================================================================
-- Tabla: discount_codes
-- ============================================================================
-- El admin emite códigos (ej. incentivo por reseña en Google/Facebook) y el
-- cliente los aplica en el checkout público, en una factura POS o al registrar
-- una venta.
--
-- El código en MAYÚSCULAS es la PRIMARY KEY natural → unicidad sin query extra.
-- Lo genera la secuencia (`GS-DC-1`, `GS-DC-2`, …): un código correlativo y
-- legible se dicta por teléfono sin errores, cosa que un `GYRO-A7K2QX` aleatorio
-- no permite.
--
-- `max_uses = 0` significa usos ilimitados.
create table discount_codes (
  code         text primary key default ('GS-DC-' || nextval('discount_code_seq')),
  type         discount_type not null,
  value        numeric(12,2) not null check (value > 0),
  max_uses     integer not null default 1 check (max_uses >= 0),
  used_count   integer not null default 0 check (used_count >= 0),
  active       boolean not null default true,
  expires_at   date,
  note         text default '',
  created_by   text default '',
  created_at   timestamptz not null default now()
);

-- La lista del admin ordena por fecha descendente; el índice evita el sort.
create index discount_codes_created_at_idx on discount_codes (created_at desc);

-- ============================================================================
-- Tabla: discount_code_redemptions
-- ============================================================================
-- Rastro de CADA canje: en qué factura o pedido se aplicó, por cuánto y quién.
create table discount_code_redemptions (
  id              uuid primary key default gen_random_uuid(),
  code            text not null references discount_codes(code) on delete cascade,
  source          redemption_source not null,
  reference_id    uuid,
  reference_label text,
  method          payment_method,
  amount          numeric(12,2) not null default 0,
  redeemed_by     text,
  redeemed_at     timestamptz not null default now()
);

create index discount_code_redemptions_code_idx on discount_code_redemptions (code);
create index discount_code_redemptions_redeemed_at_idx on discount_code_redemptions (redeemed_at desc);

-- ============================================================================
-- Storage: bucket de assets públicos
-- ============================================================================
-- `storage.objects` es una tabla de Supabase que ya trae RLS activo, y acá SÍ se
-- definen políticas: es la excepción al deny-all, a propósito — el bucket sirve
-- las fotos del catálogo público.
--
-- Este bloque es idempotente aunque el resto del archivo no lo sea: Postgres no
-- soporta `create policy if not exists`, así que va `drop ... if exists` antes
-- de cada `create`.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" on storage.objects
  for select
  using (bucket_id = 'public-assets');

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
-- RLS: deny-all sobre todo `public`
-- ============================================================================
-- En bucle en vez de un `alter table` por tabla: así una tabla nueva que se
-- olvide de activarlo queda igualmente protegida al re-correr el baseline, y no
-- hay 30 líneas idénticas que revisar una por una.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ============================================================================
-- Triggers de updated_at
-- ============================================================================
-- Las 14 tablas que tienen la columna. En bucle por el mismo motivo que RLS.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'categories', 'templates', 'catalog_items', 'combos',
    'contacts', 'follow_ups', 'purchases', 'products', 'orders',
    'invoices', 'installments', 'app_config', 'logistics_shipments'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end $$;

-- ============================================================================
-- Cierre de 0001_schema.sql
-- ============================================================================
