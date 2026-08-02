// Base de RTK Query (doc 09 ítem 39). Todos los API slices por dominio
// (catalogApi, ordersApi, salesApi, …) se cuelgan de acá con injectEndpoints,
// así hay UNA sola instancia de createApi y un solo reducer/middleware.
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getAccessToken } from '~/lib/supabase.client';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    // En dev, Vite proxya /api → Express :3000; en prod es el mismo origen
    // (monolito híbrido, doc 02): la URL relativa sirve en ambos casos.
    baseUrl: '/api',
    prepareHeaders: async (headers) => {
      // Sesión de Supabase Auth → Bearer JWT. Sin sesión (visitante anónimo o
      // SSR) el request sale sin Authorization y el backend decide qué es público.
      const token = await getAccessToken();
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  // Tags de invalidación disponibles para los slices del Hito 1; los dominios
  // posteriores (sales, inventory, crm, …) agregan los suyos con addTagTypes.
  // 'Purchase'/'Product' faltaban acá pese a que inventoryV1Api.ts
  // (Hito 2) ya los usaba — typecheck del frontend nunca se había corrido.
  tagTypes: [
    'Config',
    'Landing',
    'Catalog',
    'AdminCatalog',
    'Combos',
    'Orders',
    'Me',
    'Purchase',
    'Product',
    'Sale',
    'CommissionPayment',
    'Invoice',
    'Installment',
    'Categories',
    'Templates',
    'Accounts',
    'Movements',
    'Cuadre',
    'DiscountCode',
  ],
  endpoints: () => ({}),
});
