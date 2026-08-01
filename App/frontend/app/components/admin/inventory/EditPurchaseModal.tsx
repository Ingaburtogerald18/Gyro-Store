// Modal para editar los datos base de una compra en tránsito (China).
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { purchaseFormSchema, type PurchaseFormInput, type PurchaseFormValues } from "~/lib/validators";
import { useUpdatePurchaseMutation, useGetPurchasesQuery, type Purchase } from "~/store/api/inventoryV1Api";
import { Input } from "~/components/ui/input";
import { formatUsd } from "~/lib/formatters";
import { Spinner } from "~/components/ui/spinner";

export function EditPurchaseModal({ purchase, onClose }: { purchase: Purchase | null; onClose: () => void }) {
  const [updatePurchase, { isLoading }] = useUpdatePurchaseMutation();
  const { data: purchases = [] } = useGetPurchasesQuery();
  const [codeWarn, setCodeWarn] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<PurchaseFormValues, any, PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    if (purchase) {
      reset({
        purchaseDate: purchase.purchaseDate || "",
        lot: purchase.lot || "",
        code: purchase.code || "",
        productName: purchase.productName || "",
        quantity: purchase.quantity,
        costUnit: purchase.costUnit,
        taxUnit: purchase.taxUnit,
      });
    }
  }, [purchase, reset]);

  const cost = Number(watch("costUnit")) || 0;
  const tax = Number(watch("taxUnit")) || 0;
  const qty = Number(watch("quantity")) || 0;
  const subtotal = cost * qty;
  const totalTax = tax * qty;
  const totalFinal = subtotal + totalTax;

  async function onSubmit(data: PurchaseFormInput) {
    if (!purchase) return;
    data.lot = data.lot.toUpperCase();
    data.code = data.code.toUpperCase();
    try {
      await updatePurchase({ id: purchase.id, body: data }).unwrap();
      toast.success("Compra modificada correctamente.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar la compra.");
    }
  }

  return (
    <Dialog open={!!purchase} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar compra · {purchase?.code ?? ""}</DialogTitle>
        </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-5">

        {/* ── Bloque 1: Datos del ítem ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Fila 1: Fecha + Lote */}
          <Field data-invalid={!!errors.purchaseDate}>
            <FieldLabel htmlFor="edit-purchase-date" required>Fecha de compra</FieldLabel>
            <Input id="edit-purchase-date" type="date" aria-required aria-invalid={!!errors.purchaseDate} {...register("purchaseDate")} />
            <FieldError errors={[errors.purchaseDate]} />
          </Field>
          <Field data-invalid={!!errors.lot}>
            <FieldLabel htmlFor="edit-purchase-lot" required>Lote</FieldLabel>
            <Input id="edit-purchase-lot" aria-required {...register("lot")} aria-invalid={!!errors.lot} />
            <FieldError errors={[errors.lot]} />
          </Field>

          {/* Fila 2: Código — media columna */}
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="edit-purchase-code" required>Código</FieldLabel>
            {(() => {
              const { onBlur: rhfBlur, onChange: rhfChange, ...codeReg } = register("code");
              return (
                <Input
                    id="edit-purchase-code"
                    aria-required
                    aria-invalid={!!errors.code}
                    {...codeReg}
                    onChange={(e) => { rhfChange(e); setCodeWarn(null); }}
                    onBlur={(e) => {
                      rhfBlur(e);
                      const val = e.target.value.trim().toUpperCase();
                      const isDuplicate = purchases.some(
                        (p) => p.code.toUpperCase() === val && p.id !== purchase?.id
                      );
                      if (val && isDuplicate) {
                        setCodeWarn(`El código "${val}" ya está en uso por otra compra.`);
                      } else {
                        setCodeWarn(null);
                      }
                    }}
                />
              );
            })()}
            <FieldError errors={[errors.code]} />
            {/* Aviso, no error: el backend acepta el código duplicado y el admin
                decide. Por eso convive con FieldError en vez de reemplazarlo. */}
            {codeWarn && <FieldDescription className="text-warning">{codeWarn}</FieldDescription>}
          </Field>

          {/* Fila 3: Nombre — ancho completo */}
          <Field className="sm:col-span-2" data-invalid={!!errors.productName}>
            <FieldLabel htmlFor="edit-purchase-name" required>Nombre del producto</FieldLabel>
            <Input id="edit-purchase-name" aria-required {...register("productName")} aria-invalid={!!errors.productName} />
            <FieldError errors={[errors.productName]} />
          </Field>
        </div>

        {/* ── Bloque 2: Datos financieros ── */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field data-invalid={!!errors.quantity}>
            <FieldLabel htmlFor="edit-purchase-qty" required>Cantidad</FieldLabel>
            <Input id="edit-purchase-qty" type="number" min={1} aria-required {...register("quantity")} aria-invalid={!!errors.quantity} />
            <FieldError errors={[errors.quantity]} />
          </Field>
          <Field data-invalid={!!errors.costUnit}>
            <FieldLabel htmlFor="edit-purchase-cost" required>Precio base (USD)</FieldLabel>
            <Input id="edit-purchase-cost" type="number" step="0.01" min={0} aria-required {...register("costUnit")} aria-invalid={!!errors.costUnit} />
            <FieldError errors={[errors.costUnit]} />
          </Field>
          <Field data-invalid={!!errors.taxUnit}>
            <FieldLabel htmlFor="edit-purchase-tax" required>Imp. unitario (USD)</FieldLabel>
            <Input id="edit-purchase-tax" type="number" step="0.0001" min={0} aria-required {...register("taxUnit")} aria-invalid={!!errors.taxUnit} />
            <FieldError errors={[errors.taxUnit]} />
          </Field>

          {/* Tarjeta de totales estilo ticket */}
          <div className="col-span-3 flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal (Base × Cantidad)</span>
              <span className="font-medium text-foreground">{formatUsd(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total de Impuestos (Imp × Cantidad)</span>
              <span className="font-medium text-foreground">+{formatUsd(totalTax, 4)}</span>
            </div>
            <div className="my-1 border-t border-primary/10" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary/70">Total Final</span>
              <span className="font-heading text-xl font-bold text-primary-2">{formatUsd(totalFinal)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">Cancelar</Button>
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
