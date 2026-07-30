// Catálogo desde el panel. A diferencia del servicio público, acá SÍ se ven los
// productos despublicados y los precios de la cadena financiera.
//
// El modelo reparte un "producto" en dos tablas: el nombre y las specs viven en
// `templates` (el molde reutilizable) y los precios, imágenes y estado en
// `catalog_items`. Este servicio esconde ese reparto: el panel manda un objeto
// plano y acá se traduce.
import { db } from '../supabase';
import type { AdminProduct, AdminProductInput, SpecRow } from '../../shared/schemas';

// Se listan las columnas a mano (nunca `select('*')`): así una columna nueva no
// se filtra sola a una respuesta sin que nadie lo revise.
const ADMIN_COLUMNS = [
  'id',
  'template_id',
  'price',
  'base_price',
  'precio_sugerido',
  'precio_tentativo',
  'images',
  'published',
  'is_promo',
  'sort_order',
  'updated_at',
  'template:templates(id, name, specs)',
].join(', ');

interface AdminRow {
  id: string;
  template_id: string | null;
  price: number | null;
  base_price: number | null;
  precio_sugerido: number | null;
  precio_tentativo: number | null;
  images: unknown;
  published: boolean;
  is_promo: boolean;
  sort_order: number;
  updated_at: string;
  template: { id: string; name: string | null; specs: unknown } | { id: string; name: string | null; specs: unknown }[] | null;
}

function firstTemplate(template: AdminRow['template']) {
  return Array.isArray(template) ? (template[0] ?? null) : template;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toSpecs(value: unknown): SpecRow[] {
  if (Array.isArray(value)) {
    return value.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const spec = raw as Record<string, unknown>;
      if (typeof spec.label !== 'string') return [];
      return [{ label: spec.label, value: String(spec.value ?? '') }];
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([label, v]) => ({
      label,
      value: String(v ?? ''),
    }));
  }
  return [];
}

function toAdminProduct(row: AdminRow): AdminProduct {
  const template = firstTemplate(row.template);
  return {
    id: row.id,
    templateId: row.template_id,
    name: template?.name ?? 'Sin nombre',
    price: row.price ?? row.base_price ?? 0,
    basePrice: row.base_price,
    precioSugerido: row.precio_sugerido,
    precioTentativo: row.precio_tentativo,
    images: toStringArray(row.images),
    specs: toSpecs(template?.specs),
    published: row.published,
    isPromo: row.is_promo,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

export async function listAdminCatalog(): Promise<AdminProduct[]> {
  const { data, error } = await db
    .from('catalog_items')
    .select(ADMIN_COLUMNS)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as AdminRow[]).map(toAdminProduct);
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const { data, error } = await db
    .from('catalog_items')
    .select(ADMIN_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? toAdminProduct(data as unknown as AdminRow) : null;
}

// Crear = un template (nombre + specs) y su ítem de catálogo. Si el insert del
// ítem falla, se borra el template para no dejarlo huérfano.
export async function createAdminProduct(input: AdminProductInput): Promise<AdminProduct> {
  const { data: template, error: templateError } = await db
    .from('templates')
    .insert({ name: input.name, specs: input.specs, axes: {}, options: {} })
    .select('id')
    .single();

  if (templateError) throw templateError;

  const { data: item, error: itemError } = await db
    .from('catalog_items')
    .insert({
      template_id: template.id,
      price: input.price,
      base_price: input.basePrice ?? null,
      images: input.images,
      published: input.published,
      is_promo: input.isPromo,
      sort_order: input.sortOrder,
    })
    .select('id')
    .single();

  if (itemError) {
    await db.from('templates').delete().eq('id', template.id);
    throw itemError;
  }

  const created = await getAdminProduct(item.id);
  if (!created) throw new Error('El producto se creó pero no se pudo leer de vuelta.');
  return created;
}

export async function updateAdminProduct(
  id: string,
  input: AdminProductInput,
): Promise<AdminProduct | null> {
  const existing = await getAdminProduct(id);
  if (!existing) return null;

  const { error: itemError } = await db
    .from('catalog_items')
    .update({
      price: input.price,
      base_price: input.basePrice ?? null,
      images: input.images,
      published: input.published,
      is_promo: input.isPromo,
      sort_order: input.sortOrder,
    })
    .eq('id', id);

  if (itemError) throw itemError;

  // El nombre y las specs viven en el molde. Un ítem sin template es dato viejo:
  // se le crea uno al vuelo para que pueda tener nombre.
  if (existing.templateId) {
    const { error } = await db
      .from('templates')
      .update({ name: input.name, specs: input.specs })
      .eq('id', existing.templateId);
    if (error) throw error;
  } else {
    const { data: template, error } = await db
      .from('templates')
      .insert({ name: input.name, specs: input.specs, axes: {}, options: {} })
      .select('id')
      .single();
    if (error) throw error;
    const { error: linkError } = await db
      .from('catalog_items')
      .update({ template_id: template.id })
      .eq('id', id);
    if (linkError) throw linkError;
  }

  return getAdminProduct(id);
}

// Despublicar en vez de borrar: el producto puede estar referenciado por pedidos
// históricos, y "archivar" es reversible. El borrado duro no se expone.
export async function archiveAdminProduct(id: string): Promise<boolean> {
  const { data, error } = await db
    .from('catalog_items')
    .update({ published: false })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
