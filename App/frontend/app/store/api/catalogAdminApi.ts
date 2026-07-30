import { baseApi } from './baseApi';
import type { AdminProduct, AdminProductInput } from '../../../../shared/schemas';

export const catalogAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminCatalog: builder.query<AdminProduct[], void>({
      query: () => '/admin/catalog',
      transformResponse: (response: { items: AdminProduct[] }) => response.items,
      providesTags: ['AdminCatalog'],
    }),
    getAdminProduct: builder.query<AdminProduct, string>({
      query: (id) => `/admin/catalog/${id}`,
      providesTags: (result, error, id) => [{ type: 'AdminCatalog', id }],
    }),
    createAdminProduct: builder.mutation<AdminProduct, AdminProductInput>({
      query: (body) => ({
        url: '/admin/catalog',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminCatalog', 'Catalog'],
    }),
    updateAdminProduct: builder.mutation<AdminProduct, { id: string; data: Partial<AdminProductInput> }>({
      query: ({ id, data }) => ({
        url: `/admin/catalog/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'AdminCatalog', id },
        'AdminCatalog',
        'Catalog',
      ],
    }),
    deleteAdminProduct: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/catalog/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminCatalog', 'Catalog'],
    }),
    reorderAdminCatalog: builder.mutation<void, { items: { id: string; sortOrder: number }[] }>({
      query: (body) => ({
        url: '/admin/catalog/reorder',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminCatalog', 'Catalog'],
    }),
  }),
});

export const {
  useGetAdminCatalogQuery,
  useGetAdminProductQuery,
  useCreateAdminProductMutation,
  useUpdateAdminProductMutation,
  useDeleteAdminProductMutation,
  useReorderAdminCatalogMutation,
} = catalogAdminApi;
