import { baseApi } from './baseApi';
import type { AccountBalance } from '../../../../server/services/caja';
import type { FinancialKPIs } from '../../../../server/services/reports';

export interface CuadreDashboard {
  salidasPendientes: number;
  deliveriesPorLiquidar: number;
  saldosCuentas: AccountBalance[];
  kpisHoy: FinancialKPIs;
}

export const cuadreApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCuadre: builder.query<CuadreDashboard, void>({
      query: () => '/cuadre',
      providesTags: ['Cuadre'],
    }),
  }),
});

export const { useGetCuadreQuery } = cuadreApi;
