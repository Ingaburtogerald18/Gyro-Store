-- ============================================================================
-- 0005 · Datos de checkout en public_orders
-- ============================================================================
-- El checkout público recoge nombre, método de entrega, dirección, ubicación
-- GPS y una nota. Hoy todo eso viaja en el mensaje de WhatsApp (que es donde se
-- cierra el pedido en el MVP), pero NO queda guardado: la tabla solo tiene
-- teléfono y total. Sin estas columnas, el panel de pedidos del Hito 2 no puede
-- mostrar a dónde hay que despachar.
--
-- Migración aditiva y idempotente: no toca datos existentes.
-- ============================================================================

alter table public_orders
  add column if not exists customer_name   text,
  add column if not exists delivery_method text check (delivery_method in ('retiro', 'envio')),
  add column if not exists address         text,
  add column if not exists location_url    text,
  add column if not exists note            text;

-- Los pedidos se listan por fecha en el panel; el índice evita el sort completo
-- cuando la tabla crezca.
create index if not exists public_orders_created_at_idx on public_orders (created_at desc);
