// Envuelve el patrón repetido loading/error/vacío de los listados admin
// (ventas, facturación, cuotas, caja, salidas). Cada estado puede definir su
// propio fallback para no perder el diseño puntual de cada página; si no lo
// define, cae en uno genérico.
import type { ReactNode } from 'react';

import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';

interface QueryStateProps {
  loading: boolean;
  error?: boolean;
  empty?: boolean;
  /** Placeholder de carga propio. Sin esto se usa un skeleton genérico. */
  loadingFallback?: ReactNode;
  emptyFallback?: ReactNode;
  errorMessage?: string;
  /** Si se pasa, el estado de error ofrece un botón para reintentar. */
  onRetry?: () => void;
  children: ReactNode;
}

export function QueryState({
  loading,
  error,
  empty,
  loadingFallback,
  emptyFallback,
  errorMessage = 'No se pudo cargar la información.',
  onRetry,
  children,
}: QueryStateProps) {
  if (loading) return <>{loadingFallback ?? <Skeleton className="h-48 w-full rounded-lg" />}</>;

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="font-medium text-destructive">{errorMessage}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  if (empty && emptyFallback) return <>{emptyFallback}</>;
  return <>{children}</>;
}
