import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { listPublishedCatalog } from '../services/catalog';

const router = Router();

// Endpoint público para obtener todos los ítems publicados del catálogo
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listPublishedCatalog();
    res.json({ items });
  })
);

export default router;
