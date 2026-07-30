import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { listPublishedCombos, getPublishedCombo } from '../services/combos';

const router = Router();

// Endpoint público para obtener todos los combos publicados
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listPublishedCombos();
    res.json({ items });
  })
);

// El id se valida antes de tocar la base: un id mal formado es un 404, no un
// error 500 de Postgres (mismo criterio que adminCatalog.ts).
const idSchema = z.uuid();

// Detalle de un combo publicado (página de combo, doc 09 ítem 46).
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ error: 'Combo no encontrado.' });
      return;
    }
    const combo = await getPublishedCombo(id.data);
    if (!combo) {
      res.status(404).json({ error: 'Combo no encontrado.' });
      return;
    }
    res.json(combo);
  }),
);

export default router;