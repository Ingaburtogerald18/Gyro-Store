// AnimatedCheck — checkmark con circle-draw + check-draw.
//
// Replica el patrón itshover: SVG inline con framer-motion, control por ref.
// Diseñado para feedback de confirmación (venta aprobada, operación exitosa).
//
// Animación: el círculo se dibuja primero (pathLength 0→1), luego el check
// aparece con un trazo progresivo. Ejecución única (no loop).
import React, { useEffect, useImperativeHandle } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

import type { AnimatedIconHandle, AnimatedIconProps } from './types';

const AnimatedCheck = React.forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function AnimatedCheck({ size = 24, strokeWidth = 2, className, autoPlay }, ref) {
    const circleControls = useAnimation();
    const checkControls = useAnimation();
    const reduce = useReducedMotion();

    async function playSequence() {
      if (reduce) {
        // Sin animación: mostrar todo de golpe.
        circleControls.set({ pathLength: 1, opacity: 1 });
        checkControls.set({ pathLength: 1, opacity: 1 });
        return;
      }
      // Reset
      circleControls.set({ pathLength: 0, opacity: 1 });
      checkControls.set({ pathLength: 0, opacity: 0 });
      // 1. Dibujar el círculo
      await circleControls.start({
        pathLength: 1,
        transition: { duration: 0.4, ease: 'easeOut' },
      });
      // 2. Dibujar el check
      checkControls.set({ opacity: 1 });
      await checkControls.start({
        pathLength: 1,
        transition: { duration: 0.3, ease: 'easeOut' },
      });
    }

    useEffect(() => {
      if (autoPlay) {
        playSequence();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoPlay]);

    useImperativeHandle(ref, () => ({
      start() {
        playSequence();
      },
      stop() {
        circleControls.set({ pathLength: 1, opacity: 1 });
        checkControls.set({ pathLength: 1, opacity: 1 });
      },
    }));

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {/* Círculo exterior */}
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={circleControls}
        />
        {/* Checkmark */}
        <motion.path
          d="M8 12.5L10.5 15L16 9"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={checkControls}
        />
      </svg>
    );
  },
);

AnimatedCheck.displayName = 'AnimatedCheck';

export { AnimatedCheck };
