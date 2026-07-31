// Menú de acciones de fila ("⋯"): un botón discreto que abre un dropdown con acciones
// etiquetadas. Reemplaza los clusters de iconos / columnas "Acciones" en las tablas.
// Se renderiza en portal (position:fixed) para que el overflow de la tabla no lo recorte.
// Convención del proyecto: dejar visible el CTA principal del flujo y mandar aquí las
// acciones secundarias (editar, eliminar, etc.).
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "~/lib/utils";

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Si se pasa, el ítem es un enlace externo (<a target="_blank">). */
  href?: string;
  /** Estilo destructivo (rojo). */
  danger?: boolean;
  disabled?: boolean;
  /** Dibuja un separador arriba del ítem (para agrupar). */
  separatorBefore?: boolean;
}

// Acepta cualquier valor falsy (false, "", 0, null, undefined) para poder incluir
// acciones condicionalmente con `cond && {...}` sin ensuciar el JSX.
type MaybeAction = RowAction | false | "" | 0 | null | undefined;

export function RowActionsMenu({ actions, className }: { actions: MaybeAction[]; className?: string }) {
  const items = actions.filter(Boolean) as RowAction[];
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const W = 216;

  function compute() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const H = Math.max(120, items.length * 40 + 16);
    let top = r.bottom + 6;
    if (top + H > window.innerHeight && r.top - H - 6 > 0) top = r.top - H - 6;
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    setCoords({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    compute();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title="Acciones"
        aria-label="Acciones"
        className={cn(
          "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
          className,
        )}
      >
        <HugeiconsIcon icon={MoreVerticalIcon} size={16} strokeWidth={2} />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: coords.top, left: coords.left, width: W }}
                className="z-[100] flex flex-col gap-0.5 rounded-card border bg-card p-1 shadow-2xl"
              >
                {items.map((a, i) => {
                  const cls = cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    a.disabled
                      ? "cursor-not-allowed opacity-40"
                      : a.danger
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  );
                  return (
                    <div key={i}>
                      {a.separatorBefore && <div className="my-0.5 border-t border/60" />}
                      {a.href ? (
                        <a href={a.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={cls}>
                          {a.icon}
                          {a.label}
                        </a>
                      ) : (
                        <button
                          disabled={a.disabled}
                          onClick={() => { if (a.disabled) return; setOpen(false); a.onClick?.(); }}
                          className={cn(cls, "w-full")}
                        >
                          {a.icon}
                          {a.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
