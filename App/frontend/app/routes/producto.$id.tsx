// Ficha de producto. La URL lleva slug + id (`/producto/kz-edx-pro--<uuid>`):
// el slug es para humanos y buscadores, el id es lo que resuelve el producto,
// así el nombre puede cambiar sin romper links viejos.
//
// El dato se carga en el SERVIDOR para que el título, la descripción y la foto
// estén en el HTML (Open Graph al compartir por WhatsApp).
import { useState } from 'react';
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { ChevronLeft, MessageCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { CatalogDetail, CatalogProduct } from '@shared/schemas';
import { CartDrawer } from '~/components/cart/cart-drawer';
import { ProductCarousel } from '~/components/product/product-carousel';
import { ProductGallery } from '~/components/product/product-gallery';
import {
  VariantPicker,
  variantLabel,
  type VariantSelection,
} from '~/components/product/variant-picker';
import { StoreHeader } from '~/components/store/store-header';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import type { StoreConfig } from '~/store/api/configApi';
import { useAppDispatch } from '~/store/hooks';
import { addItem, openCart } from '~/store/slices/cartSlice';
import { buildWhatsappUrl, formatCordobas, getProductUrl } from "~/lib/formatters";

export const headers: HeadersFunction = () => ({
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
});

export async function loader({ params, request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  // El id real es lo que va después del último `--` (el slug puede tener guiones).
  const raw = params.id ?? '';
  const productId = raw.split('--').pop() ?? '';

  let product: CatalogDetail | null = null;
  let related: CatalogProduct[] = [];
  let config: StoreConfig | null = null;

  try {
    const [detailRes, listRes, configRes] = await Promise.all([
      fetch(`${origin}/api/catalog/${productId}`),
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (detailRes.ok) product = (await detailRes.json()) as CatalogDetail;
    if (listRes.ok) {
      const items = ((await listRes.json()) as { items?: CatalogProduct[] }).items ?? [];
      related = items.filter((p) => p.id !== productId).slice(0, 12);
    }
    if (configRes.ok) config = (await configRes.json()) as StoreConfig;
  } catch {
    // Si la API falla, se responde 404 abajo en vez de romper el render.
  }

  if (!product) {
    throw new Response('Producto no encontrado', { status: 404 });
  }

  return { product, related, config, origin };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const product = data?.product;
  if (!product) return [{ title: 'Producto · Gyro Store' }];

  const title = `${product.name} · Gyro Store`;
  const description =
    product.description?.replace(/<[^>]*>?/gm, '').slice(0, 160) ??
    `${product.name} disponible en Gyro Store, Managua.`;

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:type', content: 'product' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(product.images[0] ? [{ property: 'og:image', content: product.images[0] }] : []),
    { property: 'og:url', content: `${data?.origin ?? ''}${getProductUrl(product.id, product.name)}` },
  ];
};

export default function ProductDetail() {
  const { product, related, config } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();
  const [selection, setSelection] = useState<VariantSelection>({});

  const currency = config?.currency;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > product.price;
  const discountPct = onSale ? Math.round((1 - product.price / compareAt) * 100) : 0;
  const soldOut = product.stock <= 0;

  // Todos los ejes con opciones deben estar elegidos antes de agregar.
  const pickableAxes = product.axes.filter((a) => a.options.length > 0);
  const missingAxis = pickableAxes.find((a) => !selection[a.key]);
  const variantName = variantLabel(product.axes, selection);

  function handleAddToCart() {
    if (soldOut) return;
    if (missingAxis) {
      toast.error(`Elegí ${missingAxis.key} antes de agregar.`);
      return;
    }
    dispatch(
      addItem({
        catalogId: product.id,
        name: product.name,
        variantName,
        price: product.price,
        image: product.images[0] ?? '',
        quantity: 1,
      }),
    );
    dispatch(openCart());
    toast.success('Agregado al carrito');
  }

  function handleWhatsApp() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const variant = variantName !== 'Estándar' ? ` (${variantName})` : '';
    const message = soldOut
      ? `Hola, quiero que me avisen cuando vuelva a haber stock de: ${product.name}. ${url}`
      : `Hola, quiero: ${product.name}${variant} — ${formatCordobas(product.price, currency)}. ${url}`;
    window.open(
      buildWhatsappUrl(config?.whatsapp ?? '', message),
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <>
      <StoreHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
          <Link to="/#catalogo" prefetch="intent">
            <ChevronLeft aria-hidden /> Volver al catálogo
          </Link>
        </Button>

        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <ProductGallery images={product.images} name={product.name} />

          <div className="flex flex-col gap-5">
            <div className="space-y-3">
              {onSale && (
                <Badge variant="default" className="bg-[#885cf6] text-white hover:bg-[#885cf6]/80 tabular-nums">−{discountPct}%</Badge>
              )}
              {product.isPromo && !onSale && <Badge variant="default" className="bg-[#885cf6] text-white hover:bg-[#885cf6]/80">Oferta</Badge>}

              <h1 className="text-2xl leading-tight font-black tracking-tight text-balance text-foreground sm:text-4xl">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-primary-2 tabular-nums">
                  {formatCordobas(product.price, currency)}
                </span>
                {onSale && (
                  <span className="text-base text-muted-foreground line-through tabular-nums">
                    {formatCordobas(compareAt, currency)}
                  </span>
                )}
              </div>

              {product.description && (
                <p className="max-w-[65ch] leading-relaxed text-pretty text-muted-foreground">
                  {product.description.replace(/<[^>]*>?/gm, '')}
                </p>
              )}
            </div>

            {pickableAxes.length > 0 && (
              <>
                <Separator className="bg-border" />
                <VariantPicker
                  axes={product.axes}
                  selection={selection}
                  onChange={setSelection}
                />
              </>
            )}

            <div className="mt-auto flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleAddToCart}
                disabled={soldOut}
                className="h-12 flex-1 text-sm"
              >
                <ShoppingCart aria-hidden />
                {soldOut ? 'Agotado' : 'Agregar al carrito'}
              </Button>
              <Button
                variant="outline"
                onClick={handleWhatsApp}
                className="h-12 justify-center rounded-md text-[#25D366] border-[#25D366] hover:bg-[#25D366]/10 sm:w-auto sm:px-6"
              >
                <MessageCircle aria-hidden />
                {soldOut ? 'Avisame' : 'Pedir por WhatsApp'}
              </Button>
            </div>

            {product.specs.length > 0 && (
              <>
                <Separator className="bg-border" />
                <div>
                  <h2 className="mb-3 text-sm font-bold tracking-[0.18em] text-muted-foreground uppercase">
                    Especificaciones
                  </h2>
                  {/* Grilla con hairlines: el gap de 1px sobre el borde dibuja
                      las líneas, sin bordes por celda. */}
                  <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2">
                    {product.specs.map((spec) => (
                      <div key={spec.label} className="bg-card px-4 py-3">
                        <dt className="text-xs text-muted-foreground capitalize">{spec.label}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-foreground">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <ProductCarousel
              title="Tal vez te pueda interesar"
              products={related}
              variant="showcase"
            />
          </div>
        )}
      </main>
      <CartDrawer />
    </>
  );
}
