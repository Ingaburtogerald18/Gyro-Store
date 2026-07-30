// Catálogo desde el panel. Requiere sesión: baseApi inyecta el Bearer del JWT
// de Supabase y el backend exige rol admin o seller.
import type { AdminProduct, AdminProductInput } from '@shared/schemas';
import { baseApi } from './baseApi';

export const adminCatalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminCatalog: build.query<AdminProduct[], void>({
      query: () => 'admin/catalog',
      transformResponse: (response: { items: AdminProduct[] }) => response.items,
      providesTags: ['AdminCatalog'],
    }),
    createAdminProduct: build.mutation<AdminProduct, AdminProductInput>({
      query: (body) => ({ url: 'admin/catalog', method: 'POST', body }),
      // El catálogo público también cambia: se invalidan los dos.
      invalidatesTags: ['AdminCatalog', 'Catalog'],
    }),
    updateAdminProduct: build.mutation<AdminProduct, { id: string; body: AdminProductInput }>({
      query: ({ id, body }) => ({ url: `admin/catalog/${id}`, method: 'PUT', body }),
      invalidatesTags: ['AdminCatalog', 'Catalog'],
    }),
    archiveAdminProduct: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `admin/catalog/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminCatalog', 'Catalog'],
    }),
  }),
});

export const {
  useGetAdminCatalogQuery,
  useCreateAdminProductMutation,
  useUpdateAdminProductMutation,
  useArchiveAdminProductMutation,
} = adminCatalogApi;
