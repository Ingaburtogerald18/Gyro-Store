import { baseApi } from './baseApi';

export interface Invoice {
  id: string;
  saleId: string | null;
  /** Correlativo numérico interno (orden y unicidad). */
  invoiceNumber: number;
  /** Código legible que se imprime y que el vendedor tipea: `GS-PR-12`. */
  invoiceCode: string;
  /** Solo viene del lookup: el editor de ventas se precarga con esto. */
  items?: { productName: string; quantity: number; unitPrice: number; lineTotal: number }[];
  status: string;
  method: string | null;
  deliveryFee: number;
  total: number;
  createdAt: string;
  customerName?: string | null;
  phone?: string | null;
  subtotal?: number;
  discount?: number;
  deliveryName?: string | null;
}

export interface InvoiceItemInput {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  customerName?: string;
  phone?: string;
  method: 'efectivo' | 'transferencia' | 'tarjeta';
  deliveryFee?: number;
  deliveryName?: string;
  discount?: number;
  /** Código de descuento opcional; el servidor lo canjea al crear la factura. */
  discountCode?: string;
  items: InvoiceItemInput[];
}

export type InvoiceStatus = 'unlinked' | 'linked' | 'void';

export interface TicketData {
  ticketNumber: number;
  createdAt: string;
  customer: {
    name: string;
    phone?: string;
  };
  sellerName?: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  deliveryName?: string;
  total: number;
  method: string;
}

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], { status?: InvoiceStatus } | void>({
      query: (args) => ({
        url: 'invoices',
        params: args && args.status ? { status: args.status } : undefined,
      }),
      providesTags: ['Invoice'],
    }),
    getInvoiceTicket: build.query<TicketData, string>({
      query: (id) => `invoices/${encodeURIComponent(id)}/ticket`,
      providesTags: ['Invoice'],
    }),
    createInvoice: build.mutation<Invoice, CreateInvoiceInput>({
      query: (body) => ({ url: 'invoices', method: 'POST', body }),
      invalidatesTags: ['Invoice', 'Sale', 'DiscountCode'],
    }),
    // Búsqueda por el código impreso en el papel (`GS-PR-12`), que es lo que el
    // cliente trae cuando vuelve al mostrador.
    lookupInvoice: build.query<Invoice, string | number>({
      // Acepta el código impreso (`GS-PR-12`) o el número pelado.
      query: (invoiceNumber: string | number) => ({ url: 'invoices/lookup', params: { number: invoiceNumber } }),
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
  useGetInvoiceTicketQuery,
  useCreateInvoiceMutation,
  useLookupInvoiceQuery,
  useLazyLookupInvoiceQuery,
  useUpdateInvoiceMutation,
  useVoidInvoiceMutation,
} = invoicesApi;
