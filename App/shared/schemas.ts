import { z } from 'zod';

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CATÁLOGO ──
// ============================================================================

// Schema base para los templates de productos
export const templateSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  axes: z.record(z.string(), z.unknown()),
  options: z.record(z.string(), z.unknown()),
  specs: z.record(z.string(), z.unknown()),
});

// Schema principal para los ítems del catálogo
export const catalogItemSchema = z.object({
  id: z.uuid(),
  template_id: z.uuid().nullable(),
  
  // Precios y finanzas base
  base_price: z.number().nullable(),
  price: z.number().nullable(),
  precio_sugerido: z.number().nullable(),
  precio_tentativo: z.number().nullable(),
  
  // Configuraciones de variantes e imágenes
  variant_mappings: z.record(z.string(), z.unknown()),
  axis_options: z.record(z.string(), z.unknown()),
  images: z.array(z.unknown()),
  images_by_color: z.record(z.string(), z.unknown()),
  
  // Estado y orden
  published: z.boolean(),
  is_promo: z.boolean(),
  sort_order: z.number().int(),
  
  // Timestamps
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),

  // Relación embebida (Join desde el backend)
  template: templateSchema.nullable(),
});

// ============================================================================
// ── SCHEMAS DEL DOMINIO: COMBOS ──
// ============================================================================

export const comboSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  price: z.number().nullable(),
  // Forma de "items" (qué productos/SKUs componen el combo) todavía no
  // está documentada — se valida como array opaco hasta que se defina.
  // TODO(Claude): definir shape real de items cuando el checkout lo use.
  items: z.array(z.unknown()),
  images: z.array(z.unknown()),
  published: z.boolean(),
  sort_order: z.number().int(),
});

// ============================================================================
// ── TIPOS INFERIDOS GLOBALES ──
// ============================================================================

export type Template = z.infer<typeof templateSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type Combo = z.infer<typeof comboSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CHECKOUT PÚBLICO ──
// ============================================================================

// ── Checkout público (doc 04 §6, doc 12: server SIEMPRE recalcula el
// precio, nunca confía en lo que manda el cliente) ──

export const publicOrderItemInputSchema = z.object({
  catalogItemId: z.uuid(),
  quantity: z.number().int().positive(),
});

export const publicOrderInputSchema = z.object({
  phone: z.string().min(1, 'El teléfono es obligatorio.'),
  items: z.array(publicOrderItemInputSchema).min(1, 'El pedido necesita al menos un ítem.'),
});

export type PublicOrderItemInput = z.infer<typeof publicOrderItemInputSchema>;
export type PublicOrderInput = z.infer<typeof publicOrderInputSchema>;