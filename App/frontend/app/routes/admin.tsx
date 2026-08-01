import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { CreditCardIcon, DashboardSquare01Icon, File01Icon, Logout03Icon, Package01Icon, PackageIcon, PackageOpenIcon, Settings02Icon, ShoppingCart02Icon, SparklesIcon, Store01Icon, TruckIcon, UserMultiple02Icon, UserSettings01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
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
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '~/components/ui/sidebar';
import { getSupabaseClient, signOut } from '~/lib/supabase.client';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { useGetMeQuery } from '~/store/api/authApi';
import { useGetConfigQuery } from '~/store/api/configApi';
import { BrandLoader, ModuleLoader, useAnyQueryPending } from '~/components/ui/module-loader';

interface NavItem {
  name: string;
  to: string;
  icon: IconSvgElement;
  end?: boolean;
  ready?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { name: 'Dashboard', to: '/admin', icon: DashboardSquare01Icon, end: true, ready: true },
      { name: 'Salidas', to: '/admin/salidas', icon: PackageOpenIcon, ready: true },
      { name: 'Inventario', to: '/admin/inventario', icon: PackageIcon, ready: true },
      { name: 'Ventas', to: '/admin/ventas', icon: ShoppingCart02Icon, ready: true },
      { name: 'Cuotas', to: '/admin/cuotas', icon: CreditCardIcon, ready: true },
      { name: 'Caja y banco', to: '/admin/caja', icon: Wallet01Icon, ready: true },
    ],
  },
  {
    label: 'Tienda',
    items: [
      { name: 'Catálogo', to: '/admin/catalogo', icon: Package01Icon, ready: true },
      { name: 'Facturación', to: '/admin/facturacion', icon: File01Icon, ready: true },
    ],
  },
  {
    label: 'Análisis y sistema',
    items: [
      { name: 'Logística', to: '/admin/logistica', icon: TruckIcon, ready: false },
      { name: 'CRM y clientes', to: '/admin/crm', icon: UserMultiple02Icon, ready: false },
      { name: 'Personal', to: '/admin/usuarios', icon: UserSettings01Icon, ready: true },
      { name: 'Configuración', to: '/admin/configuracion', icon: Settings02Icon, ready: true },
    ],
  },
];

/**
 * Sincroniza la foto de perfil de Microsoft Entra.
 * El `provider_token` solo viaja en el SIGNED_IN inmediatamente posterior al
 * redirect de OAuth, así que se intenta también desde getSession.
 */
async function syncEntraPhoto(accessToken: string, providerToken: string) {
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
    if (result.avatar_url) {
      toast.success('Foto de perfil sincronizada. (Recarga la página)');
    } else if (result.error) {
      toast.error('Detalle de foto: ' + result.error);
    }
  } catch {
    toast.error('Error de conexión al sincronizar foto.');
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
      <SidebarHeader className="relative overflow-hidden transition-[height] duration-200 ease-linear group-data-[collapsible=icon]:h-14 h-28 flex items-center justify-center p-0">
        
        {/* Expanded View */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none gap-2">
          {config?.images?.logoStatic && (
            <img 
              src={config.images.logoStatic} 
              alt="Gyro Store Logo" 
              className="h-10 w-auto object-contain"
            />
          )}
          <div className="flex flex-col items-center text-center leading-tight">
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">Gyro Store</span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap uppercase tracking-wider font-medium">Panel admin</span>
          </div>
        </div>

        {/* Collapsed View (Icon) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:pointer-events-auto pointer-events-none">
          <NavLink to="/admin" className="flex aspect-square size-10 items-center justify-center hover:opacity-80 transition-opacity overflow-hidden">
             {config?.images?.logoStatic ? (
               <img src={config.images.logoStatic} alt="Logo" className="w-full h-full object-contain" />
             ) : (
               <HugeiconsIcon icon={Store01Icon} size={20} strokeWidth={2} className="text-foreground" />
             )}
          </NavLink>
        </div>
      </SidebarHeader>

      <SidebarContent>
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
                          className="cursor-not-allowed opacity-40"
                        >
                          <HugeiconsIcon icon={item.icon} size={16} strokeWidth={2} />
                          <span>{item.name}</span>
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
                      <SidebarMenuButton
                        asChild
                        isActive={false}
                        tooltip={item.name}
                        className={isActive ? "relative z-10 text-primary-foreground font-medium hover:bg-transparent hover:text-primary-foreground" : ""}
                      >
                        <NavLink to={item.to} end={item.end} prefetch="intent">
                          <HugeiconsIcon icon={item.icon} size={16} strokeWidth={2} />
                          <span>{item.name}</span>
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

      <SidebarRail />
    </Sidebar>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const { isLoading: isLoadingMe } = useGetMeQuery(undefined, { skip: !user });
  const { isLoading: isConfigLoading } = useGetConfigQuery();

  const isAdmin = useAppSelector(selectIsAdmin);

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
        void syncEntraPhoto(data.session.access_token, data.session.provider_token);
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
        void syncEntraPhoto(session.access_token, session.provider_token);
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
                      <HugeiconsIcon icon={current.icon} size={16} strokeWidth={2} className="shrink-0" />
                      {current.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
            <NotificationsBell />

            <Button variant="ghost" size="sm" asChild className="hidden text-muted-foreground sm:flex">
              <a href="/" target="_blank" rel="noreferrer">
                <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={2} aria-hidden className="mr-2" />
                Ver tienda
              </a>
            </Button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Menú de usuario"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar>
                      <AvatarImage src={user.user_metadata?.avatar_url} alt="" />
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
                    <HugeiconsIcon icon={Logout03Icon} size={16} strokeWidth={2} className="mr-2" />
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
