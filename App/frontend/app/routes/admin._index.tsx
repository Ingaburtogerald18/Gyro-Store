import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
// `Card` viene de stat-card (no de ui/card): es el que expone `variant="highlight"`
// con el spotlight que sigue al cursor. Ver nota de duplicación en stat-card.tsx.
import { Card, StatCard } from '~/components/ui/stat-card';
import { AnimatedTabs } from '~/components/ui/AnimatedTabs';
import { QueryState } from '~/components/ui/QueryState';
import { DollarSign, ShoppingCart, Package, Percent, PlusSquare, Droplets } from 'lucide-react';
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
              <Card variant="highlight" className="col-span-7 lg:col-span-4 p-5">
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
              </Card>
              
              <Card variant="default" className="col-span-7 lg:col-span-3 p-5 min-h-[400px] flex items-center justify-center">
                <p className="text-muted text-sm">Más reportes (Próximamente)</p>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
