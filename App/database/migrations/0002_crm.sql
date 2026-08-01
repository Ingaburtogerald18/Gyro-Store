-- ============================================================================
-- Gyro Store v2 · 0002 · CRM (contactos, seguimientos, WhatsApp)
-- ============================================================================
-- El contacto es la persona detrás de cada pedido: la misma entidad la
-- referencian tanto las ventas del panel (`orders`) como el checkout público
-- (`public_orders`). Por eso este archivo va ANTES de operaciones — así esas
-- FKs se declaran inline en su columna y no como un ALTER posterior.
--
-- `phone` es la identidad natural del contacto (es el canal por el que se
-- cierra la venta), de ahí el UNIQUE.
-- ============================================================================

-- ============================================================================
-- Tabla: contacts
-- ============================================================================
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

alter table contacts enable row level security;

create trigger contacts_set_updated_at
  before update on contacts
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: contact_activities
-- ============================================================================
-- Bitácora libre de interacciones con el contacto.
create table contact_activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  type        text,
  note        text,
  created_at  timestamptz not null default now()
);

create index contact_activities_contact_id_idx on contact_activities (contact_id);

alter table contact_activities enable row level security;

-- ============================================================================
-- Tabla: follow_ups
-- ============================================================================
-- Recordatorio agendado sobre un contacto. Se lista por contacto y por estado.
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

alter table follow_ups enable row level security;

create trigger follow_ups_set_updated_at
  before update on follow_ups
  for each row
  execute function set_updated_at();

-- ============================================================================
-- Tabla: whatsapp_conversations
-- ============================================================================
-- `contact_id` admite null y es `on delete set null`: una conversación puede
-- entrar de un número que todavía no está dado de alta como contacto, y borrar
-- el contacto no debe borrar el historial de mensajes. Por eso también se
-- guarda `phone` suelto.
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

alter table whatsapp_conversations enable row level security;

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

alter table whatsapp_messages enable row level security;

-- ============================================================================
-- Cierre de archivo 0002_crm.sql
-- ============================================================================
