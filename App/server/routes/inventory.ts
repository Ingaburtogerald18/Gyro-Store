// CRUD del inventario (bodega) desde el panel: lotes de compra (purchases) e
// inventario migrado (migrated_inventory). Cumple el contrato de
// frontend/app/store/api/inventoryV1Api.ts (mismos paths/verbos) — no el de
// inventoryApi.ts, que es un draft sin usar (ver server/services/inventory.ts).
// Solo admin: a diferencia del catálogo (adminCatalog.ts, admin+seller),
// comprar/recibir stock es tarea de administración (doc 09 ítems 49.5-51).
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import { parseUuidParam } from '../utils/params';
import {
  newPurchaseInputSchema,
  updatePurchaseInputSchema,
  arrivalInputSchema,
  newMigratedInputSchema,
} from '../../shared/schemas';
import {
  getPurchases,
  getCurrentInventory,
  getAvailableInventory,
  getIncomingInventory,
  getInventoryKpis,
  createPurchase,
  reportArrival,
  updatePurchase,
  revertPurchase,
  deletePurchase,
  getMigratedInventory,
  createMigratedItem,
  updateMigratedItem,
  deleteMigratedItem,
} from '../services/inventory';

const router = Router();

router.use(requireAdmin);

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/);

// "all"/vacío/formato inválido = sin filtro (historial completo), igual que
// hace el frontend con `withPeriod`.
function parsePeriod(raw: unknown): string | undefined {
  const parsed = periodSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

// ── purchases ──

router.get(
  '/purchases',
  asyncHandler(async (req, res) => {
    res.json(await getPurchases(parsePeriod(req.query.period)));
  }),
);

router.get(
  '/current',
  asyncHandler(async (req, res) => {
    res.json(await getCurrentInventory(parsePeriod(req.query.period)));
  }),
);

router.get(
  '/available',
  asyncHandler(async (_req, res) => {
    res.json(await getAvailableInventory());
  }),
);

router.get(
  '/incoming',
  asyncHandler(async (_req, res) => {
    res.json(await getIncomingInventory());
  }),
);

router.get(
  '/kpis',
  asyncHandler(async (req, res) => {
    res.json(await getInventoryKpis(parsePeriod(req.query.period)));
  }),
);

router.post(
  '/purchases',
  asyncHandler(async (req, res) => {
    const data = newPurchaseInputSchema.parse(req.body);
    res.status(201).json(await createPurchase(data));
  }),
);

router.patch(
  '/purchases/:id/arrival',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Compra no encontrada.');
    const data = arrivalInputSchema.parse(req.body);
    const ok = await reportArrival(id, data);
    if (!ok) {
      res.status(404).json({ error: 'Compra no encontrada.' });
      return;
    }
    res.json({ ok: true });
  }),
);

router.put(
  '/purchases/:id',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Compra no encontrada.');
    const data = updatePurchaseInputSchema.parse(req.body);
    const ok = await updatePurchase(id, data);
    if (!ok) {
      res.status(404).json({ error: 'Compra no encontrada.' });
      return;
    }
    res.json({ ok: true });
  }),
);

router.patch(
  '/purchases/:id/revert',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Compra no encontrada.');
    const ok = await revertPurchase(id);
    if (!ok) {
      res.status(404).json({ error: 'Compra no encontrada.' });
      return;
    }
    res.json({ ok: true });
  }),
);

router.delete(
  '/purchases/:id',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Compra no encontrada.');
    const ok = await deletePurchase(id);
    if (!ok) {
      res.status(404).json({ error: 'Compra no encontrada.' });
      return;
    }
    res.json({ ok: true });
  }),
);

// ── inventario migrado ──

router.get(
  '/migrated',
  asyncHandler(async (req, res) => {
    res.json(await getMigratedInventory(parsePeriod(req.query.period)));
  }),
);

router.post(
  '/migrated',
  asyncHandler(async (req, res) => {
    const data = newMigratedInputSchema.parse(req.body);
    res.status(201).json(await createMigratedItem(data));
  }),
);

router.put(
  '/migrated/:id',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Ítem migrado no encontrado.');
    const data = newMigratedInputSchema.parse(req.body);
    const updated = await updateMigratedItem(id, data);
    if (!updated) {
      res.status(404).json({ error: 'Ítem migrado no encontrado.' });
      return;
    }
    res.json(updated);
  }),
);

router.delete(
  '/migrated/:id',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Ítem migrado no encontrado.');
    const ok = await deleteMigratedItem(id);
    if (!ok) {
      res.status(404).json({ error: 'Ítem migrado no encontrado.' });
      return;
    }
    res.json({ ok: true });
  }),
);

export default router;
