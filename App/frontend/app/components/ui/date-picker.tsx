import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/lib/utils';

/**
 * Selector de fecha de marca (Calendar + Popover), en reemplazo del <input
 * type="date"> nativo — que se ve distinto en cada navegador y no combina con
 * el tema. El valor viaja como 'yyyy-MM-dd', lo que espera el backend.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'Elegí una fecha',
  disabled,
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = value ? parseLocalYmd(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-2 font-normal border-border bg-card shadow-sm transition-all hover:bg-accent focus-visible:ring-primary',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {selected ? format(selected, "d 'de' MMMM, yyyy", { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => date && onChange(toYmd(date))}
          locale={es}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// 'yyyy-MM-dd' → Date LOCAL. `new Date('yyyy-MM-dd')` se interpreta como UTC y
// puede correr un día según la zona horaria; parseando a mano se evita.
function parseLocalYmd(ymd: string): Date | undefined {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toYmd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}
