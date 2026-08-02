// El delivery pagado en TODAS las facturas del periodo, y por manos de quién.
//
// El número es la suma de `invoices.delivery_fee`, o sea LO QUE SE COBRÓ al
// cliente por el envío en la factura. En la práctica ese monto es el que
// termina yendo al repartidor, y es justo lo que el dueño quiere monitorear.
// Si algún día se le paga al repartidor algo distinto de lo cobrado, este
// reporte deja de servir como "gasto" y hay que registrar el pago aparte.
//
// Las facturas ANULADAS también cuentan: anular el papel no devuelve la plata
// del envío que ya salió. Se muestran aparte para que el total sea auditable.
import { AnimatedIcon } from '~/components/ui/animated-icons';
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
      <div className="mb-4 flex items-center gap-2 border-b pb-4">
        <AnimatedIcon icon={TruckIcon} size={20} strokeWidth={2} className="text-primary" />
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery pagado</p>
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

            {/* Las anuladas van dentro del total: decir cuánto pesan evita que
                el número parezca inflado cuando se cruza con facturación. */}
            {data.num_anuladas > 0 && (
              <p className="nums rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                Incluye {formatCordobas(data.total_anulado, 'C$', 2)} de{' '}
                {formatNumber(data.num_anuladas)}{' '}
                {data.num_anuladas === 1 ? 'factura anulada' : 'facturas anuladas'}.
              </p>
            )}

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
              Suma del envío de todas las facturas del periodo, anuladas incluidas.
            </p>
          </div>
        )}
      </QueryState>
    </SpotlightCard>
  );
}
