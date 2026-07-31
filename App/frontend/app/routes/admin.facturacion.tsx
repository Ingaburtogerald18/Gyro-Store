// Portal de Facturación (doc 09 ítem 66): emitir factura de una venta
// aprobada + listado. Modelo delgado (server/services/invoice.ts): la
// factura numera una venta que ya pasó por todo el ciclo de sales.ts, no
// tiene líneas/cliente propios.
//
// Reciclaje de v1 (admin.facturacion.tsx + InvoicingPanel.tsx): v1 era un
// panel de POS completo — el cajero arma el ticket (busca productos, reserva
// FIFO) ANTES de que exista una venta. Eso no aplica acá: el modelo v2 va al
// revés (factura DESPUÉS de una venta aprobada, doc 03 B.4), así que se
// reescribe como un selector de "ventas aprobadas sin factura" + emisión.
// El ticket térmico 80mm queda como TODO: react-to-print no está instalado
// y no se agregan dependencias sin avisar.
import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon, Invoice01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DataTable } from '~/components/ui/DataTable';
import { QueryState } from '~/components/ui/QueryState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { errMsg, formatCordobas, withoutIds } from "~/lib/formatters";
import { useCreateInvoiceMutation, useGetInvoicesQuery, type Invoice } from '~/store/api/invoicesApi';
import { useGetSalesQuery, type SaleListItem } from '~/store/api/salesApi';
import { Spinner } from "~/components/ui/spinner";

export const meta: MetaFunction = () => [{ title: 'Facturación | Gyro Store Admin' }];

const METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
] as const;

export default function AdminFacturacion() {
  const {
    data: approvedSales = [],
    isLoading: loadingSales,
    isError: salesError,
  } = useGetSalesQuery({ status: 'approved' });
  const { data: invoices = [], isLoading: loadingInvoices, isError: invoicesError } = useGetInvoicesQuery();
  const [createInvoice, { isLoading: creating }] = useCreateInvoiceMutation();

  const [saleFor, setSaleFor] = useState<SaleListItem | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]['value']>('efectivo');
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Ventas aprobadas que todavía no tienen factura (sale_id es UNIQUE en
  // invoices — doc 09 migración 0010).
  const pendingSales = useMemo(
    () => withoutIds(approvedSales, invoices.map((i) => i.saleId), (s) => s.id),
    [approvedSales, invoices],
  );

  async function handleCreate() {
    if (!saleFor) return;
    try {
      await createInvoice({ orderId: saleFor.id, method, deliveryFee: deliveryFee || undefined }).unwrap();
      toast.success('Factura emitida.');
      setSaleFor(null);
      setMethod('efectivo');
      setDeliveryFee(0);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo emitir la factura.'));
    }
  }

  const pendingColumns = useMemo<ColumnDef<SaleListItem, unknown>[]>(
    () => [
      { accessorKey: 'sellerEmail', header: 'Vendedor' },
      { accessorKey: 'phone', header: 'Teléfono', cell: ({ row }) => row.original.phone ?? '—' },
      {
        accessorKey: 'total',
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => <div className="text-right font-semibold">{formatCordobas(row.original.total)}</div>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setSaleFor(row.original)}>
              <HugeiconsIcon icon={Invoice01Icon} size={16} strokeWidth={2} className="mr-1.5" aria-hidden /> Facturar
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const invoiceColumns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      { accessorKey: 'invoiceNumber', header: 'N°', cell: ({ row }) => <span className="font-mono">#{row.original.invoiceNumber}</span> },
      { accessorKey: 'method', header: 'Método', cell: ({ row }) => row.original.method ?? '—' },
      {
        accessorKey: 'deliveryFee',
        header: () => <div className="text-right">Envío</div>,
        cell: ({ row }) => <div className="text-right">{formatCordobas(row.original.deliveryFee)}</div>,
      },
      {
        accessorKey: 'total',
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => <div className="text-right font-semibold">{formatCordobas(row.original.total)}</div>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('es-NI'),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Facturación</h2>
        <p className="text-muted-foreground">Emitir factura de una venta aprobada.</p>
      </div>

      <Card className="bg-card border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Ventas por facturar</CardTitle>
          <CardDescription className="text-muted-foreground">Aprobadas, todavía sin correlativo.</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState
            loading={loadingSales}
            error={salesError}
            empty={pendingSales.length === 0}
            loadingFallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}
            emptyFallback={
              <div className="rounded-lg border border-dashed border bg-muted/50 py-10 text-center">
                <HugeiconsIcon icon={File01Icon} size={36} strokeWidth={2} className="mx-auto mb-3 text-muted-foreground opacity-50" aria-hidden />
                <p className="font-medium text-foreground">No hay ventas pendientes de facturar.</p>
              </div>
            }
          >
            <DataTable columns={pendingColumns} data={pendingSales} hideSearch emptyText="No hay ventas pendientes de facturar." />
          </QueryState>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Facturas emitidas</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            loading={loadingInvoices}
            error={invoicesError}
            loadingFallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}
          >
            <DataTable columns={invoiceColumns} data={invoices} searchPlaceholder="Buscar…" emptyText="Todavía no se emitió ninguna factura." />
          </QueryState>
        </CardContent>
      </Card>

      {/* TODO: ticket térmico 80mm para imprimir — requiere react-to-print (no instalado, no se agrega sin avisar). */}

      <Dialog open={!!saleFor} onOpenChange={(open) => !open && setSaleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir factura</DialogTitle>
          </DialogHeader>
          {saleFor && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendedor</span>
                  <span className="font-medium text-foreground">{saleFor.sellerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total venta</span>
                  <span className="font-semibold text-foreground">{formatCordobas(saleFor.total)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <select
                  className="input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Costo de envío (opcional, C$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Total factura: <span className="font-semibold text-foreground">{formatCordobas(saleFor.total + deliveryFee)}</span>
              </p>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSaleFor(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
        {creating && <Spinner className="mr-2" />}
        Emitir factura
      </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
