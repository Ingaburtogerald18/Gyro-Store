import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

import { cn } from "~/lib/utils"

// `strokeWidth` se excluye: en los props de <svg> es string | number, pero
// HugeiconsIcon solo acepta number — y acá ya se fija más abajo.
function Spinner({ className, ...props }: Omit<React.ComponentProps<"svg">, "strokeWidth">) {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      size={16}
      strokeWidth={2}
      className={cn("animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
