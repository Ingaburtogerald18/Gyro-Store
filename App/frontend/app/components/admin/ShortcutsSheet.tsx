// Hoja de atajos (`?`).
//
// Un atajo que nadie sabe que existe no es una feature, es código muerto. Esta
// hoja es la única razón por la que los de `useAdminHotkeys` sirven de algo.
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'General',
    items: [
      { keys: ['⌘', 'K'], label: 'Abrir la paleta de comandos' },
      { keys: ['?'], label: 'Ver esta hoja' },
      { keys: ['Esc'], label: 'Cerrar lo que esté abierto' },
    ],
  },
  {
    title: 'Navegación',
    items: [
      { keys: ['g', '1'], label: 'Reportería' },
      { keys: ['g', '2'], label: 'Inventario' },
      { keys: ['g', '3'], label: 'Ventas' },
      { keys: ['g', '4'], label: 'Cuotas' },
      { keys: ['g', '5'], label: 'Caja y banco' },
      { keys: ['g', '6'], label: 'Catálogo' },
      { keys: ['g', '7'], label: 'Facturación' },
      { keys: ['g', '8'], label: 'Códigos de descuento' },
      { keys: ['g', '9'], label: 'Personal' },
    ],
  },
  {
    title: 'Tablas',
    items: [
      { keys: ['/'], label: 'Buscar en la tabla' },
      { keys: ['⌘', 'F'], label: 'Buscar en la tabla' },
      { keys: ['Esc'], label: 'Limpiar la búsqueda' },
    ],
  },
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="nums min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export function ShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            Los atajos se ignoran mientras escribís en un campo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((item) => (
                  <li key={item.label + item.keys.join()} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((k) => (
                        <Key key={k}>{k}</Key>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
