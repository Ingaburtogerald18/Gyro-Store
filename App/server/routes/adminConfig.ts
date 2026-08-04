import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin, requireSeller } from '../middleware/auth';
import {
  getFinancialConfig,
  updateFinancialConfig,
  getImageResources,
  updateImageResources,
  getStoreCategories,
  updateStoreCategories,
  getBusinessInfo,
  updateBusinessInfo,
} from '../services/appConfig';
import { financialConfigSchema, imageResourcesSchema, storeCategoriesSchema, businessInfoSchema } from '../../shared/schemas';
import { deleteFileByUrl } from '../services/storage';

const router = Router();

// GET /api/admin-config
// Accesible para admin y seller (vendedores usan los % de mayoreo en el cotizador)
router.get(
  '/',
  requireSeller,
  asyncHandler(async (_req, res) => {
    const config = await getFinancialConfig();
    res.json(config);
  })
);

// PUT /api/admin-config
// Solo administradores pueden alterar las reglas financieras
router.put(
  '/financial',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = financialConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Configuración inválida.', issues: parsed.error.issues });
      return;
    }

    const updated = await updateFinancialConfig(parsed.data);
    res.json(updated);
  })
);

router.get(
  '/images',
  requireSeller,
  asyncHandler(async (_req, res) => {
    const config = await getImageResources();
    res.json(config);
  })
);

router.put(
  '/images',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = imageResourcesSchema.parse(req.body);

    const oldConfig = await getImageResources();
    const updated = await updateImageResources(data);

    // Delete orphaned images from R2
    const oldImages = [oldConfig.logoStatic, oldConfig.logoAnimated, oldConfig.favicon, oldConfig.posLogo].filter(Boolean) as string[];
    const newImages = [updated.logoStatic, updated.logoAnimated, updated.favicon, updated.posLogo].filter(Boolean) as string[];
    
    const removed = oldImages.filter(url => typeof url === 'string' && !newImages.includes(url));
    if (removed.length > 0) {
      await Promise.all(removed.map(url => deleteFileByUrl(url).catch(console.error)));
    }

    res.json(updated);
  })
);

// Categorías del storefront (chips del landing). GET abierto a seller (las usa
// el catálogo interno); PUT solo admin.
router.get(
  '/categories',
  requireSeller,
  asyncHandler(async (_req, res) => {
    res.json(await getStoreCategories());
  })
);

router.put(
  '/categories',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = storeCategoriesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Categorías inválidas.', issues: parsed.error.issues });
      return;
    }
    const updated = await updateStoreCategories(parsed.data);
    res.json(updated);
  })
);

// Info del negocio (nombre, RUC, WhatsApp, correo, dirección). GET a seller;
// PUT solo admin.
router.get(
  '/business',
  requireSeller,
  asyncHandler(async (_req, res) => {
    res.json(await getBusinessInfo());
  })
);

router.put(
  '/business',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = businessInfoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos del negocio inválidos.', issues: parsed.error.issues });
      return;
    }
    const updated = await updateBusinessInfo(parsed.data);
    res.json(updated);
  })
);

export default router;
