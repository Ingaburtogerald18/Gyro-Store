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
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { CancelCircleIcon, CheckmarkCircle01Icon, ShoppingCart02Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from 'react';
import { useSearchParams } from '@remix-run/react';
import type { MetaFunction } from '@remix-run/node';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import React from 'react';

import { AnimatedCheck } from '~/components/ui/animated-icons';


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
import { Spinner } from "~/components/ui/spinner";
import { SaleEditor } from '~/components/admin/sales/SaleEditor';
import { SellerPerformance } from '~/components/admin/sales/SellerPerformance';

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

  async function handleApprove(id: string) {
    try {
      await approveSale(id).unwrap();
      toast.success('Venta aprobada.', {
        icon: React.createElement(AnimatedCheck, { size: 18, autoPlay: true }),
      });
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


  const columns = useMemo<ColumnDef<SaleListItem, unknown>[]>(() => {
    const actionsColumn: ColumnDef<SaleListItem, unknown> = {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'pending_approval' ? (
          <div className="flex justify-end gap-1.5">
            {/* Aprobar / rechazar solo admin. */}
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" onClick={() => handleApprove(row.original.id)}>
                  <AnimatedIcon icon={CheckmarkCircle01Icon} size={16} strokeWidth={2} className="text-success" aria-hidden />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejectFor(row.original)}>
                  <AnimatedIcon icon={CancelCircleIcon} size={16} strokeWidth={2} className="text-destructive" aria-hidden />
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
      {
        id: 'vendedor',
        header: 'Vendedor',
        // `accessorFn` y no `accessorKey`: el filtro global de la tabla busca
        // sobre el VALOR de la celda, así que el nombre tiene que ser el valor
        // para que "buscar por vendedor" funcione. El correo queda de respaldo
        // para las cuentas que nunca completaron el perfil.
        accessorFn: (row) => row.sellerName || row.sellerEmail,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.sellerName || row.original.sellerEmail}
          </span>
        ),
      },
      { accessorKey: 'phone', header: 'Teléfono', cell: ({ row }) => row.original.phone ?? '—' },
      {
        accessorKey: 'total',
        header: 'Total',
        // `meta.align` en vez de un <div className="text-right"> dentro del
        // header: DataTable envuelve el header en un flex propio, así que el div
        // no se estiraba y el título quedaba a la izquierda mientras la cifra se
        // iba a la derecha. Con `meta` alinea los dos.
        meta: { align: 'right' },
        cell: ({ row }) => <span className="font-semibold">{formatCordobas(row.original.total)}</span>,
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
          <AnimatedIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-2" />
          Registrar Venta
        </Button>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
          </DialogHeader>
          <SaleEditor onDone={() => setIsEditorOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* El vendedor no tiene Dashboard en su nav, así que su reportería propia
          vive acá. Al admin no se le muestra: ya la tiene completa (y de todo
          el equipo) en /admin. */}
      {!isAdmin && <SellerPerformance />}

      <div className="space-y-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-muted border">
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
              <DataTable columns={columns} data={sales} searchPlaceholder="Buscar por vendedor…" emptyText="No hay ventas en este estado." />
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

    </div>
  );
}
