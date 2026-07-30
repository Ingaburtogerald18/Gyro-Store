import { db } from '../supabase';
import { comboSchema, type Combo } from '../../shared/schemas';
import { parseDbRows } from '../utils/parseDbRows';

// Obtiene los combos publicados.
// TODO(Claude): enriquecer "items" (doc 03) cuando se defina la forma del jsonb — hoy se devuelve tal cual viene de la DB.
export async function listPublishedCombos(): Promise<Combo[]> {
  const { data, error } = await db
    .from('combos')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  // Validamos el array completo y retornamos el tipo inferido de forma segura.
  // Si la base devuelve algo que no cumple el contrato es un 500, no un 400: el
  // cliente no tiene nada que corregir en su request (ver parseDbRows).
  return parseDbRows(comboSchema, data, 'combos');
}
