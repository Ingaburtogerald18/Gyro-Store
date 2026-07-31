import { baseApi } from './baseApi';

export interface FinancialKPIs {
  total_ventas: number;
  total_unidades: number;
  total_vendido: number;
  coste_total: number;
  comision_total: number;
  ganancia_tienda_total: number;
  salary_acumulado: number;
  pozos_recogidos: Record<string, number>;
}

export interface KpiParams {
  startDate?: string;
  endDate?: string;
  sellerUid?: string;
}

export interface ExpensePozoItem {
  pozo: string;
  total_gastado: number;
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getKpis: build.query<FinancialKPIs, KpiParams | void>({
      query: (params) => ({ url: 'reports/kpis', params: params ?? undefined }),
      providesTags: ['Sale', 'Purchase', 'Product'],
    }),
    getLosses: build.query<any, void>({
      query: () => 'reports/losses',
    }),
    getSalesExport: build.query<any, KpiParams | void>({
      query: (params) => ({ url: 'reports/sales-export', params: params ?? undefined }),
    }),
    getExpensesByPozo: build.query<ExpensePozoItem[], KpiParams | void>({
      query: (params) => ({ url: 'reports/expenses', params: params ?? undefined }),
      providesTags: ['Sale'],
    }),
  }),
});

export const {
  useGetKpisQuery,
  useGetLossesQuery,
  useGetSalesExportQuery,
  useGetExpensesByPozoQuery,
} = reportsApi;
