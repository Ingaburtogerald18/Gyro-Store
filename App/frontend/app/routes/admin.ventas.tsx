// Portal de Ventas (doc 09 ítem 65): cotizador + registro + aprobar/rechazar
// (admin) + listado scoped por rol (lo scopea el backend, no el frontend).
//
// Esta ruta es solo el SHELL: monta el editor y el listado. El armado de la
// venta vive en `components/admin/sales/` (SaleEditor + SaleLinesTable +
// QuoteSummary), como en v1.
//
// Reciclaje de v1 (admin.ventas.tsx + AdminSales.tsx): se recicla la idea de
// "un shell, admin y vendedor ven lo mismo, el rol decide qué botones
// aparecen". Se reescribe todo lo demás: v1 resolvía productos nativos+migrados
// con foto de recibo y admin-en-nombre-de un vendedor — el backend v2 (MVP
// Hito 3) solo tiene inventario nativo, sin fotos, y cada vendedor registra su
// propia venta (ver server/services/sales.ts). Un producto no puede repetirse
// en dos líneas (mismo límite del backend, evita la lógica de "distribuir
// reservas" de v1).
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, CheckmarkCircle01Icon, Link02Icon, ShoppingCart02Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from 'react';
import { useSearchParams } from '@remix-run/react';
import type { MetaFunction } from '@remix-run/node';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';


import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DataTable } from '~/components/ui/DataTable';
import { QueryState } from '~/components/ui/QueryState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { StatusBadge, type BadgeStatus } from '~/components/ui/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { errMsg, formatCordobas } from "~/lib/formatters";
import {
  useApproveSaleMutation,
  useGetSalesQuery,
  useRejectSaleMutation,
  type SaleListItem,
} from '~/store/api/salesApi';
import { useGetSalidasQuery, useVincularSalidaMutation } from '~/store/api/salidasApi';
import { Spinner } from "~/components/ui/spinner";
import { SaleEditor } from '~/components/admin/sales/SaleEditor';

export const meta: MetaFunction = () => [{ title: 'Ventas | Gyro Store Admin' }];

const STATUS_META: Record<string, { label: string; status: BadgeStatus }> = {
  pending_approval: { label: 'Pendiente', status: 'pending' },
  approved: { label: 'Aprobada', status: 'success' },
  paid: { label: 'Pagada', status: 'success' },
  rejected: { label: 'Rechazada', status: 'error' },
};

const STATUS_TABS = [
  { value: 'pending_approval', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
];

export default function AdminVentas() {
  const isAdmin = useAppSelector(selectIsAdmin);

  const [approveSale] = useApproveSaleMutation();
  const [rejectSale, { isLoading: rejecting }] = useRejectSaleMutation();

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // El filtro vive en la URL para que la campana de notificaciones pueda
  // enlazar directo al estado que anuncia ("3 ventas esperan tu aprobación").
  // Con estado local a secas el enlace llegaba a la pestaña equivocada.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') ?? 'pending_approval';

  function setStatusFilter(next: string) {
    // `replace` para no llenar el historial con cada cambio de pestaña: volver
    // atrás debería salir de Ventas, no recorrer los filtros que se probaron.
    setSearchParams(next === 'pending_approval' ? {} : { status: next }, { replace: true });
  }

  const {
    data: sales = [],
    isLoading: loadingSales,
    isError: salesError,
  } = useGetSalesQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const [rejectFor, setRejectFor] = useState<SaleListItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Vincular una salida SIN factura a esta venta (cierra el "pendiente de registrar").
  const [linkFor, setLinkFor] = useState<SaleListItem | null>(null);
  const { data: pendingSalidas = [] } = useGetSalidasQuery({ estado: 'pendiente_registro' });
  const [vincularSalida, { isLoading: linking }] = useVincularSalidaMutation();

  async function handleApprove(id: string) {
    try {
      await approveSale(id).unwrap();
      toast.success('Venta aprobada.');
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo aprobar la venta.'));
    }
  }

  async function handleReject() {
    if (!rejectFor || !rejectReason.trim()) {
      toast.error('El motivo de rechazo es obligatorio.');
      return;
    }
    try {
      await rejectSale({ id: rejectFor.id, reason: rejectReason.trim() }).unwrap();
      toast.success('Venta rechazada.');
      setRejectFor(null);
      setRejectReason('');
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo rechazar la venta.'));
    }
  }

  async function handleLink(salidaId: string) {
    if (!linkFor) return;
    try {
      await vincularSalida({ id: salidaId, orderId: linkFor.id }).unwrap();
      toast.success('Salida vinculada a la venta.');
      setLinkFor(null);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo vincular la salida.'));
    }
  }

  const columns = useMemo<ColumnDef<SaleListItem, unknown>[]>(() => {
    const actionsColumn: ColumnDef<SaleListItem, unknown> = {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'pending_approval' ? (
          <div className="flex justify-end gap-1.5">
            {/* Vincular salida: disponible para todos (el vendedor cierra la suya). */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLinkFor(row.original)}
              title="Vincular una salida sin factura"
            >
              <HugeiconsIcon icon={Link02Icon} size={16} strokeWidth={2} aria-hidden />
            </Button>
            {/* Aprobar / rechazar solo admin. */}
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" onClick={() => handleApprove(row.original.id)}>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} strokeWidth={2} className="text-success" aria-hidden />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejectFor(row.original)}>
                  <HugeiconsIcon icon={CancelCircleIcon} size={16} strokeWidth={2} className="text-destructive" aria-hidden />
                </Button>
              </>
            )}
          </div>
        ) : null,
    };

    return [
      {
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('es-NI'),
      },
      { accessorKey: 'sellerEmail', header: 'Vendedor' },
      { accessorKey: 'phone', header: 'Teléfono', cell: ({ row }) => row.original.phone ?? '—' },
      {
        accessorKey: 'total',
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => <div className="text-right font-semibold">{formatCordobas(row.original.total)}</div>,
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const meta = STATUS_META[row.original.status] ?? { label: row.original.status, status: 'neutral' as const };
          return <StatusBadge status={meta.status} label={meta.label} />;
        },
      },
      actionsColumn,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Ventas</h2>
          <p className="text-muted-foreground">Listado general y registro de ventas.</p>
        </div>
        <Button onClick={() => setIsEditorOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-2" />
          Registrar Venta
        </Button>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
          </DialogHeader>
          <SaleEditor onDone={() => setIsEditorOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-muted border border">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card className="bg-card border shadow-sm">
          <CardContent className="pt-6">
            <QueryState
              loading={loadingSales}
              error={salesError}
              loadingFallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}
            >
              <DataTable columns={columns} data={sales} searchPlaceholder="Buscar por teléfono…" emptyText="No hay ventas en este estado." />
            </QueryState>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(open) => !open && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo (obligatorio)</Label>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="¿Por qué se rechaza?" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectFor(null)}>
              Cancelar
            </Button>
            <Button onClick={handleReject} disabled={rejecting} className="bg-destructive/90">
        {rejecting && <Spinner className="mr-2" />}
        Rechazar
      </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkFor} onOpenChange={(open) => !open && setLinkFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular salida sin factura</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Elegí la salida que corresponde a esta venta. Solo aparecen las que salieron
            sin factura y siguen pendientes de registrar.
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {pendingSalidas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay salidas pendientes de registrar.
              </p>
            ) : (
              pendingSalidas.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleLink(s.id)}
                  disabled={linking}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{s.articulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.destino === 'delivery' ? 'Delivery' : 'Mostrador'} ·{' '}
                      {new Date(s.salio_at).toLocaleDateString('es-NI')}
                    </span>
                  </span>
                  <HugeiconsIcon icon={Link02Icon} size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
