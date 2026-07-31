// Formulario de registro de compra (China). Al guardar, la compra entra en estado "En tránsito".
import { useState } from "react";
import { useForm, Controller, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { purchaseFormSchema, type PurchaseFormInput, type PurchaseFormValues } from "~/lib/validators";
import { useCreatePurchaseMutation, useGetPurchasesQuery } from "~/store/api/inventoryV1Api";
import { Input } from "~/components/ui/input";
import { formatUsd } from "~/lib/utils";

const EMPTY_PURCHASE = {
  purchaseDate: "",
  lot: "",
  code: "",
  productName: "",
  quantity: "",
  costUnit: "",
  taxUnit: "",
} as unknown as DefaultValues<PurchaseFormValues>;

export function PurchaseForm({ onDone }: { onDone?: () => void } = {}) {
  const [createPurchase, { isLoading }] = useCreatePurchaseMutation();
  const { data: purchases = [] } = useGetPurchasesQuery();
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PurchaseFormValues, any, PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: EMPTY_PURCHASE,
    mode: "onBlur",
  });

  const cost = Number(watch("costUnit")) || 0;
  const tax = Number(watch("taxUnit")) || 0;
  const qty = Number(watch("quantity")) || 0;
  const subtotal = cost * qty;
  const totalTax = tax * qty;
  const totalFinal = subtotal + totalTax;

  async function onSubmit(data: PurchaseFormInput) {
    // Normalizar a mayúsculas antes de guardar
    data.lot = data.lot.toUpperCase();
    data.code = data.code.toUpperCase();
    try {
      await createPurchase(data).unwrap();
      toast.success("Compra registrada (En tránsito).");
      setCodeError(null);
      setShowSuccessPrompt(true);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar la compra.");
    }
  }

  if (showSuccessPrompt) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold">¡Compra registrada con éxito!</h2>
          <p className="text-muted-foreground mt-1">La compra ha sido guardada con estado "En tránsito".</p>
        </div>
        <p className="font-medium mt-4">¿Deseas registrar otra compra?</p>
        <div className="flex w-full sm:w-auto gap-3 pt-4">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => { reset(EMPTY_PURCHASE); setShowSuccessPrompt(false); onDone?.(); }}>
            No, volver
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => { reset(EMPTY_PURCHASE); setShowSuccessPrompt(false); }}>
            Sí, agregar otra
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-5 p-1">

      {/* ── Bloque 1: Datos del ítem ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Fila 1: Fecha + Lote */}
        <div className="grid gap-2">
  <Label>Fecha de compra</Label>
          <Input type="date" {...register("purchaseDate")} aria-invalid={!!errors.purchaseDate} />
        </div>
        <div className="grid gap-2">
  <Label>Lote</Label>
          <Controller
            control={control}
            name="lot"
            render={({ field }) => (
              <>
                <Input
                  type="text"
                  list="lot-options"
                  value={field.value || ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  aria-invalid={!!errors.lot}
                />
                <datalist id="lot-options">
                  {Array.from(new Set(purchases.map((p) => p.lot).filter(Boolean))).map((opt: string) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </>
            )}
          />
        </div>

        {/* Fila 1 cont. (lg): Código */}
        <div className="grid gap-2">
  <Label>Código</Label>
          {(() => {
            const { onBlur: rhfBlur, onChange: rhfChange, ...codeReg } = register("code");
            return (
              <>
                <input
                  className="input"
                  {...codeReg}
                  onChange={(e) => { rhfChange(e); setCodeError(null); }}
                  onBlur={(e) => {
                    rhfBlur(e);
                    const val = e.target.value.trim().toUpperCase();
                    if (val && purchases.some((p) => p.code.toUpperCase() === val)) {
                      setCodeError(`El código "${val}" ya está en uso.`);
                      toast.warning(`El código "${val}" ya está registrado en el inventario.`);
                    } else {
                      setCodeError(null);
                    }
                  }}
                />
                {codeError && <span className="mt-1 block text-xs text-amber-500">⚠ {codeError}</span>}
              </>
            );
          })()}
        </div>

        {/* Fila 2: Nombre del producto — ancho completo */}
        <div className="sm:col-span-2 lg:col-span-3">
          <div className="grid gap-2">
  <Label>Nombre del producto</Label>
            <Controller
              control={control}
              name="productName"
              render={({ field }) => (
                <>
                  <Input
                    type="text"
                    list="product-name-options"
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    aria-invalid={!!errors.productName}
                  />
                  <datalist id="product-name-options">
                    {Array.from(new Set(purchases.map((p) => p.productName).filter(Boolean))).map((opt: string) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </>
              )}
            />
          </div>
        </div>
      </div>

      {/* ── Bloque 2: Datos financieros ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
  <Label>Cantidad</Label>
          <input type="number" min={1} className="input h-10" {...register("quantity")} />
        </div>
        <div className="grid gap-2">
  <Label>Precio base (USD)</Label>
          <input type="number" step="0.01" min={0} className="input h-10" {...register("costUnit")} />
        </div>
        <div className="grid gap-2">
  <Label>Imp. unitario (USD)</Label>
          <input type="number" step="0.0001" min={0} className="input h-10" {...register("taxUnit")} />
        </div>

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

      <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Registrar compra
      </Button>
    </form>
  );
}
