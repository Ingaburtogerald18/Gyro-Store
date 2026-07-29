import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { listPublishedCombos } from '../services/combos';

const router = Router();

// Endpoint público para obtener todos los combos publicados
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listPublishedCombos();
    res.json({ items });
  })
);

export default router;