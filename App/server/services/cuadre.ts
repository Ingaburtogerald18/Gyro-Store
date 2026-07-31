import { getBalances, type AccountBalance } from './caja';
import { listSalidas } from './salidas';
import { getFinancialKPIs, type FinancialKPIs } from './reports';

export interface CuadreDashboard {
  salidasPendientes: number;
  deliveriesPorLiquidar: number;
  saldosCuentas: AccountBalance[];
  kpisHoy: FinancialKPIs;
}

export async function getCuadreDashboard(): Promise<CuadreDashboard> {
  // Hoy en UTC o local (simplificado a ISO string del día)
  const hoy = new Date().toISOString().split('T')[0];

  // Ejecutar todo en paralelo para mejor rendimiento
  const [salidas, balances, kpis] = await Promise.all([
    // Obtenemos salidas recientes para contar las pendientes.
    // Dependiendo del negocio, podríamos buscar TODAS las pendientes históricas
    // en lugar de solo las de hoy, pero pediremos todas las "pendientes" activas
    listSalidas(),
    getBalances(),
    // KPIs financieros solo de hoy
    getFinancialKPIs(hoy, hoy)
  ]);

  const pendientes = salidas.filter(s => s.estado === 'pendiente_registro').length;
  
  const deliveries = salidas.filter(s => 
    s.destino === 'delivery' && 
    (s.liquidacion === 'pendiente' || s.liquidacion === 'recordar')
  ).length;

  return {
    salidasPendientes: pendientes,
    deliveriesPorLiquidar: deliveries,
    saldosCuentas: balances,
    kpisHoy: kpis,
  };
}
