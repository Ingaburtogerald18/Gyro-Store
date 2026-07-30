import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

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

// Vista PÚBLICA del ítem de catálogo: lo único que puede salir al storefront.
//
// Es la BASE del contrato y el schema interno la extiende, no al revés. La
// dirección importa: si mañana se agrega una columna sensible (un costo, un
// margen), no se vuelve pública por olvido — hay que agregarla acá a mano.
export const publicCatalogItemSchema = z.object({
  id: z.uuid(),
  template_id: z.uuid().nullable(),

  // Precios que el comprador sí puede ver (lo que se le cobra).
  base_price: z.number().nullable(),
  price: z.number().nullable(),

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

// Vista INTERNA (panel/admin): agrega los precios calculados de la cadena
// financiera. `precio_sugerido` y `precio_tentativo` dejan leer el margen del
// negocio hacia atrás (doc 11 §3), así que NUNCA se sirven en endpoints públicos.
export const catalogItemSchema = publicCatalogItemSchema.extend({
  precio_sugerido: z.number().nullable(),
  precio_tentativo: z.number().nullable(),
});

// ── Contrato de CABLE del catálogo público ──
//
// `publicCatalogItemSchema` (arriba) valida lo que sale de la BASE: filas crudas
// en snake_case con el template anidado y jsonb opacos. Eso NO es lo que conviene
// mandarle al navegador: armar el nombre, resolver las variantes desde los ejes y
// sumar stock es trabajo de servidor (necesita tablas que el cliente no ve).
//
// Por eso el backend aplica un presentador (server/services/catalogPresenter.ts)
// y responde ESTE shape: plano, camelCase, listo para pintar. Es el mismo contrato
// que ya consume el storefront, así que los componentes se reciclan sin tocarse.
export const specRowSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const catalogProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().optional(),
  // Vacío por ahora: la v2 todavía no tiene columna de categoría (ver el
  // presentador). La card simplemente no pinta el eyebrow cuando viene vacía.
  category: z.string(),
  images: z.array(z.string()),
  price: z.number(),
  compareAtPrice: z.number().optional(),
  stock: z.number(),
  isPromo: z.boolean(),
  specs: z.array(specRowSchema),
  // Opciones no-color ofrecidas: alimentan las pills de la tarjeta.
  axesSummary: z.array(z.string()),
  // Nº de combinaciones: si es >1 hay que elegir variante antes de agregar.
  variantCount: z.number().int(),
  templateId: z.string().nullable(),
});

// Eje de variante ya resuelto (ej. { key: 'color', options: ['negro', ...] }).
// Solo se expone en el DETALLE: la tarjeta del listado no necesita el árbol
// completo de opciones, le alcanza con `axesSummary`.
export const catalogAxisSchema = z.object({
  key: z.string(),
  options: z.array(z.string()),
  isColor: z.boolean(),
});

export const catalogDetailSchema = catalogProductSchema.extend({
  axes: z.array(catalogAxisSchema),
});

export type SpecRow = z.infer<typeof specRowSchema>;
export type WholesaleDiscount = z.infer<typeof wholesaleDiscountItemSchema>;

export const imageResourcesSchema = z.object({
  logoStatic: z.string().url('Debe ser una URL válida').or(z.literal('')).optional(),
  logoAnimated: z.string().url('Debe ser una URL válida').or(z.literal('')).optional(),
  favicon: z.string().url('Debe ser una URL válida').or(z.literal('')).optional(),
  posLogo: z.string().url('Debe ser una URL válida').or(z.literal('')).optional(),
});
export type ImageResources = z.infer<typeof imageResourcesSchema>;
export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type CatalogAxis = z.infer<typeof catalogAxisSchema>;
export type CatalogDetail = z.infer<typeof catalogDetailSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CATÁLOGO (ADMIN) ──
// ============================================================================

// Entrada del formulario de producto del panel. El nombre y las specs viven en
// `templates` (el molde) y los precios/imágenes en `catalog_items`; el servicio
// del admin se encarga de repartirlos entre las dos tablas.
export const adminProductInputSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.').max(120),
  // Precio de venta. Se permite 0 para "consultar precio".
  price: z.number().min(0, 'El precio no puede ser negativo.').max(9_999_999),
  // Precio "antes": habilita el badge de descuento cuando es mayor que price.
  basePrice: z.number().min(0).max(9_999_999).optional(),
  images: z.array(z.string().max(2048)).max(8, 'Máximo 8 imágenes por producto.'),
  specs: z.array(specRowSchema).max(30),
  published: z.boolean(),
  isPromo: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
});

export type AdminProductInput = z.infer<typeof adminProductInputSchema>;

// Vista del panel: agrega lo que el storefront NO puede ver (los precios de la
// cadena financiera) y el estado de publicación.
export const adminProductSchema = z.object({
  id: z.uuid(),
  templateId: z.string().nullable(),
  name: z.string(),
  price: z.number(),
  basePrice: z.number().nullable(),
  precioSugerido: z.number().nullable(),
  precioTentativo: z.number().nullable(),
  images: z.array(z.string()),
  specs: z.array(specRowSchema),
  published: z.boolean(),
  isPromo: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: z.string(),
});

export type AdminProduct = z.infer<typeof adminProductSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: LANDING (Hero slider) ──
// ============================================================================

// Una diapositiva del hero. `actionType` "modal" abre "Quiénes Somos";
// "link" navega a `actionTarget`. `locked` (la de marca) impide mover o
// eliminar, pero sí editar.
export const heroSlideSchema = z.object({
  id: z.string().min(1).max(64),
  eyebrow: z.string().max(60),
  title: z.string().max(120),
  description: z.string().max(400),
  mediaUrl: z.string().max(2048),
  mediaType: z.enum(['image', 'video']),
  buttonText: z.string().max(40),
  actionType: z.enum(['modal', 'link']),
  actionTarget: z.string().max(2048),
  locked: z.boolean().optional(),
});

// Techo de diapositivas: el hero es una vitrina, no un carrusel infinito.
export const MAX_HERO_SLIDES = 12;

export const landingConfigSchema = z.object({
  // Ids de categoría en el orden/visibilidad que eligió el admin. Vacío = todas
  // en su orden natural (los nombres salen del catálogo, no de aquí).
  headerCategories: z.array(z.string().max(64)).max(50),
  heroSlides: z.array(heroSlideSchema).max(MAX_HERO_SLIDES),
});

export type HeroSlide = z.infer<typeof heroSlideSchema>;
export type LandingConfig = z.infer<typeof landingConfigSchema>;

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
export type PublicCatalogItem = z.infer<typeof publicCatalogItemSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type Combo = z.infer<typeof comboSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CHECKOUT PÚBLICO ──
// ============================================================================

// ── Checkout público (doc 04 §6, doc 12: server SIEMPRE recalcula el
// precio, nunca confía en lo que manda el cliente) ──

// Teléfono nicaragüense o internacional: 8 a 15 dígitos, con `+` opcional.
// El límite de 15 es el máximo de E.164. Sin esta regex, `phone` aceptaba
// cualquier string (incluido un payload de 5 MB o texto para inyectar en el
// mensaje de WhatsApp que se arma después).
const PHONE_RE = /^\+?\d{8,15}$/;

export const publicOrderItemInputSchema = z.object({
  catalogItemId: z.uuid(),
  // Techo por línea: sin él, un `quantity` absurdo (1e9) infla el total y puede
  // desbordar los cálculos financieros. El mayoreo real se cotiza con un vendedor.
  quantity: z.number().int().positive().max(999, 'Máximo 999 unidades por producto.'),
  // Variante elegida (ej. "negro / 128GB"). Es SOLO para el mensaje de WhatsApp:
  // el precio nunca depende de esto, lo resuelve el servidor por catalogItemId.
  variantName: z.string().max(120).optional(),
});

export const publicOrderInputSchema = z.object({
  phone: z
    .string()
    .min(1, 'El teléfono es obligatorio.')
    .max(20, 'El teléfono es demasiado largo.')
    .regex(PHONE_RE, 'Ingresá un teléfono válido: 8 a 15 dígitos, con + opcional.'),

  // ── Datos de contacto y entrega ──
  // Alimentan el mensaje de WhatsApp, que es el canal donde se cierra el pedido
  // en el MVP (doc 06). Hoy la tabla `public_orders` solo guarda teléfono y
  // total; persistirlos requiere una migración pendiente (ver 0005 propuesta).
  customerName: z.string().min(2, 'Ingresá tu nombre.').max(80),
  deliveryMethod: z.enum(['retiro', 'envio']),
  address: z.string().max(200).optional(),
  // Link de Google Maps con el pin del cliente (opcional, lo llena el botón GPS).
  locationUrl: z.string().max(300).optional(),
  note: z.string().max(500).optional(),
  // Techo de líneas por pedido: acota el trabajo que un request anónimo puede
  // pedirle a la DB (el service consulta y luego inserta una fila por ítem).
  items: z
    .array(publicOrderItemInputSchema)
    .min(1, 'El pedido necesita al menos un ítem.')
    .max(50, 'El pedido no puede tener más de 50 productos distintos.'),
})
  // Para envío hace falta dirección escrita O ubicación GPS: sin ninguna de las
  // dos, el pedido no es despachable y solo generaría una ida y vuelta por chat.
  .refine(
    (d) =>
      d.deliveryMethod !== 'envio' ||
      (d.address ?? '').trim().length > 4 ||
      Boolean(d.locationUrl),
    {
      message: 'Agregá tu dirección o compartí tu ubicación para el envío.',
      path: ['address'],
    },
  );

export type PublicOrderItemInput = z.infer<typeof publicOrderItemInputSchema>;
export type PublicOrderInput = z.infer<typeof publicOrderInputSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CONFIGURACIÓN FINANCIERA (app_config) ──
// ============================================================================

export const costoFUScaleItemSchema = z.object({
  maxCost: z.number().nullable(), // null significa infinito (catch-all)
  amount: z.number().min(0),
});

export const pozosSchema = z.object({
  publicidad: z.number().min(0).max(1),
  mantenimiento: z.number().min(0).max(1),
  utiles: z.number().min(0).max(1),
  garantias: z.number().min(0).max(1),
  prestamos: z.number().min(0).max(1),
  suscripciones: z.number().min(0).max(1),
  servicios: z.number().min(0).max(1),
});

export const marginScaleItemSchema = z.object({
  maxCost: z.number().nullable(),
  margin: z.number().min(0).max(1),
});

export const commissionScaleItemSchema = z.object({
  maxProfit: z.number().nullable(),
  margin: z.number().min(0).max(1),
});

export const wholesaleDiscountItemSchema = z.object({
  minQty: z.number().int().min(2),
  discount: z.number().min(0).max(1),
});

export const financialConfigSchema = z.object({
  exchangeRate: z.number().positive('Debe ser mayor a 0'),
  salaryPercentage: z.number().min(0).max(1),
  costoFUScale: z.array(costoFUScaleItemSchema).min(1, 'Se requiere al menos un tramo'),
  pozos: pozosSchema,
  marginScale: z.array(marginScaleItemSchema).min(1, 'Se requiere al menos un tramo'),
  commissionScale: z.array(commissionScaleItemSchema).min(1, 'Se requiere al menos un tramo'),
  wholesaleDiscounts: z.array(wholesaleDiscountItemSchema),
}).refine((data) => {
  const sum = Object.values(data.pozos).reduce((acc, val) => acc + val, 0);
  return Math.abs(sum - 1.0) < 0.001; // Tolerancia flotante
}, {
  message: 'La suma de los pozos debe ser exactamente 100%.',
  path: ['pozos'],
});

export type FinancialConfig = z.infer<typeof financialConfigSchema>;