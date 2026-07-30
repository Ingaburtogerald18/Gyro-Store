// Facturación: /api/invoices (emitir, listar). requireCashier cubre
// cashier+admin+global_admin (auth.ts) — v1 usaba el mismo rol para el POS.
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireCashier } from '../middleware/auth';
import { createInvoiceInputSchema } from '../../shared/schemas';
import { createInvoice, listInvoices } from '../services/invoice';

const router = Router();

router.use(requireCashier);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listInvoices());
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createInvoiceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos de la factura inválidos.', issues: parsed.error.issues });
      return;
    }
    try {
      const invoice = await createInvoice(parsed.data);
      res.status(201).json(invoice);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo emitir la factura.' });
    }
  }),
);

export default router;
