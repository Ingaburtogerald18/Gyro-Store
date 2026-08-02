// AnimatedIcon — renderer animado genérico sobre CUALQUIER icono de HugeIcons.
//
// ── Por qué esto y no 107 componentes a mano ──
// Un icono de HugeIcons no es un componente: es data. `Wallet01Icon` es
// literalmente `[["path", { d: "M14 3H5C…", stroke: "currentColor" }], …]`, y en
// toda la librería solo aparecen cuatro tags: path, circle, ellipse y rect. Los
// cuatro aceptan `pathLength` en framer-motion. Así que se puede animar el icono
// REAL en vez de redibujar 107 SVGs a mano — y el peso de trazo queda idéntico
// al resto del sistema por construcción, no por parecido.
//
// La API es la misma que `HugeiconsIcon` (icon/size/strokeWidth/className), así
// que migrar un call-site es cambiar el tag y el import, sin reestructurar nada.
// Eso es lo que hace viable cubrir los 238 sitios, incluidos los 9 donde el
// icono sale de un array de datos (`icon={item.icon}`) y no de un import.
//
// ── Tres decisiones que sostienen el rendimiento ──
// 1. El hover se engancha al CONTROL padre, no al icono (ver `useAncestorHover`).
// 2. Mientras nadie lo toque, el icono se renderiza como SVG plano: los
//    `motion.*` solo se montan tras la primera interacción. Una tabla de 25
//    filas × 4 iconos son 100 SVGs estáticos, cero suscripciones de motion.
// 3. `spin` es el único gesto en bucle, y solo lo usa el spinner.
//
// `prefers-reduced-motion` cortocircuita al render estático (DESIGN.md §8).
import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { IconSvgElement } from '@hugeicons/react';

import type { IconGesture, IconTrigger } from './types';

// Lo que el navegador considera "el control" para efectos de hover. El icono
// pregunta por el ancestro más cercano que matchee: así el trazo se anima al
// pasar por el botón entero y no solo por sus 16 px de glifo.
// `tr` incluido a propósito: las acciones de fila se sienten parte de la fila.
const INTERACTIVE_SELECTOR =
  'button, a, summary, label, tr, [role="menuitem"], [role="menuitemcheckbox"],' +
  ' [role="menuitemradio"], [role="tab"], [role="option"], [role="button"],' +
  ' [role="combobox"], [data-icon-host]';

/** Solo estos cuatro tags existen en @hugeicons/core-free-icons. */
const MOTION_TAG = {
  path: motion.path,
  circle: motion.circle,
  ellipse: motion.ellipse,
  rect: motion.rect,
} as const;

type MotionTagName = keyof typeof MOTION_TAG;

const isMotionTag = (tag: string): tag is MotionTagName => tag in MOTION_TAG;

// ── Gestos sobre el <svg> entero ──
// Van como keyframes que ARRANCAN Y TERMINAN en reposo: al soltar el hover no
// hay que animar la vuelta, el gesto ya cerró donde empezó. Eso evita el
// parpadeo típico de encadenar enter/leave rápido.
const svgVariants: Variants = {
  rest: { scale: 1, rotate: 0, x: 0, y: 0 },
  pop: { scale: [1, 1.18, 1], transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] } },
  'nudge-x': { x: [0, 2.5, 0], transition: { duration: 0.3, ease: 'easeInOut' } },
  'nudge-y': { y: [0, 2.5, 0], transition: { duration: 0.3, ease: 'easeInOut' } },
  shake: { rotate: [0, -12, 9, -6, 0], transition: { duration: 0.55, ease: 'easeInOut' } },
  spin: { rotate: 360, transition: { duration: 0.9, repeat: Infinity, ease: 'linear' } },
};

// ── Gesto sobre cada sub-path ──
// `pathLength: [0, 1]` como keyframes (y no `pathLength: 1` a secas) para que
// se REDIBUJE en cada disparo; con un valor final fijo solo animaría la primera
// vez y los hovers siguientes no harían nada.
const drawVariants: Variants = {
  rest: { pathLength: 1, opacity: 1 },
  draw: (i: number) => ({
    pathLength: [0, 1],
    opacity: 1,
    transition: { duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  }),
};

/**
 * Hover del control interactivo más cercano.
 *
 * Escucha `pointerenter`/`pointerleave` en el ancestro, no en el icono. Si no
 * encuentra ninguno (un icono decorativo suelto en un header), cae al padre
 * inmediato, que suele ser la fila o la tarjeta que lo contiene.
 *
 * Los listeners son DOM puro y se montan aunque el icono todavía sea estático:
 * dos `addEventListener` por icono es un costo despreciable comparado con
 * mantener vivo un árbol de framer-motion.
 */
function useAncestorHover(ref: React.RefObject<SVGSVGElement | null>, enabled: boolean) {
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    const host = node.closest(INTERACTIVE_SELECTOR) ?? node.parentElement ?? node;
    const enter = () => setHovered(true);
    const leave = () => setHovered(false);

    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);
    return () => {
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
    };
  }, [ref, enabled]);

  return hovered;
}

/**
 * Cuenta los clicks sobre el control interactivo más cercano.
 *
 * Devuelve un CONTADOR y no un booleano a propósito: un booleano "está
 * presionado" no permitiría re-disparar el gesto al hacer click dos veces
 * seguidas, porque el valor ya estaría en `true`. El contador siempre cambia.
 *
 * Escucha `pointerdown` y no `click`: el gesto acompaña al acto de presionar,
 * no al de soltar. En un nav donde el click además navega, esos ~100 ms de
 * diferencia se notan.
 */
function useAncestorPress(ref: React.RefObject<SVGSVGElement | null>, enabled: boolean) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    const host = node.closest(INTERACTIVE_SELECTOR) ?? node.parentElement ?? node;
    const down = () => setCount((c) => c + 1);

    host.addEventListener('pointerdown', down);
    return () => host.removeEventListener('pointerdown', down);
  }, [ref, enabled]);

  return count;
}

/** Dispara una sola vez cuando el icono entra al viewport. */
function useInView(ref: React.RefObject<SVGSVGElement | null>, enabled: boolean) {
  const [seen, setSeen] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || seen) return;
    const node = ref.current;
    if (!node) return;
    // Sin IntersectionObserver (jsdom, navegadores viejos) se anima igual: es
    // preferible una animación de más que un icono que nunca aparece.
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ref, enabled, seen]);

  return seen;
}

/**
 * Props de `<svg>` que framer-motion REDEFINE con otra firma.
 *
 * En React, `onAnimationStart` recibe un `AnimationEvent` del DOM; en
 * framer-motion recibe la `AnimationDefinition` de la animación declarativa.
 * `onDrag*` igual: el DOM manda un `DragEvent`, motion manda info del gesto.
 * Como acá los `...rest` terminan spreadeados dentro de un `motion.svg`, si el
 * tipo los arrastra desde `SVGAttributes` los dos contratos colisionan y tsc
 * rechaza el spread entero.
 *
 * Se excluyen del contrato: ningún icono necesita escuchar drags, el evento de
 * animación CSS del navegador, ni el atributo `values` de SMIL.
 */
type MotionConflictingProps =
  // Atributo SVG de SMIL (`<animate values="…">`), un string. Motion usa el
  // mismo nombre para su mapa de MotionValues.
  | 'values'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragExit'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop';

export interface AnimatedIconRendererProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, MotionConflictingProps> {
  /** El icono de HugeIcons, tal cual se importa hoy. */
  icon: IconSvgElement;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Gesto a ejecutar. Por defecto `draw`, la firma visual de itshover. */
  gesture?: IconGesture;
  /** Qué lo despierta. Por defecto el hover del control padre. */
  trigger?: IconTrigger;
  /** Solo para `gesture="rotate-state"`: hacia dónde apunta el chevron. */
  open?: boolean;
  /** Atajo de `trigger="mount"`, por compatibilidad con los iconos bespoke. */
  autoPlay?: boolean;
}

export const AnimatedIcon = React.forwardRef<SVGSVGElement, AnimatedIconRendererProps>(
  function AnimatedIcon(
    {
      icon,
      size = 24,
      strokeWidth,
      className,
      gesture = 'draw',
      trigger = 'hover',
      open,
      autoPlay,
      ...rest
    },
    forwardedRef,
  ) {
    const localRef = React.useRef<SVGSVGElement>(null);
    React.useImperativeHandle(forwardedRef, () => localRef.current as SVGSVGElement);

    const reduce = useReducedMotion();
    const effectiveTrigger: IconTrigger = autoPlay ? 'mount' : trigger;
    const isStateGesture = gesture === 'rotate-state';

    // `reduce` apaga TODO menos el chevron de estado: ese no es decoración,
    // comunica si el panel está abierto, y quitarlo perdería información.
    const disabled = gesture === 'none' || (reduce && !isStateGesture);

    const hovered = useAncestorHover(localRef, !disabled && effectiveTrigger === 'hover');
    const pressCount = useAncestorPress(localRef, !disabled && effectiveTrigger === 'press');
    const inView = useInView(localRef, !disabled && effectiveTrigger === 'view');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      if (!disabled && effectiveTrigger === 'mount') setMounted(true);
    }, [disabled, effectiveTrigger]);

    // El click se convierte en un PULSO: `false` → (siguiente frame) `true` →
    // `false` al terminar. Ese ida y vuelta es lo que hace que framer-motion
    // vuelva a correr el gesto en cada click; si `animate` se quedara fijo en la
    // etiqueta, el segundo click no animaría nada porque el valor no cambió.
    //
    // El `requestAnimationFrame` no es adorno: `setPressed(false)` seguido de
    // `setPressed(true)` en el mismo tick los agrupa React en un solo render y
    // el gesto no se reinicia. Separarlos por un frame garantiza dos renders.
    const [pressed, setPressed] = React.useState(false);
    React.useEffect(() => {
      if (pressCount === 0) return;
      setPressed(false);
      const raf = requestAnimationFrame(() => setPressed(true));
      const timer = setTimeout(() => setPressed(false), 700);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }, [pressCount]);

    const active = hovered || pressed || inView || mounted;

    // ── Upgrade perezoso ──
    // Hasta que algo lo despierte, esto es un <svg> con <path> planos. Es lo que
    // permite tener cientos de iconos en pantalla sin cientos de animaciones
    // vivas. Una vez despierto se queda despierto: volver a desmontar los
    // motion.* en cada `pointerleave` costaría más que dejarlos.
    const [engaged, setEngaged] = React.useState(false);
    React.useEffect(() => {
      if (active && !engaged) setEngaged(true);
    }, [active, engaged]);

    const shouldAnimate = !disabled && (engaged || isStateGesture);

    const svgProps = {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      // El color SIEMPRE se hereda: los attrs de HugeIcons ya traen
      // stroke="currentColor", así que el theming Maia funciona sin tocar nada.
      color: 'currentColor',
      className,
      // Decorativo POR DEFECTO, que es lo que son casi todos: el texto del
      // botón ya dice lo que hace. Pero si el call-site declaró `role` o
      // `aria-label` (el Spinner, por ejemplo, es `role="status"`), forzar
      // aria-hidden lo escondería del lector de pantalla y perdería el
      // anuncio. En ese caso mandan ellos.
      ...(rest['aria-label'] === undefined && rest.role === undefined
        ? { 'aria-hidden': true as const }
        : {}),
      ...rest,
    };

    // Los sub-paths de HugeIcons traen su propio strokeWidth ("1.5"), que gana
    // sobre el del <svg>. Para que la prop `strokeWidth` haga algo hay que
    // pisarlo elemento por elemento.
    const childAttrs = (attrs: { readonly [key: string]: string | number }) =>
      strokeWidth === undefined ? { ...attrs } : { ...attrs, strokeWidth };

    if (!shouldAnimate) {
      return (
        <svg ref={localRef} {...svgProps}>
          {icon.map(([tag, attrs], i) =>
            React.createElement(tag, { ...childAttrs(attrs), key: attrs.key ?? i }),
          )}
        </svg>
      );
    }

    if (isStateGesture) {
      return (
        <motion.svg
          ref={localRef}
          {...svgProps}
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
        >
          {icon.map(([tag, attrs], i) =>
            React.createElement(tag, { ...childAttrs(attrs), key: attrs.key ?? i }),
          )}
        </motion.svg>
      );
    }

    // `draw` anima los hijos y deja el <svg> quieto; el resto de los gestos
    // animan el <svg> y dejan los hijos quietos. Nunca los dos a la vez: son
    // dos transforms compitiendo por el mismo elemento.
    const isDraw = gesture === 'draw';

    return (
      <motion.svg
        ref={localRef}
        {...svgProps}
        variants={svgVariants}
        initial="rest"
        animate={isDraw ? 'rest' : active ? gesture : 'rest'}
      >
        {icon.map(([tag, attrs], i) => {
          const props = { ...childAttrs(attrs) };
          if (!isDraw || !isMotionTag(tag)) {
            return React.createElement(tag, { ...props, key: attrs.key ?? i });
          }
          const Tag = MOTION_TAG[tag];
          return (
            <Tag
              key={attrs.key ?? i}
              {...props}
              custom={i}
              variants={drawVariants}
              initial="rest"
              animate={active ? 'draw' : 'rest'}
            />
          );
        })}
      </motion.svg>
    );
  },
);

AnimatedIcon.displayName = 'AnimatedIcon';
