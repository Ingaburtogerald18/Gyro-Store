// Barrel export de los iconos animados itshover-style.
//
// ── Cuál usar ──
// `AnimatedIcon` es el caso general: sirve para CUALQUIER icono de HugeIcons y
// es el reemplazo directo de `HugeiconsIcon` en todo el proyecto.
//
//   import { AnimatedIcon } from '~/components/ui/animated-icons';
//   <AnimatedIcon icon={Wallet01Icon} size={16} strokeWidth={2} />
//
// Los cuatro bespoke (Bell, Cart, Check, Heart) llevan coreografía propia,
// dibujada a mano, y se reservan a los momentos donde eso vale la pena: la
// campana de notificaciones, el carrito y el check de "venta aprobada". Para
// todo lo demás va `AnimatedIcon`, que además conserva el trazo exacto de
// HugeIcons en lugar de aproximarlo.
export { AnimatedIcon } from './animated-icon';
export type { AnimatedIconRendererProps } from './animated-icon';

export { AnimatedBell } from './animated-bell';
export { AnimatedCart } from './animated-cart';
export { AnimatedCheck } from './animated-check';

export type {
  AnimatedIconHandle,
  AnimatedIconProps,
  IconGesture,
  IconTrigger,
} from './types';
