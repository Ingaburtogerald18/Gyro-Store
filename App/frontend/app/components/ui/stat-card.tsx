import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "~/lib/utils";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { CountUp } from "./CountUp";

export type SpotlightCardVariant = "default" | "interactive" | "highlight";

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SpotlightCardVariant;
  /** Radio del resplandor en px (solo para variant="highlight"). */
  spotlightRadius?: number;
  /** Intensidad del color de acento (0–100) (solo para variant="highlight"). */
  spotlightIntensity?: number;
}

export function SpotlightCard({
  variant = "default",
  spotlightRadius = 360,
  spotlightIntensity = 16,
  className,
  children,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (variant !== "highlight" || reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
  }

  const baseStyles = "rounded-card border bg-card shadow-lg transition-all duration-300 hover:shadow-2xl hover:border/80 hover:-translate-y-1";
  
  if (variant === "highlight") {
    return (
      <div
        ref={ref}
        onMouseMove={onMouseMove}
        className={cn("group/spot relative overflow-hidden", baseStyles, className)}
        {...props}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300",
            !reduce && "group-hover/spot:opacity-100",
          )}
          style={{
            background: `radial-gradient(${spotlightRadius}px circle at var(--spot-x, -9999px) var(--spot-y, -9999px), color-mix(in srgb, var(--color-accent) ${spotlightIntensity}%), transparent 65%)`,
          }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        baseStyles,
        variant === "interactive" && "transition-colors hover:border-white/10 hover:bg-primary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── StatCard unificado (mantiene su nombre y Props para retrocompatibilidad) ──
export type StatCardColor = "neutral" | "indigo" | "sky" | "amber" | "emerald" | "rose" | "purple" | "red";

const BASE_STAT = "bg-muted/30 border hover:border-white/10";
const COLOR_MAP: Record<StatCardColor, { card: string; icon: string; label: string; value: string }> = {
  neutral: { card: BASE_STAT, icon: "stat-card-icon text-muted-foreground", label: "text-muted-foreground/90", value: "text-foreground" },
  indigo: { card: `${BASE_STAT} hover:border-tone-indigo/30`, icon: "stat-card-icon text-tone-indigo", label: "text-muted-foreground/90", value: "text-tone-indigo" },
  sky: { card: `${BASE_STAT} hover:border-tone-sky/30`, icon: "stat-card-icon text-tone-sky", label: "text-muted-foreground/90", value: "text-tone-sky" },
  amber: { card: `${BASE_STAT} hover:border-tone-amber/30`, icon: "stat-card-icon text-tone-amber", label: "text-muted-foreground/90", value: "text-tone-amber" },
  emerald: { card: `${BASE_STAT} hover:border-primary/30`, icon: "stat-card-icon text-tone-emerald", label: "text-muted-foreground/90", value: "text-tone-emerald" },
  rose: { card: `${BASE_STAT} hover:border-tone-rose/30`, icon: "stat-card-icon text-tone-rose", label: "text-muted-foreground/90", value: "text-tone-rose" },
  purple: { card: `${BASE_STAT} hover:border-tone-purple/30`, icon: "stat-card-icon text-tone-purple", label: "text-muted-foreground/90", value: "text-tone-purple" },
  red: { card: `${BASE_STAT} hover:border-tone-red/30`, icon: "stat-card-icon text-tone-red", label: "text-muted-foreground/90", value: "text-tone-red" },
};

export function StatCard({
  icon: Icon, label, value, sub, hint, accent = false, color, countTo, format, delay = 0,
}: {
  icon?: IconSvgElement; label: string; value?: string | number; sub?: string; hint?: string; accent?: boolean; color?: StatCardColor; countTo?: number; format?: (n: number) => string; delay?: number;
}) {
  const reduce = useReducedMotion();
  const chosenColor = color || (accent ? "indigo" : "neutral");
  const theme = COLOR_MAP[chosenColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay }}
      data-tone={chosenColor}
      title={hint}
      className={`stat-card-container rounded-card border transition-colors duration-300 ${theme.card}`}
    >
      <SpotlightCard variant="highlight" className="p-4 shadow-none bg-transparent border-none">
        <div className="flex items-center gap-2">
          {Icon && <HugeiconsIcon icon={Icon} size={16} strokeWidth={2} className={theme.icon} />}
          <span className={`stat-card-label text-xs uppercase tracking-wide font-medium ${theme.label}`}>{label}</span>
        </div>
        <p className={`stat-card-value nums mt-2 font-heading text-2xl font-bold ${theme.value}`}>
          {countTo !== undefined ? <CountUp value={countTo} format={format} /> : value}
        </p>
        {sub && <p className="nums mt-0.5 text-sm font-medium text-muted-foreground">{sub}</p>}
      </SpotlightCard>
    </motion.div>
  );
}
