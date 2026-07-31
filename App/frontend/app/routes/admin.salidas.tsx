import { useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { PageHeader } from '~/components/layout/PageHeader';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Label } from '~/components/ui/label';
import { toast } from 'sonner';
import { DataTable } from '~/components/ui/DataTable';
import { StatusBadge } from '~/components/ui/StatusBadge';
import { QueryState } from '~/components/ui/QueryState';
import { Plus, CheckCircle, Search, Link2, XCircle } from 'lucide-react';
import {
  useGetSalidasQuery,
  useRegisterSalidaMutation,
  useLiquidarSalidaMutation,
  useVincularSalidaMutation,
  useDevolverSalidaMutation,
} from '~/store/api/salidasApi';
import { useGetAccountsQuery } from '~/store/api/cajaApi';
import { format } from 'date-fns';
import type { Salida } from '@shared/schemas';

export const meta: MetaFunction = () => {
  return [{ title: 'Salidas de Tienda | Gyro Store' }];
};

export default function AdminSalidasRoute() {
  const { data: salidas = [], isLoading, isError, refetch } = useGetSalidasQuery();
  const { data: accounts = [] } = useGetAccountsQuery();

  const [registerMut, { isLoading: isRegistering }] = useRegisterSalidaMutation();
  const [liquidarMut, { isLoading: isLiquidando }] = useLiquidarSalidaMutation();
  const [vincularMut, { isLoading: isVinculando }] = useVincularSalidaMutation();
  const [devolverMut, { isLoading: isDevolviendo }] = useDevolverSalidaMutation();

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLiquidarOpen, setIsLiquidarOpen] = useState(false);
  const [isVincularOpen, setIsVincularOpen] = useState(false);

  const [selectedSalida, setSelectedSalida] = useState<Salida | null>(null);

  // Form states
  const [articulo, setArticulo] = useState('');
  const [destino, setDestino] = useState<'mostrador' | 'delivery'>('mostrador');
  const [invoiceId, setInvoiceId] = useState('');
  
  // Liquidar states
  const [liquidacion, setLiquidacion] = useState<'depositado' | 'efectivo_recibido' | 'recordar'>('depositado');
  const [montoEsperado, setMontoEsperado] = useState('');
  const [cuentaDepositoId, setCuentaDepositoId] = useState('');
  const [comprobanteUrl, setComprobanteUrl] = useState('');

  // Vincular states
  const [orderIdToLink, setOrderIdToLink] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articulo) {
      toast.error('Especifica el artículo');
      return;
    }
    try {
      await registerMut({
        articulo,
        destino,
        invoice_id: invoiceId || undefined,
      }).unwrap();
      toast.success('Salida registrada');
      setIsRegisterOpen(false);
      setArticulo('');
      setInvoiceId('');
      setDestino('mostrador');
    } catch (err: any) {
      toast.error(err.data?.error || 'Error al registrar salida');
    }
  };

  const handleLiquidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalida) return;
    try {
      await liquidarMut({
        id: selectedSalida.id,
        data: {
          liquidacion,
          monto_esperado: montoEsperado ? Number(montoEsperado) : undefined,
          cuenta_deposito_id: liquidacion === 'depositado' ? cuentaDepositoId : undefined,
          comprobante_url: comprobanteUrl || undefined,
        },
      }).unwrap();
      toast.success('Liquidación registrada');
      setIsLiquidarOpen(false);
    } catch (err: any) {
      toast.error(err.data?.error || 'Error al liquidar');
    }
  };

  const handleVincular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalida || !orderIdToLink) return;
    try {
      await vincularMut({ id: selectedSalida.id, orderId: orderIdToLink }).unwrap();
      toast.success('Salida vinculada a la venta');
      setIsVincularOpen(false);
      setOrderIdToLink('');
    } catch (err: any) {
      toast.error(err.data?.error || 'Error al vincular');
    }
  };

  const handleDevolver = async (salida: Salida) => {
    if (!confirm('¿Marcar como devuelta?')) return;
    try {
      await devolverMut(salida.id).unwrap();
      toast.success('Marcada como devuelta');
    } catch (err: any) {
      toast.error(err.data?.error || 'Error al devolver');
    }
  };

  const columns = [
    {
      header: 'Fecha',
      accessorKey: 'salio_at',
      cell: (info: any) => format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm'),
    },
    {
      header: 'Artículo',
      accessorKey: 'articulo',
    },
    {
      header: 'Destino',
      accessorKey: 'destino',
      cell: (info: any) => (
        <StatusBadge status={info.getValue() === 'delivery' ? 'info' : 'pending'} label={info.getValue()} />
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'estado',
      cell: (info: any) => {
        const est = info.getValue();
        let color = 'neutral';
        if (est === 'pendiente_registro') color = 'danger';
        else if (est === 'facturada' || est === 'registrada') color = 'success';
        return <StatusBadge status={color as any} label={est.replace('_', ' ')} />;
      },
    },
    {
      header: 'Liquidación',
      accessorKey: 'liquidacion',
      cell: (info: any) => {
        const val = info.getValue();
        if (val === 'no_aplica') return '-';
        let color = 'warning';
        if (val === 'depositado' || val === 'efectivo_recibido') color = 'success';
        return <StatusBadge status={color as any} label={val.replace('_', ' ')} />;
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }: any) => {
        const salida = row.original as Salida;
        return (
          <div className="flex items-center gap-2">
            {salida.destino === 'delivery' && salida.liquidacion === 'pendiente' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSalida(salida);
                  setIsLiquidarOpen(true);
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Liquidar
              </Button>
            )}
            {salida.estado === 'pendiente_registro' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSalida(salida);
                  setIsVincularOpen(true);
                }}
              >
                <Link2 className="mr-2 h-4 w-4" /> Vincular
              </Button>
            )}
            {salida.estado !== 'devuelta' && salida.estado !== 'facturada' && (
              <Button variant="ghost" size="sm" onClick={() => handleDevolver(salida)}>
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Salidas de Tienda" description="Registro operativo de mercadería que sale físicamente." />
        <Button onClick={() => setIsRegisterOpen(true)} size="lg" className="shrink-0 font-semibold shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> Registrar Salida
        </Button>
      </div>

      <QueryState loading={isLoading} error={isError} onRetry={refetch}>
        <DataTable
          columns={columns}
          data={salidas}
          searchPlaceholder="Buscar artículo..."
        />
      </QueryState>

      {/* REGISTRO MODAL */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent>
          <form onSubmit={handleRegister}>
            <DialogHeader>
              <DialogTitle>Registrar Nueva Salida</DialogTitle>
              <DialogDescription>
                Indica qué artículo se está entregando físicamente en este momento.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Artículo (texto libre)</Label>
                <Input required value={articulo} onChange={(e) => setArticulo(e.target.value)} placeholder="Ej. Audífonos KZ ZSN Pro X" />
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <Select value={destino} onValueChange={(v: any) => setDestino(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mostrador">Mostrador (Cliente en tienda)</SelectItem>
                    <SelectItem value="delivery">Delivery (Repartidor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ID de Factura (Opcional)</Label>
                <Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="Si ya fue facturado" />
                <p className="text-xs text-muted-foreground">Si pones factura, ya no requiere vincular a venta luego.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isRegistering}>
                {isRegistering ? 'Guardando...' : 'Confirmar Salida'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* LIQUIDAR MODAL */}
      <Dialog open={isLiquidarOpen} onOpenChange={setIsLiquidarOpen}>
        <DialogContent>
          <form onSubmit={handleLiquidar}>
            <DialogHeader>
              <DialogTitle>Liquidar Delivery</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>¿Cómo entregó el dinero el repartidor?</Label>
                <Select value={liquidacion} onValueChange={(v: any) => setLiquidacion(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="depositado">Depositado a Cuenta/Banco</SelectItem>
                    <SelectItem value="efectivo_recibido">Efectivo entregado en tienda</SelectItem>
                    <SelectItem value="recordar">Recordar (Falta pagar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {liquidacion === 'depositado' && (
                <div className="space-y-2">
                  <Label>Cuenta de Depósito</Label>
                  <Select value={cuentaDepositoId} onValueChange={setCuentaDepositoId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.activo).map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.nombre} ({acc.moneda})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Monto (Opcional)</Label>
                <Input type="number" step="0.01" value={montoEsperado} onChange={(e) => setMontoEsperado(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLiquidando}>Guardar Liquidación</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VINCULAR MODAL */}
      <Dialog open={isVincularOpen} onOpenChange={setIsVincularOpen}>
        <DialogContent>
          <form onSubmit={handleVincular}>
            <DialogHeader>
              <DialogTitle>Vincular a Venta (Order)</DialogTitle>
              <DialogDescription>
                Conecta esta salida con su venta registrada en el sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Order ID (UUID)</Label>
                <Input required value={orderIdToLink} onChange={(e) => setOrderIdToLink(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isVinculando}>Vincular</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
