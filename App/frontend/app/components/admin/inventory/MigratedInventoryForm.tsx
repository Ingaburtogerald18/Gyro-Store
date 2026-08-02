// Formulario de carga MANUAL de inventario migrado (histórico del Excel viejo).
// Vive en su propia colección: no toca el inventario actual. Cada ítem guardado
// queda marcado con la bandera origin:'migrated'.
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useForm, Controller, type DefaultValues } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { migratedItemFormSchema, type MigratedItemFormInput, type MigratedItemFormValues } from "~/lib/validators";
import {
  useCreateMigratedItemMutation,
  useUpdateMigratedItemMutation,
  useGetMigratedInventoryQuery,
  type MigratedItem,
} from "~/store/api/inventoryV1Api";
import { Input } from "~/components/ui/input";
import { Combobox } from "~/components/ui/combobox";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { formatUsd, formatCordobas } from "~/lib/formatters";
import { Spinner } from "~/components/ui/spinner";
import { DatePicker } from "~/components/ui/date-picker";

const RATE = 37; // USD → C$ (igual que el server)

// Strings vacíos en TODOS los campos para que RHF los limpie de verdad al resetear.
const EMPTY_MIGRATED = {
  purchaseDate: "",
  lot: "",
  code: "",
  productName: "",
  quantity: "",
  costUnit: "",
  shippingUnit: "",
  comments: "",
} as unknown as DefaultValues<MigratedItemFormValues>;

export function MigratedInventoryForm({ item, onDone }: { item?: MigratedItem | null; onDone?: () => void } = {}) {
  const isEdit = !!item;
  const { data: existingItems = [] } = useGetMigratedInventoryQuery();
  const [createItem, { isLoading: creating }] = useCreateMigratedItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateMigratedItemMutation();
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<MigratedItemFormValues, any, MigratedItemFormInput>({
    resolver: zodResolver(migratedItemFormSchema),
    defaultValues: item
      ? ({
          purchaseDate: item.purchaseDate,
          lot: item.lot,
          code: item.code,
          productName: item.productName,
          quantity: item.quantity,
          costUnit: item.costUnit,
          shippingUnit: item.shippingUnit,
          comments: item.comments ?? "",
        } as unknown as DefaultValues<MigratedItemFormValues>)
      : EMPTY_MIGRATED,
  });

  const base = Number(watch("costUnit")) || 0;
  const ship = Number(watch("shippingUnit")) || 0;
  const priceUnitFinal = base + ship;
  const costeReal = priceUnitFinal * RATE;
  const sugerido = Math.round((costeReal * 1.40) / 10) * 10;

  async function onSubmit(data: MigratedItemFormInput) {
    // Código duplicado: es un error DEL CAMPO, no del resultado de la operación.
    const codeExists = existingItems.some(i => (i.code || "").toLowerCase() === data.code.toLowerCase() && i.id !== item?.id);
    if (codeExists) {
      setError("code", { message: `El código "${data.code}" ya se encuentra registrado.` });
      return;
    }

    try {
      if (isEdit && item) {
        await updateItem({ id: item.id, body: data as any }).unwrap();
        toast.success("Ítem migrado actualizado.");
        onDone?.();
      } else {
        await createItem(data).unwrap();
        toast.success("Ítem migrado registrado.");
        setShowSuccessPrompt(true);
      }
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar el ítem migrado.");
    }
  }

  if (showSuccessPrompt) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-primary">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={32} strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-xl font-bold">¡Ítem registrado con éxito!</h2>
          <p className="text-muted-foreground mt-1">El artículo ha sido guardado en el inventario migrado.</p>
        </div>
        <p className="font-medium mt-4">¿Deseas agregar otro ítem?</p>
        <div className="flex w-full sm:w-auto gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => {
              reset(EMPTY_MIGRATED);
              setShowSuccessPrompt(false);
              onDone?.();
            }}
          >
            No, volver
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              reset(EMPTY_MIGRATED);
              setShowSuccessPrompt(false);
            }}
          >
            Sí, agregar otro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
      className="grid gap-3 rounded-card border border-warning/30 bg-warning/5 p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2">
        <span className="rounded-pill bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
          Migrado
        </span>
        <p className="text-xs text-muted-foreground">
          Datos históricos del Excel viejo. No afectan el inventario actual.
        </p>
      </div>

      <Field data-invalid={!!errors.purchaseDate}>
        <FieldLabel htmlFor="migrated-date" required>Fecha</FieldLabel>
        <Controller
          control={control}
          name="purchaseDate"
          render={({ field }) => (
            <DatePicker
              id="migrated-date"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError errors={[errors.purchaseDate]} />
      </Field>
      <Field data-invalid={!!errors.lot}>
        <FieldLabel htmlFor="migrated-lot">Lote</FieldLabel>
        <Controller
          control={control}
          name="lot"
          render={({ field }) => (
            <Combobox
              id="migrated-lot"
              value={field.value || ""}
              onChange={field.onChange}
              options={Array.from(new Set(existingItems.map((i) => i.lot).filter(Boolean))) as string[]}
              placeholder="Seleccionar o crear lote..."
              aria-invalid={!!errors.lot}
            />
          )}
        />
        <FieldError errors={[errors.lot]} />
      </Field>
      <Field data-invalid={!!errors.code}>
        <FieldLabel htmlFor="migrated-code" required>Código</FieldLabel>
        <Input id="migrated-code" aria-required {...register("code")} aria-invalid={!!errors.code} />
        <FieldError errors={[errors.code]} />
      </Field>

      <Field className="sm:col-span-2 lg:col-span-3" data-invalid={!!errors.productName}>
        <FieldLabel htmlFor="migrated-product-name" required>Nombre del producto</FieldLabel>
        <Controller
          control={control}
          name="productName"
          render={({ field }) => (
            <Combobox
              id="migrated-product-name"
              value={field.value || ""}
              onChange={field.onChange}
              options={Array.from(new Set(existingItems.map((i) => i.productName).filter(Boolean))) as string[]}
              placeholder="Seleccionar o escribir producto..."
              aria-invalid={!!errors.productName}
            />
          )}
        />
        <FieldError errors={[errors.productName]} />
      </Field>

      <Field data-invalid={!!errors.quantity}>
        <FieldLabel htmlFor="migrated-qty" required>Entradas (cantidad)</FieldLabel>
        <Input id="migrated-qty" type="number" min={1} aria-required {...register("quantity")} aria-invalid={!!errors.quantity} />
        <FieldError errors={[errors.quantity]} />
      </Field>
      <Field data-invalid={!!errors.costUnit}>
        <FieldLabel htmlFor="migrated-cost" required>Precio base (USD)</FieldLabel>
        <Input id="migrated-cost" type="number" step="0.0001" min={0} aria-required {...register("costUnit")} aria-invalid={!!errors.costUnit} />
        <FieldError errors={[errors.costUnit]} />
      </Field>
      <Field data-invalid={!!errors.shippingUnit}>
        <FieldLabel htmlFor="migrated-shipping" required>Costo de envío unit. (USD)</FieldLabel>
        <Input id="migrated-shipping" type="number" step="0.0001" min={0} aria-required {...register("shippingUnit")} aria-invalid={!!errors.shippingUnit} />
        <FieldError errors={[errors.shippingUnit]} />
      </Field>

      {/* Preview calculado en vivo */}
      <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-6 rounded-card border border-border bg-card/60 px-4 py-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">P. unit. final</p>
          <p className="font-heading text-base font-bold">{formatUsd(priceUnitFinal, 4)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Coste real unit.</p>
          <p className="font-heading text-base font-bold">{formatCordobas(costeReal)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">P. sugerido (+40%)</p>
          <p className="font-heading text-base font-bold text-primary">{formatCordobas(sugerido)}</p>
        </div>
      </div>

      <Field className="sm:col-span-2 lg:col-span-3" data-invalid={!!errors.comments}>
        <FieldLabel htmlFor="migrated-comments">Comentarios</FieldLabel>
        <Input id="migrated-comments" placeholder="Opcional" {...register("comments")} aria-invalid={!!errors.comments} />
        <FieldError errors={[errors.comments]} />
      </Field>

      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <Button type="submit" className="w-full sm:w-auto" disabled={creating || updating}>
  {creating || updating && <Spinner className="mr-2" />}
  {isEdit ? "Guardar cambios" : "Registrar ítem migrado"}
</Button>
      </div>
    </form>
  );
}
