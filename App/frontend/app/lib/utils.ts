// Helpers compartidos del frontend. `cn` es el estándar de shadcn/ui (combina
// clases condicionales y resuelve conflictos de utilidades Tailwind); el resto
// viene portado de la v1 para que los componentes del storefront se reciclen.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// URL del detalle: slug legible + id al final para que la ruta lo resuelva sin
// depender del nombre (que puede cambiar).
export function getProductUrl(id: string, name: string): string {
  const slug = createSlug(name);
  return slug ? `/producto/${slug}--${id}` : `/producto/${id}`;
}
export const EXCHANGE_RATE = 36.6241;

export function formatUsd(amount: number, maxDecimals: number = 2, minDecimals: number = 2): string {
  const max = Math.max(2, maxDecimals);
  return $ + amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(Math.max(2, minDecimals), max),
    maximumFractionDigits: max
  });
}

export function cordobasFromUsd(usd: number): string {
  return formatCordobas((usd || 0) * EXCHANGE_RATE);
}
