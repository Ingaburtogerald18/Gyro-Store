// Dashboard de KPIs del inventario.
// Disciplina de color (StatCards):
//   indigo  = conteos de unidades y stock
//   sky     = costos y egresos
//   emerald = ingresos y ganancia (totales finales)
//   rose    = alertas (agotados)

import { CargoShipIcon, DollarSquareIcon, Invoice01Icon, PackageDeliveredIcon, PackageIcon, PackageRemoveIcon, TruckIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { StatCard } from "~/components/ui/stat-card";
import { useGetInventoryKpisQuery, useGetCurrentInventoryQuery, useGetMigratedInventoryQuery } from "~/store/api/inventoryV1Api";
import { formatUsd, cordobasFromUsd } from "~/lib/formatters";

interface InventoryKpisProps {
  tab: "purchases" | "current" | "migrated" | "outOfStock";
  /** Periodo activo de la URL: "all" o "YYYY-MM". Filtra los números mostrados. */
  period?: string;
}

const usd4 = (n: number) => formatUsd(n, 4);

export function InventoryKpis({ tab, period = "all" }: InventoryKpisProps) {
  const { data: k, isLoading: loadingKpis } = useGetInventoryKpisQuery(period);
  const { data: rows = [], isLoading: loadingCurrent } = useGetCurrentInventoryQuery(period);
  const { data: migratedItems = [], isLoading: loadingMigrated } = useGetMigratedInventoryQuery(period);

  const isLoading = tab === "purchases" ? loadingKpis : (tab === "current" || tab === "outOfStock") ? loadingCurrent : loadingMigrated;

  if (isLoading || (tab === "purchases" && !k)) {
    return (
      <div className="space-y-4">
        {[0, 1].map((row) => (
          <div key={row} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-[92px] rounded-card border" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (tab === "current" || tab === "outOfStock") {
    const totalProducts = rows.length;
    const totalAvailable = rows.reduce((acc, r) => acc + (r.available || 0), 0);
    const totalShippingUsd = rows.reduce((acc, r) => acc + (r.shippingUnitUsd || 0) * (r.available || 0), 0);
    const totalPreTotalUsd = rows.reduce((acc, r) => acc + (r.preTotalUsd || 0), 0);
    const totalFinalUsd = rows.reduce((acc, r) => acc + (r.totalFinalUsd || 0), 0);
    const outOfStock = rows.filter((r) => (r.available || 0) <= 0).length;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={PackageIcon} label="Lotes en Bodega" countTo={totalProducts} color="indigo" delay={0} />
          <StatCard icon={PackageDeliveredIcon} label="Artículos disponibles" countTo={totalAvailable} color="indigo" delay={0.05} />
          <StatCard icon={TruckIcon} label="Costo de Envíos (Stock)" countTo={totalShippingUsd} format={usd4} sub={cordobasFromUsd(totalShippingUsd)} color="sky" delay={0.1} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={DollarSquareIcon} label="Pre-Total sin Envío" countTo={totalPreTotalUsd} format={formatUsd} sub={cordobasFromUsd(totalPreTotalUsd)} color="sky" delay={0.15} />
          <StatCard icon={Wallet01Icon} label="Total con Envío" countTo={totalFinalUsd} format={formatUsd} sub={cordobasFromUsd(totalFinalUsd)} color="emerald" delay={0.2} />
          <StatCard icon={PackageRemoveIcon} label="Artículos agotados" countTo={outOfStock} color="rose" delay={0.25} />
        </div>
      </div>
    );
  }

  if (tab === "migrated") {
    const totalProducts = migratedItems.length;
    const totalAvailable = migratedItems.reduce((acc, r) => acc + (r.stock || 0), 0);
    const totalShippingUsd = migratedItems.reduce((acc, r) => acc + (r.shippingUnitUsd || 0) * (r.quantity || 0), 0);
    const totalPreTotalUsd = migratedItems.reduce((acc, r) => acc + (r.priceBaseUsd || 0) * (r.quantity || 0), 0);
    const totalFinalUsd = migratedItems.reduce((acc, r) => acc + (r.priceUnitFinalUsd || 0) * (r.quantity || 0), 0);
    const outOfStock = migratedItems.filter((r) => (r.stock || 0) <= 0).length;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={PackageIcon} label="Artículos migrados" countTo={totalProducts} color="indigo" delay={0} />
          <StatCard icon={PackageDeliveredIcon} label="Artículos disponibles" countTo={totalAvailable} color="indigo" delay={0.05} />
          <StatCard icon={TruckIcon} label="Costo de Envíos (Total)" countTo={totalShippingUsd} format={usd4} sub={cordobasFromUsd(totalShippingUsd)} color="sky" delay={0.1} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={DollarSquareIcon} label="Pre-Total sin Envío" countTo={totalPreTotalUsd} format={formatUsd} sub={cordobasFromUsd(totalPreTotalUsd)} color="sky" delay={0.15} />
          <StatCard icon={Wallet01Icon} label="Total con Envío" countTo={totalFinalUsd} format={formatUsd} sub={cordobasFromUsd(totalFinalUsd)} color="emerald" delay={0.2} />
          <StatCard icon={PackageRemoveIcon} label="Artículos agotados" countTo={outOfStock} color="rose" delay={0.25} />
        </div>
      </div>
    );
  }

  // Vista "purchases" por defecto (KPIs generales de compras china/bodega)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={PackageIcon} label="Artículos" countTo={k?.totalPurchases ?? 0} color="indigo" delay={0} />
        <StatCard icon={CargoShipIcon} label="En tránsito" countTo={k?.inTransit ?? 0} color="indigo" delay={0.05} />
        <StatCard icon={PackageDeliveredIcon} label="En bodega" countTo={k?.received ?? 0} color="indigo" delay={0.1} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={DollarSquareIcon} label="Subtotal invertido" countTo={k?.subtotalInvertidoUsd ?? 0} format={formatUsd} sub={cordobasFromUsd(k?.subtotalInvertidoUsd ?? 0)} color="sky" delay={0.15} />
        <StatCard icon={Invoice01Icon} label="Impuestos" countTo={k?.totalImpuestosUsd ?? 0} format={formatUsd} sub={cordobasFromUsd(k?.totalImpuestosUsd ?? 0)} color="sky" delay={0.2} />
        <StatCard icon={Wallet01Icon} label="Inversión c/imp." countTo={k?.totalInversionConImpuestosUsd ?? 0} format={formatUsd} sub={cordobasFromUsd(k?.totalInversionConImpuestosUsd ?? 0)} color="emerald" delay={0.25} />
      </div>
    </div>
  );
}
