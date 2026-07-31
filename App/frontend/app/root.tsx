// Layout raíz de Remix (doc 09 ítem 41, versión mínima de fundación).
// Responsabilidades: cargar tailwind.css, fijar data-theme/data-skin y exponer
// las llaves públicas de Supabase al navegador vía window.ENV.
import type { LinksFunction } from '@remix-run/node';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from '@remix-run/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store } from '~/store/store';
import tailwindHref from './tailwind.css?url';

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
  { rel: 'stylesheet', href: tailwindHref },
];

// Único lugar donde el server pasa config al cliente. Solo llaves PÚBLICAS:
// la service_role vive exclusivamente en el backend Express.
export async function loader() {
  return {
    ENV: {
      SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
    },
  };
}

export function Layout({ children }: { children: ReactNode }) {
  // useRouteLoaderData (y no useLoaderData): Layout también envuelve el
  // ErrorBoundary, donde el loader pudo no haber corrido.
  const data = useRouteLoaderData<typeof loader>('root');
  const env = JSON.stringify(data?.ENV ?? {}).replace(/</g, '\\u003c');

  return (
    // suppressHydrationWarning: el script anti-flash puede cambiar data-theme
    // antes de que React hidrate; ese "mismatch" es intencional.
    // `style-rhea`: activa el style del preset shadcn sobre todas las primitivas.
    <html
      lang="es"
      className="style-rhea"
      data-theme="dark"
      data-skin="store"
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash de tema: aplica el tema guardado ANTES del primer paint.
            Debe ir primero en <head>. Clave sincronizada con useTheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('gyro:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `window.ENV=${env};` }} />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { AuthSync } from '~/components/auth/AuthSync';
import { GlobalProgress } from '~/components/ui/global-progress';
import { TooltipProvider } from '~/components/ui/tooltip';

export default function App() {
  return (
    <Provider store={store}>
      {/* TooltipProvider va acá y no dentro de cada vista: las primitivas del
          registry montan <Tooltip> sin proveedor propio (el `tooltip` de
          SidebarMenuButton, por ejemplo) y Radix lanza si no encuentra uno.
          delayDuration 0: en un panel interno el tooltip es una etiqueta del
          ícono colapsado, no una ayuda opcional — debe salir de inmediato. */}
      <TooltipProvider delayDuration={0}>
        <GlobalProgress />
        <AuthSync />
        <Outlet />
        {/* Toasts pintados con los tokens de marca, no con el tema de sonner. */}
        <Toaster
          position="bottom-center"
          toastOptions={{
            className:
              'border border bg-card text-foreground rounded-lg text-sm',
          }}
        />
      </TooltipProvider>
    </Provider>
  );
}
