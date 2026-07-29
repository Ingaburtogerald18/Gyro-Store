-- ============================================================================
-- Gyro Store v2 · Migración 0004 · Soporte, Logística, Contactos y Otros
-- ============================================================================
-- Esta migración crea las tablas de soporte, logística, historial de contactos,
-- cuotas, pagos y eventos de analítica y auditoría.
-- 
-- Principio de seguridad (doc 03): RLS en DENY-ALL. Nadie con la anon key
-- lee ni escribe. El backend usa la `service_role`, que IGNORA las RLS.
-- ============================================================================

-- ── Tabla: app_config ──
create table app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table app_config enable row level security;

create trigger app_config_set_updated_at
  before update on app_config
  for each row
  execute function set_updated_at();

-- ── Tabla: losses ──
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

-- rls: deny-all intencional (sin políticas definidas)
alter table losses enable row level security;

-- ── Tabla: audit_logs ──
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

-- rls: deny-all intencional (sin políticas definidas)
alter table audit_logs enable row level security;

-- ── Tabla: installments ──
create table installments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id) on delete cascade,
  total       numeric(12,2),
  num_cuotas  integer,
  first_due   date,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index installments_order_id_idx on installments (order_id);

-- rls: deny-all intencional (sin políticas definidas)
alter table installments enable row level security;

create trigger installments_set_updated_at
  before update on installments
  for each row
  execute function set_updated_at();

-- ── Tabla: payments ──
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

-- rls: deny-all intencional (sin políticas definidas)
alter table payments enable row level security;

-- ── Tabla: commission_adjustments ──
create table commission_adjustments (
  id          uuid primary key default gen_random_uuid(),
  seller_uid  uuid references profiles(id) on delete set null,
  order_id    uuid references orders(id) on delete cascade,
  amount      numeric(12,2),
  reason      text,
  created_at  timestamptz not null default now()
);

create index commission_adjustments_seller_uid_idx on commission_adjustments (seller_uid);

-- rls: deny-all intencional (sin políticas definidas)
alter table commission_adjustments enable row level security;

-- ── Tabla: logistics_shipments ──
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

-- rls: deny-all intencional (sin políticas definidas)
alter table logistics_shipments enable row level security;

create trigger logistics_shipments_set_updated_at
  before update on logistics_shipments
  for each row
  execute function set_updated_at();

-- ── Tabla: logistics_events ──
create table logistics_events (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references logistics_shipments(id) on delete cascade,
  status      text,
  note        text,
  created_at  timestamptz not null default now()
);

create index logistics_events_shipment_id_idx on logistics_events (shipment_id);

-- rls: deny-all intencional (sin políticas definidas)
alter table logistics_events enable row level security;

-- ── Tabla: contacts ──
create table contacts (
  id          uuid primary key default gen_random_uuid(),
  phone       text unique,
  name        text,
  origin      contact_origin not null default 'other',
  stage       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- El unique implica índice en postgres, pero agregamos a otros campos de filtro
create index contacts_stage_idx on contacts (stage);

-- rls: deny-all intencional (sin políticas definidas)
alter table contacts enable row level security;

create trigger contacts_set_updated_at
  before update on contacts
  for each row
  execute function set_updated_at();

-- ── Tabla: contact_activities ──
create table contact_activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  type        text,
  note        text,
  created_at  timestamptz not null default now()
);

create index contact_activities_contact_id_idx on contact_activities (contact_id);

-- rls: deny-all intencional (sin políticas definidas)
alter table contact_activities enable row level security;

-- ── Tabla: follow_ups ──
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

-- rls: deny-all intencional (sin políticas definidas)
alter table follow_ups enable row level security;

create trigger follow_ups_set_updated_at
  before update on follow_ups
  for each row
  execute function set_updated_at();

-- ── Tabla: whatsapp_conversations ──
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

-- rls: deny-all intencional (sin políticas definidas)
alter table whatsapp_conversations enable row level security;

-- ── Tabla: whatsapp_messages ──
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

-- rls: deny-all intencional (sin políticas definidas)
alter table whatsapp_messages enable row level security;

-- ── Tabla: analytics_events ──
create table analytics_events (
  id          uuid primary key default gen_random_uuid(),
  type        text,
  payload     jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index analytics_events_type_idx on analytics_events (type);

-- rls: deny-all intencional (sin políticas definidas)
alter table analytics_events enable row level security;

-- ── Tabla: feedback ──
create table feedback (
  id          uuid primary key default gen_random_uuid(),
  type        feedback_type,
  message     text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table feedback enable row level security;

-- ── Tabla: discount_codes ──
create table discount_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  kind        text,
  value       numeric(12,2),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- rls: deny-all intencional (sin políticas definidas)
alter table discount_codes enable row level security;

-- ============================================================================
-- ── Relaciones Pendientes ──
-- ============================================================================
-- Completamos las llaves foráneas que la migración 0003_sales dejó pendientes
-- ya que dependían de la existencia de la tabla contacts.
alter table orders
  add constraint orders_contact_fk
  foreign key (contact_id) references contacts(id) on delete set null;

alter table public_orders
  add constraint public_orders_contact_fk
  foreign key (contact_id) references contacts(id) on delete set null;

-- ============================================================================
-- Cierre de archivo de migración 0004_support.sql
-- ============================================================================