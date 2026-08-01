import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArchiveIcon, ArrowMoveDownLeftIcon, Delete02Icon, File01Icon, Package01Icon, PackageAddIcon, PackageIcon, PackageMovingIcon, RefreshIcon, DeliveryTruck01Icon, DollarCircleIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, useReducedMotion } from 'framer-motion';
import type { MetaFunction } from '@remix-run/node';
import { arrivalInputSchema, newPurchaseInputSchema } from '@shared/schemas';
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
import { QueryState } from '~/components/ui/QueryState';
import { ColumnDef } from '@tanstack/react-table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '~/components/ui/field';
import { DatePicker } from '~/components/ui/date-picker';

import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { getSupabaseClient } from '~/lib/supabase.client';
import { formatCordobas, formatUsd } from '~/lib/formatters';
import { Spinner } from "~/components/ui/spinner";

export const meta: MetaFunction = () => {
  return [{ title: 'Inventario | Gyro Store Admin' }];
};

const TOP_TABS = [
  { value: 'purchases', label: 'Registro de compras', icon: File01Icon },
  { value: 'inventory', label: 'Inventario', icon: PackageIcon },
] as const;

const NESTED_TAB = 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

// Los dos formularios de esta ruta salen de los schemas del backend en
// `@shared/schemas`, recortados a lo que el formulario realmente pide:
//
//  · `code` lo asigna el servidor, así que no se pide ni se valida acá.
//  · `category` no se pide al recibir: el lote ya la trae de la compra.
//  · Los <input> devuelven string, y `newPurchaseInputSchema` espera number: se
//    envuelve con `z.coerce`, pero un campo vacío tiene que FALLAR, no volverse 0
//    — por eso `''` se mapea a NaN antes de coercionar (mismo patrón que
//    `lib/validators.ts`).
const emptyToNaN = (v: unknown) => (v === '' || v === null || v === undefined ? NaN : v);

const purchaseDialogSchema = newPurchaseInputSchema
  .omit({ code: true, suggestedPrice: true })
  .extend({
    quantity: z.preprocess(emptyToNaN, z.coerce.number().int('Debe ser entero').positive('La cantidad debe ser mayor a 0.')),
    costUnit: z.preprocess(emptyToNaN, z.coerce.number().min(0, 'No puede ser negativo')),
    taxUnit: z.preprocess(emptyToNaN, z.coerce.number().min(0, 'No puede ser negativo')),
    purchaseDate: z.string().min(1, 'La fecha de compra es obligatoria.'),
  });
// Entrada (lo que sostienen los inputs, strings) ≠ salida (lo ya coercionado):
// RHF necesita los dos por separado para que el resolver tipe bien.
type PurchaseDialogValues = z.input<typeof purchaseDialogSchema>;
type PurchaseDialogOutput = z.output<typeof purchaseDialogSchema>;

const EMPTY_PURCHASE_DIALOG = {
  productName: '',
  quantity: '',
  costUnit: '',
  taxUnit: '',
  lot: '',
  purchaseDate: '',
  category: '',
} as unknown as PurchaseDialogValues;

// `arrivalInputSchema` no pide categoría: el lote ya la trae de la compra.
const receiveSchema = arrivalInputSchema.extend({
  arrivalDate: z.string().min(1, 'La fecha de llegada es obligatoria.'),
  shippingUnit: z.preprocess(emptyToNaN, z.coerce.number().min(0, 'No puede ser negativo')),
  // Opcional: vacío significa "usá el sugerido que calculó el servidor".
  suggestedPrice: z.union([z.literal(''), z.coerce.number().min(0, 'No puede ser negativo')]).optional(),
});
type ReceiveFormValues = z.input<typeof receiveSchema>;
type ReceiveFormOutput = z.output<typeof receiveSchema>;

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
  const [simulatedPrice, setSimulatedPrice] = useState<number | null>(null);
  const [inventoryType, setInventoryType] = useState('current');

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Formulario: recibir lote en Nicaragua ──
  // `arrivalInputSchema` es el contrato del backend; `category` no se pide acá
  // (el lote ya la trae de la compra), así que se omite del formulario.
  const receiveForm = useForm<ReceiveFormValues, any, ReceiveFormOutput>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { arrivalDate: '', shippingUnit: '', suggestedPrice: '' } as ReceiveFormValues,
  });
  const shippingUnitRaw = receiveForm.watch('shippingUnit');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (receiveItem && shippingUnitRaw !== '' && shippingUnitRaw !== undefined) {
        const val = Number(shippingUnitRaw);
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
  }, [shippingUnitRaw, receiveItem, simulateCost]);

  const handleReceive = receiveForm.handleSubmit(async (values) => {
    if (!receiveItem) return;
    try {
      await reportArrival({
        id: receiveItem.id,
        body: {
          arrivalDate: values.arrivalDate,
          shippingUnit: Number(values.shippingUnit),
          suggestedPrice: values.suggestedPrice ? Number(values.suggestedPrice) : undefined
        }
      }).unwrap();
      setReceiveItem(null);
      receiveForm.reset();
      toast.success('Compra recibida correctamente');
    } catch (err: any) {
      toast.error(err?.data?.error || 'Error al recibir la compra');
    }
  });

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

  // ── Formulario: registrar compra en China ──
  // El contrato es `newPurchaseInputSchema` (backend). `code` se omite: lo asigna
  // el servidor. Los numéricos van por `z.coerce` para que el input de texto valide.
  const purchaseForm = useForm<PurchaseDialogValues, any, PurchaseDialogOutput>({
    resolver: zodResolver(purchaseDialogSchema),
    defaultValues: EMPTY_PURCHASE_DIALOG,
  });

  const handleRegisterPurchase = purchaseForm.handleSubmit(async (values) => {
    try {
      await createPurchase({
        productName: values.productName,
        quantity: Number(values.quantity),
        costUnit: Number(values.costUnit),
        taxUnit: Number(values.taxUnit),
        lot: values.lot,
        purchaseDate: values.purchaseDate,
        category: values.category,
        code: '' // Generado por backend
      }).unwrap();
      toast.success('Compra registrada. Código auto-asignado.');
      setIsDialogOpen(false);
      purchaseForm.reset(EMPTY_PURCHASE_DIALOG);
    } catch (error: any) {
      toast.error(error?.data?.error || 'Error al registrar la compra.');
    }
  });

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
      cell: ({ row }) => <span className="font-mono text-xs font-medium text-primary-2 bg-primary/15 rounded-md px-2 py-0.5">{row.original.code}</span>,
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
        return <span className="nums text-muted-foreground">{formatUsd(cost)}</span>;
      },
    },
    {
      id: 'totalCost',
      header: 'Total',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const cost = (row.original.costUnit || 0) + (row.original.taxUnit || 0);
        const total = cost * (row.original.quantity || 0);
        return <span className="nums font-semibold text-primary-2">{formatUsd(total)}</span>;
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
                receiveForm.reset({
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
              <Badge variant="outline" className="w-fit text-[10px] h-5 px-1.5 bg-primary/15 text-primary-2 border-primary/40">
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
        return <span className="nums text-muted-foreground">
          {costeFinal ? formatCordobas(costeFinal, 'C$', 2) : '—'}
        </span>;
      },
    },
    {
      accessorKey: 'suggestedPrice',
      header: 'Precio tentativo (C$)',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const suggested = row.original.suggestedPrice;
        return <span className="nums font-medium text-foreground">
          {suggested ? formatCordobas(suggested, 'C$', 2) : '—'}
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
        return <span className="nums font-medium text-success">
          {ganancia ? formatCordobas(ganancia, 'C$', 2) : '—'}
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
                <CardTitle className="text-3xl nums text-primary-2">{formatUsd(kpis?.totalInversionConImpuestosUsd ?? 0)}</CardTitle>
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
                    <Field data-invalid={!!purchaseForm.formState.errors.productName}>
                      <FieldLabel htmlFor="productName" required>Nombre del producto</FieldLabel>
                      <Input
                        id="productName"
                        placeholder="Ej. iPhone 13 Pro Max"
                        aria-required
                        aria-invalid={!!purchaseForm.formState.errors.productName}
                        {...purchaseForm.register('productName')}
                      />
                      <FieldError errors={[purchaseForm.formState.errors.productName]} />
                    </Field>

                    <Field data-invalid={!!purchaseForm.formState.errors.purchaseDate}>
                      <FieldLabel htmlFor="purchaseDate" required>Fecha de compra</FieldLabel>
                      <Controller
                        control={purchaseForm.control}
                        name="purchaseDate"
                        render={({ field }) => (
                          <DatePicker
                            id="purchaseDate"
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Elegí la fecha de compra"
                          />
                        )}
                      />
                      <FieldError errors={[purchaseForm.formState.errors.purchaseDate]} />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field data-invalid={!!purchaseForm.formState.errors.quantity}>
                        <FieldLabel htmlFor="quantity" required>Cantidad</FieldLabel>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          aria-required
                          aria-invalid={!!purchaseForm.formState.errors.quantity}
                          {...purchaseForm.register('quantity')}
                        />
                        <FieldError errors={[purchaseForm.formState.errors.quantity]} />
                      </Field>
                      <Field data-invalid={!!purchaseForm.formState.errors.lot}>
                        <FieldLabel htmlFor="lot" required>Nº seguimiento / lote</FieldLabel>
                        <Input
                          id="lot"
                          placeholder="Tracking"
                          aria-required
                          aria-invalid={!!purchaseForm.formState.errors.lot}
                          {...purchaseForm.register('lot')}
                        />
                        <FieldError errors={[purchaseForm.formState.errors.lot]} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field data-invalid={!!purchaseForm.formState.errors.costUnit}>
                        <FieldLabel htmlFor="unitCost" required>Costo unit. (USD)</FieldLabel>
                        <Input
                          id="unitCost"
                          type="number"
                          min="0" step="0.01"
                          aria-required
                          aria-invalid={!!purchaseForm.formState.errors.costUnit}
                          {...purchaseForm.register('costUnit')}
                        />
                        <FieldError errors={[purchaseForm.formState.errors.costUnit]} />
                      </Field>
                      <Field data-invalid={!!purchaseForm.formState.errors.taxUnit}>
                        <FieldLabel htmlFor="taxUnit" required>Impuesto unit. (USD)</FieldLabel>
                        <Input
                          id="taxUnit"
                          type="number"
                          min="0" step="0.01"
                          aria-required
                          aria-invalid={!!purchaseForm.formState.errors.taxUnit}
                          {...purchaseForm.register('taxUnit')}
                        />
                        <FieldError errors={[purchaseForm.formState.errors.taxUnit]} />
                      </Field>
                    </div>

                    <Field data-invalid={!!purchaseForm.formState.errors.category}>
                      <FieldLabel htmlFor="purchase-category" required>Categoría</FieldLabel>
                      <Controller
                        control={purchaseForm.control}
                        name="category"
                        render={({ field }) => (
                          <Select value={field.value ?? ''} onValueChange={field.onChange}>
                            <SelectTrigger id="purchase-category">
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(c => (
                                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <FieldError errors={[purchaseForm.formState.errors.category]} />
                    </Field>

                    <Button type="submit" className="w-full font-semibold mt-4 bg-primary hover:bg-primary/85 shadow-md shadow-primary/20 transition-all duration-200 active:scale-[0.97] hover:shadow-lg hover:shadow-primary/25" disabled={isRegistering}>
  {isRegistering && <Spinner className="mr-2" />}
  Confirmar compra
</Button>
                  </form>
                </DialogContent>
              </Dialog>

            </CardHeader>
            <CardContent>
              <QueryState
                loading={isLoadingPurchases}
                empty={purchases.length === 0}
                emptyFallback={
                  <div className="text-center py-12 border border-dashed rounded-lg bg-muted/40">
                    <HugeiconsIcon icon={File01Icon} size={40} strokeWidth={2} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-foreground font-medium">No hay compras recientes</p>
                    <p className="text-muted-foreground text-sm mt-1">El historial aparecerá aquí cuando registres entradas.</p>
                    <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                      <HugeiconsIcon icon={PackageAddIcon} size={16} strokeWidth={2} className="mr-2" />
                      Registrar entrada
                    </Button>
                  </div>
                }
              >
                <DataTable
                  columns={finalPurchaseColumns}
                  data={purchases}
                  searchPlaceholder="Buscar por código o producto..."
                />
              </QueryState>
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
                  <QueryState
                    loading={isLoading}
                    error={isError}
                    empty={inventory.length === 0}
                    errorMessage="No se pudo cargar el inventario."
                    onRetry={refetch}
                    emptyFallback={
                      <div className="text-center py-12 border border-dashed rounded-lg bg-muted/40">
                        <HugeiconsIcon icon={PackageAddIcon} size={40} strokeWidth={2} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-foreground font-medium">Bodega vacía</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          El stock aparece acá cuando reportás la llegada de una compra en tránsito.
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => setActiveTab('purchases')}>
                          <HugeiconsIcon icon={File01Icon} size={16} strokeWidth={2} className="mr-2" />
                          Ir a Registro de compras
                        </Button>
                      </div>
                    }
                  >
                    <DataTable
                      columns={inventoryColumns}
                      data={inventory}
                      searchPlaceholder="Buscar producto..."
                    />
                  </QueryState>
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
            <Field data-invalid={!!receiveForm.formState.errors.arrivalDate}>
              <FieldLabel htmlFor="receive-arrival-date" required>Fecha de llegada</FieldLabel>
              <Controller
                control={receiveForm.control}
                name="arrivalDate"
                render={({ field }) => (
                  <DatePicker
                    id="receive-arrival-date"
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    placeholder="Elegí la fecha de llegada"
                  />
                )}
              />
              <FieldError errors={[receiveForm.formState.errors.arrivalDate]} />
            </Field>
            <Field data-invalid={!!receiveForm.formState.errors.shippingUnit}>
              <FieldLabel htmlFor="receive-shipping" required>Costo envío unitario (USD)</FieldLabel>
              <Input
                id="receive-shipping"
                type="number" step="0.01" min="0"
                placeholder="0.00"
                aria-required
                aria-invalid={!!receiveForm.formState.errors.shippingUnit}
                {...receiveForm.register('shippingUnit')}
              />
              <FieldError errors={[receiveForm.formState.errors.shippingUnit]} />
            </Field>

            {simulatedPrice !== null && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Precio sugerido calculado:</span>{' '}
                  <span className="nums">{formatCordobas(simulatedPrice, 'C$', 2)}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Si dejás el campo de abajo vacío, este será el precio que se asigne automáticamente.
                </p>
              </div>
            )}

            <Field data-invalid={!!receiveForm.formState.errors.suggestedPrice}>
              <FieldLabel htmlFor="receive-suggested">Precio tentativo (C$)</FieldLabel>
              <Input
                id="receive-suggested"
                type="number" step="0.01" min="0"
                placeholder={simulatedPrice !== null ? String(simulatedPrice) : '0.00'}
                aria-invalid={!!receiveForm.formState.errors.suggestedPrice}
                {...receiveForm.register('suggestedPrice')}
              />
              <FieldDescription>Opcional. Si lo dejás vacío se guarda el sugerido.</FieldDescription>
              <FieldError errors={[receiveForm.formState.errors.suggestedPrice]} />
            </Field>
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
