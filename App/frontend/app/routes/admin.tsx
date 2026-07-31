import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from '@remix-run/react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import {
  Boxes,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  UserCog,
  Store,
} from 'lucide-react';
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
} from '~/components/ui/sidebar';
import { getSupabaseClient, signOut } from '~/lib/supabase.client';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { useGetMeQuery } from '~/store/api/authApi';
import { useGetConfigQuery } from '~/store/api/configApi';

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
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
      { name: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true, ready: true },
      { name: 'Inventario', to: '/admin/inventario', icon: Boxes, ready: true },
      { name: 'Ventas', to: '/admin/ventas', icon: ShoppingCart, ready: true },
      { name: 'Cuotas', to: '/admin/cuotas', icon: CreditCard, ready: true },
    ],
  },
  {
    label: 'Tienda',
    items: [
      { name: 'Catálogo', to: '/admin/catalogo', icon: Package, ready: true },
      { name: 'Facturación', to: '/admin/facturacion', icon: FileText, ready: true },
    ],
  },
  {
    label: 'Análisis y sistema',
    items: [
      { name: 'Logística', to: '/admin/logistica', icon: Truck, ready: false },
      { name: 'CRM y clientes', to: '/admin/crm', icon: Users, ready: false },
      { name: 'Personal', to: '/admin/usuarios', icon: UserCog, ready: true },
      { name: 'Configuración', to: '/admin/configuracion', icon: Settings, ready: true },
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

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const { isLoading: isLoadingMe } = useGetMeQuery(undefined, { skip: !user });
  const { isLoading: isConfigLoading } = useGetConfigQuery();

  const isAdmin = useAppSelector(selectIsAdmin);

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
      <div className="grid min-h-svh place-items-center bg-bg text-sm text-muted">
        Cargando interfaz...
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
    <SidebarProvider data-skin="admin">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <NavLink to="/admin">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Store className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold">GyroAdmin</span>
                    <span className="truncate text-xs text-muted">Panel interno</span>
                  </div>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
                      ? location.pathname === item.to
                      : location.pathname.startsWith(item.to);

                    // Los módulos que aún no existen se muestran, pero apagados:
                    // dan contexto de lo que viene sin ofrecer un link roto.
                    if (!item.ready) {
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            disabled
                            tooltip="Próximamente"
                            className="cursor-not-allowed opacity-40"
                          >
                            <item.icon />
                            <span>{item.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                          <NavLink to={item.to} end={item.end} prefetch="intent">
                            <item.icon />
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

        {/* El borde arrastrable para plegar/desplegar. */}
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur-md">
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
                      <current.icon className="size-4 shrink-0" />
                      {current.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="hidden text-muted sm:flex">
              <a href="/" target="_blank" rel="noreferrer">
                <Sparkles aria-hidden className="mr-2 size-4" />
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
                      <p className="text-xs leading-none text-muted">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
                    <LogOut className="mr-2 size-4" />
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
