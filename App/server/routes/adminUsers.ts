import { Router } from 'express';
import type { Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import { db } from '../supabase';
import { config, VALID_ROLES, type AppRole } from '../config';
import { getSellerSummary } from '../services/sellerPayments';
import { updateProfileSchema } from '../../shared/schemas';

const router = Router();

// Fuente ÚNICA del correo protegido: config.protectedEmail (PROTECTED_ADMIN_EMAIL
// o adminEmails[0]). Sin fallback hardcodeado a propósito: un correo personal en el
// código es una puerta trasera silenciosa (ver la nota de server/config.ts). Si no
// hay whitelist, queda en '' y ningún correo real matchea.
const SUPER_ADMIN_EMAIL = config.protectedEmail;

const isValidRole = (r: unknown): r is AppRole => VALID_ROLES.includes(r as AppRole);

// Valida el array de roles pedido y aplica la regla anti-escalada: solo un
// global_admin puede otorgar global_admin. Devuelve { roles } saneado o un error
// con { status, message } listo para responder.
function validateRolesForActor(
  roles: unknown,
  actor: Request['user'],
): { roles: AppRole[] } | { status: number; message: string } {
  if (!Array.isArray(roles)) {
    return { status: 400, message: 'Formato inválido para roles.' };
  }
  const invalid = roles.filter((r) => !isValidRole(r));
  if (invalid.length) {
    return { status: 400, message: `Roles inválidos: ${invalid.join(', ')}.` };
  }
  const clean = roles as AppRole[];
  const actorIsGlobal = actor?.roles?.includes('global_admin') ?? false;
  if (clean.includes('global_admin') && !actorIsGlobal) {
    return {
      status: 403,
      message: 'Solo un administrador global puede otorgar el rol global_admin.',
    };
  }
  return { roles: clean };
}

// GET /api/admin/users
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    // Select from profiles (service_role ignores RLS)
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // `isProtected` viaja calculado desde acá y no se deriva en el cliente: el
    // correo protegido sale de una variable de entorno (config.protectedEmail),
    // así que hardcodearlo en el frontend lo dejaría desincronizado en cuanto
    // cambie. Es solo una pista de UI — quien deniega de verdad es el backend.
    const rows = (data || []).map((u: { email?: string | null }) => ({
      ...u,
      isProtected:
        !!SUPER_ADMIN_EMAIL && (u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
    }));

    res.json(rows);
  })
);
// POST /api/admin/users
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { email, name, roles } = req.body;

    if (!email || !name) {
      res.status(400).json({ error: 'Faltan datos requeridos (email, name).' });
      return;
    }

    if (!email.endsWith(`@${config.internalDomain}`)) {
      res.status(400).json({ error: `El correo debe pertenecer al dominio @${config.internalDomain}.` });
      return;
    }

    // Validar roles y bloquear escalada a global_admin desde un admin común.
    const rolesCheck = validateRolesForActor(roles ?? [], req.user);
    if ('status' in rolesCheck) {
      res.status(rolesCheck.status).json({ error: rolesCheck.message });
      return;
    }

    // 1. Pre-crear la identidad en Supabase Auth. El login real SIEMPRE es por
    // Entra ID (ver middleware/auth.ts), así que esta contraseña nunca se usa para
    // entrar; la generamos aleatoria para no dejar una credencial conocida en el
    // repo. El usuario solo necesita que su perfil exista con sus roles asignados.
    const tempPassword = `Gyro-${crypto.randomUUID()}`;
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Ya viene confirmado para no requerir verificación
      user_metadata: { name }
    });

    if (authError) {
      // Manejar error amigable si el usuario ya existe
      if (authError.message.includes('already exists')) {
        res.status(400).json({ error: 'El usuario ya existe en Supabase Auth. Solo espera a que inicie sesión para ver su perfil.' });
      } else {
        throw authError;
      }
      return;
    }

    const newUserId = authData.user.id;

    // 2. Insertar el perfil en Postgres con el ID generado y los roles
    const { data: profileData, error: profileError } = await db
      .from('profiles')
      .insert({
        id: newUserId,
        email,
        name,
        roles: rolesCheck.roles,
        avatar_url: ''
      })
      .select('id, email, name, roles, avatar_url, deleted_at, created_at')
      .single();

    if (profileError) {
      throw profileError;
    }

    res.json(profileData);
  })
);

// PATCH /api/admin/users/:email/roles
router.patch(
  '/:email/roles',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const email = req.params.email as string;
    const { roles } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email requerido.' });
      return;
    }

    if (SUPER_ADMIN_EMAIL && email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      res.status(403).json({ error: 'Operación denegada: Este usuario está protegido por el sistema.' });
      return;
    }

    // Validar roles y bloquear escalada a global_admin desde un admin común.
    const rolesCheck = validateRolesForActor(roles, req.user);
    if ('status' in rolesCheck) {
      res.status(rolesCheck.status).json({ error: rolesCheck.message });
      return;
    }

    const { data, error } = await db
      .from('profiles')
      .update({ roles: rolesCheck.roles })
      .eq('email', email)
      .select();

    if (error) {
      throw error;
    }

    res.json(data);
  })
);

// DELETE /api/admin/users/:id
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id as string;

    if (!userId) {
      res.status(400).json({ error: 'ID requerido.' });
      return;
    }

    // Proteger al super admin consultando su email
    const { data: profile } = await db.from('profiles').select('email').eq('id', userId).single();
    if (profile?.email && profile.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      res.status(403).json({ error: 'Operación denegada: Este usuario está protegido por el sistema.' });
      return;
    }

    // Hard delete: Borrar de Auth (esto borra el perfil en cascada si está configurado, o lo borramos manual)
    const { error: authError } = await db.auth.admin.deleteUser(userId);
    
    // Si falla Auth (por ejemplo si ya no existe), borramos el perfil por si acaso quedó huérfano
    const { error: profileError } = await db.from('profiles').delete().eq('id', userId);

    if (authError && profileError) {
      throw profileError;
    }

    res.json({ message: 'Usuario borrado de forma permanente' });
  })
);

// PATCH /api/admin/users/:id/suspend
router.patch(
  '/:id/suspend',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id as string;
    if (!userId) {
      res.status(400).json({ error: 'ID requerido.' });
      return;
    }

    const { data: profile } = await db.from('profiles').select('email').eq('id', userId).single();
    if (profile?.email && profile.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      res.status(403).json({ error: 'Operación denegada: Este usuario está protegido por el sistema.' });
      return;
    }

    const { data, error } = await db
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId)
      .select();

    if (error) throw error;
    res.json({ message: 'Usuario dado de baja', data });
  })
);

// PATCH /api/admin/users/:id/restore
router.patch(
  '/:id/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id as string;
    if (!userId) {
      res.status(400).json({ error: 'ID requerido.' });
      return;
    }

    const { data, error } = await db
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', userId)
      .select();

    if (error) throw error;
    res.json({ message: 'Usuario restaurado', data });
  })
);

// PATCH /api/admin/users/:id/profile
router.patch(
  '/:id/profile',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id as string;

    if (!userId) {
      res.status(400).json({ error: 'ID requerido.' });
      return;
    }

    const input = updateProfileSchema.parse(req.body);

    // El string vacío significa "borrar el dato", no "no tocar": se guarda como
    // NULL para que la columna quede realmente vacía y no con un '' que después
    // se muestra como si hubiera algo. La cuenta bancaria usa `null` para lo
    // mismo (es un objeto jsonb, no un string).
    const blankToNull = (v: string | undefined) => (v === undefined || v === '' ? null : v);

    const { data, error } = await db
      .from('profiles')
      .update({
        name: input.name,
        phone: blankToNull(input.phone),
        personal_email: blankToNull(input.personal_email),
        bank_account: input.bank_account ?? null,
      })
      .eq('id', userId)
      .select('id, email, name, roles, avatar_url, status, deleted_at, created_at, phone, personal_email, bank_account, last_login');

    if (error) throw error;
    res.json({ message: 'Perfil actualizado', data });
  })
);

// GET /api/admin/users/:id/performance
router.get(
  '/:id/performance',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id as string;
    if (!userId) {
      res.status(400).json({ error: 'ID requerido.' });
      return;
    }

    const { data: profile, error } = await db
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (error || !profile?.email) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const summary = await getSellerSummary(profile.email);
    res.json(summary);
  })
);

export default router;
