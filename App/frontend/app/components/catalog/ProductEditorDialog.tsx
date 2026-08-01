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
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick01Icon } from '@hugeicons/core-free-icons';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type {
  AdminProduct,
  AdminProductInput,
  Category,
  TemplateAxis,
  VariantMappings,
} from '@shared/schemas';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import {
  useGetInventoryLotsQuery,
  useGetTemplatesQuery,
  useGetAdminCatalogQuery,
  type InventoryLot,
} from '~/store/api/catalogAdminApi';
import { ImageUploader } from './ImageUploader';
import { ToneDot } from './ToneDot';
import { buildCombinations, VariantMappingTable } from './VariantMappingTable';
import { cn } from '~/lib/utils';

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
  const { data: allProducts = [] } = useGetAdminCatalogQuery(undefined, { skip: !open });

  const [form, setForm] = useState<AdminProductInput>(EMPTY);

  const template = templates.find((t) => t.id === form.templateId) ?? null;

  // Set con los códigos de lote que YA están mapeados a OTROS productos distintos al que se edita.
  // Permite ocultarlos del buscador para no vender el mismo stock dos veces.
  const externallyMappedCodes = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      if (product && p.id === product.id) continue;
      if (p.variantMappings) {
        for (const mapping of Object.values(p.variantMappings)) {
          for (const code of mapping.codes) set.add(code);
        }
      }
    }
    return set;
  }, [allProducts, product]);

  const availableLots = useMemo(() => {
    return lots.filter((lot) => !externallyMappedCodes.has(lot.code));
  }, [lots, externallyMappedCodes]);

  // Prefill al abrir. Se depende de `product` y no de `open` a secas para que
  // reabrir el mismo producto tras cancelar no arrastre lo que se había tipeado.
  useEffect(() => {
    if (!open) return;
    setForm(
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
  }, [open, product]);

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
    setForm((prev) => {
      const next: Record<string, string[]> = {};
      for (const axis of template.axes) {
        const previous = prev.axisOptions?.[axis.key];
        next[axis.key] = previous ? axis.options.filter((o) => previous.includes(o)) : axis.options;
      }
      return {
        ...prev,
        axisOptions: next,
        // Nombre y descripción del molde son el punto de partida del producto
        // (mismo gesto que v1). Solo prellenan si están vacíos: nunca pisan.
        name: prev.name?.trim() ? prev.name : template.name,
        description: prev.description?.trim() ? prev.description : template.description,
      };
    });
  }, [template]);

  function toggleAxisOption(axis: TemplateAxis, option: string) {
    const current = form.axisOptions?.[axis.key] ?? axis.options;
    if (current.includes(option) && current.length <= 1) {
      toast.error('Cada eje debe ofrecer al menos una opción.');
      return;
    }
    const nextSet = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setForm((prev) => ({
      ...prev,
      axisOptions: {
        ...prev.axisOptions,
        // Se reordena según el molde: el orden define el nombre de la
        // combinación, que es la llave del mapeo.
        [axis.key]: axis.options.filter((o) => nextSet.includes(o)),
      },
    }));
  }

  // El precio de venta vive en cada variante. `form.price` es el precio de
  // OFERTA del producto, así que solo tiene sentido si supera por abajo al de
  // todas las variantes vinculadas — si no, la "oferta" sería más cara.
  function validatePromo(): string | null {
    if (!form.isPromo) return null;
    if (!form.price || form.price <= 0) return 'Ingresá un precio de oferta válido.';
    if (effectiveAxes.length === 0) return null;

    const mapped = combos
      .map((combo) => form.variantMappings?.[combo])
      .filter((m): m is NonNullable<typeof m> => Boolean(m?.codes.length));

    if (mapped.length === 0) return null;
    if (mapped.some((m) => !m.price || m.price <= 0)) {
      return 'Todas las variantes vinculadas necesitan precio propio para validar la oferta.';
    }

    const minVariantPrice = Math.min(...mapped.map((m) => m.price as number));
    if (form.price >= minVariantPrice) {
      return `El precio de oferta (C$ ${form.price}) debe ser menor al de las variantes (mínimo C$ ${minVariantPrice}).`;
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error('El nombre del producto es obligatorio.');
      return;
    }

    const promoError = validatePromo();
    if (promoError) {
      toast.error(promoError);
      return;
    }

    // Aviso antes de guardar: una variante sin lote se muestra «Agotado» para
    // siempre. Es una decisión válida (todavía no llegó el lote), pero conviene
    // que sea consciente y no un descuido.
    const unmapped = combos.length - mappedCount;
    if (unmapped > 0) {
      const ok = window.confirm(
        `${unmapped} de ${combos.length} variantes no tienen lote vinculado y se mostrarán como «Agotado». ¿Guardar de todos modos?`,
      );
      if (!ok) return;
    }

    await onSave(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex: el cuerpo scrollea solo y el pie queda siempre a la vista.
          Con el scroll en el contenedor entero, en un formulario largo había que
          bajar hasta el final para encontrar «Guardar». */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
          <DialogTitle className="text-lg">
            {product ? 'Editar producto' : 'Nuevo producto'}
          </DialogTitle>
          <DialogDescription>
            El precio de venta se define en cada variante, junto con el lote de bodega que la surte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
              {/* ── Columna principal: lo que ES el producto ── */}
              <div className="min-w-0 space-y-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-name">Nombre del producto</Label>
                    <Input
                      id="product-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="KZ ZSN Pro X"
                      className="h-11 text-base font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-description">Descripción</Label>
                    <Textarea
                      id="product-description"
                      rows={5}
                      value={form.description ?? ''}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Lo que el cliente lee en la ficha del producto…"
                    />
                  </div>
                </div>

                <FormSection
                  title="Fotos"
                  hint="La primera es la portada. Tamaño recomendado: 1080x1080px (formato cuadrado 1:1) para que calce perfecto en la tienda."
                >
                  <ImageUploader
                    images={form.images}
                    onChange={(images) => setForm({ ...form, images })}
                    disabled={isSaving}
                  />
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
                              {axis.options.map((option) => (
                                <OptionToggle
                                  key={option}
                                  label={option}
                                  checked={included.includes(option)}
                                  onToggle={() => toggleAxisOption(axis, option)}
                                />
                              ))}
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
                    <VariantMappingTable
                      axes={effectiveAxes}
                      variantMappings={form.variantMappings ?? {}}
                      onChange={(variantMappings: VariantMappings) =>
                        setForm({ ...form, variantMappings })
                      }
                      lots={lots as InventoryLot[]}
                      basePrice={form.price}
                      isLoading={loadingLots}
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
                  <ToggleRow
                    id="product-published"
                    label="Publicado"
                    hint="Visible en la tienda"
                    checked={form.published}
                    onCheckedChange={(c) => setForm({ ...form, published: c })}
                  />

                  <ToggleRow
                    id="product-promo"
                    label="En oferta"
                    hint="Se destaca en el inicio"
                    checked={form.isPromo}
                    onCheckedChange={(c) =>
                      setForm({ ...form, isPromo: c, price: c ? form.price : 0 })
                    }
                  />

                  {form.isPromo && (
                    <div className="space-y-2 border-t pt-3">
                      <Label htmlFor="product-offer-price">Precio de oferta (C$)</Label>
                      <Input
                        id="product-offer-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price || ''}
                        onChange={(e) =>
                          setForm({ ...form, price: parseFloat(e.target.value) || 0 })
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Debe ser menor al precio de las variantes.
                      </p>
                    </div>
                  )}
                </SidePanel>

                <SidePanel title="Organización">
                  <div className="space-y-2">
                    <Label htmlFor="product-category">Categoría</Label>
                    <Select
                      value={form.categoryId ?? 'none'}
                      onValueChange={(v) => {
                        const newCat = v === 'none' ? null : v;
                        setForm((prev) => {
                          const next = { ...prev, categoryId: newCat };
                          // Si cambiamos de categoría y la plantilla actual no pertenece a la nueva, la limpiamos.
                          if (newCat && prev.templateId) {
                            const currentTemplate = templates.find(t => t.id === prev.templateId);
                            if (currentTemplate && currentTemplate.categoryId !== newCat) {
                              next.templateId = null;
                            }
                          }
                          return next;
                        });
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-template">Plantilla</Label>
                    <Select
                      value={form.templateId ?? 'none'}
                      onValueChange={(v) =>
                        setForm({ ...form, templateId: v === 'none' ? null : v })
                      }
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
                    <p className="text-xs text-muted-foreground">
                      {form.categoryId
                        ? 'Solo las plantillas de esta categoría. Define los ejes de variante.'
                        : 'Define los ejes de variante (color, conector…).'}
                    </p>
                  </div>
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
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2 text-xs transition-colors',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none',
        'motion-reduce:transition-none',
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
        {checked && <HugeiconsIcon icon={Tick01Icon} size={12} strokeWidth={2.5} />}
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
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
