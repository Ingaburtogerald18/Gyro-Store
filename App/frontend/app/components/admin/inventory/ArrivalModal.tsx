import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { arrivalFormSchema, type ArrivalFormInput, type ArrivalFormValues } from "~/lib/validators";
import { useReportArrivalMutation, type Purchase } from "~/store/api/inventoryV1Api";
import { useGetConfigQuery } from "~/store/api/configApi";
import { formatCordobas, roundTo } from "~/lib/formatters";
import { Spinner } from "~/components/ui/spinner";

const RATE = 37;

export function ArrivalModal({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  const { data: config } = useGetConfigQuery();
  const [reportArrival, { isLoading }] = useReportArrivalMutation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<ArrivalFormValues, any, ArrivalFormInput>({
    resolver: zodResolver(arrivalFormSchema),
    defaultValues: { arrivalDate: undefined, shippingUnit: undefined, suggestedPrice: undefined },
  });

  const shippingUnit = useWatch({ control, name: "shippingUnit" });
  
  const parsedShipping = Number(shippingUnit);
  const hasShipping = shippingUnit !== undefined && String(shippingUnit) !== "" && !isNaN(parsedShipping);

  const costUnit = purchase?.costUnit || 0;
  const taxUnit = purchase?.taxUnit || 0;
  const priceUnitFinal = costUnit + taxUnit + (hasShipping ? parsedShipping : 0);
  const costRealCordobas = priceUnitFinal * RATE;
  const costoFijo = costRealCordobas / 0.75;
  
  let margin = 0.25;
  if (costoFijo < 100) margin = 0.65;
  else if (costoFijo <= 300) margin = 0.45;
  else if (costoFijo <= 500) margin = 0.40;
  else if (costoFijo <= 800) margin = 0.35;
  else if (costoFijo <= 1200) margin = 0.30;
  
  const suggestedPriceCalc = roundTo(costoFijo / (1 - margin));

  useEffect(() => {
    if (hasShipping) {
      // Only auto-fill if the user hasn't manually edited the suggested price yet
      if (!dirtyFields.suggestedPrice) {
        setValue("suggestedPrice", suggestedPriceCalc, { shouldValidate: true });
      }
    }
  }, [hasShipping, suggestedPriceCalc, setValue, dirtyFields.suggestedPrice]);

  async function onSubmit(data: ArrivalFormInput) {
    if (!purchase) return;
    try {
      await reportArrival({ id: purchase.id, body: data }).unwrap();
      toast.success("Llegada reportada. Pendiente de aprobación.");
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo reportar la llegada.");
    }
  }

  return (
    <Dialog open={!!purchase} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reportar llegada · {purchase?.code ?? ""}</DialogTitle>
        </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-3">
        {purchase && (
          <div className="rounded-lg bg-muted p-3 text-sm border flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-primary-2 bg-primary/10 px-1.5 py-0.5 rounded">{purchase.code}</span>
            <span className="font-medium text-foreground">{purchase.productName}</span>
          </div>
        )}
        
        <Field data-invalid={!!errors.arrivalDate}>
          <FieldLabel htmlFor="arrival-date" required>Fecha de ingreso a Nicaragua</FieldLabel>
          <Input id="arrival-date" type="date" aria-required aria-invalid={!!errors.arrivalDate} {...register("arrivalDate")} />
          <FieldError errors={[errors.arrivalDate]} />
        </Field>

        <Field data-invalid={!!errors.shippingUnit}>
          <FieldLabel htmlFor="arrival-shipping" required>Costo de envío unitario (USD)</FieldLabel>
          <Input id="arrival-shipping" type="number" step="0.0001" min={0} aria-required {...register("shippingUnit")} aria-invalid={!!errors.shippingUnit} />
          <FieldError errors={[errors.shippingUnit]} />
        </Field>

        <Field data-invalid={!!errors.category}>
          <FieldLabel htmlFor="arrival-category" required>Categoría</FieldLabel>
          <NativeSelect id="arrival-category" className="w-full" defaultValue="" aria-required aria-invalid={!!errors.category} {...register("category")}>
            <NativeSelectOption value="" disabled>
              Selecciona una categoría
            </NativeSelectOption>
            {config?.categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.icon} {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.category]} />
        </Field>

        {hasShipping && (
          <div className="rounded-lg border bg-muted p-3 text-xs space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Costo Real Unit. (C$)</span>
              <span className="font-medium text-foreground">{formatCordobas(costRealCordobas)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Coste c/ Fijos (C$)</span>
              <span className="font-medium text-warning">{formatCordobas(costoFijo)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-border/50">
              <span>Precio Sugerido Calculado</span>
              <span className="text-primary-2">{formatCordobas(suggestedPriceCalc)}</span>
            </div>
          </div>
        )}

        <Field data-invalid={!!errors.suggestedPrice}>
          <FieldLabel htmlFor="arrival-price">Precio de venta final (C$)</FieldLabel>
          <Input id="arrival-price" type="number" step="0.01" min={0} className="font-bold" {...register("suggestedPrice")} aria-invalid={!!errors.suggestedPrice} />
          <FieldDescription>Si lo dejás vacío se guarda el sugerido calculado arriba.</FieldDescription>
          <FieldError errors={[errors.suggestedPrice]} />
        </Field>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isLoading}>
        {isLoading && <Spinner className="mr-2" />}
        Confirmar llegada
      </Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}
