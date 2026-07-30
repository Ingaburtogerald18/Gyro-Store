// Entry del backend Express (TS/ESM). Monta la cadena de middleware, expone la
// API bajo /api y (más adelante) sirve el build del frontend.
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { asyncHandler } from './utils/asyncHandler';
import { requireAnyRole } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import configRouter from './routes/config';
import adminConfigRouter from './routes/adminConfig';
import landingRouter from './routes/landing';
import catalogRouter from './routes/catalog';
import adminCatalogRouter from './routes/adminCatalog';
import adminUsersRouter from './routes/adminUsers';
import inventoryRouter from './routes/inventory';
import salesRouter from './routes/sales';
import invoicesRouter from './routes/invoices';
import installmentsRouter from './routes/installments';
import uploadRouter from './routes/upload';

import combosRouter from './routes/combos';
import ordersRouter from './routes/orders';
import authRouter from './routes/auth';
import { apiLimiter, publicOrderLimiter } from './middleware/rateLimiter';
import { sanitizeBody } from './utils/sanitize';
import { logger } from './utils/logger';
import { startUserCleanupCron } from './services/cleanupUsers';

const app: Express = express();

// Render corre detrás de un proxy: necesario para IPs correctas y rate-limit.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.isProd ? config.corsOrigin || false : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Defensa en profundidad: recorta strings del body antes de que lo vean las rutas.
app.use(sanitizeBody);

app.use('/api', apiLimiter);

// ── Rutas ──

// Health check (Render). Público.
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Prueba de auth end-to-end: devuelve quién sos según tu JWT + rol resuelto.
// Cualquier rol válido puede consultarlo. (Reemplaza al /api/auth/me de v1.)
app.get(
  '/api/auth/me',
  requireAnyRole,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: req.user });
  }),
);

app.use('/api/config', configRouter);
app.use('/api/auth', authRouter);
app.use('/api/landing-config', landingRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/admin/catalog', adminCatalogRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/config', adminConfigRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/sales', salesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/installments', installmentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/combos', combosRouter);

// Límite propio para el checkout público, ANTES de montar el router de pedidos:
// es el único endpoint anónimo que escribe en la base. Solo intercepta el POST
// (el resto de /api/orders sigue con el límite general); al no ser el último
// handler del método, la petición continúa hacia ordersRouter.
app.post('/api/orders/public', publicOrderLimiter);
app.use('/api/orders', ordersRouter);

// ── Cierre de la cadena ──
app.use('/api', notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Gyro Store API arriba en puerto ${config.port}`, { env: config.env });
  
  // Iniciar tareas en segundo plano
  startUserCleanupCron();
});
