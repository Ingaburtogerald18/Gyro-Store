// Modal para editar los datos de recepción de una compra (flete, categoría, fecha de ingreso).
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { arrivalFormSchema, type ArrivalFormInput, type ArrivalFormValues } from "~/lib/validators";
import { useUpdatePurchaseMutation, type Purchase } from "~/store/api/inventoryV1Api";
import { useGetConfigQuery } from "~/store/api/configApi";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Spinner } from "~/components/ui/spinner";

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
        <Field data-invalid={!!errors.arrivalDate}>
          <FieldLabel htmlFor="edit-arrival-date" required>Fecha de ingreso a Nicaragua</FieldLabel>
          <Input id="edit-arrival-date" type="date" aria-required aria-invalid={!!errors.arrivalDate} {...register("arrivalDate")} />
          <FieldError errors={[errors.arrivalDate]} />
        </Field>

        <Field data-invalid={!!errors.shippingUnit}>
          <FieldLabel htmlFor="edit-arrival-shipping" required>Costo de envío unitario (USD)</FieldLabel>
          <Input id="edit-arrival-shipping" type="number" step="0.0001" min={0} aria-required {...register("shippingUnit")} aria-invalid={!!errors.shippingUnit} />
          <FieldError errors={[errors.shippingUnit]} />
        </Field>

        <Field data-invalid={!!errors.suggestedPrice}>
          <FieldLabel htmlFor="edit-arrival-price">Precio de venta (C$)</FieldLabel>
          <Input id="edit-arrival-price" type="number" step="1" min={0} placeholder="Precio al que se vende" {...register("suggestedPrice")} aria-invalid={!!errors.suggestedPrice} />
          <FieldDescription>Es el precio que verá el vendedor al cotizar. Puedes cambiarlo cuando quieras.</FieldDescription>
          <FieldError errors={[errors.suggestedPrice]} />
        </Field>

        <Field data-invalid={!!errors.category}>
          <FieldLabel htmlFor="edit-arrival-category" required>Categoría</FieldLabel>
          <NativeSelect id="edit-arrival-category" className="w-full" defaultValue="" aria-required aria-invalid={!!errors.category} {...register("category")}>
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

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isLoading}>
        {isLoading && <Spinner className="mr-2" />}
        Guardar cambios
      </Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}
