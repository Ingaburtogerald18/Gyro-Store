import { db } from '../supabase';
import { config } from '../config';
import { round } from './finance';
import { redeemDiscountCode, computeCodeDiscount, checkDiscountCode } from './discountCode';
import type { PublicOrderInput } from '../../shared/schemas';

export interface CreatedPublicOrder {
  id: string;
  phone: string;
  total: number;
  status: string;
  items: Array<{
    catalogItemId: string;
    quantity: number;
    unitPrice: number;
    variantName?: string;
  }>;
  /** Link a WhatsApp con el pedido ya formateado, listo para abrir. */
  whatsappUrl: string;
}

interface MessageLine {
  name: string;
  variantName?: string;
  quantity: number;
  lineTotal: number;
}

// El mensaje se arma en el SERVIDOR a propósito: lleva el total recalculado
// (autoritativo) y el número de la tienda sale de config, nunca del cliente.
function buildWhatsappMessage(
  input: PublicOrderInput,
  lines: MessageLine[],
  total: number,
  discount?: { code: string; amount: number } | null,
): string {
  const money = (n: number) => `${config.currency}${Number(n || 0).toLocaleString('es-NI')}`;
  const div = '━━━━━━━━━━━━━━━';

  let msg = '🛒 *NUEVO PEDIDO — Gyro Store*\n';
  msg += `${div}\n`;
  msg += `👤 *${input.customerName}*\n`;
  msg += `📞 ${input.phone}\n`;
  if (input.deliveryMethod === 'envio') {
    msg += '🚚 *Envío a domicilio*\n';
    if (input.address) msg += `📍 ${input.address}\n`;
    if (input.locationUrl) msg += `🗺️ Ubicación: ${input.locationUrl}\n`;
  } else {
    msg += '🏬 *Retiro en tienda*\n';
  }
  if (input.note) msg += `📝 _${input.note}_\n`;

  msg += `${div}\n`;
  msg += '🛍️ *Mi pedido*\n\n';
  for (const line of lines) {
    const variant =
      line.variantName && line.variantName !== 'Estándar' ? `  _(${line.variantName})_` : '';
    msg += `🔹 *${line.name}*${variant}  ×${line.quantity}\n`;
    msg += `   💵 ${money(line.lineTotal)}\n\n`;
  }

  msg += `${div}\n`;
  if (discount && discount.amount > 0) {
    msg += `🎟️ Código ${discount.code}:  -${money(discount.amount)}\n`;
  }
  msg += `💰 *TOTAL:  ${money(total)}*\n`;
  msg += `${div}\n`;
  msg += '_¡Gracias! Quedo atento(a) para coordinar el pago._ 🙌';

  return `https://wa.me/${config.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

export async function createPublicOrder(input: PublicOrderInput): Promise<CreatedPublicOrder> {
  // 1. Sacar la lista de ids
  const ids = input.items.map((item) => item.catalogItemId);

  // 2. Consultar catalog_items filtrando por los ids y validando que estén
  // publicados. Se trae el nombre del template para poder nombrar cada línea en
  // el mensaje de WhatsApp sin confiar en lo que mandó el cliente.
  const { data: catalogData, error: catalogError } = await db
    .from('catalog_items')
    .select('id, price, base_price, template:templates(name)')
    .in('id', ids)
    .eq('published', true);

  if (catalogError) {
    throw catalogError;
  }

  // 3. Armar un Map<string, number | null>
  const priceMap = new Map<string, number | null>();
  const nameMap = new Map<string, string>();
  if (catalogData) {
    for (const row of catalogData) {
      priceMap.set(row.id, row.price ?? row.base_price);
      // El join llega como objeto o como array según la cardinalidad inferida.
      const template = row.template as unknown as { name?: string | null } | { name?: string | null }[] | null;
      const name = Array.isArray(template) ? template[0]?.name : template?.name;
      nameMap.set(row.id, name ?? 'Producto');
    }
  }

  const orderItems: Array<{
    catalogItemId: string;
    quantity: number;
    unitPrice: number;
    variantName?: string;
  }> = [];

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
      variantName: item.variantName,
    });
  }

  // 6. Calcular el subtotal sumando unitPrice * quantity
  const subtotal = round(
    orderItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0),
    2,
  );

  // 6b. Validar (preview) el código de descuento (si vino).
  // Solo leemos el código para calcular el descuento antes de crear la orden.
  let discountCode: string | null = null;
  let codeDiscount = 0;
  if (input.discountCode) {
    const checked = await checkDiscountCode(input.discountCode);
    codeDiscount = round(computeCodeDiscount(checked.type, checked.value, subtotal), 2);
    discountCode = checked.code;
  }
  const total = round(subtotal - codeDiscount, 2);

  // 7. Insertar en public_orders
  const { data: order, error: orderError } = await db
    .from('public_orders')
    .insert({
      phone: input.phone,
      total,
      status: 'new',
      discount_code: discountCode,
      code_discount: codeDiscount,
    })
    .select('id, phone, total, status')
    .single();

  if (orderError) {
    throw orderError;
  }

  // 7b. Canje real del código de descuento (ahora que tenemos referenceId).
  // Si el canje falla (alguien más lo usó en este ms), borramos la orden y abortamos.
  if (discountCode) {
    try {
      await redeemDiscountCode(discountCode, {
        source: 'checkout',
        referenceId: order.id,
        referenceLabel: 'Pedido web',
        method: null,
        amount: codeDiscount,
      });
    } catch (err) {
      await db.from('public_orders').delete().eq('id', order.id);
      throw err;
    }
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

  // 10. Devolver la orden construida + el link de WhatsApp ya formateado.
  return {
    ...order,
    items: orderItems,
    whatsappUrl: buildWhatsappMessage(
      input,
      orderItems.map((item) => ({
        name: nameMap.get(item.catalogItemId) ?? 'Producto',
        variantName: item.variantName,
        quantity: item.quantity,
        lineTotal: item.unitPrice * item.quantity,
      })),
      total,
      discountCode ? { code: discountCode, amount: codeDiscount } : null,
    ),
  };
}