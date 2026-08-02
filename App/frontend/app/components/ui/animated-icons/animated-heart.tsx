// AnimatedHeart — corazón con scale-pop al activar.
//
// Replica el patrón itshover: SVG inline con framer-motion, control por ref.
// Pensado para un futuro sistema de favoritos en el catálogo.
//
// Animación: scale pop (1 → 1.3 → 0.9 → 1.05 → 1) con un leve rebote
// elástico. Opcionalmente acepta `filled` para corazón relleno.
import React, { useEffect, useImperativeHandle } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

import type { AnimatedIconHandle, AnimatedIconProps } from './types';

interface AnimatedHeartProps extends AnimatedIconProps {
  /** Si true, el corazón se muestra relleno (favorito activo). */
  filled?: boolean;
}

const AnimatedHeart = React.forwardRef<AnimatedIconHandle, AnimatedHeartProps>(
  function AnimatedHeart({ size = 24, strokeWidth = 2, className, autoPlay, filled }, ref) {
    const controls = useAnimation();
    const reduce = useReducedMotion();

    useEffect(() => {
      if (autoPlay && !reduce) {
        controls.start('pop');
      }
    }, [autoPlay, reduce, controls]);

    useImperativeHandle(ref, () => ({
      start() {
        if (!reduce) controls.start('pop');
      },
      stop() {
        controls.start('idle');
      },
    }));

    return (
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
        variants={{
          idle: { scale: 1 },
          pop: {
            scale: [1, 1.3, 0.9, 1.05, 1],
            transition: {
              duration: 0.5,
              ease: 'easeInOut',
            },
          },
        }}
        initial="idle"
        animate={controls}
      >
        <path d="M12 21C10.586 20.258 2 15.54 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 15.54 13.414 20.258 12 21Z" />
      </motion.svg>
    );
  },
);

AnimatedHeart.displayName = 'AnimatedHeart';

export { AnimatedHeart };
