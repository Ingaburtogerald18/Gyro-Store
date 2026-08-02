// AnimatedCart — carrito con jiggle al agregar un producto.
//
// Replica el patrón itshover: SVG inline con framer-motion, control por ref.
// La geometría está basada en ShoppingCart02Icon de HugeIcons.
//
// Animación: translateX oscilante rápido (jiggle horizontal), como si el
// carrito recibiera un impulso al caer un item dentro.
import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

import type { AnimatedIconHandle, AnimatedIconProps } from './types';

const AnimatedCart = React.forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function AnimatedCart({ size = 24, strokeWidth = 2, className, autoPlay }, ref) {
    const controls = useAnimation();
    const reduce = useReducedMotion();
    const mounted = useRef(true);

    useEffect(() => {
      mounted.current = true;
      return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
      if (autoPlay && !reduce) {
        controls.start('bump');
      }
    }, [autoPlay, reduce, controls]);

    useImperativeHandle(ref, () => ({
      start() {
        if (!reduce) controls.start('bump');
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
        variants={{
          idle: { x: 0 },
          bump: {
            x: [0, -3, 3, -2, 2, -1, 0],
            transition: {
              duration: 0.5,
              ease: 'easeInOut',
            },
          },
        }}
        initial="idle"
        animate={controls}
      >
        {/* Cuerpo del carrito */}
        <path d="M8 16H15.2632C19.7508 16 20.4333 13.1808 21.261 9.06908C21.4998 7.88311 21.6192 7.29013 21.3321 6.89507C21.045 6.5 20.4947 6.5 19.3941 6.5H6" />
        {/* Mango + cuerpo trasero */}
        <path d="M6 6.5L5.36099 2.51493C5.15783 1.63398 4.37665 1 3.47852 1H2" />
        {/* Línea inferior */}
        <path d="M9.5 18.5C9.5 19.8807 8.38071 21 7 21C5.61929 21 4.5 19.8807 4.5 18.5" />
        <path d="M18.5 18.5C18.5 19.8807 17.3807 21 16 21C14.6193 21 13.5 19.8807 13.5 18.5" />
      </motion.svg>
    );
  },
);

AnimatedCart.displayName = 'AnimatedCart';

export { AnimatedCart };
