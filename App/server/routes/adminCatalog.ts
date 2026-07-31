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
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../services/categories';

const router = Router();

router.use(requireSeller);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ items: await listAdminCatalog() });
  }),
);

// ==========================================
// RUTAS DE CATEGORÍAS
// ==========================================

const categoryInputSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
});

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json(await listCategories());
  }),
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const data = categoryInputSchema.parse(req.body);
    res.status(201).json(await createCategory(data.name, data.slug));
  }),
);

router.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }
    const data = categoryInputSchema.parse(req.body);
    const updated = await updateCategory(id.data, data.name, data.slug);
    if (!updated) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }
    res.json(updated);
  }),
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }
    await deleteCategory(id.data);
    res.json({ ok: true });
  }),
);

// ==========================================
// RUTAS DE PRODUCTOS
// ==========================================

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = adminProductInputSchema.parse(req.body);
    res.status(201).json(await createAdminProduct(data));
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
    const data = adminProductInputSchema.parse(req.body);
    const updated = await updateAdminProduct(id.data, data);
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
