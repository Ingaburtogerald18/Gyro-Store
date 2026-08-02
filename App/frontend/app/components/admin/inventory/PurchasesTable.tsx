// Tabla de compras (registro China) con badges de estado y acciones según estado:
// En tránsito → Reportar llegada / Eliminar; Pendiente → Aprobar recepción.
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, Edit02Icon, ShippingTruck01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";

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
import { formatUsd } from "~/lib/formatters";
import { CodeCell, MoneyCell } from "~/components/ui/cells";
import { Spinner } from "~/components/ui/spinner";
import { useGetConfigQuery } from "~/store/api/configApi";

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
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: config } = useGetConfigQuery();

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

  const categoryOptions = useMemo<FilterSelectOption[]>(() => {
    const vals = Array.from(new Set(purchases.map((p) => p.category).filter(Boolean)));
    return [
      ALL_OPT,
      ...vals.map((v) => {
        const cat = config?.categories?.find((c) => c.id === v);
        return { value: v as string, label: cat ? `${cat.icon} ${cat.name}` : (v as string) };
      })
    ];
  }, [purchases, config]);

  const filteredPurchases = useMemo(() => {
    let r = purchases;
    if (filterDate !== "all") r = r.filter((p) => p.purchaseDate === filterDate);
    if (filterLot !== "all") r = r.filter((p) => p.lot === filterLot);
    if (filterCode !== "all") r = r.filter((p) => p.code === filterCode);
    if (filterProduct !== "all") r = r.filter((p) => p.productName === filterProduct);
    if (filterCategory !== "all") r = r.filter((p) => p.category === filterCategory);
    if (filterStatus !== "all") r = r.filter((p) => p.status === filterStatus);
    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase();
      r = r.filter((p) => p.code.toLowerCase().includes(q) || p.lot.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => 
      String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true })
    );
  }, [purchases, filterDate, filterLot, filterCode, filterProduct, filterCategory, filterStatus, globalFilter]);

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
        cell: (c) => <CodeCell value={c.getValue() as string} />,
      },
      {
        accessorKey: "productName",
        enableSorting: false,
        header: () => (
          <FilterSelect variant="ghost" value={filterProduct} onChange={setFilterProduct} options={productOptions} placeholder="Producto" />
        ),
      },
      {
        accessorKey: "category",
        enableSorting: false,
        header: () => (
          <FilterSelect variant="ghost" value={filterCategory} onChange={setFilterCategory} options={categoryOptions} placeholder="Categoría" />
        ),
        cell: (c) => {
          const val = c.getValue() as string;
          if (!val) return <span className="text-muted-foreground">—</span>;
          const cat = config?.categories?.find((cat) => cat.id === val);
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap bg-muted px-2 py-0.5 rounded-full w-fit">
              <span className="text-sm">{cat?.icon}</span>
              <span className="text-xs font-medium text-foreground">{cat?.name || val}</span>
            </div>
          );
        },
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
      { 
        accessorKey: "quantity", 
        header: "Cant.", 
        meta: { align: "right" }
      },
      // USD a 2 decimales visibles; precisión completa en el tooltip.
      { accessorKey: "costUnit", header: "P. Base", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}><MoneyCell currency="usd" value={c.getValue() as number} /></span> },
      { accessorKey: "taxUnit", header: "Imp. Unit.", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}><MoneyCell currency="usd" value={c.getValue() as number} /></span> },
      { accessorKey: "priceUnit", header: "P. Unit.", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}><MoneyCell currency="usd" value={c.getValue() as number} /></span> },
      { 
        accessorKey: "total", 
        header: "Total", 
        meta: { align: "right" }, 
        cell: (c) => <MoneyCell currency="usd" tone="strong" value={c.getValue() as number} />
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-[1%]" },
        cell: ({ row }) => {
          const p = row.original;
          if (p.status === "china") {
            return (
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    { group: "Movimiento", label: "Reportar ingreso", icon: <HugeiconsIcon icon={ShippingTruck01Icon} size={16} strokeWidth={2} />, onClick: () => setArrivalFor(p) },
                    { group: "Gestión", label: "Editar", icon: <HugeiconsIcon icon={Edit02Icon} size={16} strokeWidth={2} />, onClick: () => setEditFor(p) },
                    { label: "Eliminar", icon: <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />, danger: true, separatorBefore: true, onClick: () => setDeleteFor(p) },
                  ]}
                />
              </div>
            );
          }
          if (p.status === "received") {
            return (
              <div className="flex items-center justify-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary-2">
                  <HugeiconsIcon icon={Store01Icon} size={14} strokeWidth={2} />
                  Bodega
                </span>
                <RowActionsMenu
                  actions={[
                    { label: "Editar", icon: <HugeiconsIcon icon={Edit02Icon} size={16} strokeWidth={2} />, onClick: () => setEditFor(p) },
                    { label: "Eliminar", icon: <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />, danger: true, separatorBefore: true, onClick: () => setDeleteFor(p) },
                  ]}
                />
              </div>
            );
          }
          return <span className="text-xs text-muted-foreground">—</span>;
        },
      },
    ],
    [filterDate, filterLot, filterCode, filterProduct, filterCategory, filterStatus, dateOptions, lotOptions, codeOptions, productOptions, categoryOptions, config],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border bg-card shadow-lg" />;
  }

  return (
    <>
      {/* Barra de herramientas sticky */}
      <div className="sticky top-[116px] z-10 -mx-4 bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-3">
            {/* Resumen basado en los filtros activos */}
            <div className="hidden sm:flex items-center divide-x divide-border rounded-xl border bg-card px-1 py-1">
              <SummaryPill label="Ítems" value={filteredPurchases.length.toString()} />
              <SummaryPill label="Cantidades" value={filteredPurchases.reduce((s, p) => s + (p.quantity ?? 0), 0).toString()} />
              <SummaryPill label="Impuestos" value={formatUsd(filteredPurchases.reduce((s, p) => s + (p.taxUnit ?? 0) * (p.quantity ?? 0), 0))} />
              <SummaryPill label="Total" value={formatUsd(filteredPurchases.reduce((s, p) => s + (p.total ?? 0), 0))} accent />
            </div>
            {onOpenForm && (
              <Button onClick={onOpenForm} className="flex items-center gap-1.5 whitespace-nowrap">
                <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
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
        <p className="text-sm text-muted-foreground">
          ¿Eliminar la compra <strong className="text-foreground">{deleteFor?.code}</strong>? Esta acción no
          se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteFor(null)}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} disabled={deleting} className="bg-destructive/90">
        {deleting && <Spinner className="mr-2" />}
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
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${accent ? "text-primary-2" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
