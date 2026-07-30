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

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], void>({
      query: () => 'invoices',
      providesTags: ['Invoice'],
    }),
    createInvoice: build.mutation<Invoice, CreateInvoiceInput>({
      query: (body) => ({ url: 'invoices', method: 'POST', body }),
      invalidatesTags: ['Invoice', 'Sale'],
    }),
  }),
});

export const { useGetInvoicesQuery, useCreateInvoiceMutation } = invoicesApi;
