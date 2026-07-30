// Modal para editar los datos de recepción de una compra (flete, categoría, fecha de ingreso).
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { arrivalFormSchema, type ArrivalFormInput, type ArrivalFormValues } from "~/lib/validators";
import { useUpdatePurchaseMutation, type Purchase } from "~/store/api/inventoryV1Api";
import { useGetConfigQuery } from "~/store/api/configApi";
import { Input } from "~/components/ui/input";

export function EditArrivalModal({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  const { data: config } = useGetConfigQuery();
  const [updatePurchase, { isLoading }] = useUpdatePurchaseMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ArrivalFormValues, any, ArrivalFormInput>({
    resolver: zodResolver(arrivalFormSchema),
  });

  // Cargar valores actuales al abrir el modal
  useEffect(() => {
    if (purchase) {
      reset({
        arrivalDate: purchase.arrivalDate || "",
        shippingUnit: purchase.shippingUnit,
        category: purchase.category || "",
        suggestedPrice: purchase.suggestedPrice ?? undefined,
      });
    }
  }, [purchase, reset]);

  async function onSubmit(data: ArrivalFormInput) {
    if (!purchase) return;
    try {
      // Combinamos los datos actuales con los campos de arribo editados.
      // Enviar suggestedPrice explícito es lo que permite cambiar el precio de venta
      // del producto en bodega (el server solo toca el precio cuando viene explícito).
      const body = {
        ...purchase,
        arrivalDate: data.arrivalDate,
        shippingUnit: data.shippingUnit,
        category: data.category,
        suggestedPrice: data.suggestedPrice,
      };
      await updatePurchase({ id: purchase.id, body }).unwrap();
      toast.success("Datos de inventario actualizados correctamente.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudieron guardar los cambios.");
    }
  }

  return (
    <Dialog open={!!purchase} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar recepción · {purchase?.code ?? ""}</DialogTitle>
        </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-4">
        <div className="grid gap-2">
          <Label>Fecha de ingreso a Nicaragua</Label>
          <Input type="date" {...register("arrivalDate")} />
        </div>

        <div className="grid gap-2">
          <Label>Costo de envío unitario (USD)</Label>
          <input type="number" step="0.0001" min={0} className="input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" {...register("shippingUnit")} />
        </div>

        <div className="grid gap-2">
          <Label>Precio de venta (C$)</Label>
          <input type="number" step="1" min={0} className="input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" placeholder="Precio al que se vende" {...register("suggestedPrice")} />
          <span className="mt-1 block text-xs text-muted">Es el precio que verá el vendedor al cotizar. Puedes cambiarlo cuando quieras.</span>
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

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={isLoading}>
            Guardar cambios
          </Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}
