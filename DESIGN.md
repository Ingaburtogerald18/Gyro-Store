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

### La excepción: `forwardRef` en los controles de formulario

`Input`, `Textarea` y `NativeSelect` están envueltos en `React.forwardRef`. **No es un
capricho ni una prop custom: es compatibilidad con React 18.** El registry de shadcn ya asume
React 19, donde `ref` viaja como una prop normal; este proyecto está en `react@18.3.1`, cuyo
jsx runtime intercepta `ref` del spread antes de que llegue al componente
(`react-jsx-runtime.development.js` → `hasValidRef`). En un componente de función sin
`forwardRef` eso significa que `<Input {...register("x")} />` registra el `onChange` pero
**nunca el nodo del DOM**: `reset()` y `setValue()` de react-hook-form dejan de escribir en el
campo — típicamente un modal de edición que abre con los campos en blanco.

Cada `shadcn add --overwrite` sobre estos tres archivos se lleva el `forwardRef`. Hay que
volver a ponerlo, o migrar el proyecto a React 19.

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
- `--success` / `--warning` / `--info` — estados semánticos. **Tienen valor distinto por
  tema y no es simetría decorativa**: los tres se usan también como color de *texto*, así que
  en claro van oscuros (L≈0.52) para pasar 4.5:1 contra `--background`, y en oscuro van claros
  (L≈0.72–0.8). Medidos contra el fondo de cada tema: warning 5.65 / 10.4, success 5.19 / 9.6,
  info 5.46 / 8.9. Antes los tres compartían el tono pensado para oscuro y sobre blanco daban
  2.54, 3.28 y 3.91 — por debajo del piso de §9. **Si se retoca alguno, se recalcula el
  contraste; no se elige a ojo.**
- `--tone-indigo|sky|amber|emerald|rose|purple|red` — los 7 acentos de `StatCard`.
  **No se mapean a `--chart-*`**: en este preset los charts son toda la escala Green y las
  tarjetas quedarían todas del mismo color.
- `--radius-card` (12px) y `--radius-pill` → clases `rounded-card` y `rounded-pill`.

### Reglas de color

1. **Cero colores crudos de Tailwind** en componentes (`bg-slate-900`, `text-emerald-500`…) y
   **cero hex arbitrarios** (`bg-[#25D366]`). Todo sale de tokens semánticos.
2. Nada de segundo acento decorativo. La jerarquía se hace con peso, tamaño y espacio.
3. `border` es utilidad de *grosor*, no de color: `border/50` no genera nada. El color con
   alfa se escribe entero — `border-border/50`, `border-warning/30`.
4. **Semántica de color en tarjetas de KPI (`StatCard`)**: El color (`tone-*`) debe indicar el tipo de dato, de forma consistente en todo el módulo. La convención es:
   - `indigo`: Conteos de unidades, cantidades y stock.
   - `sky`: Costos, egresos e impuestos (salidas de dinero esperadas).
   - `emerald`: Ingresos, valores totales con envío y ganancias.
   - `rose`: Alertas, métricas críticas o negativos (ej. artículos agotados).
   Nunca usar dos colores para el mismo tipo de dato. Evitar usar todos los colores disponibles (ej. `amber`, `purple`, `red`) si no aportan un significado distinto; un esquema de 4 colores consolida y ordena la vista.

---

## 3. Tipografía

Dos familias, servidas localmente con `@fontsource-variable` (sin Google Fonts):

- **Figtree** — cuerpo. Es `--font-sans`, o sea la fuente por defecto de la app.
- **Geist** — titulares. Es `--font-heading`, y se aplica con la clase `font-heading`.

Ambas se registran en `@theme inline`; registrar `--font-heading` ahí es justamente lo que hace
que Tailwind genere la clase `font-heading`. Cifras (precios, stock, contadores) siempre
`tabular-nums` / `.nums`. En `DataTable`, las celdas con `meta.align === "right"` aplican
automáticamente `tabular-nums` para alinear columnas numéricas. Si se requiere más carácter
en las tablas, se puede sumar `font-heading` a esa misma regla.

### Formato de cifras — una sola puerta

Todo monto sale de `app/lib/formatters.ts`. **Nunca se formatea a mano en el componente**
(`toFixed(2)`, `` `C$ ${x}` ``, `toLocaleString` suelto): eso fue lo que produjo tres estilos de
dinero distintos conviviendo en el panel.

| Función | Para qué |
|---|---|
| `formatNumber(n, decimals)` | Cifra pelada con separador de miles. Base de las demás. |
| `formatCordobas(n, symbol?, decimals?)` | Córdobas. `decimals` es 0 por defecto (storefront, totales) y 2 donde el módulo maneja centavos (caja, facturación, costos de inventario). |
| `formatUsd(n, max?, min?)` | Dólares (compras a China). |
| `formatByCurrency(n, code, decimals?)` | Cuando la moneda es dato (Caja y Bancos guarda `"NIO"` / `"USD"` por cuenta). Devuelve símbolo, no el código pegado al número. |
| `cordobasFromUsd(n)` | Conversión + formato para los `sub` de las StatCard. |
| `roundTo(n, decimals?)` | Redondeo de **cálculo**, no de presentación. |

Si un caso no encaja, se extiende ese archivo — no se formatea en el call site.

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

## 6b. Formularios

### Un solo estado: react-hook-form + zodResolver

**Ningún formulario del panel maneja su estado con `useState`.** Todos son
`useForm` + `zodResolver`, y el schema sale de `App/shared/schemas.ts` — el mismo
contrato que valida el backend. No se escriben reglas nuevas que lo dupliquen.

Cuando el formulario pide menos de lo que el endpoint recibe, el schema se
**deriva** (`.omit()` / `.extend()`), no se reescribe. Ej.: el diálogo de compra de
`admin.inventario` es `newPurchaseInputSchema.omit({ code, suggestedPrice })` —
`code` lo asigna el servidor.

Los `<input>` devuelven **string** y los schemas del backend esperan **number**.
El envoltorio es `z.preprocess(emptyToNaN, z.coerce.number())`: un campo vacío
tiene que fallar, no convertirse en `0` (que `z.coerce.number()` aceptaría en
silencio). El tipo de ENTRADA del formulario (`z.input<typeof schema>`) no es el
de salida; RHF necesita los dos.

Si una regla de negocio es del front y no del backend (ej. "el precio de oferta
debe ser menor al de todas las variantes"), va como `.superRefine()` sobre el
schema del backend con `path: ['campo']`. Así sale como error **del campo** sin
inventar un contrato paralelo.

### Un solo campo: la familia `Field`

`components/ui/field.tsx` es LA forma de componer un campo. Nada de
`<div className="space-y-2"><Label/><Input/></div>`:

```tsx
<Field data-invalid={!!errors.code}>
  <FieldLabel htmlFor="code" required>Código</FieldLabel>
  <Input id="code" aria-required aria-invalid={!!errors.code} {...register('code')} />
  <FieldDescription>Lo asigna el servidor si lo dejás vacío.</FieldDescription>
  <FieldError errors={[errors.code]} />
</Field>
```

- `required` en `FieldLabel` pinta el asterisco (glifo, no solo color — §8) y
  expone `data-required`. Lo accesible lo aporta el control con `aria-required`.
- `data-invalid` en `Field` tiñe el grupo; `aria-invalid` en el control dispara el
  anillo destructivo de Maia.
- Para switches y checkboxes: `<Field orientation="horizontal">` +
  `FieldContent` + `FieldLabel` + `FieldDescription`.
- El ritmo vertical lo da `Field`/`FieldGroup`, no `space-y-*` a mano.

### Errores: en el campo. Toast: el resultado.

| Qué | Dónde |
|---|---|
| Validación de un campo (formato, requerido, duplicado, regla cruzada) | `FieldError` — **nunca** un toast |
| Acción bloqueada por una regla | El control se `disabled` con `title`, no se deja intentar y avisar |
| Resultado de la operación (guardado, fallo de red, 4xx del backend) | `toast` |

`setError('campo', { message })` es la vía para los errores que solo se conocen al
enviar (ej. código duplicado contra la lista ya cargada).

### Contenedores

| Tarea | Contenedor |
|---|---|
| Formulario del panel (corto o largo) y confirmación | `Dialog` |
| Panel contextual del **storefront** (carrito, quick-add) y sidebar en móvil | `Sheet` |

El panel usa `Dialog` en exclusiva, incluido el editor de producto. **No se migra
a `Sheet` a pesar de ser el formulario más largo**: es un banco de trabajo de dos
columnas (contenido + barra lateral de organización) que necesita ancho, no un
panel lateral; ya resuelve el largo con cuerpo scrolleable y pie fijo.

`ui/drawer.tsx` (vaul) es una primitiva del registry **sin ningún uso**. No se
introduce: cualquier caso que la tentaría es `Dialog` o `Sheet` según la tabla.

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
- ❌ `<input>` / `<select>` crudos en un formulario. Van `Input`, `Textarea`, `Select` o
  `NativeSelect`. Excepción: inputs de infraestructura sin apariencia propia (file oculto,
  radio `sr-only`, buscador embebido dentro de un contenedor ya estilizado como `DataTable`).
- ❌ Copiar en línea las clases de una primitiva (`className="flex h-10 w-full rounded-md
  border border-input …"`). Se ve parecido pero pierde foco, `disabled` y `aria-invalid`, y
  queda congelado en el idioma de Tailwind v3 (`ring-offset-background`) que este proyecto ya
  no usa. **`className="input"` no existe**: es herencia de v1 y renderiza sin estilo alguno.
- ❌ Formatear dinero a mano en el componente. Todo pasa por `lib/formatters.ts` (§3).
- ❌ `useState` como estado de un formulario del panel, y `<div><Label/><Input/></div>`
  en vez de la familia `Field` (§6b).
- ❌ Sacar un error de validación de campo por `toast` (§6b).
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
- **`window.confirm()` nativo en 6 sitios**, contra la regla de contenedores de §6b
  (las confirmaciones van por `Dialog`/`AlertDialog`, que ya existe como primitiva):
  `admin.catalogo.tsx` (borrar producto y borrar categoría), `admin.salidas.tsx`
  (marcar devuelta), `admin.inventario.tsx` (retirar de bodega),
  `TemplatesPanel.tsx` (borrar plantilla) y `ProductEditorDialog.tsx` (aviso de
  variantes sin lote — este último queda anidado dentro de un `Dialog` abierto, así
  que necesita decidirse aparte).
- **`GeneralConfig` en `admin.configuracion.tsx` es una maqueta**: campos con
  `defaultValue`, sin estado ni endpoint. No cuenta como formulario migrado porque
  todavía no guarda nada.
