import { useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { useGetInventoryQuery, useRegisterPurchaseMutation } from '~/store/api/inventoryApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { DataTable } from '~/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import type { InventoryItem } from '~/store/api/inventoryApi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { PackagePlus, RefreshCcw, AlertTriangle, CheckCircle2, CalendarRange, Boxes, Archive, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';

export const meta: MetaFunction = () => {
  return [{ title: 'Inventario | Gyro Store Admin' }];
};

const inventoryColumns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: 'name',
    header: 'Producto',
    cell: ({ row }) => <span className="font-medium text-slate-200">{row.original.name}</span>,
  },
  {
    accessorKey: 'stock',
    header: () => <div className="text-right">Stock</div>,
    cell: ({ row }) => <div className="text-right tabular-nums text-slate-300">{row.original.stock}</div>,
  },
  {
    accessorKey: 'cost',
    header: () => <div className="text-right">Costo Prom.</div>,
    cell: ({ row }) => <div className="text-right tabular-nums text-slate-400">C$ {row.original.cost.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</div>,
  },
  {
    id: 'totalValue',
    header: () => <div className="text-right">Valor Total</div>,
    cell: ({ row }) => {
      const total = row.original.stock * row.original.cost;
      return <div className="text-right tabular-nums font-medium text-emerald-400">C$ {total.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</div>;
    },
  },
  {
    id: 'status',
    header: () => <div className="text-center">Estado</div>,
    cell: ({ row }) => {
      const stock = row.original.stock;
      return (
        <div className="text-center">
          {stock === 0 ? (
            <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10">Agotado</Badge>
          ) : stock <= 3 ? (
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10">Bajo Stock</Badge>
          ) : (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="w-3 h-3 mr-1" /> OK
            </Badge>
          )}
        </div>
      );
    },
  },
];

export default function AdminInventario() {
  const { data: inventory = [], isLoading, isError, refetch } = useGetInventoryQuery();
  const [registerPurchase, { isLoading: isRegistering }] = useRegisterPurchaseMutation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("purchases");
  const [inventoryType, setInventoryType] = useState("current");

  // Estado del formulario
  const [formData, setFormData] = useState({
    catalogItemId: '',
    quantity: 1,
    unitCost: 0,
    supplier: '',
    notes: '',
  });

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerPurchase(formData).unwrap();
      toast.success('Entrada de inventario registrada con éxito.');
      setIsDialogOpen(false);
      setFormData({ catalogItemId: '', quantity: 1, unitCost: 0, supplier: '', notes: '' });
    } catch (error) {
      // Como el backend aún no está listo, mostraremos un toast de éxito simulado por ahora
      toast.success('Entrada simulada con éxito (Backend pendiente).');
      setIsDialogOpen(false);
    }
  };

  // Cálculos rápidos para KPIs
  const totalStock = inventory.reduce((acc, item) => acc + item.stock, 0);
  const totalValue = inventory.reduce((acc, item) => acc + (item.stock * item.cost), 0);
  const lowStockItems = inventory.filter(item => item.stock > 0 && item.stock <= 3).length;

  return (
    <div className="space-y-6">
      {/* 1. Cabecera */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-text">Control de Inventario</h2>
          <p className="text-muted">Registro de compras en China y stock recibido en bodega.</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-surface border border-border">
            <TabsTrigger value="purchases" className="data-[state=active]:bg-slate-800">
              <FileText className="w-4 h-4 mr-2" /> Registro de Compras
            </TabsTrigger>
            <TabsTrigger value="inventory" className="data-[state=active]:bg-slate-800">
              <Boxes className="w-4 h-4 mr-2" /> Inventario
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        
        {/* Contenido: Registro de Compras */}
        <TabsContent value="purchases" className="space-y-6 outline-none">
          {/* Tarjetas de KPIs - Compras */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">Compras Registradas (Mes)</CardDescription>
                <CardTitle className="text-3xl text-text">0</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">Inversión Estimada</CardDescription>
                <CardTitle className="text-3xl text-emerald-400">C$ 0.00</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">En Tránsito</CardDescription>
                <CardTitle className="text-3xl text-amber-500 flex items-center gap-2">
                  0 <AlertTriangle className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Tabla simulada de compras */}
          <Card className="bg-surface border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-text">Historial de Compras</CardTitle>
                <CardDescription className="text-muted">Registro detallado de ingresos al inventario.</CardDescription>
              </div>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10">
                    <PackagePlus className="w-4 h-4 mr-2" />
                    Registrar Entrada
                  </Button>
                </DialogTrigger>
          <DialogContent className="bg-surface border-border text-text w-full sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 font-bold text-xl">Registrar Compra / Entrada</DialogTitle>
              <DialogDescription className="text-muted">
                Añade nuevo stock a la bodega. Esto actualizará el costo promedio ponderado y la cola FIFO.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegisterPurchase} className="space-y-5 mt-6">
              <div className="space-y-2">
                <Label htmlFor="catalogItemId" className="text-slate-300">ID del Producto (SKU)</Label>
                <Input 
                  id="catalogItemId" 
                  value={formData.catalogItemId}
                  onChange={e => setFormData({ ...formData, catalogItemId: e.target.value })}
                  placeholder="Ej. prod_12345" 
                  className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-slate-300">Cantidad</Label>
                  <Input 
                    id="quantity" 
                    type="number" 
                    min="1"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitCost" className="text-slate-300">Costo Unitario (C$)</Label>
                  <Input 
                    id="unitCost" 
                    type="number" 
                    min="0" step="0.01"
                    value={formData.unitCost}
                    onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier" className="text-slate-300">Proveedor (Opcional)</Label>
                <Input 
                  id="supplier" 
                  value={formData.supplier}
                  onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Nombre de tienda o importador" 
                  className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-300">Notas / Referencia</Label>
                <Input 
                  id="notes" 
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ej. Factura #4562, Lote dañado..." 
                  className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                />
              </div>
                <Button type="submit" disabled={isRegistering} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold mt-4">
                  {isRegistering ? 'Registrando...' : 'Confirmar Entrada'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

            </CardHeader>
            <CardContent>
              <div className="text-center py-12 border border-dashed border-border rounded-lg bg-surface-2/50">
                <FileText className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                <p className="text-text font-medium">No hay compras recientes</p>
                <p className="text-muted text-sm mt-1">El historial aparecerá aquí cuando registres entradas.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contenido: Inventario */}
        <TabsContent value="inventory" className="space-y-6 outline-none">
          
          {/* Sub-navegación: Actual vs Migrado */}
          <div className="flex justify-end">
            <Tabs value={inventoryType} onValueChange={setInventoryType} className="w-full sm:w-auto">
              <TabsList className="bg-surface-2 border border-border">
                <TabsTrigger value="current" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  <Boxes className="w-4 h-4 mr-2" /> Inventario Actual
                </TabsTrigger>
                <TabsTrigger value="migrated" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  <Archive className="w-4 h-4 mr-2" /> Inventario Migrado
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Tarjetas de KPIs - Inventario */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">Unidades en Bodega</CardDescription>
                <CardTitle className="text-3xl text-text">{isLoading ? '-' : totalStock}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">Valor Total Inventario</CardDescription>
                <CardTitle className="text-3xl text-emerald-400">C$ {isLoading ? '-' : totalValue.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">Alertas Stock Bajo</CardDescription>
                <CardTitle className="text-3xl text-amber-500 flex items-center gap-2">
                  {isLoading ? '-' : lowStockItems} 
                  {lowStockItems > 0 && <AlertTriangle className="w-5 h-5" />}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Tabs value={inventoryType} className="outline-none">
            <TabsContent value="current" className="outline-none m-0">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-text">Existencias Actuales</CardTitle>
                    <CardDescription className="text-muted">Listado consolidado de productos.</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={refetch} disabled={isLoading} className="border-border bg-transparent text-muted hover:text-text hover:bg-surface-2">
                    <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {isError ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                      <p className="text-rose-400 font-medium">Error al cargar inventario.</p>
                      <p className="text-muted text-sm mt-1">Esperando que el backend esté listo.</p>
                    </div>
                  ) : inventory.length === 0 && !isLoading ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-lg bg-surface-2/50">
                      <PackagePlus className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                      <p className="text-text font-medium">Bodega vacía</p>
                      <p className="text-muted text-sm mt-1">Registra tu primera compra para ver el stock aquí.</p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <DataTable 
                        columns={inventoryColumns} 
                        data={inventory} 
                        searchPlaceholder="Buscar producto por nombre..."
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="migrated" className="outline-none m-0">
              <Card className="bg-surface border-border shadow-sm border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Archive className="w-12 h-12 text-muted mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-text">Inventario Migrado</h3>
                  <p className="text-muted text-sm mt-1 text-center max-w-sm">Aquí aparecerán los registros migrados de versiones anteriores.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
