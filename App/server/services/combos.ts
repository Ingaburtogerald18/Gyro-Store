import { z } from 'zod';
import { db } from '../supabase';
import { comboSchema, type Combo } from '../../shared/schemas';

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

  // Validamos el array completo y retornamos el tipo inferido de forma segura
  return z.array(comboSchema).parse(data ?? []);
}