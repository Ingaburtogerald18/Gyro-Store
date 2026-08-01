// Plantillas: el molde reutilizable de una familia de productos. Define los
// ejes de variante (Color, Conector, Capacidad…) y las specs técnicas base.
//
// No tiene precio, imágenes ni stock: eso vive en cada producto que la usa. Un
// molde lo comparten varios productos, así que editarle los ejes cambia las
// combinaciones de todos — por eso el borrado se bloquea si está en uso.
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Cancel01Icon,
  DashboardSquare01Icon,
  Delete02Icon,
  Edit02Icon,
} from '@hugeicons/core-free-icons';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { AdminTemplate, Category, SpecRow, TemplateAxis, TemplateInput } from '@shared/schemas';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useGetTemplatesQuery,
  useUpdateTemplateMutation,
} from '~/store/api/catalogAdminApi';
import { ToneDot } from './ToneDot';

export function TemplatesPanel({ categories }: { categories: Category[] }) {
  const { data: templates = [], isLoading } = useGetTemplatesQuery();
  const [deleteTemplate] = useDeleteTemplateMutation();

  const [editing, setEditing] = useState<AdminTemplate | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleDelete(template: AdminTemplate) {
    if (!confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
    try {
      await deleteTemplate(template.id).unwrap();
      toast.success('Plantilla eliminada.');
    } catch (err) {
      // El backend responde 409 con el número de productos que la usan: ese
      // mensaje es más útil que un "no se pudo" genérico.
      const message = (err as { data?: { error?: string } })?.data?.error;
      toast.error(message ?? 'No se pudo eliminar la plantilla.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setIsOpen(true);
          }}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-2" />
          Nueva plantilla
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-40 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon
              icon={DashboardSquare01Icon}
              size={48}
              strokeWidth={2}
              className="mb-4 text-muted-foreground"
            />
            <h3 className="text-lg font-medium text-foreground">Sin plantillas</h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Una plantilla define los ejes de variante (Color, Capacidad…) que después reutilizan
              los productos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="truncate font-medium text-foreground">{template.name}</h4>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ToneDot toneKey={template.categoryId} />
                      {categories.find((c) => c.id === template.categoryId)?.name ?? 'Sin categoría'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar plantilla"
                      onClick={() => {
                        setEditing(template);
                        setIsOpen(true);
                      }}
                    >
                      <HugeiconsIcon icon={Edit02Icon} size={15} strokeWidth={2} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar plantilla"
                      className="hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => handleDelete(template)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={2} />
                    </Button>
                  </div>
                </div>

                {template.axes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin ejes — producto simple.</p>
                ) : (
                  <div className="space-y-1.5">
                    {template.axes.map((axis) => (
                      <div key={axis.key} className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          {axis.label}:
                        </span>
                        {axis.options.slice(0, 4).map((option) => (
                          <Badge key={option} variant="secondary" className="text-[10px]">
                            {option}
                          </Badge>
                        ))}
                        {axis.options.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{axis.options.length - 4}
                          </span>
                        )}
                      </div>
                    ))}
                    <p className="pt-1 text-[11px] text-muted-foreground">
                      {template.axes.reduce((total, a) => total * a.options.length, 1)} combinaciones
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateEditorDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        template={editing}
        categories={categories}
      />
    </div>
  );
}

const EMPTY: TemplateInput = { name: '', description: '', categoryId: null, axes: [], specs: [] };

function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: AdminTemplate | null;
  categories: Category[];
}) {
  const [createTemplate, { isLoading: creating }] = useCreateTemplateMutation();
  const [updateTemplate, { isLoading: updating }] = useUpdateTemplateMutation();
  const [form, setForm] = useState<TemplateInput>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      template
        ? {
            name: template.name,
            description: template.description,
            categoryId: template.categoryId,
            axes: template.axes,
            specs: template.specs,
          }
        : EMPTY,
    );
  }, [open, template]);

  function patchAxis(index: number, changes: Partial<TemplateAxis>) {
    setForm((prev) => ({
      ...prev,
      axes: prev.axes.map((axis, i) => (i === index ? { ...axis, ...changes } : axis)),
    }));
  }

  function patchSpec(index: number, changes: Partial<SpecRow>) {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.map((spec, i) => (i === index ? { ...spec, ...changes } : spec)),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // El backend descarta los ejes incompletos, pero avisar acá evita que el
    // admin crea que guardó un eje que en realidad se tiró.
    const incomplete = form.axes.filter(
      (axis) => !axis.label.trim() || axis.options.every((o) => !o.trim()),
    );
    if (incomplete.length > 0) {
      toast.error('Hay ejes sin etiqueta o sin opciones. Completalos o eliminalos.');
      return;
    }

    try {
      if (template) {
        await updateTemplate({ id: template.id, data: form }).unwrap();
        toast.success('Plantilla actualizada.');
      } else {
        await createTemplate(form).unwrap();
        toast.success('Plantilla creada.');
      }
      onOpenChange(false);
    } catch (err) {
      const message = (err as { data?: { error?: string } })?.data?.error;
      toast.error(message ?? 'No se pudo guardar la plantilla.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {template ? 'Editar plantilla' : 'Nueva plantilla'}
          </DialogTitle>
          <DialogDescription>
            Los ejes generan las variantes de cada producto que use esta plantilla.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nombre</Label>
              <Input
                id="template-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Audífonos KZ"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">Categoría</Label>
              <Select
                value={form.categoryId ?? 'none'}
                onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? null : v })}
              >
                <SelectTrigger id="template-category">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <ToneDot />
                    Sin categoría
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <ToneDot toneKey={c.id} />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Nota interna</Label>
            <Textarea
              id="template-description"
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Para qué sirve esta plantilla…"
            />
          </div>

          {/* ── Ejes ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Ejes de variante</h3>
                <p className="text-xs text-muted-foreground">Ej. Color, Conector, Capacidad.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    axes: [
                      ...prev.axes,
                      // `key` se genera acá y no se vuelve a tocar: es la llave
                      // con la que cada producto guarda su recorte de opciones.
                      { key: `eje_${Date.now()}`, label: '', options: [''], isColor: false },
                    ],
                  }))
                }
              >
                <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-1" />
                Eje
              </Button>
            </div>

            {form.axes.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sin ejes: los productos con esta plantilla no tendrán variantes.
              </p>
            ) : (
              form.axes.map((axis, axisIndex) => (
                <div key={axis.key} className="space-y-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`axis-${axis.key}`}>Etiqueta visible</Label>
                      <Input
                        id={`axis-${axis.key}`}
                        value={axis.label}
                        onChange={(e) => patchAxis(axisIndex, { label: e.target.value })}
                        placeholder="Ej. Tipo de conector"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar eje"
                      className="hover:bg-destructive/20 hover:text-destructive"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          axes: prev.axes.filter((_, i) => i !== axisIndex),
                        }))
                      }
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                    <Label className="text-xs font-normal">
                      Es el eje de color (se representa con fotos)
                    </Label>
                    <Switch
                      checked={Boolean(axis.isColor)}
                      onCheckedChange={(c) => patchAxis(axisIndex, { isColor: c })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Opciones
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {axis.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className="flex items-center gap-1 rounded-xl border bg-background pr-1"
                        >
                          <input
                            value={option}
                            onChange={(e) =>
                              patchAxis(axisIndex, {
                                options: axis.options.map((o, i) =>
                                  i === optionIndex ? e.target.value : o,
                                ),
                              })
                            }
                            placeholder="Opción"
                            className="w-28 bg-transparent px-2.5 py-1.5 text-xs outline-none"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Quitar opción"
                            onClick={() =>
                              patchAxis(axisIndex, {
                                options: axis.options.filter((_, i) => i !== optionIndex),
                              })
                            }
                          >
                            <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => patchAxis(axisIndex, { options: [...axis.options, ''] })}
                      >
                        <HugeiconsIcon icon={Add01Icon} size={12} strokeWidth={2} className="mr-1" />
                        Añadir
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Specs base ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Specs técnicas base</h3>
                <p className="text-xs text-muted-foreground">
                  Las heredan todos los productos con esta plantilla.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({ ...prev, specs: [...prev.specs, { label: '', value: '' }] }))
                }
              >
                <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-1" />
                Spec
              </Button>
            </div>

            {form.specs.map((spec, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={spec.label}
                  onChange={(e) => patchSpec(index, { label: e.target.value })}
                  placeholder="Ej. Frecuencia"
                  className="w-1/3"
                />
                <Input
                  value={spec.value}
                  onChange={(e) => patchSpec(index, { value: e.target.value })}
                  placeholder="Ej. 20Hz - 40kHz"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar spec"
                  className="hover:bg-destructive/20 hover:text-destructive"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, specs: prev.specs.filter((_, i) => i !== index) }))
                  }
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating || updating}>
              {(creating || updating) && <Spinner className="mr-2" />}
              {template ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
