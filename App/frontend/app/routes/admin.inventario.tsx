import { useState, useEffect } from 'react';
import type { MetaFunction } from '@remix-run/node';
import {
  useGetPurchasesQuery,
  useGetInventoryKpisQuery,
  useGetCurrentInventoryQuery,
  useCreatePurchaseMutation,
  useDeletePurchaseMutation,
  useReportArrivalMutation,
  useSimulateCostMutation,
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
import { DatePicker } from '~/components/ui/date-picker';
import { PackagePlus, RefreshCcw, AlertTriangle, Boxes, Archive, FileText, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { getSupabaseClient } from '~/lib/supabase.client';

export const meta: MetaFunction = () => {
  return [{ title: 'Inventario | Gyro Store Admin' }];
};

// Clases de la píldora activa en los segmentos: el preset pinta lo activo con el
// primario (cyan), no con verde. Un solo lugar para mantener la consistencia.
const ACTIVE_TAB = 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

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
  const [simulateCost, { data: simulatedData, isLoading: isSimulating }] = useSimulateCostMutation();
  const { data: categories = [] } = useGetCategoriesQuery();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('purchases');

  const [receiveItem, setReceiveItem] = useState<any>(null);
  const [receiveData, setReceiveData] = useState({
    arrivalDate: '',
    shippingUnit: '',
    suggestedPrice: ''
  });
  const [inventoryType, setInventoryType] = useState('current');

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (receiveItem && receiveData.shippingUnit) {
        const val = Number(receiveData.shippingUnit);
        if (val >= 0 && !isNaN(val)) {
          simulateCost({ id: receiveItem.id, shippingUnit: val }).catch(() => {});
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [receiveData.shippingUnit, receiveItem, simulateCost]);

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveItem) return;
    try {
      await reportArrival({
        id: receiveItem.id,
        body: {
          arrivalDate: receiveData.arrivalDate,
          shippingUnit: Number(receiveData.shippingUnit),
          suggestedPrice: receiveData.suggestedPrice ? Number(receiveData.suggestedPrice) : undefined
        }
      }).unwrap();
      setReceiveItem(null);
      setReceiveData({ arrivalDate: '', shippingUnit: '', suggestedPrice: '' });
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
    category: '',
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
        category: formData.category,
        code: '' // Generado por backend
      }).unwrap();
      toast.success('Compra registrada. Código auto-asignado.');
      setIsDialogOpen(false);
      setFormData({ productName: '', quantity: '', unitCost: '', taxUnit: '', lot: '', purchaseDate: '', category: '' });
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
      cell: ({ row }) => <span className="font-medium text-primary">{row.original.code}</span>,
    },
    {
      accessorKey: 'lot',
      header: 'Lote',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.lot || '—'}</span>,
    },
    {
      accessorKey: 'productName',
      header: 'Producto',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.productName}</span>,
    },
    {
      id: 'departureDate',
      header: 'Salida estimada',
      cell: ({ row }) => {
        const departure = getDepartureDate(row.original.purchaseDate);
        return <span className="tabular-nums text-muted-foreground">{departure || '—'}</span>;
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Cant.',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums text-foreground">{row.original.quantity}</span>,
    },
    {
      id: 'finalUnitCost',
      header: 'Costo U.',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const cost = (row.original.costUnit || 0) + (row.original.taxUnit || 0);
        return <span className="tabular-nums text-muted-foreground">${cost.toFixed(2)}</span>;
      },
    },
    {
      id: 'totalCost',
      header: 'Total',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const cost = (row.original.costUnit || 0) + (row.original.taxUnit || 0);
        const total = cost * (row.original.quantity || 0);
        return <span className="tabular-nums font-semibold text-primary">${total.toFixed(2)}</span>;
      },
    },
    {
      id: 'transitDays',
      header: 'Días en tránsito',
      meta: { align: 'center' },
      cell: ({ row }) => {
        if (row.original.status !== 'received' || !row.original.arrivalDate) return <span className="text-muted-foreground">—</span>;
        const departure = getDepartureDate(row.original.purchaseDate);
        const depDate = new Date(departure);
        const arrDate = new Date(row.original.arrivalDate);
        const diffMs = arrDate.getTime() - depDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const color = diffDays > 0 ? 'text-warning' : (diffDays < 0 ? 'text-success' : 'text-muted-foreground');
        const prefix = diffDays > 0 ? '+' : '';
        return <span className={`tabular-nums font-medium ${color}`}>{prefix}{diffDays} días</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      meta: { align: 'center' },
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
          <div className="flex justify-center">
            {dynamicStatus === 'transit' ? (
              <Badge variant="outline" className="border-info/30 bg-info/10 text-info">En tránsito</Badge>
            ) : dynamicStatus === 'china' ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">En China</Badge>
            ) : s === 'received' ? (
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Recibido</Badge>
            ) : (
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">{s}</Badge>
            )}
          </div>
        );
      }
    },
    {
      id: 'actions',
      meta: { align: 'right' },
      cell: ({ row }) => {
        if (row.original.status !== 'china') return null;
        return (
          <div className="flex gap-1 justify-end">
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                setReceiveItem(row.original);
                setReceiveData({
                  arrivalDate: new Date().toISOString().split('T')[0],
                  shippingUnit: '',
                  suggestedPrice: ''
                });
              }}
              className="h-8 text-primary hover:text-primary hover:bg-primary/10"
            >
              Recibir
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => setDeleteId(row.original.id)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.productName}</span>,
    },
    {
      accessorKey: 'quantityOriginal',
      header: 'Cantidad',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.quantityOriginal}</span>,
    },
    {
      accessorKey: 'available',
      header: 'Stock disponible',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums font-semibold text-primary">{row.original.available}</span>,
    },
    {
      accessorKey: 'quantitySold',
      header: 'Vendidos',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.quantitySold || 0}</span>,
    },
    {
      accessorKey: 'costeFinalCordobas',
      header: 'Coste final (C$)',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const costeFinal = row.original.costeFinalCordobas;
        return <span className="tabular-nums text-muted-foreground">
          {costeFinal ? `C$ ${costeFinal.toFixed(2)}` : '—'}
        </span>;
      },
    },
    {
      accessorKey: 'suggestedPrice',
      header: 'Precio tentativo (C$)',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const suggested = row.original.suggestedPrice;
        return <span className="tabular-nums font-medium text-foreground">
          {suggested ? `C$ ${suggested.toFixed(2)}` : '—'}
        </span>;
      },
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Control de Inventario</h2>
          <p className="text-muted-foreground">Registro de compras en China y stock recibido en bodega.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="purchases" className={ACTIVE_TAB}>
              <FileText className="w-4 h-4 mr-2" /> Registro de compras
            </TabsTrigger>
            <TabsTrigger value="inventory" className={ACTIVE_TAB}>
              <Boxes className="w-4 h-4 mr-2" /> Inventario
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

        <TabsContent value="purchases" className="space-y-6 outline-none">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">Compras registradas</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{kpis?.totalPurchases || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">Inversión estimada (USD)</CardDescription>
                <CardTitle className="text-3xl tabular-nums text-primary">${kpis?.totalInversionConImpuestosUsd?.toFixed(2) || '0.00'}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">En tránsito</CardDescription>
                <CardTitle className="text-3xl tabular-nums text-warning flex items-center gap-2">
                  {kpis?.inTransit || 0} <AlertTriangle className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Historial de compras</CardTitle>
                <CardDescription>Registro detallado de ingresos al inventario.</CardDescription>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-[0.98]">
                    <PackagePlus className="w-4 h-4 mr-2" />
                    Registrar entrada
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl">Registrar compra en China</DialogTitle>
                    <DialogDescription>
                      El código GS-IN-XX se asigna automáticamente y se calcula la fecha de salida.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleRegisterPurchase} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="productName">Nombre del producto</Label>
                      <Input
                        id="productName"
                        value={formData.productName}
                        onChange={e => setFormData({ ...formData, productName: e.target.value })}
                        placeholder="Ej. iPhone 13 Pro Max"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purchaseDate">Fecha de compra</Label>
                      <DatePicker
                        id="purchaseDate"
                        value={formData.purchaseDate}
                        onChange={v => setFormData({ ...formData, purchaseDate: v })}
                        placeholder="Elegí la fecha de compra"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Cantidad</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lot">Nº seguimiento / lote</Label>
                        <Input
                          id="lot"
                          value={formData.lot}
                          onChange={e => setFormData({ ...formData, lot: e.target.value })}
                          placeholder="Tracking"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="unitCost">Costo unit. (USD)</Label>
                        <Input
                          id="unitCost"
                          type="number"
                          min="0" step="0.01"
                          value={formData.unitCost}
                          onChange={e => setFormData({ ...formData, unitCost: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="taxUnit">Impuesto unit. (USD)</Label>
                        <Input
                          id="taxUnit"
                          type="number"
                          min="0" step="0.01"
                          value={formData.taxUnit}
                          onChange={e => setFormData({ ...formData, taxUnit: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <Select
                        required
                        value={formData.category}
                        onValueChange={v => setFormData({ ...formData, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button type="submit" loading={isRegistering} className="w-full font-semibold mt-4 bg-primary hover:bg-primary/90 shadow-md">
                      Confirmar compra
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

            </CardHeader>
            <CardContent>
              {!purchases.length && !isLoadingPurchases ? (
                <div className="text-center py-12 border border-dashed rounded-lg bg-muted/40">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-foreground font-medium">No hay compras recientes</p>
                  <p className="text-muted-foreground text-sm mt-1">El historial aparecerá aquí cuando registres entradas.</p>
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
              <TabsList>
                <TabsTrigger value="current" className={ACTIVE_TAB}>
                  <Boxes className="w-4 h-4 mr-2" /> Inventario actual
                </TabsTrigger>
                <TabsTrigger value="migrated" className={ACTIVE_TAB}>
                  <Archive className="w-4 h-4 mr-2" /> Inventario migrado
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Tabs value={inventoryType} className="outline-none">
            <TabsContent value="current" className="outline-none m-0">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Existencias actuales</CardTitle>
                    <CardDescription>Stock recibido (listo para venta).</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={refetch} disabled={isLoading} aria-label="Refrescar">
                    <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {!inventory.length && !isLoading ? (
                    <div className="text-center py-12 border border-dashed rounded-lg bg-muted/40">
                      <PackagePlus className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-foreground font-medium">Bodega vacía</p>
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
            <TabsContent value="migrated" className="outline-none m-0">
              <Card>
                <CardContent className="text-center py-12">
                  <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-foreground font-medium">Inventario migrado</p>
                  <p className="text-muted-foreground text-sm mt-1">Próximamente.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Eliminar Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">¿Re-autenticar para eliminar?</DialogTitle>
            <DialogDescription className="mt-2">
              Vas a ser redirigido a Microsoft para confirmar tu identidad. Tras iniciar sesión nuevamente, la compra será eliminada y el código reciclado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={isDeleting}>
              Continuar a Microsoft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recibir Compra Modal */}
      <Dialog open={!!receiveItem} onOpenChange={(o) => !o && setReceiveItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Recibir lote en Nicaragua</DialogTitle>
            <DialogDescription>
              Llegada de <span className="font-medium text-primary">{receiveItem?.code}</span> — {receiveItem?.productName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReceive} className="space-y-4">
            <div className="space-y-2">
              <Label>Fecha de llegada</Label>
              <DatePicker
                value={receiveData.arrivalDate}
                onChange={v => setReceiveData({ ...receiveData, arrivalDate: v })}
                placeholder="Elegí la fecha de llegada"
              />
            </div>
            <div className="space-y-2">
              <Label>Costo envío unitario (USD)</Label>
              <Input type="number" step="0.01" min="0" required
                value={receiveData.shippingUnit}
                onChange={e => setReceiveData({ ...receiveData, shippingUnit: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {simulatedData?.precioSugerido !== undefined && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm text-primary">
                  <span className="font-semibold">Precio sugerido calculado:</span> C$ {simulatedData.precioSugerido.toFixed(2)}
                </p>
                {isSimulating && <p className="text-xs text-primary/70 mt-1">Calculando...</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label>Precio tentativo (C$)</Label>
              <Input type="number" step="0.01" min="0"
                value={receiveData.suggestedPrice}
                onChange={e => setReceiveData({ ...receiveData, suggestedPrice: e.target.value })}
                placeholder={simulatedData?.precioSugerido ? String(simulatedData.precioSugerido) : '0.00'}
              />
              <p className="text-xs text-muted-foreground">Opcional. Si lo dejás vacío se guarda el sugerido.</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setReceiveItem(null)}>Cancelar</Button>
              <Button type="submit" loading={isReceiving} className="font-medium bg-primary hover:bg-primary/90 shadow-md">
                Confirmar llegada
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
