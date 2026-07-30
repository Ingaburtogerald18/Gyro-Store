// Configuración central del backend. Lee variables de entorno desde .env.
// Fuente única de constantes de negocio expuestas al frontend vía GET /api/config.
// Portado de la v1 (server/config.js), adaptado a Supabase (sin Firebase).
import 'dotenv/config'; // Trigger server reload

function parseEmailList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Sin fallback hardcodeado a propósito: un correo personal incrustado en el código
// es una puerta trasera silenciosa (queda en el repo, en el historial y en cualquier
// fork). La whitelist de admin se declara SIEMPRE por env.
const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
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
  // Si no hay whitelist configurada queda en '' (ningún correo real matchea), así
  // que nadie escala a global_admin por accidente.
  protectedEmail: (process.env.PROTECTED_ADMIN_EMAIL || adminEmails[0] || '').toLowerCase(),

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
  // CORS_ORIGIN manda sobre RENDER_EXTERNAL_URL: el dominio propio (o el del front,
  // si algún día se separa del backend) es el que hay que permitir; la URL que
  // inyecta Render es solo el fallback cuando no hay dominio configurado.
  corsOrigin: process.env.CORS_ORIGIN || process.env.RENDER_EXTERNAL_URL || '',
} as const;

// ── Validación de arranque (fail-fast) ──
// Preferimos morir acá, con un mensaje propio y accionable, antes de arrancar a
// medias. Sin esto, la falta de SUPABASE_URL explota más adelante como un
// "supabaseUrl is required" de supabase-js que no dice qué hacer.
const missingSupabaseVars = [
  !config.supabaseUrl && 'SUPABASE_URL',
  !config.supabaseServiceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
].filter(Boolean);

if (missingSupabaseVars.length) {
  throw new Error(
    `Faltan variables de entorno de Supabase: ${missingSupabaseVars.join(', ')}. ` +
      'Copiá App/.env.example a App/.env y completá los valores de tu proyecto ' +
      '(Supabase > Project Settings > API).',
  );
}

// Ya no hay correo de admin hardcodeado, así que en producción una whitelist vacía
// significa que nadie podría administrar el sistema: es un error de configuración,
// no un estado válido.
if (isProd && !adminEmails.length) {
  throw new Error(
    'Falta ADMIN_EMAILS en producción: sin whitelist de admin nadie puede entrar al panel.',
  );
}

// NOTA: las tablas financieras (pozos, tiers de Costo F/U, márgenes, comisión,
// mayoreo) NO viven acá: son editables desde el panel y viven en `app_config`
// (ver doc 11). Este archivo solo tiene constantes de arranque e infraestructura.
