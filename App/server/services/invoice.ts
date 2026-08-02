import { db } from '../supabase';
import { round } from './finance';
import { BadRequestError } from '../utils/httpError';
import type { CreateInvoiceInput } from '../../shared/schemas';
import { listSellableProducts } from './sales';
import { redeemDiscountCode, computeCodeDiscount, checkDiscountCode } from './discountCode';

export interface Invoice {
  id: string;
  saleId: string | null;
  /** Correlativo numérico: es el artefacto legal y el criterio de orden. */
  invoiceNumber: number;
  /** Código legible derivado del correlativo: `GS-PR-12`. Es lo que se imprime. */
  invoiceCode: string;
  status: string;
  method: string | null;
  deliveryFee: number;
  total: number;
  createdAt: string;
  customerName?: string | null;
  phone?: string | null;
  subtotal?: number;
  discount?: number;
  deliveryName?: string | null;
  /**
   * Líneas de la factura. Solo las trae `findInvoiceByNumber` (el lookup del
   * editor de ventas, que necesita precargarlas). `listInvoices` NO las pide:
   * serían N+1 consultas para una tabla que no las muestra.
   */
  items?: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface InvoiceRow {
  id: string;
  sale_id: string | null;
  invoice_number: number;
  invoice_code: string | null;
  status: string;
  method: string | null;
  delivery_fee: number | null;
  total: number | null;
  created_at: string;
  customer_name: string | null;
  phone: string | null;
  subtotal: number | null;
  discount: number | null;
  delivery_name: string | null;
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    saleId: row.sale_id,
    invoiceNumber: row.invoice_number,
    // Fallback por si la migración 0012 todavía no corrió: el código se puede
    // reconstruir del número, así que el panel no se queda sin identificador.
    invoiceCode: row.invoice_code ?? formatInvoiceCode(row.invoice_number),
    status: row.status,
    method: row.method,
    deliveryFee: row.delivery_fee ?? 0,
    total: row.total ?? 0,
    createdAt: row.created_at,
    customerName: row.customer_name,
    phone: row.phone,
    subtotal: row.subtotal ?? 0,
    discount: row.discount ?? 0,
    deliveryName: row.delivery_name,
  };
}

const INVOICE_COLUMNS = 'id, sale_id, invoice_number, invoice_code, status, method, delivery_fee, total, created_at, customer_name, phone, subtotal, discount, delivery_name';

export const INVOICE_CODE_PREFIX = 'GS-PR-';

export function formatInvoiceCode(n: number): string {
  return `${INVOICE_CODE_PREFIX}${n}`;
}

/**
 * Acepta lo que el vendedor tenga a mano: `GS-PR-12`, `gs-pr-12`, `GSPR12` o
 * simplemente `12`. Devuelve el correlativo numérico, o `null` si no se
 * reconoce — el llamador decide el mensaje de error.
 */
export function parseInvoiceCode(raw: string | number | null | undefined): number | null {
  const cleaned = String(raw ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
  const match = cleaned.match(/^(?:GSPR)?(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Emite la factura como documento independiente (unlinked).
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  // Validar productos (que existan). No verificamos stock riguroso acá, 
  // ya que la venta final (orders) será la que haga la reserva y baje inventario.
  const sellables = await listSellableProducts();
  const validProducts = new Set(sellables.map(s => s.productName));
  
  let subtotal = 0;
  for (const item of input.items) {
    if (!validProducts.has(item.productName)) {
      throw new BadRequestError(`El producto "${item.productName}" no está en el catálogo disponible.`);
    }
    subtotal += item.quantity * item.unitPrice;
  }

  subtotal = round(subtotal, 2);

  // Código de descuento (opcional): primero preview (solo validamos)
  let discountCode: string | null = null;
  let codeDiscount = 0;
  if (input.discountCode) {
    const checked = await checkDiscountCode(input.discountCode);
    codeDiscount = round(computeCodeDiscount(checked.type, checked.value, subtotal), 2);
    discountCode = checked.code;
  }

  const manualDiscount = input.discount ?? 0;
  const discount = round(Math.min(manualDiscount + codeDiscount, subtotal), 2); // No descontar más del subtotal
  const deliveryFee = round(input.deliveryFee ?? 0, 2);
  const total = round(subtotal - discount + deliveryFee, 2);

  const { data: invoice, error: invoiceError } = await db
    .from('invoices')
    .insert({
      status: 'unlinked',
      method: input.method,
      delivery_fee: deliveryFee,
      total,
      customer_name: input.customerName || null,
      phone: input.phone || null,
      subtotal,
      discount,
      discount_code: discountCode,
      delivery_name: input.deliveryName || null,
    })
    .select(INVOICE_COLUMNS)
    .single();
    
  if (invoiceError) throw invoiceError;

  // Canje real del código de descuento
  if (discountCode) {
    try {
      await redeemDiscountCode(discountCode, {
        source: 'invoice',
        referenceId: invoice.id,
        referenceLabel: 'Factura ' + (invoice.invoice_code ?? formatInvoiceCode(invoice.invoice_number)),
        method: input.method,
        amount: codeDiscount,
        redeemedBy: null, // Si tuvieramos usuario, se pasaría aquí
      });
    } catch (err) {
      await db.from('invoices').delete().eq('id', invoice.id);
      throw err;
    }
  }

  // Insertar líneas (invoice_items)
  const itemsToInsert = input.items.map(item => ({
    invoice_id: invoice.id,
    sku: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: round(item.quantity * item.unitPrice, 2)
  }));

  const { error: itemsError } = await db
    .from('invoice_items')
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  return toInvoice(invoice as unknown as InvoiceRow);
}

// Liga una factura existente a una venta aprobada.
export async function linkInvoiceToSale(rawCode: string | number, saleId: string): Promise<Invoice> {
  const invoiceNumber = parseInvoiceCode(rawCode);
  if (invoiceNumber === null) {
    throw new BadRequestError(`Código de factura inválido. Se espera algo como ${formatInvoiceCode(1)}.`);
  }

  const { data: existing, error: findError } = await db
    .from('invoices')
    .select('id, status')
    .eq('invoice_number', invoiceNumber)
    .maybeSingle();

  if (findError) throw findError;
  if (!existing) {
    throw new BadRequestError(`La factura ${formatInvoiceCode(invoiceNumber)} no existe.`);
  }

  if (existing.status !== 'unlinked') {
    throw new BadRequestError('Esta factura ya está vinculada a una venta o está anulada.');
  }

  const { data: updated, error: updateError } = await db
    .from('invoices')
    .update({
      sale_id: saleId,
      status: 'linked'
    })
    .eq('id', existing.id)
    .select(INVOICE_COLUMNS)
    .single();
    
  if (updateError) throw updateError;
  return toInvoice(updated as unknown as InvoiceRow);
}

export async function listInvoices(filters: { status?: string } = {}): Promise<Invoice[]> {
  let query = db.from('invoices').select(INVOICE_COLUMNS).order('invoice_number', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as InvoiceRow[]).map(toInvoice);
}

// Devuelve la factura CON sus líneas: es lo que el editor de ventas usa para
// precargarse entero (productos, cantidades, precios y datos del cliente) en vez
// de obligar al vendedor a volver a tipear lo que ya está en el ticket.
export async function findInvoiceByNumber(rawCode: string | number): Promise<Invoice | null> {
  const invoiceNumber = parseInvoiceCode(rawCode);
  if (invoiceNumber === null) return null;

  const { data, error } = await db
    .from('invoices')
    .select(INVOICE_COLUMNS)
    .eq('invoice_number', invoiceNumber)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const invoice = toInvoice(data as unknown as InvoiceRow);

  const { data: itemRows, error: itemsError } = await db
    .from('invoice_items')
    .select('sku, quantity, unit_price, line_total')
    .eq('invoice_id', invoice.id);
  if (itemsError) throw itemsError;

  invoice.items = ((itemRows ?? []) as unknown as Array<{
    sku: string | null;
    quantity: number;
    unit_price: number | null;
    line_total: number | null;
  }>).map((item) => ({
    // `sku` guarda el nombre del producto (ver createInvoice).
    productName: item.sku ?? '',
    quantity: item.quantity,
    unitPrice: item.unit_price ?? 0,
    lineTotal: item.line_total ?? 0,
  }));

  return invoice;
}

/**
 * Borra la factura DEFINITIVAMENTE de la base.
 *
 * ── Por qué existe y por qué está tan acotado ──
 * El correlativo es estricto y fiscal: el número de una factura descartada
 * queda RETIRADO, nunca se reasigna (la secuencia no retrocede). Esto no es un
 * "deshacer": es sacar de la vista un papel que se anuló y del que no queda
 * nada que auditar.
 *
 * Solo se permite sobre `void` o `unlinked`. Una factura `linked` está atada a
 * una venta con su snapshot financiero: borrarla dejaría la orden apuntando a
 * un número que ya no existe.
 */
export async function deleteInvoice(id: string): Promise<boolean> {
  const { data: existing, error: findError } = await db
    .from('invoices')
    .select('id, status, sale_id')
    .eq('id', id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return false;

  if (existing.status === 'linked' || existing.sale_id) {
    throw new BadRequestError(
      'Esta factura está vinculada a una venta. Anulá o editá la venta antes de descartarla.',
    );
  }

  // `invoice_items` cae solo por el `on delete cascade` de 0007.
  const { error } = await db.from('invoices').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function voidInvoice(
  id: string,
  reason: string,
  voidedBy: string | null,
): Promise<Invoice | null> {
  const { data: existing, error: findError } = await db
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return null;

  if (existing.status === 'void') {
    throw new BadRequestError('Esta factura ya está anulada.');
  }

  const { data, error } = await db
    .from('invoices')
    .update({
      status: 'void',
      void_reason: reason,
      voided_by: voidedBy,
      voided_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(INVOICE_COLUMNS)
    .single();
  if (error) throw error;
  return toInvoice(data as unknown as InvoiceRow);
}

// Corrección de los datos de cobro. Solo para facturas unlinked.
/**
 * Corrige una factura huérfana con el mismo formulario con que se emitió,
 * LÍNEAS INCLUIDAS.
 *
 * Solo sobre `unlinked`: una vez ligada a una venta, estos números ya
 * alimentaron el snapshot financiero (costos, comisión, ganancia) y moverlos
 * dejaría la orden describiendo una venta que no ocurrió.
 *
 * El CÓDIGO de descuento no se toca: se canjeó al emitir y volver a aplicarlo
 * consumiría otro uso del código. El monto `discount` ya resuelto se conserva y
 * se le resta al subtotal nuevo.
 */
export async function updateInvoice(
  id: string,
  input: {
    method?: string;
    deliveryFee?: number;
    customerName?: string;
    phone?: string;
    deliveryName?: string;
    items?: { productName: string; quantity: number; unitPrice: number }[];
  },
): Promise<Invoice | null> {
  const { data: existing, error: findError } = await db
    .from('invoices')
    .select('id, status, subtotal, discount, delivery_fee')
    .eq('id', id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return null;

  if (existing.status !== 'unlinked') {
    throw new BadRequestError('Solo se pueden editar los datos de facturas huérfanas (unlinked).');
  }

  const patch: Record<string, unknown> = {};
  if (input.method !== undefined) patch.method = input.method;
  // `|| null` para que borrar el campo en el formulario lo deje vacío de verdad
  // y no guarde una cadena en blanco que después se imprime como un renglón mudo.
  if (input.customerName !== undefined) patch.customer_name = input.customerName.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.deliveryName !== undefined) patch.delivery_name = input.deliveryName.trim() || null;

  // ── Líneas ──
  // Se reemplazan enteras (borrar + insertar) en vez de intentar un diff: las
  // filas de `invoice_items` no tienen identidad estable en el formulario, y
  // parchear por posición se rompe apenas se borra una línea del medio.
  let subtotal = existing.subtotal ?? 0;
  if (input.items) {
    subtotal = round(
      input.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
      2,
    );

    const { error: delError } = await db.from('invoice_items').delete().eq('invoice_id', id);
    if (delError) throw delError;

    const { error: insError } = await db.from('invoice_items').insert(
      input.items.map((it) => ({
        invoice_id: id,
        sku: it.productName,
        quantity: it.quantity,
        unit_price: round(it.unitPrice, 2),
        line_total: round(it.quantity * it.unitPrice, 2),
      })),
    );
    if (insError) throw insError;

    patch.subtotal = subtotal;
  }

  // El total se recalcula si cambió CUALQUIERA de sus tres componentes.
  if (input.items || input.deliveryFee !== undefined) {
    const deliveryFee =
      input.deliveryFee !== undefined ? round(input.deliveryFee, 2) : (existing.delivery_fee ?? 0);
    patch.delivery_fee = deliveryFee;
    // El descuento se acota al subtotal nuevo: si se borraron líneas, un
    // descuento fijo mayor al subtotal dejaría el total en negativo.
    const discount = Math.min(existing.discount ?? 0, subtotal);
    patch.discount = discount;
    patch.total = round(subtotal - discount + deliveryFee, 2);
  }

  if (Object.keys(patch).length === 0) {
    const { data, error } = await db.from('invoices').select(INVOICE_COLUMNS).eq('id', id).single();
    if (error) throw error;
    return toInvoice(data as unknown as InvoiceRow);
  }

  const { data, error } = await db
    .from('invoices')
    .update(patch)
    .eq('id', id)
    .select(INVOICE_COLUMNS)
    .single();
  if (error) throw error;
  return toInvoice(data as unknown as InvoiceRow);
}

export interface TicketData {
  /** Código impreso en el ticket: `GS-PR-12`. */
  ticketNumber: string;
  createdAt: string;
  customer: {
    name: string;
    phone?: string;
  };
  sellerName?: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  deliveryName?: string;
  total: number;
  method: string;
}

export async function getInvoiceTicket(invoiceId: string): Promise<TicketData | null> {
  const { data: invoice, error: invoiceError } = await db
    .from('invoices')
    .select('id, invoice_number, invoice_code, method, delivery_fee, total, created_at, sale_id, customer_name, phone, subtotal, discount, delivery_name')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invoiceError) throw invoiceError;
  if (!invoice) return null;

  const { data: invoiceItems, error: itemsError } = await db
    .from('invoice_items')
    .select('sku, quantity, unit_price, line_total')
    .eq('invoice_id', invoice.id);
  if (itemsError) throw itemsError;

  let sellerName = 'Caja'; // Por defecto, porque nace unlinked

  // Si ya está ligada, podemos sacar info adicional (ej. vendedor que la registró)
  if (invoice.sale_id) {
    const { data: order, error: orderError } = await db
      .from('orders')
      .select('seller_email, seller_uid')
      .eq('id', invoice.sale_id)
      .maybeSingle();
    
    // Solo el NOMBRE registrado en `profiles`. Antes caía al `seller_email`
    // cuando no había uid, y en el ticket impreso salía un correo completo
    // (`juan.perez@gyrostorenic.com`) en vez de un nombre.
    if (!orderError && order?.seller_uid) {
      const { data: profile } = await db
        .from('profiles')
        .select('name')
        .eq('id', order.seller_uid)
        .maybeSingle();
      if (profile?.name?.trim()) sellerName = profile.name.trim();
    }
  }

  const items = (invoiceItems || []).map((item) => ({
    productName: item.sku || 'Producto',
    quantity: item.quantity,
    unitPrice: item.unit_price ?? 0,
    lineTotal: item.line_total ?? 0,
  }));

  return {
    ticketNumber: invoice.invoice_code ?? formatInvoiceCode(invoice.invoice_number),
    createdAt: invoice.created_at,
    customer: {
      name: invoice.customer_name || 'Cliente General',
      phone: invoice.phone || undefined,
    },
    sellerName,
    items,
    subtotal: invoice.subtotal || 0,
    discount: invoice.discount || 0,
    deliveryFee: invoice.delivery_fee || 0,
    deliveryName: invoice.delivery_name || undefined,
    total: invoice.total || 0,
    method: invoice.method || 'efectivo',
  };
}
