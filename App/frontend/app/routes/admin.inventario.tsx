import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArchiveIcon, ArrowMoveDownLeftIcon, Delete02Icon, File01Icon, Package01Icon, PackageAddIcon, PackageIcon, PackageMovingIcon, RefreshIcon, DeliveryTruck01Icon, DollarCircleIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MetaFunction } from '@remix-run/node';
import {
  useGetPurchasesQuery,
  useGetInventoryKpisQuery,
  useGetCurrentInventoryQuery,
  useCreatePurchaseMutation,
  useDeletePurchaseMutation,
  useReportArrivalMutation,
  useSimulateCostMutation,
  useRevertPurchaseMutation,
  type Purchase
} from '~/store/api/inventoryV1Api';
import { useGetCategoriesQuery, useGetAdminCatalogQuery } from '~/store/api/catalogAdminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { DataTable } from '~/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DatePicker } from '~/components/ui/date-picker';

import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { getSupabaseClient } from '~/lib/supabase.client';
import { Spinner } from "~/components/ui/spinner";

export const meta: MetaFunction = () => {
  return [{ title: 'Inventario | Gyro Store Admin' }];
};

const TOP_TABS = [
  { value: 'purchases', label: 'Registro de compras', icon: File01Icon },
  { value: 'inventory', label: 'Inventario', icon: PackageIcon },
] as const;

const NESTED_TAB = 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

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
  const [revertPurchase] = useRevertPurchaseMutation();
  const [simulateCost, { data: simulatedData, isLoading: isSimulating }] = useSimulateCostMutation();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: allProducts = [] } = useGetAdminCatalogQuery();

  const allMappedCodes = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      if (p.variantMappings) {
        for (const mapping of Object.values(p.variantMappings)) {
          for (const code of mapping.codes) set.add(code);
        }
      }
    }
    return set;
  }, [allProducts]);

  const reduceMotion = useReducedMotion();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('purchases');

  const [receiveItem, setReceiveItem] = useState<any>(null);
  const [receiveData, setReceiveData] = useState({
    arrivalDate: '',
    shippingUnit: '',
    suggestedPrice: ''
  });
  const [simulatedPrice, setSimulatedPrice] = useState<number | null>(null);
  const [inventoryType, setInventoryType] = useState('current');

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (receiveItem && receiveData.shippingUnit !== '') {
        const val = Number(receiveData.shippingUnit);
        if (val >= 0 && !isNaN(val)) {
          simulateCost({ id: receiveItem.id, shippingUnit: val })
            .unwrap()
            .then(res => setSimulatedPrice(res.precioSugerido))
            .catch(err => {
              console.error("Error simulando costo:", err);
              setSimulatedPrice(null);
            });
        }
      } else {
        setSimulatedPrice(null);
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

  const handleRevert = async (id: string, productName: string) => {
    if (!window.confirm(`¿Estás seguro de que querés retirar "${productName}" de bodega y regresarlo a compras en tránsito?`)) {
      return;
    }
    const tId = toast.loading('Retirando de bodega...');
    try {
      await revertPurchase(id).unwrap();
      toast.success('Retirado exitosamente. Ahora aparece en Registro de compras.', { id: tId });
    } catch (err: any) {
      toast.error(err?.data?.error || 'Error al revertir el lote.', { id: tId });
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
      cell: ({ row }) => <span className="font-medium text-white bg-emerald-500/20 rounded-md px-2 py-0.5 text-xs">{row.original.code}</span>,
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
        const prefix = diffDays > 0 ? '+' : '';
        if (diffDays > 0) {
          return <span className="tabular-nums font-medium text-warning bg-warning/10 rounded-md px-1.5 py-0.5 text-xs">{prefix}{diffDays} días</span>;
        }
        if (diffDays < 0) {
          return <span className="tabular-nums font-medium text-success bg-success/10 rounded-md px-1.5 py-0.5 text-xs">{prefix}{diffDays} días</span>;
        }
        return <span className="tabular-nums text-muted-foreground">{diffDays} días</span>;
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
              <Badge variant="outline" className="border-info/40 bg-info/15 text-info shadow-[0_0_8px_oklch(0.7_0.15_245/0.15)]">En tránsito</Badge>
            ) : dynamicStatus === 'china' ? (
              <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning shadow-[0_0_8px_oklch(0.8_0.16_78/0.15)]">En China</Badge>
            ) : s === 'received' ? (
              <Badge variant="outline" className="border-success/40 bg-success/15 text-success shadow-[0_0_8px_oklch(0.72_0.16_150/0.15)]">Recibido</Badge>
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
          <div className="flex gap-1.5 justify-end">
            <Button
              size="sm"
              onClick={() => {
                setReceiveItem(row.original);
                setReceiveData({
                  arrivalDate: new Date().toISOString().split('T')[0],
                  shippingUnit: '',
                  suggestedPrice: ''
                });
              }}
              className="h-7 gap-1.5 shadow-sm shadow-primary/20 transition-all duration-200 active:scale-[0.96]"
            >
              <HugeiconsIcon icon={ArrowMoveDownLeftIcon} size={14} strokeWidth={2} />
              Ingreso a bodega
            </Button>
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => setDeleteId(row.original.id)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 active:scale-[0.92]"
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
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
      id: 'isMapped',
      header: 'Catálogo',
      meta: { align: 'center' },
      cell: ({ row }) => {
        const isMapped = allMappedCodes.has(row.original.code);
        return (
          <div className="flex justify-center">
            {isMapped ? (
              <Badge variant="outline" className="w-fit text-[10px] h-5 px-1.5 bg-primary/20 text-white border-primary/40">
                Mapeado
              </Badge>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        );
      },
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
    },
    {
      id: 'gananciaEsperada',
      header: 'Ganancia esperada (C$)',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const ganancia = row.original.gananciaUnitCordobas ?? (
          row.original.suggestedPrice && row.original.costeFinalCordobas 
            ? row.original.suggestedPrice - row.original.costeFinalCordobas 
            : 0
        );
        return <span className="tabular-nums font-medium text-emerald-500">
          {ganancia ? `C$ ${ganancia.toFixed(2)}` : '—'}
        </span>;
      },
    },
    {
      id: 'actions',
      meta: { align: 'right' },
      cell: ({ row }) => {
        // Solo permitir revertir si no tiene ventas (ni reservas)
        const canRevert = !row.original.quantitySold && !row.original.quantityReserved;
        
        return (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!canRevert}
              onClick={() => handleRevert(row.original.id, row.original.productName)}
              className="h-7 gap-1.5 border-warning/40 text-warning hover:bg-warning hover:text-background hover:border-warning shadow-[0_0_6px_oklch(0.8_0.16_78/0.1)] hover:shadow-[0_0_12px_oklch(0.8_0.16_78/0.2)] transition-all duration-200 active:scale-[0.96] disabled:opacity-40 disabled:shadow-none"
              title={canRevert ? "Regresar a Registro de Compras" : "No se puede retirar: ya tiene ventas o reservas registradas"}
            >
              <HugeiconsIcon icon={PackageMovingIcon} size={14} strokeWidth={2} />
              Retirar de bodega
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Control de Inventario</h2>
        <p className="text-muted-foreground">Registro de compras en China y stock recibido en bodega.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="inline-flex w-fit rounded-lg bg-muted/50 border border-border/50 p-1 gap-1">
          {TOP_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeTab === tab.value && (
                <motion.div
                  layoutId="inventory-tab-pill"
                  className="absolute inset-0 rounded-md bg-primary shadow-sm"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <HugeiconsIcon icon={tab.icon} size={16} strokeWidth={2} />
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        <TabsContent value="purchases" className="space-y-6 outline-none">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="relative overflow-hidden border-t-2 border-t-tone-sky/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="font-medium">Compras registradas</CardDescription>
                  <div className="grid size-9 place-items-center rounded-xl bg-tone-sky/10">
                    <HugeiconsIcon icon={PackageIcon} size={18} strokeWidth={2} className="text-tone-sky" />
                  </div>
                </div>
                <CardTitle className="text-3xl tabular-nums">{kpis?.totalPurchases || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="relative overflow-hidden border-t-2 border-t-tone-emerald/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="font-medium">Inversión estimada (USD)</CardDescription>
                  <div className="grid size-9 place-items-center rounded-xl bg-tone-emerald/10">
                    <HugeiconsIcon icon={DollarCircleIcon} size={18} strokeWidth={2} className="text-tone-emerald" />
                  </div>
                </div>
                <CardTitle className="text-3xl tabular-nums text-primary">${kpis?.totalInversionConImpuestosUsd?.toFixed(2) || '0.00'}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="relative overflow-hidden border-t-2 border-t-tone-amber/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="font-medium">En tránsito</CardDescription>
                  <div className="grid size-9 place-items-center rounded-xl bg-tone-amber/10">
                    <HugeiconsIcon icon={DeliveryTruck01Icon} size={18} strokeWidth={2} className="text-tone-amber" />
                  </div>
                </div>
                <CardTitle className="text-3xl tabular-nums text-warning flex items-center gap-2">
                  {kpis?.inTransit || 0}
                  {(kpis?.inTransit ?? 0) > 0 && <HugeiconsIcon icon={Alert02Icon} size={18} strokeWidth={2} />}
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
                  <Button className="font-semibold bg-primary hover:bg-primary/85 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 active:scale-[0.96] hover:shadow-lg hover:shadow-primary/25">
                    <HugeiconsIcon icon={PackageAddIcon} size={16} strokeWidth={2} className="mr-2" />
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

                    <Button type="submit" className="w-full font-semibold mt-4 bg-primary hover:bg-primary/85 shadow-md shadow-primary/20 transition-all duration-200 active:scale-[0.97] hover:shadow-lg hover:shadow-primary/25" disabled={isRegistering}>
  {isRegistering && <Spinner className="mr-2" />}
  Confirmar compra
</Button>
                  </form>
                </DialogContent>
              </Dialog>

            </CardHeader>
            <CardContent>
              {!purchases.length && !isLoadingPurchases ? (
                <div className="text-center py-12 border border-dashed rounded-lg bg-muted/40">
                  <HugeiconsIcon icon={File01Icon} size={40} strokeWidth={2} className="text-muted-foreground mx-auto mb-3 opacity-50" />
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
          <Tabs value={inventoryType} onValueChange={setInventoryType} className="space-y-6 outline-none">
            <div className="inline-flex w-fit rounded-lg bg-muted/50 border border-border/50 p-1 gap-1">
              {([
                { value: 'current', label: 'Inventario actual', icon: PackageIcon },
                { value: 'migrated', label: 'Inventario migrado', icon: ArchiveIcon },
              ] as const).map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setInventoryType(tab.value)}
                  className={`relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    inventoryType === tab.value
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {inventoryType === tab.value && (
                    <motion.div
                      layoutId="inventory-nested-pill"
                      className="absolute inset-0 rounded-md bg-primary shadow-sm"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <HugeiconsIcon icon={tab.icon} size={16} strokeWidth={2} />
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>

            <TabsContent value="current" className="outline-none m-0">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Existencias actuales</CardTitle>
                    <CardDescription>Stock recibido (listo para venta).</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={refetch} disabled={isLoading} aria-label="Refrescar" className="transition-all duration-200 active:scale-[0.92]">
                    <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={2} className={isLoading ? 'animate-spin' : ''} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {!inventory.length && !isLoading ? (
                    <div className="text-center py-12 border border-dashed rounded-lg bg-muted/40">
                      <HugeiconsIcon icon={PackageAddIcon} size={40} strokeWidth={2} className="text-muted-foreground mx-auto mb-3 opacity-50" />
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
                  <HugeiconsIcon icon={Package01Icon} size={40} strokeWidth={2} className="text-muted-foreground mx-auto mb-3 opacity-50" />
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
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="transition-all duration-200 active:scale-[0.97]">
  {isDeleting && <Spinner className="mr-2" />}
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

            {simulatedPrice !== null && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm text-white">
                  <span className="font-semibold">Precio sugerido calculado:</span> C$ {simulatedPrice.toFixed(2)}
                </p>
                <p className="text-xs text-white/70 mt-1">
                  Si dejás el campo de abajo vacío, este será el precio que se asigne automáticamente.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Precio tentativo (C$)</Label>
              <Input type="number" step="0.01" min="0"
                value={receiveData.suggestedPrice}
                onChange={e => setReceiveData({ ...receiveData, suggestedPrice: e.target.value })}
                placeholder={simulatedPrice !== null ? String(simulatedPrice) : '0.00'}
              />
              <p className="text-xs text-muted-foreground">Opcional. Si lo dejás vacío se guarda el sugerido.</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setReceiveItem(null)}>Cancelar</Button>
              <Button type="submit" className="font-medium bg-primary hover:bg-primary/85 shadow-md shadow-primary/20 transition-all duration-200 active:scale-[0.97] hover:shadow-lg hover:shadow-primary/25" disabled={isReceiving}>
  {isReceiving && <Spinner className="mr-2" />}
  Confirmar llegada
</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
