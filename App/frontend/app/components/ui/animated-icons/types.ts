// Tipos compartidos por los iconos animados itshover-style.
//
// Cada icono expone un ref imperativo `AnimatedIconHandle` con `start()` y
// `stop()`, envuelto en `React.forwardRef` (obligatorio en React 18, ver
// DESIGN.md §1). Los consumidores controlan cuándo corre la animación; el
// icono por defecto está quieto.

export interface AnimatedIconHandle {
  /** Dispara la animación (una iteración o loop según el icono). */
  start: () => void;
  /** Detiene la animación y vuelve al estado de reposo. */
  stop: () => void;
}

export interface AnimatedIconProps {
  /** Tamaño en px (ancho = alto). Equivalente a `size` de HugeIcons. */
  size?: number;
  /** Grosor de trazo del SVG. */
  strokeWidth?: number;
  /** Clases CSS adicionales (color vía `text-*`, etc.). */
  className?: string;
  /** Si true, dispara `start()` al montar. Útil para toasts efímeros. */
  autoPlay?: boolean;
}
