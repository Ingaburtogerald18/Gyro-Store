// Formulario de contacto público → captura el lead en el CRM
// (server/services/crm.ts). Reciclado de v1 (useSendContactMutation vivía en
// ordersApi.ts porque solo mandaba un email); acá tiene su propio slice
// porque en v2 escribe en el dominio de contactos, no en pedidos.
import type { PublicContactInput } from '@shared/schemas';
import { baseApi } from './baseApi';

export const contactApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    sendContact: build.mutation<{ ok: boolean }, PublicContactInput>({
      query: (body) => ({ url: 'contact', method: 'POST', body }),
    }),
  }),
});

export const { useSendContactMutation } = contactApi;
