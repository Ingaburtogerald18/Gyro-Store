import * as React from "react"

import { cn } from "~/lib/utils"

function Input({
  className,
  type,
  options,
  ...props
}: React.ComponentProps<"input"> & {
  /** Sugerencias de autocompletado (ej. lotes/nombres ya usados) vía `<datalist>` nativo. */
  options?: string[]
}) {
  // Un `<datalist>` necesita un id estable para que `list` lo referencie.
  const listId = React.useId()

  return (
    <>
      <input
        type={type}
        data-slot="input"
        list={options?.length ? listId : undefined}
        className={cn(
          "cn-input w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {options && options.length > 0 && (
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      )}
    </>
  )
}

export { Input }
