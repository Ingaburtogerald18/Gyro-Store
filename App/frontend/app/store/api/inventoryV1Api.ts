// API del portal de inventario (admin). Invalida las tags Purchase/Product/Catalog
// para refrescar la UI al aprobar recepciones.
import { baseApi } from "./baseApi";

export type PurchaseStatus = "china" | "received";

export interface Purchase {
  id: string;
  lot: string;
  code: string;
  productName: string;
  category: string | null;
  purchaseDate: string;
  arrivalDate: string | null;
  quantity: number;
  costUnit: number;
  taxUnit: number;
  shippingUnit: number;
  priceUnit: number;
  total: number;
  quantitySold: number;
  quantityReserved: number;
  suggestedPrice: number | null;
  status: PurchaseStatus;
}

export interface InventoryRow {
  id: string;
  code: string;
  productName: string;
  category: string | null;
  lot?: string;
  quantityOriginal?: number;
  quantitySold?: number;
  quantityReserved?: number;
  available: number;
  priceUnitUsd?: number;
  shippingUnitUsd?: number;
  priceUnitFinalUsd?: number;
  costRealCordobas?: number;
  costoFijoCordobas?: number;
  preTotalUsd?: number;
  totalFinalUsd?: number;
  suggestedPrice?: number | null;
  gananciaUnitCordobas?: number;
}

export interface InventoryKpis {
  totalPurchases: number;
  inTransit: number;
  received: number;
  subtotalInvertidoUsd: number;
  totalImpuestosUsd: number;
  totalInversionConImpuestosUsd: number;
  totalEnviosUsd: number;
}

export interface NewPurchase {
  purchaseDate: string;
  lot: string;
  code: string;
  productName: string;
  quantity: number;
  costUnit: number;
  taxUnit: number;
  suggestedPrice?: number;
}

// Inventario migrado: ítem histórico cargado a mano (colección aparte).
// Los campos calculados (stock, totales, coste real, sugerido) los devuelve el server.
export interface MigratedItem {
  id: string;
  origin: "migrated";
  status: string;
  lot: string;
  code: string;
  productName: string;
  purchaseDate: string;
  quantity: number; // compradas
  quantitySold: number; // salidas (ventas)
  quantityReserved: number;
  stock: number; // compradas − salidas
  costUnit: number; // precio base USD
  shippingUnit: number; // costo de envío unitario USD
  priceBaseUsd: number;
  shippingUnitUsd: number;
  priceUnitFinalUsd: number; // base + envío
  preTotalUsd: number; // base × compradas
  totalUsd: number; // compradas × (base + envío)
  costRealUnitCordobas: number; // (base + envío) × 37
  suggestedPrice: number; // coste real × 1.40
  comments: string;
}

export interface NewMigratedItem {
  purchaseDate: string;
  lot?: string;
  code: string;
  productName: string;
  quantity: number;
  costUnit: number;
  shippingUnit: number;
  comments?: string;
}

export interface ArrivalPayload {
  arrivalDate: string;
  shippingUnit: number;
  category: string;
  suggestedPrice?: number;
}

// Añade ?period=YYYY-MM al endpoint cuando hay un mes seleccionado.
// "all" o vacío = sin filtro (historial completo). El backend leerá este
// parámetro cuando implementemos el filtrado por fecha en la base de datos.
const withPeriod = (base: string, period?: string) =>
  period && period !== "all" ? `${base}?period=${encodeURIComponent(period)}` : base;

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPurchases: build.query<Purchase[], string | void>({
      query: (period) => withPeriod("/inventory/purchases", period || undefined),
      providesTags: ["Purchase"],
    }),
    getCurrentInventory: build.query<InventoryRow[], string | void>({
      query: (period) => withPeriod("/inventory/current", period || undefined),
      providesTags: ["Product"],
    }),
    getAvailableInventory: build.query<InventoryRow[], void>({
      query: () => "/inventory/available",
      providesTags: ["Product"],
    }),
    getIncomingInventory: build.query<any[], void>({
      query: () => "/inventory/incoming",
      providesTags: ["Purchase"],
    }),
    getInventoryKpis: build.query<InventoryKpis, string | void>({
      query: (period) => withPeriod("/inventory/kpis", period || undefined),
      providesTags: ["Purchase"],
    }),
    createPurchase: build.mutation<Purchase, NewPurchase>({
      query: (body) => ({ url: "/inventory/purchases", method: "POST", body }),
      invalidatesTags: ["Purchase"],
    }),
    reportArrival: build.mutation<{ ok: boolean }, { id: string; body: ArrivalPayload }>({
      query: ({ id, body }) => ({ url: `/inventory/purchases/${id}/arrival`, method: "PATCH", body }),
      invalidatesTags: ["Purchase", "Product", "Catalog"],
    }),
    updatePurchase: build.mutation<{ ok: boolean }, { id: string; body: Partial<Purchase> }>({
      query: ({ id, body }) => ({ url: `/inventory/purchases/${id}`, method: "PUT", body }),
      invalidatesTags: ["Purchase", "Product", "Catalog"],
    }),
    revertPurchase: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/inventory/purchases/${id}/revert`, method: "PATCH" }),
      invalidatesTags: ["Purchase", "Product", "Catalog"],
    }),
    deletePurchase: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/inventory/purchases/${id}`, method: "DELETE" }),
      invalidatesTags: ["Purchase"],
    }),
    getMigratedInventory: build.query<MigratedItem[], string | void>({
      query: (period) => withPeriod("/inventory/migrated", period || undefined),
      providesTags: ["Migrated"],
    }),
    createMigratedItem: build.mutation<MigratedItem, NewMigratedItem>({
      query: (body) => ({ url: "/inventory/migrated", method: "POST", body }),
      // También "Product": /sales/products (cotizador) incluye el inventario migrado,
      // así el nuevo código aparece al instante sin tener que recargar la página.
      invalidatesTags: ["Migrated", "Product"],
    }),
    updateMigratedItem: build.mutation<MigratedItem, { id: string; body: NewMigratedItem }>({
      query: ({ id, body }) => ({ url: `/inventory/migrated/${id}`, method: "PUT", body }),
      invalidatesTags: ["Migrated", "Product"],
    }),
    deleteMigratedItem: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/inventory/migrated/${id}`, method: "DELETE" }),
      // "Product" para que el ítem borrado desaparezca también del cotizador de ventas.
      invalidatesTags: ["Migrated", "Product"],
    }),
  }),
});

export const {
  useGetPurchasesQuery,
  useGetCurrentInventoryQuery,
  useGetAvailableInventoryQuery,
  useGetIncomingInventoryQuery,
  useGetInventoryKpisQuery,
  useCreatePurchaseMutation,
  useReportArrivalMutation,
  useUpdatePurchaseMutation,
  useRevertPurchaseMutation,
  useDeletePurchaseMutation,
  useGetMigratedInventoryQuery,
  useCreateMigratedItemMutation,
  useUpdateMigratedItemMutation,
  useDeleteMigratedItemMutation,
} = inventoryApi;

