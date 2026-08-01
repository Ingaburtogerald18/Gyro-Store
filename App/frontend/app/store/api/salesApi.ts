// Ventas (Hito 3 admin). Contrato exacto de server/routes/sales.ts — no
// inventar campos: quote/register devuelven lo que el backend realmente
// manda (ver server/services/sales.ts para los shapes de QuoteResult/
// RegisteredSale/SaleListItem).
import { baseApi } from './baseApi';

export type SaleStatus = 'pending_approval' | 'approved' | 'paid' | 'rejected';

export interface SaleLineInput {
  productName: string;
  quantity: number;
  salePrice: number;
  applyWholesale?: boolean;
}

export interface SellableProduct {
  productName: string;
  price: number;
  stock: number;
}

// Los campos financieros son OPCIONALES porque el backend los recorta por rol:
// un vendedor no recibe costos ni ganancia de tienda (ver routes/sales.ts).
export interface QuoteLine {
  productName: string;
  quantity: number;
  precioUnit: number;
  /** Costo de UNA unidad. */
  costeFinalSnap?: number;
  /** Costo de todas las unidades. */
  costoTotal?: number;
  utilidadBruta?: number;
  salary?: number;
  utilidadNeta?: number;
  comision: number;
  /** Fracción (0.40 = 40%). Su tramo se busca por la utilidad neta UNITARIA. */
  comisionPercent: number;
  gananciaTienda?: number;

  // La misma cadena por unidad: el desglose muestra las dos columnas.
  utilidadBrutaUnit?: number;
  salaryUnit?: number;
  utilidadNetaUnit?: number;
  comisionUnit?: number;
  gananciaTiendaUnit?: number;

  wholesale: { discountPercent: number; warning: boolean };
  available: number;
  insufficientStock: boolean;
  belowMinMargin?: boolean;
}

export interface QuoteResult {
  lines: QuoteLine[];
  total: number;
  totalComision: number;
  totalGananciaTienda?: number;
}

export interface RegisterSaleInput {
  invoiceNumber?: number;
  customerName?: string;
  phone?: string;
  overrideSellerId?: string;
  overrideSellerName?: string;
  items: SaleLineInput[];
}

export interface RegisteredSale {
  id: string;
  status: string;
  total: number;
}

// Edición de una venta ya registrada (PUT /api/sales/:id, solo admin).
// `reason` es OBLIGATORIO cuando la venta ya salió de `pending_approval`:
// el backend lo rechaza sin él (server/services/sales.ts → updateSale).
export interface UpdateSaleInput {
  id: string;
  customerName?: string;
  phone?: string;
  overrideSellerId?: string;
  overrideSellerName?: string;
  items: SaleLineInput[];
  reason?: string;
}

/**
 * Una venta con sus líneas, que es lo que el editor necesita para precargar.
 * OJO: hoy NINGÚN endpoint la devuelve — `GET /api/sales` responde
 * `SaleListItem[]` sin `items` y no existe `GET /api/sales/:id`. El tipo vive
 * acá para que `SaleEditor` esté listo el día que el backend lo exponga.
 */
export interface SaleWithItems extends SaleListItem {
  items: SaleLineInput[];
}

export interface SaleListItem {
  id: string;
  status: SaleStatus;
  saleOrigin: string;
  sellerUid: string | null;
  sellerEmail: string;
  weekOf: string | null;
  customerName: string | null;
  phone: string | null;
  total: number;
  createdAt: string;
}

// ── Pago de comisiones ──
// Un lote de pago es inmutable: registra lo que se entregó. Si después se edita
// una venta ya pagada, la diferencia va a `balance` y se salda en el próximo
// corte (ver server/services/sellerPayments.ts).

export interface CommissionPayment {
  id: string;
  sellerEmail: string;
  sellerName: string;
  orderIds: string[];
  grossComision: number;
  /** Ajustes arrastrados de cortes anteriores. */
  saldoAplicado: number;
  totalComision: number;
  isSettlement: boolean;
  paymentMethod: string;
  receiptUrl: string | null;
  noReceiptComment: string | null;
  createdAt: string;
}

export interface SellerBalance {
  sellerEmail: string;
  sellerName: string;
  /** >0 la tienda le debe · <0 el vendedor debe devolver */
  balance: number;
  count: number;
}

export interface SellerSummary {
  pendingApproval: { count: number; comision: number };
  approvedUnpaid: { count: number; comision: number };
  paid: { count: number; comision: number };
  balance: number;
}

/** El comprobante se sube antes a `POST /api/upload`; acá viaja como URL. */
export interface PayoutProof {
  paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta';
  receiptUrl?: string;
  noReceiptComment?: string;
}

export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSellableProducts: build.query<SellableProduct[], void>({
      query: () => 'sales/products',
      providesTags: ['Product'],
    }),
    quoteSale: build.mutation<QuoteResult, SaleLineInput[]>({
      query: (items) => ({ url: 'sales/quote', method: 'POST', body: { items } }),
    }),
    registerSale: build.mutation<RegisteredSale, RegisterSaleInput>({
      query: (body) => ({ url: 'sales', method: 'POST', body }),
      invalidatesTags: ['Sale', 'Purchase', 'Product'],
    }),
    updateSale: build.mutation<RegisteredSale, UpdateSaleInput>({
      query: ({ id, ...body }) => ({ url: `sales/${id}`, method: 'PUT', body }),
      // Editar recalcula el snapshot y mueve reservas de stock.
      invalidatesTags: ['Sale', 'Purchase', 'Product', 'CommissionPayment'],
    }),
    approveSale: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `sales/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['Sale'],
    }),
    rejectSale: build.mutation<{ ok: boolean }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `sales/${id}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Sale', 'Purchase', 'Product'],
    }),
    getSales: build.query<SaleListItem[], { status?: string; sellerEmail?: string } | void>({
      query: (params) => ({ url: 'sales', params: params ?? undefined }),
      providesTags: ['Sale'],
    }),

    // ── Comisiones (admin) ──
    getCommissionPayments: build.query<CommissionPayment[], { sellerEmail?: string } | void>({
      query: (params) => ({ url: 'sales/payments', params: params ?? undefined }),
      providesTags: ['CommissionPayment'],
    }),
    getSellerBalances: build.query<SellerBalance[], void>({
      query: () => 'sales/balances',
      providesTags: ['CommissionPayment'],
    }),
    payCommissions: build.mutation<
      CommissionPayment,
      PayoutProof & { sellerEmail: string; orderIds: string[] }
    >({
      query: (body) => ({ url: 'sales/pay', method: 'POST', body }),
      // Pagar mueve las ventas a 'paid': el listado de ventas también cambia.
      invalidatesTags: ['CommissionPayment', 'Sale'],
    }),
    settleSellerBalance: build.mutation<CommissionPayment, PayoutProof & { sellerEmail: string }>({
      query: (body) => ({ url: 'sales/settle-balance', method: 'POST', body }),
      invalidatesTags: ['CommissionPayment'],
    }),

    // ── Portal del vendedor ──
    // Sin parámetros a propósito: el backend resuelve el vendedor desde el
    // token, así que nadie puede pedir el resumen de otro.
    getMySalesSummary: build.query<SellerSummary, void>({
      query: () => 'sales/my-summary',
      providesTags: ['CommissionPayment', 'Sale'],
    }),
    getMyCommissionPayments: build.query<CommissionPayment[], void>({
      query: () => 'sales/my-payments',
      providesTags: ['CommissionPayment'],
    }),
  }),
});

export const {
  useGetSellableProductsQuery,
  useQuoteSaleMutation,
  useRegisterSaleMutation,
  useUpdateSaleMutation,
  useApproveSaleMutation,
  useRejectSaleMutation,
  useGetSalesQuery,
  useGetCommissionPaymentsQuery,
  useGetSellerBalancesQuery,
  usePayCommissionsMutation,
  useSettleSellerBalanceMutation,
  useGetMySalesSummaryQuery,
  useGetMyCommissionPaymentsQuery,
} = salesApi;
