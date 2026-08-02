import { baseApi } from './baseApi';
import { sessionResolved, signedOut } from '../slices/authSlice';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<{ user: any }, void>({
      query: () => '/auth/me',
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.user) {
            dispatch(sessionResolved(data.user));
          } else {
            dispatch(signedOut());
          }
        } catch {
          dispatch(signedOut());
        }
      },
    }),
  }),
});

export const { useGetMeQuery, useLazyGetMeQuery } = authApi;
