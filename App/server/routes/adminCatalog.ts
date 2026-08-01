// CRUD del catálogo desde el panel. Todo el router exige rol de staff:
// admin o seller pueden gestionar productos (doc 04 §1.4).
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireSeller } from '../middleware/auth';
import { adminProductInputSchema, templateInputSchema } from '../../shared/schemas';
import {
  archiveAdminProduct,
  createAdminProduct,
  getAdminProduct,
  listAdminCatalog,
  reorderAdminCatalog,
  updateAdminProduct,
} from '../services/adminCatalog';
import {
  countProductsUsingTemplate,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '../services/templates';
import { listAvailableLots } from '../services/inventory';
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

// El id se valida antes de tocar la base: un id mal formado es un 404, no un
// error 500 de Postgres.
const idSchema = z.uuid();

// ==========================================
// RUTAS DE PLANTILLAS (el molde de variantes)
// ==========================================
// Van ANTES de `/:id`: si no, Express haría coincidir "templates" con el
// parámetro y el listado de plantillas caería en el detalle de producto.

router.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    res.json(await listTemplates());
  }),
);

router.post(
  '/templates',
  asyncHandler(async (req, res) => {
    const data = templateInputSchema.parse(req.body);
    res.status(201).json(await createTemplate(data));
  }),
);

router.get(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Plantilla no encontrada.' });
      return;
    }
    const template = await getTemplate(id.data);
    if (!template) {
      res.status(404).json({ error: 'Plantilla no encontrada.' });
      return;
    }
    res.json(template);
  }),
);

router.put(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Plantilla no encontrada.' });
      return;
    }
    const data = templateInputSchema.parse(req.body);
    const updated = await updateTemplate(id.data, data);
    if (!updated) {
      res.status(404).json({ error: 'Plantilla no encontrada.' });
      return;
    }
    res.json(updated);
  }),
);

// Borrar un molde en uso dejaría a sus productos sin ejes y con un mapeo de
// variantes que ya no corresponde a ninguna combinación: se bloquea y se dice
// cuántos productos hay que reasignar primero.
router.delete(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Plantilla no encontrada.' });
      return;
    }
    const inUse = await countProductsUsingTemplate(id.data);
    if (inUse > 0) {
      res.status(409).json({
        error: `${inUse} producto(s) usan esta plantilla. Cambiales la plantilla antes de borrarla.`,
      });
      return;
    }
    const deleted = await deleteTemplate(id.data);
    if (!deleted) {
      res.status(404).json({ error: 'Plantilla no encontrada.' });
      return;
    }
    res.json({ ok: true });
  }),
);

// ==========================================
// BODEGA: lotes disponibles para vincular
// ==========================================
// Alimenta el buscador de la tabla de variantes. Vive bajo /admin/catalog (y no
// bajo /admin/inventory) porque es una vista recortada y a la medida del
// editor de catálogo, no el inventario completo.
router.get(
  '/inventory-lots',
  asyncHandler(async (_req, res) => {
    res.json(await listAvailableLots());
  }),
);

// ==========================================
// REORDEN DE LA GRILLA
// ==========================================
const reorderSchema = z.object({
  items: z
    .array(z.object({ id: z.uuid(), sortOrder: z.number().int().min(0).max(9999) }))
    .max(500),
});

router.post(
  '/reorder',
  asyncHandler(async (req, res) => {
    const data = reorderSchema.parse(req.body);
    await reorderAdminCatalog(data.items);
    res.json({ ok: true });
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
    try {
      const archived = await archiveAdminProduct(id.data);
      if (!archived) {
        res.status(404).json({ error: 'Producto no encontrado.' });
        return;
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'No se pudo eliminar el producto.' });
    }
  }),
);

export default router;
