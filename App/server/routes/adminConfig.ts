import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin, requireSeller } from '../middleware/auth';
import {
  getFinancialConfig,
  updateFinancialConfig,
  getImageResources,
  updateImageResources,
} from '../services/appConfig';
import { financialConfigSchema, imageResourcesSchema } from '../../shared/schemas';
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

export default router;
