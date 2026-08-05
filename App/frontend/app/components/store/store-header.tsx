// Header del catálogo público (Amazon-style): logo · búsqueda (filtra la grilla
// de la home) · carrito con contador animado · acceso (HeaderSettingsMenu).
import { useEffect, useMemo, useRef, useState } from 'react';

import { Link, useLocation } from '@remix-run/react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { Menu01Icon } from '@hugeicons/core-free-icons';
import { SearchBar } from '~/components/catalog/search-bar';
import { CategoriesDrawer } from '~/components/store/categories-drawer';
import { CategoryNav, inCategory } from '~/components/store/category-nav';
import { Button } from '~/components/ui/button';
import { AnimatedCart, AnimatedIcon, type AnimatedIconHandle } from '~/components/ui/animated-icons';
import { useGetCatalogQuery } from '~/store/api/storefrontApi';
import { useGetConfigQuery } from '~/store/api/sessionApi';
import { useAppDispatch, useAppSelector } from '~/store/hooks';
import { selectCartCount, toggleCart } from '~/store/slices/cartSlice';
import { HeaderSettingsMenu } from './header-settings-menu';
import { getBrandName } from '~/lib/brand';

/** Botón del carrito con contador y "pop" al agregar. Comparte fuente de verdad
 *  con el resto de la app (cartSlice); reemplaza al botón estático. */
function CartButton() {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectCartCount);
  const controls = useAnimationControls();
  const cartIconRef = useRef<AnimatedIconHandle>(null);
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current) {
      controls.start({ scale: [1, 1.25, 0.95, 1], transition: { duration: 0.4, ease: "easeOut" } });
      cartIconRef.current?.start();
    }
    prev.current = count;
  }, [count, controls]);

  return (
    <motion.button
      animate={controls}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => dispatch(toggleCart())}
      aria-label={count > 0 ? `Abrir carrito, ${count} artículo${count === 1 ? "" : "s"}` : "Abrir carrito"}
      className="relative grid h-10 w-10 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <AnimatedCart ref={cartIconRef} size={20} strokeWidth={2} />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 20 }}
            // ring-background lo separa del header con un halo del color de fondo → "flota".
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold tabular-nums text-background ring-2 ring-background shadow-lg"
          >
            {count > 99 ? '99+' : count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function StoreHeader() {
  // La búsqueda filtra la grilla de la home; en la ficha, el combo o contacto no
  // hay nada que filtrar, así que ahí no se pinta (y no ocupa el ancho).
  const { pathname } = useLocation();
  const showSearch = pathname === '/';
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // El catálogo alimenta la muestra del mega-menú. RTK Query lo cachea, así que
  // en la home (que ya lo trae por SSR) esto no dispara una segunda descarga
  // visible para el usuario.
  const { data: config } = useGetConfigQuery();
  const { data: products = [] } = useGetCatalogQuery();

  // Solo categorías con productos: una pestaña que lleva a una grilla vacía es
  // una vía muerta.
  const categories = useMemo(
    () => (config?.categories ?? []).filter((c) => products.some((p) => inCategory(p, c))),
    [config?.categories, products],
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        {/* El logo ahora tiene transición y efecto hover */}
        <Link
          to="/"
          className="group shrink-0 rounded-xl px-2 py-1 text-left transition-all duration-300 hover:bg-primary active:scale-95"
          aria-label={`Ir al inicio de ${getBrandName()}`}
        >
          <div className="text-xl font-bold tracking-tight text-foreground transition-all group-hover:brightness-125">
            Gyro<span className="text-primary">Store</span>
          </div>
        </Link>

        {/* Búsqueda centrada en escritorio; en móvil baja a su propia fila. */}
        {showSearch && (
          <div className="hidden flex-1 justify-center md:flex">
            <SearchBar className="max-w-xl" />
          </div>
        )}

        {/* Zona derecha: Carrito Animado y Menú de Ajustes/Perfil */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {/* En escritorio las categorías viven en su propia fila; en móvil esa
              fila no cabe, así que se abren desde acá. */}
          {categories.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCategoriesOpen(true)}
              aria-label="Ver categorías"
              className="h-10 w-10 md:hidden"
            >
              <AnimatedIcon icon={Menu01Icon} size={20} strokeWidth={2} aria-hidden />
            </Button>
          )}
          <CartButton />
          <HeaderSettingsMenu />
        </div>
      </div>

      {/* Fila propia en móvil: a 360px la búsqueda no cabe junto al logo sin
          dejar un campo inservible de 80px. */}
      {showSearch && (
        <div className="px-4 pb-3 md:hidden">
          <SearchBar />
        </div>
      )}

      <CategoryNav categories={categories} products={products} />

      <CategoriesDrawer
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        products={products}
      />
    </header>
  );
}
