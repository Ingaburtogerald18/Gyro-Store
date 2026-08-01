import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireRole } from '../middleware/auth';
import { registerMovementInputSchema } from '../../shared/schemas';
import { listAccounts, createAccount, toggleAccountStatus, listMovements, registerMovement } from '../services/caja';

const router = Router();

router.use(requireRole('admin', 'cashier'));

// ── ACCOUNTS ──
router.get(
  '/accounts',
  asyncHandler(async (_req, res) => {
    const accounts = await listAccounts();
    res.json(accounts);
  })
);

router.post(
  '/accounts',
  asyncHandler(async (req, res) => {
    const { nombre, tipo, moneda } = req.body;
    if (!nombre || !tipo) {
      res.status(400).json({ error: 'nombre y tipo son requeridos' });
      return;
    }
    const account = await createAccount(nombre, tipo, moneda);
    res.status(201).json(account);
  })
);

router.patch(
  '/accounts/:id/toggle',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    const account = await toggleAccountStatus(id!, Boolean(activo));
    res.json(account);
  })
);

// ── MOVEMENTS ──
router.get(
  '/movimientos',
  asyncHandler(async (req, res) => {
    const accountId = req.query.accountId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    const movements = await listMovements({ accountId, startDate, endDate });
    res.json(movements);
  })
);

router.post(
  '/movimientos',
  asyncHandler(async (req, res) => {
    const data = registerMovementInputSchema.parse(req.body);
    const userId = req.user!.id;
    const movement = await registerMovement(data, userId);
    res.status(201).json(movement);
  })
);

export default router;
