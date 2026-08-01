// Editor de venta: el vendedor arma N líneas y ve la cotización EN VIVO
// (comisión, y para admin el desglose de costos). Portado de `SaleEditor` de v1.
//
// Lo que NO se porta, por decisiones ya tomadas en v2 (ver la cabecera de
// server/services/sales.ts): foto de recibo, admin registrando a nombre de otro
// vendedor, fecha de venta manual, inventario migrado (modos M1/M2) y cuotas.
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, CheckmarkCircle01Icon, PackageIcon, UserIcon } from '@hugeicons/core-free-icons';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { Textarea } from '~/components/ui/textarea';
import { errMsg, formatCordobas } from '~/lib/formatters';
import {
  useGetSellableProductsQuery,
  useQuoteSaleMutation,
  useRegisterSaleMutation,
  useUpdateSaleMutation,
  type QuoteResult,
  type SaleLineInput,
  type SaleWithItems,
  type SellableProduct,
} from '~/store/api/salesApi';

import { SaleLinesTable, newEditorLine, type EditorLine } from './SaleLinesTable';
import { QuoteSummary } from './QuoteSummary';

export function SaleEditor({
  sale,
  onDone,
}: {
  /** Venta a editar. Sin esto, el editor registra una venta nueva. */
  sale?: SaleWithItems | null;
  onDone?: () => void;
} = {}) {
  const isEdit = !!sale;

  const { data: products = [] } = useGetSellableProductsQuery();
  const [quoteSale, { isLoading: quoting }] = useQuoteSaleMutation();
  const [registerSale, { isLoading: registering }] = useRegisterSaleMutation();
  const [updateSale, { isLoading: updating }] = useUpdateSaleMutation();

  const [lines, setLines] = useState<EditorLine[]>(() =>
    sale?.items?.length
      ? sale.items.map((it) => ({
          uid: crypto.randomUUID(),
          productName: it.productName,
          quantity: it.quantity,
          salePrice: it.salePrice,
        }))
      : [newEditorLine()],
  );
  const [phone, setPhone] = useState(sale?.phone ?? '');
  const [editReason, setEditReason] = useState('');
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // En modo edición la venta YA tiene su stock reservado, así que sus productos
  // aparecerían agotados y no se podrían volver a seleccionar. Se les "devuelve"
  // esa cantidad al catálogo del editor. Sin esto, editar una venta es imposible.
  const productsForUi: SellableProduct[] = useMemo(() => {
    if (!sale?.items?.length) return products;
    const byName = new Map(products.map((p) => [p.productName, { ...p }]));
    for (const item of sale.items) {
      const existing = byName.get(item.productName);
      if (existing) existing.stock += item.quantity || 0;
      else
        byName.set(item.productName, {
          productName: item.productName,
          price: item.salePrice,
          stock: item.quantity || 0,
        });
    }
    return Array.from(byName.values());
  }, [products, sale]);

  // Líneas listas para cotizar: producto elegido, cantidad y precio numéricos.
  const validLines: SaleLineInput[] = lines
    .filter(
      (l) =>
        l.productName.trim() !== '' &&
        typeof l.quantity === 'number' &&
        l.quantity > 0 &&
        typeof l.salePrice === 'number' &&
        l.salePrice > 0,
    )
    .map((l) => ({
      productName: l.productName.trim(),
      quantity: l.quantity as number,
      salePrice: l.salePrice as number,
    }));

  // El backend rechaza el mismo producto en dos líneas (evita repartir reservas).
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const l of lines) {
      const name = l.productName.trim();
      if (!name) continue;
      if (seen.has(name)) dupes.add(name);
      seen.add(name);
    }
    return dupes;
  }, [lines]);

  const hasOverStock = lines.some((l) => {
    const p = productsForUi.find((pr) => pr.productName === l.productName);
    return p && typeof l.quantity === 'number' && l.quantity > p.stock;
  });

  // El margen mínimo lo evalúa el servidor: si lo marca, registrar va a fallar.
  // Se avisa ANTES en vez de dejar que reviente al enviar.
  const belowMinMarginNames = (result?.lines ?? [])
    .filter((l) => l.belowMinMargin)
    .map((l) => l.productName);

  // Total local optimista: mientras el servidor cotiza, el botón ya muestra el
  // importe. Así la cifra no parpadea ni desaparece entre cotizaciones.
  const localTotal = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.salePrice) || 0),
    0,
  );

  // UNA sola razón visible a la vez, en orden de prioridad: el botón
  // deshabilitado SIEMPRE explica por qué.
  const disabledReason =
    validLines.length === 0
      ? 'Agrega al menos un producto con cantidad y precio.'
      : duplicateNames.size > 0
        ? 'Hay un producto repetido: juntá las unidades en una sola línea.'
        : hasOverStock
          ? 'Hay líneas que exceden el stock disponible.'
          : belowMinMarginNames.length > 0
            ? `Hay líneas por debajo del margen mínimo (${belowMinMarginNames.join(', ')}).`
            : isEdit && sale?.status !== 'pending_approval' && !editReason.trim()
              ? 'Escribe el motivo de la edición para habilitar el guardado.'
              : null;

  // ── Cotización en vivo ──
  // La dependencia es el JSON de las líneas VÁLIDAS, no el array: así no se
  // recotiza en cada tecla de una línea todavía incompleta.
  const linesKey = JSON.stringify(validLines);
  useEffect(() => {
    const items: SaleLineInput[] = JSON.parse(linesKey);

    if (items.length === 0) {
      setResult(null);
      setErrorMsg('');
      return;
    }
    // Cotizar con un producto repetido devuelve 400: se avisa sin llamar.
    if (new Set(items.map((i) => i.productName)).size !== items.length) {
      setResult(null);
      setErrorMsg('Hay un producto repetido: juntá las unidades en una sola línea.');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setResult(await quoteSale(items).unwrap());
        setErrorMsg('');
      } catch (err) {
        setResult(null);
        setErrorMsg(errMsg(err, 'No se pudo calcular la cotización.'));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [linesKey, quoteSale]);

  function resetEditor() {
    setLines([newEditorLine()]);
    setPhone('');
    setResult(null);
    setErrorMsg('');
  }

  async function handleSubmit() {
    if (disabledReason) return;

    try {
      if (isEdit && sale) {
        await updateSale({
          id: sale.id,
          phone: phone.trim() || undefined,
          items: validLines,
          reason: editReason.trim() || undefined,
        }).unwrap();
        toast.success('Venta actualizada.');
        onDone?.();
        return;
      }

      await registerSale({ phone: phone.trim() || undefined, items: validLines }).unwrap();
      toast.success('Venta registrada. Pendiente de aprobación.');
      resetEditor();
      onDone?.();
    } catch (err) {
      toast.error(
        errMsg(err, isEdit ? 'No se pudo actualizar la venta.' : 'No se pudo registrar la venta.'),
      );
    }
  }

  const busy = registering || updating;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      {/* ── Columna izquierda: datos + productos ── */}
      <div className="space-y-4">
        <section className="space-y-3 rounded-card border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={2} className="text-primary-2" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Datos de la venta</h3>
          </div>
          <Field>
            <FieldLabel htmlFor="sale-phone">Teléfono del cliente</FieldLabel>
            <Input
              id="sale-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="8888 8888"
              disabled={busy}
            />
            <FieldDescription>Opcional. Sirve para dar seguimiento al pedido.</FieldDescription>
          </Field>
        </section>

        <section className="space-y-3 rounded-card border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={PackageIcon} size={16} strokeWidth={2} className="text-primary-2" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Productos</h3>
            <span className="nums ml-auto rounded-pill bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {lines.length}
            </span>
          </div>

          <SaleLinesTable
            lines={lines}
            products={productsForUi}
            duplicateNames={duplicateNames}
            onChange={setLines}
            onAddLine={() => setLines((ls) => [...ls, newEditorLine()])}
            disabled={busy}
          />
        </section>
      </div>

      {/* ── Columna derecha: resumen sticky + acciones ── */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <QuoteSummary result={result} loading={quoting} errorMsg={errorMsg} />

        {isEdit && sale?.status !== 'pending_approval' && (
          <Field
            className="rounded-card border bg-card p-4 shadow-sm"
            data-invalid={!editReason.trim()}
          >
            <FieldLabel htmlFor="edit-reason" required>
              Motivo de la edición
            </FieldLabel>
            <Textarea
              id="edit-reason"
              rows={2}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Explicá por qué se edita esta venta ya procesada…"
              aria-required
              aria-invalid={!editReason.trim()}
              disabled={busy}
            />
            <FieldError>
              {!editReason.trim() ? 'El backend rechaza la edición sin motivo.' : undefined}
            </FieldError>
          </Field>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !!disabledReason || !!errorMsg}
            className="w-full py-5 text-sm font-bold"
          >
            {busy ? (
              <Spinner className="mr-2" />
            ) : (
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} strokeWidth={2} className="mr-2" aria-hidden />
            )}
            {isEdit ? 'Guardar cambios' : 'Registrar venta'} ·{' '}
            <span className="nums ml-1">{formatCordobas(result?.total ?? localTotal)}</span>
          </Button>

          {disabledReason && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
              {disabledReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
