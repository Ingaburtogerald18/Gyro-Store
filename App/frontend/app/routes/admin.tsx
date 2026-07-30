import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from '@remix-run/react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import {
  Boxes,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  UserCog,
  X,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  Store
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { getSupabaseClient, signOut } from '~/lib/supabase.client';
import { cn } from '~/lib/utils';
import { useAppSelector } from '~/store/hooks';
import { selectIsAdmin } from '~/store/slices/authSlice';
import { useGetMeQuery } from '~/store/api/authApi';
import { useGetConfigQuery } from '~/store/api/configApi';

const COLLAPSE_KEY = "adminSidebarCollapsed";

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
    label: "Operación",
    items: [
      { name: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true, ready: true },
      { name: 'Inventario', to: '/admin/inventario', icon: Boxes, ready: true },
      { name: 'Ventas', to: '/admin/ventas', icon: ShoppingCart, ready: true },
      { name: 'Cuotas', to: '/admin/cuotas', icon: CreditCard, ready: true },
    ],
  },
  {
    label: "Tienda",
    items: [
      { name: 'Catálogo', to: '/admin/catalogo', icon: Package, ready: true },
      { name: 'Facturación', to: '/admin/facturacion', icon: FileText, ready: true },
    ],
  },
  {
    label: "Análisis y sistema",
    items: [
      { name: 'Logística', to: '/admin/logistica', icon: Truck, ready: false },
      { name: 'CRM y clientes', to: '/admin/crm', icon: Users, ready: false },
      { name: 'Personal', to: '/admin/usuarios', icon: UserCog, ready: true },
      { name: 'Configuración', to: '/admin/configuracion', icon: Settings, ready: true },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  const { isLoading: isLoadingMe } = useGetMeQuery(undefined, { skip: !user });
  const { isLoading: isConfigLoading } = useGetConfigQuery();
  
  const isAdmin = useAppSelector(selectIsAdmin);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const isEffectivelyCollapsed = sidebarCollapsed && !isHovering;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

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

      // También lo intentamos aquí por si getSession lo atrapó
      if (
        data.session?.provider_token && 
        data.session?.user?.app_metadata?.provider === 'azure'
      ) {
        fetch('/api/auth/sync-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({ provider_token: data.session.provider_token })
        }).then(res => res.json()).then(result => {
           if (result.avatar_url) {
             toast.success("Foto de perfil sincronizada. (Recarga la página)");
           } else if (result.error) {
             toast.error("Detalle de foto: " + result.error);
           }
        }).catch(err => console.error(err));
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) navigate('/login', { replace: true });
      else {
        setUser(session.user);
        
        // El provider_token solo viene en el evento SIGNED_IN inmediatamente después del redirect OAuth
        if (
          _event === 'SIGNED_IN' &&
          session.provider_token && 
          session.user.app_metadata?.provider === 'azure'
        ) {
          fetch('/api/auth/sync-photo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ provider_token: session.provider_token })
          }).then(res => res.json()).then(result => {
             if (result.avatar_url) {
               toast.success("Foto de perfil sincronizada con éxito. (Recarga la página para verla)");
             } else if (result.error) {
               toast.error("Detalle de foto: " + result.error);
             }
          }).catch(err => toast.error("Error de conexión al sincronizar foto."));
        }
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
  const current = allItems.find((item) => location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to)));

  return (
    <div
      data-skin="admin"
      className="flex min-h-screen bg-bg text-text"
    >
      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Animado */}
      <aside
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-surface bg-gradient-to-b from-accent/[0.05] to-transparent p-4 transition-[transform,width] duration-300 md:bg-surface/70 md:backdrop-blur-xl",
          "md:sticky md:top-0 md:bottom-auto md:h-screen md:translate-x-0 md:self-start",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          isEffectivelyCollapsed && "md:w-20",
        )}
      >
        <div className="mb-3">
          <div className={cn("mb-2 flex items-center", isEffectivelyCollapsed ? "md:justify-center" : "justify-end")}>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <button
              className="group/toggle hidden h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:grid"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="h-5 w-5 transition-transform duration-300 group-hover/toggle:translate-x-0.5" />
              ) : (
                <ChevronsLeft className="h-5 w-5 transition-transform duration-300 group-hover/toggle:-translate-x-0.5" />
              )}
            </button>
          </div>

          <div className="flex flex-col items-center">
            <div className={cn(
                "grid place-items-center rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 ring-1 ring-white/10 transition-all duration-300",
                isEffectivelyCollapsed ? "h-11 w-11" : "h-20 w-20"
            )}>
               <Store className={cn("text-accent transition-all duration-300", isEffectivelyCollapsed ? "h-5 w-5" : "h-10 w-10")} />
            </div>
            <span
              className={cn(
                "mt-2 text-lg font-extrabold tracking-tight text-text",
                isEffectivelyCollapsed && "md:hidden",
              )}
            >
              Gyro<span className="text-accent">Admin</span>
            </span>
          </div>
        </div>

        <motion.nav 
          initial="hidden"
          animate="show"
          variants={{
            show: { transition: { staggerChildren: 0.04 } }
          }}
          className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 pb-2"
        >
          {NAV_GROUPS.map((group) => {
            const allowedItems = group.items.filter(item => {
              if (isAdmin) return true;
              return item.name === 'Ventas' || item.name === 'Personal';
            });
            if (allowedItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p
                  className={cn(
                    "mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted/80",
                    isEffectivelyCollapsed && "md:hidden",
                  )}
                >
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {allowedItems.map((item) => (
                    <motion.div
                      key={item.name}
                      variants={{
                        hidden: { opacity: 0, x: -10 },
                        show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                      }}
                    >
                      {item.ready ? (
                        <NavLink
                          to={item.to}
                          end={item.end}
                          prefetch="intent"
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-out hover:translate-x-0.5 active:scale-[0.97] motion-reduce:hover:translate-x-0",
                            isActive ? "font-medium text-accent-2" : "text-muted hover:text-text",
                            isEffectivelyCollapsed && "md:justify-center md:gap-0 md:px-0 md:hover:translate-x-0",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.span
                                layoutId="admin-nav-active"
                                className="absolute inset-0 rounded-lg bg-accent/10"
                                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                              >
                                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
                              </motion.span>
                            )}
                            {!isActive && (
                              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />
                            )}
                            <span className="relative z-10 shrink-0">
                              <item.icon
                                className={cn(
                                  "h-[18px] w-[18px] transition-all duration-300",
                                  isActive
                                    ? "text-accent-2"
                                    : "group-hover:scale-110 group-hover:-rotate-6 group-hover:text-accent-2",
                                )}
                              />
                            </span>
                            <span
                              className={cn(
                                "relative z-10 flex-1 truncate",
                                isEffectivelyCollapsed && "md:hidden",
                              )}
                            >
                              {item.name}
                            </span>
                            <ChevronRight
                              className={cn(
                                "relative z-10 h-4 w-4 shrink-0 -translate-x-1 text-accent-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:hidden",
                                isEffectivelyCollapsed && "md:hidden",
                              )}
                            />
                          </>
                        )}
                      </NavLink>
                    ) : (
                      <span
                        aria-disabled="true"
                        title="Próximamente"
                        className={cn(
                           "flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted/40",
                           isEffectivelyCollapsed && "md:justify-center md:gap-0 md:px-0"
                        )}
                      >
                         <span className="relative z-10 shrink-0">
                           <item.icon className="h-[18px] w-[18px]" />
                         </span>
                         <span className={cn("relative z-10 flex-1 truncate", isEffectivelyCollapsed && "md:hidden")}>
                           {item.name}
                         </span>
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            );
          })}
        </motion.nav>

        {/* Espacio vacío para balancear el sidebar ya que el usuario se movió al header */}
        <div className="mt-auto border-t border-border pt-3"></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[30] flex h-14 items-center justify-between gap-4 border-b border-border bg-bg/80 px-4 backdrop-blur-md lg:h-[60px] lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="-ml-2 grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {current && (
              <div className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
                <span className="text-muted">Admin</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-text">
                  <current.icon className="h-4 w-4 shrink-0 text-accent-2" />
                  <span className="truncate">{current.name}</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-muted hidden sm:flex">
              <a href="/" target="_blank" rel="noreferrer">
                <Sparkles aria-hidden className="h-4 w-4 mr-2" />
                Ver tienda
              </a>
            </Button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 ring-1 ring-border text-sm font-bold text-text uppercase transition-all hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      user.email?.charAt(0) ?? 'U'
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-surface border-border text-text">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {(user.user_metadata?.name as string | undefined) ?? 'Staff'}
                      </p>
                      <p className="text-xs leading-none text-muted">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem className="cursor-pointer focus:bg-surface-2 focus:text-text" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
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
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
