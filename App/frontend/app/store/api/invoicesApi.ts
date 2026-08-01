// Facturación (Hito 3 admin). Contrato exacto de server/routes/invoices.ts —
// modelo delgado: numera una venta ya aprobada, sin líneas/cliente propios
// (ver server/services/invoice.ts).
import { baseApi } from './baseApi';

export interface Invoice {
  id: string;
  saleId: string;
  invoiceNumber: number;
  status: string;
  method: string | null;
  deliveryFee: number;
  total: number;
  createdAt: string;
}

export interface CreateInvoiceInput {
  orderId: string;
  method: 'efectivo' | 'transferencia' | 'tarjeta';
  deliveryFee?: number;
}

export type InvoiceStatus = 'unlinked' | 'linked' | 'void';

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], { status?: InvoiceStatus } | void>({
      query: (args) => ({
        url: 'invoices',
        params: args && args.status ? { status: args.status } : undefined,
      }),
      providesTags: ['Invoice'],
    }),
    createInvoice: build.mutation<Invoice, CreateInvoiceInput>({
      query: (body) => ({ url: 'invoices', method: 'POST', body }),
      invalidatesTags: ['Invoice', 'Sale'],
    }),
    // Búsqueda por el número impreso en el papel, que es lo que el cliente trae
    // cuando vuelve al mostrador.
    lookupInvoice: build.query<Invoice, number>({
      query: (invoiceNumber) => ({ url: 'invoices/lookup', params: { number: invoiceNumber } }),
      providesTags: ['Invoice'],
    }),
    updateInvoice: build.mutation<
      Invoice,
      { id: string; data: { method?: CreateInvoiceInput['method']; deliveryFee?: number } }
    >({
      query: ({ id, data }) => ({ url: `invoices/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Invoice'],
    }),
    // Anular, no borrar: el correlativo conserva el número.
    voidInvoice: build.mutation<Invoice, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `invoices/${id}/void`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Invoice', 'Sale'],
    }),
  }),
});

export const {
  useGetInvoicesQuery,
  useCreateInvoiceMutation,
  useLookupInvoiceQuery,
  useLazyLookupInvoiceQuery,
  useUpdateInvoiceMutation,
  useVoidInvoiceMutation,
} = invoicesApi;
