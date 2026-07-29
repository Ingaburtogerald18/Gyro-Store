// Configuración central del backend. Lee variables de entorno desde .env.
// Fuente única de constantes de negocio expuestas al frontend vía GET /api/config.
// Portado de la v1 (server/config.js), adaptado a Supabase (sin Firebase).
import 'dotenv/config';

function parseEmailList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const adminEmails = parseEmailList(process.env.ADMIN_EMAILS || 'ingaburtogerald@gmail.com');
const sellerEmails = parseEmailList(process.env.SELLER_EMAILS);
const isProd = process.env.NODE_ENV === 'production';

// Roles válidos del sistema. global_admin tiene acceso total a todos los portales.
// El orden define la prioridad para elegir el "rol primario" de un usuario multi-rol.
export const VALID_ROLES = [
  'global_admin',
  'admin',
  'seller',
  'cashier',
  'logistics_admin',
  'logistics_customer',
] as const;

export type AppRole = (typeof VALID_ROLES)[number];

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd,
  port: Number(process.env.PORT) || 3000,

  // URL pública de la app (links de correos). En prod nunca debe caer a localhost.
  appUrl:
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    (isProd ? 'https://gyro-store.onrender.com' : `http://localhost:${Number(process.env.PORT) || 3000}`),

  // ── Supabase ──
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',

  // Roles y prioridad (multi-rol → rol primario por prioridad).
  validRoles: VALID_ROLES,
  rolePriority: VALID_ROLES,

  // Whitelist de roles por correo (arranque sin depender de la DB).
  adminEmails,
  sellerEmails,
  // El primer admin queda protegido: no puede ser editado ni eliminado por nadie.
  protectedEmail: (process.env.PROTECTED_ADMIN_EMAIL || adminEmails[0] || 'ingaburtogerald@gmail.com').toLowerCase(),

  // Dominio interno del tenant: los correos @gyrostorenic.com son staff local.
  internalDomain: (process.env.INTERNAL_DOMAIN || 'gyrostorenic.com').toLowerCase(),

  // ── Datos de negocio (se exponen vía GET /api/config) ──
  whatsapp: process.env.WHATSAPP_NUMBER || '50585944758',
  currency: process.env.CURRENCY || 'C$',
  exchangeRate: Number(process.env.EXCHANGE_RATE) || 37,

  // Categorías del catálogo (recicladas de v1).
  categories: [
    { id: 'audifonos-kz', name: 'Audífonos KZ in-ear', icon: '🎧' },
    { id: 'adaptador-bt', name: 'Adaptador Bluetooth para audífonos KZ', icon: '📶' },
    { id: 'accesorios-kz', name: 'Accesorios para audífonos KZ', icon: '🎚️' },
    { id: 'accesorios-pc', name: 'Accesorios para computadora', icon: '🖱️' },
  ],

  // CORS: orígenes permitidos en producción.
  corsOrigin: process.env.RENDER_EXTERNAL_URL || process.env.CORS_ORIGIN || '',
} as const;

// Validación mínima al arrancar: en prod, sin service_role no hay backend.
if (isProd && (!config.supabaseUrl || !config.supabaseServiceRoleKey)) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en producción.');
}

// NOTA: las tablas financieras (pozos, tiers de Costo F/U, márgenes, comisión,
// mayoreo) NO viven acá: son editables desde el panel y viven en `app_config`
// (ver doc 11). Este archivo solo tiene constantes de arranque e infraestructura.
