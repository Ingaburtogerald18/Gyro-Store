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
import catalogRouter from './routes/catalog';
import combosRouter from './routes/combos';
import ordersRouter from './routes/orders';
import { apiLimiter } from './middleware/rateLimiter';
import { sanitizeBody } from './utils/sanitize';
import { logger } from './utils/logger';

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
app.use('/api/catalog', catalogRouter);
app.use('/api/combos', combosRouter);
app.use('/api/orders', ordersRouter);

// ── Cierre de la cadena ──
app.use('/api', notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Gyro Store API arriba en puerto ${config.port}`, { env: config.env });
});
