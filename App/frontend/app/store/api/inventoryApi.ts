import { baseApi } from './baseApi';

export interface InventoryItem {
  id: string;
  catalogItemId: string;
  name: string;
  stock: number;
  cost: number;
  lastUpdated: string;
}

export interface PurchaseInput {
  catalogItemId: string;
  quantity: number;
  unitCost: number;
  supplier?: string;
  notes?: string;
}

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInventory: builder.query<InventoryItem[], void>({
      query: () => '/inventory',
      providesTags: ['Catalog'],
    }),
    registerPurchase: builder.mutation<void, PurchaseInput>({
      query: (body) => ({
        url: '/inventory/purchase',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Catalog'],
    }),
  }),
});

export const { useGetInventoryQuery, useRegisterPurchaseMutation } = inventoryApi;
