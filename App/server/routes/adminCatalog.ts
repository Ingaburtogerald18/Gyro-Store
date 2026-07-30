// CRUD del catálogo desde el panel. Todo el router exige rol de staff:
// admin o seller pueden gestionar productos (doc 04 §1.4).
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireSeller } from '../middleware/auth';
import { adminProductInputSchema } from '../../shared/schemas';
import {
  archiveAdminProduct,
  createAdminProduct,
  getAdminProduct,
  listAdminCatalog,
  updateAdminProduct,
} from '../services/adminCatalog';

const router = Router();

router.use(requireSeller);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ items: await listAdminCatalog() });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = adminProductInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos del producto inválidos.', issues: parsed.error.issues });
      return;
    }
    res.status(201).json(await createAdminProduct(parsed.data));
  }),
);

// El id se valida antes de tocar la base: un id mal formado es un 404, no un
// error 500 de Postgres.
const idSchema = z.uuid();

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    const product = await getAdminProduct(id.data);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    res.json(product);
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    const parsed = adminProductInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos del producto inválidos.', issues: parsed.error.issues });
      return;
    }
    const updated = await updateAdminProduct(id.data, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    res.json(updated);
  }),
);

// Archivar = despublicar. Reversible, y no rompe pedidos que referencien el ítem.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    const archived = await archiveAdminProduct(id.data);
    if (!archived) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    res.json({ ok: true });
  }),
);

export default router;
