import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Add01Icon, ArrowDownRight01Icon, ArrowUpRight01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { PageHeader } from '~/components/layout/PageHeader';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Label } from '~/components/ui/label';
import { toast } from 'sonner';
import { DataTable } from '~/components/ui/DataTable';
import { QueryState } from '~/components/ui/QueryState';
import { StatCard } from '~/components/ui/stat-card';
import {
  useGetAccountsQuery,
  useGetMovementsQuery,
  useRegisterMovementMutation,
  useCreateAccountMutation,
  useGetCuadreQuery,
} from '~/store/api/cajaApi';
import { formatByCurrency } from '~/lib/formatters';
import { format } from 'date-fns';
import type { AccountMovement } from '@shared/schemas';

export const meta: MetaFunction = () => {
  return [{ title: 'Caja y Bancos | Gyro Store' }];
};

export default function AdminCajaRoute() {
  const { data: accounts = [], isLoading: isLoadingAcc } = useGetAccountsQuery();
  const { data: movements = [], isLoading: isLoadingMov, refetch } = useGetMovementsQuery();
  const { data: cuadre } = useGetCuadreQuery(); // Para los saldos consolidados
  
  const [registerMovMut, { isLoading: isRegistering }] = useRegisterMovementMutation();
  const [createAccMut, { isLoading: isCreatingAcc }] = useCreateAccountMutation();

  const [isMovOpen, setIsMovOpen] = useState(false);
  const [isAccOpen, setIsAccOpen] = useState(false);

  // Form states Movimiento
  const [accountId, setAccountId] = useState('');
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // Form states Account
  const [accNombre, setAccNombre] = useState('');
  const [accTipo, setAccTipo] = useState<'efectivo' | 'banco'>('efectivo');
  const [accMoneda, setAccMoneda] = useState('NIO');

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !monto || !categoria) {
      toast.error('Llena los campos obligatorios');
      return;
    }
    try {
      await registerMovMut({
        account_id: accountId,
        tipo,
        monto: Number(monto),
        categoria,
        descripcion: descripcion || undefined,
      }).unwrap();
      toast.success('Movimiento registrado');
      setIsMovOpen(false);
      setMonto('');
      setCategoria('');
      setDescripcion('');
    } catch (err: any) {
      toast.error(err.data?.error || 'Error al registrar movimiento');
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNombre) return;
    try {
      await createAccMut({ nombre: accNombre, tipo: accTipo, moneda: accMoneda }).unwrap();
      toast.success('Cuenta creada');
      setIsAccOpen(false);
      setAccNombre('');
    } catch (err: any) {
      toast.error(err.data?.error || 'Error al crear cuenta');
    }
  };

  const columns = [
    {
      header: 'Fecha',
      accessorKey: 'ocurrio_at',
      cell: (info: any) => format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm'),
    },
    {
      header: 'Cuenta',
      accessorKey: 'account_id',
      cell: (info: any) => {
        const id = info.getValue();
        const acc = accounts.find(a => a.id === id);
        return acc ? acc.nombre : 'Desconocida';
      },
    },
    {
      header: 'Tipo',
      accessorKey: 'tipo',
      cell: (info: any) => {
        const t = info.getValue();
        return (
          <span className={`inline-flex items-center gap-1 ${t === 'ingreso' ? 'text-success' : 'text-destructive'}`}>
            {t === 'ingreso' ? <AnimatedIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={2} /> : <AnimatedIcon icon={ArrowDownRight01Icon} size={16} strokeWidth={2} />}
            {t.toUpperCase()}
          </span>
        );
      },
    },
    {
      header: 'Monto',
      accessorKey: 'monto',
      cell: (info: any) => {
        const mov = info.row.original as AccountMovement;
        const acc = accounts.find(a => a.id === mov.account_id);
        const sign = mov.tipo === 'egreso' ? '−' : '+';
        return (
          <span className="nums">
            {sign}
            {formatByCurrency(Number(info.getValue()), acc?.moneda)}
          </span>
        );
      },
    },
    {
      header: 'Categoría',
      accessorKey: 'categoria',
    },
    {
      header: 'Descripción',
      accessorKey: 'descripcion',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Caja y Bancos" description="Libro diario de ingresos y egresos de las cuentas." />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsAccOpen(true)}>Nueva Cuenta</Button>
          <Button onClick={() => setIsMovOpen(true)} className="shadow-sm">
            <AnimatedIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-2" /> Registrar Movimiento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map(acc => {
          const bal = cuadre?.saldosCuentas.find(s => s.accountId === acc.id)?.balance || 0;
          return (
            <StatCard
              key={acc.id}
              label={acc.nombre}
              value={formatByCurrency(bal, acc.moneda)}
              icon={Wallet01Icon}
              sub={acc.tipo === 'banco' ? 'Cuenta Bancaria' : 'Caja de Efectivo'}
            />
          );
        })}
      </div>

      <QueryState loading={isLoadingMov || isLoadingAcc} onRetry={refetch}>
        <DataTable
          columns={columns}
          data={movements}
          searchPlaceholder="Buscar en descripción..."
        />
      </QueryState>

      {/* MODAL MOVIMIENTO */}
      <Dialog open={isMovOpen} onOpenChange={setIsMovOpen}>
        <DialogContent>
          <form onSubmit={handleRegisterMovement}>
            <DialogHeader>
              <DialogTitle>Registrar Ingreso / Egreso</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Movimiento</Label>
                <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso de dinero</SelectItem>
                    <SelectItem value="egreso">Egreso / Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cuenta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.activo).map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.nombre} ({acc.moneda})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input required type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input required placeholder="Ej. Depósito Delivery, Pago Luz, etc." value={categoria} onChange={e => setCategoria(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descripción (Opcional)</Label>
                <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isRegistering}>Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CUENTA */}
      <Dialog open={isAccOpen} onOpenChange={setIsAccOpen}>
        <DialogContent>
          <form onSubmit={handleCreateAccount}>
            <DialogHeader>
              <DialogTitle>Nueva Cuenta</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input required placeholder="Ej. BAC Lafise" value={accNombre} onChange={e => setAccNombre(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={accTipo} onValueChange={(v: any) => setAccTipo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo Físico</SelectItem>
                    <SelectItem value="banco">Banco / Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Input required value={accMoneda} onChange={e => setAccMoneda(e.target.value.toUpperCase())} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isCreatingAcc}>Crear Cuenta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
