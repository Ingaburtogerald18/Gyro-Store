// Paleta de comandos global del admin (⌘K).
//
// ── Por qué ──
// Con doce módulos, la velocidad de operación es una feature. Llegar a
// "registrar una venta" desde Configuración son hoy tres clics y dos cambios de
// pantalla; acá son dos teclas y una palabra.
//
// ── Por qué las acciones NAVEGAN en vez de abrir el diálogo en el lugar ──
// "Registrar venta" desde cualquier módulo tendría que abrir el `SaleEditor`
// encima de la pantalla actual, y eso exige subir el estado de todos los
// diálogos a un store global — mucha arquitectura para poco. En vez de eso,
// cada acción navega a su módulo con un query param (`?nueva=1`) que la ruta
// interpreta. Efecto secundario útil: la acción queda ENLAZABLE, así que la
// campana de notificaciones o un mensaje de WhatsApp pueden apuntar a ella.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  Add01Icon,
  Coupon01Icon,
  CreditCardIcon,
  DashboardSquare01Icon,
  File01Icon,
  Package01Icon,
  PackageIcon,
  Settings02Icon,
  ShoppingCart02Icon,
  UserSettings01Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons';

import { AnimatedIcon } from '~/components/ui/animated-icons';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '~/components/ui/command';

interface PaletteEntry {
  id: string;
  label: string;
  icon: IconSvgElement;
  to: string;
  /** Solo admin. Misma regla que el nav — y el backend igual manda. */
  adminOnly?: boolean;
  shortcut?: string;
}

// Acciones: abren el formulario del módulo vía query param.
const ACTIONS: PaletteEntry[] = [
  { id: 'nueva-venta', label: 'Registrar venta', icon: ShoppingCart02Icon, to: '/admin/ventas?nueva=1' },
  { id: 'nueva-compra', label: 'Ingresar lote de compra', icon: PackageIcon, to: '/admin/inventario?nueva=1', adminOnly: true },
  { id: 'nueva-factura', label: 'Emitir factura', icon: File01Icon, to: '/admin/facturacion?nueva=1', adminOnly: true },
  { id: 'nuevo-producto', label: 'Nuevo producto', icon: Package01Icon, to: '/admin/catalogo?nuevo=1', adminOnly: true },
  { id: 'nuevo-codigo', label: 'Crear código de descuento', icon: Coupon01Icon, to: '/admin/codigos-descuento?nuevo=1', adminOnly: true },
];

// Navegación: el mismo orden que el sidebar, con su atajo `g` + número.
const DESTINATIONS: PaletteEntry[] = [
  { id: 'go-reporteria', label: 'Reportería', icon: DashboardSquare01Icon, to: '/admin', adminOnly: true, shortcut: 'g 1' },
  { id: 'go-inventario', label: 'Inventario', icon: PackageIcon, to: '/admin/inventario', adminOnly: true, shortcut: 'g 2' },
  { id: 'go-ventas', label: 'Ventas', icon: ShoppingCart02Icon, to: '/admin/ventas', shortcut: 'g 3' },
  { id: 'go-cuotas', label: 'Cuotas', icon: CreditCardIcon, to: '/admin/cuotas', adminOnly: true, shortcut: 'g 4' },
  { id: 'go-caja', label: 'Caja y banco', icon: Wallet01Icon, to: '/admin/caja', adminOnly: true, shortcut: 'g 5' },
  { id: 'go-catalogo', label: 'Catálogo', icon: Package01Icon, to: '/admin/catalogo', adminOnly: true, shortcut: 'g 6' },
  { id: 'go-facturacion', label: 'Facturación', icon: File01Icon, to: '/admin/facturacion', adminOnly: true, shortcut: 'g 7' },
  { id: 'go-descuentos', label: 'Códigos de descuento', icon: Coupon01Icon, to: '/admin/codigos-descuento', adminOnly: true, shortcut: 'g 8' },
  { id: 'go-personal', label: 'Personal', icon: UserSettings01Icon, to: '/admin/usuarios', shortcut: 'g 9' },
  { id: 'go-configuracion', label: 'Configuración', icon: Settings02Icon, to: '/admin/configuracion', adminOnly: true },
];

const RECENTS_KEY = 'gyro.palette.recents';

function readRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function CommandPalette({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const [recents, setRecents] = useState<string[]>([]);

  // En un efecto y no en el estado inicial: `localStorage` no existe en el
  // server y devolver algo distinto en el primer render rompe la hidratación.
  useEffect(() => setRecents(readRecents()), [open]);

  const all = useMemo(() => [...ACTIONS, ...DESTINATIONS], []);
  const visible = (e: PaletteEntry) => !e.adminOnly || isAdmin;

  function run(entry: PaletteEntry) {
    const next = [entry.id, ...recents.filter((r) => r !== entry.id)].slice(0, 5);
    try {
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Storage bloqueado: la navegación funciona igual, solo no se recuerda.
    }
    onOpenChange(false);
    navigate(entry.to);
  }

  const recentEntries = recents
    .map((id) => all.find((e) => e.id === id))
    .filter((e): e is PaletteEntry => !!e && visible(e));

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Paleta de comandos"
      description="Buscá un módulo o una acción"
    >
      <CommandInput placeholder="Buscar módulo o acción…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        {recentEntries.length > 0 && (
          <>
            <CommandGroup heading="Recientes">
              {recentEntries.map((e) => (
                <CommandItem key={`r-${e.id}`} value={`reciente ${e.label}`} onSelect={() => run(e)}>
                  <AnimatedIcon icon={e.icon} gesture="none" size={16} strokeWidth={2} className="mr-2" />
                  {e.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Acciones">
          {ACTIONS.filter(visible).map((e) => (
            <CommandItem key={e.id} value={e.label} onSelect={() => run(e)}>
              <AnimatedIcon icon={Add01Icon} gesture="none" size={16} strokeWidth={2} className="mr-2 text-primary" />
              {e.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ir a">
          {DESTINATIONS.filter(visible).map((e) => (
            <CommandItem key={e.id} value={e.label} onSelect={() => run(e)}>
              <AnimatedIcon icon={e.icon} gesture="none" size={16} strokeWidth={2} className="mr-2" />
              {e.label}
              {e.shortcut && <CommandShortcut>{e.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Destinos de `g` + número, en el mismo orden que el sidebar. */
export const HOTKEY_DESTINATIONS = DESTINATIONS.filter((d) => d.shortcut).map((d) => ({
  to: d.to,
  adminOnly: d.adminOnly ?? false,
}));
