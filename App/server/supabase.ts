// Cliente de Supabase del lado servidor, con la `service_role key`.
// Es el equivalente al Admin SDK de la v1: IGNORA las RLS (que están en deny-all).
// Regla dura: este cliente SOLO existe en el backend. Nunca en el frontend.
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

export const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    // El servidor no maneja sesiones de usuario: solo usa la llave de servicio.
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Verifica un JWT de Supabase (emitido tras el login con Entra) y devuelve el
// usuario, o null si es inválido/expirado. Usa la API oficial de Supabase Auth,
// que valida el token sin importar el esquema de firma del proyecto.
// [optimización futura] verificar el JWT localmente con SUPABASE_JWT_SECRET para
// ahorrar el round-trip; por ahora priorizamos que sea correcto y simple.
export async function getUserFromToken(token: string) {
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
