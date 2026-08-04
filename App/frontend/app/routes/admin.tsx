import type { IconSvgElement } from "@hugeicons/react";
import { AnimatedIcon, type IconGesture } from "~/components/ui/animated-icons";
import { Coupon01Icon, CreditCardIcon, DashboardSquare01Icon, File01Icon, Logout03Icon, Package01Icon, PackageIcon, Settings02Icon, ShoppingCart02Icon, SparklesIcon, Store01Icon, TruckIcon, UserMultiple02Icon, UserSettings01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from '@remix-run/react';
import type { User } from '@supabase/supabase-js';
import { motion, useReducedMotion } from 'framer-motion';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Separator } from '~/components/ui/separator';
import { NotificationsBell } from '~/components/admin/NotificationsBell';
import { ThemeToggle } from '~/components/layout/ThemeToggle';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '~/components/ui/sidebar';
import { cn } from '~/lib/utils';
import { getSupabaseClient, signOut } from '~/lib/supabase.client';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin, selectUserPhoto } from '~/store/slices/authSlice';
import { useGetMeQuery, useGetConfigQuery } from '~/store/api/sessionApi';
import { useGetMeQuery } from '~/store/api/sessionApi';
import { useGetConfigQuery } from '~/store/api/configApi';
main
import { BrandLoader } from '~/components/ui/module-loader';

interface NavItem {
  name: string;
  to: string;
  icon: IconSvgElement;
  end?: boolean;
  ready?: boolean;
  /**
   * Gesto del icono al hacer click. Cada módulo tiene el suyo para que el nav
   * no se sienta una lista de doce cosas iguales: el gesto ayuda a reconocer
   * dónde estás picando sin leer la etiqueta.
   */
  gesture?: IconGesture;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { name: 'Reportería', to: '/admin', icon: DashboardSquare01Icon, end: true, ready: true, gesture: 'draw' },
      // `nudge-y`: el paquete "cae", como stock que se apila.
      { name: 'Inventario', to: '/admin/inventario', icon: PackageIcon, ready: true, gesture: 'nudge-y' },
      { name: 'Ventas', to: '/admin/ventas', icon: ShoppingCart02Icon, ready: true, gesture: 'pop' },
      { name: 'Cuotas', to: '/admin/cuotas', icon: CreditCardIcon, ready: true, gesture: 'nudge-x' },
      { name: 'Caja y banco', to: '/admin/caja', icon: Wallet01Icon, ready: true, gesture: 'pop' },
    ],
  },
  {
    label: 'Tienda',
    items: [
      { name: 'Catálogo', to: '/admin/catalogo', icon: Package01Icon, ready: true, gesture: 'draw' },
      { name: 'Facturación', to: '/admin/facturacion', icon: File01Icon, ready: true, gesture: 'draw' },
      { name: 'Códigos de descuento', to: '/admin/codigos-descuento', icon: Coupon01Icon, ready: true, gesture: 'pop' },
    ],
  },
  {
    label: 'Análisis y sistema',
    items: [
      // Los dos primeros están apagados (`ready: false`): el gesto queda
      // declarado para el día que se enciendan, pero no se dispara.
      { name: 'Logística', to: '/admin/logistica', icon: TruckIcon, ready: false, gesture: 'nudge-x' },
      { name: 'CRM y clientes', to: '/admin/crm', icon: UserMultiple02Icon, ready: false, gesture: 'pop' },
      { name: 'Personal', to: '/admin/usuarios', icon: UserSettings01Icon, ready: true, gesture: 'draw' },
      { name: 'Configuración', to: '/admin/configuracion', icon: Settings02Icon, ready: true, gesture: 'pop' },
    ],
  },
];

/**
 * Sincroniza la foto de perfil de Microsoft Entra.
 * El `provider_token` solo viaja en el SIGNED_IN inmediatamente posterior al
 * redirect de OAuth, así que se intenta también desde getSession.
 *
 * SILENCIOSA a propósito: que un usuario no tenga foto en Entra (404) o que R2
 * no esté configurado (500) son escenarios NORMALES, no errores que el usuario
 * pueda resolver. Avisar de eso en cada login era ruido puro. Queda en consola
 * para quien depura.
 *
 * @returns `true` si la foto cambió (hay que refrescar el perfil).
 */
async function syncEntraPhoto(accessToken: string, providerToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/sync-photo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ provider_token: providerToken }),
    });
    const result = await res.json();
    if (result.error) {
      console.warn('[sync-photo]', result.error);
      return false;
    }
    return result.changed === true;
  } catch (err) {
    console.warn('[sync-photo] Error de conexión', err);
    return false;
  }
}

function AdminSidebar({ isAdmin, pathname }: { isAdmin: boolean; pathname: string }) {
  const { data: config } = useGetConfigQuery();
  const reduceMotion = useReducedMotion();
  const { setOpen } = useSidebar();

  // Expansión por hover: en escritorio el panel arranca colapsado (rail de
  // iconos) y se despliega al acercar el mouse, colapsando al salir. El
  // `SidebarTrigger` del header sigue funcionando para click/teclado (y en
  // touch, donde no hay hover). Los handlers van sobre el contenedor del
  // Sidebar, así que solo disparan al entrar al panel, no de paso.
  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* La marca va DENTRO de SidebarContent, no en un SidebarHeader.
          `SidebarHeader` es un hermano flex del contenido, así que quedaba
          clavado arriba mientras el menú se centraba: logo y botones sin
          relación visual. Metiéndola acá, marca + navegación son un solo bloque
          y el `safe center` los centra juntos.

          `safe center` y no `justify-center` a secas: con doce módulos + labels,
          en una ventana baja el contenido es más alto que el sidebar. Con
          centrado normal el desborde se reparte arriba y abajo y la parte de
          arriba queda INALCANZABLE al scrollear. `safe` centra mientras entra y
          cae a alineado-al-tope cuando no. */}
      <SidebarContent className="[justify-content:safe_center]">
        <NavLink
          to="/admin"
          className="flex shrink-0 flex-col items-center gap-2 rounded-lg px-2 py-4 transition-opacity hover:opacity-80 group-data-[collapsible=icon]:py-2"
        >
          {/* Con `prefers-reduced-motion` se usa el logo ESTÁTICO, no el video.
              Un video en loop es movimiento permanente en pantalla: es
              exactamente lo que esa preferencia pide evitar, y además ahorra la
              descarga. `preload="metadata"` para no bajar el archivo entero
              antes de que haga falta. */}
          {(config?.images?.logoStatic || config?.images?.logoAnimated) ? (
            !reduceMotion &&
            (config?.images?.logoAnimated?.match(/\.(webm|mp4|mov|m4v)($|\?)/i) ||
              config?.images?.logoAnimated?.includes('video')) ? (
              <video
                src={config.images.logoAnimated}
                autoPlay loop muted playsInline
                preload="metadata"
                aria-hidden
                className="size-9 shrink-0 rounded-full object-contain transition-[width,height] duration-200 group-data-[collapsible=icon]:size-7"
              />
            ) : (
              <img
                src={config?.images?.logoStatic || config?.images?.logoAnimated}
                alt={config?.brandName || getBrandName()}
                width={36}
                height={36}
                loading="lazy"
                decoding="async"
                className="size-9 shrink-0 object-contain transition-[width,height] duration-200 group-data-[collapsible=icon]:size-7"
              />
            )
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-[width,height] duration-200 group-data-[collapsible=icon]:size-7">
              <AnimatedIcon icon={Store01Icon} size={24} strokeWidth={2} />
            </div>
          )}

          {/* `hidden` y no `opacity-0`: en el rail colapsado el texto no debe
              ocupar alto, o dejaría un hueco vacío arriba de los iconos. */}
          <div className="flex flex-col items-center text-center leading-tight group-data-[collapsible=icon]:hidden">
            <span className="whitespace-nowrap text-lg font-bold tracking-tight">{config?.brandName || getBrandName()}</span>
            <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Panel Admin
            </span>
          </div>
        </NavLink>

        {NAV_GROUPS.map((group) => {
          // Quien no es admin solo ve su operación diaria.
          const allowedItems = group.items.filter((item) =>
            isAdmin ? true : item.name === 'Ventas' || item.name === 'Personal',
          );
          if (allowedItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              {/* `hidden` en rail: la etiqueta del grupo se recortaba a dos
                  letras ilegibles y dejaba un hueco entre bloques de iconos. */}
              <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {allowedItems.map((item) => {
                  const isActive = item.end
                    ? pathname === item.to
                    : pathname.startsWith(item.to);

                  // Los módulos que aún no existen se muestran con un badge
                  // "Pronto" en vez de atenuados al 40 %: un ítem medio borrado
                  // se lee como un bug de renderizado, no como roadmap.
                  // `aria-disabled` en lugar de `disabled` para que el lector de
                  // pantalla lo anuncie y no lo omita.
                  if (!item.ready) {
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          aria-disabled
                          tooltip={`${item.name} · Próximamente`}
                          className="cursor-default text-muted-foreground [&_svg]:size-5 group-data-[collapsible=icon]:size-10!"
                        >
                          <AnimatedIcon icon={item.icon} size={20} strokeWidth={2} />
                          <span className="text-[17px]">{item.name}</span>
                          <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide group-data-[collapsible=icon]:hidden">
                            Pronto
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.name} className="relative">
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 rounded-lg bg-primary"
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      {/* Dos overrides sobre `sidebarMenuButtonVariants`:
                          · `[&_svg]:size-5` pisa el `[&_svg]:size-4` que la
                            primitiva fuerza sobre TODO svg — por eso el `size`
                            del icono no se veía. 20 px queda proporcional a la
                            etiqueta de 17 px y al resto de la app (encabezados).
                          · `size-10!` pisa el `size-8!` del estado colapsado, y
                            centra el icono en el rail de 56 px. */}
                      <SidebarMenuButton
                        asChild
                        isActive={false}
                        tooltip={item.name}
                        className={cn(
                          "[&_svg]:size-5 group-data-[collapsible=icon]:size-10!",
                          isActive && "relative z-10 text-primary-foreground font-medium hover:bg-transparent hover:text-primary-foreground",
                        )}
                      >
                        <NavLink to={item.to} end={item.end} prefetch="intent">
                          <AnimatedIcon
                            icon={item.icon}
                            trigger="press"
                            gesture={item.gesture ?? 'draw'}
                            size={20}
                            strokeWidth={2}
                          />
                          <span className="text-[17px]">{item.name}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Ver tienda">
              <NavLink to="/">
                <AnimatedIcon icon={SparklesIcon} size={16} strokeWidth={2} />
                <span>Ver tienda</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const { isLoading: isLoadingMe, refetch: refetchMe } = useGetMeQuery(undefined, { skip: !user });
  const { isLoading: isConfigLoading } = useGetConfigQuery();

  const isAdmin = useAppSelector(selectIsAdmin);
  // La foto sale de /auth/me (profiles.avatar_url), no de user_metadata: con
  // Entra ese metadata viene vacío.
  const profilePhoto = useAppSelector(selectUserPhoto);

  // ── Sin overlay entre módulos ──
  // Acá vivía un `ModuleLoader` que tapaba el contenido en CADA cambio de ruta,
  // con un mínimo anti-parpadeo de 450 ms y un tope de 6 s. El mínimo se pagaba
  // siempre: con el backend respondiendo en 80 ms, la navegación igual costaba
  // medio segundo de pantalla tapada. Un mínimo artificial no arregla el
  // parpadeo, solo lo convierte en lentitud constante.
  //
  // Lo reemplaza la barra fina de `GlobalProgress` (que aparece recién a los
  // 150 ms, así que en las cargas rápidas no se ve nada) más los skeletons de
  // cada bloque, que ocupan la forma final del contenido. Ver Docs/16.
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        navigate('/login', { replace: true });
        return;
      }
      setUser(data.session.user);
      setChecking(false);

      if (
        data.session.provider_token &&
        data.session.user.app_metadata?.provider === 'azure'
      ) {
        // Si la foto cambió, se re-pide /auth/me para que el avatar aparezca
        // sin recargar. `active` evita el refetch si el layout ya se desmontó.
        void syncEntraPhoto(data.session.access_token, data.session.provider_token).then(
          (changed) => {
            if (changed && active) refetchMe();
          },
        );
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }
      setUser(session.user);

      if (
        event === 'SIGNED_IN' &&
        session.provider_token &&
        session.user.app_metadata?.provider === 'azure'
      ) {
        void syncEntraPhoto(session.access_token, session.provider_token).then((changed) => {
          if (changed && active) refetchMe();
        });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  if (checking || isLoadingMe || isConfigLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">
        <BrandLoader text="Cargando interfaz..." />
      </div>
    );
  }

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const current = allItems.find(
    (item) =>
      location.pathname === item.to ||
      (item.to !== '/admin' && location.pathname.startsWith(item.to)),
  );

  return (
    // Arranca colapsado (rail de iconos): el panel es hover-based en escritorio
    // (ver AdminSidebar) y se abre/cierra con el SidebarTrigger en touch.
    <SidebarProvider data-skin="admin" defaultOpen={false}>
      <AdminSidebar isAdmin={isAdmin} pathname={location.pathname} />

      {/* La barra de progreso NO se monta acá: `root.tsx` ya tiene una para
          toda la app y dos instancias dibujarían dos barras. */}
      <SidebarInset className="relative">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          {/* Breadcrumb REDUCIDO: solo la ruta, en `text-sm` y sin icono.
              El icono y el peso duplicaban el `PageHeader` de abajo, que dice
              exactamente lo mismo tres centímetros más abajo y más grande. Acá
              la función es ubicar, no titular. */}
          <Breadcrumb>
            <BreadcrumbList className="text-sm">
              <BreadcrumbItem className="hidden sm:block">
                <BreadcrumbLink asChild>
                  <NavLink to="/admin" className="text-muted-foreground">Admin</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {current && (
                <>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-foreground">
                      {current.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationsBell />

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Menú de usuario"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar>
                      <AvatarImage src={profilePhoto ?? user.user_metadata?.avatar_url} alt="" />
                      <AvatarFallback className="uppercase">
                        {user.email?.charAt(0) ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm leading-none font-medium">
                        {(user.user_metadata?.name as string | undefined) ?? 'Staff'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
                    <AnimatedIcon icon={Logout03Icon} size={16} strokeWidth={2} className="mr-2" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Solo opacidad, sin `y`. El desplazamiento vertical al entrar hacía
            parecer que la página reflowea, y además competía con la entrada de
            cada bloque de contenido. Una sola animación de entrada por
            pantalla. */}
        {/* `max-w-[1600px]` + `mx-auto`: sin tope de ancho, en un monitor de
            27" las tablas y los KPIs se estiraban a ~2400 px. Una fila de datos
            de dos metros de ancho es imposible de seguir con la vista, y es lo
            que más delata a una herramienta interna. */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
          className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </motion.main>
      </SidebarInset>
    </SidebarProvider>
  );
}
