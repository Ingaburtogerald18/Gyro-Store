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

// ── Vocabulario del renderer genérico (`AnimatedIcon`) ──

/**
 * Gestos disponibles. `draw` es el de la casa (el trazo se redibuja, que es la
 * firma visual de itshover); el resto existen porque hay iconos donde redibujar
 * no comunica nada: una flecha tiene que MOVERSE, un spinner tiene que GIRAR.
 */
export type IconGesture =
  /** Redibuja el trazo (pathLength 0→1), escalonando los sub-paths. */
  | 'draw'
  /** Rebote de escala. Barato: es una sola transform sobre el <svg>. */
  | 'pop'
  /** Empujón horizontal. Flechas de "siguiente/anterior", enlaces. */
  | 'nudge-x'
  /** Empujón vertical. Descargas, subidas, ordenamiento de columnas. */
  | 'nudge-y'
  /** Giro continuo. ÚNICO gesto en bucle: reservado a estados de carga. */
  | 'spin'
  /** Sacudida. Campanas, alertas, errores. */
  | 'shake'
  /** Rota 180° según `open`. Chevrons: comunica estado, no interacción. */
  | 'rotate-state'
  /** Sin animación. Para tablas densas, donde el presupuesto de render manda. */
  | 'none';

/**
 * Qué despierta la animación.
 *
 * `hover` NO escucha el hover del icono: engancha al control interactivo más
 * cercano (`button`, `[role="menuitem"]`, la `<tr>` de la fila…). Un icono de
 * 16 px es un blanco de hover pésimo, y lo que el usuario percibe como "el
 * botón" es el botón entero.
 */
export type IconTrigger =
  | 'hover'
  /**
   * Corre en cada click sobre el control padre. Opt-in: lo usa el nav del
   * sidebar, donde el hover ya está tomado (el sidebar se despliega al pasar el
   * mouse) y el gesto tiene que responder al acto de ELEGIR un módulo.
   */
  | 'press'
  /** Corre una vez al montar. Confirmaciones, spinners. */
  | 'mount'
  /** Corre una vez al entrar al viewport. Headers de card, KPIs. */
  | 'view'
  /** Nunca se dispara solo; se controla por ref o por `open`. */
  | 'none';
