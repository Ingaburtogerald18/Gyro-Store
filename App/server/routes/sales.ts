// Ventas (MVP Hito 3): /api/sales/products (cotizador), /api/sales/quote,
// POST /api/sales (registrar), /:id/approve, /:id/reject, GET /api/sales
// (listado, scoped por rol). requireSeller cubre seller+admin+global_admin
// (auth.ts); aprobar/rechazar exige admin.
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireSeller, requireAdmin } from '../middleware/auth';
import { quoteInputSchema, registerSaleInputSchema, rejectSaleInputSchema } from '../../shared/schemas';
import {
  listSellableProducts,
  quoteSale,
  registerSale,
  approveSale,
  rejectSale,
  listSales,
} from '../services/sales';

const router = Router();

router.use(requireSeller);

const idSchema = z.uuid();
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
    const parsed = quoteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos de la cotización inválidos.', issues: parsed.error.issues });
      return;
    }
    try {
      res.json(await quoteSale(parsed.data.items));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo cotizar la venta.' });
    }
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = registerSaleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos de la venta inválidos.', issues: parsed.error.issues });
      return;
    }
    try {
      const sale = await registerSale(parsed.data, { uid: req.user!.uid, email: req.user!.email });
      res.status(201).json(sale);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo registrar la venta.' });
    }
  }),
);

router.post(
  '/:id/approve',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }
    try {
      const ok = await approveSale(id.data);
      if (!ok) {
        res.status(404).json({ error: 'Venta no encontrada.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo aprobar la venta.' });
    }
  }),
);

router.post(
  '/:id/reject',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }
    const parsed = rejectSaleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'El motivo de rechazo es obligatorio.', issues: parsed.error.issues });
      return;
    }
    try {
      const ok = await rejectSale(id.data, parsed.data.reason, req.user!.uid);
      if (!ok) {
        res.status(404).json({ error: 'Venta no encontrada.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo rechazar la venta.' });
    }
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
