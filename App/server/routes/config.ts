import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getPublicConfig } from '../services/config.js';
import { getImageResources, getStoreCategories, getBusinessInfo } from '../services/appConfig.js';

const router = Router();

// Endpoint público para obtener la configuración global de la tienda
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const publicConfig = getPublicConfig();
    const [images, categories, business] = await Promise.all([
      getImageResources(),
      getStoreCategories(),
      getBusinessInfo(),
    ]);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    // `business` (editable desde el panel) pisa brandName/whatsapp/contactEmail
    // que vienen de env, y agrega ruc/address.
    res.json({ ...publicConfig, ...business, categories, images });
  })
);

export default router;