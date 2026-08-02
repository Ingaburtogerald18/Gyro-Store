// Ventas (MVP Hito 3, doc 09 ítem 60): cotizar, registrar, aprobar, rechazar,
// listar. Sin fotos de recibo, sin venta vía ticket de factura (invoice.ts
// todavía no existe), sin edición post-aprobación ni pago de comisiones por
// lotes — eso queda fuera de este pase (ver el plan acordado). Solo
// inventario NATIVO (`purchases` vía FIFO); vender `migrated_inventory` no
// está soportado todavía.
//
// Reciclaje de v1 (server/routes/sales/{quotes,register,manage,list}.js +
// services/{commission,sales}.js): se recicla el algoritmo de semana ISO
// (getISOWeekString → getIsoWeek, puro, sin Firebase) y la idea de "una sola
// función/cadena para cotizar y para aprobar". El resto se reescribe: v1
// resolvía costo por FIFO propio (services/sales.js, Firestore) — acá se
// consumen las funciones FIFO que ya existen en inventory.ts
// (reserveForItems/consumeReservation/releaseReservations), no se
// reimplementan. La agrupación "una venta por código+precio" de v1
// (distributeReservations) se reemplaza por una regla más simple: un
// producto no puede repetirse en dos líneas de la misma venta (Zod, shared/
// schemas.ts), así toda reserva de un `order_id` para un `product_name` dado
// pertenece sin ambigüedad a un solo order_item — no hace falta esa
// distribución.
import { db } from '../supabase';
import { round, computeCosteFinal } from './finance';
import { getFinancialConfig } from './appConfig';
import { 
  getAvailableInventory, 
  reserveForItems,
  consumeReservation,
  releaseReservations,
  releaseConsumedReservations,
  type InventoryRow,
} from './inventory';
import { formatInvoiceCode, linkInvoiceToSale, parseInvoiceCode } from './invoice';
import { BadRequestError } from '../utils/httpError';
import { applyWholesaleDiscount, computeLineCommission, computeOrderLineSnapshot } from './commission';
import type { SaleLineInput, RegisterSaleInput, UpdateSaleInput } from '../../shared/schemas';
import { firstOfEmbed } from '../utils/firstOfEmbed';
import { recordCommissionAdjustment } from './sellerPayments';

// ── Semana ISO (doc 03 B.4: orders.week_of agrupa pagos de comisión) ──
// Reciclado tal cual de v1 (getISOWeekString): algoritmo puro, sin Firebase.
function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Productos vendibles (cotizador) ──

export interface SellableProduct {
  productName: string;
  price: number;
  stock: number;
}

export async function listSellableProducts(): Promise<SellableProduct[]> {
  const rows = await getAvailableInventory();
  const byProduct = new Map<string, SellableProduct>();

  for (const row of rows) {
    const existing = byProduct.get(row.productName);
    if (existing) {
      existing.stock += row.available;
    } else {
      byProduct.set(row.productName, {
        productName: row.productName,
        price: row.suggestedPrice ?? 0,
        stock: row.available,
      });
    }
  }

  return [...byProduct.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

// Estimación de costo (solo lectura, no reserva nada): promedio ponderado del
// coste final / Costo F/U de los lotes FIFO que cubrirían `quantity` unidades
// de `productName`, usando el mismo orden (purchase_date asc) que expone
// getAvailableInventory. No es una reimplementación del FIFO de reserva/venta
// — es una lectura de lo que YA devuelve inventory.ts, sin mutar nada.
function estimateLineCost(
  productName: string,
  quantity: number,
  availableRows: InventoryRow[],
): { costeFinal: number; costoFU: number; available: number } {
  const lots = availableRows.filter((row) => row.productName === productName);
  const available = lots.reduce((sum, lot) => sum + (lot.available ?? 0), 0);

  let remaining = quantity;
  let costeFinalWeighted = 0;
  let costoFUWeighted = 0;
  let taken = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const lotAvailable = lot.available ?? 0;
    if (lotAvailable <= 0) continue;
    const take = Math.min(lotAvailable, remaining);
    const costeFinal = computeCosteFinal(lot.costRealCordobas ?? 0, lot.costoFijoCordobas ?? 0);
    costeFinalWeighted += costeFinal * take;
    costoFUWeighted += (lot.costoFijoCordobas ?? 0) * take;
    taken += take;
    remaining -= take;
  }

  return {
    costeFinal: taken > 0 ? round(costeFinalWeighted / taken, 2) : 0,
    costoFU: taken > 0 ? round(costoFUWeighted / taken, 2) : 0,
    available,
  };
}

// ── Cotizador (no persiste, no reserva) ──

export interface QuoteLine {
  productName: string;
  quantity: number;
  precioUnit: number;
  /** Costo de UNA unidad. */
  costeFinalSnap?: number;
  /** Costo de todas las unidades (`costeFinalSnap × quantity`). */
  costoTotal?: number;
  utilidadBruta?: number;
  salary?: number;
  utilidadNeta?: number;
  comision: number;
  comisionPercent: number;
  gananciaTienda?: number;

  // La cadena por unidad: el panel muestra unitario y total lado a lado, y el
  // tramo de `comisionPercent` sale del valor UNITARIO.
  utilidadBrutaUnit?: number;
  salaryUnit?: number;
  utilidadNetaUnit?: number;
  comisionUnit?: number;
  gananciaTiendaUnit?: number;

  wholesale: { discountPercent: number; warning: boolean };
  available: number;
  insufficientStock: boolean;
  belowMinMargin?: boolean;
}

export interface QuoteResult {
  lines: QuoteLine[];
  total: number;
  totalComision: number;
  totalGananciaTienda?: number;
}

export async function quoteSale(items: SaleLineInput[]): Promise<QuoteResult> {
  const [config, availableRows] = await Promise.all([getFinancialConfig(), getAvailableInventory()]);

  const lines = items.map((item) => {
    const estimate = estimateLineCost(item.productName, item.quantity, availableRows);
    const snapshot = computeOrderLineSnapshot(
      {
        sku: item.productName,
        quantity: item.quantity,
        basePrice: item.salePrice,
        costeFinal: estimate.costeFinal,
        costoFU: estimate.costoFU,
        applyWholesale: item.applyWholesale,
      },
      config,
    );

    return {
      productName: item.productName,
      quantity: snapshot.quantity,
      precioUnit: snapshot.precioUnit,
      costeFinalSnap: snapshot.costeFinalSnap,
      costoTotal: snapshot.costoTotal,
      utilidadBruta: snapshot.utilidadBruta,
      salary: snapshot.salary,
      utilidadNeta: snapshot.utilidadNeta,
      comision: snapshot.comision,
      comisionPercent: snapshot.comisionPercent,
      gananciaTienda: snapshot.gananciaTienda,
      utilidadBrutaUnit: snapshot.utilidadBrutaUnit,
      salaryUnit: snapshot.salaryUnit,
      utilidadNetaUnit: snapshot.utilidadNetaUnit,
      comisionUnit: snapshot.comisionUnit,
      gananciaTiendaUnit: snapshot.gananciaTiendaUnit,
      wholesale: snapshot.wholesale,
      available: estimate.available,
      insufficientStock: estimate.available < item.quantity,
      belowMinMargin: snapshot.precioUnit < round(snapshot.costeFinalSnap * (config.minMarginMultiplier ?? 1.15), 2),
    };
  });

  return {
    lines,
    total: round(
      lines.reduce((sum, line) => sum + line.precioUnit * line.quantity, 0),
      2,
    ),
    totalComision: round(
      lines.reduce((sum, line) => sum + line.comision, 0),
      2,
    ),
    totalGananciaTienda: round(
      lines.reduce((sum, line) => sum + line.gananciaTienda, 0),
      2,
    ),
  };
}

// ── Registro (reserva FIFO real) ──

export interface RegisteredSale {
  id: string;
  status: string;
  total: number;
}

export async function registerSale(
  input: RegisterSaleInput,
  seller: { uid: string; email: string; isAdmin?: boolean, isGlobalAdmin?: boolean },
): Promise<RegisteredSale> {
  const [config, availableRows] = await Promise.all([getFinancialConfig(), getAvailableInventory()]);
  const minMargin = config.minMarginMultiplier ?? 1.15;

  if (!input.invoiceNumber && !seller.isGlobalAdmin) {
    throw new BadRequestError('El código de factura es obligatorio para registrar la venta (excepción: global_admin).');
  }

  let finalItems = input.items;
  let finalCustomerName = input.customerName;
  let finalPhone = input.phone;
  let invoiceIdToLink: number | null = null;
  // Importe REALMENTE cobrado cuando la venta nace de una factura: es el total
  // de la factura, que ya tiene aplicado el descuento (manual y/o por código).
  let invoiceTotal: number | null = null;

  if (input.invoiceNumber) {
    // El vendedor tipea lo que ve impreso ("GS-PR-12"); acá se resuelve al
    // correlativo numérico, que es por lo que se busca en la tabla.
    const invoiceNumber = parseInvoiceCode(input.invoiceNumber);
    if (invoiceNumber === null) {
      throw new BadRequestError(`Código de factura inválido. Se espera algo como ${formatInvoiceCode(1)}.`);
    }

    const { data: existing, error: invError } = await db
      .from('invoices')
      .select('id, status, customer_name, phone, total, discount')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (invError) throw invError;
    if (!existing) throw new BadRequestError(`La factura ${formatInvoiceCode(invoiceNumber)} no existe.`);
    if (existing.status !== 'unlinked') throw new BadRequestError('Esta factura ya está vinculada o anulada.');

    invoiceIdToLink = invoiceNumber;
    finalCustomerName = existing.customer_name || input.customerName;
    finalPhone = existing.phone || input.phone;
    invoiceTotal = existing.total ?? null;

    const { data: invItems, error: itemsError } = await db
      .from('invoice_items')
      .select('sku, quantity, unit_price')
      .eq('invoice_id', existing.id);

    if (itemsError) throw itemsError;
    if (!invItems || invItems.length === 0) throw new BadRequestError('La factura no tiene productos.');

    // ── El descuento de la factura se PRORRATEA sobre las líneas ──
    // El cliente pagó menos, así que el precio efectivo de cada unidad es menor.
    // Bajarlo acá — antes de `computeOrderLineSnapshot` — hace que TODA la
    // cadena financiera (utilidad bruta → salary → utilidad neta → comisión →
    // ganancia tienda) se recalcule sobre lo realmente cobrado, sin tocar
    // `commission.ts`. Si no se prorratea, la tienda paga comisión sobre plata
    // que nunca entró.
    //
    // Se reparte proporcional al peso de cada línea: una línea que es el 70% del
    // subtotal absorbe el 70% del descuento.
    const rawSubtotal = round(
      invItems.reduce((sum, it) => sum + it.quantity * (it.unit_price ?? 0), 0),
      2,
    );
    const invoiceDiscount = round(existing.discount ?? 0, 2);
    const discountFactor =
      rawSubtotal > 0 ? Math.max(0, (rawSubtotal - invoiceDiscount) / rawSubtotal) : 1;

    finalItems = invItems.map((item) => ({
      productName: item.sku!,
      quantity: item.quantity,
      // Se redondea el UNITARIO: es lo que se congela en `order_items.precio_unit`
      // y lo que se audita después, así que tiene que ser una cifra exacta.
      salePrice: round((item.unit_price ?? 0) * discountFactor, 2),
      applyWholesale: false,
    }));
  }

  // Precio final por línea (con mayoreo ya aplicado si corresponde): es lo
  // que se congela en order_items.precio_unit y lo que usa la cadena de
  // comisión al aprobar — el mayoreo no se vuelve a evaluar después.
  const pricedLines = finalItems.map((item) => {
    const estimate = estimateLineCost(item.productName, item.quantity, availableRows);
    const snapshot = computeOrderLineSnapshot(
      {
        sku: item.productName,
        quantity: item.quantity,
        basePrice: item.salePrice,
        costeFinal: estimate.costeFinal,
        costoFU: estimate.costoFU,
        applyWholesale: item.applyWholesale,
      },
      config,
    );

    const minPrice = round(snapshot.costeFinalSnap * minMargin, 2);
    if (snapshot.precioUnit < minPrice) {
      throw new BadRequestError(
        `El precio de venta para "${item.productName}" está por debajo del margen mínimo. El mínimo aceptable es C$ ${minPrice.toFixed(2)}.`,
      );
    }

    return { productName: item.productName, quantity: item.quantity, precioUnit: snapshot.precioUnit };
  });

  // Si la venta viene de una factura, el total es EL DE LA FACTURA: es lo que el
  // cliente pagó de verdad, con el descuento ya aplicado. Antes se recalculaba
  // sumando las líneas, así que una venta con código de descuento quedaba
  // registrada por el importe SIN descontar y descuadraba contra `invoices` y
  // contra el arqueo de caja.
  //
  // La comisión ya viene descontada: `finalItems` trae los precios con el
  // descuento prorrateado, así que `precio_unit` — que es lo que usa
  // `approveSale` para la cadena de comisión — ya refleja lo cobrado.
  const linesTotal = round(
    pricedLines.reduce((sum, line) => sum + line.precioUnit * line.quantity, 0),
    2,
  );
  const total = invoiceTotal ?? linesTotal;

  let contactId: string | null = null;
  if (finalCustomerName || finalPhone) {
    if (finalPhone) {
      const { data, error } = await db
        .from('contacts')
        .upsert({ phone: finalPhone, name: finalCustomerName || null }, { onConflict: 'phone' })
        .select('id')
        .single();
      if (!error && data) contactId = data.id;
    } else if (finalCustomerName) {
      const { data, error } = await db
        .from('contacts')
        .insert({ name: finalCustomerName })
        .select('id')
        .single();
      if (!error && data) contactId = data.id;
    }
  }

  let finalSellerUid: string | null = seller.uid;
  let finalSellerEmail: string = seller.email;

  if (seller.isAdmin) {
    if (input.overrideSellerId) {
      const { data } = await db.from('profiles').select('email').eq('id', input.overrideSellerId).maybeSingle();
      if (data) {
        finalSellerUid = input.overrideSellerId;
        finalSellerEmail = data.email;
      }
    } else if (input.overrideSellerName) {
      finalSellerUid = null;
      finalSellerEmail = input.overrideSellerName;
    }
  }

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      status: 'pending_approval',
      sale_origin: 'native',
      seller_uid: finalSellerUid,
      seller_email: finalSellerEmail,
      phone: finalPhone ?? null,
      contact_id: contactId,
      total,
    })
    .select('id, status, total')
    .single();
  if (orderError) throw orderError;

  try {
    const { error: itemsError } = await db.from('order_items').insert(
      pricedLines.map((line) => ({
        order_id: order.id,
        // Sin catalog_item_id real en purchases todavía (mismo límite del
        // FIFO, ver inventory.ts): se guarda el nombre de producto en `sku`.
        sku: line.productName,
        quantity: line.quantity,
        precio_unit: line.precioUnit,
      })),
    );
    if (itemsError) throw itemsError;

    await reserveForItems(
      order.id,
      pricedLines.map((line) => ({ productName: line.productName, quantity: line.quantity })),
    );
  } catch (err) {
    // reserveForItems ya se compensa a sí misma si falla a mitad de camino;
    // esto cubre que haya fallado el insert de order_items en cambio.
    await releaseReservations(order.id);
    await db.from('orders').delete().eq('id', order.id);
    throw err;
  }

  if (invoiceIdToLink) {
    await linkInvoiceToSale(invoiceIdToLink, order.id);
  }

  return { id: order.id, status: order.status, total: order.total };
}

// ── Aprobar / Rechazar ──

interface PurchaseEmbed {
  product_name: string;
  coste_final: number | null;
  costo_f_u: number | null;
}

// Consume las reservas (reservado → vendido en purchases, vía inventory.ts) y
// congela el snapshot financiero de doc 11 §4 en cada order_item. El costo
// por línea sale de los lotes que stock_reservations realmente asignó a esa
// venta (promedio ponderado si abarcó más de un lote).
export async function approveSale(orderId: string): Promise<boolean> {
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return false;
  if (order.status !== 'pending_approval') {
    throw new BadRequestError('Solo se aprueban ventas pendientes.');
  }

  const { data: itemRows, error: itemsError } = await db
    .from('order_items')
    .select('id, sku, quantity, precio_unit')
    .eq('order_id', orderId);
  if (itemsError) throw itemsError;
  const items = (itemRows ?? []) as unknown as {
    id: string;
    sku: string;
    quantity: number;
    precio_unit: number | null;
  }[];

  const { data: reservationRows, error: reservationsError } = await db
    .from('stock_reservations')
    .select('quantity, purchases(product_name, coste_final, costo_f_u)')
    .eq('order_id', orderId)
    .eq('status', 'active');
  if (reservationsError) throw reservationsError;
  const reservations = (reservationRows ?? []) as unknown as {
    quantity: number;
    purchases: PurchaseEmbed | PurchaseEmbed[] | null;
  }[];

  const config = await getFinancialConfig();
  await consumeReservation(orderId);

  for (const item of items) {
    const lots = reservations
      .map((r) => ({ quantity: r.quantity, purchase: firstOfEmbed(r.purchases) }))
      .filter((r) => r.purchase?.product_name === item.sku);
    const takenQty = lots.reduce((sum, lot) => sum + lot.quantity, 0);

    const costeFinal =
      takenQty > 0
        ? round(lots.reduce((sum, lot) => sum + (lot.purchase?.coste_final ?? 0) * lot.quantity, 0) / takenQty, 2)
        : 0;
    const costoFU =
      takenQty > 0
        ? round(lots.reduce((sum, lot) => sum + (lot.purchase?.costo_f_u ?? 0) * lot.quantity, 0) / takenQty, 2)
        : 0;

    // Mayoreo ya quedó fijado en precio_unit al registrar: acá solo corre la
    // cadena utilidad→salary→comisión→ganancia (doc 11 §4), no se reevalúa.
    const commission = computeLineCommission(
      { precioUnit: item.precio_unit ?? 0, quantity: item.quantity, costeFinal, costoFU },
      config,
    );

    const { error: updateItemError } = await db
      .from('order_items')
      .update({
        coste_final_snap: costeFinal,
        utilidad_bruta: commission.utilidadBruta,
        salary: commission.salary,
        utilidad_neta: commission.utilidadNeta,
        comision: commission.comision,
        ganancia_tienda: commission.gananciaTienda,
        pozos: commission.pozos,
      })
      .eq('id', item.id);
    if (updateItemError) throw updateItemError;
  }

  const { error: updateOrderError } = await db
    .from('orders')
    .update({ status: 'approved', week_of: getIsoWeek(new Date()) })
    .eq('id', orderId);
  if (updateOrderError) throw updateOrderError;

  return true;
}

// Libera el stock reservado y deja un rastro en audit_logs (no hay columna de
// motivo en `orders`, pero la tabla de auditoría ya existe para esto).
export async function rejectSale(orderId: string, reason: string, rejectedBy: string): Promise<boolean> {
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return false;
  if (order.status !== 'pending_approval') {
    throw new BadRequestError('Solo se pueden rechazar ventas pendientes.');
  }

  await releaseReservations(orderId);

  const { error: updateError } = await db.from('orders').update({ status: 'rejected' }).eq('id', orderId);
  if (updateError) throw updateError;

  const { error: auditError } = await db.from('audit_logs').insert({
    entity: 'orders',
    entity_id: orderId,
    action: 'sale_rejected',
    reason,
    author_uid: rejectedBy,
  });
  if (auditError) throw auditError;

  return true;
}

// ── Listado ──

export interface SaleListItem {
  id: string;
  status: string;
  saleOrigin: string;
  sellerUid: string | null;
  sellerEmail: string;
  weekOf: string | null;
  phone: string | null;
  total: number;
  createdAt: string;
}

export async function listSales(filters: { sellerEmail?: string; status?: string }): Promise<SaleListItem[]> {
  let query = db
    .from('orders')
    .select('id, status, sale_origin, seller_uid, seller_email, week_of, phone, total, created_at')
    .order('created_at', { ascending: false });

  if (filters.sellerEmail) query = query.eq('seller_email', filters.sellerEmail);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    status: string;
    sale_origin: string;
    seller_uid: string | null;
    seller_email: string;
    week_of: string | null;
    phone: string | null;
    total: number | null;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    saleOrigin: row.sale_origin,
    sellerUid: row.seller_uid,
    sellerEmail: row.seller_email,
    weekOf: row.week_of,
    phone: row.phone,
    total: row.total ?? 0,
    createdAt: row.created_at,
  }));
}

// ── Modificación y Anulación ──

export async function updateSale(
  orderId: string,
  input: UpdateSaleInput,
  user: { uid: string; email: string; roles: string[] },
): Promise<RegisteredSale> {
  const { data: order, error: orderError } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new BadRequestError('Venta no encontrada.');

  if (!['pending_approval', 'approved', 'paid'].includes(order.status)) {
    throw new BadRequestError(`No se puede editar una venta en estado ${order.status}.`);
  }
  if (order.status !== 'pending_approval' && !input.reason) {
    throw new BadRequestError('El motivo de edición es obligatorio para ventas ya procesadas.');
  }

  const [config, availableRows] = await Promise.all([getFinancialConfig(), getAvailableInventory()]);
  const minMargin = config.minMarginMultiplier ?? 1.15;

  const pricedLines = input.items.map((item) => {
    const estimate = estimateLineCost(item.productName, item.quantity, availableRows);
    const snapshot = computeOrderLineSnapshot(
      {
        sku: item.productName,
        quantity: item.quantity,
        basePrice: item.salePrice,
        costeFinal: estimate.costeFinal,
        costoFU: estimate.costoFU,
        applyWholesale: item.applyWholesale,
      },
      config,
    );

    const minPrice = round(snapshot.costeFinalSnap * minMargin, 2);
    if (snapshot.precioUnit < minPrice) {
      throw new BadRequestError(
        `El precio de venta para "${item.productName}" está por debajo del margen mínimo. El mínimo aceptable es C$ ${minPrice.toFixed(2)}.`,
      );
    }
    return { productName: item.productName, quantity: item.quantity, precioUnit: snapshot.precioUnit };
  });

  const newTotal = round(
    pricedLines.reduce((sum, line) => sum + line.precioUnit * line.quantity, 0),
    2,
  );

  let oldComision = 0;
  if (order.status === 'paid') {
    const { data: oldItems } = await db.from('order_items').select('comision').eq('order_id', orderId);
    oldComision = (oldItems || []).reduce((sum, it) => sum + (Number(it.comision) || 0), 0);
  }

  if (order.status === 'pending_approval') {
    await releaseReservations(orderId);
  } else {
    await releaseConsumedReservations(orderId);
  }

  let contactId: string | null = order.contact_id ?? null;
  if (input.customerName || input.phone) {
    if (input.phone) {
      const { data, error } = await db
        .from('contacts')
        .upsert({ phone: input.phone, name: input.customerName || null }, { onConflict: 'phone' })
        .select('id')
        .single();
      if (!error && data) contactId = data.id;
    } else if (input.customerName) {
      const { data, error } = await db
        .from('contacts')
        .insert({ name: input.customerName })
        .select('id')
        .single();
      if (!error && data) contactId = data.id;
    }
  } else {
     if (input.customerName === '' && input.phone === '') {
       contactId = null;
     }
  }

  const isAdmin = user.roles.includes('admin') || user.roles.includes('global_admin');
  
  // Si no es admin, mantenemos los valores originales de la base de datos (por eso no incluimos los campos en el update).
  // Si es admin, evaluamos los overrides.
  const updatePayload: any = {
    total: newTotal,
    phone: input.phone || null,
    contact_id: contactId,
    status: 'pending_approval',
  };

  if (isAdmin) {
    if (input.overrideSellerId) {
      const { data } = await db.from('profiles').select('email').eq('id', input.overrideSellerId).maybeSingle();
      if (data) {
        updatePayload.seller_uid = input.overrideSellerId;
        updatePayload.seller_email = data.email;
      }
    } else if (input.overrideSellerName) {
      updatePayload.seller_uid = null;
      updatePayload.seller_email = input.overrideSellerName;
    }
  }

  const { error: updError } = await db
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId);
  if (updError) throw updError;

  await db.from('order_items').delete().eq('order_id', orderId);

  const { error: itemsError } = await db.from('order_items').insert(
    pricedLines.map((line) => ({
      order_id: orderId,
      sku: line.productName,
      quantity: line.quantity,
      precio_unit: line.precioUnit,
    })),
  );
  if (itemsError) throw itemsError;

  try {
    await reserveForItems(
      orderId,
      pricedLines.map((line) => ({ productName: line.productName, quantity: line.quantity })),
    );
  } catch (err) {
    throw err;
  }

  if (order.status === 'approved' || order.status === 'paid') {
    await approveSale(orderId);

    if (order.status === 'paid') {
      await db.from('orders').update({ status: 'paid' }).eq('id', orderId);
      const { data: newItems } = await db.from('order_items').select('comision').eq('order_id', orderId);
      const newComision = (newItems || []).reduce((sum, it) => sum + (Number(it.comision) || 0), 0);

      await recordCommissionAdjustment({
        sellerEmail: order.seller_email,
        sellerUid: order.seller_uid,
        orderId: orderId,
        comisionVieja: oldComision,
        comisionNueva: newComision,
        reason: input.reason || 'Edición post-pago',
        createdBy: user.uid,
      });
    }
  }

  await db.from('audit_logs').insert({
    entity: 'orders',
    entity_id: orderId,
    action: 'sale_updated',
    reason: input.reason || 'Edición de venta',
    author_uid: user.uid,
  });

  return { id: orderId, status: order.status === 'pending_approval' ? 'pending_approval' : order.status, total: newTotal };
}

export async function deleteSale(orderId: string, reason: string, user: { uid: string; email: string; roles: string[] }) {
  const { data: order, error: orderError } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new BadRequestError('Venta no encontrada.');

  // La venta puede tener una factura asociada (sale_id en invoices). 
  // Al anular o borrar la venta, idealmente deberíamos bloquear o dejar 
  // la factura huérfana. Como la tabla invoices tiene la FK con set null, 
  // al borrar la orden la factura quedará unlinked de nuevo (o deberíamos anularla).
  // TODO: Decidir si al borrar la venta se anula también la factura en cadena.

  if (order.status === 'pending_approval') {
    await releaseReservations(orderId);
  } else {
    await releaseConsumedReservations(orderId);
  }

  let oldComision = 0;
  if (order.status === 'paid') {
    const { data: oldItems } = await db.from('order_items').select('comision').eq('order_id', orderId);
    oldComision = (oldItems || []).reduce((sum, it) => sum + (Number(it.comision) || 0), 0);
  }

  await db.from('order_items').delete().eq('order_id', orderId);
  await db.from('orders').delete().eq('id', orderId);

  if (order.status === 'paid') {
    await recordCommissionAdjustment({
      sellerEmail: order.seller_email,
      sellerUid: order.seller_uid,
      orderId: orderId,
      comisionVieja: oldComision,
      comisionNueva: 0,
      reason: reason || 'Venta eliminada',
      createdBy: user.uid,
    });
  }

  await db.from('audit_logs').insert({
    entity: 'orders',
    entity_id: orderId,
    action: 'sale_deleted',
    reason: reason || 'Venta anulada',
    author_uid: user.uid,
  });

  return true;
}
