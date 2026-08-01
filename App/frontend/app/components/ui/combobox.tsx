import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkBadge01Icon } from "@hugeicons/core-free-icons"

import { cn } from "~/lib/utils"
import { Input } from "~/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** Ignorado en esta versión (el input siempre es libre), pero mantenido por compatibilidad */
  allowCustom?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
  id,
  "aria-invalid": ariaInvalid,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Filtrado manual para las sugerencias
  const visibleOptions = React.useMemo(() => {
    if (!value.trim()) return options.slice(0, 40)
    const lower = value.toLowerCase()
    return options.filter((o) => o.toLowerCase().includes(lower)).slice(0, 40)
  }, [options, value])

  const exactMatch = options.some((o) => o.toLowerCase() === value.trim().toLowerCase())
  const showOptions = visibleOptions.length > 0 && !exactMatch && open;

  return (
    <Popover open={showOptions} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input 
            id={id}
            value={value}
            onChange={(e) => {
               onChange(e.target.value);
               setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={ariaInvalid}
            role="combobox"
            autoComplete="off"
            className="w-full"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start" 
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList id={id ? `${id}-listbox` : undefined}>
            <CommandEmpty>No hay sugerencias.</CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className="gap-2"
                >
                  <span className="truncate flex-1">{option}</span>
                  {value === option && (
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} size={16} className="shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
