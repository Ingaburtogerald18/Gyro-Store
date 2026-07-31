# DESIGN.md — Gyro Store · Sistema de diseño **shadcn / style Maia**

> El proyecto adopta el preset oficial de shadcn `b3ae24HXW4` tal cual, en storefront y
> back-office: **style Maia · theme Emerald · charts Green · Figtree + Geist**.
> Este documento describe el sistema **vivo en el código**; si el código y este archivo
> divergen, se actualiza este archivo en el mismo PR.

---

## 0. En una frase

La apariencia **no se escribe en los componentes**: se hereda del style `Maia` de shadcn. Los
componentes solo declaran estructura y semántica; el vestido vive en `app/style-maia.css`.

---

## 1. De dónde sale cada cosa

| Capa | Archivo | Qué define |
|---|---|---|
| Primitivas | `app/components/ui/*.tsx` | Estructura, accesibilidad, `data-slot`, clases `.cn-*` |
| Style (apariencia) | `app/style-maia.css` | Geometría, densidad, estados, sombras y anillos |
| Tokens (color) | `app/tailwind.css` → `:root` / `[data-theme="dark"]` | La paleta, en tokens semánticos |
| Puente shadcn | `app/tailwind.css` → `@theme inline` | Mapea `--background`/`--primary`/… a `--color-*` |

**Regla base:** los componentes de `ui/` vienen del registry de shadcn (base `radix`) y se
modifican **lo mínimo**. Todo lo que sea apariencia va al style, no al `.tsx`.

`style-maia.css` se carga con un `@import "./style-maia.css"` desde `tailwind.css`, y la clase
`.style-maia` la pone `root.tsx` en el `<html>`. **Las dos cosas hacen falta**: sin el import, la
clase no tiene CSS detrás y el style entero queda sin aplicar (le pasó al `style-rhea` anterior).

---

## 2. Color — base **Mist** + theme **Emerald**

Tokens `oklch` del preset. Light en `:root`, dark en `[data-theme="dark"]` — la variante `dark:`
sigue a `data-theme`, no al `prefers-color-scheme` del sistema (lo controla `useTheme`).

| Token | Uso |
|---|---|
| `--background` / `--foreground` | Fondo y texto de la app |
| `--card` / `--popover` | Tarjetas, popovers, sidebar |
| `--muted` / `--muted-foreground` | Superficie secundaria y texto secundario |
| `--primary` | CTA y acento de marca (Emerald) |
| `--border` / `--input` / `--ring` | Hairlines, campos y anillos de foco |
| `--destructive` | Error y acciones destructivas |

En Tailwind se usan como `bg-background`, `text-muted-foreground`, `border-border`, etc. — nunca
la variable cruda.

### Series de gráficos

`--chart-1..5` es la escala **Green** del preset. La consume la primitiva `chart` (sobre Recharts).

### Extras que shadcn no trae

Viven en `tailwind.css` junto a los del preset, con valor por tema:

- `--whatsapp` — verde canónico del canal (`#128c3e` claro / `#25d366` oscuro). No es decorativo:
  identifica el contacto y el checkout. Se usa vía las variantes `whatsapp` / `whatsappOutline`
  de `Button`, nunca como hex suelto.
- `--promo` — violeta de la etiqueta de promoción. Variante `promo` de `Badge`.
- `--success` / `--warning` / `--info` — estados semánticos.
- `--tone-indigo|sky|amber|emerald|rose|purple|red` — los 7 acentos de `StatCard`.
  **No se mapean a `--chart-*`**: en este preset los charts son toda la escala Green y las
  tarjetas quedarían todas del mismo color.
- `--radius-card` (12px) y `--radius-pill` → clases `rounded-card` y `rounded-pill`.

### Reglas de color

1. **Cero colores crudos de Tailwind** en componentes (`bg-slate-900`, `text-emerald-500`…) y
   **cero hex arbitrarios** (`bg-[#25D366]`). Todo sale de tokens semánticos.
2. Nada de segundo acento decorativo. La jerarquía se hace con peso, tamaño y espacio.

---

## 3. Tipografía

Dos familias, servidas localmente con `@fontsource-variable` (sin Google Fonts):

- **Figtree** — cuerpo. Es `--font-sans`, o sea la fuente por defecto de la app.
- **Geist** — titulares. Es `--font-heading`, y se aplica con la clase `font-heading`.

Ambas se registran en `@theme inline`; registrar `--font-heading` ahí es justamente lo que hace
que Tailwind genere la clase `font-heading`. Cifras (precios, stock, contadores) siempre
`tabular-nums` / `.nums`.

---

## 4. Geometría y espaciado

La define Maia, no nosotros. Los radios y densidades salen del style; lo propio se limita a
`rounded-card` para las tarjetas del admin.

---

## 5. Motion

- **Enter/exit de primitivas:** lo resuelve Maia con `data-open` / `data-closed`
  (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`), vía `tw-animate-css`.
- **Movimiento propio** (layout, listas, KPIs): `framer-motion`, con `layoutId` para indicadores
  que se deslizan y `stagger` corto en listas.
- **`prefers-reduced-motion` es obligatorio** en toda animación propia (`useReducedMotion()` o
  `motion-reduce:*`). Sin excepción.

---

## 6. Iconografía

**HugeIcons**, vía `@hugeicons/react` + `@hugeicons/core-free-icons`. Lucide y Phosphor están
desinstalados; no se vuelven a agregar.

El patrón es distinto al de Lucide: HugeIcons expone **datos** (`IconSvgElement`), no componentes,
y **no dimensiona por `className`** — el tamaño va en la prop `size`, en px:

```tsx
import { HugeiconsIcon } from '@hugeicons/react';
import { ShoppingCart02Icon } from '@hugeicons/core-free-icons';

<HugeiconsIcon icon={ShoppingCart02Icon} size={16} strokeWidth={2} />
```

`className` **sí** sigue sirviendo para color y demás utilidades (`className="text-destructive"`).

Cuando un icono viaja como valor (una tabla de navegación, una prop `icon`), el tipo es
`IconSvgElement` y se renderiza con `<HugeiconsIcon icon={x} />` — no `<x />`. Así lo hacen
`stat-card.tsx` y el `NAV_GROUPS` de `admin.tsx`.

El spinner de carga está centralizado en `ui/spinner.tsx`; para un botón ocupado va
`disabled={isLoading}` + `{isLoading && <Spinner className="mr-2" />}`, no una prop `loading`.

**Sin emojis** en UI de marca.

---

## 7. Componentes propios del storefront

Las primitivas son de shadcn; estas piezas son **nuestras** y siguen vigentes:

- **`ProductCard`** — panel `bg-card`, foto en `product-stage` con blur-up y hover-swap,
  CTA siempre visible, dos layouts (`grid` / `list`).
- **`Hero`** — slider de slides editables desde el admin (`heroSlides` en `app_config`).
- **`ProductCarousel`** — scroll-snap + flechas que se deshabilitan en los extremos.
- **`QueryState`** — envuelve el patrón loading/error/vacío de los listados admin. Cada estado
  puede traer su propio fallback; si no, cae en uno genérico.
- **PDP** — galería sticky, specs en grilla con hairlines, descripción a 65ch, CTA + WhatsApp.

---

## 8. Anti-patrones (rechazar en review)

- ❌ Colores crudos de Tailwind (`text-amber-500`) o hex arbitrarios (`bg-[#25D366]`).
- ❌ Escribir apariencia en el `.tsx` de una primitiva: va al style.
- ❌ Importar `lucide-react` o `@phosphor-icons/react`.
- ❌ Dimensionar un icono de HugeIcons con `h-4 w-4` en vez de `size={16}`.
- ❌ Props custom en primitivas del registry (`<Button loading>`, `<Input options>`): el próximo
  `shadcn add --overwrite` se las lleva. Se resuelve en el call site.
- ❌ Dos `className` en el mismo tag: React se queda con el último y el otro se pierde en silencio.
- ❌ Emojis en UI de marca.
- ❌ Glow, gradient-text, glassmorphism decorativo.
- ❌ Animaciones sin `prefers-reduced-motion`.
- ❌ Negro puro `#000000`.
- ❌ Diferenciar elementos **solo** por color.
- ❌ Copys de relleno ("Descubre el futuro", "Next-Gen").

---

## 9. Accesibilidad (piso, no opcional)

- Contraste: cuerpo ≥4.5:1, texto grande ≥3:1.
- Foco visible en todo interactivo (Maia lo trae con `ring-3` + `ring-ring/30`).
- `prefers-reduced-motion` respetado.
- Touch targets ≥44px.
- `alt` significativo en fotos; decorativas `aria-hidden`.

---

## 10. Deuda / pendientes

- **Nombres propios ya resueltos**: `stat-card.tsx` exporta `SpotlightCard`/`SectionHeader`
  (antes `Card`/`CardHeader`, que chocaban con la primitiva `card.tsx`). Regla: lo nuestro
  lleva nombre propio, nunca el de una primitiva del registry.
- **`createdAt` real en productos** para "Lo Más Nuevo".
- **Marcas y logos reales** en `/public/brands`.
