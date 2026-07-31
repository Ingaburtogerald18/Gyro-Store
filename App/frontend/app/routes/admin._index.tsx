import { useState, useMemo } from 'react';
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
import { Pie, PieChart } from 'recharts';
import { DollarSign, ShoppingCart, Package, Percent, PlusSquare, Droplets, PieChart as PieIcon } from 'lucide-react';
import type { MetaFunction } from '@remix-run/node';
import { useGetKpisQuery } from '~/store/api/reportsApi';

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

// Series del gráfico. Los colores salen de los tokens chart-*, así que siguen
// el tema (claro/oscuro) sin tocar nada acá.
const incomeChartConfig = {
  coste: { label: 'Coste', color: 'var(--color-chart-1)' },
  comision: { label: 'Comisiones', color: 'var(--color-chart-2)' },
  salary: { label: 'Salary', color: 'var(--color-chart-3)' },
  ganancia: { label: 'Ganancia tienda', color: 'var(--color-chart-4)' },
} satisfies ChartConfig;

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
        <h2 className="text-3xl font-extrabold tracking-tight text-text">Dashboard</h2>
        <AnimatedTabs
          items={tabs}
          value={range}
          onChange={setRange}
          layoutId="dashboard-range"
        />
      </div>
      
      <QueryState
        loading={isLoading}
        error={isError}
        empty={!kpis}
        loadingFallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="h-32 rounded-card bg-surface-2 animate-pulse" />
            <div className="h-32 rounded-card bg-surface-2 animate-pulse" />
            <div className="h-32 rounded-card bg-surface-2 animate-pulse" />
            <div className="h-32 rounded-card bg-surface-2 animate-pulse" />
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
                <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
                  <Droplets className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold text-text">Recaudado por Pozo</h3>
                </div>
                
                <div className="space-y-4">
                  {['publicidad', 'mantenimiento', 'utiles', 'garantias', 'prestamos', 'suscripciones', 'servicios'].map((pozoKey, i) => {
                    const amount = kpis.pozos_recogidos?.[pozoKey] || 0;
                    const maxAmount = Math.max(...Object.values(kpis.pozos_recogidos || {}), 1);
                    const widthPercent = `${(amount / maxAmount) * 100}%`;
                    
                    return (
                      <div key={pozoKey} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-text capitalize">{pozoKey}</span>
                          <span className="nums text-muted">{formatMoney(amount)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: widthPercent }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                            className="h-full bg-accent"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SpotlightCard>
              
              <SpotlightCard variant="default" className="col-span-7 lg:col-span-3 p-5">
                <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
                  <PieIcon className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold text-text">Composición del ingreso</h3>
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
                      <span className="flex items-center gap-2 text-muted">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: slice.fill }}
                        />
                        {slice.label}
                      </span>
                      <span className="nums font-medium text-text">{formatMoney(slice.value)}</span>
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
