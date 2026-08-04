// Dominio de arranque de sesión + config pública del negocio. Agrupa authApi
// (quién soy) y configApi (constantes de negocio) — dos slices diminutos que
// casi todas las pantallas consultan al montar. Un solo injectEndpoints sobre
// baseApi; mismos hooks, tags y tipos que antes.
import { baseApi } from './baseApi';
import { sessionResolved, signedOut } from '../slices/authSlice';

// La configuración del negocio (tasa de cambio, pozos, escalas, logos) cambia
// una vez cada varios días y la consultan casi todas las pantallas. 5 minutos.
const CONFIG_CACHE_SECONDS = 300;

export interface StoreCategory {
  id: string;
  name: string;
  icon: string;
}

export interface StoreConfig {
  // Nombre de la marca / tienda (ej. 'Gyro Store').
  brandName: string;
  // Correo de contacto del negocio.
  contactEmail: string;
  // Número RUC (fiscal) del negocio.
  ruc?: string;
  // Dirección física del negocio.
  address?: string;
  // Dominio interno del staff (ej. 'gyrostorenic.com'), para validar correos.
  internalDomain: string;
  // URL pública de la app (para QR, tickets, links).
  appUrl: string;
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

export const sessionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Sesión actual. Al resolver, sincroniza el authSlice.
    getMe: builder.query<{ user: any }, void>({
      query: () => '/auth/me',
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.user) {
            dispatch(sessionResolved(data.user));
          } else {
            dispatch(signedOut());
          }
        } catch {
          dispatch(signedOut());
        }
      },
    }),

    // /api/config (doc 09 ítems 25-26): constantes de negocio públicas. El
    // shape espeja PublicConfig de server/services/config.ts.
    getConfig: builder.query<StoreConfig, void>({
      query: () => 'config',
      providesTags: ['Config'],
      keepUnusedDataFor: CONFIG_CACHE_SECONDS,
    }),
  }),
});

export const { useGetMeQuery, useLazyGetMeQuery, useGetConfigQuery } = sessionApi;

// Alias de compatibilidad: algún call-site usa `configApi.util.invalidateTags`.
// Todas las apis inyectadas comparten el mismo baseApi subyacente, así que el
// objeto merged sirve igual.
export const configApi = sessionApi;
