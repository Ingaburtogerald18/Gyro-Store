import { AnimatedIcon } from "~/components/ui/animated-icons"
import { Loading03Icon } from "@hugeicons/core-free-icons"

import { cn } from "~/lib/utils"

// `strokeWidth` se excluye: en los props de <svg> es string | number, pero
// AnimatedIcon solo acepta number — y acá ya se fija más abajo.
//
// `gesture="none"` a propósito: el giro ya lo hace `animate-spin` (CSS puro,
// compositor, cero JS). Dejar además el gesto `spin` de framer-motion pondría
// dos transforms peleando por el mismo <svg> y el resultado depende del frame.
// Es el único icono del sistema que anima en bucle, y conviene que sea el
// mecanismo barato.
function Spinner({ className, ...props }: Omit<React.ComponentProps<"svg">, "strokeWidth">) {
  return (
    <AnimatedIcon
      icon={Loading03Icon}
      gesture="none"
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
