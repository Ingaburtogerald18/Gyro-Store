// AnimatedBell — campana con oscilación (swing) al activar.
//
// Replica el patrón itshover: SVG inline con framer-motion, control por ref.
// La geometría está basada en Notification03Icon de HugeIcons para que el
// peso visual sea consistente con el resto de la iconografía.
//
// Animación: rotación oscilante alrededor del punto de enganche superior
// (transformOrigin top center), simulando el badajo de una campana.
import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

import type { AnimatedIconHandle, AnimatedIconProps } from './types';

const AnimatedBell = React.forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function AnimatedBell({ size = 24, strokeWidth = 2, className, autoPlay }, ref) {
    const controls = useAnimation();
    const reduce = useReducedMotion();
    const mounted = useRef(true);

    useEffect(() => {
      mounted.current = true;
      return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
      if (autoPlay && !reduce) {
        controls.start('ring');
      }
    }, [autoPlay, reduce, controls]);

    useImperativeHandle(ref, () => ({
      start() {
        if (!reduce) controls.start('ring');
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
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
        // La campana oscila desde el punto de enganche (top center).
        style={{ transformOrigin: 'top center' }}
        variants={{
          idle: { rotate: 0 },
          ring: {
            rotate: [0, 14, -12, 8, -6, 3, 0],
            transition: {
              duration: 0.7,
              ease: 'easeInOut',
            },
          },
        }}
        initial="idle"
        animate={controls}
      >
        {/* Campana: body */}
        <path d="M2.52992 14.394C2.31727 16.045 3.268 17.183 4.59954 17.515C8.08038 18.381 15.9206 18.381 19.4014 17.515C20.733 17.183 21.6837 16.045 21.4711 14.394C21.3352 13.332 20.5426 12.434 20.0126 11.517C19.3355 10.321 19.29 9.022 19.29 7.674C19.29 4.368 16.638 2 12.001 2C7.364 2 4.712 4.368 4.712 7.674C4.712 9.022 4.66651 10.321 3.98943 11.517C3.45936 12.434 2.66685 13.332 2.53092 14.394" />
        {/* Badajo */}
        <path d="M9 21C9.6254 21.6508 10.7322 22 12.0001 22C13.268 22 14.3746 21.6508 15 21" />
      </motion.svg>
    );
  },
);

AnimatedBell.displayName = 'AnimatedBell';

export { AnimatedBell };
