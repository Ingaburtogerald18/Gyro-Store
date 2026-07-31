import { useState, useMemo, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
// SpotlightCard es nuestro (resplandor que sigue al cursor), distinto del `Card`
// de shadcn: por eso lleva nombre propio y no colisiona al importar.
import { SpotlightCard, StatCard } from '~/components/ui/stat-card';
import { AnimatedTabs } from '~/components/ui/AnimatedTabs';
import { QueryState } from '~/components/ui/QueryState';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/components/ui/chart';
import { Progress } from '~/components/ui/progress';
import { Pie, PieChart } from 'recharts';
import { DollarSign, ShoppingCart, Package, Percent, PlusSquare, Droplets, PieChart as PieIcon, PackageOpen, Truck, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { NavLink } from '@remix-run/react';
import type { MetaFunction } from '@remix-run/node';
import { useGetKpisQuery } from '~/store/api/reportsApi';
import { useGetCuadreQuery } from '~/store/api/cuadreApi';
import { useGetAccountsQuery } from '~/store/api/cajaApi';
import { formatCordobas } from '~/lib/formatters';
import { cn } from '~/lib/utils';

export const meta: MetaFunction = () => {
  return [{ title: 'Dashboard | Gyro Store Admin' }];
};

// Date math helper (simple)
function getDateRange(range: string) {
  const end = new Date();
  const start = new Date();
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === '7d') {
    start.setDate(start.getDate() - 7);
  } else if (range === '30d') {
    start.setDate(start.getDate() - 30);
  } else if (range === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    return {};
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

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
      icon: PackageOpen,
      to: '/admin/salidas?estado=pendiente_registro',
      hint: 'Salieron sin factura y ningún vendedor las registró',
    },
    {
      label: 'Deliveries por liquidar',
      count: cuadre.deliveriesPorLiquidar,
      icon: Truck,
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
                  <a.icon className={cn('size-4', pending && 'text-destructive')} />
                  {a.label}
                </span>
                {pending ? (
                  <AlertTriangle className="size-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="size-4 text-success" />
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
              <Wallet className="size-4" />
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
  const [range, setRange] = useState('month');
  
  const queryParams = useMemo(() => getDateRange(range), [range]);
  
  const { data: kpis, isLoading, isError } = useGetKpisQuery(queryParams);

  const formatMoney = (n: number) => `C$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const tabs = [
    { id: 'today', label: 'Hoy' },
    { id: '7d', label: '7 Días' },
    { id: '30d', label: '30 Días' },
    { id: 'month', label: 'Este Mes' },
  ];

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
  const incomeBreakdown = useMemo(
    () =>
      kpis
        ? [
            { key: 'coste', label: 'Coste', value: kpis.coste_total, fill: 'var(--color-chart-1)' },
            { key: 'comision', label: 'Comisiones', value: kpis.comision_total, fill: 'var(--color-chart-2)' },
            { key: 'salary', label: 'Salary', value: kpis.salary_acumulado, fill: 'var(--color-chart-3)' },
            { key: 'ganancia', label: 'Ganancia tienda', value: kpis.ganancia_tienda_total, fill: 'var(--color-chart-4)' },
          ].filter((slice) => slice.value > 0)
        : [],
    [kpis],
  );

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Dashboard</h2>
        <AnimatedTabs
          items={tabs}
          value={range}
          onChange={setRange}
          layoutId="dashboard-range"
        />
      </div>

      <CuadreBanner />

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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <StatCard
                icon={ShoppingCart}
                label="Ventas"
                countTo={kpis.total_ventas}
                sub={`${kpis.total_unidades} unidades`}
                color="indigo"
                delay={0}
              />
              <StatCard
                icon={DollarSign}
                label="Total Vendido"
                countTo={kpis.total_vendido}
                format={formatMoney}
                color="emerald"
                delay={0.05}
              />
              <StatCard
                icon={Package}
                label="Coste Total"
                countTo={kpis.coste_total}
                format={formatMoney}
                color="amber"
                delay={0.1}
              />
              <StatCard
                icon={Percent}
                label="Comisiones"
                countTo={kpis.comision_total}
                format={formatMoney}
                color="purple"
                delay={0.15}
              />
              <StatCard
                icon={PlusSquare}
                label="Ganancia Tienda"
                countTo={kpis.ganancia_tienda_total}
                format={formatMoney}
                color="sky"
                delay={0.2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <SpotlightCard variant="highlight" className="col-span-7 lg:col-span-4 p-5">
                <div className="mb-6 flex items-center gap-2 border-b border pb-4">
                  <Droplets className="h-5 w-5 text-primary" />
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
                  <PieIcon className="h-5 w-5 text-primary" />
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
          </div>
        )}
      </QueryState>
    </>
  );
}
