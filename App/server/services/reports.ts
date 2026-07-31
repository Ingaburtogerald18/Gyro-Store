import { z } from 'zod';
import { db } from '../supabase';
import { parseDbRows } from '../utils/parseDbRows';
import { buildPage, type PaginationParams, type PaginatedResult } from '../utils/pagination';
import { BadRequestError } from '../utils/httpError';

// ============================================================================
// ── Esquemas Zod (Contratos) ──
// ============================================================================

// DTO público que no fuga detalles internos innecesarios si no es requerido.
// Como estos son reportes de admin, mostramos la utilidad y costes porque
// el admin/staff autorizado sí debe verlos.
const kpiSchema = z.object({
  total_ventas: z.number(),
  total_unidades: z.number(),
  total_vendido: z.number(),
  coste_total: z.number(),
  comision_total: z.number(),
  ganancia_tienda_total: z.number(),
  salary_acumulado: z.number(),
  // JSON con los montos recaudados por pozo a partir del coste F/U
  pozos_recogidos: z.record(z.string(), z.number())
});

export type FinancialKPIs = z.infer<typeof kpiSchema>;

const lossRowSchema = z.object({
  id: z.string().uuid(),
  category: z.string().nullable(),
  sku: z.string().nullable(),
  quantity: z.number().nullable(),
  costo_cs: z.number().nullable(),
  reason: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string()
});

export type LossItem = z.infer<typeof lossRowSchema>;

// ============================================================================
// ── Servicios ──
// ============================================================================

/**
 * Retorna los KPIs financieros (ventas, utilidad, comisiones, pozos).
 *
 * NOTA: Para calcular esto "con SQL puro (no agregados en memoria)" como exige
 * el Hito 4, se debe crear una función RPC (`get_financial_kpis`) en una
 * migración SQL futura (ej. `0011_reports_rpc.sql`). El cliente de Supabase
 * JS no soporta agregaciones complejas (SUM, GROUP BY JSON) al vuelo.
 */
export async function getFinancialKPIs(
  startDate?: string,
  endDate?: string,
  sellerUid?: string
): Promise<FinancialKPIs> {
  // Llama al RPC (SQL puro en el server Postgres)
  const { data, error } = await db.rpc('get_financial_kpis', {
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    p_seller_uid: sellerUid ?? null
  }).single();

  if (error) {
    throw error;
  }

  const parsed = parseDbRows(kpiSchema, [data], 'getFinancialKPIs');
  return parsed[0]!;
}

/**
 * Retorna el historial de pérdidas (losses) paginado.
 */
export async function listLosses(params: PaginationParams): Promise<PaginatedResult<LossItem>> {
  let query = db
    .from('losses')
    .select('id, category, sku, quantity, costo_cs, reason, created_by, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(params.limit + 1);

  if (params.cursorData) {
    // Paginación por cursor
    query = query.lt('created_at', params.cursorData.createdAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  const parsed = parseDbRows(lossRowSchema, data, 'listLosses');
  
  return buildPage(parsed, params.limit);
}

/**
 * Exportación plana de ventas.
 * Se apoya en una vista SQL (`sales_export_view`) para resolver JOINS
 * complejos en SQL puro y no en memoria.
 */
export async function exportSales(startDate?: string, endDate?: string) {
  let query = db.from('sales_export_view').select('*');
  
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  
  const { data, error } = await query;
  if (error) throw error;
  
  return data;
}

/**
 * Obtiene los "gastos por pozo".
 * 
 * NOTA DE ARQUITECTURA: Actualmente en el schema (0003 y 0004) existe cómo 
 * rastrear los INGRESOS a los pozos (columna `pozos` jsonb en `order_items`),
 * pero FALTA la tabla `expenses` (gastos operativos) que permita registrar 
 * el dinero EXTRAÍDO/GASTADO de dichos pozos. 
 * Esta función asume la existencia futura de una tabla `expenses` o RPC
 * `get_expenses_by_pozo`.
 */
export async function getExpensesByPozo(startDate?: string, endDate?: string) {
  const { data, error } = await db.rpc('get_expenses_by_pozo', {
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null
  });

  if (error) throw error;
  return data;
}
