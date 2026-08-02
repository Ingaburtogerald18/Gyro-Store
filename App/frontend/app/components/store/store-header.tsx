// Header del catálogo público (Amazon-style): logo · búsqueda (próximamente) ·
// carrito con contador animado · acceso (HeaderSettingsMenu).
import { useEffect, useRef } from 'react';

import { Link } from '@remix-run/react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { AnimatedCart, type AnimatedIconHandle } from '~/components/ui/animated-icons';
import { useAppDispatch, useAppSelector } from '~/store/hooks';
import { selectCartCount, toggleCart } from '~/store/slices/cartSlice';
import { HeaderSettingsMenu } from './header-settings-menu';

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
  return (
    <header className="sticky top-0 z-40 border-b border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* El logo ahora tiene transición y efecto hover */}
        <Link 
          to="/" 
          className="group rounded-xl px-2 py-1 text-left transition-all duration-300 hover:bg-primary active:scale-95"
          aria-label="Ir al inicio de Gyro Store"
        >
          <div className="text-xl font-bold tracking-tight text-foreground transition-all group-hover:brightness-125">
            Gyro<span className="text-primary">Store</span>
          </div>
        </Link>

        {/* Zona derecha: Carrito Animado y Menú de Ajustes/Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          <CartButton />
          <HeaderSettingsMenu />
        </div>
      </div>
    </header>
  );
}
