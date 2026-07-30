// Cuotas: /api/installments (crear plan, registrar pago, cancelar, listar).
// Solo admin, igual que v1.
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import { createInstallmentPlanInputSchema, registerInstallmentPaymentInputSchema } from '../../shared/schemas';
import {
  listInstallments,
  createInstallmentPlan,
  registerInstallmentPayment,
  cancelInstallmentPlan,
} from '../services/installments';

const router = Router();

router.use(requireAdmin);

const idSchema = z.uuid();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json(await listInstallments(status));
  }),
);

// Antes de '/:id/...': path literal, sin ambigüedad con el parámetro.
router.get(
  '/pending',
  asyncHandler(async (_req, res) => {
    res.json(await listInstallments('active'));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createInstallmentPlanInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos del plan de cuotas inválidos.', issues: parsed.error.issues });
      return;
    }
    try {
      const plan = await createInstallmentPlan(parsed.data);
      res.status(201).json(plan);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo crear el plan de cuotas.' });
    }
  }),
);

router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Plan de cuotas no encontrado.' });
      return;
    }
    const parsed = registerInstallmentPaymentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos del pago inválidos.', issues: parsed.error.issues });
      return;
    }
    try {
      const result = await registerInstallmentPayment(id.data, parsed.data);
      if (!result) {
        res.status(404).json({ error: 'Plan de cuotas no encontrado.' });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo registrar el pago.' });
    }
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Plan de cuotas no encontrado.' });
      return;
    }
    try {
      const ok = await cancelInstallmentPlan(id.data);
      if (!ok) {
        res.status(404).json({ error: 'Plan de cuotas no encontrado.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo cancelar el plan.' });
    }
  }),
);

export default router;
