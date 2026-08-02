import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Alert02Icon, CheckmarkCircle01Icon, DollarSquareIcon, DropletIcon, Package01Icon, PercentIcon, PieChartIcon, PlusSignSquareIcon, ShoppingCart02Icon, TruckIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
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
import { useGetKpisQuery, useGetSellerPerformanceQuery, useGetSalesLedgerQuery, useGetDeliveryInvoicesQuery } from '~/store/api/reportsApi';
import { useGetCuadreQuery } from '~/store/api/cuadreApi';
import { useGetAccountsQuery } from '~/store/api/cajaApi';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { formatCordobas, formatNumber } from '~/lib/formatters';
import { cn } from '~/lib/utils';

// Reportería de ventas. Vive en components/admin/reports/ porque el panel del
// vendedor en /admin/ventas reusa la tendencia y el top de productos.
import { PeriodPicker } from '~/components/admin/reports/PeriodPicker';
import { SalesTrendChart } from '~/components/admin/reports/SalesTrendChart';
import { TopProductsTable } from '~/components/admin/reports/TopProductsTable';
import { SalesBreakdownCards } from '~/components/admin/reports/SalesBreakdownCards';
import { ExportSalesCsvButton } from '~/components/admin/reports/ExportSalesCsvButton';
import { DrilldownDialog } from '~/components/admin/reports/DrilldownDialog';
import { getPeriodRange, isPeriodReady, type CustomRange, type PeriodId, type PeriodRange } from '~/components/admin/reports/period';

export const meta: MetaFunction = () => {
  return [{ title: 'Reportería | Gyro Store Admin' }];
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

// Banner superior: ventas pendientes de aprobación, pop-up de delivery del
// periodo, y saldos por cuenta.
function CuadreBanner({ range }: { range: PeriodRange }) {
  const { data: cuadre } = useGetCuadreQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const { data: deliveryInvoices = [] } = useGetDeliveryInvoicesQuery(range, { skip: !deliveryOpen });

  if (!cuadre) return null;

  const nombreCuenta = (id: string) => accounts.find((a) => a.id === id)?.nombre ?? 'Cuenta';
  const pendingCount = cuadre.ventasPendientes;
  const hasPending = pendingCount > 0;

  const deliveryTotal = deliveryInvoices.reduce((sum, inv) => sum + inv.delivery_fee, 0);

  return (
    <section className="mb-6 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estado del negocio</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ventas pendientes — link a /admin/ventas?status=pending_approval */}
        <NavLink
          to="/admin/ventas?status=pending_approval"
          className={cn(
            'rounded-card border p-4 transition-colors',
            hasPending
              ? 'border-destructive/30 bg-destructive/10 hover:bg-destructive/15'
              : 'border-border bg-card hover:bg-accent',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <AnimatedIcon
                icon={ShoppingCart02Icon}
                size={16}
                strokeWidth={2}
                className={cn(hasPending && 'text-destructive')}
              />
              Ventas pendientes
            </span>
            {hasPending ? (
              <AnimatedIcon icon={Alert02Icon} size={16} strokeWidth={2} className="text-destructive" />
            ) : (
              <AnimatedIcon icon={CheckmarkCircle01Icon} size={16} strokeWidth={2} className="text-success" />
            )}
          </div>
          <p className={cn('nums mt-2 text-2xl font-bold', hasPending ? 'text-destructive' : 'text-foreground')}>
            {pendingCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasPending ? 'Esperan aprobación del admin' : 'Todo al día'}
          </p>
        </NavLink>

        {/* Delivery del periodo — botón que abre pop-up */}
        <button
          onClick={() => setDeliveryOpen(true)}
          className="rounded-card border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <AnimatedIcon icon={TruckIcon} size={16} strokeWidth={2} />
              Delivery del periodo
            </span>
          </div>
          <p className="nums mt-2 text-2xl font-bold text-foreground">
            {/* Muestra el total de delivery del cuadre de hoy como preview */}
            <AnimatedIcon icon={TruckIcon} size={16} strokeWidth={2} className="inline mr-1 opacity-0" />
            Ver detalle
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Facturas con envío en el periodo</p>
        </button>

        {cuadre.saldosCuentas.map((s) => (
          <div key={s.accountId} className="rounded-card border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <AnimatedIcon icon={Wallet01Icon} size={16} strokeWidth={2} />
              {nombreCuenta(s.accountId)}
            </span>
            <p className="nums mt-2 text-2xl font-bold text-foreground">{formatCordobas(s.balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saldo actual</p>
          </div>
        ))}
      </div>

      {/* Pop-up de delivery del periodo */}
      <DrilldownDialog
        open={deliveryOpen}
        onOpenChange={setDeliveryOpen}
        title="Delivery del periodo"
        icon={TruckIcon}
        footer={
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total delivery</span>
            <span className="nums">{formatCordobas(deliveryTotal, 'C$', 2)}</span>
          </div>
        }
      >
        {deliveryInvoices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hubo envíos en este periodo.</p>
        ) : (
          <div className="divide-y divide-border">
            {deliveryInvoices.map((inv, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {inv.invoice_number ? `#${inv.invoice_number}` : 'Sin factura'}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {inv.delivery_name || 'Sin repartidor'}
                  </span>
                </div>
                <span className="nums shrink-0 font-medium text-foreground">
                  {formatCordobas(inv.delivery_fee, 'C$', 2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DrilldownDialog>
    </section>
  );
}

// ── Pop-ups de drilldown de las StatCards ──
type DrilldownType = 'vendido' | 'coste' | 'comisiones' | 'ganancia' | null;

export default function AdminDashboard() {
  const [range, setRange] = useState<PeriodId>('month');
  // Rango libre: solo se usa cuando `range === 'range'`, pero se conserva al
  // saltar entre presets para no perder lo que el usuario ya había elegido.
  const [custom, setCustom] = useState<CustomRange>({ from: '', to: '' });

  const queryParams = useMemo(() => getPeriodRange(range, custom), [range, custom]);
  // Con el rango libre a medio llenar no hay filtro que mandar: pedirlo igual
  // traería el histórico completo rotulado como "el periodo elegido".
  const periodReady = isPeriodReady(queryParams);

  // La Reportería es de admin, pero la ruta /admin no lo bloquea por rol: si un
  // vendedor entra por URL, el backend ya le recorta los KPIs y acá se ocultan
  // las secciones que no le corresponden. La UI acompaña al backend, no lo suple.
  const isAdmin = useAppSelector(selectIsAdmin);

  const { data: kpis, isLoading, isError } = useGetKpisQuery(queryParams, { skip: !periodReady });

  // ── Drilldown state ──
  const [drilldown, setDrilldown] = useState<DrilldownType>(null);

  // Sales ledger se carga solo cuando un pop-up lo necesita
  const needsLedger = drilldown === 'vendido' || drilldown === 'coste' || drilldown === 'ganancia';
  const { data: ledger = [] } = useGetSalesLedgerQuery(queryParams, { skip: !needsLedger || !periodReady });

  // Seller performance se carga solo para el pop-up de comisiones
  const { data: sellers = [] } = useGetSellerPerformanceQuery(queryParams, { skip: drilldown !== 'comisiones' || !periodReady });

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

  // Totales para los footers de los pop-ups
  const ledgerTotalVendido = ledger.reduce((s, r) => s + r.total_vendido, 0);
  const ledgerTotalCoste = ledger.reduce((s, r) => s + r.coste, 0);
  const ledgerTotalGanancia = ledger.reduce((s, r) => s + r.ganancia, 0);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Reportería</h2>
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

      <CuadreBanner range={queryParams} />

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
                href="/admin/ventas?status=approved"
              />
              <StatCard
                icon={DollarSquareIcon}
                label="Total Vendido"
                countTo={kpis.total_vendido}
                format={formatMoney}
                color="emerald"
                delay={0.05}
                onClick={() => setDrilldown('vendido')}
              />
              {isAdmin && (
                <StatCard
                  icon={Package01Icon}
                  label="Coste Total"
                  countTo={kpis.coste_total ?? 0}
                  format={formatMoney}
                  color="amber"
                  delay={0.1}
                  onClick={() => setDrilldown('coste')}
                />
              )}
              <StatCard
                icon={PercentIcon}
                label="Comisiones"
                countTo={kpis.comision_total}
                format={formatMoney}
                color="purple"
                delay={0.15}
                onClick={() => setDrilldown('comisiones')}
              />
              {isAdmin && (
                <StatCard
                  icon={PlusSignSquareIcon}
                  label="Ganancia Tienda"
                  countTo={kpis.ganancia_tienda_total ?? 0}
                  format={formatMoney}
                  color="sky"
                  delay={0.2}
                  onClick={() => setDrilldown('ganancia')}
                />
              )}
            </div>

            {isAdmin && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <SpotlightCard variant="highlight" className="col-span-7 lg:col-span-4 p-5">
                <div className="mb-5 flex items-center gap-2 border-b pb-4">
                  <AnimatedIcon icon={DropletIcon} size={20} strokeWidth={2} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Distribución de costos fijos</h3>
                </div>
                
                {/* La barra mide el % SOBRE EL TOTAL repartido, no sobre el
                    pozo más grande. Con `amount / max` el mayor llegaba SIEMPRE
                    al 100% aunque se llevara el 22% del Costo F/U, y el gráfico
                    decía lo mismo con cualquier dato: era un ranking disfrazado
                    de proporción. Ahora las siete barras suman 100%. */}
                <div className="space-y-3">
                  {(() => {
                    const totalPozos = Object.values(kpis.pozos_recogidos || {}).reduce(
                      (sum, v) => sum + (v || 0),
                      0,
                    );

                    return POZOS.map((pozoKey) => {
                      const amount = kpis.pozos_recogidos?.[pozoKey] || 0;
                      const pct = totalPozos > 0 ? (amount / totalPozos) * 100 : 0;

                      return (
                        <div key={pozoKey} className="flex flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-medium capitalize text-foreground">{pozoKey}</span>
                            <span className="nums text-muted-foreground">
                              {formatMoney(amount)}
                              <span className="ml-2 text-xs opacity-70">{pct.toFixed(1)}%</span>
                            </span>
                          </div>
                          {/* Progress de shadcn: trae role="progressbar" y sus valores
                              ARIA, que la barra hecha a mano no tenía. Arranca en 0 y
                              sube al montar; con reduced-motion va directo al valor. */}
                          <Progress
                            value={barsReady ? pct : 0}
                            aria-label={`${pozoKey}: ${pct.toFixed(1)}% del costo fijo repartido`}
                            className="h-1.5 bg-primary/10 [&>[data-slot=progress-indicator]]:bg-primary"
                          />
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Si el Costo F/U de los lotes vendidos es 0 o nulo, los siete
                    pozos salen en 0 y la tarjeta parecía rota sin decir por qué. */}
                {Object.values(kpis.pozos_recogidos || {}).every((v) => !v) && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Sin reparto en este periodo. Si hubo ventas, revisá que los lotes vendidos
                    tengan cargado el <span className="font-medium">Costo F/U</span> en Inventario.
                  </p>
                )}
              </SpotlightCard>
              
              <SpotlightCard variant="default" className="col-span-7 lg:col-span-3 p-5">
                <div className="mb-4 flex items-center gap-2 border-b pb-4">
                  <AnimatedIcon icon={PieChartIcon} size={20} strokeWidth={2} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Ingresos de la tienda</h3>
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
                todos, top productos), no de una venta propia.
                El vendedor tiene su propio panel en /admin/ventas. */}
            {isAdmin && (
              <div className="space-y-6">
                <SalesTrendChart range={queryParams} />

                <TopProductsTable range={queryParams} />

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Desglose del periodo
                  </h3>
                  <SalesBreakdownCards range={queryParams} />
                </section>
              </div>
            )}
          </div>
        )}
      </QueryState>
      )}

      {/* ── Pop-ups de drilldown ── */}

      {/* Total Vendido */}
      <DrilldownDialog
        open={drilldown === 'vendido'}
        onOpenChange={(open) => !open && setDrilldown(null)}
        title="Total Vendido — Detalle por venta"
        icon={DollarSquareIcon}
        footer={
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total vendido</span>
            <span className="nums">{formatMoney(ledgerTotalVendido)}</span>
          </div>
        }
      >
        {ledger.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas en este periodo.</p>
        ) : (
          <div className="divide-y divide-border">
            {ledger.map((row) => (
              <div key={row.order_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {new Date(row.created_at).toLocaleDateString('es-NI')}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {row.cliente || 'Sin cliente'}
                  </span>
                  {row.invoice_number && (
                    <span className="ml-2 text-xs text-muted-foreground">#{row.invoice_number}</span>
                  )}
                </div>
                <span className="nums shrink-0 font-medium text-foreground">
                  {formatMoney(row.total_vendido)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DrilldownDialog>

      {/* Coste Total */}
      <DrilldownDialog
        open={drilldown === 'coste'}
        onOpenChange={(open) => !open && setDrilldown(null)}
        title="Coste Total — Detalle por venta"
        icon={Package01Icon}
        note="Costo de la mercadería vendida = costo de importación + costo fijo unitario, congelado al aprobar."
        footer={
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Coste total</span>
            <span className="nums">{formatMoney(ledgerTotalCoste)}</span>
          </div>
        }
      >
        {ledger.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas en este periodo.</p>
        ) : (
          <div className="divide-y divide-border">
            {ledger.map((row) => (
              <div key={row.order_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {new Date(row.created_at).toLocaleDateString('es-NI')}
                  </span>
                  {row.invoice_number && (
                    <span className="ml-2 text-xs text-muted-foreground">#{row.invoice_number}</span>
                  )}
                </div>
                <span className="nums shrink-0 font-medium text-foreground">
                  {formatMoney(row.coste)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DrilldownDialog>

      {/* Comisiones */}
      <DrilldownDialog
        open={drilldown === 'comisiones'}
        onOpenChange={(open) => !open && setDrilldown(null)}
        title="Comisiones — Por vendedor"
        icon={PercentIcon}
        footer={
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total comisiones</span>
            <span className="nums">{formatMoney(sellers.reduce((s, r) => s + r.comision, 0))}</span>
          </div>
        }
      >
        {sellers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin comisiones en este periodo.</p>
        ) : (
          <div className="divide-y divide-border">
            {sellers.map((row) => (
              <div key={row.seller_uid ?? row.seller_email} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {row.seller_name || row.seller_email || 'Sin vendedor'}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatNumber(row.num_ventas)} {row.num_ventas === 1 ? 'venta' : 'ventas'}
                  </span>
                </div>
                <span className="nums shrink-0 font-medium text-foreground">
                  {formatMoney(row.comision)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DrilldownDialog>

      {/* Ganancia Tienda */}
      <DrilldownDialog
        open={drilldown === 'ganancia'}
        onOpenChange={(open) => !open && setDrilldown(null)}
        title="Ganancia Tienda — Detalle por venta"
        icon={PlusSignSquareIcon}
        footer={
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total ganancia tienda</span>
            <span className="nums">{formatMoney(ledgerTotalGanancia)}</span>
          </div>
        }
      >
        {ledger.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas en este periodo.</p>
        ) : (
          <div className="divide-y divide-border">
            {ledger.map((row) => (
              <div key={row.order_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {row.invoice_number ? `#${row.invoice_number}` : new Date(row.created_at).toLocaleDateString('es-NI')}
                  </span>
                </div>
                <span className="nums shrink-0 font-medium text-foreground">
                  {formatMoney(row.ganancia)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DrilldownDialog>
    </>
  );
}
