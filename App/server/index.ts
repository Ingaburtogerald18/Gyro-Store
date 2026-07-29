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
import { apiLimiter } from './middleware/rateLimiter';

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
app.use(express.urlencoded({ extended: true }));

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

// ── Cierre de la cadena ──
app.use('/api', notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`✅ Gyro Store API en http://localhost:${config.port} (${config.env})`);
});