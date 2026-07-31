import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Store } from 'lucide-react';
import { useAppSelector } from '~/store/hooks';

/**
 * ¿Hay alguna query de RTK en vuelo? Se lee del estado del baseApi
 * (reducerPath 'api'). Es lo que permite que el overlay de transición se quede
 * hasta que el backend responda, en vez de adivinar con un timer fijo.
 */
export function useAnyQueryPending(): boolean {
  return useAppSelector((s) => {
    const queries = s.api?.queries ?? {};
    return Object.values(queries).some((q) => q?.status === 'pending');
  });
}

/**
 * Overlay de carga entre módulos del admin. Cubre el contenido con un blur y
 * un loader de marca (el mark de Gyro dentro de un anillo cyan girando) mientras
 * el módulo nuevo trae su información. Lo controla `admin.tsx`.
 */
export function ModuleLoader({ show }: { show: boolean }) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          // aria-live para que un lector de pantalla anuncie la carga.
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute inset-0 z-40 grid place-items-center bg-background/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: reduce ? 1 : 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: reduce ? 1 : 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative grid size-16 place-items-center">
              {/* Anillo: pista tenue + arco cyan que gira. */}
              <motion.svg
                viewBox="0 0 50 50"
                className="absolute inset-0 size-16"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              >
                <circle
                  cx="25"
                  cy="25"
                  r="21"
                  fill="none"
                  strokeWidth="4"
                  className="stroke-muted-foreground/20"
                />
                <circle
                  cx="25"
                  cy="25"
                  r="21"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="80 200"
                  className="stroke-primary"
                />
              </motion.svg>
              {/* Mark de marca, con un latido sutil. */}
              <motion.span
                animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                className="text-primary"
              >
                <Store className="size-6" aria-hidden />
              </motion.span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Cargando…</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
