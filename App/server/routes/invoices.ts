// Facturación: /api/invoices (emitir, listar, buscar, corregir, anular).
// requireCashier cubre cashier+admin+global_admin (auth.ts) — v1 usaba el mismo
// rol para el POS. Anular exige admin: es la única operación irreversible.
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireCashier, requireAdmin } from '../middleware/auth';
import { parseUuidParam } from '../utils/params';
import {
  createInvoiceInputSchema,
  updateInvoiceInputSchema,
  voidInvoiceInputSchema,
} from '../../shared/schemas';
import {
  createInvoice,
  findInvoiceByNumber,
  listInvoices,
  updateInvoice,
  voidInvoice,
  getInvoiceTicket,
} from '../services/invoice';

const router = Router();

router.use(requireCashier);

const statusFilterSchema = z.enum(['unlinked', 'linked', 'void']);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = statusFilterSchema.safeParse(req.query.status);
    res.json(await listInvoices({ status: status.success ? status.data : undefined }));
  }),
);

// Va ANTES de cualquier `/:id`: si no, Express tomaría "lookup" como el id.
router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    // Llega el código impreso (`GS-PR-12`) o el número pelado: `findInvoiceByNumber`
    // lo normaliza al correlativo y devuelve null si no lo reconoce, así que no
    // se le manda basura a Postgres.
    const parsed = z.string().trim().min(1).max(20).safeParse(req.query.number);
    if (!parsed.success) {
      res.status(400).json({ error: 'Código de factura inválido.' });
      return;
    }
    const invoice = await findInvoiceByNumber(parsed.data);
    if (!invoice) {
      res.status(404).json({ error: 'Factura no encontrada.' });
      return;
    }
    res.json(invoice);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createInvoiceInputSchema.parse(req.body);
    const invoice = await createInvoice(data);
    res.status(201).json(invoice);
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Factura no encontrada.');
    const data = updateInvoiceInputSchema.parse(req.body);
    const updated = await updateInvoice(id, data);
    if (!updated) {
      res.status(404).json({ error: 'Factura no encontrada.' });
      return;
    }
    res.json(updated);
  }),
);

// Anular en vez de borrar: el correlativo no puede tener huecos. NO hay DELETE
// — v1 lo tenía, pero borrar un número ya emitido es justo lo que un
// correlativo no admite.
router.post(
  '/:id/void',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Factura no encontrada.');
    const data = voidInvoiceInputSchema.parse(req.body);
    const voided = await voidInvoice(id, data.reason, req.user!.uid);
    if (!voided) {
      res.status(404).json({ error: 'Factura no encontrada.' });
      return;
    }
    res.json(voided);
  }),
);

router.get(
  '/:id/ticket',
  asyncHandler(async (req, res) => {
    const id = parseUuidParam(req.params.id, 'Factura no encontrada.');
    const ticket = await getInvoiceTicket(id);
    if (!ticket) {
      res.status(404).json({ error: 'Factura no encontrada.' });
      return;
    }
    res.json(ticket);
  }),
);

export default router;
