// Ventas (Hito 3 admin). Contrato exacto de server/routes/sales.ts — no
// inventar campos: quote/register devuelven lo que el backend realmente
// manda (ver server/services/sales.ts para los shapes de QuoteResult/
// RegisteredSale/SaleListItem).
import { baseApi } from './baseApi';

export type SaleStatus = 'pending_approval' | 'approved' | 'paid' | 'rejected';

export interface SaleLineInput {
  productName: string;
  quantity: number;
  salePrice: number;
  applyWholesale?: boolean;
}

export interface SellableProduct {
  productName: string;
  price: number;
  stock: number;
}

export interface QuoteLine {
  productName: string;
  quantity: number;
  precioUnit: number;
  costeFinalSnap: number;
  utilidadBruta: number;
  salary: number;
  utilidadNeta: number;
  comision: number;
  comisionPercent: number;
  gananciaTienda: number;
  wholesale: { discountPercent: number; warning: boolean };
  available: number;
  insufficientStock: boolean;
}

export interface QuoteResult {
  lines: QuoteLine[];
  total: number;
  totalComision: number;
  totalGananciaTienda: number;
}

export interface RegisterSaleInput {
  phone?: string;
  items: SaleLineInput[];
}

export interface RegisteredSale {
  id: string;
  status: string;
  total: number;
}

export interface SaleListItem {
  id: string;
  status: SaleStatus;
  saleOrigin: string;
  sellerUid: string | null;
  sellerEmail: string;
  weekOf: string | null;
  phone: string | null;
  total: number;
  createdAt: string;
}

export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSellableProducts: build.query<SellableProduct[], void>({
      query: () => 'sales/products',
      providesTags: ['Product'],
    }),
    quoteSale: build.mutation<QuoteResult, SaleLineInput[]>({
      query: (items) => ({ url: 'sales/quote', method: 'POST', body: { items } }),
    }),
    registerSale: build.mutation<RegisteredSale, RegisterSaleInput>({
      query: (body) => ({ url: 'sales', method: 'POST', body }),
      invalidatesTags: ['Sale', 'Purchase', 'Product'],
    }),
    approveSale: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `sales/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['Sale'],
    }),
    rejectSale: build.mutation<{ ok: boolean }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `sales/${id}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Sale', 'Purchase', 'Product'],
    }),
    getSales: build.query<SaleListItem[], { status?: string; sellerEmail?: string } | void>({
      query: (params) => ({ url: 'sales', params: params ?? undefined }),
      providesTags: ['Sale'],
    }),
  }),
});

export const {
  useGetSellableProductsQuery,
  useQuoteSaleMutation,
  useRegisterSaleMutation,
  useApproveSaleMutation,
  useRejectSaleMutation,
  useGetSalesQuery,
} = salesApi;
