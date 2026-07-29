// Verificación de JWT de Supabase (login con Entra) + resolución de roles.
// Portado de la v1 (middleware/auth.js): whitelist por env → tabla `profiles` →
// array de roles. La autorización REAL vive acá; el frontend solo oculta botones.
import type { Request, Response, NextFunction } from 'express';
import { config, VALID_ROLES, type AppRole } from '../config';
import { db, getUserFromToken } from '../supabase';

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  roles: AppRole[];
  role: AppRole | null;
}

// Extiende Request para llevar el usuario autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const isValidRole = (r: unknown): r is AppRole => VALID_ROLES.includes(r as AppRole);

export function primaryRole(roles: AppRole[]): AppRole | null {
  return config.rolePriority.find((r) => roles.includes(r)) || roles[0] || null;
}

// Lee el perfil por id de auth (una sola vez). Devuelve la fila o null.
// Tolera que la tabla `profiles` aún no exista (durante el Hito 0): captura y
// devuelve null, para que la whitelist por env siga funcionando.
async function fetchProfile(uid: string) {
  try {
    const { data, error } = await db
      .from('profiles')
      .select('roles, status, deleted_at, name, avatar_url')
      .eq('id', uid)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// Deriva los roles: 1) whitelist por env (rápido, sin DB), 2) tabla profiles.
function rolesFromEnvOrProfile(
  email: string,
  profile: Awaited<ReturnType<typeof fetchProfile>>,
): AppRole[] {
  const lower = email.toLowerCase();

  if (config.adminEmails.includes(lower)) {
    return lower === config.protectedEmail ? ['global_admin'] : ['admin'];
  }
  if (config.sellerEmails.includes(lower)) return ['seller'];

  if (profile && profile.status !== 'disabled' && !profile.deleted_at) {
    const roles = Array.isArray(profile.roles) ? profile.roles.filter(isValidRole) : [];
    if (roles.length) return roles;
  }
  return [];
}

// Verifica el Bearer token y devuelve { user } o { error, message }.
export async function authenticate(
  req: Request,
): Promise<{ user: AuthUser } | { error: number; message: string }> {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { error: 401, message: 'Falta el token de sesión.' };

  const supaUser = await getUserFromToken(token);
  if (!supaUser || !supaUser.email) {
    return { error: 401, message: 'Sesión inválida o expirada.' };
  }

  const email = supaUser.email.toLowerCase();
  const meta = (supaUser.user_metadata ?? {}) as { name?: string; full_name?: string; avatar_url?: string; picture?: string };

  // Solo staff: cuentas del tenant (@gyrostorenic.com) o de la whitelist de env.
  const isInternal = email.endsWith(`@${config.internalDomain}`);
  const isWhitelisted = config.adminEmails.includes(email) || config.sellerEmails.includes(email);
  if (!isInternal && !isWhitelisted) {
    return { error: 403, message: 'Esta cuenta no pertenece al personal de Gyro Store.' };
  }

  const profile = await fetchProfile(supaUser.id);
  const roles = rolesFromEnvOrProfile(email, profile);
  if (!roles.length) {
    return { error: 403, message: 'Esta cuenta no tiene permisos asignados.' };
  }

  return {
    user: {
      uid: supaUser.id,
      email,
      name: meta.name || meta.full_name || profile?.name || '',
      photoURL: meta.avatar_url || meta.picture || profile?.avatar_url || '',
      roles,
      role: primaryRole(roles),
    },
  };
}

// Factory: deja pasar si el usuario tiene alguno de los roles indicados,
// o si es global_admin (acceso total).
export function requireRole(...allowed: AppRole[]) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const result = await authenticate(req);
    if ('error' in result) return res.status(result.error).json({ error: result.message });

    const { roles } = result.user;
    const ok = roles.includes('global_admin') || allowed.some((r) => roles.includes(r));
    if (!ok) return res.status(403).json({ error: 'Esta cuenta no tiene permisos para esta sección.' });

    req.user = result.user;
    next();
  };
}

// Atajos por portal (mismos que la v1).
export const requireAdmin = requireRole('admin');
export const requireSeller = requireRole('admin', 'seller');
export const requireCashier = requireRole('admin', 'cashier');
export const requireLogisticsAdmin = requireRole('admin', 'logistics_admin');
export const requireLogisticsAny = requireRole('admin', 'logistics_admin', 'logistics_customer');
export const requireAnyRole = requireRole(...VALID_ROLES);
