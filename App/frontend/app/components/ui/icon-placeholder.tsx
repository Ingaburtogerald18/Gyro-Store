/**
 * IconPlaceholder — puente hacia lucide-react.
 *
 * Los componentes del registry de shadcn (base `radix`) no importan iconos
 * directamente: usan este placeholder, que en el sitio de shadcn permite
 * cambiar de librería en vivo (lucide / tabler / hugeicons / phosphor /
 * remixicon). Acá la librería está fijada en **Lucide**, como define el preset.
 *
 * Los nombres se resuelven con un mapa explícito (no `import * as lucide`)
 * para que el bundler siga haciendo tree-shaking: son 16 iconos, no los ~1.500
 * del paquete completo. Si un componente nuevo del registry pide otro icono,
 * hay que sumarlo acá.
 */
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  MinusIcon,
  MoreHorizontalIcon,
  OctagonXIcon,
  PanelLeftIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  ArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  MinusIcon,
  MoreHorizontalIcon,
  OctagonXIcon,
  PanelLeftIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
};

type IconPlaceholderProps = {
  lucide: string;
  /* Las demás librerías se aceptan y se ignoran: los componentes del registry
     las pasan siempre, y quitarlas obligaría a editar cada archivo. */
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
} & React.ComponentProps<'svg'>;

export function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...props
}: IconPlaceholderProps) {
  const Icon = ICONS[lucide];

  if (!Icon) {
    if (import.meta.env.DEV) {
      console.warn(`[IconPlaceholder] icono no mapeado: "${lucide}". Agregalo en ui/icon-placeholder.tsx`);
    }
    return null;
  }

  return <Icon {...props} />;
}
