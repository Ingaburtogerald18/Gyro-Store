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
import { CancelCircleIcon, CheckmarkCircle01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '@remix-run/react';
import type { MetaFunction } from '@remix-run/node';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import React from 'react';

import { AnimatedCheck } from '~/components/ui/animated-icons';


import { PageHeader } from '~/components/layout/PageHeader';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DataTable } from '~/components/ui/DataTable';
import { QueryState } from '~/components/ui/QueryState';
import { SkeletonCard } from '~/components/ui/skeletons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { StatusBadge } from '~/components/ui/StatusBadge';
import { SALE_STATUS, statusMeta } from '~/lib/status';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
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
// `SaleEditor` son 22 KB que hoy se descargaban al abrir Ventas aunque nadie
// registrara nada. Con `lazy` el chunk viaja recién al abrir el diálogo — y
// para entonces el usuario ya decidió esperar.
const SaleEditor = lazy(() =>
  import('~/components/admin/sales/SaleEditor').then((m) => ({ default: m.SaleEditor })),
);
import { SellerPerformance } from '~/components/admin/sales/SellerPerformance';
import { SaleDetailDrawer } from '~/components/admin/sales/SaleDetailDrawer';

export const meta: MetaFunction = () => [{ title: 'Ventas | Gyro Store Admin' }];

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

  // `?nueva=1` abre el editor. Es lo que permite que "Registrar venta" de la
  // paleta funcione desde cualquier módulo sin subir el estado del diálogo a un
  // store global: la acción navega acá y la ruta interpreta el parámetro.
  // Efecto secundario útil: la acción queda enlazable desde una notificación o
  // un mensaje.
  useEffect(() => {
    if (searchParams.get('nueva') === '1') {
      setIsEditorOpen(true);
      // Se consume el parámetro para que cerrar el diálogo y recargar no lo
      // vuelva a abrir.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('nueva');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  // `?sale=<id>` abre el detalle. Vive en la URL, no en estado local, para que
  // una notificación pueda enlazar al REGISTRO exacto y no solo a la pestaña
  // que lo contiene.
  const openSaleId = searchParams.get('sale');
  const openSale = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('sale', id);
        else next.delete('sale');
        return next;
      },
      { replace: true },
    );

  function setStatusFilter(next: string) {
    // `replace` para no llenar el historial con cada cambio de pestaña: volver
    // atrás debería salir de Ventas, no recorrer los filtros que se probaron.
    setSearchParams(next === 'pending_approval' ? {} : { status: next }, { replace: true });
  }

  const {
    data: sales = [],
    isLoading: loadingSales,
    isFetching: fetchingSales,
    isError: salesError,
    refetch: refetchSales,
  } = useGetSalesQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const [rejectFor, setRejectFor] = useState<SaleListItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // `useCallback` para poder incluirlo en las dependencias del `useMemo` de
  // columnas. Antes se silenciaba la regla con un `eslint-disable`: la función
  // se recreaba en cada render, así que incluirla habría reconstruido todas las
  // columnas siempre. Silenciar la regla no arreglaba nada — solo escondía que
  // las columnas capturaban una versión vieja de la función.
  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await approveSale(id).unwrap();
        toast.success('Venta aprobada.', {
          icon: React.createElement(AnimatedCheck, { size: 18, autoPlay: true }),
        });
      } catch (err) {
        toast.error(errMsg(err, 'No se pudo aprobar la venta.'));
      }
    },
    [approveSale],
  );

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
      // `stopPropagation` en los dos: la fila ahora abre el drawer de detalle,
      // así que sin esto aprobar una venta además abriría el panel de la venta
      // que se acaba de aprobar.
      cell: ({ row }) =>
        row.original.status === 'pending_approval' ? (
          <div className="flex justify-end gap-1.5">
            {/* Aprobar / rechazar solo admin. */}
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Aprobar venta"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApprove(row.original.id);
                  }}
                >
                  <AnimatedIcon icon={CheckmarkCircle01Icon} size={16} strokeWidth={2} className="text-success" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Rechazar venta"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejectFor(row.original);
                  }}
                >
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
          const meta = statusMeta(SALE_STATUS, row.original.status);
          return <StatusBadge status={meta.status} label={meta.label} />;
        },
      },
      actionsColumn,
    ];
  }, [isAdmin, handleApprove]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Ventas"
        description="Listado general y registro de ventas."
        actions={
          <Button onClick={() => setIsEditorOpen(true)}>
            <AnimatedIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-2" />
            Registrar Venta
          </Button>
        }
      />

      {/* Drawer y no modal. Un `Dialog` de 5xl con scroll interno es el peor
          contenedor para un formulario largo: se pierde el listado de
          referencia y el scroll de adentro pelea con el de la página. Acá el
          header queda fijo, el cuerpo scrollea solo, y las ventas pendientes se
          siguen viendo detrás. */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14">
            <DialogTitle>Registrar venta</DialogTitle>
            <DialogDescription>
              El stock se reserva al registrar y se descuenta al aprobar.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* El fallback tiene la ALTURA aproximada del editor: con un spinner
                chico el panel se abriría casi vacío y saltaría al llegar el
                chunk. */}
            <Suspense fallback={<SkeletonCard lines={8} className="border-none" />}>
              <SaleEditor onDone={() => setIsEditorOpen(false)} />
            </Suspense>
          </div>
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

        {/* Sin `<Card>` envolvente: `DataTable` ya trae su borde y su fondo, así
            que envolverla daba doble borde y una sombra de más sobre el
            contenido más importante de la pantalla. La tabla va directo en el
            flujo, a ancho completo. */}
        {/* `isLoading` (primera vez) → esqueleto; `isFetching` (refetch)
            → los datos que ya estaban, atenuados. Cambiar de pestaña no
            debería vaciar la tabla. */}
        <QueryState
          loading={loadingSales}
          fetching={fetchingSales}
          error={salesError}
          onRetry={refetchSales}
          shape="table"
          shapeCount={6}
        >
          <DataTable
            tableId="ventas"
            columns={columns}
            data={sales}
            searchPlaceholder="Buscar por vendedor…"
            exportFilename="ventas"
            emptyText="No hay ventas en este estado."
            onRowClick={(row) => openSale(row.id)}
          />
        </QueryState>
      </div>

      <SaleDetailDrawer
        saleId={openSaleId}
        onClose={() => openSale(null)}
        isAdmin={isAdmin}
        onApprove={handleApprove}
        onReject={(id) => {
          const sale = sales.find((s) => s.id === id);
          if (sale) setRejectFor(sale);
        }}
      />

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
