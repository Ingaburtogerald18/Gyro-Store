import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Moon,
  Sun,
  LayoutDashboard,
  Pencil,
  LogOut,
  Truck,
  LifeBuoy,
  KeyRound,
  ChevronRight,
} from "lucide-react";
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
    <div className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-hover/50 transition-colors cursor-pointer" onClick={onToggle}>
      <span className="flex items-center gap-3 text-sm font-medium text-text cursor-pointer">
        <span className={cn(CHIP, "bg-surface-hover text-accent")}>
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </span>
        Apariencia
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={`Cambiar a tema ${isDark ? "claro" : "oscuro"}`}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isDark ? "border-accent bg-accent" : "border-border bg-surface-hover",
        )}
      >
        <motion.span
          aria-hidden
          animate={{ x: isDark ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute left-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow"
        >
          {isDark ? (
            <Moon className="h-3 w-3 text-accent" />
          ) : (
            <Sun className="h-3 w-3 text-warning" />
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
          "relative grid h-10 w-10 place-items-center rounded-full border shadow-sm backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isAuthed
            ? "border-accent/30 bg-accent/10 hover:bg-accent/15"
            : "border-border bg-surface-hover text-muted hover:border-accent/40 hover:text-text",
        )}
        aria-label="Menú de cuenta y configuración"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isAuthed ? (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent ring-1 ring-accent/30">
            {initial}
          </span>
        ) : (
          <User className="h-5 w-5" />
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
            className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface shadow-xl backdrop-blur-xl"
          >
            <div className="flex flex-col p-2">
              {/* ── VISTA INVITADO ── */}
              {!isAuthed && (
                <>
                  <div className="px-2.5 pb-2 pt-1">
                    <p className="text-sm font-semibold text-text">Tu cuenta</p>
                    <p className="text-xs text-muted">Ajustes y pedidos</p>
                  </div>

                  {/* Bloque destacado: seguimiento de pedido, con jerarquía visual
                      propia (borde + fondo acentuado) para que no se sienta plano. */}
                  <button
                    onClick={comingSoon}
                    className="group mb-1 flex items-center gap-3 rounded-xl border border-border bg-accent/5 px-2.5 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/10"
                    role="menuitem"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                      <Truck className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text">Rastrear mi pedido</span>
                      <span className="block text-xs text-muted">Consulta el estado de tu envío</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <button
                    onClick={comingSoon}
                    className={cn(ROW, "text-muted hover:bg-surface-hover hover:text-text")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-surface-hover text-muted group-hover:text-text")}>
                      <LifeBuoy className="h-4 w-4" />
                    </span>
                    Ayuda y FAQs
                  </button>

                  <ThemeSwitch isDark={isDark} onToggle={toggleTheme} />

                  <div className="my-1 h-px bg-border" />

                  <Link
                    to={loginTo}
                    onClick={() => setIsOpen(false)}
                    className={cn(ROW, "text-accent hover:bg-accent/10")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-accent/15 text-accent")}>
                      <KeyRound className="h-4 w-4" />
                    </span>
                    Acceso Colaboradores
                  </Link>
                </>
              )}

              {/* ── VISTA ADMINISTRADOR / COLABORADOR ── */}
              {isAuthed && (
                <>
                  <div className="mb-1 flex items-center gap-3 rounded-xl bg-gradient-to-br from-accent/10 to-transparent px-2.5 py-3 border border-accent/10">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 text-base font-bold text-accent ring-1 ring-accent/30">
                      {initial}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text">
                        Hola, {firstName} {isAdmin && "👑"}
                      </span>
                      <span className="block truncate text-xs text-muted">{roleLabel}</span>
                    </span>
                  </div>

                  <Link
                    to="/admin"
                    onClick={() => setIsOpen(false)}
                    className={cn(ROW, "text-text hover:bg-surface-hover")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-accent/15 text-accent")}>
                      <LayoutDashboard className="h-4 w-4" />
                    </span>
                    Centro de Administración
                  </Link>

                  {isAdmin && isHome && (
                    <button
                      onClick={() => {
                        dispatch(toggleEditMode());
                        setIsOpen(false);
                      }}
                      className={cn(ROW, "hover:bg-surface-hover", editMode ? "text-accent" : "text-text")}
                      role="menuitem"
                    >
                      <span
                        className={cn(
                          CHIP,
                          editMode ? "bg-accent/15 text-accent" : "bg-surface-hover text-muted group-hover:text-text",
                        )}
                      >
                        <Pencil className="h-4 w-4" />
                      </span>
                      Modo Edición {editMode && "(Activo)"}
                    </button>
                  )}

                  <ThemeSwitch isDark={isDark} onToggle={toggleTheme} />

                  <div className="my-1 h-px bg-border" />

                  <button
                    onClick={handleLogout}
                    className={cn(ROW, "text-danger hover:bg-danger/10")}
                    role="menuitem"
                  >
                    <span className={cn(CHIP, "bg-danger/15 text-danger")}>
                      <LogOut className="h-4 w-4" />
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
