# 11 · Lógica financiera y operativa — Gyro Store v2

> Toda la matemática del negocio (costeo, pozos, precios, comisiones, mayoreo) sale de mi Excel real
> (`Compras-Mayo.xlsx`, hojas Compras/Stock/Costos Fijos/Ventas/Reportería/Mayor). Acá la dejo
> documentada al detalle para que el **backend (Postgres/TS) la calcule solo**, sin que nadie pueda
> romper una fórmula por accidente como pasa en Excel. **Las cifras de las tablas son las reales de mi
> simulación**; las dejo como valores por defecto, pero **todas son editables desde el panel**
> (viven en `app_config`, ver §9).

## Reglas de oro de este dominio
1. **Todo se calcula en el servidor**, en `numeric` de Postgres (no floats — el Excel arrastra ruido
   tipo `1.75000000002`; con `numeric` eso no pasa).
2. **Se congela al aprobar la venta.** Cada venta guarda una foto de sus números (coste, comisión,
   pozos, ganancia). Cambiar un costo o un % después **no reescribe** ventas viejas. [decisión tomada]
3. **Todas las tablas de tiers y % son configurables** desde el admin. [decisión tomada]
4. **La tasa de cambio se congela por lote de compra.** Si mañana sube el dólar, el costo histórico
   de un lote ya recibido no se mueve.

---

## 1. Costeo de inventario (Compras → Stock)

Cuando registro una compra de China, por cada línea de producto:

| Paso | Fórmula | Ejemplo (IN1) |
|---|---|---|
| Pre-Total (USD) | `Cantidad × Costo China` | `5 × 4.61 = 23.05` |
| Total compra (USD) | `Pre-Total + (Cantidad × Impuesto unit)` | `23.05 + (5 × 0.2068) = 24.084` |
| Costo unitario origen (USD) | `Total / Cantidad` | `24.084 / 5 = 4.8168` |
| Costo real (USD) | `Costo unitario origen + Envío unit` | `4.8168 + 0.4041 = 5.2209` |
| **Costo real (C$)** | `Costo real (USD) × Tasa de cambio` | `5.2209 × 37 = 193.1733` |

- **`Impuesto unit`** y **`Envío unit`** son montos **por unidad en USD** que entro en la compra
  (en la simulación fueron `0.2068` y `0.4041`; varían por lote). No son porcentajes.
- **`Tasa de cambio`** (37 en la simulación) se **congela en el lote** al recibirlo.

---

## 2. Costo Fijo Unitario (Costo F/U) y los "pozos"

A cada producto se le asigna un **Costo Fijo Unitario** según una **escala escalonada por su Costo
real en C$** (no en USD — el Excel usa C$):

| Costo real (C$) | Costo F/U (C$) |
|---|---|
| < 100 | 15 |
| 100 – 200 | 25 |
| 200 – 300 | 35 |
| 300 – 500 | 55 |
| 500 – 800 | 75 |
| 800 – 1300 | 95 |
| 1300 – 2000 | 120 |
| > 2000 | 150 |

Ese Costo F/U **no es ganancia**: se reparte automáticamente en **7 pozos** (presupuestos mensuales).
Los % suman **100%**:

| Pozo | % del Costo F/U | Para qué |
|---|---|---|
| Publicidad | 25% | FB, IG, TikTok |
| Mantenimiento Web | 7% | Render, Cloudflare, Supabase |
| Útiles | 5% | bolsas, papel, teip, tarjetas |
| Garantías | 8% | dañados, regalías, perdidos |
| **Préstamos (Ficosha)** | **40%** | préstamo de la tienda |
| Suscripciones | 5% | Canva, Claude |
| Servicios básicos | 10% | servicios de la casa |
| **Total** | **100%** | |

> Ejemplo: Costo F/U = 25 → Publicidad 6.25, Mantenimiento 1.75, Útiles 1.25, Garantías 2.00,
> Préstamos 10.00, Suscripciones 1.25, Servicios 2.50. (Suma 25.)

**Semántica del pozo:** cada venta "recoge" el Costo F/U de sus unidades y lo acumula en cada pozo.
En reportes veo cuánto hay reservado por pozo (§8). Como el Costo F/U ya está dentro del costo del
producto, el gasto real no baja la ganancia hasta que **supera** lo acumulado en su pozo.

**Coste final (C$) = Costo real (C$) + Costo F/U.**
Ejemplo IN1: `193.1733 + 25 = 218.1733`.

---

## 3. Precio de venta público (PVP)

El sistema **sugiere** un precio con margen bruto escalonado según el **Coste final**:

`Precio sugerido = Coste final / (1 − Margen)`

| Coste final (C$) | Margen |
|---|---|
| < 50 | ⚠️ Error (no vender tan barato) |
| ≤ 300 | 43% |
| ≤ 500 | 41% |
| ≤ 900 | 37% |
| ≤ 1500 | 33% |
| ≤ 2500 | 30% |
| > 2500 | 25% |

> Ejemplo IN1: `218.1733 / (1 − 0.43) = 382.76`.

- **Precio tentativo (manual):** puedo redondear el sugerido (ej. de `382.76` → `400`). **El precio
  tentativo es el que manda**: es el que se cobra y con el que se calcula la ganancia.
- **Ganancia unitaria (retail) = Precio tentativo − Coste final.** Ejemplo: `400 − 218.1733 = 181.83`.

---

## 4. Ventas y comisiones (por línea de producto)

Cuando el vendedor registra una venta, por cada línea el sistema calcula:

| Paso | Fórmula | Ejemplo (IN1, 1 und a C$400) |
|---|---|---|
| Importe | `Precio unitario × Cantidad` | `400` |
| Coste unitario | `Coste final` (del producto) | `218.1733` |
| **Utilidad bruta** | `(Precio unitario − Coste final) × Cantidad` | `181.8267` |
| **Salary (deducción admin 20%)** | `Utilidad bruta × 20%` | `36.3653` |
| **Utilidad neta** (base comisionable) | `Utilidad bruta − Salary` | `145.4614` |
| **Comisión vendedor** | escala sobre Utilidad neta (abajo) | `145.46 × 40% = 58.1845` |
| **Ganancia tienda** | `Utilidad neta − Comisión` | `87.2768` |

**Escala de comisión (tramo único sobre la Utilidad neta):**

| Utilidad neta (C$) | Comisión |
|---|---|
| ≤ 100 | 45% |
| ≤ 200 | 40% |
| ≤ 400 | 37% |
| ≤ 500 | 35% |
| ≤ 600 | 31% |
| ≤ 900 | 27% |
| **> 900** | **⚠️ PENDIENTE — no definido en el Excel (hay que decidirlo)** |

- **Tramo único:** se busca el rango y ese % se aplica a **toda** la utilidad neta (no marginal). [decisión]
- **Por línea:** la utilidad neta de la línea es `(precio − coste) × cantidad`; con ese total se busca
  el tramo. [decisión] *(En el Excel todas las ventas de prueba son de 1 unidad, así que el efecto de
  cantidad > 1 conviene confirmarlo con un caso real — ver §10.)*
- **El Salary (20%) es un fondo de la empresa**: no es del vendedor ni cuenta como "ganancia tienda";
  se acumula aparte (§8).
- **Todo esto se congela al aprobar** la venta (foto en `order_items`).

---

## 5. Venta al por mayor (mayoreo)

El cotizador aplica descuento automático por volumen **sobre el precio de venta**, y la ganancia se
calcula **respetando solo el Costo real** (en mayoreo se sacrifican los pozos para mover volumen):

| Cantidad | Descuento | Precio mayoreo | Ganancia unit (mayoreo) |
|---|---|---|---|
| 3 – 5 | 10% | `Precio × 0.90` | `Precio×0.90 − Costo real (C$)` |
| 6 – 11 | 15% | `Precio × 0.85` | `Precio×0.85 − Costo real (C$)` |
| 12+ | 20% | `Precio × 0.80` | `Precio×0.80 − Costo real (C$)` |

> Ojo: la ganancia de mayoreo usa **Costo real (C$)**, NO el Coste final (no descuenta los pozos).
> El descuento aplica sobre el **precio de venta del producto** (el que tengo cargado).

**Pendiente:** definir si el vendedor gana comisión en ventas de mayoreo, y sobre qué base (ver §10).

---

## 6. Ejemplo completo de punta a punta (IN1)

```
Compra:  5 und × $4.61 + impuesto $0.2068/u  → costo origen $4.8168/u
Envío:   +$0.4041/u                          → costo real  $5.2209/u
Tasa 37: × 37                                → Costo real   C$193.17
Costo F/U (tier 100–200): C$25 → pozos: Pub 6.25 / Mant 1.75 / Út 1.25 / Gar 2 / Prés 10 / Susc 1.25 / Serv 2.5
Coste final: 193.17 + 25       = C$218.17
PVP sugerido (margen 43%):     = C$382.76   → precio tentativo redondeado = C$400
── Venta de 1 und a C$400 ──
Utilidad bruta:  400 − 218.17  = C$181.83
Salary (20%):                  = C$36.37   (fondo empresa)
Utilidad neta:                 = C$145.46
Comisión (tramo ≤200 → 40%):   = C$58.18   (vendedor)
Ganancia tienda:               = C$87.28
```

---

## 7. Inventario migrado (Excel viejo)

`migrated_inventory` ya trae su **costo real dado** (no corre el FIFO de compras). Le aplico igual el
Costo F/U (por su Costo real en C$), el Coste final, el PVP y la comisión, **salvo que decida lo
contrario**. [confirmar en §10]

---

## 8. Qué muestra la reportería (calculado con SQL)

Por vendedor y en total, sin intervención manual:
- **# ventas, unidades, total vendido, coste total, comisión total, ganancia tienda total.**
- **Salary acumulado** (fondo empresa, el 20% de todas las utilidades brutas).
- **Pozos recogidos:** cuánto hay acumulado en cada uno de los 7 pozos (Publicidad, Mantenimiento,
  Útiles, Garantías, Préstamos, Suscripciones, Servicios).

> En la simulación: 107 ventas, vendido C$120,540, coste C$78,748, comisión C$11,480, **ganancia
> tienda C$21,953**, y C$7,180 recogidos en pozos. Esos números salen todos de las fórmulas de arriba.

---

## 9. Tablas configurables (viven en `app_config`)

Todo esto lo edito desde el admin, sin tocar código:
1. **Tasa de cambio por defecto** (se congela por lote al recibir).
2. **Escala de Costo F/U** (los 8 tramos de Costo real C$ → monto).
3. **% de los 7 pozos** (deben sumar 100%; el sistema valida).
4. **Escala de márgenes del PVP** (los 6 tramos de Coste final → %).
5. **% de Salary** (hoy 20%).
6. **Escala de comisión** (los tramos de Utilidad neta → %).
7. **Descuentos de mayoreo** (los 3 tramos de cantidad → %).

> Regla del servidor: al guardar los % de pozos, validar que sumen 100%. Al calcular una venta,
> **guardar qué versión de la config se usó** (o directamente los valores resultantes) para el snapshot.

---

## 10. Pendientes de definir (lo que el Excel no cierra)
1. **Comisión para Utilidad neta > 900 C$:** el Excel devuelve "Error" ahí. Falta el/los tramo(s).
2. **Comisión en mayoreo:** ¿el vendedor comisiona en ventas por mayor? Si sí, ¿misma cadena
   (Salary 20% + escala) sobre la utilidad de mayoreo (precio con descuento − Costo real)?
3. **Cantidad > 1 en comisión:** confirmar que el tramo se busca sobre la utilidad neta **total de la
   línea** (`(precio−coste)×cantidad`), no por unidad. (El Excel solo probó cantidad = 1.)
4. **Inventario migrado:** ¿aplica el mismo Costo F/U + pozos, o va con su costo puro?
5. **Base del descuento de mayoreo:** aplicar sobre el precio tentativo cargado del producto
   (asumido), no sobre el sugerido.

---

## 11. Dónde vive en el modelo de datos (ver doc 03)
- **`purchases`:** `costo_china_usd`, `impuesto_unit_usd`, `envio_unit_usd`, `exchange_rate` (congelada),
  🧮 `costo_real_usd`, 🧮 `costo_real_cs`.
- **`products`/`catalog_items`:** 🧮 `costo_f_u`, 🧮 `coste_final`, 🧮 `precio_sugerido`,
  `precio_tentativo` (el precio real de venta).
- **`order_items` (snapshot al aprobar):** `precio_unit`, `coste_final_snap`, `utilidad_bruta`,
  `salary`, `utilidad_neta`, `comision`, `ganancia_tienda`, `pozos` (jsonb con los 7 montos).
- **`app_config`:** las 7 tablas configurables del §9.
