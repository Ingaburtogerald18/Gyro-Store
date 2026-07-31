import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import {
  getFinancialKPIs,
  listLosses,
  exportSales,
  getExpensesByPozo
} from '../services/reports';
import { parseCursor } from '../utils/pagination';
import { BadRequestError } from '../utils/httpError';

const router = Router();

// ============================================================================
// ── Schemas de validación (Query Params) ──
// ============================================================================

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sellerUid: z.string().uuid().optional(),
});

// ============================================================================
// ── Rutas ──
// ============================================================================

// Todas las rutas de reportes están fuertemente protegidas;
// Hito 4 asume que esto es reportería administrativa.
router.use(requireAdmin);

/**
 * GET /api/reports/kpis
 * KPIs financieros agregados (ventas, utilidad, pozos).
 */
router.get(
  '/kpis',
  asyncHandler(async (req, res) => {
    const parsed = dateRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Parámetros inválidos. startDate y endDate deben ser ISO 8601.');
    }
    
    const { startDate, endDate, sellerUid } = parsed.data;
    const kpis = await getFinancialKPIs(startDate, endDate, sellerUid);
    
    res.json(kpis);
  })
);

/**
 * GET /api/reports/losses
 * Listado paginado de pérdidas.
 */
router.get(
  '/losses',
  asyncHandler(async (req, res) => {
    // pagination.ts parsea y valida de forma segura `limit` y `cursor`
    const paginationParams = parseCursor(req.query);
    const result = await listLosses(paginationParams);
    
    res.json(result);
  })
);

/**
 * GET /api/reports/sales-export
 * Array plano de ventas para exportar a CSV.
 */
router.get(
  '/sales-export',
  asyncHandler(async (req, res) => {
    const parsed = dateRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Parámetros inválidos. startDate y endDate deben ser ISO 8601.');
    }
    
    const { startDate, endDate } = parsed.data;
    const exportData = await exportSales(startDate, endDate);
    
    res.json(exportData);
  })
);

/**
 * GET /api/reports/expenses
 * Gastos operativos agregados por pozo.
 */
router.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    const parsed = dateRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Parámetros inválidos. startDate y endDate deben ser ISO 8601.');
    }
    
    const { startDate, endDate } = parsed.data;
    const expenses = await getExpensesByPozo(startDate, endDate);
    
    res.json(expenses);
  })
);

export default router;
