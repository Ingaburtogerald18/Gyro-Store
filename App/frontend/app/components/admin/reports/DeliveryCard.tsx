// Cuánto dinero se movió en envíos y por manos de quién.
//
// El número es la suma de `invoices.delivery_fee`, o sea LO QUE SE COBRÓ al
// cliente por el envío en la factura. En la práctica ese monto es el que
// termina yendo al repartidor, y es justo lo que el dueño quiere monitorear.
// Si algún día se le paga al repartidor algo distinto de lo cobrado, este
// reporte deja de servir como "gasto" y hay que registrar el pago aparte.
import { HugeiconsIcon } from '@hugeicons/react';
import { TruckIcon } from '@hugeicons/core-free-icons';

import { SpotlightCard } from '~/components/ui/stat-card';
import { QueryState } from '~/components/ui/QueryState';
import { Progress } from '~/components/ui/progress';
import { formatCordobas, formatNumber } from '~/lib/formatters';
import { useGetDeliverySummaryQuery } from '~/store/api/reportsApi';
import type { PeriodRange } from './period';

export function DeliveryCard({ range }: { range: PeriodRange }) {
  const { data, isLoading, isError } = useGetDeliverySummaryQuery(range);

  const max = Math.max(...(data?.by_repartidor.map((r) => r.total) ?? [0]), 1);
  const promedio =
    data && data.num_deliveries > 0 ? data.total_delivery / data.num_deliveries : 0;

  return (
    <SpotlightCard variant="highlight" className="p-5">
      <div className="mb-4 flex items-center gap-2 border-b border pb-4">
        <HugeiconsIcon icon={TruckIcon} size={20} strokeWidth={2} className="text-primary" />
        <h3 className="font-semibold text-foreground">Delivery</h3>
      </div>

      <QueryState
        loading={isLoading}
        error={isError}
        empty={!data}
        loadingFallback={<div className="h-48 animate-pulse rounded-card bg-muted" />}
      >
        {data && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total en envíos</p>
                <p className="nums mt-1 text-2xl font-bold text-foreground">
                  {formatCordobas(data.total_delivery, 'C$', 2)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Entregas</p>
                <p className="nums mt-1 text-2xl font-bold text-foreground">
                  {formatNumber(data.num_deliveries)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Promedio</p>
                <p className="nums mt-1 text-2xl font-bold text-foreground">
                  {formatCordobas(promedio, 'C$', 2)}
                </p>
              </div>
            </div>

            {data.by_repartidor.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hubo envíos en este periodo.
              </p>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Por repartidor
                </h4>
                {data.by_repartidor.map((r) => (
                  <div key={r.repartidor} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">{r.repartidor}</span>
                      <span className="nums text-muted-foreground">
                        {formatCordobas(r.total, 'C$', 2)}
                      </span>
                    </div>
                    <Progress value={(r.total / max) * 100} aria-label={r.repartidor} className="h-1.5" />
                    <span className="nums text-xs text-muted-foreground">
                      {formatNumber(r.count)} {r.count === 1 ? 'entrega' : 'entregas'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Suma de lo cobrado por envío en las facturas del periodo (las anuladas no cuentan).
            </p>
          </div>
        )}
      </QueryState>
    </SpotlightCard>
  );
}
