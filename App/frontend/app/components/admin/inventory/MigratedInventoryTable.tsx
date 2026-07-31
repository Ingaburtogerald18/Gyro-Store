// Tabla del inventario migrado (histórico). Cada fila lleva el badge "Migrado".
// Solo lectura + borrar; su lógica de venta se definirá después.
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, Search, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "~/components/ui/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { MigratedInventoryForm } from "./MigratedInventoryForm";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import {
  useGetMigratedInventoryQuery,
  useDeleteMigratedItemMutation,
  type MigratedItem,
} from "~/store/api/inventoryV1Api";
import { formatUsd, formatCordobas } from "~/lib/formatters";
import { CodeCell } from "~/components/ui/cells";

export function MigratedInventoryTable({ onOpenForm, period = "all" }: { onOpenForm?: () => void; period?: string }) {
  const { data: items = [], isLoading } = useGetMigratedInventoryQuery(period);
  const [del, { isLoading: deleting }] = useDeleteMigratedItemMutation();
  const [deleteFor, setDeleteFor] = useState<MigratedItem | null>(null);
  const [editFor, setEditFor] = useState<MigratedItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MigratedItem | null>(null);
  const [filterTab, setFilterTab] = useState<"in_stock" | "out_of_stock">("in_stock");
  const [globalFilter, setGlobalFilter] = useState("");

  // Orden por código, natural (M-IN1, M-IN2 … M-IN12, no M-IN1, M-IN12, M-IN2).
  const sortedItems = useMemo(() => {
    const filtered = items.filter(a => 
      filterTab === "in_stock" ? (a.stock || 0) > 0 : (a.stock || 0) <= 0
    );
    return filtered.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  }, [items, filterTab]);

  async function handleDelete() {
    if (!deleteFor) return;
    try {
      await del(deleteFor.id).unwrap();
      toast.success("Ítem migrado eliminado.");
      setDeleteFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  const columns = useMemo<ColumnDef<MigratedItem, any>[]>(
    () => [
      {
        id: "origin",
        header: "",
        enableSorting: false,
        cell: () => (
          <span className="rounded-pill bg-warning/15 px-2 py-1 text-xs font-medium text-warning">
            Migrado
          </span>
        ),
      },
      { accessorKey: "purchaseDate", header: "Fecha" },
      { accessorKey: "lot", header: "Lote", cell: (c) => c.getValue() || "—" },
      { accessorKey: "code", header: "Código", cell: (c) => <CodeCell value={c.getValue()} /> },
      { accessorKey: "productName", header: "Producto" },
      {
        accessorKey: "quantity",
        header: "Compradas",
        meta: { align: "right" },
        cell: (c) => <span className="nums font-semibold text-primary-2 bg-primary/15 px-2 py-0.5 rounded-full">{c.getValue()}</span>
      },
      {
        accessorKey: "quantitySold",
        header: "Salidas",
        meta: { align: "right" },
        cell: (c) => <span className="nums font-semibold text-destructive bg-destructive/15 px-2 py-0.5 rounded-full">{c.getValue()}</span>
      },

      {
        accessorKey: "stock",
        header: "Stock",
        meta: { align: "right" },
        cell: (c) => <span className="nums font-bold text-info bg-info/15 px-2 py-0.5 rounded-full">{c.getValue()}</span>
      },
      // USD a 2 decimales visibles; precisión completa en el tooltip.
      { accessorKey: "priceBaseUsd", header: "P. Base", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      // Envío unitario: 4 decimales visibles (precisión clave para el control de inventario).
      { accessorKey: "shippingUnitUsd", header: "Envío Unit.", meta: { align: "right" }, cell: (c) => formatUsd(c.getValue(), 4, 4) },
      { accessorKey: "priceUnitFinalUsd", header: "P. Unit. Final", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      { id: "preTotalUsd", header: "Pre-Total", meta: { align: "right" }, cell: ({ row }) => formatUsd((row.original.priceBaseUsd || 0) * (row.original.quantity || 0)) },
      { id: "totalUsd", header: "Total", meta: { align: "right" }, cell: ({ row }) => <span className="font-semibold">{formatUsd((row.original.priceUnitFinalUsd || 0) * (row.original.quantity || 0))}</span> },
      { accessorKey: "costRealUnitCordobas", header: "Coste", meta: { align: "right" }, cell: (c) => formatCordobas(c.getValue()) },
      { accessorKey: "suggestedPrice", header: "P. Sugerido", meta: { align: "right" }, cell: (c) => formatCordobas(c.getValue()) },
    ],
    [],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border bg-card shadow-lg" />;
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas unificada y sticky */}
      <div className="sticky top-[116px] z-10 -mx-4 bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          
          <div className="flex items-center gap-2 rounded-pill border bg-card px-3 py-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 sm:w-80">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar código, lote, producto..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-3">
            {selectedItem ? (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <span className="text-sm font-medium text-muted-foreground hidden lg:inline mr-2">
                  <strong className="text-foreground">{selectedItem.code}</strong> seleccionado
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setEditFor(selectedItem)}
                  className="h-8 bg-muted text-xs hover:text-primary"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteFor(selectedItem)}
                  className="h-8 bg-muted text-xs text-destructive hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                </Button>
                <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                  title="Cancelar selección"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <AnimatedTabs
                  items={[
                    { id: "in_stock", label: "En existencia" },
                    { id: "out_of_stock", label: "Agotados" },
                  ]}
                  value={filterTab}
                  onChange={(id) => { setFilterTab(id as "in_stock" | "out_of_stock"); setSelectedItem(null); }}
                  layoutId="migrated-subtabs"
                  indicatorClassName={filterTab === "out_of_stock" ? "bg-destructive/90" : "bg-gradient-accent"}
                />
                {onOpenForm && (
                  <Button onClick={onOpenForm} className="flex items-center gap-1.5 whitespace-nowrap">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Registrar ítem</span>
                  </Button>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>



      <DataTable
        columns={columns}
        data={sortedItems}
        searchPlaceholder="Buscar por código, lote, producto…"
        emptyText="Aún no hay inventario migrado registrado."
        onRowClick={(row) => setSelectedItem(selectedItem?.id === row.id ? null : row)}
        selectedRowId={selectedItem?.id}
        hideSearch
        globalFilterValue={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        paginated
        pageSize={50}
      />
      <Dialog open={!!editFor} onOpenChange={(open) => !open && setEditFor(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar ítem migrado</DialogTitle>
          </DialogHeader>
          {editFor && <MigratedInventoryForm item={editFor} onDone={() => setEditFor(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteFor} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar ítem migrado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el ítem migrado <strong className="text-foreground">{deleteFor?.code}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-destructive/90">
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
