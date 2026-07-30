import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import { landingConfigSchema } from '../../shared/schemas';
import { getLandingConfig, saveLandingConfig } from '../services/landing';

const router = Router();

// Público: el storefront necesita los slides del hero para pintar la home.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getLandingConfig());
  }),
);

// Solo admin: es contenido de portada, no lo toca ni un seller.
router.put(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = landingConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Configuración de landing inválida.',
        issues: parsed.error.issues,
      });
      return;
    }
    res.json(await saveLandingConfig(parsed.data));
  }),
);

export default router;
