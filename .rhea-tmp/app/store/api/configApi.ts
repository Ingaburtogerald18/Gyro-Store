// Slice de /api/config (doc 09 ítems 25-26): constantes de negocio públicas.
// El shape espeja PublicConfig de server/services/config.ts — si el backend
// agrega un campo público, se refleja acá.
import { baseApi } from './baseApi';

// La configuración del negocio (tasa de cambio, pozos, escalas, logos) cambia
// una vez cada varios días y la consultan casi todas las pantallas. 5 minutos.
const CONFIG_CACHE_SECONDS = 300;

export interface StoreCategory {
  id: string;
  name: string;
  icon: string;
}

export interface StoreConfig {
  // Símbolo de la moneda local, ej. 'C$' (córdoba).
  currency: string;
  // Tasa USD → córdoba vigente.
  exchangeRate: number;
  // Número de WhatsApp del negocio (para wa.me/...).
  whatsapp: string;
  categories: StoreCategory[];
  images?: {
    logoStatic?: string;
    logoAnimated?: string;
    favicon?: string;
    posLogo?: string;
  };
}

export const configApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getConfig: build.query<StoreConfig, void>({
      query: () => 'config',
      providesTags: ['Config'],
      keepUnusedDataFor: CONFIG_CACHE_SECONDS,
    }),
  }),
});

export const { useGetConfigQuery } = configApi;
