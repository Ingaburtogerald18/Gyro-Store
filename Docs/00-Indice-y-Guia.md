# 00 · Índice y guía de la documentación — Gyro Store v2

> **Propósito de este set.** Documentar Gyro Store a nivel super detallado *como si se construyera
> desde cero*, para servir de **fuente de verdad** de la reconstrucción limpia en el
> nuevo repo. Primero se edita la documentación (Gerald), luego se toma el **esqueleto**
> del código viejo y se escribe código nuevo alineado a estos documentos.

---

## Cómo usar estos documentos

1. **Leé todo en orden** (00 → 08). Está pensado para leerse de corrido una vez.
2. **Editá lo que quieras cambiar.** Cada documento es la especificación destino, no un
   registro histórico. Si algo del sistema viejo no te gusta, cambialo acá *antes* de
   escribir código.
3. **Regla de oro:** el código sigue a la documentación, no al revés. Si en el rebuild
   el código y estos docs divergen, se actualiza el doc en el mismo commit.

## Convención de marcadores

Como no todo el código fuente estaba disponible al documentar, cada afirmación no trivial
lleva una marca de confianza. **Editá con esto en mente:**

| Marca | Significado | Qué hacer |
|---|---|---|
| `[CONFIRMADO]` | Verificado en un archivo real del proyecto (rules, env, README, deps, scripts). | Confiar. Cambiar solo si querés otra cosa. |
| `[PROPUESTO]` | Reconstrucción/diseño de intención: no estaba el código fuente, se infirió del dominio y las buenas prácticas SR. | **Revisar con lupa.** Ajustar a como realmente lo querés. |
| `[MEJORA]` | No existe (o estaba débil) en el sistema viejo; es una mejora deliberada del rebuild. | Decidir si entra en v2 o queda para después. |

## Mapa de la documentación

| # | Documento | Contenido |
|---|---|---|
| 00 | **Índice y guía** (este) | Cómo leer y editar el set. Convenciones. |
| 01 | **Producto** | Visión, usuarios, alcance, marca, objetivos de éxito. |
| 02 | **Arquitectura** | Sistema, stack, decisiones, estructura de carpetas, flujo de datos, patrones transversales. |
| 03 | **Datos y seguridad** | Modelo Firestore (colecciones/esquemas), auth, roles, reglas, autorización. |
| 04 | **Backend (API)** | Contratos de endpoints por dominio, middleware, validación, errores, servicios (R2, email, cron). |
| 05 | **Frontend** | Rutas Remix, estado (Redux/RTK Query), estructura, componentes clave. Diseño → `DESIGN.md`. |
| 06 | **Dominios funcionales** | Las 8 fases al detalle: catálogo, inventario, ventas, facturación, reportes, usuarios, logística, polish. |
| 07 | **Infraestructura y despliegue** | Entorno, variables, Render, R2, build, imágenes. |
| 08 | **Deuda técnica y plan de reconstrucción** | Hallazgos del review SR, prioridades, orden de trabajo, estrategia de repo/migración. |

## Documentos canónicos que ya existían (no se duplican acá)

- **`DESIGN.md`** — Sistema de diseño "Editorial Dark". Es la fuente de verdad del look del
  storefront. Nivel SR, no hace falta reescribirlo. El doc 05 lo referencia, no lo repite.
- **`PRODUCT.md`** — Brief de producto. El doc 01 lo absorbe y expande; podés dejar
  `PRODUCT.md` como resumen ejecutivo y 01 como la versión larga, o fusionarlos.

---

## Glosario rápido (para que todos los docs hablen el mismo idioma)

- **Storefront** — la parte pública: home, categorías, ficha de producto (PDP), carrito → WhatsApp.

