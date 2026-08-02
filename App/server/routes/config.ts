import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getPublicConfig } from '../services/config.js';
import { getImageResources } from '../services/appConfig.js';

const router = Router();

// Endpoint público para obtener la configuración global de la tienda
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const publicConfig = getPublicConfig();
    const images = await getImageResources();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ ...publicConfig, images });
  })
);

export default router;