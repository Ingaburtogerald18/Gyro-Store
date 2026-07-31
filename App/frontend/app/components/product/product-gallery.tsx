// Galería de la ficha: foto grande + miniaturas. Con una sola imagen, las
// miniaturas no se pintan (no hay nada que elegir).
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageNotFound01Icon } from "@hugeicons/core-free-icons";
import { useState } from 'react';

import { cn } from '~/lib/utils';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="space-y-3">
      <div className="product-stage relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        {current ? (
          <img
            src={current}
            alt={name}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
            style={{ viewTransitionName: 'vt-product-detail' } as React.CSSProperties}
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <HugeiconsIcon icon={ImageNotFound01Icon} size={40} strokeWidth={2} aria-hidden />
          </div>
        )}
      </div>

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
                i === active ? 'border-primary' : 'border hover:border-white/25',
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
