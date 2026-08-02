import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Alert02Icon, CheckmarkCircle01Icon, DollarSquareIcon, DropletIcon, Package01Icon, PercentIcon, PieChartIcon, PlusSignSquareIcon, ShoppingCart02Icon, TruckIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { lazy, Suspense, useState, useMemo, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
// SpotlightCard es nuestro (resplandor que sigue al cursor), distinto del `Card`
// de shadcn: por eso lleva nombre propio y no colisiona al importar.
import { SpotlightCard } from '~/components/ui/stat-card';
import { QueryState } from '~/components/ui/QueryState';
import { SkeletonChart } from '~/components/ui/skeletons';
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
import { useGetKpisQuery, useGetSellerPerformanceQuery, useGetSalesLedgerQuery, useGetDeliveryInvoicesQuery, useGetSalesTrendQuery } from '~/store/api/reportsApi';
import { useGetCuadreQuery } from '~/store/api/cuadreApi';
import { useGetAccountsQuery } from '~/store/api/cajaApi';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { formatCordobas, formatNumber } from '~/lib/formatters';
import { cn } from '~/lib/utils';

// Reportería de ventas. Vive en components/admin/reports/ porque el panel del
// vendedor en /admin/ventas reusa la tendencia y el top de productos.
import { PageHeader } from '~/components/layout/PageHeader';
import { SectionLabel } from '~/components/layout/SectionLabel';
import { CompactKpi, HeroMetric } from '~/components/admin/reports/HeroMetric';
import { PeriodPicker } from '~/components/admin/reports/PeriodPicker';
// recharts es la dependencia más pesada del panel y solo la usa Reportería.
// Con `lazy`, abrir Ventas o Inventario ya no descarga una librería de gráficos
// que esas pantallas no dibujan.
const SalesTrendChart = lazy(() =>
  import('~/components/admin/reports/SalesTrendChart').then((m) => ({ default: m.SalesTrendChart })),
);
import { TopProductsTable } from '~/components/admin/reports/TopProductsTable';
import { SalesBreakdownCards } from '~/components/admin/reports/SalesBreakdownCards';
import { ExportSalesCsvButton } from '~/components/admin/reports/ExportSalesCsvButton';
import { DrilldownDialog } from '~/components/admin/reports/DrilldownDialog';
import { getPeriodRange, isPeriodReady, pickBucket, type CustomRange, type PeriodId, type PeriodRange } from '~/components/admin/reports/period';

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
  // Sin `skip`: la tarjeta ahora muestra el MONTO, no un "Ver detalle". El dato
  // tiene que estar antes de abrir el pop-up, no después.
  const { data: deliveryInvoices = [] } = useGetDeliveryInvoicesQuery(range);

  if (!cuadre) return null;

  const nombreCuenta = (id: string) => accounts.find((a) => a.id === id)?.nombre ?? 'Cuenta';
  const pendingCount = cuadre.ventasPendientes;
  const hasPending = pendingCount > 0;

  const deliveryTotal = deliveryInvoices.reduce((sum, inv) => sum + inv.delivery_fee, 0);

  return (
    <section className="space-y-3">
      <SectionLabel>Estado del negocio</SectionLabel>
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

        {/* Delivery del periodo.
            Antes mostraba el TEXTO "Ver detalle" donde sus tres vecinas
            muestran una cifra, y usaba un icono con `opacity-0` como espaciador.
            Ahora muestra el monto real: la tarjeta responde la pregunta sin
            obligar a abrirla, y el pop-up queda para el desglose. */}
        <button
          onClick={() => setDeliveryOpen(true)}
          className="rounded-card border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <AnimatedIcon icon={TruckIcon} size={16} strokeWidth={2} />
            Delivery del periodo
          </span>
          <p className="nums mt-2 text-2xl font-bold text-foreground">
            {formatCordobas(deliveryTotal)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {deliveryInvoices.length > 0
              ? `${deliveryInvoices.length} facturas con envío`
              : 'Ver facturas con envío'}
          </p>
        </button>

        {/* Máximo dos cuentas. Con cinco, la grilla de cuatro columnas se
            desarmaba y el banner pasaba a dos filas de tarjetas secundarias,
            robándole espacio al héroe. El resto vive en Caja y Bancos. */}
        {cuadre.saldosCuentas.slice(0, 2).map((s) => (
          <div key={s.accountId} className="rounded-card border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <AnimatedIcon icon={Wallet01Icon} size={16} strokeWidth={2} />
              {nombreCuenta(s.accountId)}
            </span>
            <p className="nums mt-2 text-2xl font-bold text-foreground">{formatCordobas(s.balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saldo actual</p>
          </div>
        ))}

        {cuadre.saldosCuentas.length > 2 && (
          <NavLink
            to="/admin/caja"
            className="flex flex-col justify-center rounded-card border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span className="font-medium">
              +{cuadre.saldosCuentas.length - 2} cuentas más
            </span>
            <span className="mt-1 text-xs">Ver todas en Caja y Bancos</span>
          </NavLink>
        )}
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

  // Se pide acá además de dentro de `CuadreBanner` solo para saber DÓNDE
  // colocarlo. RTK Query deduplica: es la misma entrada de caché, un request.
  const { data: cuadreForPlacement } = useGetCuadreQuery();
  const bannerOnTop = (cuadreForPlacement?.ventasPendientes ?? 0) > 0;

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

  // La dependencia es una CLAVE PRIMITIVA, no el objeto `kpis`.
  //
  // `kpis` es el objeto de RTK Query: cambia de referencia en cada refetch
  // aunque los datos sean idénticos. Dependiendo de él, este efecto reiniciaba
  // la animación de las barras en cada revalidación —las barras volvían a cero
  // y subían de nuevo sin que nada hubiera cambiado—. Con la suma de los pozos,
  // solo se reinicia cuando el reparto cambió de verdad.
  const pozosKey = kpis
    ? Object.values(kpis.pozos_recogidos || {}).reduce((s, v) => s + (v || 0), 0)
    : 0;

  useEffect(() => {
    if (reduce) {
      setBarsReady(true);
      return;
    }
    setBarsReady(false);
    const id = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(id);
  }, [reduce, pozosKey]);

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

  // Sparkline del héroe.
  //
  // Reusa la serie del gráfico de tendencia en vez de pedir un endpoint nuevo.
  // Los argumentos son EXACTAMENTE los mismos que usa `SalesTrendChart`
  // (`{...range, bucket, sellerUid}`), así que RTK Query reconoce la misma
  // entrada de caché y sale UN solo request, no dos. Si algún día cambian los
  // argumentos de uno de los dos, se duplica el pedido en silencio.
  const { data: trend = [] } = useGetSalesTrendQuery(
    { ...queryParams, bucket: pickBucket(queryParams), sellerUid: undefined },
    { skip: !periodReady || !isAdmin },
  );

  const heroSeries = useMemo(() => trend.map((p) => ({ value: p.total_vendido })), [trend]);

  // Totales para los footers de los pop-ups
  const ledgerTotalVendido = ledger.reduce((s, r) => s + r.total_vendido, 0);
  const ledgerTotalCoste = ledger.reduce((s, r) => s + r.coste, 0);
  const ledgerTotalGanancia = ledger.reduce((s, r) => s + r.ganancia, 0);

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Reportería"
        description={isAdmin ? 'Ventas del periodo elegido.' : undefined}
        actions={isAdmin ? <ExportSalesCsvButton range={queryParams} /> : undefined}
        // El selector de periodo baja a su propia fila. Apilado a la derecha del
        // título competía con él y en móvil se acomodaba de forma impredecible.
        filters={
          <PeriodPicker
            period={range}
            onPeriodChange={setRange}
            custom={custom}
            onCustomChange={setCustom}
            layoutId="dashboard-range"
          />
        }
      />

      {/* El banner sube arriba del héroe SOLO si hay algo que resolver. El
          espacio caro de la parte superior es para lo que requiere acción; si
          todo está al día, esos números son referencia y van abajo. */}
      {bannerOnTop && (
        <div className="mb-6">
          <CuadreBanner range={queryParams} />
        </div>
      )}

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
        // Cinco, no cuatro: el esqueleto tiene que tener la MISMA grilla que el
        // contenido. Con cuatro `div` sueltos, al llegar los datos aparecía una
        // quinta tarjeta y toda la fila saltaba.
        shape="stats"
        shapeCount={isAdmin ? 5 : 3}
      >
        {kpis && (
          <div className="space-y-6">
            {/* Un solo elemento domina: Total Vendido a 48 px con su delta y
                su sparkline. El resto pasa a compacto — el peso no se reparte,
                o ninguno gana. */}
            <div className="grid grid-cols-12 gap-4">
              <HeroMetric
                className="col-span-12 lg:col-span-5"
                icon={DollarSquareIcon}
                eyebrow="Total vendido"
                value={kpis.total_vendido}
                prev={kpis.total_vendido_prev}
                format={formatMoney}
                series={heroSeries}
                onClick={() => setDrilldown('vendido')}
              />

              <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
                <CompactKpi
                  icon={ShoppingCart02Icon}
                  label="Ventas"
                  value={kpis.total_ventas}
                  prev={kpis.total_ventas_prev}
                  sub={`${kpis.total_unidades} unidades`}
                  href="/admin/ventas?status=approved"
                />
                <CompactKpi
                  icon={PercentIcon}
                  label="Comisiones"
                  value={kpis.comision_total}
                  prev={kpis.comision_total_prev}
                  format={formatMoney}
                  onClick={() => setDrilldown('comisiones')}
                />
                {isAdmin && (
                  <CompactKpi
                    icon={Package01Icon}
                    label="Coste total"
                    value={kpis.coste_total ?? 0}
                    prev={kpis.coste_total_prev}
                    format={formatMoney}
                    // Subir el coste NO es una buena noticia: sin `invert` el
                    // delta lo pintaría de verde.
                    invert
                    onClick={() => setDrilldown('coste')}
                  />
                )}
                {isAdmin && (
                  <CompactKpi
                    icon={PlusSignSquareIcon}
                    label="Ganancia tienda"
                    value={kpis.ganancia_tienda_total ?? 0}
                    prev={kpis.ganancia_tienda_total_prev}
                    format={formatMoney}
                    onClick={() => setDrilldown('ganancia')}
                  />
                )}
              </div>
            </div>

            {isAdmin && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <SpotlightCard variant="highlight" className="col-span-7 lg:col-span-4 p-5">
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
                  <span className="flex items-center gap-2">
                    <AnimatedIcon icon={DropletIcon} size={20} strokeWidth={2} className="text-primary" />
                    <h3 className="font-semibold text-foreground">Distribución de costos fijos</h3>
                  </span>
                  {/* El total repartido: sin él, los porcentajes de abajo son
                      proporciones de una cifra que no está en ningún lado. */}
                  <span className="nums text-sm font-medium text-muted-foreground">
                    {formatMoney(
                      Object.values(kpis.pozos_recogidos || {}).reduce((s, v) => s + (v || 0), 0),
                    )}
                  </span>
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

                    // De mayor a menor, no en el orden fijo del array `POZOS`:
                    // esto es un ranking de a dónde se va el costo fijo, y un
                    // ranking se lee ordenado.
                    const ordenados = [...POZOS]
                      .map((pozoKey) => ({
                        pozoKey,
                        amount: kpis.pozos_recogidos?.[pozoKey] || 0,
                      }))
                      .sort((a, b) => b.amount - a.amount);

                    return ordenados.map(({ pozoKey, amount }, i) => {
                      const pct = totalPozos > 0 ? (amount / totalPozos) * 100 : 0;
                      // Los tres mayores en primary pleno; los cuatro restantes
                      // atenuados. Siete barras del mismo color son monótonas y
                      // hay que leer los siete números para encontrar el mayor.
                      const destacado = i < 3;

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
                            className={cn(
                              'h-1.5 bg-primary/10',
                              destacado
                                ? '[&>[data-slot=progress-indicator]]:bg-primary'
                                : '[&>[data-slot=progress-indicator]]:bg-primary/40',
                            )}
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
                <Suspense fallback={<SkeletonChart />}>
                  <SalesTrendChart range={queryParams} />
                </Suspense>

                <TopProductsTable range={queryParams} />

                <section className="space-y-3">
                  <SectionLabel>Desglose del periodo</SectionLabel>
                  <SalesBreakdownCards range={queryParams} />
                </section>

                {!bannerOnTop && <CuadreBanner range={queryParams} />}
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
