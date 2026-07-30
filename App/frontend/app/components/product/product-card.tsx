// ProductCard — estilo showcase: sin marco ni fondo, la foto es la protagonista
// en un stage redondeado que se levanta al hover, y debajo van nombre, precio y
// descripción. Portado de la versión que corre hoy en gyrostorenic.com.
//
// PENDIENTE del Hito 1: con >1 combinación de variantes, la tienda actual abre
// un QuickAddSheet para elegir. Ese componente y la ficha de producto son piezas
// posteriores; hasta entonces se agrega la variante por defecto (el backend de
// v2 recalcula por catalogItemId y todavía no maneja variantes en el pedido).
import { Link } from '@remix-run/react';
import { motion, useReducedMotion } from 'framer-motion';
import { ImageOff, MessageCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { CatalogProduct } from '@shared/schemas';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { useGetConfigQuery } from '~/store/api/configApi';
import { useAppDispatch } from '~/store/hooks';
import { addItem, openCart } from '~/store/slices/cartSlice';
import { buildWhatsappUrl, cn, formatCordobas, getProductUrl } from '~/lib/utils';

export function ProductCard({
  product,
  layout = 'grid',
  index = 0,
}: {
  product: CatalogProduct;
  layout?: 'grid' | 'list';
  /** Posición en la grilla: escalona la entrada de las tarjetas visibles. */
  index?: number;
}) {
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();
  const reduce = useReducedMotion();

  const image = product.images[0];
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 5;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;
  const discountPct = onSale ? Math.round((1 - product.price / compareAt) * 100) : 0;
  const isList = layout === 'list';
  const currency = config?.currency;
  const productUrl = getProductUrl(product.id, product.name);
  const description = product.description
    ? product.description.replace(/<[^>]*>?/gm, '').trim()
    : '';

  function handleCta(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    dispatch(
      addItem({
        catalogId: product.id,
        name: product.name,
        variantName: 'Estándar',
        price: product.price,
        image: image || '',
        quantity: 1,
      }),
    );
    dispatch(openCart());
    toast.success('Agregado al carrito');
  }

  // "Pedir por WhatsApp": camino de compra directo, sin pasar por el carrito. Si
  // está agotado, el mensaje pide aviso de reposición: el lead no se pierde.
  function handleWhatsAppOrder(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = typeof window !== 'undefined' ? window.location.origin + productUrl : '';
    const message = soldOut
      ? `Hola, quiero que me avisen cuando vuelva a haber stock de: ${product.name}. ${url}`
      : `Hola, quiero: ${product.name} — ${formatCordobas(product.price, currency)}. ${url}`;
    window.open(
      buildWhatsappUrl(config?.whatsapp ?? '', message),
      '_blank',
      'noopener,noreferrer',
    );
  }

  // El hover levanta la FOTO, no la tarjeta entera.
  const Stage = (
    <Link
      to={productUrl}
      prefetch="intent"
      viewTransition
      aria-label={product.name}
      className={cn(
        'product-stage ease-expo relative block overflow-hidden rounded-2xl transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.5)] focus-visible:outline-none',
        isList ? 'aspect-square h-full w-full shrink-0' : 'aspect-square w-full sm:aspect-[4/3]',
      )}
    >
      <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
        {onSale && (
          <Badge variant="promo" className="text-[10px] tabular-nums sm:px-2.5 sm:text-[11px]">
            −{discountPct}%
          </Badge>
        )}
        {product.isPromo && !onSale && (
          <Badge variant="promo" className="text-[10px] sm:px-2.5 sm:text-[11px]">
            Oferta
          </Badge>
        )}
      </div>

      {lowStock && (
        <Badge
          variant="warning"
          className="absolute top-2 right-2 z-10 text-[10px] sm:px-2.5 sm:text-[11px]"
        >
          ¡Últimas {product.stock}!
        </Badge>
      )}

      {image ? (
        <img
          src={image}
          alt={product.name}
          loading={index < 4 ? 'eager' : 'lazy'}
          decoding="async"
          className={cn(
            'ease-expo h-full w-full object-cover transition duration-[600ms] will-change-transform',
            'group-hover:scale-[1.06]',
            soldOut && 'opacity-70 grayscale',
          )}
          style={{ viewTransitionName: `vt-product-${product.id}` } as React.CSSProperties}
        />
      ) : (
        <div className="grid h-full place-items-center text-muted">
          <ImageOff aria-hidden className="h-8 w-8" />
        </div>
      )}

      {soldOut && (
        <Badge
          variant="overlay"
          className="absolute bottom-2 left-1/2 -translate-x-1/2 py-1 text-[10px] sm:bottom-3 sm:px-3 sm:text-[11px]"
        >
          Agotado
        </Badge>
      )}
    </Link>
  );

  const Info = (
    <Link
      to={productUrl}
      prefetch="intent"
      viewTransition
      className={cn(
        'flex min-w-0 flex-col gap-1 focus-visible:outline-none',
        isList ? 'flex-1 justify-center gap-1.5 py-1' : 'flex-1 pt-3 sm:pt-4',
      )}
    >
      <h3 className="line-clamp-2 text-[13px] leading-snug font-bold tracking-tight text-text transition-colors group-hover:text-accent-2 sm:text-lg">
        {product.name}
      </h3>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[13px] font-extrabold text-accent-2 tabular-nums sm:text-lg">
          {formatCordobas(product.price, currency)}
        </span>
        {onSale && (
          <span className="text-xs text-muted line-through tabular-nums sm:text-sm">
            {formatCordobas(compareAt, currency)}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed font-light text-muted sm:text-sm">
          {description}
        </p>
      )}
    </Link>
  );

  const Cta = (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleCta}
        disabled={soldOut}
        className="h-9 flex-1 text-xs sm:h-11 sm:text-sm"
      >
        <ShoppingCart aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        {soldOut ? 'Agotado' : 'Agregar'}
      </Button>
      {/* Nunca se deshabilita, ni agotado: "avísame" sigue siendo un lead. */}
      <Button
        variant="whatsapp"
        size="icon"
        onClick={handleWhatsAppOrder}
        aria-label={
          soldOut
            ? `Avísame cuando ${product.name} esté disponible, por WhatsApp`
            : `Pedir ${product.name} por WhatsApp`
        }
        title={soldOut ? 'Avísame por WhatsApp' : 'Pedir por WhatsApp'}
        className="h-9 w-9 rounded-lg sm:h-11 sm:w-11"
      >
        <MessageCircle aria-hidden className="h-[15px] w-[15px] sm:h-[18px] sm:w-[18px]" />
      </Button>
    </div>
  );

  const motionProps = {
    initial: reduce ? false : ({ opacity: 0, y: 20 } as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: {
      duration: 0.5,
      delay: (index % 4) * 0.06,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  };

  // Sin fondo ni borde: el contenedor es transparente (estilo showcase).
  const shell = 'group relative flex w-full transition-colors duration-300';

  if (isList) {
    return (
      <motion.article {...motionProps} className={cn(shell, 'gap-3 sm:gap-4')}>
        <div className="relative w-[40%] max-w-[200px] shrink-0 self-center">{Stage}</div>
        {Info}
      </motion.article>
    );
  }

  return (
    <motion.article {...motionProps} className={cn(shell, 'h-full flex-col')}>
      {Stage}
      {Info}
      {/* El CTA vive fuera del <Link> flex-1: así todas las tarjetas de una fila
          alinean su botón a la misma altura sin importar el largo del nombre. */}
      <div className="pt-3">{Cta}</div>
    </motion.article>
  );
}
