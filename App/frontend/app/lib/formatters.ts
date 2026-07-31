/** Formatea un monto en córdobas: 1710 → "C$1,710". */
export function formatCordobas(amount: number, symbol = 'C$'): string {
  return `${symbol}${Math.round(amount).toLocaleString('es-NI')}`;
}

// El número puede venir en formato humano ("+505 8594 4758") desde Configuración:
// se limpia acá para que todos los que llaman queden protegidos sin tocar cada sitio.
export function buildWhatsappUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** "Audífonos KZ EDX Pro" → "audifonos-kz-edx-pro" */
export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// URL del detalle: slug legible + id al final para que la ruta lo resuelva sin
// depender del nombre (que puede cambiar).
function detailUrl(base: string, id: string, name: string): string {
  const slug = createSlug(name);
  return `/${base}/${slug ? `${slug}--${id}` : id}`;
}
export const getProductUrl = (id: string, name: string) => detailUrl('producto', id, name);
export const getComboUrl = (id: string, name: string) => detailUrl('combo', id, name);

export const EXCHANGE_RATE = 36.6241;

// Mensaje de error de una respuesta RTK Query fallida (`{ data: { error } }`),
// con fallback si no vino en ese shape.
export function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return fallback;
}

// `items` que todavía no aparecen en `linkedIds` (ej. ventas aprobadas sin
// factura/plan de cuotas todavía) — un solo id "ya vinculado" por item.
export function withoutIds<T, K>(items: T[], linkedIds: K[], getId: (item: T) => K): T[] {
  const linked = new Set(linkedIds);
  return items.filter((item) => !linked.has(getId(item)));
}

export function formatUsd(amount: number, maxDecimals: number = 2, minDecimals: number = 2): string {
  const max = Math.max(2, maxDecimals);
  return '$' + amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(Math.max(2, minDecimals), max),
    maximumFractionDigits: max
  });
}

export function cordobasFromUsd(usd: number): string {
  return formatCordobas((usd || 0) * EXCHANGE_RATE);
}
