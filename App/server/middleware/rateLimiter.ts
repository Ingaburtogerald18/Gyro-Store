import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

// Límite general para toda la API: 300 peticiones cada 15 minutos por IP
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite estricto para endpoints de telemetría: 20 peticiones cada 5 minutos por IP
export const telemetryLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});