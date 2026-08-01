import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, UserIcon, Coupon01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { errMsg, formatCordobas } from '~/lib/formatters';
import { useGetSellableProductsQuery, type SellableProduct } from '~/store/api/salesApi';
import { useCreateInvoiceMutation } from '~/store/api/invoicesApi';
import {
  useValidateDiscountCodeMutation,
  type DiscountCodeValidation,
} from '~/store/api/discountCodesApi';
import { Spinner } from '~/components/ui/spinner';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { cn } from '~/lib/utils';

const METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
] as const;

interface InvoiceLine {
  uid: string;
  productName: string;
  quantity: number | '';
  unitPrice: number | '';
}

export function InvoiceEditor({ onCreated }: { onCreated: (invoiceId: string) => void }) {
  const { data: products = [] } = useGetSellableProductsQuery();
  const [createInvoice, { isLoading: creating }] = useCreateInvoiceMutation();

  const [lines, setLines] = useState<InvoiceLine[]>([
    { uid: crypto.randomUUID(), productName: '', quantity: 1, unitPrice: '' }
  ]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]['value']>('efectivo');
  const [deliveryFee, setDeliveryFee] = useState<number | ''>('');
  const [deliveryName, setDeliveryName] = useState('');
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [discount, setDiscount] = useState<number | ''>('');
  const [includeCustomer, setIncludeCustomer] = useState(false);

  // Código de descuento: el preview (validate) NO consume uso; el canje real lo
  // hace el servidor al crear la factura. El monto acá es solo informativo.
  const [validateCode, { isLoading: validatingCode }] = useValidateDiscountCodeMutation();
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<DiscountCodeValidation | null>(null);

  const addLine = () => setLines([...lines, { uid: crypto.randomUUID(), productName: '', quantity: 1, unitPrice: '' }]);
  const removeLine = (uid: string) => setLines(lines.filter(l => l.uid !== uid));

  const updateLine = (uid: string, field: keyof InvoiceLine, value: any) => {
    setLines(lines.map(l => {
      if (l.uid !== uid) return l;
      const newLine = { ...l, [field]: value };
      if (field === 'productName' && value) {
        const product = products.find(p => p.productName === value);
        if (product && newLine.unitPrice === '') {
          newLine.unitPrice = product.price;
        }
      }
      return newLine;
    }));
  };

  const validLines = lines.filter(l => l.productName && typeof l.quantity === 'number' && typeof l.unitPrice === 'number');
  const subtotal = validLines.reduce((acc, l) => acc + (l.quantity as number) * (l.unitPrice as number), 0);
  const effectiveDeliveryFee = includeDelivery ? (Number(deliveryFee) || 0) : 0;
  // El descuento del código se suma al manual, topado al subtotal (misma regla
  // que el servidor en createInvoice).
  const codeDiscount = appliedCode
    ? appliedCode.type === 'percent'
      ? subtotal * (appliedCode.value / 100)
      : Math.min(appliedCode.value, subtotal)
    : 0;
  const totalDiscount = Math.min((Number(discount) || 0) + codeDiscount, subtotal);
  const total = Math.max(0, subtotal - totalDiscount + effectiveDeliveryFee);

  async function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    try {
      const result = await validateCode(code).unwrap();
      setAppliedCode(result);
      toast.success(`Código ${result.code} aplicado.`);
    } catch (err) {
      setAppliedCode(null);
      toast.error(errMsg(err, 'Código inválido.'));
    }
  }

  function removeCode() {
    setAppliedCode(null);
    setCodeInput('');
  }

  const handleCreate = async () => {
    if (validLines.length === 0) {
      toast.error('Agrega al menos un producto válido.');
      return;
    }
    
    try {
      const result = await createInvoice({
        customerName: includeCustomer ? customerName || undefined : undefined,
        phone: includeCustomer ? phone || undefined : undefined,
        method,
        deliveryFee: includeDelivery ? Number(deliveryFee) || 0 : 0,
        deliveryName: includeDelivery ? deliveryName || undefined : undefined,
        discount: Number(discount) || 0,
        discountCode: appliedCode?.code,
        items: validLines.map(l => ({
          productName: l.productName,
          quantity: l.quantity as number,
          unitPrice: l.unitPrice as number
        }))
      }).unwrap();
      
      toast.success('Factura creada exitosamente.');
      onCreated(result.id);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo crear la factura.'));
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-card border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={2} className="text-primary-2" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Datos del cliente</h3>
          </div>
          <Switch
            id="include-customer-invoice"
            checked={includeCustomer}
            onCheckedChange={setIncludeCustomer}
          />
        </div>
        <div
          className={cn(
            'grid grid-cols-1 gap-4 overflow-hidden transition-all duration-300 sm:grid-cols-2',
            includeCustomer ? 'mt-3 max-h-40 opacity-100' : 'mt-0 max-h-0 opacity-0',
          )}
        >
          <div className="space-y-1.5">
            <Label htmlFor="customerName">Nombre (Opcional)</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              disabled={!includeCustomer}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono (Opcional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. 8888 8888"
              disabled={!includeCustomer}
            />
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <Label>Productos</Label>
        <div className="border rounded-md divide-y">
          {lines.map((line, i) => (
            <div key={line.uid} className="flex flex-col sm:flex-row gap-2 p-2 items-start sm:items-center bg-card">
              <div className="flex-1 w-full">
                <Select value={line.productName} onValueChange={v => updateLine(line.uid, 'productName', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.productName} value={p.productName}>
                        {p.productName} — {formatCordobas(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-24">
                <Input
                  type="number"
                  min="1"
                  placeholder="Cant"
                  value={line.quantity}
                  onChange={e => updateLine(line.uid, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                />
              </div>
              <div className="w-full sm:w-32">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Precio"
                  value={line.unitPrice}
                  onChange={e => updateLine(line.uid, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
              <div className="w-full sm:w-32 text-right text-sm font-medium">
                {formatCordobas((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}
              </div>
              {lines.length > 1 && (
                <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => removeLine(line.uid)}>
                  <HugeiconsIcon icon={Delete01Icon} size={18} />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addLine} className="mt-2">
          <HugeiconsIcon icon={Add01Icon} size={16} className="mr-1.5" /> Agregar línea
        </Button>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <Select value={method} onValueChange={v => setMethod(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descuento (C$)</Label>
            <Input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Código de descuento (opcional)</Label>
          {appliedCode ? (
            <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <HugeiconsIcon icon={Coupon01Icon} size={16} strokeWidth={2} aria-hidden />
                {appliedCode.code}
                <span className="font-normal text-muted-foreground">
                  ({appliedCode.type === 'percent' ? `${appliedCode.value}%` : formatCordobas(appliedCode.value)})
                </span>
              </span>
              <button
                type="button"
                onClick={removeCode}
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                title="Quitar código"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCode();
                  }
                }}
                placeholder="Ej. RESENA-JUAN10"
                className="uppercase"
                maxLength={30}
              />
              <Button type="button" variant="outline" onClick={applyCode} disabled={validatingCode || !codeInput.trim()}>
                {validatingCode ? 'Validando…' : 'Aplicar'}
              </Button>
            </div>
          )}
        </div>

        <section className="space-y-3 rounded-card border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Delivery</h3>
            </div>
            <Switch
              id="include-delivery-invoice"
              checked={includeDelivery}
              onCheckedChange={setIncludeDelivery}
            />
          </div>
          <div
            className={cn(
              'grid grid-cols-1 gap-4 overflow-hidden transition-all duration-300 sm:grid-cols-2',
              includeDelivery ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0',
            )}
          >
            <div className="space-y-1.5">
              <Label htmlFor="deliveryName">Nombre del Repartidor</Label>
              <Input 
                id="deliveryName"
                type="text" 
                value={deliveryName} 
                onChange={e => setDeliveryName(e.target.value)} 
                placeholder="Ej. Juan Pérez"
                disabled={!includeDelivery}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deliveryFee">Precio (C$)</Label>
              <Input 
                id="deliveryFee"
                type="number" 
                min="0" 
                step="0.01" 
                value={deliveryFee} 
                onChange={e => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))} 
                placeholder="Ej. 150"
                disabled={!includeDelivery}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-lg bg-muted p-4 flex flex-col items-end space-y-1">
        <div className="text-sm text-muted-foreground flex justify-between w-full max-w-xs">
          <span>Subtotal:</span>
          <span>{formatCordobas(subtotal)}</span>
        </div>
        {(discount || 0) > 0 && (
          <div className="text-sm text-destructive flex justify-between w-full max-w-xs">
            <span>Descuento:</span>
            <span>-{formatCordobas(Number(discount) || 0)}</span>
          </div>
        )}
        {codeDiscount > 0 && (
          <div className="text-sm text-primary flex justify-between w-full max-w-xs">
            <span>Código {appliedCode?.code}:</span>
            <span>-{formatCordobas(codeDiscount)}</span>
          </div>
        )}
        {effectiveDeliveryFee > 0 && (
          <div className="text-sm text-muted-foreground flex justify-between w-full max-w-xs">
            <span>Envío:</span>
            <span>{formatCordobas(effectiveDeliveryFee)}</span>
          </div>
        )}
        <div className="text-xl font-bold text-foreground flex justify-between w-full max-w-xs border-t pt-2 mt-2">
          <span>Total:</span>
          <span>{formatCordobas(total)}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleCreate} disabled={creating || validLines.length === 0}>
          {creating && <Spinner className="mr-2" />}
          Crear e Imprimir Factura
        </Button>
      </div>
    </div>
  );
}
