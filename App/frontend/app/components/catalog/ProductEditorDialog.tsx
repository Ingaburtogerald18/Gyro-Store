// Editor de producto del panel.
//
// Layout de dos columnas (el patrón de Shopify/Linear): la columna ancha tiene
// lo que define el producto —nombre, descripción, fotos, variantes— y la
// angosta lo que lo clasifica y publica. Antes eran cinco tarjetas idénticas
// apiladas, todas con el mismo peso visual: nada indicaba qué era importante.
//
// Portado de `CatalogEditorDrawer` de v1, con dos diferencias de fondo:
//   · el molde (plantilla) es COMPARTIDO, así que este editor no lo modifica;
//   · las variantes se vinculan a LOTES de bodega (`purchases.code`), no a un
//     SKU compartido — en v2 cada lote tiene su propio código único.
import { AnimatedIcon } from '~/components/ui/animated-icons';
import { Tick01Icon } from '@hugeicons/core-free-icons';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  adminProductInputSchema,
  type AdminProduct,
  type AdminProductInput,
  type Category,
  type TemplateAxis,
  type VariantMappings,
} from '@shared/schemas';
import { Button } from '~/components/ui/button';
// Drawer, no modal. El nombre del archivo se conserva para no romper imports;
// lo que cambió es el contenedor. Un formulario de este largo dentro de un
// modal de 5xl tapa el catálogo que se está editando — y editar un producto es
// justo cuando conviene seguir viendo los demás.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import {
  useGetInventoryLotsQuery,
  useGetTemplatesQuery,
  type InventoryLot,
} from '~/store/api/catalogAdminApi';
import { ImageUploader } from './ImageUploader';
import { ToneDot } from './ToneDot';
import { buildCombinations, VariantMappingTable } from './VariantMappingTable';
import { cn } from '~/lib/utils';
import { formatCordobas } from '~/lib/formatters';

const EMPTY: AdminProductInput = {
  name: '',
  description: '',
  price: 0,
  basePrice: 0,
  images: [],
  specs: [],
  categoryId: null,
  published: false,
  isPromo: false,
  sortOrder: 0,
  templateId: null,
  axisOptions: {},
  variantMappings: {},
};

export function ProductEditorDialog({
  open,
  onOpenChange,
  product,
  categories,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = crear */
  product: AdminProduct | null;
  categories: Category[];
  isSaving: boolean;
  onSave: (input: AdminProductInput) => Promise<void>;
}) {
  const { data: templates = [] } = useGetTemplatesQuery(undefined, { skip: !open });
  const { data: lots = [], isLoading: loadingLots } = useGetInventoryLotsQuery(undefined, { skip: !open });

  // La regla de la oferta no vive en el backend, pero tampoco se inventa acá:
  // es la que ya tenía este editor, movida del `handleSubmit` al schema para que
  // salga como error DEL CAMPO `price` en vez de un toast. El resto del contrato
  // es `adminProductInputSchema` tal cual.
  const formSchema = useMemo(
    () =>
      adminProductInputSchema.superRefine((values, ctx) => {
        if (!values.isPromo) return;
        if (!values.price || values.price <= 0) {
          ctx.addIssue({ code: 'custom', path: ['price'], message: 'Ingresá un precio de oferta válido.' });
          return;
        }

        const tpl = templates.find((t) => t.id === values.templateId);
        if (!tpl || tpl.axes.length === 0) return;

        // El precio de venta vive en cada variante: la oferta del producto solo
        // tiene sentido si queda por debajo de todas las vinculadas.
        const axes = tpl.axes.map((axis) => ({
          ...axis,
          options: values.axisOptions?.[axis.key] ?? axis.options,
        }));
        const mapped = buildCombinations(axes)
          .map((combo) => values.variantMappings?.[combo])
          .filter((m): m is NonNullable<typeof m> => Boolean(m?.codes.length));

        if (mapped.length === 0) return;
        if (mapped.some((m) => !m.price || m.price <= 0)) {
          ctx.addIssue({
            code: 'custom',
            path: ['price'],
            message: 'Todas las variantes vinculadas necesitan precio propio para validar la oferta.',
          });
          return;
        }

        const minVariantPrice = Math.min(...mapped.map((m) => m.price as number));
        if (values.price >= minVariantPrice) {
          ctx.addIssue({
            code: 'custom',
            path: ['price'],
            message: `El precio de oferta (${formatCordobas(values.price)}) debe ser menor al de las variantes (mínimo ${formatCordobas(minVariantPrice)}).`,
          });
        }
      }),
    [templates],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<AdminProductInput>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
  });

  const form = watch();
  const template = templates.find((t) => t.id === form.templateId) ?? null;

  // Prefill al abrir. Se depende de `product` y no de `open` a secas para que
  // reabrir el mismo producto tras cancelar no arrastre lo que se había tipeado.
  useEffect(() => {
    if (!open) return;
    reset(
      product
        ? {
            name: product.name,
            description: product.description,
            price: product.price,
            basePrice: product.basePrice ?? 0,
            images: product.images,
            specs: product.specs,
            categoryId: product.categoryId,
            published: product.published,
            isPromo: product.isPromo,
            sortOrder: product.sortOrder,
            templateId: product.templateId,
            axisOptions: product.axisOptions,
            variantMappings: product.variantMappings,
          }
        : EMPTY,
    );
  }, [open, product, reset]);

  // Ejes con las opciones recortadas a lo que ESTE producto ofrece. Todo lo que
  // se genera abajo (combinaciones, tabla de mapeo) sale de acá, no del molde
  // completo: una opción apagada no existe para el cliente.
  const effectiveAxes: TemplateAxis[] = useMemo(() => {
    if (!template) return [];
    return template.axes.map((axis) => ({
      ...axis,
      options: form.axisOptions?.[axis.key] ?? axis.options,
    }));
  }, [template, form.axisOptions]);

  const filteredTemplates = useMemo(() => {
    if (!form.categoryId) return templates;
    // Mostrar solo las plantillas que pertenecen a la categoría elegida
    return templates.filter((t) => t.categoryId === form.categoryId);
  }, [templates, form.categoryId]);

  const combos = useMemo(() => buildCombinations(effectiveAxes), [effectiveAxes]);
  const mappedCount = combos.filter((c) => form.variantMappings?.[c]?.codes.length).length;

  // Al elegir molde: cada eje arranca con TODAS sus opciones activas, pero se
  // conserva lo que ya estaba elegido y se descartan opciones que el molde ya
  // no tiene (pasa si alguien editó la plantilla después).
  useEffect(() => {
    if (!template) return;
    const prev = getValues();
    const next: Record<string, string[]> = {};
    for (const axis of template.axes) {
      const previous = prev.axisOptions?.[axis.key];
      next[axis.key] = previous ? axis.options.filter((o) => previous.includes(o)) : axis.options;
    }
    setValue('axisOptions', next);
    // Nombre y descripción del molde son el punto de partida del producto
    // (mismo gesto que v1). Solo prellenan si están vacíos: nunca pisan.
    if (!prev.name?.trim()) setValue('name', template.name);
    if (!prev.description?.trim()) setValue('description', template.description);
  }, [template, getValues, setValue]);

  function toggleAxisOption(axis: TemplateAxis, option: string) {
    const current = form.axisOptions?.[axis.key] ?? axis.options;
    // El último encendido no se puede apagar: en vez de dejar intentarlo y
    // responder con un toast, la casilla se deshabilita (ver `OptionToggle`).
    if (current.includes(option) && current.length <= 1) return;

    const nextSet = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue('axisOptions', {
      ...form.axisOptions,
      // Se reordena según el molde: el orden define el nombre de la
      // combinación, que es la llave del mapeo.
      [axis.key]: axis.options.filter((o) => nextSet.includes(o)),
    });
  }

  async function onSubmit(values: AdminProductInput) {
    // Aviso antes de guardar: una variante sin lote se muestra «Agotado» para
    // siempre. Es una decisión válida (todavía no llegó el lote), pero conviene
    // que sea consciente y no un descuido. Es una confirmación, no un error de
    // validación — por eso no va como error de campo.
    const unmapped = combos.length - mappedCount;
    if (unmapped > 0) {
      const ok = window.confirm(
        `${unmapped} de ${combos.length} variantes no tienen lote vinculado y se mostrarán como «Agotado». ¿Guardar de todos modos?`,
      );
      if (!ok) return;
    }

    await onSave(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex + max-h-[90vh]: el cuerpo scrollea solo y el pie queda
          siempre a la vista. Con el scroll en el contenedor entero, en un
          formulario largo había que bajar hasta el final para «Guardar». */}
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-14">
          <DialogTitle className="text-lg">
            {product ? 'Editar producto' : 'Nuevo producto'}
          </DialogTitle>
          <DialogDescription>
            El precio de venta se define en cada variante, junto con el lote de bodega que la surte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
              {/* ── Columna principal: lo que ES el producto ── */}
              <div className="min-w-0 space-y-8">
                <div className="space-y-4">
                  <Field data-invalid={!!errors.name}>
                    <FieldLabel htmlFor="product-name" required>
                      Nombre del producto
                    </FieldLabel>
                    <Input
                      id="product-name"
                      placeholder="KZ ZSN Pro X"
                      className="h-11 text-base font-medium"
                      aria-required
                      aria-invalid={!!errors.name}
                      {...register('name')}
                    />
                    <FieldError errors={[errors.name]} />
                  </Field>

                  <Field data-invalid={!!errors.description}>
                    <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
                    <Textarea
                      id="product-description"
                      rows={5}
                      placeholder="Lo que el cliente lee en la ficha del producto…"
                      aria-invalid={!!errors.description}
                      {...register('description')}
                    />
                    <FieldError errors={[errors.description]} />
                  </Field>
                </div>

                <FormSection
                  title="Fotos"
                  hint="La primera es la portada. Tamaño recomendado: 1080x1080px (formato cuadrado 1:1) para que calce perfecto en la tienda."
                >
                  <Controller
                    control={control}
                    name="images"
                    render={({ field }) => (
                      <ImageUploader
                        images={field.value ?? []}
                        onChange={field.onChange}
                        disabled={isSaving}
                      />
                    )}
                  />
                  <FieldError errors={[errors.images]} />
                </FormSection>

                {template && template.axes.length > 0 && (
                  <FormSection
                    title="Opciones que ofrece"
                    hint="Lo apagado no existe para el cliente."
                  >
                    <div className="space-y-4">
                      {template.axes.map((axis) => {
                        const included = form.axisOptions?.[axis.key] ?? axis.options;
                        return (
                          <div key={axis.key}>
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              {axis.label}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {axis.options.map((option) => {
                                const checked = included.includes(option);
                                return (
                                  <OptionToggle
                                    key={option}
                                    label={option}
                                    checked={checked}
                                    // Un eje sin ninguna opción no genera variantes:
                                    // el último encendido queda bloqueado.
                                    disabled={checked && included.length <= 1}
                                    onToggle={() => toggleAxisOption(axis, option)}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </FormSection>
                )}

                <FormSection
                  title="Variantes y bodega"
                  hint="El precio va acá. El stock se lee de los lotes vinculados, en vivo."
                  aside={
                    template && combos.length > 0 ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {mappedCount}/{combos.length} vinculadas
                      </span>
                    ) : null
                  }
                >
                  {template ? (
                    <Controller
                      control={control}
                      name="variantMappings"
                      render={({ field }) => (
                        <VariantMappingTable
                          axes={effectiveAxes}
                          variantMappings={field.value ?? {}}
                          onChange={(variantMappings: VariantMappings) =>
                            field.onChange(variantMappings)
                          }
                          lots={lots as InventoryLot[]}
                          basePrice={form.price}
                          isLoading={loadingLots}
                        />
                      )}
                    />
                  ) : (
                    <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Elegí una plantilla en «Organización» para generar las variantes.
                    </p>
                  )}
                </FormSection>
              </div>

              {/* ── Columna lateral: cómo se clasifica y se publica ──
                  Superficie propia (bg-muted/40) para separarla del contenido
                  principal sin repetir el mismo marco de tarjeta cinco veces. */}
              <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                <SidePanel title="Estado">
                  <Controller
                    control={control}
                    name="published"
                    render={({ field }) => (
                      <ToggleRow
                        id="product-published"
                        label="Publicado"
                        hint="Visible en la tienda"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="isPromo"
                    render={({ field }) => (
                      <ToggleRow
                        id="product-promo"
                        label="En oferta"
                        hint="Se destaca en el inicio"
                        checked={field.value}
                        onCheckedChange={(c) => {
                          field.onChange(c);
                          // Apagar la oferta borra su precio: el de venta vive
                          // en cada variante, no acá.
                          if (!c) setValue('price', 0);
                        }}
                      />
                    )}
                  />

                  {form.isPromo && (
                    <Field className="border-t pt-3" data-invalid={!!errors.price}>
                      <FieldLabel htmlFor="product-offer-price" required>
                        Precio de oferta (C$)
                      </FieldLabel>
                      <Controller
                        control={control}
                        name="price"
                        render={({ field }) => (
                          <Input
                            id="product-offer-price"
                            type="number"
                            min="0"
                            step="0.01"
                            aria-required
                            aria-invalid={!!errors.price}
                            value={field.value || ''}
                            onBlur={field.onBlur}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                      <FieldDescription>Debe ser menor al precio de las variantes.</FieldDescription>
                      <FieldError errors={[errors.price]} />
                    </Field>
                  )}
                </SidePanel>

                <SidePanel title="Organización">
                  <Field data-invalid={!!errors.categoryId}>
                    <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
                    <Controller
                      control={control}
                      name="categoryId"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? 'none'}
                          onValueChange={(v) => {
                            const newCat = v === 'none' ? null : v;
                            field.onChange(newCat);
                            // Si la plantilla actual no pertenece a la nueva
                            // categoría, se limpia.
                            const currentTemplateId = getValues('templateId');
                            if (newCat && currentTemplateId) {
                              const current = templates.find((t) => t.id === currentTemplateId);
                              if (current && current.categoryId !== newCat) {
                                setValue('templateId', null);
                              }
                            }
                          }}
                        >
                          <SelectTrigger id="product-category" className="w-full">
                            <SelectValue placeholder="Sin categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <ToneDot />
                              Sin categoría
                            </SelectItem>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {/* El punto va DENTRO del item: Radix reusa su
                                    contenido para pintar el valor seleccionado, así
                                    que el color también se ve en el trigger. */}
                                <ToneDot toneKey={c.id} />
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError errors={[errors.categoryId]} />
                  </Field>

                  <Field data-invalid={!!errors.templateId}>
                    <FieldLabel htmlFor="product-template">Plantilla</FieldLabel>
                    <Controller
                      control={control}
                      name="templateId"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? 'none'}
                          onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                        >
                          <SelectTrigger id="product-template" className="w-full">
                            <SelectValue placeholder="Sin plantilla" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <ToneDot />
                              Sin plantilla (producto simple)
                            </SelectItem>
                            {filteredTemplates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {/* La plantilla hereda el tono de SU categoría: el
                                    color dice de un vistazo a qué familia pertenece. */}
                                <ToneDot toneKey={t.categoryId} />
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldDescription>
                      {form.categoryId
                        ? 'Solo las plantillas de esta categoría. Define los ejes de variante.'
                        : 'Define los ejes de variante (color, conector…).'}
                    </FieldDescription>
                    <FieldError errors={[errors.templateId]} />
                  </Field>
                </SidePanel>
              </aside>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Spinner className="mr-2" />}
              {product ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Opción que el producto ofrece o no. Es una casilla, no un botón de acción:
// `role="checkbox"` porque son varias selecciones independientes dentro de un eje.
//
// El texto va SIEMPRE a contraste pleno (`foreground` / `muted-foreground`).
// Antes el estado encendido se pintaba `text-primary` sobre `bg-primary/10`, y
// en tema oscuro `--primary` es oklch(0.432): verde oscuro sobre verde oscuro,
// muy por debajo del 4.5:1 que exige DESIGN.md §9. Ahora el estado lo carga la
// casilla —forma + tilde—, no el color del texto.
function OptionToggle({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      title={disabled ? 'Cada eje debe ofrecer al menos una opción.' : undefined}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2 text-xs transition-colors',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none',
        'motion-reduce:transition-none',
        'disabled:cursor-not-allowed',
        checked
          ? 'border-primary/40 bg-primary/5 text-foreground'
          : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors',
          'motion-reduce:transition-none',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-input/60',
        )}
      >
        {checked && <AnimatedIcon icon={Tick01Icon} size={12} strokeWidth={2.5} />}
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// Encabezado tipográfico con hairline. Reemplaza a la tarjeta con chip de icono
// que se repetía en cada sección: cinco marcos idénticos no jerarquizan nada.
function FormSection({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 border-b pb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-card border bg-muted/40 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id} className="font-medium">
          {label}
        </FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
}
