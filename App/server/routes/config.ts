import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getPublicConfig } from '../services/config';

const router = Router();

// Endpoint público para obtener la configuración global de la tienda
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const publicConfig = getPublicConfig();
    res.json(publicConfig);
  })
);

export default router;