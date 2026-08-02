# Iconos animados (itshover-style)

Cobertura completa: **los 238 call-sites de iconos del proyecto** pasan por acá.
No queda ningún `HugeiconsIcon` en `app/`.

## Por qué un renderer genérico y no 107 componentes

Un icono de HugeIcons no es un componente, es **data**:

```js
const Wallet01Icon = [
  ["path", { d: "M14 3H5C3.89…", stroke: "currentColor", strokeWidth: "1.5", key: "0" }],
  ["path", { d: "M3 5V15C3 17.8…", stroke: "currentColor", strokeWidth: "1.5", key: "1" }],
];
```

En toda la librería aparecen **solo cuatro tags**: `path` (53.317), `circle`
(1.539), `ellipse` (114) y `rect` (21). Los cuatro aceptan `pathLength` en
framer-motion. Así que `AnimatedIcon` mapea el array a `motion.*` y anima el
icono **real**.

Consecuencias que importan:

- **El trazo es idéntico** al del resto del sistema, porque *es* el de
  HugeIcons. No hay que aproximar el peso a ojo.
- Los **9 call-sites dinámicos** (`icon={item.icon}` en el nav del sidebar, los
  KPIs, `SalesBreakdownCards`, `NotificationsBell`, `trust-box`) funcionan sin
  tocar sus arrays de datos.
- Migrar un call-site fue cambiar el tag y el import. Nada más.

## API

Igual a la de `HugeiconsIcon`, más tres props:

```tsx
<AnimatedIcon icon={Wallet01Icon} size={16} strokeWidth={2} className="text-primary" />
<AnimatedIcon icon={ArrowLeft01Icon} gesture="nudge-x" />
<AnimatedIcon icon={ShoppingCart02Icon} trigger="view" />
```

| Prop | Default | Para qué |
|---|---|---|
| `gesture` | `'draw'` | Qué hace al animarse |
| `trigger` | `'hover'` | Qué lo despierta |
| `open` | — | Solo con `gesture="rotate-state"` |
| `autoPlay` | — | Atajo de `trigger="mount"` |

## Gesto por contexto, y por qué

| Contexto | `trigger` | `gesture` | Razón |
|---|---|---|---|
| Botón, ítem de menú, tab, command | `hover` | `draw` | El trazo redibujándose es la firma de itshover; el hover refuerza el affordance |
| **Nav del sidebar admin** | **`press`** | uno por módulo | El hover ahí ya está tomado (despliega el sidebar), así que el gesto responde al acto de **elegir** el módulo. Ver tabla abajo |
| Flechas de paginación, submenús, calendario | `hover` | `nudge-x` | Una flecha tiene que **moverse**; redibujarla no comunica dirección |
| Chevrons de select, orden de columnas | `hover` | `nudge-y` | Igual, en el eje que corresponde |
| Acciones de fila (`RowActionsMenu`), cerrar diálogo, toggle de sidebar | `hover` | `pop` | Aparecen decenas por pantalla: una sola transform es el gesto barato |
| `StatCard` / KPIs | `view` | `draw` | No son controles, nadie los hoverea. Entran con la tarjeta, junto al `CountUp` |
| Estado vacío de tabla | `view` | `draw` | Es el único elemento en pantalla; merece el gesto completo |
| Pantalla de carga de módulo | `mount` | `draw` | No hay nada que hoverear y el trazo ES el feedback |
| Toast / confirmación de venta | `mount` | bespoke | `AnimatedCheck` tiene coreografía propia (círculo y luego check) |
| Spinner | — | `none` + `animate-spin` | Único bucle del sistema, y por CSS: más barato que JS |
| Separador de breadcrumb | — | `none` | Se repite una vez por nivel y no es interactivo. Animarlo es ruido |
| Chevron de `FilterSelect` | — | `none` | Ya rota por CSS con `open && rotate-180`. **Ver abajo** |

## Gesto por módulo (nav del sidebar)

Doce ítems con el mismo `draw` se leen como una lista de doce cosas iguales. El
gesto propio ayuda a reconocer dónde estás picando sin leer la etiqueta:

| Módulo | Gesto | | Módulo | Gesto |
|---|---|---|---|---|
| Reportería | `draw` | | Facturación | `draw` |
| Inventario | `nudge-y` | | Códigos de descuento | `pop` |
| Ventas | `pop` | | Logística *(apagado)* | `nudge-x` |
| Cuotas | `nudge-x` | | CRM *(apagado)* | `pop` |
| Caja y banco | `pop` | | Personal | `draw` |
| Catálogo | `draw` | | Configuración | `pop` |

Se declara en `NavItem.gesture` (`routes/admin.tsx`). Los apagados lo tienen
declarado para el día que se enciendan; hoy no se disparan.

## Cómo re-dispara el gesto en cada click

`useAncestorPress` devuelve un **contador**, no un booleano: con un booleano
"está presionado" el segundo click no re-animaría nada, porque el valor ya
estaría en `true`.

Ese contador se convierte en un pulso `false → (siguiente frame) true → false`.
El salto de frame con `requestAnimationFrame` **no es adorno**: `setPressed(false)`
seguido de `setPressed(true)` en el mismo tick React los agrupa en un solo
render y el gesto no se reinicia.

> No se usó `useAnimationControls` (que sería lo obvio) por dos razones: obliga
> a montar los `motion.*` antes de poder llamar `start()`, lo que anula el
> upgrade perezoso; y haría falta **un control por capa**, porque `draw` anima
> los hijos mientras el resto de los gestos anima el `<svg>`. El pulso
> declarativo cubre las dos capas con el mismo mecanismo.

Escucha `pointerdown` y no `click`: el gesto acompaña al acto de presionar. En
un nav donde el click además navega, esos ~100 ms se notan.

## Las tres reglas que sostienen el rendimiento

**1. El hover es del control, no del icono.** `useAncestorHover` engancha
`pointerenter`/`pointerleave` al `closest('button, [role="menuitem"], tr, …')`.
Un icono de 16 px es un blanco de hover pésimo, y lo que el usuario percibe como
"el botón" es el botón entero. Sin esto, animar 238 sitios habría requerido
tocar la estructura de los 67 archivos.

**2. Upgrade perezoso.** Hasta que algo lo despierte, `AnimatedIcon` renderiza
`<path>` planos — cero framer-motion. Una `DataTable` de 25 filas × 4 iconos son
100 SVGs estáticos. Los `motion.*` se montan en la primera interacción y ahí se
quedan (desmontarlos en cada `pointerleave` costaría más que dejarlos).

**3. Un solo bucle.** `spin` existe pero solo lo usa el spinner, y ni siquiera
por JS.

## Trampa conocida: dos transforms sobre el mismo `<svg>`

Si un call-site ya rota o escala el icono por CSS, **hay que pasarle
`gesture="none"`**. framer-motion escribe `transform` inline y CSS escribe
`transform` en la hoja: cuál gana depende del frame, y el síntoma es un icono que
se queda a mitad de camino o un chevron apuntando al lado equivocado.

Casos activos hoy: `Spinner` (`animate-spin`) y `FilterSelect`
(`open && rotate-180`). Por esta misma razón se eliminó el bloque
`transform: scale(1.16)` de `style-maia.css` — ver el comentario que quedó en su
lugar.

## Accesibilidad y theming

- `aria-hidden` por defecto, **salvo** que el call-site declare `role` o
  `aria-label` (el `Spinner` es `role="status"`): forzarlo ahí escondería el
  anuncio del lector de pantalla.
- El color se hereda: los attrs de HugeIcons ya traen `stroke="currentColor"`,
  así que el theming Maia funciona sin tocar nada.
- `prefers-reduced-motion` cortocircuita al render estático. La única excepción
  es `rotate-state`: no es decoración, dice si el panel está abierto.

## Los cuatro bespoke

`AnimatedBell`, `AnimatedCart` y `AnimatedCheck` se quedan donde su coreografía
propia aporta algo (campana de notificaciones, carrito, check de venta
aprobada). **Ojo:** su geometría es dibujada a mano y **no** coincide con la de
HugeIcons — `AnimatedCheck` no es `CheckmarkCircle01Icon`. Para cualquier icono
nuevo va `AnimatedIcon`.

`AnimatedHeart` se eliminó: no se usaba en ningún lado.
