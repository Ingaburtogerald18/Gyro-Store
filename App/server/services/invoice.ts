// Facturación (MVP Hito 3, doc 09 ítem 61): numera una venta YA aprobada
// (server/services/sales.ts). Modelo delgado — sin capa fiscal (doc 15 sigue
// apagado hasta que el negocio se inscriba: sin IVA, sin régimen, sin RUC en
// el documento). Sin líneas propias (viven en order_items), sin flujo
// "ticket que precede a la venta" ni estado `void` — la tabla `invoices` de
// v2 no tiene esas columnas/valor de enum; ver el plan acordado antes de
// escribir este archivo.
//
// Reciclaje de v1 (server/services/invoice.js + routes/invoices.js): se
// recicla la idea de un correlativo atómico, pero NO el mecanismo — v1
// llevaba su propio contador transaccional en Firestore porque no tenía
// sequences; v2 ya tiene `invoice_number_seq` (Postgres, doc 09 ítem 8), así
// que se usa esa en vez de reimplementar un contador. `computeTotals` y el
// `buildTicket` (resolver productos, reservar FIFO, regla no-mezcla) no
// aplican: eso ya lo hizo `sales.ts` al registrar/aprobar la venta.
import { db } from '../supabase';
import { round } from './finance';
import { BadRequestError } from '../utils/httpError';
import type { CreateInvoiceInput } from '../../shared/schemas';

export interface Invoice {
  id: string;
  saleId: string;
  invoiceNumber: number;
  status: string;
  method: string | null;
  deliveryFee: number;
  total: number;
  createdAt: string;
}

interface InvoiceRow {
  id: string;
  sale_id: string;
  invoice_number: number;
  status: string;
  method: string | null;
  delivery_fee: number | null;
  total: number | null;
  created_at: string;
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
  };
}

const INVOICE_COLUMNS = 'id, sale_id, invoice_number, status, method, delivery_fee, total, created_at';

// Emite la factura de una venta aprobada. Todo lo que puede rechazar la
// emisión (venta inexistente, no aprobada, ya facturada) se valida ANTES del
// INSERT: así el nextval() de invoice_number (columna, default) solo se
// dispara cuando la factura realmente se va a crear — el correlativo no
// "gasta" números en intentos fallidos. No es una garantía absoluta ante un
// fallo de red a mitad del INSERT mismo (eso pediría una función de Postgres
// con la secuencia adentro de la misma transacción, diferido igual que el
// FIFO — doc 09 dice "TX SQL"); el UNIQUE de la migración 0009 es la última
// defensa contra duplicados.
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, status, total')
    .eq('id', input.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) {
    throw new BadRequestError('Venta no encontrada.');
  }
  if (order.status !== 'approved') {
    throw new BadRequestError('Solo se factura una venta aprobada.');
  }

  const { data: existing, error: existingError } = await db
    .from('invoices')
    .select('id')
    .eq('sale_id', input.orderId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    throw new BadRequestError('Esta venta ya tiene una factura emitida.');
  }

  const deliveryFee = round(input.deliveryFee ?? 0, 2);
  const total = round((order.total ?? 0) + deliveryFee, 2);

  const { data: invoice, error: invoiceError } = await db
    .from('invoices')
    .insert({
      sale_id: input.orderId,
      // Nace 'linked': a diferencia de v1, siempre está atada a una venta
      // real desde que existe — no hay una fase "ticket sin venta todavía".
      status: 'linked',
      method: input.method,
      delivery_fee: deliveryFee,
      total,
    })
    .select(INVOICE_COLUMNS)
    .single();
  if (invoiceError) throw invoiceError;

  return toInvoice(invoice as unknown as InvoiceRow);
}

export async function listInvoices(): Promise<Invoice[]> {
  const { data, error } = await db
    .from('invoices')
    .select(INVOICE_COLUMNS)
    .order('invoice_number', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as InvoiceRow[]).map(toInvoice);
}
