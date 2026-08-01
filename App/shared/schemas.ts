import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CATÁLOGO ──
// ============================================================================

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es obligatorio.').max(80),
  slug: z.string().max(80),
});

export type Category = z.infer<typeof categorySchema>;

// Schema base para los templates de productos.
//
// `axes`/`specs` se validan como jsonb OPACO a propósito. La forma canónica de
// `axes` es un array ordenado ([{ key, label, options, isColor }]), pero en la
// base conviven filas viejas con forma de diccionario. Fijar acá una de las dos
// haría que la otra reventara con un 500 en la validación, ANTES de llegar a
// `services/catalogPresenter.ts`, que es quien sabe normalizar ambas.
export const templateSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  axes: z.unknown(),
  specs: z.unknown(),
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
  category_id: z.string().uuid().nullable().optional(),

  // Timestamps
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),

  // Relación embebida (Join desde el backend)
  template: templateSchema.nullable(),
  category: z.object({
    id: z.string(),
    name: z.string()
  }).nullable().optional(),
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
  // Nombre de la categoría a la que pertenece
  category: z.string(),
  categoryId: z.string().uuid().nullable().optional(),
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
  // Etiqueta visible del eje ("Tipo de conector"). Sin ella el selector de la
  // ficha tendría que mostrar el id interno.
  label: z.string(),
  options: z.array(z.string()),
  isColor: z.boolean(),
});

// Una combinación concreta de opciones, con su precio y su stock REAL ya
// resuelto contra bodega. Los códigos de lote que la respaldan no viajan: son
// datos internos del inventario.
export const catalogVariantSchema = z.object({
  variantName: z.string(),
  axisValues: z.array(z.string()),
  price: z.number(),
  stock: z.number().int(),
});

export const catalogDetailSchema = catalogProductSchema.extend({
  axes: z.array(catalogAxisSchema),
  variants: z.array(catalogVariantSchema),
});

export type CatalogVariant = z.infer<typeof catalogVariantSchema>;

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

// ── Plantillas (el molde reutilizable) ──
//
// Un eje es una dimensión de variante: "Color" con opciones ["Negro", "Azul"].
// `key` es el id interno (llave en `axis_options`), `label` lo que ve el
// cliente. `isColor` marca el eje que se representa con fotos en vez de texto.
export const templateAxisSchema = z.object({
  key: z.string().min(1, 'La clave del eje es obligatoria.').max(40),
  label: z.string().min(1, 'La etiqueta del eje es obligatoria.').max(60),
  options: z.array(z.string().min(1).max(60)).min(1, 'Cada eje necesita al menos una opción.').max(40),
  isColor: z.boolean().optional(),
});
export type TemplateAxis = z.infer<typeof templateAxisSchema>;

export const templateInputSchema = z.object({
  name: z.string().min(2, 'El nombre de la plantilla es obligatorio.').max(120),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  // Techo de ejes: las combinaciones crecen como producto cartesiano, así que
  // unos pocos ejes ya generan cientos de filas en la tabla de mapeo.
  axes: z.array(templateAxisSchema).max(6, 'Máximo 6 ejes por plantilla.'),
  specs: z.array(specRowSchema).max(30),
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

export const adminTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  categoryId: z.string().uuid().nullable(),
  axes: z.array(templateAxisSchema),
  specs: z.array(specRowSchema),
  updatedAt: z.string(),
});
export type AdminTemplate = z.infer<typeof adminTemplateSchema>;

// ── Vínculo variante ↔ bodega ──
//
// Cada combinación exacta de opciones ("Negro / Con micrófono") apunta a uno o
// más lotes de `purchases` POR SU CÓDIGO. Se guardan varios porque un lote se
// agota y entra otro del mismo artículo: mientras alguno tenga disponible, la
// variante se vende. El stock mostrado es la SUMA de los lotes vinculados.
//
// `price` es un override opcional: si falta, la variante usa el precio del
// producto. Nunca se guarda la disponibilidad a mano — se deriva del stock.
export const variantMappingSchema = z.object({
  codes: z.array(z.string().min(1).max(40)).max(20),
  price: z.number().min(0).max(9_999_999).optional(),
});
export type VariantMapping = z.infer<typeof variantMappingSchema>;

export const variantMappingsSchema = z.record(z.string().max(200), variantMappingSchema);
export type VariantMappings = z.infer<typeof variantMappingsSchema>;

// Entrada del formulario de producto del panel. Los precios, imágenes y el
// vínculo con bodega viven en `catalog_items`; los ejes y las specs base vienen
// del molde (`templates`), que el producto solo referencia.
export const adminProductInputSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.').max(120),
  description: z.string().max(2000).optional(),
  // Precio de venta. Se permite 0 para "consultar precio".
  price: z.number().min(0, 'El precio no puede ser negativo.').max(9_999_999),
  // Precio "antes": habilita el badge de descuento cuando es mayor que price.
  basePrice: z.number().min(0).max(9_999_999).optional(),
  images: z.array(z.string().max(2048)).max(8, 'Máximo 8 imágenes por producto.'),
  specs: z.array(specRowSchema).max(30),
  categoryId: z.string().uuid().nullable().optional(),
  published: z.boolean(),
  isPromo: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),

  // ── Molde y variantes ──
  templateId: z.string().uuid().nullable().optional(),
  // Recorte de opciones: qué ofrece ESTE producto por eje. Vacío = todas las
  // del molde (misma convención que v1, la respeta `includedOptions`).
  axisOptions: z.record(z.string().max(40), z.array(z.string().max(60))).optional(),
  variantMappings: variantMappingsSchema.optional(),
});

export type AdminProductInput = z.infer<typeof adminProductInputSchema>;

// Vista del panel: agrega lo que el storefront NO puede ver (los precios de la
// cadena financiera) y el estado de publicación.
export const adminProductSchema = z.object({
  id: z.uuid(),
  templateId: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  basePrice: z.number().nullable(),
  precioSugerido: z.number().nullable(),
  precioTentativo: z.number().nullable(),
  images: z.array(z.string()),
  specs: z.array(specRowSchema),
  categoryId: z.string().uuid().nullable(),
  published: z.boolean(),
  isPromo: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: z.string(),
  // Ejes heredados del molde: la tabla de mapeo los necesita para generar las
  // combinaciones sin tener que pedir la plantilla por separado.
  axes: z.array(templateAxisSchema),
  axisOptions: z.record(z.string(), z.array(z.string())),
  variantMappings: variantMappingsSchema,
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

// ============================================================================
// ── SCHEMAS DEL DOMINIO: INVENTARIO (ADMIN) ──
// ============================================================================
// Contrato de entrada de server/routes/inventory.ts. Los shapes de salida
// (Purchase, InventoryRow, InventoryKpis, MigratedItem) viven como interfaces
// TS en server/services/inventory.ts, no acá: son datos derivados que arma el
// servicio, no algo que un cliente mande y haya que validar en el borde.

export const newPurchaseInputSchema = z.object({
  purchaseDate: z.iso.date(),
  lot: z.string().min(1, 'El lote es obligatorio.').max(40),
  productName: z.string().min(1, 'El nombre del producto es obligatorio.').max(160),
  category: z.string().min(1, 'La categoría es obligatoria.').max(80),
  // >0: una compra de 0 unidades no tiene sentido y dividiría por cero en
  // finance.ts al recibirla (doc 11 §1: costo unitario origen = total/cantidad).
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0.'),
  costUnit: z.number().min(0),
  taxUnit: z.number().min(0),
  suggestedPrice: z.number().min(0).optional(),
});
export type NewPurchaseInput = z.infer<typeof newPurchaseInputSchema>;

// Edición post-creación. Deliberadamente NO es un `Partial<Purchase>` real:
// solo expone los campos de negocio editables a mano (insumos de costeo,
// identificación del lote). `status`, `quantitySold`, `quantityReserved`,
// `priceUnit`/`total` (derivados) quedan fuera — esos los mueven
// reportArrival/revertPurchase/el FIFO, no una edición libre.
export const updatePurchaseInputSchema = z.object({
  purchaseDate: z.iso.date().optional(),
  lot: z.string().min(1).max(40).optional(),
  code: z.string().min(1).max(40).optional(),
  productName: z.string().min(1).max(160).optional(),
  category: z.string().min(1).max(80).optional(),
  quantity: z.number().int().positive().optional(),
  costUnit: z.number().min(0).optional(),
  taxUnit: z.number().min(0).optional(),
  shippingUnit: z.number().min(0).optional(),
  suggestedPrice: z.number().min(0).optional(),
});
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseInputSchema>;

export const arrivalInputSchema = z.object({
  arrivalDate: z.iso.date(),
  shippingUnit: z.number().min(0),
  suggestedPrice: z.number().min(0).optional(),
});
export type ArrivalInput = z.infer<typeof arrivalInputSchema>;

export const newMigratedInputSchema = z.object({
  purchaseDate: z.iso.date(),
  lot: z.string().max(40).optional(),
  code: z.string().min(1, 'El código es obligatorio.').max(40),
  productName: z.string().min(1, 'El nombre del producto es obligatorio.').max(160),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0.'),
  costUnit: z.number().min(0),
  shippingUnit: z.number().min(0),
  comments: z.string().max(500).optional(),
});
export type NewMigratedInput = z.infer<typeof newMigratedInputSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: VENTAS (ADMIN/SELLER) ──
// ============================================================================
// MVP de Hito 3 (doc 09 ítem 60): cotizar, registrar, aprobar, rechazar,
// listar. Sin fotos de recibo, sin venta vía ticket de factura, sin edición
// post-aprobación ni pago de comisiones por lotes — ver doc 11 §4-5 para la
// cadena financiera que server/services/sales.ts arma con estos datos.

export const saleLineInputSchema = z.object({
  // Mismo límite que inventario (doc 09 ítem 51): sin un catalog_item_id real
  // en purchases todavía, el producto se identifica por nombre, no por SKU.
  productName: z.string().min(1, 'El producto es obligatorio.').max(160),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0.'),
  salePrice: z.number().min(0),
  // Mayoreo es herramienta del cotizador (doc 11 §5), no automático: default
  // true a nivel de servicio, pero el vendedor lo puede desactivar por línea.
  applyWholesale: z.boolean().optional(),
});
export type SaleLineInput = z.infer<typeof saleLineInputSchema>;

export const quoteInputSchema = z.object({
  items: z.array(saleLineInputSchema).min(1, 'Selecciona al menos un producto.').max(50),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const registerSaleInputSchema = z.object({
  phone: z.string().max(20).optional(),
  items: z
    .array(saleLineInputSchema)
    .min(1, 'La venta necesita al menos un producto.')
    .max(50)
    .refine((items) => new Set(items.map((i) => i.productName)).size === items.length, {
      message: 'No repitas el mismo producto en dos líneas: sumá la cantidad en una sola.',
    }),
});
export type RegisterSaleInput = z.infer<typeof registerSaleInputSchema>;

export const rejectSaleInputSchema = z.object({
  reason: z.string().min(1, 'El motivo de rechazo es obligatorio.').max(500),
});
export type RejectSaleInput = z.infer<typeof rejectSaleInputSchema>;

// ── Pago de comisiones (doc 11 §4) ──
// El comprobante viaja como URL ya subida a `POST /api/upload`, no como
// multipart: v2 centraliza las subidas ahí y así esta ruta queda siendo JSON.
//
// El `refine` es la regla de auditoría: un pago sin comprobante Y sin
// justificación es un movimiento de dinero sin rastro. La base lo repite como
// CHECK constraint — el borde valida para dar un mensaje útil, la tabla para
// que no entre por ninguna otra puerta.
const payoutProofSchema = {
  paymentMethod: z.enum(['efectivo', 'transferencia', 'tarjeta']),
  receiptUrl: z.string().max(2048).optional(),
  noReceiptComment: z.string().max(500).optional(),
};

const hasProof = (d: { receiptUrl?: string; noReceiptComment?: string }) =>
  Boolean(d.receiptUrl?.trim() || d.noReceiptComment?.trim());
const proofMessage = {
  message: 'Subí el comprobante o justificá por qué no lo hay.',
  path: ['receiptUrl'],
};

export const payCommissionInputSchema = z
  .object({
    sellerEmail: z.string().email('Vendedor inválido.'),
    orderIds: z
      .array(z.uuid())
      .min(1, 'Elegí al menos una venta para pagar.')
      .max(200, 'Máximo 200 ventas por lote.'),
    ...payoutProofSchema,
  })
  .refine(hasProof, proofMessage);
export type PayCommissionInput = z.infer<typeof payCommissionInputSchema>;

export const settleBalanceInputSchema = z
  .object({
    sellerEmail: z.string().email('Vendedor inválido.'),
    ...payoutProofSchema,
  })
  .refine(hasProof, proofMessage);
export type SettleBalanceInput = z.infer<typeof settleBalanceInputSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: FACTURACIÓN (ADMIN/CASHIER) ──
// ============================================================================
// Modelo delgado (doc 09 ítem 61): la factura numera una venta YA aprobada
// (server/services/sales.ts) — no tiene líneas propias, esas viven en
// order_items. `invoiceNumber` nunca lo manda el cliente: lo asigna el
// `nextval()` de la secuencia en server/services/invoice.ts.
export const createInvoiceInputSchema = z.object({
  orderId: z.uuid(),
  method: z.enum(['efectivo', 'transferencia', 'tarjeta']),
  deliveryFee: z.number().min(0).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;

// Anular exige motivo: una factura anulada sin explicación es un hueco en la
// auditoría. El correlativo conserva el número — no se borra nunca.
export const voidInvoiceInputSchema = z.object({
  reason: z.string().min(1, 'El motivo de anulación es obligatorio.').max(500),
});
export type VoidInvoiceInput = z.infer<typeof voidInvoiceInputSchema>;

// Corrección de datos de cobro. `orderId` no se puede cambiar: reasignar una
// factura a otra venta rompería la trazabilidad del correlativo.
export const updateInvoiceInputSchema = z.object({
  method: z.enum(['efectivo', 'transferencia', 'tarjeta']).optional(),
  deliveryFee: z.number().min(0).max(9_999_999).optional(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInputSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CUOTAS (ADMIN) ──
// ============================================================================
// Mismo modelo delgado que facturación: el plan de cuotas envuelve una venta
// YA aprobada (server/services/sales.ts) — no repite FIFO ni comisión, solo
// agenda el cobro. `total` sale de `orders.total`, no lo manda el cliente.
export const createInstallmentPlanInputSchema = z.object({
  orderId: z.uuid(),
  numCuotas: z.number().int().min(2, 'Mínimo 2 cuotas.').max(36),
  firstDue: z.iso.date(),
});
export type CreateInstallmentPlanInput = z.infer<typeof createInstallmentPlanInputSchema>;

export const registerInstallmentPaymentInputSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0.'),
  method: z.enum(['efectivo', 'transferencia', 'tarjeta']).optional(),
  note: z.string().max(300).optional(),
});
export type RegisterInstallmentPaymentInput = z.infer<typeof registerInstallmentPaymentInputSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: CONTACTO PÚBLICO / CRM (doc 09 ítems 33-34) ──
// ============================================================================
// El formulario público de "Contacto" captura el lead directo en el CRM
// (contacts/contact_activities) — v1 solo mandaba un correo (sin servicio de
// email en v2 todavía). Teléfono obligatorio: es la clave de `contacts.phone`
// (unique) — mismo criterio que doc 14 ("teléfono siempre obligatorio, es la
// llave"). `contacts` no tiene columna de email; si lo mandan, viaja dentro
// de la nota de la actividad en vez de perderse.
export const publicContactInputSchema = z.object({
  name: z.string().min(2, 'Ingresá tu nombre.').max(80),
  phone: z
    .string()
    .min(1, 'El teléfono es obligatorio.')
    .max(20, 'El teléfono es demasiado largo.')
    .regex(PHONE_RE, 'Ingresá un teléfono válido: 8 a 15 dígitos, con + opcional.'),
  email: z.string().email('Correo inválido.').max(120).optional().or(z.literal('')),
  message: z.string().min(1, 'Escribí tu mensaje.').max(1000, 'Máximo 1000 caracteres.'),
});
export type PublicContactInput = z.infer<typeof publicContactInputSchema>;

// ============================================================================
// ── SCHEMAS DEL DOMINIO: OPERACIÓN DIARIA (SALIDAS, CAJA, CUADRE) ──
// ============================================================================

export const salidaDestinoSchema = z.enum(['mostrador', 'delivery']);
export const salidaEstadoSchema = z.enum(['facturada', 'pendiente_registro', 'registrada', 'devuelta']);
export const liquidacionEstadoSchema = z.enum(['no_aplica', 'pendiente', 'depositado', 'efectivo_recibido', 'recordar']);

export const salidaSchema = z.object({
  id: z.string().uuid(),
  articulo: z.string(),
  destino: salidaDestinoSchema,
  invoice_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  estado: salidaEstadoSchema,
  repartidor: z.string().nullable(),
  monto_esperado: z.number().nullable(),
  liquidacion: liquidacionEstadoSchema,
  liquidado_at: z.string().nullable(),
  comprobante_url: z.string().nullable(),
  cuenta_deposito_id: z.string().uuid().nullable(),
  nota: z.string().nullable(),
  salio_at: z.string(),
  registrado_por: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Salida = z.infer<typeof salidaSchema>;

export const registerSalidaInputSchema = z.object({
  articulo: z.string().min(1, 'Debe especificar el artículo'),
  destino: salidaDestinoSchema,
  invoice_id: z.string().uuid().optional().nullable(),
  repartidor: z.string().optional().nullable(),
  monto_esperado: z.coerce.number().optional().nullable(),
  nota: z.string().optional().nullable(),
});
export type RegisterSalidaInput = z.infer<typeof registerSalidaInputSchema>;

export const liquidarSalidaInputSchema = z.object({
  liquidacion: liquidacionEstadoSchema.exclude(['no_aplica']),
  monto_esperado: z.coerce.number().optional(),
  cuenta_deposito_id: z.string().uuid().optional().nullable(),
  comprobante_url: z.string().optional().nullable(),
  nota: z.string().optional().nullable(),
}).refine(data => {
  if (data.liquidacion === 'depositado') {
    return !!data.cuenta_deposito_id;
  }
  return true;
}, {
  message: 'Si la liquidación es por depósito, se requiere seleccionar la cuenta.',
  path: ['cuenta_deposito_id'],
});
export type LiquidarSalidaInput = z.infer<typeof liquidarSalidaInputSchema>;

export const cuentaTipoSchema = z.enum(['banco', 'efectivo']);
export const movimientoTipoSchema = z.enum(['ingreso', 'egreso']);

export const accountSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  tipo: cuentaTipoSchema,
  moneda: z.string(),
  activo: z.boolean(),
  created_at: z.string(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountMovementSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  tipo: movimientoTipoSchema,
  monto: z.number(),
  categoria: z.string(),
  descripcion: z.string().nullable(),
  salida_id: z.string().uuid().nullable(),
  comprobante_url: z.string().nullable(),
  ocurrio_at: z.string(),
  registrado_por: z.string().uuid().nullable(),
  created_at: z.string(),
});
export type AccountMovement = z.infer<typeof accountMovementSchema>;

export const registerMovementInputSchema = z.object({
  account_id: z.string().uuid('Cuenta inválida'),
  tipo: movimientoTipoSchema,
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  categoria: z.string().min(1, 'Categoría requerida'),
  descripcion: z.string().optional().nullable(),
  comprobante_url: z.string().optional().nullable(),
  ocurrio_at: z.string().optional(),
});
export type RegisterMovementInput = z.infer<typeof registerMovementInputSchema>;