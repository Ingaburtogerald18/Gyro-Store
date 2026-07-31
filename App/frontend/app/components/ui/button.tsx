import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "cn-button group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // ── Variantes del style Rhea (la apariencia vive en style-rhea.css) ──
        default: "cn-button-variant-default",
        outline: "cn-button-variant-outline",
        secondary: "cn-button-variant-secondary",
        ghost: "cn-button-variant-ghost",
        destructive: "cn-button-variant-destructive",
        link: "cn-button-variant-link",

        // ── Variantes de marca (Gyro) ──
        // No existen en el registry: se conservan porque el storefront las usa
        // y comunican significado (el verde de WhatsApp no es decorativo).
        // Se pintan con tokens, así siguen la piel activa (store teal / admin neutral).
        accent:
          "border border-accent/50 text-accent hover:border-accent hover:bg-accent/10",
        whatsapp:
          "border border-whatsapp/30 bg-whatsapp/10 text-whatsapp hover:bg-whatsapp/20 focus-visible:ring-whatsapp/60",
        whatsappOutline:
          "border border-whatsapp/50 text-whatsapp hover:border-whatsapp hover:bg-whatsapp/10 focus-visible:ring-whatsapp/60",
        onMedia:
          "bg-white/90 text-bg hover:bg-white disabled:hover:bg-white/90",
        onSurface:
          "text-white/60 hover:bg-white/10 hover:text-white disabled:hover:bg-transparent",
      },
      size: {
        default: "cn-button-size-default",
        xs: "cn-button-size-xs",
        sm: "cn-button-size-sm",
        lg: "cn-button-size-lg",
        icon: "cn-button-size-icon",
        "icon-xs": "cn-button-size-icon-xs",
        "icon-sm": "cn-button-size-icon-sm",
        "icon-lg": "cn-button-size-icon-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Deshabilita el botón y muestra un spinner antes del contenido. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <svg
          className="size-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
        </svg>
      )}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  )
}

export { Button, buttonVariants }
