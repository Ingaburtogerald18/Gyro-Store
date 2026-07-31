import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, CustomerSupportIcon, DashboardSquare01Icon, Edit02Icon, Logout03Icon, Moon02Icon, SquareLock02Icon, Sun01Icon, TruckIcon, User02Icon } from "@hugeicons/core-free-icons";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectAuthStatus, selectIsAdmin, selectEditMode, selectUser, toggleEditMode } from "~/store/slices/authSlice";
import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";
import { signOut } from "~/lib/supabase.client";

// Fila estándar del menú: icono dentro de un "chip" con superficie propia para que
// no se vea plano ni aburrido. `tone` cambia el color del chip (acento / peligro).
const ROW =
  "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors";
const CHIP = "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors";

/** Interruptor accesible (role="switch") para el tema. Unificado: se usa tanto en
 *  la vista de invitado como en la autenticada (antes había dos botones distintos). */
function ThemeSwitch({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover:bg-primary/50 transition-colors cursor-pointer" onClick={onToggle}>
      <span className="flex items-center gap-3 text-sm font-medium text-foreground cursor-pointer">
        <span className={cn(CHIP, "bg-primary text-primary")}>
          {isDark ? <HugeiconsIcon icon={Moon02Icon} size={16} strokeWidth={2} /> : <HugeiconsIcon icon={Sun01Icon} size={16} strokeWidth={2} />}
        </span>
        Apariencia
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={`Cambiar a tema ${isDark ? "claro" : "oscuro"}`}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isDark ? "border-primary bg-primary" : "border bg-primary",
        )}
      >
        <motion.span
          aria-hidden
          animate={{ x: isDark ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute left-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow"
        >
          {isDark ? (
            <HugeiconsIcon icon={Moon02Icon} size={12} strokeWidth={2} className="text-primary" />
          ) : (
            <HugeiconsIcon icon={Sun01Icon} size={12} strokeWidth={2} className="text-warning" />
          )}
        </motion.span>
      </button>
    </div>
  );
}

export function HeaderSettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const user = useAppSelector(selectUser);
  const location = useLocation();

  const isHome = location.pathname === "/";
  const isAuthed = status === "authenticated";
  const isDark = theme === "dark";
  const loginTo = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;

  // Nombre corto y etiqueta del rol para el encabezado del menú autenticado.
  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Staff";
  const initial = firstName.charAt(0).toUpperCase();
  const roleLabel = user?.role ? user.role.toUpperCase() : "Sesión iniciada";

  async function handleLogout() {
    setIsOpen(false);
    await signOut();
    toast.success("Sesión cerrada.");
  }

  function comingSoon() {
    setIsOpen(false);
    toast.info("Próximamente disponible.");
  }

  // Cierra el menú al hacer clic afuera.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Disparador premium: píldora con borde; muestra la INICIAL del colaborador
          cuando hay sesión (avatar), o el icono de usuario cuando es invitado. */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-full border shadow-sm backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isAuthed
            ? "border-primary/30 bg-primary/10 hover:bg-primary/15"
            : "border bg-primary text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
        aria-label="Menú de cuenta y configuración"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isAuthed ? (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary ring-1 ring-primary/30">
            {initial}
          </span>
        ) : (
          <HugeiconsIcon icon={User02Icon} size={20} strokeWidth={2} />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border bg-card shadow-xl backdrop-blur-xl"
          >
            <div className="flex flex-col p-2">
              {/* ── VISTA INVITADO ── */}
              {!isAuthed && (
                <>
                  <div className="px-2.5 pb-2 pt-1">
                    <p className="text-sm font-semibold text-foreground">Tu cuenta</p>
                    <p className="text-xs text-muted-foreground">Ajustes y pedidos</p>
                  </div>

                  {/* Bloque destacado: seguimiento de pedido, con jerarquía visual
                      propia (borde + fondo acentuado) para que no se sienta plano. */}
                  <button
                    onClick={comingSoon}
                    className="group mb-1 flex items-center gap-3 rounded-xl border bg-primary/5 px-2.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
                    role="menuitem"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                      <HugeiconsIcon icon={TruckIcon} size={20} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">Rastrear mi pedido</span>
                      <span className="block text-xs text-muted-foreground">Consulta el estado de tu envío</span>
                    </span>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <button
                    onClick={comingSoon}
                    className={cn(ROW, "text-muted-foreground hover:bg-primary hover:text-foreground")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-primary text-muted-foreground group-hover:text-foreground")}>
                      <HugeiconsIcon icon={CustomerSupportIcon} size={16} strokeWidth={2} />
                    </span>
                    Ayuda y FAQs
                  </button>

                  <ThemeSwitch isDark={isDark} onToggle={toggleTheme} />

                  <div className="my-1 h-px bg-border" />

                  <Link
                    to={loginTo}
                    onClick={() => setIsOpen(false)}
                    className={cn(ROW, "text-primary hover:bg-primary/10")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-primary/15 text-primary")}>
                      <HugeiconsIcon icon={SquareLock02Icon} size={16} strokeWidth={2} />
                    </span>
                    Acceso Colaboradores
                  </Link>
                </>
              )}

              {/* ── VISTA ADMINISTRADOR / COLABORADOR ── */}
              {isAuthed && (
                <>
                  <div className="mb-1 flex items-center gap-3 rounded-xl bg-gradient-to-br from-primary/10 to-transparent px-2.5 py-3 border border-primary/10">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/20 text-base font-bold text-primary ring-1 ring-primary/30">
                      {initial}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        Hola, {firstName} {isAdmin && "👑"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
                    </span>
                  </div>

                  <Link
                    to="/admin"
                    onClick={() => setIsOpen(false)}
                    className={cn(ROW, "text-foreground hover:bg-primary")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-primary/15 text-primary")}>
                      <HugeiconsIcon icon={DashboardSquare01Icon} size={16} strokeWidth={2} />
                    </span>
                    Centro de Administración
                  </Link>

                  {isAdmin && isHome && (
                    <button
                      onClick={() => {
                        dispatch(toggleEditMode());
                        setIsOpen(false);
                      }}
                      className={cn(ROW, "hover:bg-primary", editMode ? "text-primary" : "text-foreground")}
                      role="menuitem"
                    >
                      <span
                        className={cn(
                          CHIP,
                          editMode ? "bg-primary/15 text-primary" : "bg-primary text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <HugeiconsIcon icon={Edit02Icon} size={16} strokeWidth={2} />
                      </span>
                      Modo Edición {editMode && "(Activo)"}
                    </button>
                  )}

                  <ThemeSwitch isDark={isDark} onToggle={toggleTheme} />

                  <div className="my-1 h-px bg-border" />

                  <button
                    onClick={handleLogout}
                    className={cn(ROW, "text-destructive hover:bg-destructive/10")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-destructive/15 text-destructive")}>
                      <HugeiconsIcon icon={Logout03Icon} size={16} strokeWidth={2} />
                    </span>
                    Cerrar Sesión
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
