# 00 · Índice y guía de la documentación — Gyro Store v2

> **Propósito de este set.** Documentar Gyro Store a nivel SR *como si se construyera
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

- **`DESIGN.md`** — Sistema de diseño "Editorial Dark". Fuente de verdad del look del
  storefront. Nivel SR, no hace falta reescribirlo. El doc 05 lo referencia, no lo repite.
- **`PRODUCT.md`** — Brief de producto. El doc 01 lo absorbe y expande; podés dejar
  `PRODUCT.md` como resumen ejecutivo y 01 como la versión larga, o fusionarlos.
- **`docs/` interno del repo (11 archivos)** — el Version2 ya trae documentación precisa del
  **sistema actual**: `01_arquitectura`, `02_stack`, `03_rutas_api`, `04_diagramas_secuencia`,
  `05_modelo_datos_firestore`, `06_maquinas_estado`, `07_adr`, `08_operacion_y_riesgos`,
  `09_diagrama_arquitectura`, `10_changelog_hardening`, `11_frontend_guidelines`.

### Relación entre los dos sets (importante)
- El **`docs/` interno** describe el sistema **como está hoy** (referencia técnica precisa).
- **Este set (00–08)** es la **spec editable del rebuild**: la fuente de verdad de lo que
  querés que sea v2. Ya está **alineado con el código real** (verificado contra `shared/schemas.mjs`,
  `server/config.js`, `middleware/auth.js`, rutas, store y los ADRs).
- **Sugerencia de ubicación en el repo nuevo:** guardá este set en `docs/rebuild/` (o
  `docs/v2/`) para que conviva con el `docs/` técnico sin pisarlo. Vos editás `docs/rebuild/`
  a gusto; cuando algo se implemente, se refleja también en el `docs/` técnico.

---

## Glosario rápido (para que todos los docs hablen el mismo idioma)

- **Storefront** — la parte pública: home, categorías, ficha de producto (PDP), carrito → WhatsApp.
- **Back-office / Admin** — el portal `/admin`: inventario, ventas, facturación, reportes, usuarios, logística.
- **PDP** — *Product Detail Page*, la ficha de producto (`producto.$id`).
- **Monolito híbrido** — un solo servicio Express que sirve la API *y* el frontend Remix buildeado.
- **Admin SDK** — Firebase Admin (servidor), con privilegios totales; ignora las security rules.
- **R2** — Cloudflare R2, almacenamiento de imágenes compatible con S3.
- **Checkout WhatsApp** — el pedido se cierra fuera de la web, por chat; la web es catálogo + captación.
