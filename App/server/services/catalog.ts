import { z } from 'zod';
import { db } from '../supabase';
import { catalogItemSchema, type CatalogItem } from '../../shared/schemas';

// Obtiene los ítems del catálogo publicados junto con su template embebido.
// Valida la respuesta contra el contrato único de Zod antes de retornarla
// para asegurar que el frontend siempre reciba la estructura esperada.
export async function listPublishedCatalog(): Promise<CatalogItem[]> {
  const { data, error } = await db
    .from('catalog_items')
    .select('*, template:templates(*)')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  // Validamos el array completo y retornamos el tipo inferido de forma segura
  return z.array(catalogItemSchema).parse(data ?? []);
}