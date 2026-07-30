// Selector de opciones de variante (color, capacidad, etc.). Una fila de chips
// por eje; la selección se guarda como texto ("negro / 128GB") y viaja al
// carrito y al mensaje de WhatsApp.
//
// IMPORTANTE: la variante NO cambia el precio. En la v2 el precio lo resuelve
// siempre el servidor por `catalogItemId`; los precios por variante
// (`variant_mappings`) llegan con el panel de catálogo del Hito 2.
import type { CatalogAxis } from '@shared/schemas';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';

export type VariantSelection = Record<string, string>;

// Nombre legible de la combinación elegida, en el orden de los ejes.
export function variantLabel(axes: CatalogAxis[], selection: VariantSelection): string {
  const parts = axes.map((a) => selection[a.key]).filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Estándar';
}

export function VariantPicker({
  axes,
  selection,
  onChange,
}: {
  axes: CatalogAxis[];
  selection: VariantSelection;
  onChange: (next: VariantSelection) => void;
}) {
  const pickable = axes.filter((a) => a.options.length > 0);
  if (pickable.length === 0) return null;

  return (
    <div className="space-y-4">
      {pickable.map((axis) => (
        <div key={axis.key} className="space-y-2">
          <Label className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            {axis.key}
          </Label>
          <div className="flex flex-wrap gap-2">
            {axis.options.map((option) => {
              const active = selection[axis.key] === option;
              return (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={active}
                  onClick={() => onChange({ ...selection, [axis.key]: option })}
                  className={
                    active
                      ? 'rounded-pill border-accent bg-accent/10 text-accent'
                      : 'rounded-pill text-muted'
                  }
                >
                  {option}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
