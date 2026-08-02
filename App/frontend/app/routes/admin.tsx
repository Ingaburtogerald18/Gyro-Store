import type { IconSvgElement } from "@hugeicons/react";
import { AnimatedIcon, type IconGesture } from "~/components/ui/animated-icons";
import { Coupon01Icon, CreditCardIcon, DashboardSquare01Icon, File01Icon, Logout03Icon, Package01Icon, PackageIcon, Settings02Icon, ShoppingCart02Icon, SparklesIcon, Store01Icon, TruckIcon, UserMultiple02Icon, UserSettings01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from '@remix-run/react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { motion, useReducedMotion } from 'framer-motion';

import { Button } from '~/components/ui/button';
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
import { useGetMeQuery } from '~/store/api/authApi';
import { useGetConfigQuery } from '~/store/api/configApi';
import { BrandLoader, ModuleLoader, useAnyQueryPending } from '~/components/ui/module-loader';

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

function AdminSidebar({ user, isAdmin, pathname }: { user: User | null; isAdmin: boolean; pathname: string }) {
  const { setOpen } = useSidebar();
  const { data: config } = useGetConfigQuery();
  const reduceMotion = useReducedMotion();
  
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
          {(config?.images?.logoStatic || config?.images?.logoAnimated) ? (
            config?.images?.logoAnimated?.match(/\.(webm|mp4|mov|m4v)($|\?)/i) || config?.images?.logoAnimated?.includes('video') ? (
              <video
                src={config.images.logoAnimated}
                autoPlay loop muted playsInline
                className="size-12 shrink-0 rounded-full object-contain transition-[width,height] duration-200 group-data-[collapsible=icon]:size-8"
              />
            ) : (
              <img
                src={config?.images?.logoStatic || config?.images?.logoAnimated}
                alt="Gyro Store"
                className="size-12 shrink-0 object-contain transition-[width,height] duration-200 group-data-[collapsible=icon]:size-8"
              />
            )
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-[width,height] duration-200 group-data-[collapsible=icon]:size-8">
              <AnimatedIcon icon={Store01Icon} size={24} strokeWidth={2} />
            </div>
          )}

          {/* `hidden` y no `opacity-0`: en el rail colapsado el texto no debe
              ocupar alto, o dejaría un hueco vacío arriba de los iconos. */}
          <div className="flex flex-col items-center text-center leading-tight group-data-[collapsible=icon]:hidden">
            <span className="whitespace-nowrap text-lg font-bold tracking-tight">Gyro Store</span>
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
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {allowedItems.map((item) => {
                  const isActive = item.end
                    ? pathname === item.to
                    : pathname.startsWith(item.to);

                  // Los módulos que aún no existen se muestran, pero apagados:
                  if (!item.ready) {
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          disabled
                          tooltip="Próximamente"
                          className="cursor-not-allowed opacity-40 [&_svg]:size-6 group-data-[collapsible=icon]:size-10!"
                        >
                          <AnimatedIcon icon={item.icon} size={24} strokeWidth={2} />
                          <span className="text-[17px]">{item.name}</span>
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
                          · `[&_svg]:size-6` pisa el `[&_svg]:size-4` que la
                            primitiva fuerza sobre TODO svg — por eso el `size`
                            del icono no se veía.
                          · `size-10!` pisa el `size-8!` del estado colapsado.
                            Sin esto el botón queda en 32 px con 8 px de padding
                            y su `overflow-hidden` recorta el icono de 24 px.
                            Cabe porque el rail pasó a 56 px. */}
                      <SidebarMenuButton
                        asChild
                        isActive={false}
                        tooltip={item.name}
                        className={cn(
                          "[&_svg]:size-6 group-data-[collapsible=icon]:size-10!",
                          isActive && "relative z-10 text-primary-foreground font-medium hover:bg-transparent hover:text-primary-foreground",
                        )}
                      >
                        <NavLink to={item.to} end={item.end} prefetch="intent">
                          <AnimatedIcon
                            icon={item.icon}
                            trigger="press"
                            gesture={item.gesture ?? 'draw'}
                            size={24}
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

  // ── Overlay de transición entre módulos ──
  // Se muestra al cambiar de ruta y se queda hasta que las queries del módulo
  // nuevo respondan (con un mínimo anti-parpadeo y un tope de seguridad), para
  // no revelar la vista hasta que el backend haya contestado.
  const anyPending = useAnyQueryPending();
  const reduceMotion = useReducedMotion();
  const [moduleLoading, setModuleLoading] = useState(false);
  const loadStartRef = useRef(0);

  useEffect(() => {
    loadStartRef.current = Date.now();
    setModuleLoading(true);
  }, [location.pathname]);

  useEffect(() => {
    // Aún hay requests en vuelo: mantené el overlay.
    if (!moduleLoading || anyPending) return;
    const MIN = reduceMotion ? 0 : 450;
    const remaining = Math.max(0, MIN - (Date.now() - loadStartRef.current));
    const t = setTimeout(() => setModuleLoading(false), remaining);
    return () => clearTimeout(t);
  }, [anyPending, moduleLoading, reduceMotion]);

  useEffect(() => {
    // Tope: si algo se cuelga, nunca dejar el overlay pegado.
    if (!moduleLoading) return;
    const t = setTimeout(() => setModuleLoading(false), 6000);
    return () => clearTimeout(t);
  }, [moduleLoading]);

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
    // El estado del sidebar lo persiste SidebarProvider en cookie (mejor que
    // localStorage: no parpadea en el primer render del servidor).
    // Lo cerramos por defecto ya que queremos que sea hover-based.
    <SidebarProvider data-skin="admin" defaultOpen={false}>
      <AdminSidebar user={user} isAdmin={isAdmin} pathname={location.pathname} />

      <SidebarInset className="relative">
        <ModuleLoader show={moduleLoading} />
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border bg-background/80 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:block">
                <BreadcrumbLink asChild>
                  <NavLink to="/admin">Admin</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {current && (
                <>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center gap-1.5">
                      <AnimatedIcon icon={current.icon} size={16} strokeWidth={2} className="shrink-0" />
                      {current.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
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

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8"
        >
          <Outlet />
        </motion.main>
      </SidebarInset>
    </SidebarProvider>
  );
}
