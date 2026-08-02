// Ranking del equipo de ventas. Solo admin: el endpoint responde 403 a
// cualquier otro rol, así que este componente nunca debe montarse fuera de ahí.
import { HugeiconsIcon } from '@hugeicons/react';
import { Award01Icon } from '@hugeicons/core-free-icons';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { SpotlightCard } from '~/components/ui/stat-card';
import { DataTable } from '~/components/ui/DataTable';
import { QueryState } from '~/components/ui/QueryState';
import { formatCordobas, formatNumber } from '~/lib/formatters';
import { useGetSellerPerformanceQuery, type SellerPerformanceRow } from '~/store/api/reportsApi';
import type { PeriodRange } from './period';

export function SellerRanking({ range }: { range: PeriodRange }) {
  const { data = [], isLoading, isError } = useGetSellerPerformanceQuery(range);

  const columns = useMemo<ColumnDef<SellerPerformanceRow, unknown>[]>(
    () => [
      {
        id: 'vendedor',
        header: 'Vendedor',
        // El nombre registrado en el sistema es lo que se lee; el correo queda
        // de respaldo para las cuentas que nunca completaron el perfil.
        accessorFn: (row) => row.seller_name || row.seller_email || 'Sin vendedor',
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.seller_name || row.original.seller_email || 'Sin vendedor'}
          </span>
        ),
      },
      {
        accessorKey: 'num_ventas',
        header: 'Ventas',
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(row.original.num_ventas),
      },
      {
        accessorKey: 'unidades',
        header: 'Unidades',
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(row.original.unidades),
      },
      {
        accessorKey: 'total_vendido',
        header: 'Vendido',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="font-semibold">{formatCordobas(row.original.total_vendido, 'C$', 2)}</span>
        ),
      },
      {
        accessorKey: 'comision',
        header: 'Comisión',
        meta: { align: 'right' },
        cell: ({ row }) => formatCordobas(row.original.comision, 'C$', 2),
      },
    ],
    [],
  );

  return (
    <SpotlightCard variant="default" className="p-5">
      <div className="mb-4 flex items-center gap-2 border-b border pb-4">
        <HugeiconsIcon icon={Award01Icon} size={20} strokeWidth={2} className="text-primary" />
        <h3 className="font-semibold text-foreground">Ranking de vendedores</h3>
      </div>

      <QueryState
        loading={isLoading}
        error={isError}
        loadingFallback={<div className="h-48 animate-pulse rounded-card bg-muted" />}
      >
        <DataTable
          columns={columns}
          data={data}
          hideSearch
          emptyText="No hay ventas de nadie en este periodo."
        />
      </QueryState>
    </SpotlightCard>
  );
}
