# DESIGN.md — Gyro Store · Sistema de diseño **shadcn / style Rhea**

> **Reemplaza al sistema "Editorial Dark"** (teal de marca, escala Midnight, motion propio).
> Decisión del 2026-07-30: el proyecto adopta el preset oficial de shadcn (`b27GcrRo`) tal cual,
> en storefront y back-office. Este documento describe el sistema **vivo en el código**; si el
> código y este archivo divergen, se actualiza este archivo en el mismo PR.

---

## 0. En una frase

La apariencia **no se escribe en los componentes**: se hereda del style `Rhea` de shadcn. Los
componentes solo declaran estructura y semántica; el vestido vive en `app/style-rhea.css`.

---

## 1. De dónde sale cada cosa

| Capa | Archivo | Qué define |
|---|---|---|
| Primitivas | `app/components/ui/*.tsx` | Estructura, accesibilidad, `data-slot`, clases `.cn-*` |
| Style (apariencia) | `app/style-rhea.css` | Geometría, densidad, estados, sombras y anillos |
| Tokens (color) | `app/tailwind.css` → `@theme` | La paleta, en tokens semánticos |
| Puente shadcn | `app/tailwind.css` → `@theme inline` | Mapea `background/primary/muted/…` a los tokens |

**Regla base:** los componentes de `ui/` vienen del registry de shadcn (base `radix`) y se
modifican **lo mínimo**. Todo lo que sea apariencia va al style, no al `.tsx`.

---

## 2. Color — paleta **neutral** del preset

Escala de grises `oklch`, tomada de `apps/v4/app/globals.css` del repo `shadcn-ui/ui`
(base color `neutral`). **No hay color de marca en la UI.**

### Oscuro (default)

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `oklch(0.145 0 0)` | Fondo de la app |
| `--color-surface` | `oklch(0.205 0 0)` | Tarjetas, popovers, sidebar |
| `--color-surface-2` | `oklch(0.269 0 0)` | Superficie secundaria, `muted` |
| `--color-surface-hover` | `oklch(0.371 0 0)` | Hover/focus de ítems de menú |
| `--color-border` | `oklch(1 0 0 / 10%)` | Hairlines y anillos |
| `--color-accent` | `oklch(0.922 0 0)` | "Primary": CTA plano, **casi blanco** |
| `--color-text` | `oklch(0.985 0 0)` | Texto principal |
| `--color-muted` | `oklch(0.708 0 0)` | Texto secundario |

### Claro

Misma escala invertida: `bg`/`surface` en blanco, `accent` en `oklch(0.205 0 0)` (casi negro),
texto `oklch(0.145 0 0)`, muted `oklch(0.556 0 0)`.

### Series de gráficos

`--color-chart-1..5` → azules del preset. Los consume la primitiva `chart` (sobre Recharts).

### La única excepción de color

`--color-whatsapp` se mantiene en su **verde canónico** (`#25d366`). No es decorativo: identifica
el canal de contacto y el checkout. Vive en las variantes `whatsapp` / `whatsappOutline` de `Button`.

### Reglas de color

1. **Cero colores crudos de Tailwind** en componentes (`bg-slate-900`, `text-emerald-500`…).
   Todo sale de tokens semánticos.
2. El CTA plano lleva **texto oscuro** sobre el `accent` claro (`--color-primary-foreground`).
3. Nada de segundo acento decorativo. La jerarquía se hace con peso, tamaño y espacio.

---

## 3. Tipografía

**Inter** para todo (cuerpo y titulares), como fija el preset. La jerarquía se logra con
**tamaño y peso**, nunca con familias distintas. Cifras (precios, stock, contadores) siempre
`tabular-nums` / `.nums`.

---

## 4. Geometría y espaciado

La define Rhea, no nosotros:

- **Tarjetas** `rounded-[min(var(--radius-4xl),24px)]`, con `ring-1` en vez de borde duro y `shadow-sm`.
- **Controles** (botón, input, select, tabs) `rounded-2xl`, altura compacta `h-8` por defecto.
- **Popovers / menús** `rounded-2xl`, `shadow-lg`, `ring-1`.
- Tamaños de botón: `xs · sm · default · lg` + variantes `icon-*`.

---

## 5. Motion

- **Enter/exit de primitivas:** lo resuelve Rhea con `data-open` / `data-closed`
  (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`), vía `tw-animate-css`. Duración ~100ms.
- **Movimiento propio** (layout, listas, KPIs): `framer-motion`, con `layoutId` para indicadores
  que se deslizan y `stagger` corto (~0.04s) en listas.
- **`prefers-reduced-motion` es obligatorio** en toda animación propia (`useReducedMotion()` o
  `motion-reduce:*`). Sin excepción.

---

## 6. Iconografía

**Lucide**, como fija el preset. Los componentes del registry no importan iconos directamente:
usan `ui/icon-placeholder.tsx`, un shim que resuelve el placeholder del registry a `lucide-react`
con un **mapa explícito** (tree-shakeable). Si un componente nuevo pide un icono que no está en
el mapa, hay que agregarlo ahí. **Sin emojis** en UI de marca.

---

## 7. Componentes propios del storefront

Las primitivas son de shadcn; estas piezas son **nuestras** y siguen vigentes (su contrato no
cambia, solo se repintan con los tokens neutrales):

- **`ProductCard`** — panel `bg-surface`, foto en `product-stage` con blur-up y hover-swap,
  CTA siempre visible, dos layouts (`grid` / `list`). Si hay >1 variante abre `QuickAddSheet`.
- **`Hero`** — slider de slides editables desde el admin (`heroSlides` en `app_config`).
- **`ProductCarousel`** — scroll-snap + flechas que se deshabilitan en los extremos.
- **`CategoryChips`** — fila scrollable; subcategorías por portal + fixed.
- **`BrandStrip`** — wordmarks tipográficos, logo en gris → color al hover.
- **PDP** — galería sticky, specs en grilla con hairlines, descripción a 65ch, CTA + WhatsApp.

---

## 8. Anti-patrones (rechazar en review)

- ❌ Colores crudos de Tailwind en componentes.
- ❌ Escribir apariencia en el `.tsx` de una primitiva: va al style.
- ❌ Emojis en UI de marca.
- ❌ Glow, gradient-text, glassmorphism decorativo.
- ❌ Animaciones sin `prefers-reduced-motion`.
- ❌ Negro puro `#000000`.
- ❌ Diferenciar elementos **solo** por color.
- ❌ Copys de relleno ("Descubre el futuro", "Next-Gen").

---

## 9. Accesibilidad (piso, no opcional)

- Contraste: cuerpo ≥4.5:1, texto grande ≥3:1.
- Foco visible en todo interactivo (Rhea lo trae con `ring-3` + `ring-ring/30`).
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
