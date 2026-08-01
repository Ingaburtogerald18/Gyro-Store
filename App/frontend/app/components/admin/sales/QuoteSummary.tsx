// Desglose de la cotización en vivo. Portado de `QuoteSummary` de v1, pero
// reconstruido sobre el shape de v2: allá el servidor devolvía totales planos
// (`saleTotal`, `costReal`, `costosFijos`…) más un `linesFinancials`; acá
// `QuoteResult` trae `lines[]` con el desglose POR LÍNEA y tres totales.
//
// Doble capa para el desglose financiero: el backend ya recorta los campos de
// costo según el rol, así que acá NO se decide quién ve qué — simplemente, si
// un campo viene `undefined`, esa fila no se renderiza. Un vendedor nunca ve
// costo real, utilidad ni ganancia de tienda porque no le llegan.
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, ArrowDown01Icon, Invoice01Icon, Wallet01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';

import { Spinner } from '~/components/ui/spinner';
import { formatCordobas } from '~/lib/formatters';
import { cn } from '~/lib/utils';
import type { QuoteLine, QuoteResult } from '~/store/api/salesApi';

export function QuoteSummary({
  result,
  loading,
  errorMsg,
}: {
  result: QuoteResult | null;
  loading: boolean;
  errorMsg?: string;
}) {
  return (
    <section className="rounded-card border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <HugeiconsIcon icon={Invoice01Icon} size={16} strokeWidth={2} className="text-primary-2" aria-hidden />
        <h3 className="font-semibold text-foreground">Resumen</h3>
        {loading && <Spinner className="ml-auto" aria-label="Cotizando…" />}
      </header>

      {errorMsg ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {errorMsg}
        </p>
      ) : !result ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <HugeiconsIcon icon={Wallet01Icon} size={32} strokeWidth={2} className="text-muted-foreground opacity-40" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Agregá producto, cantidad y precio para ver la estimación.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Importe total */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <span className="text-xs text-muted-foreground">Importe total</span>
            <span className="nums block font-heading text-3xl font-bold text-primary-2">
              {formatCordobas(result.total)}
            </span>
          </div>

          {/* Comisión: para el vendedor es SU dato principal, así que va
              destacada arriba del desglose (que puede ni existir para él). */}
          <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 p-3">
            <span className="text-sm font-medium text-foreground">Comisión estimada</span>
            <span className="nums text-xl font-bold text-primary-2">
              {formatCordobas(result.totalComision)}
            </span>
          </div>

          {result.lines.map((line) => (
            <LineBreakdown key={line.productName} line={line} />
          ))}

          {/* Totales de la venta: solo aportan cuando hay más de un producto. */}
          {result.lines.length > 1 && (
            <div className="space-y-1 rounded-lg border-2 border-primary/20 bg-primary/5 p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary-2">
                Totales de la venta
              </span>
              <dl className="nums divide-y divide-border/60 text-sm">
                <Row label="Comisión total" value={formatCordobas(result.totalComision)} />
                {result.totalGananciaTienda !== undefined && (
                  <Row label="Ganancia tienda total" value={formatCordobas(result.totalGananciaTienda)} strong />
                )}
                <Row label="Importe total" value={formatCordobas(result.total)} strong />
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Desglose de una línea. El detalle arranca colapsado cuando hay varias líneas
// para que el resumen quepa de un vistazo; se despliega con el encabezado.
function LineBreakdown({ line }: { line: QuoteLine }) {
  const [expanded, setExpanded] = useState(true);
  const importe = line.precioUnit * line.quantity;

  // Solo el admin recibe estos campos; para el vendedor vienen `undefined` y
  // el bloque entero desaparece.
  const hasFinancials =
    line.costeFinalSnap !== undefined ||
    line.utilidadBruta !== undefined ||
    line.gananciaTienda !== undefined;

  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-accent motion-reduce:transition-none"
      >
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-foreground">
            {line.productName}
          </span>
          <span className="nums block text-[11px] text-muted-foreground">
            {line.quantity} × {formatCordobas(line.precioUnit)} = {formatCordobas(importe)}
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          strokeWidth={2}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t px-3 py-2">
          {/* Avisos que bloquean el registro */}
          {line.insufficientStock && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <HugeiconsIcon icon={Alert02Icon} size={13} strokeWidth={2} className="shrink-0" aria-hidden />
              Stock insuficiente — disponible: {line.available}.
            </p>
          )}
          {line.belowMinMargin && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <HugeiconsIcon icon={Alert02Icon} size={13} strokeWidth={2} className="shrink-0" aria-hidden />
              El precio queda por debajo del margen mínimo.
            </p>
          )}
          {line.wholesale.discountPercent > 0 && (
            <p className="text-xs text-muted-foreground">
              Mayoreo aplicado:{' '}
              <span className="nums font-semibold text-primary-2">
                −{Math.round(line.wholesale.discountPercent * 100)}%
              </span>
            </p>
          )}
          {line.wholesale.warning && (
            <p className="text-xs font-medium text-warning">
              Conviene cotizar aparte para conseguir un mejor descuento.
            </p>
          )}

          <dl className="nums divide-y divide-border/40 text-xs">
            {line.costeFinalSnap !== undefined && (
              <Row label="Costo real" value={formatCordobas(line.costeFinalSnap)} muted small />
            )}
            {line.utilidadBruta !== undefined && (
              <Row label="Utilidad bruta" value={formatCordobas(line.utilidadBruta)} sub small />
            )}
            {line.salary !== undefined && (
              <Row label="Fondo de empresa" value={`−${formatCordobas(line.salary)}`} muted small />
            )}
            {line.utilidadNeta !== undefined && (
              <Row label="Utilidad neta" value={formatCordobas(line.utilidadNeta)} sub small />
            )}
            <Row
              label={`Comisión vendedor (${Math.round(line.comisionPercent * 100)}%)`}
              value={formatCordobas(line.comision)}
              small
            />
            {line.gananciaTienda !== undefined && (
              <Row label="Ganancia tienda" value={formatCordobas(line.gananciaTienda)} strong small />
            )}
          </dl>

          {!hasFinancials && (
            <p className="text-[11px] text-muted-foreground">
              El desglose de costos solo lo ve un administrador.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  sub,
  strong,
  small,
}: {
  label: string;
  value: string;
  muted?: boolean;
  sub?: boolean;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        sub ? 'py-0.5 pl-4' : small ? 'py-0.5' : 'py-1.5',
        small && 'text-[11px]',
      )}
    >
      <dt className={cn(strong ? 'font-semibold text-foreground' : muted || sub ? 'text-muted-foreground' : 'font-medium text-foreground')}>
        {label}
      </dt>
      <dd className={cn('font-semibold', strong ? 'text-primary-2' : muted || sub ? 'text-muted-foreground' : 'text-foreground')}>
        {value}
      </dd>
    </div>
  );
}
