// Slice del catálogo público (doc 09 ítem 42). Los tipos vienen del contrato
// único compartido: el backend valida la fila contra `publicCatalogItemSchema`
// y la presenta como `CatalogProduct` (plano, camelCase) antes de responder.
import type { CatalogDetail, CatalogProduct, Combo } from '@shared/schemas';
import { baseApi } from './baseApi';

// GET /api/catalog y /api/combos responden { items: [...] }.
interface ItemsResponse<T> {
  items: T[];
}

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCatalog: build.query<CatalogProduct[], void>({
      query: () => 'catalog',
      transformResponse: (response: ItemsResponse<CatalogProduct>) => response.items,
      providesTags: ['Catalog'],
    }),
    // Detalle con ejes de variante resueltos. La ficha lo carga por SSR
    // (loader de producto.$id.tsx); este hook es para el QuickAddSheet, que
    // necesita los ejes desde la tarjeta sin navegar.
    getCatalogDetail: build.query<CatalogDetail, string>({
      query: (id) => `catalog/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Catalog' as const, id }],
    }),
    getCombos: build.query<Combo[], void>({
      query: () => 'combos',
      transformResponse: (response: ItemsResponse<Combo>) => response.items,
      providesTags: ['Combos'],
    }),
  }),
});

export const { useGetCatalogQuery, useGetCatalogDetailQuery, useGetCombosQuery } = catalogApi;
