// Checkout. Toma los datos de contacto y entrega, crea el pedido en el backend
// (que recalcula el total y arma el mensaje) y abre WhatsApp.
//
// Sobre <Dialog> de shadcn/ui + react-hook-form. La validación usa el MISMO
// schema Zod que valida el backend (shared/schemas.ts): una sola fuente de
// verdad, sin reglas duplicadas que se desincronicen.
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, Store01Icon, TruckIcon, Coupon01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { toast } from 'sonner';
import { publicOrderInputSchema, type PublicOrderInput } from '@shared/schemas';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { useGetConfigQuery } from '~/store/api/configApi';
import { useCreatePublicOrderMutation } from '~/store/api/ordersApi';
import {
  useValidateDiscountCodeMutation,
  type DiscountCodeValidation,
} from '~/store/api/discountCodesApi';
import { useAppDispatch, useAppSelector } from '~/store/hooks';
import {
  clearCart,
  closeCart,
  selectCartItems,
  selectCartSubtotal,
  toOrderItems,
} from '~/store/slices/cartSlice';
import { cn } from "~/lib/utils"
import { formatCordobas } from "~/lib/formatters";

// Los campos que llena la persona; los ítems los pone el carrito al enviar.
type CheckoutForm = Omit<PublicOrderInput, 'items'>;

export function CheckoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const { data: config } = useGetConfigQuery();
  const [createOrder, { isLoading }] = useCreatePublicOrderMutation();
  const [validateCode, { isLoading: validatingCode }] = useValidateDiscountCodeMutation();
  const [geoLoading, setGeoLoading] = useState(false);

  // Código de descuento: el preview (validate) NO consume uso; el canje real lo
  // hace el servidor al crear el pedido. El monto acá es solo informativo.
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<DiscountCodeValidation | null>(null);
  const codeDiscount = appliedCode
    ? appliedCode.type === 'percent'
      ? subtotal * (appliedCode.value / 100)
      : Math.min(appliedCode.value, subtotal)
    : 0;
  const totalWithDiscount = Math.max(0, subtotal - codeDiscount);

  async function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    try {
      const result = await validateCode(code).unwrap();
      setAppliedCode(result);
      toast.success(`Código ${result.code} aplicado.`);
    } catch (err) {
      setAppliedCode(null);
      const message =
        (err as { data?: { error?: string } })?.data?.error ?? 'Código inválido.';
      toast.error(message);
    }
  }

  function removeCode() {
    setAppliedCode(null);
    setCodeInput('');
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: { deliveryMethod: 'retiro', customerName: '', phone: '' },
  });

  const deliveryMethod = watch('deliveryMethod');
  const locationUrl = watch('locationUrl');

  // Ubicación GPS puntual como link de Google Maps, para el repartidor. Es
  // opcional: si niega el permiso, queda la dirección escrita.
  function captureLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Tu dispositivo no permite compartir ubicación.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setValue('locationUrl', `https://www.google.com/maps?q=${latitude},${longitude}`, {
          shouldValidate: true,
        });
        setGeoLoading(false);
        toast.success('Ubicación agregada');
      },
      (err) => {
        setGeoLoading(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso denegado. Podés escribir la dirección abajo.'
            : 'No se pudo obtener tu ubicación. Escribí la dirección.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  async function onSubmit(form: CheckoutForm) {
    if (items.length === 0) {
      toast.error('Tu carrito está vacío.');
      return;
    }

    // Se valida con el schema compartido ANTES de salir: los mismos mensajes
    // que devolvería el backend, pero sin gastar el viaje.
    const payload = {
      ...form,
      items: toOrderItems(items),
      discountCode: appliedCode?.code,
    };
    const parsed = publicOrderInputSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Revisá los datos del formulario.');
      return;
    }

    try {
      const order = await createOrder(parsed.data).unwrap();
      reset();
      removeCode();
      dispatch(clearCart());
      dispatch(closeCart());
      onOpenChange(false);
      // En móvil el navegador puede bloquear window.open después de un await;
      // si pasa, se navega en la misma pestaña para que WhatsApp igual abra.
      const opened = window.open(order.whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = order.whatsappUrl;
    } catch (err) {
      const message =
        (err as { data?: { error?: string } })?.data?.error ??
        'No se pudo crear el pedido. Intentá de nuevo.';
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Finalizar pedido</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Completá tus datos y te llevamos a WhatsApp con el pedido ya armado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="customerName">Nombre</Label>
            <Input
              id="customerName"
              autoComplete="name"
              placeholder="Tu nombre"
              aria-invalid={Boolean(errors.customerName)}
              {...register('customerName')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="8888 8888"
              aria-invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium text-foreground">¿Cómo lo recibís?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'retiro', label: 'Retiro en tienda', icon: Store01Icon },
                  { value: 'envio', label: 'Envío a domicilio', icon: TruckIcon },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors',
                    deliveryMethod === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  <input
                    type="radio"
                    value={value}
                    className="sr-only"
                    {...register('deliveryMethod')}
                  />
                  <HugeiconsIcon icon={Icon} size={16} strokeWidth={2} aria-hidden />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {deliveryMethod === 'envio' && (
            <div className="space-y-1.5">
              <Label htmlFor="address">Dirección</Label>
              <Textarea
                id="address"
                rows={2}
                placeholder="Barrio, calle, referencias…"
                aria-invalid={Boolean(errors.address)}
                {...register('address')}
              />
              <input type="hidden" {...register('locationUrl')} />
              <Button
                type="button"
                variant="outline"
                onClick={captureLocation}
                disabled={geoLoading}
                className="w-full justify-center gap-2"
              >
                <HugeiconsIcon icon={Location01Icon} size={16} strokeWidth={2} aria-hidden />
                {locationUrl
                  ? 'Ubicación agregada — tocá para actualizar'
                  : geoLoading
                    ? 'Obteniendo ubicación…'
                    : 'Compartir mi ubicación'}
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              rows={2}
              placeholder="¿Algo que debamos saber?"
              {...register('note')}
            />
          </div>

          {/* Código de descuento (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="discountCode">Código de descuento (opcional)</Label>
            {appliedCode ? (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <HugeiconsIcon icon={Coupon01Icon} size={16} strokeWidth={2} aria-hidden />
                  {appliedCode.code}
                  <span className="font-normal text-muted-foreground">
                    ({appliedCode.type === 'percent' ? `${appliedCode.value}%` : formatCordobas(appliedCode.value, config?.currency)})
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
                  id="discountCode"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyCode();
                    }
                  }}
                  placeholder="Tenés un código?"
                  className="uppercase"
                  maxLength={30}
                />
                <Button type="button" variant="outline" onClick={applyCode} disabled={validatingCode || !codeInput.trim()}>
                  {validatingCode ? 'Validando…' : 'Aplicar'}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1 border-t border pt-3">
            {codeDiscount > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCordobas(subtotal, config?.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-primary">
                  <span>Descuento ({appliedCode?.code})</span>
                  <span className="tabular-nums">−{formatCordobas(codeDiscount, config?.currency)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total estimado</span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {formatCordobas(totalWithDiscount, config?.currency)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              variant="whatsapp"
              disabled={isLoading}
              className="w-full justify-center"
            >
              {isLoading ? 'Creando pedido…' : 'Enviar pedido por WhatsApp'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
