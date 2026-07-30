import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { arrivalFormSchema, type ArrivalFormInput } from "~/lib/validators";
import { useReportArrivalMutation, type Purchase } from "~/store/api/inventoryV1Api";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { formatCordobas } from "~/lib/utils";

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
  } = useForm<ArrivalFormInput>({
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
  
  const suggestedPriceCalc = parseFloat((costoFijo / (1 - margin)).toFixed(2));

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
          <div className="rounded-lg bg-surface-2 p-3 text-sm border border-border flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-accent-2 bg-accent/10 px-1.5 py-0.5 rounded">{purchase.code}</span>
            <span className="font-medium text-text">{purchase.productName}</span>
          </div>
        )}
        
        <div className="grid gap-2">
          <Label>Fecha de ingreso a Nicaragua</Label>
          <Input type="date" {...register("arrivalDate")} />
        </div>

        <div className="grid gap-2">
          <Label>Costo de envío unitario (USD)</Label>
          <input type="number" step="0.0001" min={0} className="input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" {...register("shippingUnit")} />
        </div>

        <div className="grid gap-2">
          <Label>Categoría</Label>
          <select className="input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" defaultValue="" {...register("category")}>
            <option value="" disabled>
              Selecciona una categoría
            </option>
            {config?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        {hasShipping && (
          <div className="rounded-lg bg-surface-2 p-3 text-xs space-y-1.5 border border-border">
            <div className="flex justify-between text-muted">
              <span>Costo Real Unit. (C$)</span>
              <span className="font-medium text-text">{formatCordobas(costRealCordobas)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Coste c/ Fijos (C$)</span>
              <span className="font-medium text-warning">{formatCordobas(costoFijo)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-border/50">
              <span>Precio Sugerido Calculado</span>
              <span className="text-accent-2">{formatCordobas(suggestedPriceCalc)}</span>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label>Precio de venta final (C$)</Label>
          <input type="number" step="0.01" min={0} className="input font-bold text-accent flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" {...register("suggestedPrice")} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={isLoading}>
            Confirmar llegada
          </Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}
