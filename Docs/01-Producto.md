# 01 · Producto — Gyro Store

> Fuente base: `PRODUCT.md` [CONFIRMADO] + expansión SR. Este documento define **qué** se
> construye y **para quién**, antes de cualquier decisión técnica.

---

## 1. En una frase

Gyro Store es un **storefront + back-office** de una tienda real de accesorios tecnológicos
en Managua, Nicaragua. El catálogo público capta y convence; el **checkout final ocurre por
WhatsApp**. El back-office (`/admin`) opera el negocio completo: inventario, ventas,
facturación, reportes, usuarios y logística. [CONFIRMADO]

---

## 2. Usuarios

### 2.1 Comprador (storefront) — mayoría móvil
- Busca audio y accesorios tech: audífonos KZ in-ear, adaptadores Bluetooth, accesorios
  PC/gaming. [CONFIRMADO]
- Llega mayormente desde **redes sociales y WhatsApp**. Navega de noche, en el teléfono,
  con una mano. [CONFIRMADO]
- **Quiere:** escanear el catálogo rápido, comparar variantes y precio, y cerrar por WhatsApp.
- **No quiere:** registrarse, llenar formularios, esperar. Fricción cero hasta el chat.

### 2.2 Admin / vendedor (back-office)
- Gestiona catálogo, inventario, ventas, facturación, logística y usuarios desde `/admin`. [CONFIRMADO]
- Perfiles internos con distintos permisos (ver doc 03 · roles).
- **Quiere:** control operativo real (costos, utilidades, comisiones, KPIs) sin depender de
  planillas sueltas.

---

## 3. Propósito y definición de éxito

El storefront debe **verse premium y de confianza** para justificar precios y convertir.
Como el cierre es por WhatsApp, la web es **catálogo + captación**, no un carrito de pago. [CONFIRMADO]

**Éxito medible:**
- Catálogo navegable y creíble que **genere pedidos de WhatsApp**. [CONFIRMADO]
- El back-office reemplaza planillas: inventario, ventas y reportes viven en el sistema.
- Tiempo de carga y usabilidad móvil de primer nivel (mayoría de tráfico móvil).

**[MEJORA] KPIs de producto a instrumentar en v2** (hoy sin medir): tasa de clic
"catálogo → WhatsApp", productos más vistos, búsquedas sin resultado, abandono en PDP.

---

## 4. Alcance

### 4.1 Dentro de alcance (v2)
- **Storefront:** home, categorías, PDP, combos, carrito local → mensaje de WhatsApp. [CONFIRMADO]
- **Back-office (8 dominios):** catálogo/edición, inventario, ventas, facturación, reportes,
  usuarios, logística, polish. [CONFIRMADO] (detalle en doc 06)
- **Auth** multi-proveedor (Google/Email/Microsoft) para el personal. [CONFIRMADO]
- **Mini-CRM de seguimientos** (`contacts/activities`) para captar leads de redes. [CONFIRMADO]

### 4.2 Fuera de alcance (v2, explícito)
- **Pasarela de pago embebida.** El pago sigue por WhatsApp. (BAC Credomatic/PowerTranz y
  Compra Click quedan como exploración futura, *no* en este rebuild salvo que lo decidas.) [PROPUESTO]
- App móvil nativa. La web responsiva cubre el caso móvil.
- Cuentas de comprador / historial de compras del cliente final.

---

## 5. Personalidad de marca

Premium, tech, nítido, confiable. Voz directa en español nicaragüense, sin relleno. [CONFIRMADO]

**Referencias de producto:** Apple Store (calma, aire, foco en producto), Nike/StockX
(jerarquía fuerte, precio protagonista, densidad controlada), Sonos/Nothing (oscuro
editorial, monocromo con un acento). [CONFIRMADO]

**Anti-referencias:** plantilla de e-commerce genérica — pills con gradiente arcoíris,
gradient-text decorativo, sombras difusas, botones con degradado como acción principal,
hit-areas chicas, filtros escondidos. Ni look SaaS-cream ni neón permanente. [CONFIRMADO]

**Identidad visual:** mascota Gyro (personaje amigable, pelo en punta, lentes de sol);
acento único **esmeralda** `#10b981`; modo oscuro por defecto con variante clara "Daylight".
Detalle completo en `DESIGN.md`. [CONFIRMADO]

---

## 6. Principios de producto (heredados, mantener en v2)

1. **El producto manda** — la foto y el precio son el héroe; el chrome (nav, filtros) se calla.
2. **Un solo acento con propósito** — esmeralda solo para acción/selección/estado.
3. **Tokens semánticos siempre** — cero colores crudos; dark↔light es un flip.
4. **Jerarquía por peso y espacio**, no por color ni cajas anidadas.
5. **Táctil y accesible** — hit-areas ≥44px, foco visible, contraste AA, motion con propósito.

[CONFIRMADO — de `PRODUCT.md`]

---

## 7. Restricciones de contexto (Nicaragua) que moldean el producto

- **Móvil primero y datos caros** → peso de página bajo, imágenes optimizadas (ver doc 07).
- **Pago cultural por WhatsApp** → la conversión real es el mensaje, no un "add to cart" de pago.
- **Moneda C$ y tipo de cambio** parametrizables (`CURRENCY`, `EXCHANGE_RATE`). [CONFIRMADO]
- **Operación pequeña / un operador** → el back-office debe ser usable por una persona sin
  fricción; nada de flujos empresariales pesados.
