// Tabla de compras (registro China) con badges de estado y acciones según estado:
// En tránsito → Reportar llegada / Eliminar; Pendiente → Aprobar recepción.
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Ship, Pencil, Trash2, Plus, Warehouse } from "lucide-react";
import { PurchaseCommandPalette } from "./PurchaseCommandPalette";
import { toast } from "sonner";
import { DataTable } from "~/components/ui/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { FilterSelect, type FilterSelectOption } from "~/components/ui/FilterSelect";
import { RowActionsMenu } from "~/components/ui/RowActionsMenu";
import { StatusBadge, type BadgeStatus } from "~/components/ui/StatusBadge";
import { ArrivalModal } from "./ArrivalModal";
import { EditPurchaseModal } from "./EditPurchaseModal";
import {
  useGetPurchasesQuery,
  useDeletePurchaseMutation,
  type Purchase,
} from "~/store/api/inventoryV1Api";
import { formatUsd } from "~/lib/utils";

// Tono del StatusBadge canónico por estado de la compra.
const STATUS_META: Record<Purchase["status"], { label: string; status: BadgeStatus }> = {
  china: { label: "En tránsito", status: "info" },
  received: { label: "Recibido", status: "whatsapp" },
};

const ALL_OPT: FilterSelectOption = { value: "all", label: "Todos" };

const STATUS_OPTIONS: FilterSelectOption[] = [
  ALL_OPT,
  { value: "china", label: "En tránsito" },
  { value: "received", label: "Recibido" },
];

export function PurchasesTable({ period = "all", onOpenForm }: { period?: string; onOpenForm?: () => void }) {
  const { data: purchases = [], isLoading } = useGetPurchasesQuery(period);
  const [del, { isLoading: deleting }] = useDeletePurchaseMutation();
  const [globalFilter, setGlobalFilter] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [filterDate, setFilterDate] = useState("all");
  const [filterLot, setFilterLot] = useState("all");
  const [filterCode, setFilterCode] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [arrivalFor, setArrivalFor] = useState<Purchase | null>(null);
  const [editFor, setEditFor] = useState<Purchase | null>(null);
  const [deleteFor, setDeleteFor] = useState<Purchase | null>(null);

  const dateOptions = useMemo<FilterSelectOption[]>(() => {
    const vals = Array.from(new Set(purchases.map((p) => p.purchaseDate).filter(Boolean))).sort().reverse();
    return [ALL_OPT, ...vals.map((v) => ({ value: v, label: v }))];
  }, [purchases]);

  const lotOptions = useMemo<FilterSelectOption[]>(() => {
    const vals = Array.from(new Set(purchases.map((p) => p.lot).filter(Boolean))).sort();
    return [ALL_OPT, ...vals.map((v) => ({ value: v, label: v }))];
  }, [purchases]);

  const codeOptions = useMemo<FilterSelectOption[]>(() => {
    const vals = Array.from(new Set(purchases.map((p) => p.code).filter(Boolean))).sort();
    return [ALL_OPT, ...vals.map((v) => ({ value: v, label: v }))];
  }, [purchases]);

  const productOptions = useMemo<FilterSelectOption[]>(() => {
    const vals = Array.from(new Set(purchases.map((p) => p.productName).filter(Boolean))).sort();
    return [ALL_OPT, ...vals.map((v) => ({ value: v, label: v }))];
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    const res = purchases.filter((p) => {
      if (filterDate !== "all" && p.purchaseDate !== filterDate) return false;
      if (filterLot !== "all" && p.lot !== filterLot) return false;
      if (filterCode !== "all" && p.code !== filterCode) return false;
      if (filterProduct !== "all" && p.productName !== filterProduct) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
    
    return res.sort((a, b) => 
      String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true })
    );
  }, [purchases, filterDate, filterLot, filterCode, filterProduct, filterStatus]);

  async function handleDelete() {
    if (!deleteFor) return;
    try {
      await del(deleteFor.id).unwrap();
      toast.success("Compra eliminada.");
      setDeleteFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  const columns = useMemo<ColumnDef<Purchase, any>[]>(
    () => [
      {
        accessorKey: "purchaseDate",
        enableSorting: false,
        header: () => (
          <FilterSelect variant="ghost" value={filterDate} onChange={setFilterDate} options={dateOptions} placeholder="Fecha" />
        ),
      },
      {
        accessorKey: "lot",
        enableSorting: false,
        header: () => (
          <FilterSelect variant="ghost" value={filterLot} onChange={setFilterLot} options={lotOptions} placeholder="Lote" />
        ),
      },
      {
        accessorKey: "code",
        enableSorting: false,
        header: () => (
          <FilterSelect variant="ghost" value={filterCode} onChange={setFilterCode} options={codeOptions} placeholder="Código" />
        ),
      },
      {
        accessorKey: "productName",
        enableSorting: false,
        header: () => (
          <FilterSelect variant="ghost" value={filterProduct} onChange={setFilterProduct} options={productOptions} placeholder="Producto" />
        ),
      },
      {
        accessorKey: "status",
        enableSorting: false,
        header: () => (
          <FilterSelect variant="ghost" value={filterStatus} onChange={setFilterStatus} options={STATUS_OPTIONS} placeholder="Estado" />
        ),
        cell: (c) => {
          const m = STATUS_META[c.getValue() as Purchase["status"]];
          return <StatusBadge status={m.status} label={m.label} />;
        },
      },
      { accessorKey: "quantity", header: "Cant.", meta: { align: "right" } },
      // USD a 2 decimales visibles; precisión completa en el tooltip.
      { accessorKey: "costUnit", header: "P. Base", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      { accessorKey: "taxUnit", header: "Imp. Unit.", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      { accessorKey: "priceUnit", header: "P. Unit.", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      { accessorKey: "total", header: "Total", meta: { align: "right" }, cell: (c) => <span className="font-semibold">{formatUsd(c.getValue())}</span> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original;
          if (p.status === "china") {
            return (
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    { label: "Reportar llegada", icon: <Ship className="h-4 w-4" />, onClick: () => setArrivalFor(p) },
                    { label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: () => setEditFor(p) },
                    { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, danger: true, separatorBefore: true, onClick: () => setDeleteFor(p) },
                  ]}
                />
              </div>
            );
          }
          if (p.status === "received") {
            return (
              <div className="flex items-center justify-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1.5 text-xs font-semibold text-accent-2">
                  <Warehouse className="h-3.5 w-3.5" />
                  Ingresado a bodega
                </span>
                <RowActionsMenu actions={[{ label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: () => setEditFor(p) }]} />
              </div>
            );
          }
          return <span className="text-xs text-muted">—</span>;
        },
      },
    ],
    [filterDate, filterLot, filterCode, filterProduct, filterStatus, dateOptions, lotOptions, codeOptions, productOptions],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  }

  return (
    <>
      {/* Barra de herramientas sticky */}
      <div className="sticky top-[116px] z-10 -mx-4 bg-bg/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-3">
            {/* Resumen basado en los filtros activos */}
            <div className="hidden sm:flex items-center divide-x divide-border rounded-xl border border-border bg-surface px-1 py-1">
              <SummaryPill label="Ítems" value={filteredPurchases.length.toString()} />
              <SummaryPill label="Cantidades" value={filteredPurchases.reduce((s, p) => s + (p.quantity ?? 0), 0).toString()} />
              <SummaryPill label="Impuestos" value={formatUsd(filteredPurchases.reduce((s, p) => s + (p.taxUnit ?? 0) * (p.quantity ?? 0), 0))} />
              <SummaryPill label="Total" value={formatUsd(filteredPurchases.reduce((s, p) => s + (p.total ?? 0), 0))} accent />
            </div>
            {onOpenForm && (
              <Button onClick={onOpenForm} className="flex items-center gap-1.5 whitespace-nowrap">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Registrar compra</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredPurchases}
        searchPlaceholder="Buscar por código, lote, producto…"
        emptyText="Aún no hay compras registradas."
        hideSearch
      />
      <PurchaseCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        purchases={purchases}
        onSelect={(p) => { setEditFor(p); setPaletteOpen(false); }}
      />
      <ArrivalModal purchase={arrivalFor} onClose={() => setArrivalFor(null)} />
      <EditPurchaseModal purchase={editFor} onClose={() => setEditFor(null)} />
      <Dialog open={!!deleteFor} onOpenChange={() => setDeleteFor(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{"Eliminar compra"}</DialogTitle>
    </DialogHeader>
        <p className="text-sm text-muted">
          ¿Eliminar la compra <strong className="text-text">{deleteFor?.code}</strong>? Esta acción no
          se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteFor(null)}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger/90">
            Eliminar
          </Button>
        </div>
        </DialogContent>
</Dialog>
    </>
  );
}

function SummaryPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center px-3 py-0.5 min-w-[72px]">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-sm font-bold ${accent ? "text-accent-2" : "text-text"}`}>{value}</span>
    </div>
  );
}
