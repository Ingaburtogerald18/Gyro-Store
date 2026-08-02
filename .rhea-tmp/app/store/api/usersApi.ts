import { baseApi } from './baseApi';
import type { BankAccount } from '@shared/schemas';

export type { BankAccount };

export type AppRole = 'global_admin' | 'admin' | 'seller' | 'cashier' | 'logistics_admin' | 'logistics_customer';

// Shape de `GET /api/admin/users` (requireAdmin, `select('*')` sobre `profiles`).
// Los campos nullable lo son de verdad: la columna existe pero puede estar vacía.
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  roles: AppRole[];
  status: string;
  deleted_at: string | null;
  created_at: string;
  avatar_url?: string | null;

  // ── Contacto y pago (migración 0006) ──
  // `bank_account` es dato sensible: solo viaja por endpoints `requireAdmin`.
  phone?: string | null;
  personal_email?: string | null;
  /** Objeto jsonb `{ bank, currency, number }`, o null si no cargó cuenta. */
  bank_account?: BankAccount | null;

  /** Última conexión. La escribe `middleware/auth.ts` con throttle de 15 min. */
  last_login?: string | null;

  /**
   * Lo calcula el backend contra `config.protectedEmail`. Solo sirve para
   * ocultar acciones en el UI; la denegación real vive en `routes/adminUsers.ts`.
   */
  isProtected?: boolean;
}

export interface UserPerformance {
  pendingApproval: { count: number; comision: number };
  approvedUnpaid: { count: number; comision: number };
  paid: { count: number; comision: number };
  balance: number;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<UserProfile[], void>({
      query: () => '/admin/users',
      providesTags: ['Config'], // Reuse Config tag for now, or we can add 'Users' later
    }),
    getUserPerformance: builder.query<UserPerformance, string>({
      query: (id) => `/admin/users/${encodeURIComponent(id)}/performance`,
    }),
    updateUserRoles: builder.mutation<UserProfile, { email: string; roles: AppRole[] }>({
      query: ({ email, roles }) => ({
        url: `/admin/users/${encodeURIComponent(email)}/roles`,
        method: 'PATCH',
        body: { roles },
      }),
      invalidatesTags: ['Config'],
    }),
    createUser: builder.mutation<UserProfile, { email: string; name: string; roles: AppRole[] }>({
      query: (body) => ({
        url: '/admin/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Config'],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/users/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Config'],
    }),
    suspendUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/users/${encodeURIComponent(id)}/suspend`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Config'],
    }),
    restoreUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/users/${encodeURIComponent(id)}/restore`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Config'],
    }),
    // El backend valida con `updateProfileSchema` (App/shared/schemas.ts).
    // Un string vacío significa "borrar el dato" y se guarda como NULL; omitir
    // la clave deja el valor como está.
    updateUserProfile: builder.mutation<
      { message: string; data: UserProfile[] },
      {
        id: string;
        name: string;
        phone?: string;
        personal_email?: string;
        /** `null` limpia la cuenta guardada. */
        bank_account?: BankAccount | null;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/users/${encodeURIComponent(id)}/profile`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Config'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserPerformanceQuery,
  useUpdateUserRolesMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useSuspendUserMutation,
  useRestoreUserMutation,
  useUpdateUserProfileMutation,
} = usersApi;
