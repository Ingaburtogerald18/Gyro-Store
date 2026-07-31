import { Skeleton } from "~/components/ui/skeleton";
// Tabla de datos genérica sobre TanStack Table v8: ordenable, con búsqueda
// global y paginación. Se reutiliza en todos los portales del admin.
import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
  type Table as TableInstance,
} from "@tanstack/react-table";
import { Search, Check, ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty";
import { cn } from "~/lib/utils";

// Tope de filas para la entrada escalonada: por encima, se renderiza sin motion
// para no castigar tablas largas (regla "stagger O virtualización, no ambas").
const STAGGER_MAX_ROWS = 60;
// Curva de salida exponencial (misma que `ease-expo` en globals.css).
const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

// Alineación por columna vía `meta` (texto a la izquierda, números a la derecha).
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right" | "center";
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  searchPlaceholder?: string;
  pageSize?: number;
  emptyText?: ReactNode;
  isLoading?: boolean;
  initialSorting?: SortingState;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  selectedRowIds?: Set<string | number>;
  onSelectAll?: (selectAll: boolean) => void;
  allSelected?: boolean;
  hideSearch?: boolean;
  globalFilterValue?: string;
  onGlobalFilterChange?: (value: string) => void;
  // Si se provee, en móvil se renderiza cada fila como tarjeta (la tabla queda solo en desktop).
  mobileCard?: (row: T) => ReactNode;
  // Paginación en cliente (opt-in). Sin esto se muestran TODAS las filas (comportamiento previo).
  // Úsala en tablas que cargan su dataset completo y pueden crecer sin límite.
  paginated?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = "Buscar…",
  pageSize = 25,
  emptyText = "Sin registros.",
  isLoading = false,
  initialSorting = [],
  onRowClick,
  selectedRowId,
  selectedRowIds,
  onSelectAll,
  allSelected,
  hideSearch = false,
  globalFilterValue,
  onGlobalFilterChange,
  mobileCard,
  paginated = false,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("");
  const reduce = useReducedMotion();

  const globalFilter = globalFilterValue !== undefined ? globalFilterValue : internalGlobalFilter;
  const setGlobalFilter = onGlobalFilterChange || setInternalGlobalFilter;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const value = row.getValue(columnId);
      if (value == null) return false;
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Paginación opt-in. Sin `paginated` no se registra el modelo → se muestran TODAS
    // las filas (la tabla scrollea dentro de su contenedor), como antes.
    ...(paginated ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(paginated ? { initialState: { pagination: { pageSize } } } : {}),
  });

  return (
    <div className="space-y-3">
      {!hideSearch && (
        <div className="flex items-center gap-2 rounded-pill border border bg-card px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 sm:max-w-xs">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : (
      <>
      <div className="hidden md:block overflow-auto max-h-[75vh] rounded-card border border bg-card shadow-premium relative">
        <table className="w-full text-sm">
          <thead className="table-header-brand text-left sticky top-0 z-20 shadow-sm">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {onRowClick && (
                  <th className="w-10 px-3 py-2.5">
                    {onSelectAll && (
                      <div
                        onClick={() => onSelectAll(!allSelected)}
                        className={`flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded border transition-colors ${
                          allSelected
                            ? "border-primary-2 bg-primary-2 text-white"
                            : "border bg-card hover:bg-muted"
                        }`}
                      >
                        {allSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                    )}
                  </th>
                )}
                {hg.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align;
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className={cn(
                            "group/sort flex w-full items-center gap-1 cursor-pointer select-none hover:text-foreground",
                            align === "right" && "justify-end",
                            align === "center" && "justify-center",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3 shrink-0 text-primary-2" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3 shrink-0 text-primary-2" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/sort:opacity-50" />
                          )}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            align === "right" && "justify-end",
                            align === "center" && "justify-center",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={onRowClick ? columns.length + 1 : columns.length} className="px-3 py-6">
                  {/* Primitiva Empty: da jerarquía (ícono + título) donde antes
                      había una sola línea de texto suelta. `emptyText` sigue
                      siendo el título, así que las vistas que lo pasan no cambian. */}
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Inbox />
                      </EmptyMedia>
                      <EmptyTitle>{emptyText}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </td>
              </tr>
            ) : (
              (() => {
                const rows = table.getRowModel().rows;
                // Entrada escalonada solo en tablas cortas y si el usuario no pidió menos motion.
                const animate = !reduce && rows.length <= STAGGER_MAX_ROWS;
                return rows.map((row, idx) => {
                const rowId = (row.original as any).id;
                const isSelected =
                  (selectedRowIds && selectedRowIds.has(rowId)) ||
                  (selectedRowId && rowId === selectedRowId);
                const rowClass = cn(
                  "group/row border-t border/50 transition-colors",
                  onRowClick && "cursor-pointer",
                  isSelected
                    ? "bg-primary-2/10 hover:bg-primary-2/20"
                    : cn(idx % 2 === 1 && "bg-muted/50", "hover:bg-muted/80"),
                );
                // El tope del delay evita que la fila 40 entre con casi 1s de retraso.
                const rowAnim = animate
                  ? {
                      initial: { opacity: 0, y: 8 },
                      animate: { opacity: 1, y: 0 },
                      transition: { duration: 0.25, ease: EASE_EXPO, delay: Math.min(idx, 12) * 0.025 },
                    }
                  : {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const RowTag: any = animate ? motion.tr : "tr";
                return (
                  <RowTag
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={rowClass}
                    {...rowAnim}
                  >
                    {onRowClick && (
                      <td className="w-10 px-3 py-2.5">
                        <div
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-primary-2 bg-primary-2 text-white"
                              : "border bg-card"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const align = cell.column.columnDef.meta?.align;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "nums whitespace-nowrap px-3 py-2.5",
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </RowTag>
                );
                });
              })()
            )}
          </tbody>
          {table.getFooterGroups().some(fg => fg.headers.some(h => h.column.columnDef.footer)) && (
            <tfoot className="sticky bottom-0 z-20 bg-background/80 backdrop-blur-md border-t border shadow-[0_-5px_20px_rgba(0,0,0,0.25)] font-bold">
              {table.getFooterGroups().map((fg) => (
                <tr key={fg.id}>
                  {onRowClick && <td className="px-3 py-2.5"></td>}
                  {fg.headers.map((header) => {
                    const align = header.column.columnDef.meta?.align;
                    return (
                      <td
                        key={header.id}
                        className={cn(
                          "nums whitespace-nowrap px-3 py-2.5",
                          align === "right" && "text-right",
                          align === "center" && "text-center",
                        )}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
      {/* Vista móvil: tarjetas (bonitas si el panel define mobileCard; genéricas si no). */}
      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length === 0 ? (
          <p className="rounded-card border border bg-card shadow-premium py-8 text-center text-muted-foreground">{emptyText}</p>
        ) : (
          table.getRowModel().rows.map((row) => {
            const rowId = (row.original as any).id;
            const isSelected =
              (selectedRowIds && selectedRowIds.has(rowId)) || (selectedRowId && rowId === selectedRowId);
            return (
              <div
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={`${onRowClick ? "cursor-pointer " : ""}${isSelected ? "rounded-card ring-2 ring-primary-2" : ""}`}
              >
                {mobileCard ? (
                  mobileCard(row.original)
                ) : (
                  <div className="space-y-1.5 rounded-card border border bg-card shadow-premium p-4">
                    {row.getVisibleCells().map((cell) => {
                      const header = cell.column.columnDef.header;
                      const label = typeof header === "string" ? header : "";
                      return (
                        <div key={cell.id} className="flex items-start justify-between gap-3 text-sm">
                          {label ? <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</span> : <span />}
                          <div className="min-w-0 text-right">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {paginated && table.getRowModel().rows.length > 0 && <TablePagination table={table} />}
      </>
      )}
    </div>
  );
}

// Control de paginación compartido (prev/próxima + rango). Solo se monta cuando
// la tabla usa `paginated`. Estilizado con tokens; botones con hit-area accesible.
function TablePagination<T>({ table }: { table: TableInstance<T> }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-col items-center justify-between gap-3 pt-1 text-sm sm:flex-row"
    >
      <p className="nums text-muted-foreground">
        <span className="font-semibold text-foreground">{from}–{to}</span> de{" "}
        <span className="font-semibold text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Página anterior"
          className="grid h-11 w-11 place-items-center rounded-lg border border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="nums px-2 text-muted-foreground">
          Página <span className="font-semibold text-foreground">{pageIndex + 1}</span> de{" "}
          <span className="font-semibold text-foreground">{Math.max(pageCount, 1)}</span>
        </span>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Página siguiente"
          className="grid h-11 w-11 place-items-center rounded-lg border border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
