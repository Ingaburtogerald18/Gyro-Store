// Acceso a datos del inventario: CRUD de `purchases` (lotes de compra),
// recepción de lotes (arrival), CRUD de `migrated_inventory`, y las funciones
// FIFO (reserveForItems, takeFifo, consumeReservation). Sigue el contrato de
// frontend/app/store/api/inventoryV1Api.ts, que es lo que de verdad consumen
// los componentes reciclados de admin/inventory/ (no inventoryApi.ts, que es
// un draft sin usar). Usa `db` de supabase.ts y consume finance.ts al recibir
// una compra para persistir costo real / F-U / coste final.
import { db } from '../supabase';
import { getFinancialConfig } from './appConfig';
import { costPurchaseOnArrival, round } from './finance';
import { BadRequestError } from '../utils/httpError';
import type {
  NewPurchaseInput,
  UpdatePurchaseInput,
  ArrivalInput,
  NewMigratedInput,
} from '../../shared/schemas';

// ============================================================================
// ── Tipos (contrato con inventoryV1Api.ts) ──
// ============================================================================
// `PurchaseStatus` real de la DB tiene 3 valores (`purchase_status` enum); el
// tipo del frontend hoy solo declara 2 (`china`|`received`), un desfase que no
// toca a este archivo — se corrige cuando se retoque inventoryV1Api.ts.
export type PurchaseStatus = 'china' | 'pending' | 'received';

export interface Purchase {
  id: string;
  lot: string;
  code: string;
  productName: string;
  category: string | null;
  purchaseDate: string;
  arrivalDate: string | null;
  quantity: number;
  costUnit: number;
  taxUnit: number;
  shippingUnit: number;
  priceUnit: number;
  total: number;
  quantitySold: number;
  quantityReserved: number;
  suggestedPrice: number | null;
  status: PurchaseStatus;
}

export interface InventoryRow {
  id: string;
  code: string;
  productName: string;
  category: string | null;
  lot?: string;
  quantityOriginal?: number;
  quantitySold?: number;
  quantityReserved?: number;
  available: number;
  priceUnitUsd?: number;
  shippingUnitUsd?: number;
  priceUnitFinalUsd?: number;
  costRealCordobas?: number;
  costoFijoCordobas?: number;
  preTotalUsd?: number;
  totalFinalUsd?: number;
  suggestedPrice?: number | null;
  gananciaUnitCordobas?: number;
}

export interface InventoryKpis {
  totalPurchases: number;
  inTransit: number;
  received: number;
  subtotalInvertidoUsd: number;
  totalImpuestosUsd: number;
  totalInversionConImpuestosUsd: number;
  totalEnviosUsd: number;
}

export interface MigratedItem {
  id: string;
  origin: 'migrated';
  status: string;
  lot: string;
  code: string;
  productName: string;
  purchaseDate: string;
  quantity: number;
  quantitySold: number;
  quantityReserved: number;
  stock: number;
  costUnit: number;
  shippingUnit: number;
  priceBaseUsd: number;
  shippingUnitUsd: number;
  priceUnitFinalUsd: number;
  preTotalUsd: number;
  totalUsd: number;
  costRealUnitCordobas: number;
  suggestedPrice: number;
  comments: string;
}

// ============================================================================
// ── Filas crudas de la DB (snake_case) ──
// ============================================================================

interface PurchaseRow {
  id: string;
  code: string;
  lot: string | null;
  status: PurchaseStatus;
  purchase_date: string;
  quantity: number;
  quantity_sold: number;
  quantity_reserved: number;
  costo_china_usd: number | null;
  impuesto_unit_usd: number | null;
  envio_unit_usd: number | null;
  exchange_rate: number | null;
  costo_real_usd: number | null;
  costo_real_cs: number | null;
  product_name: string;
  category: string | null;
  arrival_date: string | null;
  suggested_price: number | null;
  costo_f_u: number | null;
  coste_final: number | null;
}

interface MigratedRow {
  id: string;
  sku: string | null;
  name: string | null;
  origin: string;
  quantity: number;
  costo_real_cs: number | null;
  status: string;
  lot: string | null;
  code: string | null;
  purchase_date: string;
  quantity_sold: number;
  quantity_reserved: number;
  cost_unit_usd: number | null;
  shipping_unit_usd: number | null;
  suggested_price: number | null;
  comments: string | null;
}

const PURCHASE_COLUMNS = [
  'id', 'code', 'lot', 'status', 'purchase_date',
  'quantity', 'quantity_sold', 'quantity_reserved',
  'costo_china_usd', 'impuesto_unit_usd', 'envio_unit_usd', 'exchange_rate',
  'costo_real_usd', 'costo_real_cs',
  'product_name', 'category', 'arrival_date', 'suggested_price',
  'costo_f_u', 'coste_final',
].join(', ');

const MIGRATED_COLUMNS = [
  'id', 'sku', 'name', 'origin', 'quantity', 'costo_real_cs',
  'status', 'lot', 'code', 'purchase_date',
  'quantity_sold', 'quantity_reserved', 'cost_unit_usd', 'shipping_unit_usd',
  'suggested_price', 'comments',
].join(', ');

// ============================================================================
// ── Helpers ──
// ============================================================================

// "YYYY-MM" → [primer día del mes, primer día del mes siguiente). El mes de
// entrada es 1-based (marzo = "03"); `Date.UTC` lo toma tal cual porque su
// parámetro de mes es 0-based, así que ya apunta al mes siguiente.
function periodRange(period: string): { start: string; end: string } {
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = `${yearStr}-${monthStr}-01`;
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { start, end };
}

function toPurchase(row: PurchaseRow): Purchase {
  const costUnit = row.costo_china_usd ?? 0;
  const taxUnit = row.impuesto_unit_usd ?? 0;
  const shippingUnit = row.envio_unit_usd ?? 0;
  // Doc 11 §1: "costo unitario origen" = (Cantidad×costo + Cantidad×impuesto) / Cantidad = costo + impuesto.
  const priceUnit = costUnit + taxUnit;

  return {
    id: row.id,
    lot: row.lot ?? '',
    code: row.code,
    productName: row.product_name,
    category: row.category,
    purchaseDate: row.purchase_date,
    arrivalDate: row.arrival_date,
    quantity: row.quantity,
    costUnit,
    taxUnit,
    shippingUnit,
    priceUnit: round(priceUnit, 4),
    total: round(priceUnit * row.quantity, 4),
    quantitySold: row.quantity_sold,
    quantityReserved: row.quantity_reserved,
    suggestedPrice: row.suggested_price,
    status: row.status,
  };
}

function toInventoryRow(row: PurchaseRow): InventoryRow {
  const available = Math.max(0, row.quantity - row.quantity_sold - row.quantity_reserved);
  const priceUnit = (row.costo_china_usd ?? 0) + (row.impuesto_unit_usd ?? 0);
  const shippingUnit = row.envio_unit_usd ?? 0;
  const priceUnitFinal = priceUnit + shippingUnit;
  const costeFinal = row.coste_final ?? 0;
  const suggested = row.suggested_price ?? 0;

  return {
    id: row.id,
    code: row.code,
    productName: row.product_name,
    category: row.category,
    lot: row.lot ?? undefined,
    quantityOriginal: row.quantity,
    quantitySold: row.quantity_sold,
    quantityReserved: row.quantity_reserved,
    available,
    priceUnitUsd: round(priceUnit, 4),
    shippingUnitUsd: shippingUnit,
    priceUnitFinalUsd: round(priceUnitFinal, 4),
    costRealCordobas: row.costo_real_cs ?? 0,
    costoFijoCordobas: row.costo_f_u ?? 0,
    preTotalUsd: round(priceUnit * available, 4),
    totalFinalUsd: round(priceUnitFinal * available, 4),
    suggestedPrice: row.suggested_price,
    gananciaUnitCordobas: round(suggested - costeFinal, 2),
  };
}

// Doc 11 §7: el inventario migrado queda fuera de la cadena de costeo nueva
// (sin Costo F/U ni pozos) — se recicla la heurística de v1 para su precio
// sugerido (costo real × 1.40, redondeado a la decena) en vez de finance.ts.
function migratedSuggestedPrice(costRealCs: number): number {
  return Math.round((costRealCs * 1.4) / 10) * 10;
}

function toMigratedItem(row: MigratedRow): MigratedItem {
  const stock = Math.max(0, row.quantity - row.quantity_sold - row.quantity_reserved);
  const priceBaseUsd = row.cost_unit_usd ?? 0;
  const shippingUnitUsd = row.shipping_unit_usd ?? 0;
  const priceUnitFinalUsd = priceBaseUsd + shippingUnitUsd;

  return {
    id: row.id,
    origin: 'migrated',
    status: row.status,
    lot: row.lot ?? '',
    code: row.code ?? '',
    productName: row.name ?? '',
    purchaseDate: row.purchase_date,
    quantity: row.quantity,
    quantitySold: row.quantity_sold,
    quantityReserved: row.quantity_reserved,
    stock,
    costUnit: priceBaseUsd,
    shippingUnit: shippingUnitUsd,
    priceBaseUsd,
    shippingUnitUsd,
    priceUnitFinalUsd: round(priceUnitFinalUsd, 4),
    preTotalUsd: round(priceBaseUsd * stock, 4),
    totalUsd: round(priceUnitFinalUsd * stock, 4),
    costRealUnitCordobas: row.costo_real_cs ?? 0,
    suggestedPrice: row.suggested_price ?? 0,
    comments: row.comments ?? '',
  };
}

async function fetchPurchaseRows(period?: string, status?: PurchaseStatus): Promise<PurchaseRow[]> {
  let query = db
    .from('purchases')
    .select(PURCHASE_COLUMNS)
    .order('purchase_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (status) query = query.eq('status', status);
  if (period) {
    const { start, end } = periodRange(period);
    query = query.gte('purchase_date', start).lt('purchase_date', end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PurchaseRow[];
}

// ============================================================================
// ── Lectura (purchases) ──
// ============================================================================

export async function getPurchases(period?: string): Promise<Purchase[]> {
  const rows = await fetchPurchaseRows(period);
  return rows.map(toPurchase);
}

export async function getIncomingInventory(): Promise<Purchase[]> {
  const rows = await fetchPurchaseRows(undefined, 'china');
  return rows.map(toPurchase);
}

export async function getCurrentInventory(period?: string): Promise<InventoryRow[]> {
  const rows = await fetchPurchaseRows(period, 'received');
  return rows.map(toInventoryRow);
}

// A diferencia de getCurrentInventory (todo lo recibido, para el listado
// completo del panel), esto filtra a lo que de verdad queda disponible: es lo
// que alimentará el selector de productos de una venta.
export async function getAvailableInventory(): Promise<InventoryRow[]> {
  const rows = await fetchPurchaseRows(undefined, 'received');
  return rows
    .filter((row) => row.quantity - row.quantity_sold - row.quantity_reserved > 0)
    .map(toInventoryRow);
}

export async function getInventoryKpis(period?: string): Promise<InventoryKpis> {
  const rows = await fetchPurchaseRows(period);
  let inTransit = 0;
  let received = 0;
  let subtotalInvertidoUsd = 0;
  let totalImpuestosUsd = 0;
  let totalEnviosUsd = 0;

  for (const row of rows) {
    if (row.status === 'received') received += 1;
    else inTransit += 1;
    subtotalInvertidoUsd += (row.costo_china_usd ?? 0) * row.quantity;
    totalImpuestosUsd += (row.impuesto_unit_usd ?? 0) * row.quantity;
    totalEnviosUsd += (row.envio_unit_usd ?? 0) * row.quantity;
  }

  return {
    totalPurchases: rows.length,
    inTransit,
    received,
    subtotalInvertidoUsd: round(subtotalInvertidoUsd, 4),
    totalImpuestosUsd: round(totalImpuestosUsd, 4),
    totalInversionConImpuestosUsd: round(subtotalInvertidoUsd + totalImpuestosUsd, 4),
    totalEnviosUsd: round(totalEnviosUsd, 4),
  };
}

// ============================================================================
// ── Escritura (purchases) ──
// ============================================================================

export async function createPurchase(input: NewPurchaseInput): Promise<Purchase> {
  // Generar código GS-IN-XX automático usando el primer hueco disponible
  const { data: codes, error: codeErr } = await db
    .from('purchases')
    .select('code')
    .like('code', 'GS-IN-%');

  if (codeErr) throw codeErr;

  const usedNumbers = (codes || [])
    .map(r => parseInt(r.code.replace('GS-IN-', ''), 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);

  let nextId = 1;
  for (const n of usedNumbers) {
    if (n === nextId) {
      nextId++;
    } else if (n > nextId) {
      break;
    }
  }
  const generatedCode = `GS-IN-${nextId}`;

  const { data, error } = await db
    .from('purchases')
    .insert({
      code: generatedCode,
      lot: input.lot,
      product_name: input.productName,
      purchase_date: input.purchaseDate,
      quantity: input.quantity,
      costo_china_usd: input.costUnit,
      impuesto_unit_usd: input.taxUnit,
      suggested_price: input.suggestedPrice ?? null,
      status: 'china',
    })
    .select(PURCHASE_COLUMNS)
    .single();

  if (error) throw error;
  return toPurchase(data as unknown as PurchaseRow);
}

// "Sube stock" (doc 09 ítem 51): pasa el lote a `received` y persiste la
// cadena de costeo completa de doc 11 §1-3 vía finance.ts. La tasa de cambio
// se congela acá (regla de oro #4) con la vigente en `app_config` al momento
// de recibir — no se vuelve a tocar después.
export async function reportArrival(id: string, input: ArrivalInput): Promise<boolean> {
  const { data: existing, error: fetchError } = await db
    .from('purchases')
    .select('quantity, costo_china_usd, impuesto_unit_usd')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return false;

  const config = await getFinancialConfig();
  const costing = costPurchaseOnArrival(
    {
      quantity: existing.quantity,
      costoChinaUsd: existing.costo_china_usd ?? 0,
      impuestoUnitUsd: existing.impuesto_unit_usd ?? 0,
      envioUnitUsd: input.shippingUnit,
      exchangeRate: config.exchangeRate,
    },
    config,
  );

  const { error } = await db
    .from('purchases')
    .update({
      status: 'received',
      arrival_date: input.arrivalDate,
      category: input.category,
      envio_unit_usd: input.shippingUnit,
      exchange_rate: config.exchangeRate,
      costo_real_usd: costing.costoRealUsd,
      costo_real_cs: costing.costoRealCs,
      costo_f_u: costing.costoFU,
      coste_final: costing.costeFinal,
      suggested_price: input.suggestedPrice ?? costing.precioSugerido,
    })
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function updatePurchase(id: string, input: UpdatePurchaseInput): Promise<boolean> {
  const { data: existing, error: fetchError } = await db
    .from('purchases')
    .select('status, quantity, costo_china_usd, impuesto_unit_usd, envio_unit_usd, exchange_rate')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return false;

  const patch: Record<string, unknown> = {};
  if (input.purchaseDate !== undefined) patch.purchase_date = input.purchaseDate;
  if (input.lot !== undefined) patch.lot = input.lot;
  if (input.code !== undefined) patch.code = input.code;
  if (input.productName !== undefined) patch.product_name = input.productName;
  if (input.category !== undefined) patch.category = input.category;
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.costUnit !== undefined) patch.costo_china_usd = input.costUnit;
  if (input.taxUnit !== undefined) patch.impuesto_unit_usd = input.taxUnit;
  if (input.shippingUnit !== undefined) patch.envio_unit_usd = input.shippingUnit;
  if (input.suggestedPrice !== undefined) patch.suggested_price = input.suggestedPrice;

  // Si el lote ya fue recibido y algún insumo del costeo cambió, se recalcula
  // toda la cadena — pero con la tasa YA congelada del lote (regla de oro #4:
  // no se vuelve a leer la tasa vigente).
  const costingInputsChanged =
    existing.status === 'received' &&
    (input.quantity !== undefined ||
      input.costUnit !== undefined ||
      input.taxUnit !== undefined ||
      input.shippingUnit !== undefined);

  if (costingInputsChanged) {
    if (existing.exchange_rate == null) {
      throw new BadRequestError('El lote está marcado como recibido pero no tiene tasa de cambio congelada.');
    }
    const config = await getFinancialConfig();
    const costing = costPurchaseOnArrival(
      {
        quantity: (patch.quantity as number | undefined) ?? existing.quantity,
        costoChinaUsd: (patch.costo_china_usd as number | undefined) ?? existing.costo_china_usd ?? 0,
        impuestoUnitUsd: (patch.impuesto_unit_usd as number | undefined) ?? existing.impuesto_unit_usd ?? 0,
        envioUnitUsd: (patch.envio_unit_usd as number | undefined) ?? existing.envio_unit_usd ?? 0,
        exchangeRate: existing.exchange_rate,
      },
      config,
    );
    patch.costo_real_usd = costing.costoRealUsd;
    patch.costo_real_cs = costing.costoRealCs;
    patch.costo_f_u = costing.costoFU;
    patch.coste_final = costing.costeFinal;
    if (input.suggestedPrice === undefined) {
      patch.suggested_price = costing.precioSugerido;
    }
  }

  const { error } = await db.from('purchases').update(patch).eq('id', id);
  if (error) throw error;
  return true;
}

// Deshace una recepción (received → china). Bloqueado si ya se vendió o
// reservó algo del lote: revertir eso dejaría números inconsistentes.
export async function revertPurchase(id: string): Promise<boolean> {
  const { data: existing, error: fetchError } = await db
    .from('purchases')
    .select('status, quantity_sold, quantity_reserved')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return false;

  if (existing.status !== 'received') {
    throw new BadRequestError('Solo se puede revertir un lote que ya fue recibido.');
  }
  if (existing.quantity_sold > 0 || existing.quantity_reserved > 0) {
    throw new BadRequestError('No se puede revertir un lote con stock ya vendido o reservado.');
  }

  const { error } = await db
    .from('purchases')
    .update({
      status: 'china',
      arrival_date: null,
      category: null,
      envio_unit_usd: 0,
      exchange_rate: null,
      costo_real_usd: null,
      costo_real_cs: null,
      costo_f_u: null,
      coste_final: null,
    })
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function deletePurchase(id: string, authorUid: string): Promise<boolean> {
  const { data: existing, error: fetchError } = await db
    .from('purchases')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return false;

  if (existing.quantity_sold > 0 || existing.quantity_reserved > 0) {
    throw new BadRequestError('No se puede borrar un lote con stock ya vendido o reservado.');
  }

  const { error } = await db.from('purchases').delete().eq('id', id);
  if (error) throw error;

  await db.from('audit_logs').insert({
    entity: 'purchases',
    entity_id: id,
    action: 'delete',
    reason: 'Eliminación manual desde panel',
    author_uid: authorUid,
    before: existing,
    after: null,
  });

  return true;
}

// ============================================================================
// ── migrated_inventory ──
// ============================================================================

export async function getMigratedInventory(period?: string): Promise<MigratedItem[]> {
  let query = db.from('migrated_inventory').select(MIGRATED_COLUMNS).order('purchase_date', { ascending: true });
  if (period) {
    const { start, end } = periodRange(period);
    query = query.gte('purchase_date', start).lt('purchase_date', end);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as MigratedRow[]).map(toMigratedItem);
}

export async function createMigratedItem(input: NewMigratedInput): Promise<MigratedItem> {
  const config = await getFinancialConfig();
  const costoRealCs = round((input.costUnit + input.shippingUnit) * config.exchangeRate, 2);

  const { data, error } = await db
    .from('migrated_inventory')
    .insert({
      name: input.productName,
      origin: 'migrated',
      quantity: input.quantity,
      costo_real_cs: costoRealCs,
      status: 'received',
      lot: input.lot ?? null,
      code: input.code,
      purchase_date: input.purchaseDate,
      cost_unit_usd: input.costUnit,
      shipping_unit_usd: input.shippingUnit,
      suggested_price: migratedSuggestedPrice(costoRealCs),
      comments: input.comments ?? null,
    })
    .select(MIGRATED_COLUMNS)
    .single();

  if (error) throw error;
  return toMigratedItem(data as unknown as MigratedRow);
}

export async function updateMigratedItem(id: string, input: NewMigratedInput): Promise<MigratedItem | null> {
  const config = await getFinancialConfig();
  const costoRealCs = round((input.costUnit + input.shippingUnit) * config.exchangeRate, 2);

  const { data, error } = await db
    .from('migrated_inventory')
    .update({
      name: input.productName,
      quantity: input.quantity,
      costo_real_cs: costoRealCs,
      lot: input.lot ?? null,
      code: input.code,
      purchase_date: input.purchaseDate,
      cost_unit_usd: input.costUnit,
      shipping_unit_usd: input.shippingUnit,
      suggested_price: migratedSuggestedPrice(costoRealCs),
      comments: input.comments ?? null,
    })
    .eq('id', id)
    .select(MIGRATED_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? toMigratedItem(data as unknown as MigratedRow) : null;
}

export async function deleteMigratedItem(id: string): Promise<boolean> {
  const { data: existing, error: fetchError } = await db
    .from('migrated_inventory')
    .select('quantity_sold, quantity_reserved')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return false;

  if (existing.quantity_sold > 0 || existing.quantity_reserved > 0) {
    throw new BadRequestError('No se puede borrar un ítem migrado con salidas o reservas registradas.');
  }

  const { error } = await db.from('migrated_inventory').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ============================================================================
// ── FIFO ──
// ============================================================================
// LIMITACIÓN CONOCIDA: `purchases` no tiene ningún link a catalog_items/SKU
// (ni `NewPurchase` lo manda), así que el único campo que agrupa varios lotes
// del "mismo producto" es `product_name` (texto libre) — dos compras con el
// nombre tipeado distinto no se agrupan. Reemplazar por un id real de
// producto en cuanto exista el vínculo con el catálogo (doc 09 ítem 54).
//
// Tampoco hay una función de Postgres con locking real (`FOR UPDATE`) como
// pide doc 09 ("TX SQL"): sin acceso a Supabase para probar una función
// plpgsql esta sesión, esto usa UPDATEs condicionados (compare-and-swap sobre
// el valor leído + el CHECK constraint de la tabla como última defensa) y una
// compensación manual best-effort si algo falla a mitad de camino. Conviene
// migrar esto a una función de Postgres con locking antes de manejar tráfico
// concurrente real.

export interface ReserveItem {
  productName: string;
  quantity: number;
}

interface FifoTakenLot {
  purchaseId: string;
  code: string;
  quantity: number;
  costeFinalUsd: number | null;
}

const FIFO_MAX_PASSES = 3;

async function walkFifoLots(
  productName: string,
  quantity: number,
  column: 'quantity_reserved' | 'quantity_sold',
): Promise<FifoTakenLot[]> {
  let remaining = quantity;
  const taken: FifoTakenLot[] = [];

  for (let pass = 0; pass < FIFO_MAX_PASSES && remaining > 0; pass++) {
    const { data, error } = await db
      .from('purchases')
      .select('id, code, quantity, quantity_sold, quantity_reserved, coste_final, exchange_rate')
      .eq('product_name', productName)
      .eq('status', 'received')
      .order('purchase_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;

    const lots = (data ?? []) as unknown as {
      id: string;
      code: string;
      quantity: number;
      quantity_sold: number;
      quantity_reserved: number;
      coste_final: number | null;
      exchange_rate: number | null;
    }[];

    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = lot.quantity - lot.quantity_sold - lot.quantity_reserved;
      if (available <= 0) continue;

      const take = Math.min(available, remaining);
      const currentValue = column === 'quantity_reserved' ? lot.quantity_reserved : lot.quantity_sold;

      const { data: updated, error: updateError } = await db
        .from('purchases')
        .update({ [column]: currentValue + take })
        .eq('id', lot.id)
        .eq(column, currentValue) // compare-and-swap: solo si nadie más lo tocó desde la lectura
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) continue; // conflicto: se reintenta este lote en la próxima pasada

      remaining -= take;
      const costeFinalUsd =
        lot.coste_final != null && lot.exchange_rate ? round(lot.coste_final / lot.exchange_rate, 4) : null;
      taken.push({ purchaseId: lot.id, code: lot.code, quantity: take, costeFinalUsd });
    }
  }

  if (remaining > 0) {
    // Compensación best-effort: no hay TX real, así que se deshace a mano lo
    // que sí se alcanzó a tomar antes de reportar el faltante.
    for (const lot of taken) {
      await releaseFifoLot(lot.purchaseId, column, lot.quantity);
    }
    throw new BadRequestError(`Stock insuficiente de "${productName}": faltan ${remaining} unidad(es).`);
  }

  return taken;
}

async function releaseFifoLot(
  purchaseId: string,
  column: 'quantity_reserved' | 'quantity_sold',
  quantity: number,
): Promise<void> {
  const { data } = await db.from('purchases').select(column).eq('id', purchaseId).maybeSingle();
  if (!data) return; // best-effort: si esto falla queda para revisión manual
  const current = (data as unknown as Record<string, number>)[column] ?? 0;
  await db
    .from('purchases')
    .update({ [column]: Math.max(0, current - quantity) })
    .eq('id', purchaseId);
}

// Reserva stock para las líneas de un pedido/cotización (quantity_reserved),
// creando una fila en `stock_reservations` por cada lote que aporta unidades.
export async function reserveForItems(
  orderId: string,
  items: ReserveItem[],
): Promise<FifoTakenLot[]> {
  const allTaken: FifoTakenLot[] = [];

  try {
    for (const item of items) {
      const taken = await walkFifoLots(item.productName, item.quantity, 'quantity_reserved');
      for (const lot of taken) {
        const { error } = await db.from('stock_reservations').insert({
          order_id: orderId,
          purchase_id: lot.purchaseId,
          code: lot.code,
          quantity: lot.quantity,
          unit_final_usd: lot.costeFinalUsd,
          status: 'active',
        });
        if (error) throw error;
      }
      allTaken.push(...taken);
    }
    return allTaken;
  } catch (err) {
    // Compensación best-effort de las líneas anteriores que sí se alcanzaron
    // a reservar antes de que fallara esta.
    for (const lot of allTaken) {
      await releaseFifoLot(lot.purchaseId, 'quantity_reserved', lot.quantity);
    }
    await db
      .from('stock_reservations')
      .delete()
      .eq('order_id', orderId)
      .eq('status', 'active');
    throw err;
  }
}

// Venta directa sin reserva previa (ej. POS/factura inmediata): suma
// directamente a quantity_sold en vez de pasar por quantity_reserved.
export async function takeFifo(productName: string, quantity: number): Promise<FifoTakenLot[]> {
  return walkFifoLots(productName, quantity, 'quantity_sold');
}

// Confirma una reserva existente (ej. al aprobar el pedido): mueve lo
// reservado a vendido en cada lote y marca las reservas como consumidas.
export async function consumeReservation(orderId: string): Promise<{ consumed: number }> {
  const { data, error } = await db
    .from('stock_reservations')
    .select('id, purchase_id, quantity')
    .eq('order_id', orderId)
    .eq('status', 'active');
  if (error) throw error;

  const reservations = (data ?? []) as unknown as { id: string; purchase_id: string; quantity: number }[];
  if (!reservations.length) return { consumed: 0 };

  for (const reservation of reservations) {
    const { data: purchase, error: purchaseError } = await db
      .from('purchases')
      .select('quantity_sold, quantity_reserved')
      .eq('id', reservation.purchase_id)
      .single();
    if (purchaseError) throw purchaseError;

    const { error: updateError } = await db
      .from('purchases')
      .update({
        quantity_sold: purchase.quantity_sold + reservation.quantity,
        quantity_reserved: purchase.quantity_reserved - reservation.quantity,
      })
      .eq('id', reservation.purchase_id)
      .eq('quantity_reserved', purchase.quantity_reserved); // compare-and-swap
    if (updateError) throw updateError;

    const { error: markError } = await db
      .from('stock_reservations')
      .update({ status: 'consumed' })
      .eq('id', reservation.id);
    if (markError) throw markError;
  }

  return { consumed: reservations.length };
}

// Contraparte de consumeReservation: libera reservas activas de un pedido sin
// convertirlas en venta (rechazo de pedido, o limpieza si el registro falló a
// mitad de camino). Devuelve quantity_reserved en cada lote y marca las
// reservas como liberadas.
export async function releaseReservations(orderId: string): Promise<{ released: number }> {
  const { data, error } = await db
    .from('stock_reservations')
    .select('id, purchase_id, quantity')
    .eq('order_id', orderId)
    .eq('status', 'active');
  if (error) throw error;

  const reservations = (data ?? []) as unknown as { id: string; purchase_id: string; quantity: number }[];
  if (!reservations.length) return { released: 0 };

  for (const reservation of reservations) {
    await releaseFifoLot(reservation.purchase_id, 'quantity_reserved', reservation.quantity);
    const { error: markError } = await db
      .from('stock_reservations')
      .update({ status: 'released' })
      .eq('id', reservation.id);
    if (markError) throw markError;
  }

  return { released: reservations.length };
}
