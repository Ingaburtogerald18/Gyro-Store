import { baseApi } from './baseApi';
import type { Account, AccountMovement, RegisterMovementInput } from '../../../../shared/schemas';

export const cajaApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query<Account[], void>({
      query: () => '/caja/accounts',
      providesTags: ['Accounts'],
    }),

    createAccount: builder.mutation<Account, { nombre: string; tipo: 'banco' | 'efectivo'; moneda?: string }>({
      query: (body) => ({
        url: '/caja/accounts',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Accounts', 'Cuadre'],
    }),

    toggleAccountStatus: builder.mutation<Account, { id: string; activo: boolean }>({
      query: ({ id, activo }) => ({
        url: `/caja/accounts/${id}/toggle`,
        method: 'PATCH',
        body: { activo },
      }),
      invalidatesTags: ['Accounts', 'Cuadre'],
    }),

    getMovements: builder.query<AccountMovement[], { accountId?: string; startDate?: string; endDate?: string } | void>({
      query: (params) => {
        let url = '/caja/movimientos';
        if (params) {
          const qs = new URLSearchParams();
          if (params.accountId) qs.append('accountId', params.accountId);
          if (params.startDate) qs.append('startDate', params.startDate);
          if (params.endDate) qs.append('endDate', params.endDate);
          const q = qs.toString();
          if (q) url += `?${q}`;
        }
        return url;
      },
      providesTags: ['Movements'],
    }),

    registerMovement: builder.mutation<AccountMovement, RegisterMovementInput>({
      query: (body) => ({
        url: '/caja/movimientos',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Movements', 'Cuadre', 'Accounts'],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useCreateAccountMutation,
  useToggleAccountStatusMutation,
  useGetMovementsQuery,
  useRegisterMovementMutation,
} = cajaApi;
