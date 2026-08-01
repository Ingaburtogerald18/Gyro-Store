import { db } from '../supabase';
import { round } from './finance';
import { BadRequestError } from '../utils/httpError';
import type { CreateInvoiceInput } from '../../shared/schemas';
import { listSellableProducts } from './sales';
import { redeemDiscountCode, computeCodeDiscount, checkDiscountCode } from './discountCode';

export interface Invoice {
  id: string;
  saleId: string | null;
  invoiceNumber: number;
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
}

interface InvoiceRow {
  id: string;
  sale_id: string | null;
  invoice_number: number;
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

const INVOICE_COLUMNS = 'id, sale_id, invoice_number, status, method, delivery_fee, total, created_at, customer_name, phone, subtotal, discount, delivery_name';

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
        referenceLabel: 'Factura #' + invoice.invoice_number,
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
export async function linkInvoiceToSale(invoiceNumber: number, saleId: string): Promise<Invoice> {
  const { data: existing, error: findError } = await db
    .from('invoices')
    .select('id, status')
    .eq('invoice_number', invoiceNumber)
    .maybeSingle();
    
  if (findError) throw findError;
  if (!existing) {
    throw new BadRequestError('El número de factura no existe.');
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

export async function findInvoiceByNumber(invoiceNumber: number): Promise<Invoice | null> {
  const { data, error } = await db
    .from('invoices')
    .select(INVOICE_COLUMNS)
    .eq('invoice_number', invoiceNumber)
    .maybeSingle();
  if (error) throw error;
  return data ? toInvoice(data as unknown as InvoiceRow) : null;
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
export async function updateInvoice(
  id: string,
  input: { method?: string; deliveryFee?: number },
): Promise<Invoice | null> {
  const { data: existing, error: findError } = await db
    .from('invoices')
    .select('id, status, subtotal, discount')
    .eq('id', id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return null;

  if (existing.status !== 'unlinked') {
    throw new BadRequestError('Solo se pueden editar los datos de facturas huérfanas (unlinked).');
  }

  const patch: Record<string, unknown> = {};
  if (input.method !== undefined) patch.method = input.method;

  if (input.deliveryFee !== undefined) {
    const deliveryFee = round(input.deliveryFee, 2);
    patch.delivery_fee = deliveryFee;
    patch.total = round((existing.subtotal ?? 0) - (existing.discount ?? 0) + deliveryFee, 2);
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
  ticketNumber: number;
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
    .select('id, invoice_number, method, delivery_fee, total, created_at, sale_id, customer_name, phone, subtotal, discount, delivery_name')
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
    
    if (!orderError && order) {
      if (order.seller_uid) {
        const { data: profile } = await db
          .from('profiles')
          .select('name')
          .eq('id', order.seller_uid)
          .maybeSingle();
        if (profile?.name) sellerName = profile.name;
      } else if (order.seller_email) {
        sellerName = order.seller_email;
      }
    }
  }

  const items = (invoiceItems || []).map((item) => ({
    productName: item.sku || 'Producto',
    quantity: item.quantity,
    unitPrice: item.unit_price ?? 0,
    lineTotal: item.line_total ?? 0,
  }));

  return {
    ticketNumber: invoice.invoice_number,
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
