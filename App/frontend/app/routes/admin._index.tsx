import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Package, DollarSign, ShoppingCart, Users } from 'lucide-react';
import type { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'Dashboard | Gyro Store Admin' },
  ];
};

export default function AdminDashboard() {
  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-50">Dashboard</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Ventas */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Ventas (Mes)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">C$ 0.00</div>
            <p className="text-xs text-slate-500 mt-1">
              Esperando conexión con API...
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Pedidos */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Pedidos Pendientes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">0</div>
            <p className="text-xs text-slate-500 mt-1">
              Esperando conexión con API...
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Inventario */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Items en Bodega</CardTitle>
            <Package className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">0</div>
            <p className="text-xs text-slate-500 mt-1">
              Esperando conexión con API...
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Clientes */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Nuevos Leads</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">0</div>
            <p className="text-xs text-slate-500 mt-1">
              Esperando conexión con API...
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
        {/* Placeholder para gráfico o lista principal */}
        <Card className="col-span-4 bg-slate-900 border-slate-800 min-h-[400px] flex items-center justify-center">
          <p className="text-slate-500 text-sm">Resumen de Actividad (Próximamente)</p>
        </Card>
        
        {/* Placeholder para lista lateral */}
        <Card className="col-span-3 bg-slate-900 border-slate-800 min-h-[400px] flex items-center justify-center">
          <p className="text-slate-500 text-sm">Últimos Movimientos (Próximamente)</p>
        </Card>
      </div>
    </>
  );
}
