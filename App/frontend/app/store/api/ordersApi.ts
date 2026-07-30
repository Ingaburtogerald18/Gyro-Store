// Pedidos públicos del storefront (checkout por WhatsApp). No requiere auth:
// el comprador es anónimo. El backend recalcula el total y arma el mensaje.
import type { PublicOrderInput } from '@shared/schemas';
import { baseApi } from './baseApi';

export interface CreatedPublicOrder {
  id: string;
  phone: string;
  total: number;
  status: string;
  items: Array<{ catalogItemId: string; quantity: number; unitPrice: number }>;
  /** Link a WhatsApp con el pedido ya formateado, listo para abrir. */
  whatsappUrl: string;
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createPublicOrder: build.mutation<CreatedPublicOrder, PublicOrderInput>({
      query: (body) => ({ url: 'orders/public', method: 'POST', body }),
      transformResponse: (response: { order: CreatedPublicOrder }) => response.order,
      invalidatesTags: ['Orders'],
    }),
  }),
});

export const { useCreatePublicOrderMutation } = ordersApi;
