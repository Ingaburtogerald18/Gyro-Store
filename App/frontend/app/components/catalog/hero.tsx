// Hero slider de la home. Portado de la versión que corre hoy en la tienda:
// contenedor split (media a la izquierda, texto a la derecha), transición
// horizontal entre slides, autoplay de 8s con pausa, flechas y puntos con
// barra de progreso.
//
// Los slides vienen de /api/landing-config (editables desde el panel). El SSR
// siembra el primer render con `initialLanding` para que no parpadee; RTK Query
// se vuelve la fuente de verdad en cliente.
//
// PENDIENTE del Hito 2: los controles de edición en vivo (mover, editar y
// borrar slides) llegan con el modo edición del admin.
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { ArrowLeft01Icon, ArrowRight01Icon, ArrowRight02Icon, Message01Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import type { LandingConfig } from '@shared/schemas';
import { SlideMedia } from '~/components/catalog/slide-media';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { useGetConfigQuery } from '~/store/api/sessionApi';
import { useGetLandingConfigQuery } from '~/store/api/storefrontApi';
import { cn } from "~/lib/utils"
import { buildWhatsappUrl } from "~/lib/formatters";

const SLIDE_MS = 8000;
const EMPTY_LANDING: LandingConfig = { headerCategories: [], heroSlides: [] };

export function Hero({ initialLanding }: { initialLanding?: LandingConfig | null }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  // Con prefers-reduced-motion no arranca solo: el movimiento automático es
  // justo lo que esa preferencia pide evitar.
  const [playing, setPlaying] = useState(!reduce);

  const { data: landingData } = useGetLandingConfigQuery();
  const landing = landingData ?? initialLanding ?? EMPTY_LANDING;
  const slides = landing.heroSlides;

  const { data: config } = useGetConfigQuery();
  const whatsappOrderUrl = buildWhatsappUrl(
    config?.whatsapp ?? '',
    'Hola Gyro Store, quiero hacer un pedido',
  );

  // El índice nunca debe salirse del rango: los slides pueden crecer o menguar.
  const safeIndex = slides.length ? Math.min(activeIndex, slides.length - 1) : 0;
  const activeSlide = slides[safeIndex];
  const autoPlaying = playing && slides.length > 1;

  const goTo = useCallback(
    (dir: 1 | -1) => {
      setActiveIndex((prev) =>
        slides.length ? (prev + dir + slides.length) % slides.length : 0,
      );
    },
    [slides.length],
  );

  useEffect(() => {
    if (!autoPlaying) return;
    const timer = setTimeout(() => goTo(1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [autoPlaying, safeIndex, goTo]);

  // Sin slides configurados: no romper la home, simplemente no pintar el hero.
  if (!activeSlide) return null;

  function handlePrimaryAction() {
    const target = activeSlide.actionTarget || '/#catalogo';
    if (target.startsWith('http')) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(target);
    // Si es un ancla de la misma página, el scroll suave hay que hacerlo a mano.
    if (target.includes('#')) {
      const id = target.split('#')[1];
      setTimeout(
        () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        50,
      );
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 pt-3 pb-6 sm:pt-6 sm:pb-12">
      <div className="group relative w-full overflow-hidden rounded-[2.5rem] border border/40 bg-card shadow-2xl">
        <div className="flex min-h-[380px] flex-col items-stretch md:h-[620px] md:flex-row">
          {/* ── Media ── */}
          <div className="relative flex h-[190px] w-full items-center justify-center overflow-hidden border-b border/30 bg-card sm:h-[260px] md:h-auto md:w-1/2 md:border-r md:border-b-0">
            {/* Glow radial muy tenue: da profundidad al vacío sin leerse como halo. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,color-mix(in_srgb,var(--color-accent)_16%,transparent),transparent_60%)] blur-3xl"
            />
            <SlideMedia
              key={activeSlide.id}
              slide={activeSlide}
              className={cn(
                'absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-out',
                safeIndex === 0 ? 'p-2 sm:p-6' : 'p-6 max-md:scale-125 max-md:p-0',
              )}
            />
            <div className="pointer-events-none absolute inset-0 bg-black/10" />
          </div>

          {/* ── Texto ── */}
          <div className="relative z-10 flex w-full flex-col justify-center p-5 text-left sm:p-10 md:w-1/2 md:p-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide.id}
                initial={reduce ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-2.5 sm:space-y-6"
              >
                <span className="inline-block text-[10px] font-black tracking-[0.2em] text-primary-2 uppercase sm:text-xs">
                  {activeSlide.eyebrow}
                </span>

                <h1 className="text-[20px] leading-[0.95] font-black tracking-tight text-balance text-foreground sm:text-4xl md:text-6xl">
                  {activeSlide.title}
                </h1>

                {/* Recortada en móvil: el CTA no puede depender de qué tan larga
                    sea la descripción de cada slide. */}
                <p className="line-clamp-2 max-w-lg text-[12px] leading-relaxed font-medium text-muted-foreground sm:line-clamp-none sm:text-base">
                  {activeSlide.description}
                </p>

                {/* Ambos CTAs comparten patrón (contorno, mismo tamaño, una sola
                    línea) y se diferencian solo por color: acento para la acción
                    principal, verde para WhatsApp. */}
                <div className="pt-2.5 sm:pt-4">
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3">
                    <Button
                      variant="default"
                      onClick={handlePrimaryAction}
                      className="group/cta w-full justify-center rounded-xl py-2 text-[12px] sm:w-auto sm:px-6 sm:py-2.5 sm:text-sm"
                    >
                      <span className="truncate">{activeSlide.buttonText || 'Ver catálogo'}</span>
                      <AnimatedIcon icon={ArrowRight02Icon} size={14} strokeWidth={2} aria-hidden className="shrink-0 transition-transform duration-300 group-hover/cta:translate-x-1" />
                    </Button>

                    <Button
                      variant="whatsappOutline"
                      onClick={() => window.open(whatsappOrderUrl, '_blank', 'noopener,noreferrer')}
                      className="group/wa w-full justify-center rounded-xl py-2 text-[12px] sm:w-auto sm:px-6 sm:py-2.5 sm:text-sm"
                    >
                      <AnimatedIcon icon={Message01Icon} size={14} strokeWidth={2} aria-hidden className="shrink-0 transition-transform duration-300 group-hover/wa:scale-110" />
                      <span className="truncate">WhatsApp</span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Barra flotante de navegación y progreso ── */}
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center sm:mt-6">
          <div className="flex items-center gap-3 rounded-full border border/40 bg-card px-4 py-2.5">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setPlaying((p) => !p)}
              title={playing ? 'Pausar presentación' : 'Reanudar presentación'}
              aria-label={playing ? 'Pausar presentación' : 'Reanudar presentación'}
              className="h-11 w-11 rounded-full bg-white/5 md:h-7 md:w-7"
            >
              {playing ? (
                <AnimatedIcon icon={PauseIcon} size={14} strokeWidth={2} aria-hidden className="fill-current" />
              ) : (
                <AnimatedIcon icon={PlayIcon} size={14} strokeWidth={2} aria-hidden className="ml-0.5 fill-current" />
              )}
            </Button>

            <Separator orientation="vertical" className="h-4 bg-white/10" />

            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  goTo(-1);
                  setPlaying(false);
                }}
                title="Anterior"
                aria-label="Diapositiva anterior"
                className="h-11 w-11 rounded-full md:h-7 md:w-7"
              >
                <AnimatedIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} aria-hidden />
              </Button>

              <div className="mx-1 flex items-center gap-1">
                {slides.map((slide, idx) => {
                  const isActive = idx === safeIndex;
                  return (
                    // El botón aporta los 44px de zona táctil (WCAG 2.5.5); el
                    // pastel visible adentro sigue midiendo 10px de alto.
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => {
                        setActiveIndex(idx);
                        setPlaying(true);
                      }}
                      className="group/dot flex h-11 items-center rounded-full px-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      aria-label={`Ir a la diapositiva ${idx + 1}`}
                      aria-current={isActive}
                    >
                      <span
                        className={cn(
                          'relative h-2.5 overflow-hidden rounded-full bg-white/15 transition-all duration-300',
                          isActive ? 'w-11' : 'w-2.5 group-hover/dot:bg-white/35',
                        )}
                      >
                        {isActive && autoPlaying && (
                          <motion.span
                            key={safeIndex}
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }}
                            className="absolute inset-y-0 left-0 rounded-full bg-primary-2"
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  goTo(1);
                  setPlaying(false);
                }}
                title="Siguiente"
                aria-label="Siguiente diapositiva"
                className="h-11 w-11 rounded-full md:h-7 md:w-7"
              >
                <AnimatedIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
