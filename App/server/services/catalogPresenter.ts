// Presentador del catálogo público: fila de base → objeto listo para pintar.
//
// Portado del `enrich()` que corría en la v1 (server/routes/catalog.js). Vive en
// el servidor a propósito: resolver variantes desde los ejes del template y —más
// adelante— sumar stock por SKU necesita datos que el navegador no debe ver.
//
// La fila cruda ya viene validada contra `publicCatalogItemSchema`, así que acá
// solo se normaliza. Los campos jsonb (`images`, `axis_options`, template.axes)
// son opacos en el contrato: se leen de forma tolerante y nunca tiran excepción.
import type {
  CatalogDetail,
  CatalogProduct,
  PublicCatalogItem,
  SpecRow,
} from '../../shared/schemas';

// Forma canónica de un eje, ya normalizada desde cualquiera de las variantes de
// jsonb que puede traer el template.
interface Axis {
  key: string;
  options: string[];
  isColor: boolean;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

// `template.axes` es jsonb opaco y admite dos formas en el proyecto:
//   · array  (v1):  [{ key, label, options, isColor }]
//   · record (v2):  { color: ['negro', ...] }  — la que usa el seed de dev
// Se soportan ambas para que la migración de datos de v1 no rompa nada, y para
// que el panel del Hito 2 pueda fijar una sin tocar este archivo.
function normalizeAxes(axes: unknown): Axis[] {
  if (Array.isArray(axes)) {
    return axes.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const axis = raw as Record<string, unknown>;
      const key = typeof axis.key === 'string' ? axis.key : '';
      if (!key) return [];
      return [{
        key,
        options: asStringArray(axis.options),
        isColor: axis.isColor === true || key.toLowerCase().includes('color'),
      }];
    });
  }
  if (axes && typeof axes === 'object') {
    return Object.entries(axes as Record<string, unknown>).map(([key, options]) => ({
      key,
      options: asStringArray(options),
      isColor: key.toLowerCase().includes('color'),
    }));
  }
  return [];
}

// Opciones que ESTE producto ofrece de un eje: `axis_options` puede recortar el
// catálogo de opciones del template (ej. el template tiene 5 colores, el ítem
// vende 2). Sin recorte, se ofrecen todas.
function includedOptions(item: PublicCatalogItem, axis: Axis): string[] {
  const selected = asStringArray(
    (item.axis_options as Record<string, unknown> | null)?.[axis.key],
  );
  if (selected.length) return axis.options.filter((o) => selected.includes(o));
  return axis.options;
}

// Pills de la tarjeta: opciones NO-color que ofrece el producto (los colores ya
// se ven en las fotos, repetirlos como texto es ruido).
function buildAxesSummary(item: PublicCatalogItem, axes: Axis[]): string[] {
  const out: string[] = [];
  for (const axis of axes) {
    if (axis.isColor) continue;
    out.push(...includedOptions(item, axis));
  }
  return out.slice(0, 6);
}

// Combinaciones = producto cartesiano de las opciones ofrecidas. La tarjeta lo
// usa para decidir si puede agregar directo (≤1) o necesita selector de variante.
function countCombos(item: PublicCatalogItem, axes: Axis[]): number {
  if (!axes.length) return 1;
  let total = 1;
  for (const axis of axes) total *= includedOptions(item, axis).length || 1;
  return total;
}

// `images` es jsonb opaco: tolera strings sueltos u objetos { url } / { src }.
function normalizeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return entry ? [entry] : [];
    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const url = typeof obj.url === 'string' ? obj.url : obj.src;
      if (typeof url === 'string' && url) return [url];
    }
    return [];
  });
}

function normalizeSpecs(value: unknown): SpecRow[] {
  if (Array.isArray(value)) {
    return value.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const spec = raw as Record<string, unknown>;
      if (typeof spec.label !== 'string') return [];
      return [{ label: spec.label, value: String(spec.value ?? '') }];
    });
  }
  // Forma de diccionario: { driver: '10 mm' } → [{ label: 'driver', value: '10 mm' }]
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([label, v]) => ({
      label,
      value: String(v ?? ''),
    }));
  }
  return [];
}

// Detalle: lo mismo que el listado + los ejes de variante resueltos, que la
// ficha necesita para pintar el selector de opciones.
export function toCatalogDetail(item: PublicCatalogItem): CatalogDetail {
  const axes = normalizeAxes(item.template?.axes);
  return {
    ...toCatalogProduct(item),
    axes: axes.map((axis) => ({
      key: axis.key,
      options: includedOptions(item, axis),
      isColor: axis.isColor,
    })),
  };
}

export function toCatalogProduct(item: PublicCatalogItem): CatalogProduct {
  const axes = normalizeAxes(item.template?.axes);

  // Fotos del ítem; si no tiene, cae a las que estén cargadas por color.
  const ownImages = normalizeImages(item.images);
  const images = ownImages.length
    ? ownImages
    : Object.values(item.images_by_color ?? {}).flatMap(normalizeImages);

  // `price` es lo que se cobra; `base_price` actúa como precio "antes" cuando es
  // mayor (habilita el badge de descuento). Si solo hay uno, ese manda.
  const price = item.price ?? item.base_price ?? 0;
  const basePrice = item.base_price ?? 0;
  const compareAtPrice = basePrice > price ? basePrice : undefined;

  return {
    id: item.id,
    name: item.template?.name ?? 'Producto',
    // La v2 todavía no tiene columna de categoría en `catalog_items` ni en
    // `templates` (la v1 sí la tenía). Hasta que el Hito 2 la agregue, va vacía
    // y la tarjeta omite el eyebrow. Ver nota en shared/schemas.ts.
    category: '',
    images,
    price,
    compareAtPrice,
    // Placeholder deliberado, igual que en v1: el stock real se resuelve sumando
    // lotes por SKU contra las tablas de inventario (Hito 2). Con 1 el producto
    // se muestra comprable en vez de aparecer agotado por falta de dato.
    stock: 1,
    isPromo: item.is_promo,
    specs: normalizeSpecs(item.template?.specs),
    axesSummary: buildAxesSummary(item, axes),
    variantCount: countCombos(item, axes),
    templateId: item.template_id,
  };
}
