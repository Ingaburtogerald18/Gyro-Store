// Filtro de categorías del catálogo: fila scrollable de chips, "Todo" primero.
// Reciclado del V1, repintado con los tokens del preset (nada de hex crudos).
//
// El V1 abría un dropdown de subcategorías por portal; acá no aplica todavía:
// `StoreCategory` solo trae { id, name, icon } — no hay subcategorías en el
// contrato. Cuando existan, el dropdown va acá.
import { useRef } from 'react';

import type { StoreCategory } from '~/store/api/sessionApi';
import { cn } from '~/lib/utils';

interface CategoryChipsProps {
  categories: StoreCategory[];
  /** `null` = "Todo". */
  active: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}

export function CategoryChips({ categories, active, onChange, className }: CategoryChipsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (categories.length === 0) return null;

  return (
    <div className={cn('relative', className)}>
      {/* Degradados de borde: insinúan que la fila sigue. Puramente decorativos. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent"
        aria-hidden />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent"
        aria-hidden />

      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Categorías"
        className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth px-1 py-1" >
        <Chip selected={active === null} onSelect={() => onChange(null)}>
          Todo
        </Chip>

        {categories.map((c) => (
          <Chip key={c.id} selected={active === c.id} onSelect={() => onChange(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        // ≥44px de alto real para el touch target, aunque el chip se vea compacto.
        'shrink-0 rounded-pill px-4 py-2.5 text-sm font-medium whitespace-nowrap',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected
          ? 'bg-primary/12 text-primary-2'
          : 'text-muted-foreground hover:text-foreground',
      )} >
      {children}
    </button>
  );
}
