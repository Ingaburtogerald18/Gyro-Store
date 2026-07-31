import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireRole } from '../middleware/auth';
import { registerSalidaInputSchema, liquidarSalidaInputSchema } from '../../shared/schemas';
import { createSalida, listSalidas, liquidarSalida, linkToSale, markAsDevuelta } from '../services/salidas';

const router = Router();

router.use(requireRole('admin', 'staff'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const estado = req.query.estado as string;
    const liquidacion = req.query.liquidacion as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    const salidas = await listSalidas({ estado, liquidacion, startDate, endDate });
    res.json(salidas);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = registerSalidaInputSchema.parse(req.body);
    const userId = req.user!.id;
    const salida = await createSalida(data, userId);
    res.status(201).json(salida);
  })
);

router.patch(
  '/:id/liquidar',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = liquidarSalidaInputSchema.parse(req.body);
    const salida = await liquidarSalida(id!, data);
    res.json(salida);
  })
);

router.patch(
  '/:id/vincular',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { orderId } = req.body;
    if (!orderId) {
      res.status(400).json({ error: 'orderId es requerido' });
      return;
    }
    const salida = await linkToSale(id!, orderId);
    res.json(salida);
  })
);

router.patch(
  '/:id/devolver',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const salida = await markAsDevuelta(id!);
    res.json(salida);
  })
);

export default router;
