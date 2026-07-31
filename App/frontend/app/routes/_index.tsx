// Home del storefront. El catálogo y la config se piden en el SERVIDOR (loader),
// no en el cliente: mejora SEO y primer render, y evita el parpadeo de carga.
// /api/catalog y /api/config son públicos, así que no hace falta token.
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import type { CatalogProduct, LandingConfig } from '@shared/schemas';
import { CartDrawer } from '~/components/cart/cart-drawer';
import { Hero } from '~/components/catalog/hero';
import { ProductGrid } from '~/components/catalog/product-grid';
import { StoreHeader } from '~/components/store/store-header';
import type { StoreConfig } from '~/store/api/configApi';

// Catálogo público: 60s fresco + 5min de stale-while-revalidate. El HTML del SSR
// no contiene nada privado, así que es seguro cachearlo en navegador/CDN.
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
});

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  let products: CatalogProduct[] = [];
  let config: StoreConfig | null = null;
  let landing: LandingConfig | null = null;

  try {
    const [catalogRes, configRes, landingRes] = await Promise.all([
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
      fetch(`${origin}/api/landing-config`),
    ]);
    if (catalogRes.ok) {
      products = ((await catalogRes.json()) as { items?: CatalogProduct[] }).items ?? [];
    }
    if (configRes.ok) config = (await configRes.json()) as StoreConfig;
    if (landingRes.ok) landing = (await landingRes.json()) as LandingConfig;
  } catch {
    // Si la API falla, la página igual renderiza con su estado vacío.
  }

  return { origin, products, config, landing };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const origin = data?.origin ?? '';
  const title = 'Gyro Store';
  const description =
    'Audífonos KZ, adaptadores Bluetooth y accesorios de tecnología en Managua, Nicaragua.';
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Gyro Store' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: `${origin}/` },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];
};

export default function Index() {
  const { products, config, landing } = useLoaderData<typeof loader>();

  return (
    <>
      <StoreHeader />
      <main>
        <Hero initialLanding={landing} />
        <div id="catalogo" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8">
          <ProductGrid products={products} categories={config?.categories} />
        </div>
      </main>
      <CartDrawer />
      <footer className="mt-12 py-8 border-t border-border dark:border-border text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
        <p>&copy; {new Date().getFullYear()} Gyro Store.</p>
        <a href="/login" className="opacity-20 hover:opacity-100 transition-opacity" title="Acceso de Personal">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </a>
      </footer>
    </>
  );
}
