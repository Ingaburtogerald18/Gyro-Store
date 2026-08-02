import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Copy01Icon, File01Icon, Invoice01Icon, PrinterIcon, PlusSignIcon, Tick01Icon, Time02Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { cn } from '~/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { DataTable } from '~/components/ui/DataTable';
import { QueryState } from '~/components/ui/QueryState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { formatCordobas } from "~/lib/formatters";
import { useGetInvoicesQuery, type Invoice } from '~/store/api/invoicesApi';
import { TicketPrintModal } from '~/components/admin/invoices/TicketPrintModal';
import { InvoiceEditor } from "~/components/admin/invoices/InvoiceEditor";

export const meta: MetaFunction = () => [{ title: 'Facturación | Gyro Store Admin' }];

/**
 * Número de factura con botón para copiarlo.
 *
 * Es el dato que el vendedor tipea después en Ventas para vincular la venta, y
 * transcribir `GS-PR-137` a mano es justo donde se cuela el error.
 *
 * `stopPropagation` porque la celda vive en una fila que puede ser clickeable:
 * copiar no debería además abrir el detalle.
 */
function InvoiceCodeCell({ code, bold }: { code: string; bold?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${code} copiado.`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // `navigator.clipboard` no existe fuera de HTTPS/localhost.
      toast.error('El navegador no permitió copiar. Seleccionalo a mano.');
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('font-mono', bold && 'font-medium')}>{code}</span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copiar número de factura"
        aria-label={`Copiar ${code}`}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <AnimatedIcon
          icon={copied ? Tick01Icon : Copy01Icon}
          gesture="pop"
          size={14}
          strokeWidth={2}
          className={cn(copied && 'text-success')}
        />
      </button>
    </span>
  );
}

export default function AdminFacturacion() {
  const { data: unlinkedInvoices = [], isLoading: loadingUnlinked, isError: unlinkedError } = useGetInvoicesQuery({ status: 'unlinked' });
  const { data: linkedInvoices = [], isLoading: loadingLinked, isError: linkedError } = useGetInvoicesQuery({ status: 'linked' });
  
  const [isCreating, setIsCreating] = useState(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);

  const unlinkedColumns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      { accessorKey: 'invoiceCode', header: 'Número de Factura', cell: ({ row }) => <InvoiceCodeCell code={row.original.invoiceCode} bold /> },
      { accessorKey: 'customerName', header: 'Cliente', cell: ({ row }) => row.original.customerName || '—' },
      { accessorKey: 'method', header: 'Método', cell: ({ row }) => <span className="capitalize">{row.original.method ?? '—'}</span> },
      // Subtotal · Delivery · Total: el modelo ya trae los tres, y con una sola
      // columna "Total" no se podía saber cuánto de esa cifra era envío.
      // `meta.align` en vez de un <div className="text-right"> dentro del
      // header: DataTable envuelve el header en un flex propio y el div no se
      // estiraba, así que el título quedaba a la izquierda y la cifra a la derecha.
      {
        accessorKey: 'subtotal',
        header: 'Subtotal',
        meta: { align: 'right' },
        cell: ({ row }) => formatCordobas(row.original.subtotal ?? 0),
      },
      {
        accessorKey: 'deliveryFee',
        header: 'Delivery',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.deliveryFee > 0 ? (
            formatCordobas(row.original.deliveryFee)
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'total',
        header: 'Total',
        meta: { align: 'right' },
        cell: ({ row }) => <span className="font-semibold">{formatCordobas(row.original.total)}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Antigüedad',
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
          
          let display = '';
          if (diffMinutes < 60) display = `Hace ${diffMinutes} min`;
          else if (diffMinutes < 1440) display = `Hace ${Math.floor(diffMinutes / 60)} hs`;
          else display = date.toLocaleDateString('es-NI');

          const isOld = diffMinutes > 60;
          return (
            <div className={`flex items-center gap-1.5 ${isOld ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              <AnimatedIcon icon={Time02Icon} size={14} />
              {display}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPrintInvoiceId(row.original.id)}>
              <AnimatedIcon icon={PrinterIcon} size={16} strokeWidth={2} aria-hidden />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const linkedColumns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      { accessorKey: 'invoiceCode', header: 'Número de Factura', cell: ({ row }) => <InvoiceCodeCell code={row.original.invoiceCode} /> },
      { accessorKey: 'customerName', header: 'Cliente', cell: ({ row }) => row.original.customerName || '—' },
      { accessorKey: 'method', header: 'Método', cell: ({ row }) => <span className="capitalize">{row.original.method ?? '—'}</span> },
      // Subtotal · Delivery · Total: el modelo ya trae los tres, y con una sola
      // columna "Total" no se podía saber cuánto de esa cifra era envío.
      // `meta.align` en vez de un <div className="text-right"> dentro del
      // header: DataTable envuelve el header en un flex propio y el div no se
      // estiraba, así que el título quedaba a la izquierda y la cifra a la derecha.
      {
        accessorKey: 'subtotal',
        header: 'Subtotal',
        meta: { align: 'right' },
        cell: ({ row }) => formatCordobas(row.original.subtotal ?? 0),
      },
      {
        accessorKey: 'deliveryFee',
        header: 'Delivery',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.deliveryFee > 0 ? (
            formatCordobas(row.original.deliveryFee)
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'total',
        header: 'Total',
        meta: { align: 'right' },
        cell: ({ row }) => <span className="font-semibold">{formatCordobas(row.original.total)}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('es-NI'),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setPrintInvoiceId(row.original.id)}>
              <AnimatedIcon icon={PrinterIcon} size={16} strokeWidth={2} className="mr-1.5" aria-hidden /> Imprimir
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Facturación</h2>
          <p className="text-muted-foreground">Genera facturas (ticket) y luego liganlas al registrar la venta.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} size="lg" className="shrink-0 shadow-sm">
          <AnimatedIcon icon={PlusSignIcon} size={18} strokeWidth={2.5} className="mr-1.5" />
          Nueva Factura
        </Button>
      </div>

      <Card className="bg-card border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <AnimatedIcon icon={Invoice01Icon} size={20} className="text-amber-500" />
            Facturas pendientes de vincular
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Ya se imprimió el ticket pero ningún vendedor ha registrado la venta con este número.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState
            loading={loadingUnlinked}
            error={unlinkedError}
            empty={unlinkedInvoices.length === 0}
            loadingFallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}
            emptyFallback={
              <div className="rounded-lg border border-dashed bg-muted/50 py-10 text-center">
                <AnimatedIcon icon={File01Icon} size={36} strokeWidth={2} className="mx-auto mb-3 text-muted-foreground opacity-50" aria-hidden />
                <p className="font-medium text-foreground">Todas las facturas emitidas están registradas como venta.</p>
              </div>
            }
          >
            <DataTable columns={unlinkedColumns} data={unlinkedInvoices} hideSearch emptyText="No hay facturas pendientes." />
          </QueryState>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Facturas completadas (vinculadas)</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            loading={loadingLinked}
            error={linkedError}
            loadingFallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}
          >
            <DataTable columns={linkedColumns} data={linkedInvoices} searchPlaceholder="Buscar…" emptyText="No hay facturas vinculadas." />
          </QueryState>
        </CardContent>
      </Card>

      <TicketPrintModal invoiceId={printInvoiceId} onClose={() => setPrintInvoiceId(null)} />

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Factura (POS)</DialogTitle>
          </DialogHeader>
          
          <div className="pt-2">
            <InvoiceEditor onCreated={(id) => {
              setIsCreating(false);
              setPrintInvoiceId(id);
            }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
