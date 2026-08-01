// Ventas (MVP Hito 3): /api/sales/products (cotizador), /api/sales/quote,
// POST /api/sales (registrar), /:id/approve, /:id/reject, GET /api/sales
// (listado, scoped por rol). requireSeller cubre seller+admin+global_admin
// (auth.ts); aprobar/rechazar exige admin.
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireSeller, requireAdmin } from '../middleware/auth';
import { parseUuidParam } from '../utils/params';
import {
  payCommissionInputSchema,
  quoteInputSchema,
  registerSaleInputSchema,
  rejectSaleInputSchema,
  settleBalanceInputSchema,
} from '../../shared/schemas';
import {
  listSellableProducts,
  quoteSale,
  registerSale,
  approveSale,
  rejectSale,
  listSales,
} from '../services/sales';
import {
  getSellerSummary,
  listCommissionPayments,
  listPendingBalances,
  payCommissions,
  settleSellerBalance,
} from '../services/sellerPayments';

const router = Router();

router.use(requireSeller);

const isAdminLike = (roles: string[]) => roles.includes('admin') || roles.includes('global_admin');

router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    res.json(await listSellableProducts());
  }),
);

router.post(
  '/quote',
  asyncHandler(async (req, res) => {
    const data = quoteInputSchema.parse(req.body);
    res.json(await quoteSale(data.items));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = registerSaleInputSchema.parse(req.body);
    const sale = await registerSale(data, { uid: req.user!.uid, email: req.user!.email });
    res.status(201).json(sale);
  }),
);

// ==========================================
// PAGO DE COMISIONES
// ==========================================
// Van ANTES de `/:id/...`: si no, Express haría coincidir "payments" o
// "balances" con el parámetro y caerían en la ruta equivocada.

// Portal del vendedor: cada uno ve LO SUYO. El email sale del token, nunca del
// query — si no, un vendedor podría leer el resumen de otro cambiando la URL.
router.get(
  '/my-summary',
  asyncHandler(async (req, res) => {
    res.json(await getSellerSummary(req.user!.email));
  }),
);

router.get(
  '/my-payments',
  asyncHandler(async (req, res) => {
    res.json(await listCommissionPayments(req.user!.email));
  }),
);

router.get(
  '/payments',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sellerEmail = typeof req.query.sellerEmail === 'string' ? req.query.sellerEmail : undefined;
    res.json(await listCommissionPayments(sellerEmail));
  }),
);

router.get(
  '/balances',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await listPendingBalances());
  }),
);

router.post(
  '/pay',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = payCommissionInputSchema.parse(req.body);
    res.status(201).json(await payCommissions(data, req.user!.uid));
  }),
);

router.post(
  '/settle-balance',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = settleBalanceInputSchema.parse(req.body);
    res.status(201).json(await settleSellerBalance(data, req.user!.uid));
  }),
);

router.post(
  '/:id/approve',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Venta no encontrada.');
    const ok = await approveSale(id);
    if (!ok) {
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/reject',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Venta no encontrada.');
    const data = rejectSaleInputSchema.parse(req.body);
    const ok = await rejectSale(id, data.reason, req.user!.uid);
    if (!ok) {
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }
    res.json({ ok: true });
  }),
);

const statusFilterSchema = z.enum(['pending_approval', 'approved', 'paid', 'rejected']);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = statusFilterSchema.safeParse(req.query.status);
    const admin = isAdminLike(req.user!.roles);

    // El vendedor solo ve sus propias ventas, sin importar qué mande en el
    // query: el filtro de servidor manda, no lo que pida el cliente.
    const sellerEmail = admin
      ? typeof req.query.sellerEmail === 'string'
        ? req.query.sellerEmail
        : undefined
      : req.user!.email;

    res.json(await listSales({ sellerEmail, status: status.success ? status.data : undefined }));
  }),
);

export default router;
