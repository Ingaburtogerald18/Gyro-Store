// Entry del backend Express (TS/ESM). Monta la cadena de middleware, expone la
// API bajo /api y (más adelante) sirve el build del frontend.
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
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
import discountCodesRouter from './routes/discountCodes';
import installmentsRouter from './routes/installments';
import uploadRouter from './routes/upload';

import combosRouter from './routes/combos';
import ordersRouter from './routes/orders';
import reportsRouter from './routes/reports';
import contactRouter from './routes/contact';
import authRouter from './routes/auth';
import cajaRouter from './routes/caja';
import cuadreRouter from './routes/cuadre';
import analyticsRouter from './routes/analytics';
import { apiLimiter, publicOrderLimiter, contactLimiter, telemetryLimiter } from './middleware/rateLimiter';
import { sanitizeBody } from './utils/sanitize';
import { logger } from './utils/logger';
import { startUserCleanupCron } from './services/cleanupUsers';
import { serveFrontend } from './serveFrontend';

const app: Express = express();

// Render corre detrás de un proxy: necesario para IPs correctas y rate-limit.
app.set('trust proxy', 1);

// Nonce por request para la CSP: habilita SOLO los <script> inline de Remix
// (hidratación, window.ENV, anti-flash de tema) sin abrir 'unsafe-inline'.
// Debe ir ANTES de helmet, porque la directiva script-src lo lee de res.locals.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.locals.cspNonce = randomBytes(16).toString('base64');
  next();
});

// Orígenes de Supabase permitidos para fetch/websocket desde el navegador:
// el login y la sesión hablan directo con supabase-js (auth + realtime + rest).
const supabaseOrigin = new URL(config.supabaseUrl).origin; // https://xxxx.supabase.co
const supabaseWss = supabaseOrigin.replace(/^https:/, 'wss:');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // 'self' para los bundles con hash; nonce para los inline de Remix.
        scriptSrc: ["'self'", (_req, res) => `'nonce-${(res as Response).locals.cspNonce}'`],
        // Radix y demás primitivas inyectan style="" inline; no se pueden firmar
        // con nonce, así que se permite inline SOLO para estilos (no scripts).
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", supabaseOrigin, supabaseWss],
        imgSrc: ["'self'", 'data:', 'blob:', supabaseOrigin],
      },
    },
  }),
);
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
app.use('/api/discount-codes', discountCodesRouter);
app.use('/api/installments', installmentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/combos', combosRouter);
app.use('/api/caja', cajaRouter);
app.use('/api/cuadre', cuadreRouter);

// Límite propio para el checkout público, ANTES de montar el router de pedidos:
// es el único endpoint anónimo que escribe en la base. Solo intercepta el POST
// (el resto de /api/orders sigue con el límite general); al no ser el último
// handler del método, la petición continúa hacia ordersRouter.
app.post('/api/orders/public', publicOrderLimiter);
app.use('/api/orders', ordersRouter);

// Mismo patrón: el límite propio intercepta el POST antes del router.
app.post('/api/contact', contactLimiter);
app.use('/api/contact', contactRouter);
app.use('/api/reports', reportsRouter);

// Telemetría del storefront. El límite estricto solo intercepta la ingesta
// pública (POST /api/analytics); las lecturas del dashboard (GET /admin/*) van
// autenticadas y con el límite general. Al no ser el último handler del método,
// la petición continúa hacia analyticsRouter.
app.post('/api/analytics', telemetryLimiter);
app.use('/api/analytics', analyticsRouter);

// ── Cierre de la cadena ──
app.use('/api', notFoundHandler);

// En producción, Express sirve además el frontend (Remix) en el mismo origen.
// En dev el frontend corre aparte (:5173) y proxya /api, así que no montamos nada.
if (config.isProd) {
  await serveFrontend(app);
}

app.use(errorHandler);

app.listen(Number(config.port), '0.0.0.0', () => {
  logger.info(`${config.brandName} API arriba en puerto ${config.port}`, { env: config.env });
  
  // Iniciar tareas en segundo plano
  startUserCleanupCron();
});
