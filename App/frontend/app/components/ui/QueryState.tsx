// Envuelve el patrón repetido loading/error/vacío de los listados admin
// (ventas, facturación, cuotas): cada estado define su propio fallback para
// no perder el diseño puntual de cada página (skeletons y vacíos distintos).
import type { ReactNode } from 'react';

interface QueryStateProps {
  loading: boolean;
  error?: boolean;
  empty?: boolean;
  loadingFallback: ReactNode;
  emptyFallback?: ReactNode;
  errorMessage?: string;
  children: ReactNode;
}

export function QueryState({
  loading,
  error,
  empty,
  loadingFallback,
  emptyFallback,
  errorMessage = 'No se pudo cargar la información.',
  children,
}: QueryStateProps) {
  if (loading) return <>{loadingFallback}</>;
  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-danger/30 bg-danger/5 py-10 text-center">
        <p className="font-medium text-danger">{errorMessage}</p>
      </div>
    );
  }
  if (empty && emptyFallback) return <>{emptyFallback}</>;
  return <>{children}</>;
}
