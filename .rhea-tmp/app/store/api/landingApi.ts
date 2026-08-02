// Configuración del landing: slides del hero + orden de categorías del header.
// GET es público (lo necesita la home); PUT lo restringe el backend a admin.
import type { LandingConfig } from '@shared/schemas';
import { baseApi } from './baseApi';

export const landingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getLandingConfig: build.query<LandingConfig, void>({
      query: () => 'landing-config',
      providesTags: ['Landing'],
    }),
    updateLandingConfig: build.mutation<LandingConfig, LandingConfig>({
      query: (body) => ({ url: 'landing-config', method: 'PUT', body }),
      invalidatesTags: ['Landing'],
    }),
  }),
});

export const { useGetLandingConfigQuery, useUpdateLandingConfigMutation } = landingApi;
