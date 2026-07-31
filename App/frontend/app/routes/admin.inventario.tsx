import { useState, useEffect } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { 
  useGetPurchasesQuery, 
  useGetInventoryKpisQuery,
  useGetCurrentInventoryQuery, 
  useCreatePurchaseMutation,
  useDeletePurchaseMutation,
  useReportArrivalMutation,
  type Purchase
} from '~/store/api/inventoryV1Api';
import { useGetCategoriesQuery } from '~/store/api/catalogAdminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { DataTable } from '~/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { PackagePlus, RefreshCcw, AlertTriangle, Boxes, Archive, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { getSupabaseClient } from '~/lib/supabase.client';


export const meta: MetaFunction = () => {
  return [{ title: 'Inventario | Gyro Store Admin' }];
};

// Helper: Calcular Fecha de Salida
function getDepartureDate(purchaseDate: string): string {
  if (!purchaseDate) return '';
  const [yearStr, monthStr, dayStr] = purchaseDate.split('-');
  if (!yearStr || !monthStr || !dayStr) return '';
  
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const year = parseInt(yearStr, 10);

  if (day >= 1 && day <= 10) {
    return new Date(Date.UTC(year, month, 15)).toISOString().split('T')[0];
  } else if (day >= 11 && day <= 25) {
    return new Date(Date.UTC(year, month, 30)).toISOString().split('T')[0];
  } else {
    return new Date(Date.UTC(year, month + 1, 15)).toISOString().split('T')[0];
  }
}

export default function AdminInventario() {
  const { data: inventory = [], isLoading, isError, refetch } = useGetCurrentInventoryQuery();
  const { data: purchases = [], isLoading: isLoadingPurchases } = useGetPurchasesQuery();
  const { data: kpis } = useGetInventoryKpisQuery();
  const [createPurchase, { isLoading: isRegistering }] = useCreatePurchaseMutation();
  const [deletePurchase, { isLoading: isDeleting }] = useDeletePurchaseMutation();
  const [reportArrival, { isLoading: isReceiving }] = useReportArrivalMutation();
  const { data: categories = [] } = useGetCategoriesQuery();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("purchases");
  
  const [receiveItem, setReceiveItem] = useState<any>(null);
  const [receiveData, setReceiveData] = useState({
    arrivalDate: '',
    shippingUnit: '',
    category: ''
  });
  const [inventoryType, setInventoryType] = useState("current");

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePin, setDeletePin] = useState("");

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveItem) return;
    try {
      await reportArrival({
        id: receiveItem.id,
        body: {
          arrivalDate: receiveData.arrivalDate,
          shippingUnit: Number(receiveData.shippingUnit),
          category: receiveData.category
        }
      }).unwrap();
      setReceiveItem(null);
      setReceiveData({ arrivalDate: '', shippingUnit: '', category: '' });
      toast.success('Compra recibida correctamente');
    } catch (err: any) {
      toast.error(err?.data?.error || 'Error al recibir la compra');
    }
  };

  // Estado del formulario
  const [formData, setFormData] = useState({
    productName: '',
    quantity: '' as number | string,
    unitCost: '' as number | string,
    taxUnit: '' as number | string,
    lot: '',
    purchaseDate: '',
  });

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPurchase({
        productName: formData.productName,
        quantity: Number(formData.quantity) || 1,
        costUnit: Number(formData.unitCost) || 0,
        taxUnit: Number(formData.taxUnit) || 0,
        lot: formData.lot,
        purchaseDate: formData.purchaseDate,
        code: '' // Generado por backend
      }).unwrap();
      toast.success('Compra registrada. Código auto-asignado.');
      setIsDialogOpen(false);
      setFormData({ productName: '', quantity: '', unitCost: '', taxUnit: '', lot: '', purchaseDate: '' });
    } catch (error: any) {
      toast.error(error?.data?.error || 'Error al registrar la compra.');
    }
  };

  // Auto-execute pending delete after redirect
  useEffect(() => {
    const pendingDelete = sessionStorage.getItem('pending_delete_purchase');
    if (pendingDelete) {
      sessionStorage.removeItem('pending_delete_purchase');
      const id = pendingDelete;
      const tId = toast.loading('Eliminando compra post-autenticación...');
      deletePurchase(id).unwrap().then(() => {
        toast.success('Compra eliminada correctamente', { id: tId });
      }).catch((err: any) => {
        toast.error(err?.data?.error || 'Error al eliminar', { id: tId });
      });
    }
  }, [deletePurchase]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    sessionStorage.setItem('pending_delete_purchase', deleteId);
    
    toast.loading('Redirigiendo a Microsoft Entra ID para confirmar identidad...');
    const supabase = getSupabaseClient();
    
    // Iniciar OAuth para reautenticar
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email openid profile User.Read',
        queryParams: { prompt: 'login' },
        redirectTo: window.location.href,
      },
    });
  };

  const purchaseColumns: ColumnDef<Purchase>[] = [
    {
      accessorKey: 'code',
      header: 'Código',
      cell: ({ row }) => <span className="font-medium text-emerald-400">{row.original.code}</span>,
    },
    {
      accessorKey: 'lot',
      header: 'Lote',
      cell: ({ row }) => <span className="text-slate-400">{row.original.lot || '-'}</span>,
    },
    {
      accessorKey: 'productName',
      header: 'Producto',
      cell: ({ row }) => <span className="text-slate-200">{row.original.productName}</span>,
    },
    {
      id: 'departureDate',
      header: 'Salida Estimada',
      cell: ({ row }) => {
        const departure = getDepartureDate(row.original.purchaseDate);
        return <span className="text-amber-400 font-medium">{departure}</span>;
      },
    },
    {
      accessorKey: 'quantity',
      header: () => <div className="text-right">Cant.</div>,
      cell: ({ row }) => <div className="text-right tabular-nums text-slate-300">{row.original.quantity}</div>,
    },
    {
      id: 'finalUnitCost',
      header: () => <div className="text-right">Costo U.</div>,
      cell: ({ row }) => {
        const cost = (row.original.costUnit || 0) + (row.original.taxUnit || 0);
        return <div className="text-right tabular-nums text-slate-300">${cost.toFixed(2)}</div>;
      },
    },
    {
      id: 'totalCost',
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => {
        const cost = (row.original.costUnit || 0) + (row.original.taxUnit || 0);
        const total = cost * (row.original.quantity || 0);
        return <div className="text-right tabular-nums text-emerald-400 font-medium">${total.toFixed(2)}</div>;
      },
    },
    {
      id: 'transitDays',
      header: () => <div className="text-center">Días en Tránsito</div>,
      cell: ({ row }) => {
        if (row.original.status !== 'received' || !row.original.arrivalDate) return <div className="text-center text-slate-500">-</div>;
        const departure = getDepartureDate(row.original.purchaseDate);
        const depDate = new Date(departure);
        const arrDate = new Date(row.original.arrivalDate);
        const diffMs = arrDate.getTime() - depDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const color = diffDays > 0 ? "text-amber-400" : (diffDays < 0 ? "text-emerald-400" : "text-slate-300");
        const prefix = diffDays > 0 ? "+" : "";
        return <div className={`text-center font-medium ${color}`}>{prefix}{diffDays} días</div>;
      }
    },
    {
      accessorKey: 'status',
      header: () => <div className="text-center">Estado</div>,
      cell: ({ row }) => {
        const s = row.original.status;
        
        // "transit" no es un estado persistido (PurchaseStatus = china|received):
        // se deriva en la UI cuando ya pasó la fecha de salida del lote.
        let dynamicStatus: 'china' | 'received' | 'transit' = s;
        if (s === 'china') {
          const departure = getDepartureDate(row.original.purchaseDate);
          const today = new Date().toISOString().split('T')[0];
          if (departure <= today) {
            dynamicStatus = 'transit';
          }
        }

        return (
          <div className="text-center">
            {dynamicStatus === 'transit' ? (
              <Badge variant="outline" className="text-sky-400 border-sky-500/30 bg-sky-500/10">En Tránsito</Badge>
            ) : dynamicStatus === 'china' ? (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10">En China</Badge>
            ) : s === 'received' ? (
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">Recibido</Badge>
            ) : (
              <Badge variant="outline" className="text-slate-400 border-slate-500/30 bg-slate-500/10">{s}</Badge>
            )}
          </div>
        );
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        if (row.original.status !== 'china') return null;
        return (
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                setReceiveItem(row.original);
                setReceiveData({
                  arrivalDate: new Date().toISOString().split('T')[0],
                  shippingUnit: '',
                  category: row.original.category || ''
                });
              }}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 h-8"
            >
              Recibir
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => setDeleteId(row.original.id)}
              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 w-8"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      }
    }
  ];

  const hasReceivedItems = purchases.some(p => p.status === 'received');
  const finalPurchaseColumns = hasReceivedItems 
    ? purchaseColumns 
    : purchaseColumns.filter(c => c.id !== 'transitDays');

  const inventoryColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'productName',
      header: 'Producto',
      cell: ({ row }) => <span className="font-medium text-slate-200">{row.original.productName}</span>,
    },
    {
      accessorKey: 'available',
      header: () => <div className="text-right">Stock Disponible</div>,
      cell: ({ row }) => <div className="text-right tabular-nums text-slate-300">{row.original.available}</div>,
    },
    {
      accessorKey: 'priceUnitFinalUsd',
      header: () => <div className="text-right">Costo Final (USD)</div>,
      cell: ({ row }) => <div className="text-right tabular-nums text-slate-400">${row.original.priceUnitFinalUsd?.toFixed(2)}</div>,
    }
  ];

  return (
    <div className="space-y-6">
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
        
        <TabsContent value="purchases" className="space-y-6 outline-none">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">Compras Registradas</CardDescription>
                <CardTitle className="text-3xl text-text">{kpis?.totalPurchases || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">Inversión Estimada (USD)</CardDescription>
                <CardTitle className="text-3xl text-emerald-400">${kpis?.totalInversionConImpuestosUsd?.toFixed(2) || '0.00'}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-surface border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-muted font-medium">En Tránsito</CardDescription>
                <CardTitle className="text-3xl text-amber-500 flex items-center gap-2">
                  {kpis?.inTransit || 0} <AlertTriangle className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

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
                <DialogContent className="bg-surface border-border text-text w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-emerald-400 font-bold text-xl">Registrar Compra en China</DialogTitle>
                    <DialogDescription className="text-muted">
                      El código GS-IN-XX será asignado automáticamente y se calculará la fecha de salida.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleRegisterPurchase} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="productName" className="text-slate-300">Nombre del Producto</Label>
                      <Input 
                        id="productName" 
                        value={formData.productName}
                        onChange={e => setFormData({ ...formData, productName: e.target.value })}
                        placeholder="Ej. iPhone 13 Pro Max" 
                        className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="purchaseDate" className="text-slate-300">Fecha de Compra</Label>
                      <Input 
                        id="purchaseDate" 
                        type="date"
                        value={formData.purchaseDate}
                        onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
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
                          onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                          className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lot" className="text-slate-300">Nº Seguimiento / Lote</Label>
                        <Input 
                          id="lot" 
                          value={formData.lot}
                          onChange={e => setFormData({ ...formData, lot: e.target.value })}
                          placeholder="Tracking" 
                          className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="unitCost" className="text-slate-300">Costo Unit (USD)</Label>
                        <Input 
                          id="unitCost" 
                          type="number" 
                          min="0" step="0.01"
                          value={formData.unitCost}
                          onChange={e => setFormData({ ...formData, unitCost: e.target.value })}
                          className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="taxUnit" className="text-slate-300">Impuesto Unit (USD)</Label>
                        <Input 
                          id="taxUnit" 
                          type="number" 
                          min="0" step="0.01"
                          value={formData.taxUnit}
                          onChange={e => setFormData({ ...formData, taxUnit: e.target.value })}
                          className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500" 
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={isRegistering} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold mt-2">
                      {isRegistering ? 'Registrando...' : 'Confirmar Compra'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

            </CardHeader>
            <CardContent>
              {!purchases.length && !isLoadingPurchases ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg bg-surface-2/50">
                  <FileText className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                  <p className="text-text font-medium">No hay compras recientes</p>
                  <p className="text-muted text-sm mt-1">El historial aparecerá aquí cuando registres entradas.</p>
                </div>
              ) : (
                <DataTable 
                  columns={finalPurchaseColumns} 
                  data={purchases} 
                  searchPlaceholder="Buscar por código o producto..."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6 outline-none">
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

          <Tabs value={inventoryType} className="outline-none">
            <TabsContent value="current" className="outline-none m-0">
              <Card className="bg-surface border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-text">Existencias Actuales</CardTitle>
                    <CardDescription className="text-muted">Stock recibido (listo para venta).</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={refetch} disabled={isLoading} className="border-border bg-transparent text-muted hover:text-text hover:bg-surface-2">
                    <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {!inventory.length && !isLoading ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-lg bg-surface-2/50">
                      <PackagePlus className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                      <p className="text-text font-medium">Bodega vacía</p>
                    </div>
                  ) : (
                    <DataTable 
                      columns={inventoryColumns} 
                      data={inventory} 
                      searchPlaceholder="Buscar producto..."
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      
      {/* Eliminar Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-400 font-bold text-xl">¿Re-autenticar para eliminar?</DialogTitle>
            <DialogDescription className="text-slate-300 mt-2">
              Vas a ser redirigido a Microsoft para confirmar tu identidad. Tras iniciar sesión nuevamente, la compra será eliminada y el código reciclado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-slate-300 hover:bg-slate-800">
              Cancelar
            </Button>
            <Button onClick={confirmDelete} className="bg-rose-600 text-white hover:bg-rose-700">
              Continuar a Microsoft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recibir Compra Modal */}
      <Dialog open={!!receiveItem} onOpenChange={(o) => !o && setReceiveItem(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Recibir Lote en Nicaragua</DialogTitle>
            <DialogDescription className="text-slate-400">
              Llegada de <span className="font-medium text-emerald-400">{receiveItem?.code}</span> - {receiveItem?.productName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReceive} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Fecha de Llegada</Label>
              <Input type="date" required 
                value={receiveData.arrivalDate} 
                onChange={e => setReceiveData({...receiveData, arrivalDate: e.target.value})}
                className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Costo Envío Unitario (USD)</Label>
              <Input type="number" step="0.01" min="0" required 
                value={receiveData.shippingUnit} 
                onChange={e => setReceiveData({...receiveData, shippingUnit: e.target.value})}
                className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Categoría</Label>
              <Select 
                required 
                value={receiveData.category} 
                onValueChange={v => setReceiveData({...receiveData, category: v})}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setReceiveItem(null)} className="hover:bg-slate-800 text-slate-300">Cancelar</Button>
              <Button type="submit" disabled={isReceiving} className="bg-emerald-600 hover:bg-emerald-700 font-medium">
                {isReceiving ? 'Confirmando...' : 'Confirmar Llegada'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
