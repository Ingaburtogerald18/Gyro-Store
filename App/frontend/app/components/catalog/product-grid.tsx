// Catálogo de la home. Portado de la versión que corre hoy en la tienda: la
// vista por defecto NO es una grilla, son carruseles — "SuperOfertas" primero y
// después uno por categoría. La grilla uniforme queda para los resultados de
// búsqueda/filtro (pieza posterior del Hito 1).
import { PackageSearch } from 'lucide-react';
import type { CatalogProduct } from '@shared/schemas';
import type { StoreCategory } from '~/store/api/configApi';
import { ProductCard } from '~/components/product/product-card';
import { ProductCarousel } from '~/components/product/product-carousel';
import { Skeleton } from '~/components/ui/skeleton';

export const isDeal = (p: CatalogProduct) =>
  p.isPromo || (p.compareAtPrice ?? 0) > p.price;

interface ProductGridProps {
  products: CatalogProduct[];
  categories?: StoreCategory[];
  isLoading?: boolean;
}

export function ProductGrid({ products, categories = [], isLoading }: ProductGridProps) {
  if (isLoading) return <GridSkeleton />;
  if (products.length === 0) {
    return <EmptyState text="Aún no hay productos publicados." />;
  }

  const deals = products.filter(isDeal);
  const rest = products.filter((p) => !isDeal(p));

  // Agrupación por categoría. En la v2 los productos todavía no traen categoría
  // (no existe la columna), así que esto queda vacío y cae al carrusel único de
  // abajo. Cuando el Hito 2 agregue la categoría, los carruseles aparecen solos.
  const byCategory = categories
    .map((c) => ({
      category: c,
      items: rest.filter((p) => p.category === c.id || p.category === c.name),
    }))
    .filter((g) => g.items.length > 0);

  const grouped = new Set(byCategory.flatMap((g) => g.items.map((p) => p.id)));
  const ungrouped = rest.filter((p) => !grouped.has(p.id));

  return (
    <div className="space-y-4 pb-2 md:space-y-10 md:pb-12">
      {deals.length > 0 && (
        <ProductCarousel
          title="SuperOfertas"
          subtitle="Precios rebajados por tiempo limitado"
          products={deals}
          variant="showcase"
        />
      )}

      {byCategory.map(({ category, items }) => (
        <ProductCarousel
          key={category.id}
          title={category.name}
          products={items}
          variant="showcase"
        />
      ))}

      {ungrouped.length > 0 && (
        <ProductCarousel
          title="Todo el catálogo"
          subtitle="Explora todos nuestros productos"
          products={ungrouped}
          variant="showcase"
        />
      )}
    </div>
  );
}

// Grilla uniforme: todas las tarjetas del mismo tamaño y aspect-ratio, sin tiles
// anchos. El `h-full` en cada celda ancla el CTA al fondo con alturas parejas.
export function ProductResultsGrid({ products }: { products: CatalogProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <div key={p.id} className="h-full">
          <ProductCard product={p} index={i} />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-2xl sm:aspect-[4/3]" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-full sm:h-11" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border bg-card py-20 text-center">
      <span
        className="relative grid h-16 w-16 place-items-center rounded-2xl bg-primary/8 text-primary-2 ring-1 ring-primary/15 ring-inset"
        aria-hidden
      >
        <span className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
        <PackageSearch className="relative h-7 w-7" />
      </span>
      <p className="max-w-xs text-sm text-balance text-muted-foreground">{text}</p>
    </div>
  );
}
