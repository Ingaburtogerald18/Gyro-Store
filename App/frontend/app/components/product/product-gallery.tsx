// Galería de la ficha: foto grande + miniaturas. Con una sola imagen, las
// miniaturas no se pintan (no hay nada que elegir).
//
// Zoom (patrón del V1): click/Enter en la foto grande abre un lightbox con la
// imagen a tamaño completo, sobre la primitiva Dialog (Escape y click afuera
// cierran gratis, con foco gestionado por Radix).
import { AnimatedIcon } from "~/components/ui/animated-icons";
import { ImageNotFound01Icon, ZoomInAreaIcon } from "@hugeicons/core-free-icons";
import { useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { cn } from '~/lib/utils';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = images[active];

  return (
    <div className="space-y-3">
      {current ? (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={`Ampliar imagen de ${name}`}
          className="product-stage group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <img
            src={current}
            alt={name}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
            style={{ viewTransitionName: 'vt-product-detail' } as React.CSSProperties}
          />
          {/* Pista de zoom: aparece al hover, no compite con la foto. */}
          <span
            aria-hidden
            className="absolute right-3 bottom-3 grid h-9 w-9 place-items-center rounded-full bg-background/70 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <AnimatedIcon icon={ZoomInAreaIcon} size={18} strokeWidth={2} />
          </span>
        </button>
      ) : (
        <div className="product-stage relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-muted text-muted-foreground">
          <AnimatedIcon icon={ImageNotFound01Icon} size={40} strokeWidth={2} aria-hidden />
        </div>
      )}

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1} de ${name}`}
              aria-current={i === active}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                i === active ? 'border-primary' : 'border hover:border-foreground/25',
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-[min(92vw,64rem)] border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-[min(92vw,64rem)]"
        >
          <DialogTitle className="sr-only">{name}</DialogTitle>
          {current && (
            <img
              src={current}
              alt={name}
              className="max-h-[85dvh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
