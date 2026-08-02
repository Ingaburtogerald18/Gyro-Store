import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle01Icon, DollarSquareIcon, DropletIcon, Package01Icon, PackageOpenIcon, PercentIcon, PieChartIcon, PlusSignSquareIcon, ShoppingCart02Icon, TruckIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { useState, useMemo, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
// SpotlightCard es nuestro (resplandor que sigue al cursor), distinto del `Card`
// de shadcn: por eso lleva nombre propio y no colisiona al importar.
import { SpotlightCard, StatCard } from '~/components/ui/stat-card';
import { QueryState } from '~/components/ui/QueryState';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/components/ui/chart';
import { Progress } from '~/components/ui/progress';
import { Pie, PieChart } from 'recharts';

import { NavLink } from '@remix-run/react';
import type { MetaFunction } from '@remix-run/node';
import { useGetKpisQuery } from '~/store/api/reportsApi';
import { useGetCuadreQuery } from '~/store/api/cuadreApi';
import { useGetAccountsQuery } from '~/store/api/cajaApi';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { formatCordobas } from '~/lib/formatters';
import { cn } from '~/lib/utils';

// Reportería de ventas. Vive en components/admin/reports/ porque el panel del
// vendedor en /admin/ventas reusa la tendencia y el top de productos.
import { PeriodPicker } from '~/components/admin/reports/PeriodPicker';
import { SalesTrendChart } from '~/components/admin/reports/SalesTrendChart';
import { SellerRanking } from '~/components/admin/reports/SellerRanking';
import { TopProductsTable } from '~/components/admin/reports/TopProductsTable';
import { SalesBreakdownCards } from '~/components/admin/reports/SalesBreakdownCards';
import { DeliveryCard } from '~/components/admin/reports/DeliveryCard';
import { ExportSalesCsvButton } from '~/components/admin/reports/ExportSalesCsvButton';
import { getPeriodRange, isPeriodReady, type CustomRange, type PeriodId } from '~/components/admin/reports/period';

export const meta: MetaFunction = () => {
  return [{ title: 'Dashboard | Gyro Store Admin' }];
};

// Los 7 pozos del doc 11, en el orden en que se reparte el Costo F/U.
const POZOS = [
  'publicidad',
  'mantenimiento',
  'utiles',
  'garantias',
  'prestamos',
  'suscripciones',
  'servicios',
] as const;

// Series del gráfico. Los colores salen de los tokens chart-*, así que siguen
// el tema (claro/oscuro) sin tocar nada acá.
const incomeChartConfig = {
  coste: { label: 'Coste', color: 'var(--color-chart-1)' },
  comision: { label: 'Comisiones', color: 'var(--color-chart-2)' },
  salary: { label: 'Salary', color: 'var(--color-chart-3)' },
  ganancia: { label: 'Ganancia tienda', color: 'var(--color-chart-4)' },
} satisfies ChartConfig;

// "Cuadre de hoy": los pendientes que hay que resolver antes de cerrar el día.
// Las salidas sin registrar y los deliveries sin liquidar salen en rojo y linkean
// a la vista filtrada; los saldos por cuenta cierran el panel del dueño.
function CuadreBanner() {
  const { data: cuadre } = useGetCuadreQuery();
  const { data: accounts = [] } = useGetAccountsQuery();

  if (!cuadre) return null;

  const nombreCuenta = (id: string) => accounts.find((a) => a.id === id)?.nombre ?? 'Cuenta';

  const alerts = [
    {
      label: 'Salidas sin registrar',
      count: cuadre.salidasPendientes,
      icon: PackageOpenIcon,
      to: '/admin/salidas?estado=pendiente_registro',
      hint: 'Salieron sin factura y ningún vendedor las registró',
    },
    {
      label: 'Deliveries por liquidar',
      count: cuadre.deliveriesPorLiquidar,
      icon: TruckIcon,
      to: '/admin/salidas?liquidacion=pendiente',
      hint: 'Entregados por delivery; falta confirmar el dinero',
    },
  ];

  return (
    <section className="mb-6 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cuadre de hoy</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {alerts.map((a) => {
          const pending = a.count > 0;
          return (
            <NavLink
              key={a.label}
              to={a.to}
              className={cn(
                'rounded-card border p-4 transition-colors',
                pending
                  ? 'border-destructive/30 bg-destructive/10 hover:bg-destructive/15'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HugeiconsIcon
                    icon={a.icon}
                    size={16}
                    strokeWidth={2}
                    className={cn(pending && 'text-destructive')}
                  />
                  {a.label}
                </span>
                {pending ? (
                  <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} className="text-destructive" />
                ) : (
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} strokeWidth={2} className="text-success" />
                )}
              </div>
              <p className={cn('nums mt-2 text-2xl font-bold', pending ? 'text-destructive' : 'text-foreground')}>
                {a.count}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{pending ? a.hint : 'Todo al día'}</p>
            </NavLink>
          );
        })}

        {cuadre.saldosCuentas.map((s) => (
          <div key={s.accountId} className="rounded-card border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={Wallet01Icon} size={16} strokeWidth={2} />
              {nombreCuenta(s.accountId)}
            </span>
            <p className="nums mt-2 text-2xl font-bold text-foreground">{formatCordobas(s.balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saldo actual</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const [range, setRange] = useState<PeriodId>('month');
  // Rango libre: solo se usa cuando `range === 'range'`, pero se conserva al
  // saltar entre presets para no perder lo que el usuario ya había elegido.
  const [custom, setCustom] = useState<CustomRange>({ from: '', to: '' });

  const queryParams = useMemo(() => getPeriodRange(range, custom), [range, custom]);
  // Con el rango libre a medio llenar no hay filtro que mandar: pedirlo igual
  // traería el histórico completo rotulado como "el periodo elegido".
  const periodReady = isPeriodReady(queryParams);

  // El Dashboard es de admin, pero la ruta /admin no lo bloquea por rol: si un
  // vendedor entra por URL, el backend ya le recorta los KPIs y acá se ocultan
  // las secciones que no le corresponden. La UI acompaña al backend, no lo suple.
  const isAdmin = useAppSelector(selectIsAdmin);

  const { data: kpis, isLoading, isError } = useGetKpisQuery(queryParams, { skip: !periodReady });

  const formatMoney = (n: number) => formatCordobas(n, 'C$', 2);

  // Las barras entran desde 0 en el primer frame tras montar, para que se vea
  // el llenado. Si el usuario pidió menos movimiento, van directo al valor.
  const reduce = useReducedMotion();
  const [barsReady, setBarsReady] = useState(false);
  useEffect(() => {
    if (reduce) {
      setBarsReady(true);
      return;
    }
    setBarsReady(false);
    const id = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(id);
  }, [reduce, kpis]);

  // A dónde va cada córdoba vendido. Se descartan los tramos en cero para que
  // el donut no dibuje segmentos invisibles.
  // `?? 0` porque el backend recorta estos campos cuando quien pregunta no es
  // admin (ver routes/reports.ts): sin el fallback el donut recibiría undefined.
  const incomeBreakdown = useMemo(
    () =>
      kpis
        ? [
            { key: 'coste', label: 'Coste', value: kpis.coste_total ?? 0, fill: 'var(--color-chart-1)' },
            { key: 'comision', label: 'Comisiones', value: kpis.comision_total, fill: 'var(--color-chart-2)' },
            { key: 'salary', label: 'Salary', value: kpis.salary_acumulado ?? 0, fill: 'var(--color-chart-3)' },
            { key: 'ganancia', label: 'Ganancia tienda', value: kpis.ganancia_tienda_total ?? 0, fill: 'var(--color-chart-4)' },
          ].filter((slice) => slice.value > 0)
        : [],
    [kpis],
  );

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Dashboard</h2>
          {isAdmin && (
            <p className="text-muted-foreground">Reportería de ventas del periodo elegido.</p>
          )}
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <PeriodPicker
            period={range}
            onPeriodChange={setRange}
            custom={custom}
            onCustomChange={setCustom}
            layoutId="dashboard-range"
          />
          {isAdmin && <ExportSalesCsvButton range={queryParams} />}
        </div>
      </div>

      <CuadreBanner />

      {!periodReady ? (
        <div className="rounded-card border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Elegí la fecha de inicio y la de fin para ver el reporte del periodo.
          </p>
        </div>
      ) : (
      <QueryState
        loading={isLoading}
        error={isError}
        empty={!kpis}
        loadingFallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="h-32 rounded-card bg-muted animate-pulse" />
            <div className="h-32 rounded-card bg-muted animate-pulse" />
            <div className="h-32 rounded-card bg-muted animate-pulse" />
            <div className="h-32 rounded-card bg-muted animate-pulse" />
          </div>
        }
      >
        {kpis && (
          <div className="space-y-6">
            <div className={cn('grid gap-4 md:grid-cols-2', isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-3')}>
              <StatCard
                icon={ShoppingCart02Icon}
                label="Ventas"
                countTo={kpis.total_ventas}
                sub={`${kpis.total_unidades} unidades`}
                color="indigo"
                delay={0}
              />
              <StatCard
                icon={DollarSquareIcon}
                label="Total Vendido"
                countTo={kpis.total_vendido}
                format={formatMoney}
                color="emerald"
                delay={0.05}
              />
              {isAdmin && (
                <StatCard
                  icon={Package01Icon}
                  label="Coste Total"
                  countTo={kpis.coste_total ?? 0}
                  format={formatMoney}
                  color="amber"
                  delay={0.1}
                />
              )}
              <StatCard
                icon={PercentIcon}
                label="Comisiones"
                countTo={kpis.comision_total}
                format={formatMoney}
                color="purple"
                delay={0.15}
              />
              {isAdmin && (
                <StatCard
                  icon={PlusSignSquareIcon}
                  label="Ganancia Tienda"
                  countTo={kpis.ganancia_tienda_total ?? 0}
                  format={formatMoney}
                  color="sky"
                  delay={0.2}
                />
              )}
            </div>

            {isAdmin && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <SpotlightCard variant="highlight" className="col-span-7 lg:col-span-4 p-5">
                <div className="mb-6 flex items-center gap-2 border-b border pb-4">
                  <HugeiconsIcon icon={DropletIcon} size={20} strokeWidth={2} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Recaudado por Pozo</h3>
                </div>
                
                <div className="space-y-4">
                  {POZOS.map((pozoKey) => {
                    const amount = kpis.pozos_recogidos?.[pozoKey] || 0;
                    const maxAmount = Math.max(...Object.values(kpis.pozos_recogidos || {}), 1);
                    const pct = (amount / maxAmount) * 100;

                    return (
                      <div key={pozoKey} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-foreground capitalize">{pozoKey}</span>
                          <span className="nums text-muted-foreground">{formatMoney(amount)}</span>
                        </div>
                        {/* Progress de shadcn: trae role="progressbar" y sus valores
                            ARIA, que la barra hecha a mano no tenía. Arranca en 0 y
                            sube al montar; con reduced-motion va directo al valor. */}
                        <Progress
                          value={barsReady ? pct : 0}
                          aria-label={`Recaudado en ${pozoKey}`}
                          className="h-2"
                        />
                      </div>
                    );
                  })}
                </div>
              </SpotlightCard>
              
              <SpotlightCard variant="default" className="col-span-7 lg:col-span-3 p-5">
                <div className="mb-4 flex items-center gap-2 border-b border pb-4">
                  <HugeiconsIcon icon={PieChartIcon} size={20} strokeWidth={2} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Composición del ingreso</h3>
                </div>

                <ChartContainer
                  config={incomeChartConfig}
                  className="mx-auto aspect-square max-h-[240px]"
                >
                  <PieChart>
                    <ChartTooltip
                      content={<ChartTooltipContent hideLabel nameKey="label" />}
                    />
                    <Pie
                      data={incomeBreakdown}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={55}
                      strokeWidth={4}
                    />
                  </PieChart>
                </ChartContainer>

                {/* Leyenda propia: más compacta que la de Recharts y con cifras. */}
                <ul className="mt-4 space-y-2">
                  {incomeBreakdown.map((slice) => (
                    <li key={slice.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: slice.fill }}
                        />
                        {slice.label}
                      </span>
                      <span className="nums font-medium text-foreground">{formatMoney(slice.value)}</span>
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            </div>
            )}

            {/* ── Reportería de ventas del periodo ──
                Todo lo de abajo es admin: son datos del negocio (márgenes de
                todos, ranking del equipo, delivery), no de una venta propia.
                El vendedor tiene su propio panel en /admin/ventas. */}
            {isAdmin && (
              <div className="space-y-6">
                <SalesTrendChart range={queryParams} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <SellerRanking range={queryParams} />
                  <TopProductsTable range={queryParams} />
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Desglose del periodo
                  </h3>
                  <SalesBreakdownCards range={queryParams} />
                </section>

                <DeliveryCard range={queryParams} />
              </div>
            )}
          </div>
        )}
      </QueryState>
      )}
    </>
  );
}
