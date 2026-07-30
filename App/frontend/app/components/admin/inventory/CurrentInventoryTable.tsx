// Inventario Actual: productos recibidos en bodega con todas las columnas
// calculadas (cantidad = original − vendidos, precios USD y costo real en C$).
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Pencil, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DataTable } from "~/components/ui/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { RowActionsMenu } from "~/components/ui/RowActionsMenu";
import { EditArrivalModal } from "./EditArrivalModal";
import {
  useGetCurrentInventoryQuery,
  useRevertPurchaseMutation,
  useGetPurchasesQuery,
  type InventoryRow,
  type Purchase,
} from "~/store/api/inventoryV1Api";
import { useGetAdminCatalogQuery } from "~/store/api/catalogAdminApi";
import { formatUsd, formatCordobas } from "~/lib/utils";
import { CodeCell } from "~/components/ui/cells";
import { useNavigate } from "@remix-run/react";

export function CurrentInventoryTable({ period = "all" }: { period?: string }) {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useGetCurrentInventoryQuery(period);
  // Las compras se traen sin filtro de periodo: se usan para resolver el lote
  // detrás de una fila al editar, y ese lote puede ser de cualquier mes.
  const { data: purchases = [] } = useGetPurchasesQuery();
  const { data: catalog = [] } = useGetAdminCatalogQuery();
  const [revert] = useRevertPurchaseMutation();

  const skuToCatalogMap = useMemo(() => {
    const map = new Map<string, string>();
    catalog.forEach((c: any) => {
      if (c.variantMappings) {
        Object.values(c.variantMappings).forEach((m: any) => {
          if (m.sku) map.set(m.sku, c.id);
          if (m.skus) m.skus.forEach((s: string) => map.set(s, c.id));
        });
      }
    });
    return map;
  }, [catalog]);

  const [revertFor, setRevertFor] = useState<InventoryRow | null>(null);
  const [editFor, setEditFor] = useState<Purchase | null>(null);
  const [reverting, setReverting] = useState(false);

  async function handleRevert() {
    if (!revertFor) return;
    setReverting(true);
    try {
      await revert(revertFor.id).unwrap();
      toast.success(`La llegada del lote "${revertFor.lot}" ha sido descartada. El producto volvió a estar en tránsito.`);
      setRevertFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo descartar la llegada.");
    } finally {
      setReverting(false);
    }
  }

  const columns = useMemo<ColumnDef<InventoryRow, any>[]>(
    () => [
      { accessorKey: "code", header: "Código", sortingFn: "alphanumeric", cell: (c) => <CodeCell value={c.getValue()} /> },
      { accessorKey: "productName", header: "Nombre" },
      {
        id: "mappedStatus",
        header: "Catálogo",
        enableSorting: false,
        cell: ({ row }) => {
          const catalogId = skuToCatalogMap.get(row.original.code);
          return catalogId ? (
            <button
              onClick={() => navigate(`/admin/catalogo?edit=${catalogId}`)}
              className="inline-flex items-center gap-1 rounded-md bg-whatsapp/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-whatsapp hover:bg-whatsapp/25 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="h-3 w-3" />
              Mapeado
            </button>
          ) : (
            <button
              onClick={() => navigate(`/admin/catalogo?link=new`)}
              className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning hover:bg-warning/25 transition-colors cursor-pointer"
            >
              <AlertTriangle className="h-3 w-3" />
              Sin mapear
            </button>
          );
        }
      },
      { accessorKey: "quantityOriginal", header: "Comprado", meta: { align: "right" } },
      {
        accessorKey: "quantitySold",
        header: "Vendido",
        meta: { align: "right" },
        cell: (c) => <span className={c.getValue() > 0 ? "text-warning font-medium" : "text-muted"}>{c.getValue()}</span>
      },

      {
        accessorKey: "available",
        header: "Stock",
        meta: { align: "right" },
        cell: (c) => <span className={c.getValue() === 0 ? "text-danger font-bold" : "text-accent-2 font-bold"}>{c.getValue()}</span>
      },
      // USD a 2 decimales visibles; la precisión completa (4) queda en el tooltip.
      { accessorKey: "priceUnitUsd", header: "P. Unit. (USD)", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      // Envío unitario: 4 decimales visibles (precisión clave para el control de inventario).
      { accessorKey: "shippingUnitUsd", header: "Envío U. (USD)", meta: { align: "right" }, cell: (c) => formatUsd(c.getValue(), 4, 4) },
      { accessorKey: "priceUnitFinalUsd", header: "P. Final (USD)", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      {
        accessorKey: "costRealCordobas",
        header: "Coste",
        meta: { align: "right" },
        cell: (c) => <span className="text-accent-2">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "costoFijoCordobas",
        header: "Coste c/ Fijos",
        meta: { align: "right" },
        cell: (c) => <span className="text-warning font-medium">{formatCordobas(c.getValue() || 0)}</span>,
      },
      {
        id: "precioSugerido",
        header: "Precio sugerido",
        meta: { align: "right" },
        cell: ({ row }) => {
          const ps = row.original.suggestedPrice;
          if (!ps) return <span className="text-muted text-xs">—</span>;
          return <span className="text-accent-2 font-semibold">{formatCordobas(ps)}</span>;
        },
      },
      {
        id: "gananciaEsperada",
        header: "Ganancia unit.",
        meta: { align: "right" },
        cell: ({ row }) => {
          const ganancia = row.original.gananciaUnitCordobas;
          if (ganancia == null) return <span className="text-muted text-xs">—</span>;
          return <span className="text-accent font-semibold">{formatCordobas(ganancia)}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const rowData = row.original;
          const p = purchases.find((x) => x.id === rowData.id);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => setRevertFor(rowData)}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
              >
                Descartar llegada
              </button>
              {p && (
                <RowActionsMenu actions={[{ label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: () => setEditFor(p) }]} />
              )}
            </div>
          );
        },
      },
    ],
    [purchases, skuToCatalogMap, navigate],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar en bodega…"
        emptyText="No hay productos recibidos en bodega todavía."
        initialSorting={[{ id: "code", desc: false }]}
      />

      <Dialog open={!!revertFor} onOpenChange={() => setRevertFor(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{"Descartar Llegada de Lote"}</DialogTitle>
    </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            ¿Estás seguro de que deseas descartar la llegada del producto{" "}
            <strong className="text-text font-semibold">{revertFor?.productName}</strong> (Lote:{" "}
            <span className="text-accent-2 font-mono font-bold">{revertFor?.lot}</span>)?
          </p>
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-3.5 text-xs text-danger leading-normal">
            <strong className="block mb-1 text-danger font-semibold">⚠️ Advertencia de Inventario:</strong>
            Se restarán <strong className="text-danger font-bold">{revertFor?.available} unidades</strong> del stock actual en bodega. El lote completo volverá al estado original de <strong className="text-danger font-semibold">"En tránsito"</strong> en el Registro de Compras.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRevertFor(null)}>
            Cancelar
          </Button>
          <Button onClick={handleRevert} loading={reverting} className="bg-danger/90 hover:bg-danger text-white">
            Confirmar y Descartar
          </Button>
        </div>
        </DialogContent>
</Dialog>

      <EditArrivalModal purchase={editFor} onClose={() => setEditFor(null)} />
    </>
  );
}

