import { db } from '../supabase';
import type { PublicOrderInput } from '../../shared/schemas';

export interface CreatedPublicOrder {
  id: string;
  phone: string;
  total: number;
  status: string;
  items: Array<{ catalogItemId: string; quantity: number; unitPrice: number }>;
}

export async function createPublicOrder(input: PublicOrderInput): Promise<CreatedPublicOrder> {
  // 1. Sacar la lista de ids
  const ids = input.items.map((item) => item.catalogItemId);

  // 2. Consultar catalog_items filtrando por los ids y validando que estén publicados
  const { data: catalogData, error: catalogError } = await db
    .from('catalog_items')
    .select('id, price, base_price')
    .in('id', ids)
    .eq('published', true);

  if (catalogError) {
    throw catalogError;
  }

  // 3. Armar un Map<string, number | null>
  const priceMap = new Map<string, number | null>();
  if (catalogData) {
    for (const row of catalogData) {
      priceMap.set(row.id, row.price ?? row.base_price);
    }
  }

  const orderItems: Array<{ catalogItemId: string; quantity: number; unitPrice: number }> = [];

  // 4 y 5. Buscar y validar los precios en el Map para armar el array de items de la orden
  for (const item of input.items) {
    const price = priceMap.get(item.catalogItemId);

    // Es crucial el == null en lugar de !price para no tratar un valor de 0 como error
    if (price == null) {
      const err = new Error('Uno o más productos del pedido no están disponibles.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }

    orderItems.push({
      catalogItemId: item.catalogItemId,
      quantity: item.quantity,
      unitPrice: price,
    });
  }

  // 6. Calcular el total sumando unitPrice * quantity
  const total = orderItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  // 7. Insertar en public_orders
  const { data: order, error: orderError } = await db
    .from('public_orders')
    .insert({ phone: input.phone, total, status: 'new' })
    .select('id, phone, total, status')
    .single();

  if (orderError) {
    throw orderError;
  }

  // 8. Insertar en public_order_items
  const { error: itemsError } = await db.from('public_order_items').insert(
    orderItems.map((item) => ({
      public_order_id: order.id,
      // TODO(Claude): reemplazar por el SKU real de la variante elegida cuando el frontend soporte selección de variantes (doc 03 variant_mappings). Por ahora usamos el catalogItemId como identificador temporal.
      sku: item.catalogItemId,
      quantity: item.quantity,
      precio_unit: item.unitPrice,
    }))
  );

  // 9. Si el insert falla: borrar el public_order recién creado para no dejarlo huérfano y relanzar el error
  if (itemsError) {
    await db.from('public_orders').delete().eq('id', order.id);
    throw itemsError;
  }

  // 10. Devolver la orden construida
  return {
    ...order,
    items: orderItems,
  };
}