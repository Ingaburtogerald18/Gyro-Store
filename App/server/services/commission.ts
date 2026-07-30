// Cadena utilidad → salary → comisión → ganancia + mayoreo (doc 11 §4-5).
// Funciones puras, sin DB ni Express — mismo espíritu que finance.ts. Se usan
// tanto para el cotizador (estimación) como para la aprobación (snapshot que
// se congela en order_items): misma función, dos momentos distintos.
//
// Reciclaje de v1 (server/services/commission.js): se recicla la IDEA de una
// función central única cotizador+aprobación con desglose por línea, y el
// guard "sin utilidad no hay comisión" (`utilidadNeta <= 0`). La matemática
// (`getDynamicMargins` escalonado por el TOTAL de la venta, tabla de mayoreo
// con maxQty, modo M1/M2 para migrados) se reescribe: doc 11 §4 fija el
// Salary en 20% constante y busca el tramo de comisión por la Utilidad Neta
// DE LA LÍNEA, no por el total de la venta; el mayoreo v2 tiene su propia
// tabla (doc 11 §5) y es solo herramienta del cotizador, no automático como
// en el checkout público de v1. El concepto de "pozos" no existe en v1 — es
// nuevo de doc 11 §2, reusando `distributePozos` de finance.ts.
import type { FinancialConfig } from '../../shared/schemas';
import { distributePozos, round } from './finance';

// ── Mayoreo (doc 11 §5) ──

export interface WholesaleResult {
  price: number;
  discountPercent: number;
  // Desde el tramo más alto configurado, el servidor avisa en vez de aplicar
  // el descuento a ciegas ("mejor hacé una cotización"). Se deriva del tramo
  // más alto en vez de hardcodear "12": doc 11 §9 dice que estos tramos son
  // editables desde el panel, así que el aviso debe moverse con ellos.
  warning: boolean;
}

// Se aplica el tramo con el `minQty` más alto que la cantidad todavía cumple
// (doc 11 §5: "se aplica el tramo más alto que cumpla"). El descuento pega
// sobre el precio BASE/tentativo del producto, nunca sobre el sugerido
// matemático (doc 11 §5, decisión §10.2).
export function applyWholesaleDiscount(
  price: number,
  quantity: number,
  tiers: FinancialConfig['wholesaleDiscounts'],
): WholesaleResult {
  const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
  const topTier = sorted[0];
  const tier = sorted.find((t) => quantity >= t.minQty);
  const discount = tier?.discount ?? 0;

  return {
    price: round(price * (1 - discount), 2),
    discountPercent: discount,
    warning: topTier !== undefined && quantity >= topTier.minQty,
  };
}

// ── Comisión (doc 11 §4) ──

function findCommissionTier(
  scale: FinancialConfig['commissionScale'],
  utilidadNeta: number,
): FinancialConfig['commissionScale'][number] {
  const sorted = [...scale].sort((a, b) => (a.maxProfit ?? Infinity) - (b.maxProfit ?? Infinity));
  const tier = sorted.find((t) => t.maxProfit === null || utilidadNeta <= t.maxProfit);
  if (!tier) {
    throw new Error(`No hay tramo de comisión configurado que cubra la utilidad neta ${utilidadNeta}.`);
  }
  return tier;
}

// Reciclado de v1 (calcularComisionYPorcentaje): sin utilidad neta positiva no
// hay comisión — pagar sobre una pérdida no tiene sentido de negocio, y la
// tabla de doc 11 §4 no cubre valores ≤ 0 explícitamente.
export function computeCommissionPercent(
  utilidadNeta: number,
  scale: FinancialConfig['commissionScale'],
): number {
  if (utilidadNeta <= 0) return 0;
  return findCommissionTier(scale, utilidadNeta).margin;
}

export interface LineCommissionInput {
  precioUnit: number;
  quantity: number;
  // C$, del lote FIFO consumido para esta línea (o promedio ponderado si
  // abarcó más de un lote — eso lo resuelve sales.ts, no este archivo).
  costeFinal: number;
  // C$, ídem, para el reparto en los 7 pozos.
  costoFU: number;
}

export interface LineCommission {
  utilidadBruta: number;
  salary: number;
  utilidadNeta: number;
  comision: number;
  comisionPercent: number;
  gananciaTienda: number;
  pozos: FinancialConfig['pozos'];
}

// Doc 11 §4, por línea: Utilidad bruta → Salary (20%) → Utilidad neta →
// Comisión (tramo por Utilidad neta) → Ganancia tienda. Los pozos se recogen
// del Costo F/U de las unidades de esta línea (doc 11 §2).
export function computeLineCommission(input: LineCommissionInput, config: FinancialConfig): LineCommission {
  const utilidadBruta = round((input.precioUnit - input.costeFinal) * input.quantity, 2);
  const salary = round(utilidadBruta * config.salaryPercentage, 2);
  const utilidadNeta = round(utilidadBruta - salary, 2);
  const comisionPercent = computeCommissionPercent(utilidadNeta, config.commissionScale);
  const comision = round(utilidadNeta * comisionPercent, 2);
  const gananciaTienda = round(utilidadNeta - comision, 2);
  const pozos = distributePozos(round(input.costoFU * input.quantity, 2), config.pozos);

  return { utilidadBruta, salary, utilidadNeta, comision, comisionPercent, gananciaTienda, pozos };
}

// ── Snapshot completo de línea (listo para order_items) ──

export interface OrderLineSnapshotInput {
  sku: string;
  quantity: number;
  // Precio base/tentativo del producto, ANTES de mayoreo.
  basePrice: number;
  costeFinal: number;
  costoFU: number;
  // El mayoreo es herramienta del cotizador (doc 11 §5), no automático:
  // sales.ts decide si esta línea lo aplica. Default true.
  applyWholesale?: boolean;
}

export interface OrderLineSnapshot extends LineCommission {
  sku: string;
  quantity: number;
  precioUnit: number;
  costeFinalSnap: number;
  wholesale: { discountPercent: number; warning: boolean };
}

export function computeOrderLineSnapshot(
  input: OrderLineSnapshotInput,
  config: FinancialConfig,
): OrderLineSnapshot {
  const wholesale =
    input.applyWholesale ?? true
      ? applyWholesaleDiscount(input.basePrice, input.quantity, config.wholesaleDiscounts)
      : { price: round(input.basePrice, 2), discountPercent: 0, warning: false };

  const commission = computeLineCommission(
    {
      precioUnit: wholesale.price,
      quantity: input.quantity,
      costeFinal: input.costeFinal,
      costoFU: input.costoFU,
    },
    config,
  );

  return {
    sku: input.sku,
    quantity: input.quantity,
    precioUnit: wholesale.price,
    costeFinalSnap: input.costeFinal,
    wholesale: { discountPercent: wholesale.discountPercent, warning: wholesale.warning },
    ...commission,
  };
}
