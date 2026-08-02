// Detalle de una venta, en drawer lateral.
//
// ── Por qué drawer y no modal ──
// El listado sigue visible detrás. Al revisar seis ventas pendientes una tras
// otra, un modal te saca del contexto en cada una y hay que volver a ubicarse;
// el drawer deja la fila a la vista.
//
// ── Por qué es ENLAZABLE (`?sale=<id>`) ──
// Es lo que permite que la campana de notificaciones apunte al registro exacto
// en vez de a la pestaña que lo contiene. Hasta ahora no se podía: no existía
// `GET /api/sales/:id`.
import { AnimatedIcon } from '~/components/ui/animated-icons';
import { CancelCircleIcon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';

import { Button } from '~/components/ui/button';
import { QueryState } from '~/components/ui/QueryState';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { StatusBadge } from '~/components/ui/StatusBadge';
import { formatCordobas } from '~/lib/formatters';
import { SALE_STATUS, statusMeta } from '~/lib/status';
import { useGetSaleQuery } from '~/store/api/salesApi';

export function SaleDetailDrawer({
  saleId,
  onClose,
  isAdmin,
  onApprove,
  onReject,
}: {
  saleId: string | null;
  onClose: () => void;
  isAdmin: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const { data: sale, isLoading, isError, refetch } = useGetSaleQuery(saleId!, { skip: !saleId });

  const meta = sale ? statusMeta(SALE_STATUS, sale.status) : null;
  const pending = sale?.status === 'pending_approval';

  return (
    <Sheet open={!!saleId} onOpenChange={(open) => !open && onClose()}>
      {/* `flex flex-col` + footer fijo: el cuerpo scrollea, las acciones
          primarias quedan siempre a la vista. Es lo que un modal con scroll
          interno no puede dar. */}
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            Venta
            {meta && <StatusBadge status={meta.status} label={meta.label} />}
          </SheetTitle>
          <SheetDescription>
            {sale
              ? `${sale.sellerName || sale.sellerEmail} · ${new Date(sale.createdAt).toLocaleDateString('es-NI')}`
              : 'Cargando…'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <QueryState
            loading={isLoading}
            error={isError}
            onRetry={refetch}
            errorMessage="No se pudo cargar el detalle de la venta."
            shape="list"
            shapeCount={4}
          >
            {sale && (
              <div className="space-y-5">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Cliente</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{sale.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Origen</dt>
                    <dd className="mt-0.5 font-medium capitalize text-foreground">{sale.saleOrigin}</dd>
                  </div>
                </dl>

                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Productos
                  </h3>
                  <div className="divide-y divide-border rounded-card border border-border">
                    {sale.items.map((it, i) => (
                      <div key={`${it.productName}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{it.productName}</p>
                          <p className="nums text-xs text-muted-foreground">
                            {it.quantity} × {formatCordobas(it.salePrice, 'C$', 2)}
                          </p>
                        </div>
                        <span className="nums shrink-0 font-medium text-foreground">
                          {formatCordobas(it.quantity * it.salePrice, 'C$', 2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Solo admin. El backend ya recorta estos campos para el
                    vendedor, así que acá vendrían undefined — pero no se
                    dibuja el bloque para no dejar un encabezado vacío. */}
                {isAdmin && sale.items.some((it) => it.gananciaTienda !== undefined) && (
                  <section>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Desglose financiero
                    </h3>
                    <dl className="space-y-1.5 rounded-card border border-border px-3 py-2.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Costo de mercadería</dt>
                        <dd className="nums">
                          {formatCordobas(
                            sale.items.reduce((s, it) => s + (it.costeFinalSnap ?? 0) * it.quantity, 0),
                            'C$',
                            2,
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Comisión del vendedor</dt>
                        <dd className="nums">
                          {formatCordobas(sale.items.reduce((s, it) => s + (it.comision ?? 0), 0), 'C$', 2)}
                        </dd>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1.5 font-medium">
                        <dt>Ganancia de la tienda</dt>
                        <dd className="nums">
                          {formatCordobas(sale.items.reduce((s, it) => s + (it.gananciaTienda ?? 0), 0), 'C$', 2)}
                        </dd>
                      </div>
                    </dl>
                  </section>
                )}
              </div>
            )}
          </QueryState>
        </div>

        <div className="shrink-0 border-t border-border px-5 py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="nums text-lg font-semibold text-foreground">
              {formatCordobas(sale?.total ?? 0, 'C$', 2)}
            </span>
          </div>

          {isAdmin && pending && sale && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onReject?.(sale.id);
                  onClose();
                }}
              >
                <AnimatedIcon icon={CancelCircleIcon} size={16} strokeWidth={2} className="mr-1.5 text-destructive" />
                Rechazar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onApprove?.(sale.id);
                  onClose();
                }}
              >
                <AnimatedIcon icon={CheckmarkCircle01Icon} size={16} strokeWidth={2} className="mr-1.5" />
                Aprobar
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
