// Portal de Ventas (doc 09 ítem 65): cotizador + registro + aprobar/rechazar
// (admin) + listado scoped por rol (lo scopea el backend, no el frontend).
//
// Reciclaje de v1 (admin.ventas.tsx + AdminSales.tsx): se recicla la idea de
// "un shell, admin y vendedor ven lo mismo, el rol decide qué botones
// aparecen" y "cotizar antes de registrar". Se reescribe todo lo demás: v1
// resolvía productos nativos+migrados con foto de recibo y admin-en-nombre-de
// un vendedor — el backend v2 (MVP Hito 3) solo tiene inventario nativo, sin
// fotos, y cada vendedor registra su propia venta (ver server/services/
// sales.ts). Un producto no puede repetirse en dos líneas (mismo límite del
// backend, evita la lógica de "distribuir reservas" de v1).
import { useMemo, useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { CheckCircle2, Link2, Package, Plus, ShoppingCart, Trash2, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DataTable } from '~/components/ui/DataTable';
import { QueryState } from '~/components/ui/QueryState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { StatusBadge, type BadgeStatus } from '~/components/ui/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { errMsg, formatCordobas } from "~/lib/formatters";
import {
  useApproveSaleMutation,
  useGetSalesQuery,
  useGetSellableProductsQuery,
  useQuoteSaleMutation,
  useRegisterSaleMutation,
  useRejectSaleMutation,
  type SaleLineInput,
  type SaleListItem,
} from '~/store/api/salesApi';
import { useGetSalidasQuery, useVincularSalidaMutation } from '~/store/api/salidasApi';
import { Spinner } from "~/components/ui/spinner";

export const meta: MetaFunction = () => [{ title: 'Ventas | Gyro Store Admin' }];

const STATUS_META: Record<string, { label: string; status: BadgeStatus }> = {
  pending_approval: { label: 'Pendiente', status: 'pending' },
  approved: { label: 'Aprobada', status: 'success' },
  paid: { label: 'Pagada', status: 'success' },
  rejected: { label: 'Rechazada', status: 'error' },
};

const STATUS_TABS = [
  { value: 'pending_approval', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
];

export default function AdminVentas() {
  const isAdmin = useAppSelector(selectIsAdmin);

  const { data: products = [] } = useGetSellableProductsQuery();
  const [quoteSale, { data: quote, isLoading: quoting }] = useQuoteSaleMutation();
  const [registerSale, { isLoading: registering }] = useRegisterSaleMutation();
  const [approveSale] = useApproveSaleMutation();
  const [rejectSale, { isLoading: rejecting }] = useRejectSaleMutation();

  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const {
    data: sales = [],
    isLoading: loadingSales,
    isError: salesError,
  } = useGetSalesQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const [lines, setLines] = useState<SaleLineInput[]>([]);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [phone, setPhone] = useState('');
  const [rejectFor, setRejectFor] = useState<SaleListItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Vincular una salida SIN factura a esta venta (cierra el "pendiente de registrar").
  const [linkFor, setLinkFor] = useState<SaleListItem | null>(null);
  const { data: pendingSalidas = [] } = useGetSalidasQuery({ estado: 'pendiente_registro' });
  const [vincularSalida, { isLoading: linking }] = useVincularSalidaMutation();

  // Solo cambia cuando refresca `products`, no en cada tecla del input.
  const productNames = useMemo(() => products.map((p) => p.productName), [products]);

  function addLine() {
    if (!productName.trim() || quantity <= 0 || salePrice < 0) {
      toast.error('Completá producto, cantidad y precio.');
      return;
    }
    if (lines.some((l) => l.productName === productName)) {
      toast.error('Ese producto ya está en la lista: quitalo y agregalo con la cantidad correcta.');
      return;
    }
    setLines((prev) => [...prev, { productName: productName.trim(), quantity, salePrice }]);
    setProductName('');
    setQuantity(1);
    setSalePrice(0);
  }

  function removeLine(name: string) {
    setLines((prev) => prev.filter((l) => l.productName !== name));
  }

  async function handleQuote() {
    if (lines.length === 0) {
      toast.error('Agregá al menos un producto.');
      return;
    }
    try {
      await quoteSale(lines).unwrap();
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo cotizar.'));
    }
  }

  async function handleRegister() {
    if (lines.length === 0) {
      toast.error('Agregá al menos un producto.');
      return;
    }
    try {
      await registerSale({ phone: phone.trim() || undefined, items: lines }).unwrap();
      toast.success('Venta registrada. Pendiente de aprobación.');
      setLines([]);
      setPhone('');
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo registrar la venta.'));
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveSale(id).unwrap();
      toast.success('Venta aprobada.');
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo aprobar la venta.'));
    }
  }

  async function handleReject() {
    if (!rejectFor || !rejectReason.trim()) {
      toast.error('El motivo de rechazo es obligatorio.');
      return;
    }
    try {
      await rejectSale({ id: rejectFor.id, reason: rejectReason.trim() }).unwrap();
      toast.success('Venta rechazada.');
      setRejectFor(null);
      setRejectReason('');
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo rechazar la venta.'));
    }
  }

  async function handleLink(salidaId: string) {
    if (!linkFor) return;
    try {
      await vincularSalida({ id: salidaId, orderId: linkFor.id }).unwrap();
      toast.success('Salida vinculada a la venta.');
      setLinkFor(null);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo vincular la salida.'));
    }
  }

  const columns = useMemo<ColumnDef<SaleListItem, unknown>[]>(() => {
    const actionsColumn: ColumnDef<SaleListItem, unknown> = {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'pending_approval' ? (
          <div className="flex justify-end gap-1.5">
            {/* Vincular salida: disponible para todos (el vendedor cierra la suya). */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLinkFor(row.original)}
              title="Vincular una salida sin factura"
            >
              <Link2 className="h-4 w-4" aria-hidden />
            </Button>
            {/* Aprobar / rechazar solo admin. */}
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" onClick={() => handleApprove(row.original.id)}>
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejectFor(row.original)}>
                  <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                </Button>
              </>
            )}
          </div>
        ) : null,
    };

    return [
      {
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('es-NI'),
      },
      { accessorKey: 'sellerEmail', header: 'Vendedor' },
      { accessorKey: 'phone', header: 'Teléfono', cell: ({ row }) => row.original.phone ?? '—' },
      {
        accessorKey: 'total',
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => <div className="text-right font-semibold">{formatCordobas(row.original.total)}</div>,
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const meta = STATUS_META[row.original.status] ?? { label: row.original.status, status: 'neutral' as const };
          return <StatusBadge status={meta.status} label={meta.label} />;
        },
      },
      actionsColumn,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const total = lines.reduce((sum, l) => sum + l.quantity * l.salePrice, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Ventas</h2>
        <p className="text-muted-foreground">Cotizá, registrá{isAdmin ? ' y aprobá' : ''} tus ventas.</p>
      </div>

      <Tabs defaultValue="quote" className="space-y-6">
        <TabsList className="bg-card border border">
          <TabsTrigger value="quote">
            <ShoppingCart className="w-4 h-4 mr-2" /> Cotizador / Registro
          </TabsTrigger>
          <TabsTrigger value="list">Listado</TabsTrigger>
        </TabsList>

        <TabsContent value="quote" className="space-y-6">
          <Card className="bg-card border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Agregar producto</CardTitle>
              <CardDescription className="text-muted-foreground">
                Elegí un producto vendible (stock disponible), cantidad y precio.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Producto</Label>
                <Input
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    const match = products.find((p) => p.productName === e.target.value);
                    if (match) setSalePrice(match.price);
                  }}
                  list="sale-product-options"
                  placeholder="Nombre del producto"
                />
                <datalist id="sale-product-options">
                  {productNames.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Precio (C$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="sm:col-span-4">
                <Button onClick={addLine} variant="outline">
                  <Plus className="h-4 w-4 mr-1.5" aria-hidden /> Agregar línea
                </Button>
              </div>
            </CardContent>
          </Card>

          {lines.length > 0 && (
            <Card className="bg-card border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Líneas de la venta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="divide-y divide-border rounded-lg border border">
                  {lines.map((line) => (
                    <div key={line.productName} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{line.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.quantity} × {formatCordobas(line.salePrice)}
                        </p>
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatCordobas(line.quantity * line.salePrice)}
                      </span>
                      <Button size="icon-sm" variant="ghost" onClick={() => removeLine(line.productName)}>
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border pt-3">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="text-xl font-bold text-primary-2 tabular-nums">{formatCordobas(total)}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Teléfono del cliente (opcional)</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="8888 8888" />
                  </div>
                  <Button variant="outline" onClick={handleQuote} disabled={quoting}>
        {quoting && <Spinner className="mr-2" />}
        Cotizar
      </Button>
                  <Button onClick={handleRegister} disabled={registering}>
        {registering && <Spinner className="mr-2" />}
        Registrar venta
      </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {quote && (
            <Card className="bg-card border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Cotización</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Comisión y ganancia estimadas — se congelan de verdad recién al aprobar la venta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quote.lines.map((line) => (
                  <div key={line.productName} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{line.productName}</span>
                      <span className="font-semibold text-foreground">{formatCordobas(line.precioUnit)} c/u</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                      <span>
                        Comisión: <span className="font-medium text-primary-2">{formatCordobas(line.comision)}</span> (
                        {Math.round(line.comisionPercent * 100)}%)
                      </span>
                      <span>
                        Ganancia tienda: <span className="font-medium text-primary-2">{formatCordobas(line.gananciaTienda)}</span>
                      </span>
                      {line.wholesale.discountPercent > 0 && (
                        <span>Mayoreo: −{Math.round(line.wholesale.discountPercent * 100)}%</span>
                      )}
                      {line.insufficientStock && (
                        <span className="font-medium text-destructive">Stock insuficiente (disp. {line.available})</span>
                      )}
                    </div>
                    {line.wholesale.warning && (
                      <p className="mt-1 text-xs font-medium text-warning">
                        Mejor hacé una cotización para obtener mejores descuentos.
                      </p>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Comisión total: <span className="font-semibold text-foreground">{formatCordobas(quote.totalComision)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Ganancia tienda: <span className="font-semibold text-foreground">{formatCordobas(quote.totalGananciaTienda)}</span>
                  </span>
                  <span className="text-lg font-bold text-primary-2">{formatCordobas(quote.total)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {lines.length === 0 && !quote && (
            <div className="rounded-lg border border-dashed border bg-muted/50 py-12 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" aria-hidden />
              <p className="font-medium text-foreground">Todavía no agregaste productos.</p>
              <p className="mt-1 text-sm text-muted-foreground">Usá el formulario de arriba para armar la venta.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-muted border border">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Card className="bg-card border shadow-sm">
            <CardContent className="pt-6">
              <QueryState
                loading={loadingSales}
                error={salesError}
                loadingFallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}
              >
                <DataTable columns={columns} data={sales} searchPlaceholder="Buscar por teléfono…" emptyText="No hay ventas en este estado." />
              </QueryState>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectFor} onOpenChange={(open) => !open && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo (obligatorio)</Label>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="¿Por qué se rechaza?" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectFor(null)}>
              Cancelar
            </Button>
            <Button onClick={handleReject} disabled={rejecting} className="bg-destructive/90">
        {rejecting && <Spinner className="mr-2" />}
        Rechazar
      </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkFor} onOpenChange={(open) => !open && setLinkFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular salida sin factura</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Elegí la salida que corresponde a esta venta. Solo aparecen las que salieron
            sin factura y siguen pendientes de registrar.
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {pendingSalidas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay salidas pendientes de registrar.
              </p>
            ) : (
              pendingSalidas.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleLink(s.id)}
                  disabled={linking}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{s.articulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.destino === 'delivery' ? 'Delivery' : 'Mostrador'} ·{' '}
                      {new Date(s.salio_at).toLocaleDateString('es-NI')}
                    </span>
                  </span>
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
