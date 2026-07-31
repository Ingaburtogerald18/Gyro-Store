import { baseApi } from './baseApi';
import type { Salida, RegisterSalidaInput, LiquidarSalidaInput } from '../../../../shared/schemas';

export const salidasApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalidas: builder.query<Salida[], { estado?: string; liquidacion?: string; startDate?: string; endDate?: string } | void>({
      query: (params) => {
        let url = '/salidas';
        if (params) {
          const qs = new URLSearchParams();
          if (params.estado) qs.append('estado', params.estado);
          if (params.liquidacion) qs.append('liquidacion', params.liquidacion);
          if (params.startDate) qs.append('startDate', params.startDate);
          if (params.endDate) qs.append('endDate', params.endDate);
          const q = qs.toString();
          if (q) url += `?${q}`;
        }
        return url;
      },
      providesTags: ['Salidas'],
    }),

    registerSalida: builder.mutation<Salida, RegisterSalidaInput>({
      query: (body) => ({
        url: '/salidas',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Salidas', 'Cuadre'],
    }),

    liquidarSalida: builder.mutation<Salida, { id: string; data: LiquidarSalidaInput }>({
      query: ({ id, data }) => ({
        url: `/salidas/${id}/liquidar`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Salidas', 'Cuadre', 'Accounts', 'Movements'],
    }),

    vincularSalida: builder.mutation<Salida, { id: string; orderId: string }>({
      query: ({ id, orderId }) => ({
        url: `/salidas/${id}/vincular`,
        method: 'PATCH',
        body: { orderId },
      }),
      invalidatesTags: ['Salidas', 'Cuadre'],
    }),

    devolverSalida: builder.mutation<Salida, string>({
      query: (id) => ({
        url: `/salidas/${id}/devolver`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Salidas', 'Cuadre'],
    }),
  }),
});

export const {
  useGetSalidasQuery,
  useRegisterSalidaMutation,
  useLiquidarSalidaMutation,
  useVincularSalidaMutation,
  useDevolverSalidaMutation,
} = salidasApi;
