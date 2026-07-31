// Catálogo de la home, restaurado al layout del V1: una GRILLA UNIFORME
// filtrable por CategoryChips, no una pila de carruseles por categoría.
// "SuperOfertas" se conserva como carrusel destacado arriba, que es la única
// sección donde el scroll horizontal aporta (es una selección corta y curada).
//
// Regla del V1: todas las tarjetas del mismo tamaño, cero huecos. Nada de
// col-span-2 ni grid-auto-flow:dense.
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { PackageSearchIcon } from '@hugeicons/core-free-icons';

import type { CatalogProduct } from '@shared/schemas';
import type { StoreCategory } from '~/store/api/configApi';
import { ProductCard } from '~/components/product/product-card';
import { ProductCarousel } from '~/components/product/product-carousel';
import { CategoryChips } from '~/components/catalog/category-chips';
import { Skeleton } from '~/components/ui/skeleton';

export const isDeal = (p: CatalogProduct) =>
  p.isPromo || (p.compareAtPrice ?? 0) > p.price;

// Un producto pertenece a la categoría tanto si guarda el id como el nombre
// (el contrato trae `category` como texto y `categoryId` opcional).
function inCategory(p: CatalogProduct, c: StoreCategory) {
  return p.categoryId === c.id || p.category === c.id || p.category === c.name;
}

interface ProductGridProps {
  products: CatalogProduct[];
  categories?: StoreCategory[];
  isLoading?: boolean;
}

export function ProductGrid({ products, categories = [], isLoading }: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Solo se ofrecen las categorías que de verdad tienen productos: un chip que
  // filtra a cero es una vía muerta.
  const usableCategories = useMemo(
    () => categories.filter((c) => products.some((p) => inCategory(p, c))),
    [categories, products],
  );

  const deals = useMemo(() => products.filter(isDeal), [products]);

  const visible = useMemo(() => {
    if (!activeCategory) return products;
    const cat = categories.find((c) => c.id === activeCategory);
    return cat ? products.filter((p) => inCategory(p, cat)) : products;
  }, [products, categories, activeCategory]);

  if (isLoading) return <GridSkeleton />;
  if (products.length === 0) {
    return <EmptyState text="Aún no hay productos publicados." />;
  }

  return (
    <div className="space-y-6 pb-2 md:space-y-10 md:pb-12">
      {/* SuperOfertas: única sección que sigue siendo carrusel. Se oculta si hay
          un filtro activo — ahí manda la categoría elegida, no la promoción. */}
      {deals.length > 0 && activeCategory === null && (
        <ProductCarousel
          title="SuperOfertas"
          subtitle="Precios rebajados por tiempo limitado"
          products={deals}
          variant="showcase" />
      )}

      {usableCategories.length > 0 && (
        <CategoryChips
          categories={usableCategories}
          active={activeCategory}
          onChange={setActiveCategory} />
      )}

      {visible.length > 0 ? (
        <ProductResultsGrid products={visible} />
      ) : (
        <EmptyState text="No hay productos en esta categoría." />
      )}
    </div>
  );
}

// Grilla uniforme: todas las tarjetas del mismo tamaño y aspect-ratio, sin tiles
// anchos. El `h-full` en cada celda ancla el CTA al fondo con alturas parejas.
export function ProductResultsGrid({ products }: { products: CatalogProduct[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <motion.div
          key={p.id}
          className="h-full"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          // El stagger se reinicia por fila: si dependiera del índice absoluto,
          // la tarjeta 40 entraría con segundos de retraso.
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: (i % 4) * 0.06 }} >
          <ProductCard product={p} index={i} />
        </motion.div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
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
    <div className="flex flex-col items-center gap-4 rounded-card border bg-card py-20 text-center">
      <span
        className="relative grid h-16 w-16 place-items-center rounded-2xl bg-primary/8 text-primary-2 ring-1 ring-primary/15 ring-inset"
        aria-hidden >
        <HugeiconsIcon icon={PackageSearchIcon} size={28} strokeWidth={2} className="relative" />
      </span>
      <p className="max-w-xs text-sm text-balance text-muted-foreground">{text}</p>
    </div>
  );
}
